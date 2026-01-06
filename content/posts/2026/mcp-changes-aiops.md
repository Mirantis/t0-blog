---
title: "How Model Context Protocol (MCP) Changes AIOps"

slug: "mcp-changes-aiops"

date: 2026-01-06T00:00:00Z

author: "Randy Bias"

tags: ["mcp", "aiops", "agents", "kubernetes", "triage"]

categories: ["engineering", "operations"]

draft: false

description: "Building Nightcrier, an automated triage system that uses MCP events and general-purpose AI agents to investigate production Kubernetes failures"

image: "/images/mcp-changes-aiops/cover.jpeg"
---

[Sometimes you just have to scratch an itch.](/agents-dont-understand-ops/)
So, over this recent holiday season when things were slow, I decided to test
some ideas I had. Namely, how will [Model Context Protocol (MCP)](https://modelcontextprotocol.io/),
Agent Skills, and general purpose agents impact operations? Not software development, but IT operations and
the management of systems, networking, storage, virtualization, containers,
applications, and so on. In the past year, incredible changes to software
development have shown how artificial intelligence is changing the way we
do things. But software development is not IT operations. How will these
things change IT and take us to an AIOps nirvana that surpasses and
supplants DevOps?

My goal was to build a proof of concept system that would do several
things:

1. Exercise parts of the [MCP specification](https://modelcontextprotocol.io/specification)
   that are operations-friendly, but are currently underutilized or not
   even utilized at all
2. Understand how to build an operations-centric workflow of general-purpose
   AI agents such as [Claude Code](https://docs.anthropic.com/en/docs/claude-code)
   that are **not** similar to software engineering workflows
3. Prove that such a workflow could be arbitrarily extended by changing AI
   agent context, tools, and capabilities without changing code; i.e.
   without the use of a custom agent

## How IT Operations is Different from Software Engineering

Software engineering is mostly a human-driven process. A developer (and now
product manager or even random non-technical person!) drives software
development. Deciding what is being built, what the architecture will be,
what the tool stack is, and so on. The human driver(s) have an objective
and outcome in mind.

IT Operations is slightly different in that while there is some human-driven
process, there are also other modalities. When I think about it, I think
about there being essentially three large buckets of activity:

- **Proactive**: operating similarly to software engineering, this is the
  practice of building tooling, software, configuration systems, paying
  down technical debt, and so on, which is largely human-driven.
- **Reactive**: responding to failures in real-time in production systems;
  all systems fail and while modern architectures are largely resilient to
  common failure conditions, failures are still common and frequently come
  from operator error and bugs, rather than mundane problems like failing
  disk drives.
- **Predictive**: looking at historical data, trends, and determining
  proactive steps (above) that may be non-technical in nature to deal with
  potential issues before they happen such as capacity management, scaling
  of systems that can't be autoscaled (re-architecting networks, ordering
  new drives, etc).

IT Operations is not software development, even though there are places
where they overlap and share interests (e.g. CI/CD pipelines).

## A High Level Overview of What Was Built

Put simply, I built an automated triage and investigation system for system
faults that is powered by general purpose AI agents and triggered by faults
in production automatically. The idea was to see if we could create a
"virtual [SRE](https://sre.google/sre-book/introduction/)" or "automated
triage agent" that could do the heavy lifting of some of the more time
consuming parts of performing root cause analysis, event correlation, and
related tasks that are part of any triage process.

To that end, I looked at some of the parts of the MCP protocol that can be
used for reacting to changes in real time such as the ability for
[MCP servers to send events](https://modelcontextprotocol.io/specification/2025-06-18/basic/transports#listening-for-messages-from-the-server).
This has now, as of the 11-25-2025 protocol release, become obscured by
"tasks"[^1]. For this article, we will focus on the sending of events from
MCP servers to some kind of curation system.

It was important to scope the initial proof-of-concept's domain down to
something that was achievable in the timeframe, yet extensible conceptually
if the idea had legs. So I chose to go with automated triage of production
Kubernetes failures, which are generally well understood and for which it
would be easy to reuse existing tooling.

So Nightcrier was born:

![Nightcrier Architecture](../images/mcp-changes-aiops/nightcrier-architecture.png)

Nightcrier, at its heart, is a very simple system. It is composed of:

- MCP listeners subscribing to events sent from MCP servers
- An incident handler that manages event state, triggers triage runs, and
  orchestrates the process
- Triage agents using general purpose agents such as Claude Code,
  [Codex](https://openai.com/index/openai-codex/),
  [Gemini](https://ai.google.dev/gemini-api/docs), or
  [Goose](https://github.com/block/goose)
- Specialized context and tools:
  - Constructed triage prompt
  - Incident context and information
  - [Agent Skills for Kubernetes clusters troubleshooting](https://github.com/randybias/k8s4agents)
  - [Kubernetes MCP servers](https://github.com/strowk/mcp-k8s-go)
  - Kubernetes API endpoint access

The workflow is also simple:

- Production event classified as a "fault" (e.g. pod in
  [CrashLoopBackoff](https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/#container-restarts))
  is emitted
- Fault is received, recorded, and tracked through its lifecycle
- An investigation is started by the triage agent
- The triage agent runs in a sandboxed and controlled environment via
  [k8s Jobs](https://kubernetes.io/docs/concepts/workloads/controllers/job/)
- A report is finished and uploaded to an object storage system
- Operators are notified (in this case via Slack)

The system is modular and reusable. Meaning you can modify and change out
any of the following to examine or diagnose production issues:

- Any MCP server can emit events, so any MCP server can trigger a triage
  run
- Agent Skills could be swapped out (e.g. VMware troubleshooting skills or
  a custom app built in-house)
- Different general purpose agents or models could be swapped out (although
  in my testing there was mostly no difference)
- Different MCP servers could be provided to use

This creates a very flexible system whereby the agent is given an initial
prompt, with the appropriate context and then can load the additional
context (skills) or tools (MCP servers or APIs) that it needs to execute
on its objective.

## What a Comprehensive Version of this Might Look Like

Importantly, in assembling the initial environment, you could load ALL
kinds of skills and provide access to ALL kinds of MCP servers at the same
time and let the agent make its own decisions. This was out of scope for
this POC, but imagine, for example, that you had a bespoke backend process
running on Azure with an MCP server built specifically for that backend
that connected to your existing telemetry systems and could trigger events
when something happened in production. You'd have access to all of the
following:

- Azure troubleshooting skills and the Azure-managed MCP endpoint
- Kubernetes troubleshooting skills and a Kubernetes MCP server running in
  the backend clusters
- Application level bespoke MCP server (plus accompanying skills) for your
  bespoke backend service running in the backend clusters

A triage agent launched with all of this context would be able to collect
real-time data and state via the MCP servers, work through everything with
the loaded skills, and provide a robust root cause analysis in a very short
period of time, including a full "proof of work" that could be evaluated by
an operations team.

## What Nightcrier Looks Like Today

Nightcrier is fully operational as of the writing of this article. It has
gone through a number of iterations and probably isn't at its final state,
but it already does some fairly cool things. I'll share some screenshots.

Just a reminder, folks: this is a **proof-of-concept**. Yes, there are lots
of things it could do, lots of things it doesn't do, and many things that
could be improved. My objectives were to test some theories, not build
something to ship to folks today.

Let's see some screenshots and relevant context!

### Investigation Reports

![Investigation Report](../images/mcp-changes-aiops/investigation-report.png)

The beginning of an example investigation report, rendered in HTML from the
original Markdown output by the agent.

### Dev UI for Local Ease of Use

![Dev UI](../images/mcp-changes-aiops/dev-ui.png)

Just a simple local user interface while developing to have some easier
visualizations[^2].

### Example Context, Reports, Source, Etc

I thought I would also share some of the current initial context that is
provided to the triage agents and their output as well.

- The full "triage prompt" that is passed into the agent can be seen
  [here](https://gist.githubusercontent.com/randybias/9782eab477e16b2a9f9f641a6c9709ad/raw/df1e61a529283ef5cbbe9cb9dc7cf0a053ee8a0c/nightcrier-example-triage-prompt.md)
- The full HTML rendering of the agent's report is
  [here](https://gist.github.com/randybias/f43fa21d3f8911f84c96f411b34109b1)
  and the original markdown is
  [here](https://gist.githubusercontent.com/randybias/f43fa21d3f8911f84c96f411b34109b1/raw/ad5a031e22e32a3ec69856360bfaa75eefb69a03/nightcrier-investigation-report.md)

I'm not publishing the code as it needs some documentation loving first and
it was just a POC, but you could easily find it if you wanted to.  It is
not hidden[^3].

### A Few Quick Sidenotes

There are a bunch of little nuances that you won't notice from
screenshots alone. Most of which I implemented just because I could and not
directly in service of achieving the objectives of the POC. But they are
cool, so I'll just mention them here briefly.

*Scoped and timebound Kube tokens* - it's only a manual process right
now, but the triage agents are passed read-only scope and time bound
[Kubernetes authorization tokens](https://kubernetes.io/docs/reference/access-authn-authz/authentication/)
for talking to the k8s API. In the future this could be minted by the k8s
MCP server and passed in the original fault event.

*Non-blocking, async architecture* - the MCP listeners, agent runners,
and most of the system is just a big event driven loop that can run things
in parallel, so listen to N number of MCP servers, launch N number of
agents. The only place serialized was to have a single triage agent talk to
a k8s server at a time during investigations.

*Agent containment* - In addition to running in a sandboxed limited Linux
container, the agents are also restricted to specific tools they can execute.
Along with the readonly kubeconfig you can have high confidence nothing
weird is going to happen, but agent containment and security measures could
go much deeper in practice.

*Real-time triage runner information* - [NATS messaging](https://nats.io/) is used to emit
updates on the triage run at not only the start and end of the run, but
also (if you use Claude Code only) it triggers on the [PreToolUse hook](https://docs.anthropic.com/en/docs/claude-code/hooks) and
emits updates as Claude Code is running tools. You can see in real-time
what the agent is doing, which is pretty cool and even sparks a bunch of
ideas of what you could do with it from a security perspective.

## What We Learned from this POC

This proof of concept was very successful and I'm excited about what the
future brings in terms of AIOps. We proved that there were alternative
workflows to the one typically used with Claude Code. We proved that you
could build a distributed agentic triage system that would be triggered by
real events. We showed that such a system could be relatively pluggable.
The beginnings of what a security model looks like are there.

I have a ton of ideas of where you could take this, but as a teaser,
imagine if:

- An operator could ask a triage agent to run additional steps or could
  trigger a different, non-triage agent to take remediation steps
- On registration of a new distributed system to be monitored (k8s or
  other), you can launch a "mapping agent" that would build a dependency
  graph of the system's environment

The future may not be evenly distributed yet, but I'd like to see it get
there!

[^1]: Tasks arrived a bit after I conceptualized this POC and I haven't
    fully evaluated them yet. Unfortunately, tasks do not appear to be the
    direction that is needed for building reactive systems. At least not in
    isolation. We need events to be emitted from these managed systems
    based on local conditions.

[^2]: Yes, it's just HTTP to the test clusters because this is all setup in
    a private VPN, but also because I plan a fun follow on article about
    securing regular MCP servers with TLS+auth+guardrails using AI agent
    gateways and then wiring all of this up with tokens, distributed auth
    and so on.

[^3]: A quick note, I did have to modify an existing Kubernetes MCP server
    to make Server Sent Events (SSE) working over Streaming HTTP.  If you
    were to play around with the system you would need that fork as well.
    It is also easily found if you look for it.

