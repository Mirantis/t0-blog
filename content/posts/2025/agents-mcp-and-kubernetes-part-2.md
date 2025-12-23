---
# Post title - will be auto-generated from filename if not changed
title: "Agents, MCP, and Kubernetes, Part 3"

# Publication date - automatically set to current date/time
date: 2025-12-22T10:00:00Z

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

description: "Learn how to Secure AI agents and Model Context Protocol (MCP) servers on Kubernetes with Istio Ambient Mode. Part 2 of a three-part series exploring production-ready agentic architecture."

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

image: "images/agents-mcp-and-kubernetes/part-2.png"
---

## Introduction
Agents, MCP on Kubernetes, Part 2

Jensen Huang has [mentioned](https://africa.businessinsider.com/news/jensen-huang-says-he-wants-nvidia-to-be-a-company-with-100-million-ai-assistants/st3jsb5) that NVIDIA has a target of 1 million agents in production for 50,000 employees, a ratio of 2000:1. This does not include MCP servers, data sources, or API endpoints. An incredibly ambitious target, it hints at a future of massive "agentic sprawl" in our enterprise systems. This kind of scope requires re-examining security and compliance. It also highlights and reinforces the need for strong "default deny" based security. The gold standard for default deny in networking is Zero Trust Networking Architectures (ZTNA).

In this second part of our series, we will examine how to deliver ZTNA for agents and MCP servers in Kubernetes clusters with a focus on Istio in Ambient Mode ("Istio ambient" from here on out) and L4 networking. In our follow on blog posting we will look more closely at how Istio ambient enables deeper integration with L7 proxies for application level security and policy enforcement.

## Istio in Ambient Mode

### A background on Istio in Ambient Mode

Istio is a service mesh that secures and controls communication between microservices on Kubernetes. It provides traffic management, zero-trust security (mTLS + workload identity), and deep observability, all without requiring changes to your application code.

Traditionally, Istio achieved this by injecting a sidecar proxy into every pod, which worked well but introduced operational and Resource Overhead and made Change Management difficult. This is what led to the creation of Istio Ambient Mode, a lighter, sidecar-less architecture.

To address the scaling, security, and operational challenges of traditional service-mesh models, the Istio community led by contributors from Google, IBM, Solo.io, and the wider open-source ecosystem designed Istio Ambient Mesh, a sidecar-less architecture announced in 2022-2023 and now a primary deployment mode.

Ambient Mode moves security enforcement out of application pods and into the node and network layers, creating a lighter, safer, and more scalable mesh that is especially well-suited for agent and MCP-based systems.

### Why ztunnel can be trusted

Ambient Mode is anchored by ztunnel, a lightweight, node-level security engine that forms the Zero-Trust boundary for every workload on that node.

ztunnel is not a general-purpose proxy.
It is a dedicated Layer-4 security component whose sole purpose is to authenticate workloads, encrypt traffic, and enforce policy.

Because it operates outside the application sandbox, workloads cannot modify, disable, or bypass it. Every connection is explicitly authenticated using workload identity, encrypted by default, and permitted only if policy allows it.

ztunnel also provides a verifiable security record.
Every handshake, authorization decision, and connection event is observable through logs, traces, and metrics. This makes Zero-Trust enforcement measurable and auditable rather than implicit or assumed.

Just as importantly, ztunnel is intentionally minimal. It avoids parsing application protocols, exposes only tightly scoped control interfaces, and is implemented in memory-safe Rust. This dramatically reduces attack surface compared to traditional sidecar proxies and removes entire classes of exploit paths.

The result is a security boundary that is:
 - Explicit
 - Enforceable
 - Auditable
 - Difficult to bypass
 - and Extremely small

This is what allows Ambient Mode to function as a true Zero-Trust execution fabric for autonomous AI systems.

## How Istio in Ambient Mode Works in Practice

After Ambient Mode is installed [see installation steps here](https://github.com/Mirantis/agensys-codereview-demo/blob/main/policies/install.md), the following are installed:

**istiod** is deployed as the central control plane, responsible for:
 - Distributing configuration
 - Issuing and rotating workload certificates
 - Managing workload identities

**ztunnel** is deployed as a DaemonSet, running one L4 proxy per node:
 - It replaces per-pod sidecar proxies
 - It handles transparent traffic interception, secure tunneling, and basic L4 enforcement

The following show all the core components and behaviors which are established:

<img src="../images/agents-mcp-and-kubernetes/ambient-mode.png">

## How Ambient Mode Works

Istio Ambient Mode separates the mesh into a control plane that defines trust and a data plane that enforces it.

The control plane runs in the istio-system namespace and is centered around istiod. Istiod distributes configuration, issues and rotates workload certificates, and binds cryptographic identities to Kubernetes service accounts, creating a verifiable chain of trust for all workloads in the mesh.

Each Kubernetes node runs ztunnel as a DaemonSet. ztunnel becomes the Zero-Trust enforcement boundary for every workload on that node. It transparently intercepts pod traffic, establishes encrypted tunnels between nodes, enforces Layer-4 policy, and pre-fetches workload certificates so applications never need to manage security themselves.

<img src="../images/agents-mcp-and-kubernetes/hbone.png">

## Joining the Mesh

A namespace joins the mesh simply by applying the label: **istio.io/dataplane-mode=ambient**
No pod restarts are required. From that moment, traffic is intercepted beneath the application layer, connections are automatically encrypted with mutual TLS, workloads receive cryptographic SPIFFE [^1] identities, and full Layer-4 observability becomes available without modifying containers or startup behavior.

### Securing Traffic

ztunnel intercepts pod traffic at the network layer and secures it using HBONE, an encrypted mutual-TLS tunnel between node-local ztunnels. Applications continue to see unchanged socket semantics, while authentication, encryption, and policy enforcement occur transparently outside the application runtime.

Each workload is issued an X.509 certificate with a SPIFFE identity embedded in the SAN field. These certificates are bound to Kubernetes service accounts, rotated automatically, and used as the authoritative identity for authentication and policy enforcement.

### What Ambient Mode Provides

Out of the box, Ambient Mode delivers encrypted and authenticated Layer-4 connectivity, strong workload identities, node-level Zero-Trust enforcement, and full network observability. Layer-7 routing, request-level authorization, and advanced traffic management are introduced only where needed through waypoint proxies, keeping the default footprint minimal.

### Zero-Trust Policy Model

The default posture of the mesh is deny-all. Communication paths must be explicitly defined.

For an autonomous agent platform, this means agents are permitted to reach only their approved LLM providers and required MCP servers, MCP servers are restricted to their designated data sources, and all other traffic is blocked. These rules are defined using cryptographic workload identities rather than IP addresses, turning the cluster into a policy-defined execution graph rather than an open network.

## High Level Security ZTNA Policies

With this foundation in place, we now implement the critical access control layer. In a Zero-Trust architecture, we start with a fundamental principle: trust nothing, verify everything, and explicitly allow only what's necessary. Our default posture is DENY ALL, and we build explicit allow rules based on the principle of least privilege.

For our [ autonomous code review system ](https://prashantr30.github.io/t0-blog/agents-mcp-on-k8s-pt1/), this means :

- Agents can only reach their designated LLM providers
- Agents can only access their required MCP servers
- MCP servers can only connect to their specific data sources
- All other traffic is blocked by default

### How Policies are defined:

Each access rule is expressed using cryptographic workload identity rather than IP addresses.

Policies specify which workload identity may connect to which destination and on which ports, with everything else denied by default. This makes communication rules stable, portable, and immune to dynamic IP changes.

### The Complete Policy Set

Rather than an open mesh, the system becomes a bounded execution graph with the following policies:

| **Source** | **Destination** | **Action** | **Notes** |
|--------|-------------|--------|-------|
| Orchestrator Agent | PR Agent | ALLOW | Code Review  Execution|
| Orchestrator Agent | MCP Code Scanning Server | ALLOW | Security scanning |
| Orchestrator Agent | Executive Summary Agent | ALLOW | Report generation |
| Orchestrator Agent | GitHub MCP Server | ALLOW | PR comment posting |
| PR Agent | OpenAI API | ALLOW | Code analysis via GPT-4 |
| Executive Summary Agent | Anthropic API | ALLOW | Summary via Claude |
| MCP Code Scanning Server | Semgrep Cloud | ALLOW | Vulnerability scanning |
| GitHub MCP Server | GitHub API | ALLOW | Repository access |
| All Others | ALL | DENY | Default deny everything else |

### Policy as Code

All access rules are maintained as versioned policy code: https://github.com/Mirantis/agensys-codereview-demo/tree/main/policies

This allows Zero-Trust enforcement to be reviewed, tested, and audited like application code.

The repository defines a small, explicit set of policy files that implement default-deny and narrowly scoped allow rules for each agent and MCP service.

## **Policy Implementation Deep Dive**

Policy enforcement in Ambient Mode happens at the node boundary. Every request is evaluated before it ever reaches the destination workload.

To make this concrete, we’ll follow one representative path: the Orchestrator calling the Summary Agent. All other flows behave the same way.

### 1. Traffic Flow with Policy Enforcement

The following is a Comprehensive flowchart showing the complete journey of a request through the mesh, including all decision points where policies are evaluated.

Below is the flow of the Orchestrator communicating to the Summary Agent and the same is followed by all flows.

<p align="center">
  <img src="../images/agents-mcp-and-kubernetes/policy.png">
</p>

A request leaves the Orchestrator pod and is transparently intercepted by the node. Traffic is redirected to ztunnel, which identifies the caller using its cryptographic SPIFFE identity and evaluates policy: is this identity allowed to reach this destination?

If the request is allowed, ztunnel establishes an encrypted HBONE tunnel to the destination node and forwards the traffic. On arrival, policy is evaluated again before the request is delivered to the Summary Agent. If the request is denied at any point, the connection is dropped and the denial is logged.

### 2. SPIFFE ID-Based Authorization workflow which each Policy follows

And is the Detailed flowchart showing how ztunnel extracts SPIFFE IDs from mTLS [^2] certificates and uses them to make authorization decisions.

<p align="center">
  <img src="../images/agents-mcp-and-kubernetes/spiffe.png">
</p>

ztunnel extracts the caller’s SPIFFE ID from its mTLS certificate and compares it against the destination’s AuthorizationPolicy. If the identity matches an allowed principal, the connection is permitted. If it does not, the connection is denied.

This ensures that every network connection is an explicit identity decision enforced outside the application runtime.

### 3. Global Default-Deny Policy

<img src="../images/agents-mcp-and-kubernetes/policy-01.png">

[01-default-deny.yaml](https://github.com/Mirantis/agensys-codereview-demo/blob/main/policies/01-default-deny.yaml) policy establishes the security baseline for the entire agent platform. It places the namespace into a default-deny posture: unless a communication path is explicitly allowed, it does not exist. All inbound connections are evaluated by ztunnel on the destination node and are denied by default. This inverts the network trust model from “everything is reachable” to “nothing is reachable unless permitted.”

The result is a closed execution environment where:

  - Agents cannot accidentally talk to each other
  - Compromised workloads cannot move laterally
  - Unauthorized data exfiltration paths do not exist
  - MCP servers are unreachable unless explicitly allowed

This single policy transforms Kubernetes from an open network into a bounded Zero-Trust execution fabric.

### 4. Orchestrator Agent Access Policy

<img src="../images/agents-mcp-and-kubernetes/policy-02.png">

[02-orchestrator-policies.yaml](https://github.com/Mirantis/agensys-codereview-demo/blob/main/policies/02-orchestrator-policies.yaml) policy defines the command authority of the system.

It grants the Orchestrator the only set of outbound communication paths required to coordinate the entire workflow: the PR Agent, the MCP scanning service, the Summary Agent, and the GitHub MCP server.

All four destination services accept inbound traffic exclusively from the Orchestrator’s SPIFFE identity. No other agent can trigger reviews, initiate scans, request summaries, or publish results.

This establishes a single, auditable control plane for the autonomous workflow:

  - Only the Orchestrator may dispatch work.
  - Only the Orchestrator may trigger security scans.
  - Only the Orchestrator may request final summaries.
  - Only the Orchestrator may post results to GitHub.

Every step of the pipeline becomes centralized, deterministic, and traceable, and no agent can bypass orchestration or act independently.

## Outbound Policies
In a Zero-Trust agent platform, outbound traffic is as critical as inbound.

Each agent and MCP service is allowed to reach only its explicitly assigned external dependencies. These egress paths are enforced using a ServiceEntry to model the external service and AuthorizationPolicy to restrict which workload identity may use it.

<img src="../images/agents-mcp-and-kubernetes/policy-traffic.png">


### 5. PR Agent External Access Policy

[03-pr-agent-policies.yaml](https://github.com/Mirantis/agensys-codereview-demo/blob/main/policies/03-pr-agent-policies.yaml) policy grants the PR Agent its single permitted external dependency: the OpenAI API used for GPT-4 inference.

No other outbound connections are allowed.

The OpenAI API is modeled as an explicit mesh destination, and only the PR Agent’s SPIFFE identity is authorized to reach it. Enforcement occurs at the source node by ztunnel, preventing unauthorized egress before traffic ever leaves the cluster.

This ensures the PR Agent cannot call other LLM providers, cannot access unrelated APIs, and cannot generate uncontrolled outbound traffic. It also enforces strict cost and data-exposure boundaries.

Even if an API key were compromised, network-level enforcement prevents other agents from using it, providing defense in depth at the execution fabric layer.

### 6. Executive Summary Agent External Access Policy

[04-summary-agent-policies.yaml](https://github.com/Mirantis/agensys-codereview-demo/blob/main/policies/04-summary-agent-policies.yaml) policy defines the only external dependency of the Executive Summary Agent: the Anthropic API used to generate executive-level summaries.

The Anthropic service is modeled explicitly inside the mesh, and only the Summary Agent’s SPIFFE identity is authorized to reach it. Enforcement occurs at the source node by ztunnel, preventing any unauthorized outbound traffic before it leaves the cluster.

This ensures the Summary Agent cannot access other LLM providers, cannot reach internal services directly, and cannot generate uncontrolled outbound traffic. It also enforces a deliberate architectural decision: different agents are bound to different LLMs by network policy, not convention, i.e

 - GPT-4 is reserved for code analysis.
 - Claude is reserved for executive summaries.

This separation is enforced at the execution fabric layer, making the architecture deterministic, auditable, and cost-controllable by design.

### 7. MCP Code Scanning Server External Access Policy

[05-mcp-scanning-policies.yaml](https://github.com/Mirantis/agensys-codereview-demo/blob/main/policies/05-mcp-scanning-policies.yaml) policy defines the only external dependency of the MCP Code Scanning Server: the Semgrep Cloud Platform used for vulnerability detection.

Semgrep is modeled explicitly as a mesh destination, and only the scanning MCP server’s SPIFFE identity is authorized to reach it. All enforcement occurs at the source node by ztunnel, preventing unauthorized egress before traffic leaves the cluster.

This guarantees that the scanning MCP server cannot call LLM providers, cannot access GitHub, and cannot reach any external services beyond Semgrep. If the server were ever compromised, its blast radius would be strictly limited to its single designated dependency.

This is a core MCP design principle: each MCP server is a purpose-built adapter bound to exactly one external system, and that contract is enforced at the network fabric layer, not by convention.

### 8 GitHub MCP Server External Access Policy

[06-mcp-github-policies.yaml](https://github.com/Mirantis/agensys-codereview-demo/blob/main/policies/06-mcp-github-policies.yaml) policy defines the sole integration point with GitHub.

The GitHub API is modeled explicitly inside the mesh, and only the GitHub MCP Server’s SPIFFE identity is authorized to reach it. All outbound enforcement happens at the source node by ztunnel, ensuring no other workload can communicate with GitHub directly.

This creates a single, auditable chokepoint for all repository interactions. Agents cannot post comments, access repositories, or bypass orchestration logic. If a GitHub token were compromised, it would be usable only from this MCP server, containing the blast radius to a single, tightly controlled component.

For compliance and auditability, this also ensures that every GitHub interaction flows through one observable, policy-governed control plane.

## Summary: Zero-Trust Achieved

<img src="../images/agents-mcp-and-kubernetes/complete.png">

We've implemented a comprehensive Zero-Trust Network Architecture for our agentic AI system using Istio's authorization policies. Each component now has precisely defined access.

Our default-deny foundation inverts the traditional security model. Instead of allowing everything and blocking threats, we deny all traffic by default and explicitly permit only necessary communication paths. After policies, every connection is intentional, auditable, and enforceable through infrastructure rather than application code.

The encrypted foundation combined with these Zero-Trust policies creates production-ready agentic AI infrastructure. The rules are defined, the doors are locked, and only authorized communication flows through our system.

## Conclusion

Kubernetes has won as the de facto application delivery mechanism. Not just for cloud native, but also for AI-native going forward. Every major frontier model runs on Kubernetes. NVIDIA runs on Kubernetes. Agents and MCP servers will run on Kubernetes. Meanwhile, we will see massive agentic sprawl. Istio in Ambient Mode provides a unique capability to deliver a high quality ZTNA across your entire fleet of Kubernetes nodes running Agents and MCP servers. Policy can be enacted and enforced in a very granular manner. Most importantly, Istio ambient sets us up to also insert L7 application level security enforcement for MCP (or other protocols) along with observability. In the next couple of parts in this blog series we will go deep on L7 agent gateways and observability to help tie this entire picture together.

## References

<https://istio.io/latest/blog/2025/ambient-multicluster/?utm_source=chatgpt.com>

<https://aws.amazon.com/blogs/containers/transforming-istio-into-an-enterprise-ready-service-mesh-for-amazon-ecs/>

<https://istio.io/latest/blog/2022/ambient-security/>

<https://istio.io/latest/docs/ambient/architecture/data-plane/>


## Footnotes

[^1]:SPIFFE: [<https://spiffe.io/>] Secure Production Identity Framework For Everyone, Is an open-source standard for securely identifying software services in dynamic and heterogeneous environments. It provides a cryptographic identity to every workload in a modern production environment. SPIFFE is now graduated projects of the CNCF

[^2]:mTLS: [<https://en.wikipedia.org/wiki/Mutual_authentication>] Mutual Transport Layer Security (also called Mutual TLS or Two-Way TLS). It's a security protocol where both the client and server authenticate each other using digital certificates before establishing a connection.
