---
# Post title - will be auto-generated from filename if not changed
title: "Troubleshooting Kubernetes with AI Agents"

# Publication date - automatically set to current date/time
date: 2025-12-17T00:00:00Z

# Author name - replace with your name
author: "Randy Bias"

# Tags for categorizing content (e.g., automation, mlops, devops, aiops)
tags: ["kubernetes", "aiops", "agents", "troubleshooting", "claude"]

# Categories for broader grouping (e.g., engineering, operations, tutorials)
categories: ["engineering", "operations"]

# Set to false when ready to publish
draft: false

# Brief description/summary of the post (recommended for SEO and post listings)
description: "Using Claude Skills and an operator-in-the-loop pattern to triage production Kubernetes outages with general-purpose agents"

image: "images/claude-k8s-triage/domain-skills-domain-tools.png"
---

## Introduction

Recently, my team has been engaged with Mirantis customers who are keen to use custom agents for troubleshooting production Kubernetes clusters. While there has been a lot of significant work in applying agents to software development, there is not nearly as much activity around using agents to help with operations. I think this area, “AIOps”, is underserved and not well understood. There are MCP servers that can be used, but applying AIOps to Kubernetes is more than just technology—it’s also about process, best practices, and deliberateness. Letting an agent loose on your production systems probably isn’t the best first step.

So what is the best first step? Right now, it seems evident that an operator-in-the-loop is a fundamental requirement of using agents with production systems. What would that even look like? Do we need a custom agent to troubleshoot production issues? What about general purpose agents such as Claude Code, Codex, or Goose?

In this article, I want to show you some early work my team has done with applying general purpose agents to the task of triaging Kubernetes clusters.

## Some Context

Some of this work was inspired by a recent YouTube video from Anthropic, entitled [Don't Build Agents, Build Skills Instead](https://www.youtube.com/watch?v=CEvIs9y1uog) by Barry Zhang and Mahesh Murag of Anthropic.

{{< youtube CEvIs9y1uog >}}

You can watch the video or use the outstanding YT summarization capability, but the tl;dr is simple:

*Use a general purpose agent such as Claude Code, by providing it with a set of domain specific “skills.”*

These skills, in the form of [Claude Skills](https://claude.com/blog/skills), are essentially structured domain knowledge in Markdown format. Your general purpose agent can use these skills to attack specific problems. One part of what inspired me can be seen in the video right about the 8 minute mark where, in passing, they talk about supplementing skills with domain-specific tools in the form of [MCP servers](https://modelcontextprotocol.io/examples).

This feels like the 1-2 punch of turning general purpose agents into domain experts.

![Skills plus tools diagram](/images/claude-k8s-triage/domain-skills-domain-tools.png)

So what would this look like in practice?

## Claude Code as Kubernetes Triage Expert

We used Claude Code[^1] itself to help develop a proof-of-concept set of Claude Skills that can assist with troubleshooting Kubernetes clusters, called “k8s-troubleshooter” that can be found in the [k8s4agents](https://github.com/randybias/k8s4agents) GitHub repo. This skill includes both domain specific knowledge in Markdown format and some utility shell scripts. It also includes some initial support for MCP servers such as the [kubernetes-mcp-server](https://github.com/containers/kubernetes-mcp-server).

Importantly, these skills were **developed and meant to be primarily read-only** and to provide troubleshooting and reporting to an operator, rather than fully autonomous intervention in production systems.

So what can it do?

The k8s-troubleshooter’s core capabilities include:

* Perform an overall triage loop  
* Assess k8s pods looking at lifecycle and container issues  
* Look at basic service connectivity and DNS  
* Evaluate storage (PVC/PV) and CSI drivers and state  
* Look at network policies and CNI (Calico)  
* Find potential helm related issues  
* Node health and cluster-wide diagnostics  
* Wrap all of the above up in a comprehensive report when asked

This skill runs an initial triage script for production issues, which does the following:

| Action/Check | Description/Details |
| ----- | ----- |
| Captures evidence | Preserves cluster state before investigation (nodes, pods, events, optional cluster-info dump) |
| Checks control plane | Uses `/readyz?verbose` for component-level health status |
| Assesses blast radius | Classifies impact: single pod, namespace, multiple namespaces, or cluster-wide |
| Classifies symptoms | Detects crash loops, OOM, scheduling failures, DNS/network issues, storage problems |
| Recommends workflows | Provides specific diagnostic scripts and commands based on detected symptoms |
| Generates report | Creates markdown report with executive summary and text summary for quick reference |
| Output | Triage report with blast radius, symptoms, recommended next steps, and captured evidence. |

Claude uses this as guidance for its next steps, which then exercise other scripts, use kubectl commands directly, and allow it to “deep dive” into the various issues such that it can perform an initial root cause analysis.

The early returns are quite interesting. I have a local kind cluster and I’ve induced a complicated set of interrelated failures. Can Claude Code do a reasonable root cause analysis?

Let’s find out!

### “Production” Setup & Failure Situation

In our production failure scenario[^2] we have multiple pods in different states with different failure conditions as follows:

```shell
  🔥 Production Outage Scenario - READY

  Namespace: prod-api
  Time: Just deployed (85 seconds ago)

  Service Status Overview

  | Service                 | Replicas | Status                     | Impact                   |
  |-------------------------|----------|----------------------------|--------------------------|
  | payment-service ⚠️      | 0/2      | ImagePullBackOff           | CRITICAL - Payments down |
  | auth-service ⚠️         | 0/2      | Init:CrashLoopBackOff      | CRITICAL - Auth down     |
  | api-gateway             | 0/3      | Error/CrashLoopBackOff     | Frontend down            |
  | user-service            | 0/2      | CreateContainerConfigError | User APIs down           |
  | analytics-service       | 0/1      | CrashLoopBackOff (OOM)     | Analytics offline        |
  | notification-service ✅ | 2/2      | Running                    | Working                  |

  Overall Availability: 17% (1/6 services healthy)

  Failure Types Present

  - 🔴 Image pull errors (fake registry)
  - 🔴 Init container failures (DB migration)
  - 🔴 Application crashes (exit 137)
  - 🔴 Config errors (missing Secret)
  - 🔴 OOMKilled (memory limit)
```

Granted this is a contrived scenario, but let’s see how it goes. Please note that I’m using completely different Claude Code instances to setup the production failure scenario and to do the troubleshooting so that there is no shared context.

### Claude Code

We pass the following prompt to Claude Code:

```shell
Production outage in progress in my local Kubernetes cluster. The prod-api namespace has multiple services failing. Need immediate triage and root cause analysis.
```

For the sake of brevity, I’ll redact some of the entire process that Claude Code uses, but I’ll post a full dump [here](https://gist.github.com/randybias/32c7326d1bc183534fb80b07ae60b407).

#### Step 1: Run the Triage Script

The first thing that Claude does is run the triage script that we have created:

```shell
⏺ Skill(k8s-troubleshooter)

⏺ I'll immediately run the incident triage script to assess the production outage in the prod-api namespace.

⏺ Bash(~/.claude/skills/k8s-troubleshooter/scripts/incident_triage.sh --skip-dump --namespace prod-api)
  ⎿  =========================================
     Kubernetes Incident Triage
     =========================================
     … +113 lines (ctrl+o to expand)
```

#### Step 2: Assess the Triage Script Results

The full script results can be found [here](https://gist.github.com/randybias/11043d87a4966510ddb9c3ddaa25e90c), but the key is at the end where it gives Claude hints about what to do next:

```shell
KUBERNETES INCIDENT TRIAGE SUMMARY
Tue Dec 16 18:50:23 CET 2025

Control Plane: healthy
Blast Radius: single-namespace
Symptoms: 4

Evidence captured in: ./incident-20251216-185022

Next steps:
crashloop-pods: pod_diagnostics.sh
image-pull-errors: pod_diagnostics.sh
oom-killed: pod_diagnostics.sh
pending-pods: pod_diagnostics.sh
```

#### Step 3: Pod Diagnostics & Triage Process

At this point Claude uses the next steps to run pod by pod diagnostics. It also kicks off the use of a number kubectl commands to gather additional information for each pod failure.

```shell
⏺ I've identified several critical root causes. Let me now check the crashing services (api-gateway, analytics) to complete the picture.

⏺ Bash(kubectl logs -n prod-api api-gateway-5fb6547bc-2qp7l --previous --tail=30 2>&1)
  ⎿  Starting gateway...

⏺ Bash(kubectl logs -n prod-api analytics-service-6bb6c84877-dtsst --previous --tail=30 2>&1)
  ⎿  unable to retrieve container logs for containerd://645fd4fc32a112cb92e2680cbe319185c46222d6ff0776fe76c60831984de324

⏺ Bash(kubectl logs -n prod-api auth-service-5c6dbd7759-d6f94 -c migrate-db --previous --tail=30 2>&1)
  ⎿  Running DB migration for auth schema...
     ERROR: Connection refused - database unreachable

⏺ Let me check for missing database services, secrets, and ConfigMaps.

⏺ Bash(kubectl get secrets,configmaps,svc -n prod-api)
  ⎿  NAME                         DATA   AGE
     configmap/kube-root-ca.crt   1      4m20s

⏺ Bash(kubectl get pods,svc -n prod-api -l 'app in (postgres,postgresql,mysql,mongodb,database,db)')
  ⎿  No resources found in prod-api namespace.

⏺ Bash(kubectl describe deployment api-gateway -n prod-api | grep -A 5 "Environment:")
  ⎿      Environment:   <none>
         Mounts:        <none>
       Volumes:         <none>
     … +3 lines (ctrl+o to expand)

⏺ Bash(kubectl get namespaces && echo "---" && kubectl get pods --all-namespaces -l 'app in (postgres,postgresql,mysql,mongodb,database)' -o wide)
  ⎿  NAME                 STATUS   AGE
     default              Active   13h
     kube-node-lease      Active   13h
```

#### Step 4: Root Cause Analysis & Remediation Steps

For brevity, I will redact some of the output, but you can find the complete report [here](https://gist.github.com/randybias/2f5a391b26bc27b801ec0814e46b766a).

```shell
⏺ ROOT CAUSE ANALYSIS COMPLETE

  I've identified the root causes of the production outage in the prod-api namespace. This appears to be a misconfigured deployment with multiple infrastructure dependencies missing.

  Incident Summary

  Severity: CRITICAL - 10/12 pods failing (83% service degradation)
  Healthy Services: notification-service only (2/2 pods)
  Affected Services: api-gateway, auth-service, user-service, payment-service, analytics-service

  ---
  ROOT CAUSES IDENTIFIED

  1. Missing Secret: db-credentials (HIGH PRIORITY)

  - Affected: user-service (2 pods CreateContainerConfigError)
  - Error: secret "db-credentials" not found
  - Details: user-service requires secret with url key for DATABASE_URL

  2. Hardcoded Init Container Failure (HIGH PRIORITY)

  - Affected: auth-service (2 pods Init:CrashLoopBackOff)
  - Root Cause: Init container migrate-db is intentionally configured to fail:
  echo "ERROR: Connection refused - database unreachable"; exit 1

  3. Invalid Image Registry DNS (HIGH PRIORITY)

  - Affected: payment-service (2 pods ImagePullBackOff)
  - Error: dial tcp: lookup company-registry.io on 192.168.65.254:53: no such host
  - Root Cause: Registry hostname doesn't exist or is unreachable

  4. Missing Database Infrastructure (CRITICAL)

[REDACTED]

  5. Cascading Service Failures (SECONDARY)

[REDACTED]

  REMEDIATION STEPS (Prioritized)

  Immediate Actions (Stop the Bleeding)

  1. Create Missing Secret
  # Create db-credentials secret with database URL
  kubectl create secret generic db-credentials \
    -n prod-api \
    --from-literal=url="postgresql://user:password@postgres-service:5432/dbname"
...
```

So this is fairly interesting in that Claude has done what appears to be a fairly good job at performing root cause analysis. I would very much like to see someone apply this to a real production incident and provide feedback on how it does.

## A Brief Aside on MCP Servers

Just briefly I want to touch on MCP servers, which we do not use here. Given that Claude Skills can do quite a bit, when does it make sense to use MCP servers? This is a question we are trying to understand ourselves. Right now there seems to be a tendency to want to make MCP servers that are simply an alternative to existing APIs (REST, etc), which isn’t terribly interesting to be honest. It also creates risk of [context rot](https://www.linkedin.com/posts/ykilcher_heres-the-short-version-3-mins-of-my-analysis-activity-7354474432855191552-8mTd). Most agents are more than capable of calling an existing API without the need for MCP. I think we see this because MCP is so new and the patterns for using it aren’t clear yet. I talk about this a little bit in my recent article on The New Stack: [What is ‘AI Native’ and Why is MCP Key?](https://thenewstack.io/what-is-ai-native-and-why-is-mcp-key/)

From my perspective, here are some key things that an MCP server can do for us when talking about operations:

1. Limited, read-only, but root-level access to a running system to let a lower privileged agent access data it normally could not for performing triage  
2. Multi-step workflows, for example it could replace the scripts in the k8s-troubleshooter skill, saving context and providing richer tools  
3. Event-based subscriptions to have agents get notified about problems in production

We are going to take a deeper look at using Claude Skills with MCP servers in a follow on article. I think there is a particular advantage in #3 above that we can take a look at through the lens of doing 24x7 production operations.

## Conclusion

While this is just a proof of concept, I think it does reinforce the direction that Anthropic (and others) seem to be headed, which is to provide domain expertise to general purpose agents. Many of these general purpose agents have had some fairly significant work done on them to help them reason more effectively, to avoid loops, and to manage the LLM interaction more effectively. If you build a custom agent, you don’t have the benefits of the work that was done in this regard.

Importantly, there may be a tendency to encode your own bias and deterministic logic within a custom agent. Perhaps this is good, but only time will tell. If, instead, you are building domain skills and domain tools, you can iterate on the skills and tools for your specific business context and ride the innovation curve of those who are building and tuning general purpose agents[^3].

It is looking more and more to me that the right ‘[AI-native](https://thenewstack.io/what-is-ai-native-and-why-is-mcp-key/)’ pattern will be the use of general purpose agents turned into domain experts. I strongly recommend folks take a look at this direction rather than building their own custom agents. In a follow on we will see what this might look like for triggering agents to respond to production issues.

[^1]: Note that just recently, OpenAI has [announced experimental support for skills](https://community.openai.com/t/skills-for-codex-experimental-support-starting-today/1369367).
[^2]: Interestingly, I performed a first test without specifying it was “production” and per the Skill, Claude Code took a different approach and did **not** run the triage script, instead running some kubectl commands quickly and reporting back to the operator almost immediately. This was interesting in that Claude seems to adhere well to the Skill instructions.
[^3]: Check out this interesting video from Nik Pash at Cline: [Hard Won Lessons from Building Effective AI Coding Agents](https://youtu.be/I8fs4omN1no?si=3avljs2VMLKTgSp3).
