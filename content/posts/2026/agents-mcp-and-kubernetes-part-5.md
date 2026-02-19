---
# Post title - will be auto-generated from filename if not changed
title: "Agents, MCP, and Kubernetes, Part 5"

# Publication date - automatically set to current date/time
date: 2026-02-18T11:07:00Z

# Author name - replace with your name
author: "Prashant Ramhit & Yevhen Khvastunov"

# slug:
slug: "agents-mcp-on-k8s-pt5"

# SEO and Social Media
keywords:
  - kubernetes
  - MCP
  - Model Context Protocol
  - AI agents
  - Agent platforms
  - Agent governance
  - Behavioral guardrails
  - Policy enforcement
  - k0s
  - Istio Ambient Mode
  - AgentGateway
  - Zero trust
  - Application-level security
  - Autonomous systems
  - Production AI infrastructure

tags:
  - kubernetes
  - MCP
  - AI agents
  - Governance
  - Guardrails
  - Zero trust
  - Platform engineering
  - AgentGateway
  - Istio

categories:
  - engineering
  - tutorials
  - security

# Set to false when ready to publish
draft: false

description: "Implementing behavioral guardrails for agents and MCP workflows on Kubernetes using layered policy enforcement and gateway-based governance."

# Series information
series: ["Agents, MCP, Ambient Mode, and Kubernetes"]
series_weight: 1

# Related content suggestions
related: true

# Schema.org metadata for rich snippets
schema:
  type: "TechArticle"
  audience: "Developers, DevOps Engineers, Platform Engineers"
  proficiencyLevel: "Intermediate to Advanced"

mermaid: true

image: "images/2026/agents-mcp-and-kubernetes/5-guardrails-header.png"
---

## Introduction

The previous four parts of this series covered deployment ([Part 1](https://t0.mirantis.com/agents-mcp-on-k8s-pt1/)), zero-trust networking ([Part 2](https://t0.mirantis.com/agents-mcp-on-k8s-pt2/)), application-level routing and governance ([Part 3](https://t0.mirantis.com/agents-mcp-on-k8s-pt3/)), and observability ([Part 4](https://t0.mirantis.com/agents-mcp-on-k8s-pt4/)).

What those layers do not address is what an agent is allowed to do once a connection is established. Network policy controls whether workloads can connect. Behavioral guardrails control what they can do, pass, and trigger after that.

As agents execute multi-step workflows, invoking MCP tools, chaining external APIs, operating with delegated credentials, that distinction matters. Without explicit behavioral controls, you are relying on agents staying within expected limits by design. In production, that is not a reliable assumption.


## What Guardrails Actually Cover

Depending on context, it can mean rate limits, prompt filtering, output classifiers, or tool access restrictions. All of those are relevant, but they operate at different layers and address different failure modes. When we designed the guardrail model for our code review system, we organized around five distinct objectives:

- **Constraining which agents can invoke which tools**, the PR Agent should not be posting to GitHub. The Summary Agent has no reason to call Semgrep. These constraints should be enforced at the gateway, not assumed.
- **Validating request structure and parameters**, MCP relies on JSON-RPC. A request that doesn't conform to expected structure should be rejected before it ever reaches a backend.
- **Preventing secret leakage**, PR diffs contain code. Code sometimes contains credentials. We need to stop those from flowing into LLM prompts.
- **Controlling request frequency and cost**, agents can amplify API calls fast, especially when retries or loops are involved. Rate limits at the listener level keep this bounded.
- **Recording enforcement decisions**, without enforcement metrics, there is no way to confirm that policies are working correctly. Every enforcement event needs to be logged and measured.

The separation of responsibilities matters here. Connectivity is enforced by Istio Ambient Mode at Layer 4. Behavioral validation is handled by AgentGateway at Layer 7. Each layer handles a different class of failure, and neither replaces the other.


## The Enforcement Model

Every request in our system passes through two independent checks before reaching its destination.

At Layer 4, Istio provides SPIFFE-based workload identity, mutual TLS encryption, and explicit service-to-service authorization. Only authenticated workloads can establish connections at all. This is the foundation from Part 2 and it hasn't changed.

At Layer 7, AgentGateway evaluates request headers and identity metadata, validates JSON-RPC structure for MCP traffic, applies route-level authorization policies, inspects payload content via CEL expressions, and enforces rate limits per listener or backend.

A request that passes Istio but fails an AgentGateway policy is rejected. A request that never makes it through Istio doesn't reach AgentGateway at all. The two layers are additive, not redundant.


## Tool-Level Authorization

The agents in our system have distinct responsibilities, and those responsibilities should constrain which tools they can reach. A summarization agent does not need access to orchestration endpoints. A review agent does not need write access across all MCP servers.

We encode tool authorization rules directly in AgentGateway configuration using CEL expressions evaluated against request headers. Each agent stamps an **x-agent-id** header on its outbound requests. AgentGateway uses that header to enforce which MCP endpoints are accessible:

```
policies:
  authorization:
    rules:
      - |
        has(request.headers["x-agent-id"]) &&
        request.headers["x-agent-id"] in ["pr-agent", "summarizer-agent"]
      - |
        request.path.startsWith("/mcp/github") implies
        request.headers["x-agent-id"] == "pr-agent"
```

This configuration makes agent identity mandatory on every MCP request, and it restricts GitHub MCP access to the PR Agent only. The Orchestrator routes work. The PR Agent does the review. Only the PR Agent can interact with GitHub. That contract is enforced at the gateway, not assumed.

Authorization decisions are evaluated before routing occurs. A request that fails this check never reaches the backend.

## JSON-RPC Structure Validation

MCP communication is JSON-RPC. We validate that all incoming MCP requests conform to the expected structure before they're forwarded.

```
policies:
  authorization:
    rules:
      - |
        string(request.body).contains('"jsonrpc"') &&
        string(request.body).contains('"method"')
```

This is a lightweight structural check, not a full schema validation. Its purpose is to catch malformed or unexpected payloads before they reach MCP backends. A request without a **jsonrpc** field and a **method** field should not be forwarded to an MCP server, and stopping it at the gateway is cheaper than letting the backend deal with it.

In practice, this catches more than we expected. During initial testing, we had a few cases where agent retry logic was firing on connection failures and sending partial request bodies on the second attempt. The structural check caught those before they got any further.

## Secret and Token Filtering

PR diffs can contain secrets, API keys committed by accident, tokens in comments, cloud credentials in configuration files that were never meant to be part of the diff. We do not want that material flowing into LLM prompts.

We implemented body inspection rules to block known token patterns before requests go upstream:

```
policies:
  authorization:
    rules:
      - |
        !string(request.body).contains("sk-") &&
        !string(request.body).contains("ghp_") &&
        !string(request.body).contains("AKIA")
```

These filters catch OpenAI keys, GitHub personal access tokens, and AWS access key IDs. The pattern list is updated as new formats are identified.

This measure is not a replacement for static analysis. Semgrep handles credential detection as part of the code scanning workflow. The gateway-level filter is a secondary check that prevents the LLM from being used as an unintended exfiltration channel, if a credential slips through Semgrep inside a diff, we do not want it sitting in the model's context window and potentially reproduced in an output.

## Behavioral Parameter Constraints

Some tool invocations need parameter-level guardrails that go beyond structural validation. Operations that modify or delete resources are the clearest example, we want to allow the tool call in principle but block specific unsafe command patterns.

We use CEL expressions for this:

```
policies:
  authorization:
    rules:
      - |
        !string(request.body).contains("delete_all_files")
```

This is a simplified example. The actual rules cover a set of command patterns we identified during design review, things no agent in this system should be passing to a tool, regardless of what the model decides. We built the list by working through what would happen if each agent were compromised or entered an unexpected retry loop.

These constraints are updated over time. When we onboard a new MCP server or add an agent capability, we include a review step to assess whether any new command patterns need to be blocked.

But for MCP servers with a stable, well-defined command surface, a whitelist approach is preferable as only permitted methods are forwarded, and anything outside that set is rejected by default. We used a deny list here because the tool surfaces we were working with, were still evolving, but in a production system where tool interfaces are versioned and controlled, a whitelist eliminates the class of problem entirely.

## Rate Limits and Cost Controls

Without per-listener rate limits, a retry loop, a workflow that expands on large inputs, or a model that calls a tool repeatedly before concluding can generate far more requests than expected. The first signal is an unexpected spike in cloud spend at the end of the month.

We configure per-listener rate limits to bound throughput:

```
localRateLimit:
  - fillInterval: 60s
    maxTokens: 100
    tokensPerFill: 100
```

External LLM API calls, the Anthropic and OpenAI listeners, use tighter limits than internal MCP calls, given their direct cost implications and slower recovery when limits are hit.

Our initial rate limits were set per agent based on expected individual behavior. That was the wrong model. Rate limits should reflect expected workflow throughput, not per-agent averages. A PR with fifty files generates substantially more tool calls than a PR with two files, and static per-agent limits caused unnecessary throttling on legitimate large reviews before we corrected this. The limits now reflect the upper bound of what a complete workflow should require, with headroom for variance.

## Monitoring Guardrail Effectiveness

Guardrails need to be observable. Without enforcement metrics, there is no way to confirm that policies are working correctly or to catch regressions when configurations change. We monitor enforcement behavior using AgentGateway's built-in metrics:

- **agentgateway_cel_policy_deny_total**, counts of requests rejected by CEL rules
- **agentgateway_rate_limited_total**, rate limit triggers per listener
- **agentgateway_requests_total**, overall request volume
- **agentgateway_request_duration_seconds_bucket**, latency including enforcement overhead

These metrics are aggregated in Prometheus and tracked in Grafana alongside the Istio telemetry from Part 4. We monitor policy denials per agent, rate limit saturation trends, and denied route distribution. When a policy change ships, we can verify within minutes whether it is generating unexpected denials. When a new agent behavior appears in testing, the metrics show whether existing rules are covering it. Without this feedback loop, policy correctness in production is unverifiable.

Kiali adds the mesh-level view. When guardrails trigger at scale, traffic edges show elevated error rates and specific paths show reduced throughput. Correlating those signals with gateway enforcement metrics tells us whether a performance change is coming from policy enforcement, backend instability, rate limiting, or something else. Without both views, root cause analysis is slower and less reliable.

## The Full Stack

The full guardrail model looks as follows:

<img src="../images/2026/agents-mcp-and-kubernetes/5-final-architecture.png">


| **Layer** | **What It Prevents** | **Enforced By** |
|---|---|---|
| Network (L4) | Unauthorized connections | Istio ztunnel + AuthorizationPolicy |
| Tool authorization | Out-of-scope MCP access | AgentGateway header + CEL rules |
| Structure validation | Malformed JSON-RPC requests | AgentGateway CEL |
| Secret filtering | Credential leakage into prompts | AgentGateway CEL |
| Parameter constraints | Unsafe tool invocations | AgentGateway CEL |
| Rate limiting | Cost overruns, runaway loops | AgentGateway listener limits |
| Observability | Undetected enforcement failures | Prometheus + Grafana + Kiali |

Each layer addresses a different failure mode. Istio has no visibility into request content. AgentGateway has no visibility into connections that bypass it. Rate limits do not prevent injection if content checks are misconfigured. The layers are designed to be independent so that a gap or misconfiguration in one does not expose the system through another.

Agent systems are not a special case, the same principle applies.

## Conclusion

Operating agents in production is not simply a deployment exercise. A workload can be correctly deployed, isolated at the network layer, and fully observable, yet still introduce risk if its behavior is not constrained at the application layer.

Behavioral guardrails complete the architecture and across this five-part series, we moved from basic deployment to a layered production model:

- Agents and MCP servers running as first-class workloads

- Zero-trust connectivity with Istio Ambient Mode

- Application-level governance with AgentGateway

- Full observability through Kiali, Prometheus, and gateway telemetry

- Explicit behavioral guardrails enforced at execution time

Each layer addresses a different failure mode. Together, they form a cohesive platform.

The objective is not to restrict what agents can do, but to ensure that autonomy operates within defined, measurable, and auditable boundaries. When identity, transport security, routing policy, observability, and behavioral enforcement are aligned, agents become operable infrastructure components rather than experimental scripts.

All configurations referenced throughout this series are available in the [Code Review Repository](https://github.com/Mirantis/agensys-codereview-demo).

The MCP and agent ecosystem is evolving, but the foundational building blocks are already available. Kubernetes provides the orchestration substrate. Istio establishes identity and transport boundaries. Gateway-based enforcement governs behavior. Observability ensures operational accountability.

This is no longer experimental infrastructure. It is a viable control plane for autonomous systems.

Organizations that design for governance, visibility, and behavioral constraints from the outset will scale with confidence. Those that defer these controls will retrofit them under pressure.

Agent systems are becoming part of the enterprise control plane. The advantage will belong to those who deploy and operationalize them with discipline.

**Resources:**

- [AgentGateway Documentation](https://github.com/agentgateway/agentgateway)
- [Model Context Protocol Specification](https://github.com/modelcontextprotocol/specification)
- [Istio Ambient Mode](https://istio.io/latest/docs/ambient/)
- [CEL Language Guide](https://github.com/google/cel-spec)
- [OWASP LLM Top 10](https://owasp.org/www-project-top-10-for-large-language-model-applications/)

