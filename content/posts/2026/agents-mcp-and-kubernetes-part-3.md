---
# Post title - will be auto-generated from filename if not changed
title: "Agents, MCP, and Kubernetes, Part 3"

# Publication date - automatically set to current date/time
date: 2026-01-26T10:00:00Z

# Author name - replace with your name
author: "Prashant Ramhit & Yevhen Khvastunov"

# slug:
slug: "agents-mcp-on-k8s-pt3"

# SEO and Social Media
keywords: 
  - kubernetes
  - MCP
  - Model Context Protocol
  - AI agents
  - agentic AI
  - k0s
  - k0rdent
  - microservices
  - autonomous systems
  - code review automation
  - Semgrep
  - GitHub automation
  - Ambient Mode
  - Istio
  - AgentGateway

tags:
  - kubernetes
  - MCP
  - AI agents
  - automation
  - AIops

categories:
  - engineering
  - tutorials
  - AI/ML

# Set to false when ready to publish
draft: false

description: "Learn how to implement application-level security and intelligent routing for AI agents and MCP servers using kGateway and AgentGateway. Part 3 of a three-part series exploring production-ready agentic architecture"

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

image: "images/2026/agents-mcp-and-kubernetes/part-3.png"
---


## Introduction

In [Part 1](https://t0.mirantis.com/agents-mcp-on-k8s-pt1/) and [Part 2](https://t0.mirantis.com/agents-mcp-on-k8s-pt2/) of this series, we focused on getting AI agents and MCP servers running on Kubernetes, secured with Istio Ambient Mode and a zero-trust network model.

That work established a solid baseline: workloads can authenticate each other, connections are encrypted, and access is explicitly authorized.

What it does not address is how those workloads behave once a connection is established.

When an agent executes a workflow, it assembles prompts, calls MCP tools, chains services together, and makes decisions that affect production systems. At the transport layer, Istio only sees encrypted traffic moving between endpoints. It has no visibility into whether a request contains sensitive data, targets the right backend, or follows internal governance rules.

Once agents run production workloads, transport security alone is no longer sufficient. The focus shifts from connectivity to controlling execution behavior.

In this third part, we extend the platform beyond transport security and introduce application-level controls. By placing MCP-aware gateways above Istio's data plane, we can inspect requests, validate protocol usage, and apply policy based on what agents are actually doing.

Network security and application governance operate independently. Together, they form a layered control model where failures in one layer do not automatically expose the system.

## From Network Security to Application Intelligence

![L4 to L7 Architecture](../images/2026/agents-mcp-and-kubernetes/3-l4-l7.png)

Istio Ambient Mode provides strong transport guarantees: SPIFFE identities, mutual TLS, and explicit authorization rules that control which workloads can establish connections.

This works well for securing service-to-service traffic. It does not help with understanding the content of that traffic.

At Layer 4, the platform sees TCP streams and connection metadata. When an agent sends an MCP request, Istio sees bytes. It does not see:

- Which tool is being invoked
- What parameters are being passed
- What prompt triggered the call
- Whether the workflow violates internal policy
- Whether sensitive data is being exposed

An agent with valid credentials can use any capability supported by the protocol, regardless of whether that behavior is expected or acceptable.

This is where operational risk starts to appear.

Application-level gateways change the enforcement model. Instead of authorizing connections, they evaluate individual requests. They understand MCP, JSON-RPC, and LLM provider APIs, and can make decisions based on message structure and content.

This enables controls that are not possible at the transport layer:

- Inspecting prompts for injection patterns or secrets
- Validating MCP message formats
- Restricting tool access per agent
- Applying different limits to LLM calls and tool invocations
- Tracking cost and usage per workflow
- Auditing actual agent behavior

At this point, responsibilities are clearly separated:

- Layer 4 controls identity and connectivity
- Layer 7 controls behavior and intent

Both checks are required. Each fails in different ways. Neither replaces the other.

If an agent's credentials are compromised, Layer 7 still limits what it can do. If a gateway rule is misconfigured, the request still has to pass transport authorization first.

This dual control model keeps failures contained and makes agent behavior predictable.

### What L7 Adds on Top of L4

| **Capability Area** | **L4 Only (Istio Ambient)** | **L4 + L7 Gateway** |
|---|---|---|
| Identity & Trust | SPIFFE identities, mTLS | SPIFFE identities, mTLS |
| Authorization Scope | Connection-level | Request-level |
| Traffic Visibility | TCP flows | MCP messages, prompts |
| Policy Enforcement | Allow / deny | Prompt and protocol validation |
| Routing Logic | Static | Content-aware |
| Rate Limiting | Coarse | Per-agent, per-request |
| Observability | L4 metrics | Request tracing, cost tracking |
| Failure Handling | Retries | LLM-aware failover |
| Governance Model | Network trust | Behavioral governance |

Layer 4 continues to guarantee secure transport. Layer 7 governs how that transport is used.

## Introducing AgentGateway

Most ingress controllers and API gateways are designed for predictable HTTP traffic: fixed endpoints, stable routes, and clearly defined services.

Agentic systems do not fit that model.

Agents generate requests dynamically, use JSON-RPC and MCP, chain tools without predefined paths, and encode business logic inside prompts rather than URLs. Traffic patterns change continuously and depend on model output.

We use AgentGateway from [Solo.io](https://www.solo.io/) because it handles these patterns out of the box. It understands OpenAI and Anthropic APIs, validates MCP requests, inspects prompts, injects credentials, tracks token usage, and applies inline CEL policies.

Its multi-port design separates LLM traffic, MCP calls, and webhooks so each class of traffic can be governed independently.

### Why AgentGateway Instead of kGateway

Solo.io provides both kGateway and AgentGateway. We chose AgentGateway for three practical reasons.

**Istio Ambient Compatibility**

kGateway manages its own data plane and is designed around sidecars. In Ambient Mode, this overlaps with ztunnel's responsibilities and creates competing enforcement paths.

AgentGateway runs as a standard application proxy above Istio and does not interfere with the transport layer.

**AI-Focused Capabilities**

Features such as provider integrations, credential injection, streaming support, and token accounting are built in. With kGateway, these would require custom filters and external processors.

**Operational Simplicity**

Configuration is YAML-based, policies use inline CEL expressions, and there is no separate control plane. Istio handles transport security. AgentGateway handles application logic.

Each layer has a clearly defined role.

### Architecture Overview

Before introducing the gateway:

```
Agent -> Istio ztunnel -> LLM Provider
Agent -> Istio ztunnel -> MCP Server
```

With AgentGateway:

```
Agent -> Istio ztunnel -> AgentGateway -> LLM Provider
Agent -> Istio ztunnel -> AgentGateway -> MCP Server
```

![AgentGateway Operation](../images/2026/agents-mcp-and-kubernetes/3-agentgateway.png)

Istio is not replaced. It remains responsible for identity and encryption.

All traffic passes through two independent checks:

- ztunnel verifies workload identity and connection policy
- AgentGateway validates content and enforces application rules

This keeps enforcement centralized without introducing additional control planes.

#### Security Layers

| **Layer** | **Component** | **Enforcement** | **Failure Mode** |
|---|---|---|---|
| L4 | Istio ztunnel | Identity, mTLS, authz | Connection blocked |
| L7 | AgentGateway | Content and policy | Request rejected |

A request must pass both layers to proceed.

### Why Both Layers Matter

Transport security answers one question: who is allowed to connect.

Application governance answers another: what is allowed to happen after the connection exists.

Every request is evaluated twice:

- L4: Is this workload authorized?
- L7: Is this request acceptable?

This reduces the impact of individual failures and makes agent behavior easier to reason about.

## Overall Architecture

![AgentGateway Architecture](../images/2026/agents-mcp-and-kubernetes/3-agent-gw.png)


| **Port** | **Purpose** | **Backend** |
|---|---|---|---|
| 9080 | Orchestrator | Internal service |
| 9081 | Anthropic | api.anthropic.com |
| 9082 | OpenAI | api.openai.com |
| 9083 | MCP | GitHub, Semgrep |
| 15000 | Admin | Management UI |
| 15020 | Metrics | Prometheus |


The agent generates different types of traffic as part of its workflow: webhooks, LLM API calls, and MCP tool invocations. Instead of connecting directly to backend services, all requests pass through AgentGateway.

The gateway exposes multiple dedicated listeners, each on its own port. The orchestrator proxy (9080) handles internal coordination and applies secret filtering and rate limits. The Anthropic (9081) and OpenAI (9082) proxies manage LLM traffic, inject API keys, inspect prompts, and enforce provider-specific limits. The MCP proxy (9083) validates JSON-RPC requests, checks agent identity, and routes calls to GitHub and Semgrep MCP servers.

Operational endpoints are exposed separately: Prometheus scrapes metrics on port 15020, and the admin UI on port 15000 is used for monitoring and debugging.

Each listener enforces its own policies before forwarding traffic to backend services. This prevents agents from bypassing controls and keeps enforcement centralized.

Overall, the diagram illustrates a layered model where all agent traffic is inspected, governed, and observed before reaching external systems, enabling predictable and secure operation at scale.

Separating traffic this way prevents noisy components from affecting others and simplifies monitoring.

## Implementation

The full configuration is available in:

https://github.com/Mirantis/agensys-codereview-demo/tree/main/agent-gateway

```
agent-gateway/
├── 01-namespace.yaml
├── 02-secrets.yaml
├── 03-agentgateway-config.yaml
├── 04-agentgateway-deployment.yaml
├── 05-agentgateway-service.yaml
├── 06-mcp-servers.yaml
├── 07-istio-integration.yaml
└── test-scripts/
```

### Core Configuration Structure

```
binds:
  - port: <PORT>
    listeners:
      - routes:
          - matches: [...]
            policies: [...]
            backends: [...]
```

Key concepts:

- Binds define listening ports
- Listeners group routes
- Routes match requests
- Policies enforce rules
- Backends define upstreams

### MCP Routing

Example GitHub MCP configuration:

```
- port: 9083
  listeners:
    - routes:
        - matches:
            - path:
                pathPrefix: /mcp
          headers:
            - name: x-mcp-server
              value: github
```

Requests are routed using the **x-mcp-server** header. JSON-RPC validation and agent identification are enforced before forwarding.

## Conclusion: From Protocol to Platform

MCP provides a standard way for agents to interact with external systems. On its own, that is not enough.

Once agents run in production, they need the same governance, auditability, and operational controls as any other platform component.

Combining Istio Ambient Mode with AgentGateway creates a clear separation of responsibilities. Transport security handles identity and encryption. Application gateways handle content, policy, and cost.

This keeps the system manageable as workloads scale and complexity increases.

At that point, MCP is no longer just a protocol. It becomes part of an operational model that supports long-running, autonomous systems.

The challenge going forward is not whether agents can automate work. It is whether they can do so reliably, predictably, and within defined boundaries.

This architecture is one practical way to achieve that.

**Resources:**
- [AgentGateway Documentation](https://github.com/agentgateway/agentgateway)
- [Model Context Protocol Specification](https://github.com/modelcontextprotocol/specification)
- [Istio Ambient Mode](https://istio.io/latest/docs/ambient/)
- [CEL Language Guide](https://github.com/google/cel-spec)
