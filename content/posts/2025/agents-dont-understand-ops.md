---
title: "Today's General Purpose Agents Don't Understand Ops"
date: 2025-12-23T00:00:00Z
author: "Randy Bias"
tags: []
categories: []
draft: false
description: "A quick look at why today's general purpose agents like Claude and Codex are over-indexed on code development and how to change it."
slug: "agents-dont-understand-ops"
image: ""
---

## Agents Don't Know Ops

Today's general purpose Agents such as Claude Code, Codex, and Gemini, simply don't know or understand IT operations.  In my previous couple of postings I made a case for applying domain skills + domain tools to a particular area to turn general purpose agents into super domain experts, with a particular focus on IT operations.

But what does this mean?  How would we proceed to do something like this?

I'm going to tackle that briefly today as an early Xmas gift for y'all.

## Agents Are (Currently) Software Development First Systems

Anthropic, OpenAI, and Google do not publish their system prompts, but as with all things AI, many folks have figured out how to jailbreak the LLMs in order to extract the system prompts.  Here, for example, is the latest as of this writing (2.0.76) Claude Code system prompt:

[Claude Code System Prompt)[https://github.com/marckrenn/cc-mvp-prompts/blob/main/cc-prompt.md]

I think you will find it interesting reading.  The TL;DR for those who haven't read these things before is this:

The system prompt is extremely long and almost exclusively focused on software engineering, which is a completely different discipline in most respects.  The kinds of directives you would need for operations and even DevOps would be far more conservative in many respects.  They would also focus on very different technology areas.

## Where are the Ops Agents?

So where are the ops agents?  Unfortunately, they largely don't exist.  I had hopes early on that [Warp Terminal](https://warp.dev) would be the first, but they pivoted and entered into a massively crowded field they don't belong in and ceded this territory[^1].  Agents for Ops simply don't exist right now.

My team and I are currently leveraging these general purpose agents with some heavy prompts and skills in an attempt to reuse them for ops purposes, but it would be far better if we had an Ops-native[^2] Agent.

## Goose as the First Ops Agent?

Now that Goose has been donated to the AAIF, there is a distinct opportunity to build a command line Ops Agent.  The ying to Claude Code's yang.  My team and I are trying to figure this out, but since Goose started as a desktop first application, it still has some warts when it comes to running as a command line application.  Hopefully we can get that fixed and then start the discovery process of what an Ops-centric system prompt would be.  Then, combined with domain specific skills and domain specific tools I think we have the workings of a massive force multiplier for IT teams everywhere.

## AIOps Means Ops Agents

The path to zero toil for operators, developers, platform engineers, and DevOps teams leads through applying AIOps to IT operations.  We can't reduce toil without agents that are designed to remove that toil.  Toil doesn't just exist in software development land.  It exists across the entire IT landscape.  It's an imperative that we figure out how to apply agentic means to that entire IT landscape.  We need discipline-specific agents that can inherit domain specific knowledge and tools to truly become superhuman:

<discipline-specific-system-prompts> + <domain skills> + <domain tools>

In other words:

<IT Operations Discipline> + <Networking Skills> + <Networking Tools>

OR

<IT Operations Discipline> + <Kubernetes Skills> + <Kubernetes Tools>

As usual, the future is here, it's just not evenly distributed.


[^1]: I might write something about this in the future, but it's unlikely as it would be scathing.
[^2]: Forgive me for reusing this terrible turn of phrase, but it usually helps people with getting in the zip code of what we mean when we add the "native" adjective.