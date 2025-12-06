---
# Post title - will be auto-generated from filename if not changed
title: "Graphs in your head, or how to assess a k8s workload"

slug: "how-to-assess-a-k8s-workload"

# Publication date - automatically set to current date/time
date: 2025-04-05T00:00:00Z

# Author name - replace with your name
author: "Oleksii Kolodiazhnyi"

# Tags for categorizing content (e.g., automation, mlops, devops, aiops)
tags: ["kubernetes", "system-architecture"]

# Categories for broader grouping (e.g., engineering, operations, tutorials)
categories: ["engineering", "operations"]

# Set to false when ready to publish
draft: false

# Brief description/summary of the post (recommended for SEO and post listings)
description: "A comprehensive guide to assessing Kubernetes workloads, with tools and approaches for parsing configurations, visualizing interactions, and understanding complex systems"

image: "images/graphs-in-your-head-or-how-to-assess-a-k8s-workload/feature-image.png"
---

## **Introduction: The prevalence of Kubernetes workloads**

The role of a systems architect requires assessing and becoming familiar with various workloads and applications. Today, Kubernetes (K8s) has become the de facto standard for running services. As a result, I've recently found a growing need to evaluate solutions that run as workloads on top of K8s.

Mirantis products and open source projects are no exception — [Mirantis OpenStack for Kubernetes (MOSK)](https://www.mirantis.com/software/mirantis-openstack-for-kubernetes/), [Mirantis Secure Registry (MSR)](https://www.mirantis.com/software/mirantis-secure-registry/), [k0rdent](https://k0rdent.io/), and others operate as applications within a Kubernetes infrastructure. To streamline my work and improve efficiency, I've built a specific procedure and explored tools for parsing configurations, visualizing interactions, accessing logs, and more.

In this blog post, I'll share my experience from this journey, along with a list of the approaches and tools I currently use. If you're looking for similar solutions, I hope you'll find this helpful! And if you have your own favorite tools, I'd love to hear about them — feel free to share your thoughts and experiences in the comments.

Before we dive in, let's clarify some key terminology used throughout this text.

The term **workload** refers to a software solution that may include multiple components running on Kubernetes, including its containers, volumes, metadata, users, network, and all related components necessary for execution. A workload's boundaries are defined by the logical relationships between its components. I may also use synonyms like **service** or **components** to describe parts of a workload or the workload itself, particularly in the context of integration overviews. Examples of workloads include a standalone **MySQL** instance, a containerized **Ceph** cluster, or even a containerized **OpenStack** deployment, such as **MOSK**. In the latter case, **MOSK** is considered the workload, while individual **OpenStack services** — such as **Nova** or **Glance** — are treated as components of that workload.

However, when I specifically mention the term **Service**, I am referring to the Kubernetes feature called a **Service**, which enables exposing an application via an IP address, port, or by mapping it to an **Endpoint**.

## **Vision: Transform complex systems into clear, structured visuals**

People have different learning styles. Some prefer reading text, others grasp concepts better through images, and then there are those — like me — who love graphs. Graphs are one of humanity's great inventions, a powerful mathematical tool rooted in Graph Theory. As [Wikipedia](https://en.wikipedia.org/wiki/Graph_(discrete_mathematics)) defines it, a graph is a structure consisting of a set of objects where certain pairs of objects share a specific relationship.

Why is this relevant, and why am I bringing it up? In my work, I always translate assessment results into graphs. These graphs can then be structured into diagrams that help visualize a system. This approach is incredibly useful — not only for architectural documentation but also as an effective presentation tool.

That's why most of the tools I'll discuss in this article focus on visualization. Whether by directly representing output as a graph or by offering ways to plot component configurations, these tools help transform complex systems into clear, structured visuals.

## **Approach: Start from the top**

The best way to tackle any task is to start with a strategy. Before taking a bold leap off a cliff, you should look down, assess the height, estimate the trajectory, and plan how you'll land — whether you're diving into water or relying on a parachute. In other words, having a plan is crucial.

When it comes to assessing Kubernetes workloads, the process should follow a top-down approach. Begin with a high-level understanding: What is this application? How is it supposed to function? Then, move deeper — how is it installed? What are its moving parts within the infrastructure? Finally, drill down to the actual configuration details stored in Secrets, ConfigMaps, and other resources.

For this discussion, we'll assume the application is Kubernetes-native — designed to run on K8s and take advantage of its features. However, not all applications follow this pattern. Sometimes, you'll encounter workloads with hard-coded configurations buried deep inside containers, making them difficult to discover. While these cases exist, they're beyond the scope of this post. That said, as you progress from a high-level assessment to a deep dive, you'll eventually uncover everything you need.

Given the benefits of visualization mentioned in the previous section, let me illustrate this approach with the following diagram:

![High-Level Assessment](/images/graphs-in-your-head-or-how-to-assess-a-k8s-workload/high-level-assessment.png)

Let's take a closer look at each of these items in more detail.

## **High-Level Assessment**

The first stage of workload assessment is the High-Level Assessment. At this stage, no specialized tools are needed, as the focus is primarily on documentation review and discussions with Subject Matter Experts (SMEs) to extract essential information.

### **Business Cases**

Business cases define the sequence of actions a business must take to deliver a meaningful, observable result to the end user. In the IT world, this translates to understanding the value an application provides to its owners and how it meets business expectations. Gaining this insight is crucial before diving into use cases. Typically, business cases can be gathered from application owners and managers responsible for the system.

As the **key deliverable** of this section, we may obtain a list of business cases.

### **Use Cases**

Use cases serve as a technique for capturing, modeling, and specifying system requirements. Each use case represents a set of behaviors that the system performs in interaction with its users (actors), producing an observable result that contributes to its objectives. In essence, this step helps identify what the assessed workload does for its users and how it operates. This information can be obtained from technical documentation or directly from the application's tech lead or architect.

As the **key deliverable** of this section, we will have a comprehensive list of use cases.

### **Workload concept**

The final high-level understanding we need to establish is how the workload interacts with its environment. By combining insights from business cases and use cases, we can:

* Build a **comprehensive requirements list for the workload**, including both functional and non-functional requirements. This list will serve as a reference to evaluate whether the workload architecture, its components, and their configurations effectively meet the specified criteria.
* Outline the **actors and systems that interact with the workload**. This includes identifying key participants such as users, operators, and administrators, as well as external systems like security SIEMs, monitoring platforms, and remote databases. This mapping will provide a clear view of all entities involved and their connections to the workload.
* Define the **deployment options for the workload**, showcasing various configurations in which it can operate. This may include setups such as single-node mode for simplicity or high-availability (HA) mode for enhanced reliability and scalability.

Deployment options may vary, such as single-node or highly available setups, and could include local storage or enhanced integration with remote shared storage. These choices will likely influence how the application components are deployed and run.

This understanding lays a solid foundation for deeper exploration into the workload's internal architecture and dependencies.

By completing this assessment step (a **key deliverable**), we can create a high-level architecture of the workload, illustrating its interactions at a conceptual level with users and other systems — such as storage, monitoring, and external services. We will also highlight internal components, such as specific microservices or logical units, and finally, create a diagram of different deployment options.

The diagram of the high-level workload architecture could resemble this example of the Mirantis Secure Registry (MSR) 4 architecture, providing a clear overview of its components and their interactions.

![High-Level Workload Architecture](/images/graphs-in-your-head-or-how-to-assess-a-k8s-workload/high-level-workload-architecture.png)

## **Infrastructure Assessment**

Now, we're getting closer to the core of our workload, and soon we'll begin utilizing some helpful tools. But before that, it's essential to understand how the workload is built and delivered to the platform. We need to determine which mechanisms are used — whether it's Helm charts, scripts, images, packages, or others.

Next, we'll dive deeper into how the moving parts are placed and organized once the workload is installed. Finally, we'll gain clarity on how the components interact within the system.

Let's proceed with this exploration.

### **Installation method**

First and foremost, for infrastructure assessment, we need to determine how the workload is being installed. This information can typically be found in the documentation or, if available, directly from the application development team.

There are various installation options, but the easiest to track and organize are those that use Helm or a similar package manager. A well-organized installation process will allow us to assess the package configuration and seamlessly move forward with further investigation. For the rest of this blog post, I will assume that the Kubernetes workload is deployed using a Helm chart.

The **key deliverable** for this step will be a workload supply chain diagram. For instance, the diagram below illustrates the MSR 4 supply chain, highlighting that all installed components originate from the Mirantis-controlled, secure repository.

![MSR 4 Supply Chain](/images/graphs-in-your-head-or-how-to-assess-a-k8s-workload/msr-4-supply-chain.png)

### **Resources list**

Finally, we reach the first item on our list, where we begin using tools for assessment. In this step, we need to review the configuration of the chart and track the list of resources.

There are two approaches to this task:

1. If you already have a running cluster, you can skip ahead and start exploring the resources.
2. If you only have an installation guide and need to deploy a workload yourself, you'll need a test environment. Any environment similar to production will suffice. You can use a VM with [k0s](https://k0sproject.io/) or another Kubernetes distribution, [Minikube](https://minikube.sigs.k8s.io/docs/), or — like I do — a [Kind](https://kind.sigs.k8s.io/) cluster on my laptop.

Once the installation is complete, you can examine the Helm chart source, review the configuration file (if available), and observe the resources deployed in your lab environment.

To do this, you can use console commands with kubectl and helm, such as:

```bash
helm list  
helm status $RELEASE_NAME --show-resources
```

Alternatively, you can opt for a Kubernetes IDE like [Lens](https://k8slens.dev/) for a more visual approach.

Personally, I use both methods depending on the situation and how I prefer to view the output. For instance, Lens is particularly convenient for browsing through resources.

![Lens resources list](/images/graphs-in-your-head-or-how-to-assess-a-k8s-workload/lens-resources-list.png)

As a result of this step, we will have a **key deliverable**: a resource list that can be organized into a table.

Once you’ve gathered the list of resources and organized them in a way that makes them easier to work with, you can proceed to the next step: assessing resource integration.

### **Resources interaction**

Now that we have the resource list, we can either assess each resource individually or simplify the process with some additional tools. In my last assessment, I explored options for visualizing resource interactions and decided to use [KubeView](https://github.com/benc-uk/kubeview). It can be installed directly on the same cluster or run in a container on your laptop, accessing the lab cluster via kubeconfig. KubeView provides a visual representation of the resources based on the Helm release in your system.

![KubeView resources interaction](/images/graphs-in-your-head-or-how-to-assess-a-k8s-workload/kubeview-resources-interaction.png)

While it doesn’t automatically arrange the items in an aesthetically pleasing way, you can drag the icons to structure the graph as needed for better clarity and understanding.

![KubeView resources interaction](/images/graphs-in-your-head-or-how-to-assess-a-k8s-workload/kubeview-resources-interaction-2.png)

With such a visualization in front of you, it becomes easier to dive into the configuration of specific items and search for the implementation details of the components.

At this stage, you can start compiling a **key deliverable**: a set of diagrams that illustrate the interactions between the resources of the workload components.

For example, here is the general component interaction schema for MSR 4, illustrating how each component communicates and integrates within the overall system architecture.

![MSR 4 Component Interaction](/images/graphs-in-your-head-or-how-to-assess-a-k8s-workload/msr-4-component-interaction.png)

## **Configuration assessment**

Last but not least, we arrive at the most detailed aspect of the workload assessment. In this phase, our goal is to ensure we fully understand all the ways the workload can be run, how it is configured to operate, how it interacts with remote resources, and how it is made accessible to consumers, such as end users.

### **Components configuration**

In this step, we will follow the diagrams we've outlined for the components and dive deeper into their individual parts, such as PVCs, ConfigMaps, Secrets, and more. As we progress, we'll explore how the components function both independently and in collaboration with other components.

Once again, we can use plain kubectl or take advantage of the interface capabilities of tools like Lens or k9s. The latter, k9s, is particularly convenient for those who prefer a console-based, pseudo-graphic interface with a Vim-like experience, all without the need for a mouse.

![MSR 4 Component Configuration](/images/graphs-in-your-head-or-how-to-assess-a-k8s-workload/msr-4-component-configuration.png)

Most component configuration variables are managed through Helm Charts. You can configure them using the standard **Helm** CLI tool or enhance your experience by installing a **[Helm Dashboard](https://github.com/komodorio/helm-dashboard)** plugin, which provides a more convenient way to assess and manage your charts.

![Helm Dashboard](/images/graphs-in-your-head-or-how-to-assess-a-k8s-workload/helm-dashboard.png)

During this phase, we will enhance our component diagrams by adding more detailed information (**key deliverable**).

By decomposing the interaction schema into individual components and providing a more detailed overview of their architecture and configuration, we can create per-service diagrams. An example of this approach is the following schema for the MSR 4 PostgreSQL HA deployment, which illustrates the specific setup and interactions within that service.

![MSR 4 PostgreSQL HA Deployment](/images/graphs-in-your-head-or-how-to-assess-a-k8s-workload/msr-4-postgresql-ha-deployment.png)

### **Networking, Storage, Requirements**

With all the work completed, we now have a comprehensive set of tables and diagrams that describe our workload. However, a few important parts still need to be addressed, including:

* **Network requirements**: This includes specifying the exact network resources involved in the workload, such as networks, endpoints, ports, and anything else relevant.
* **Storage requirements**: This covers aspects like backend configuration, accessibility, replication, and more.
* **Hardware and software requirements**: Resource limits, CPU, RAM, disk, etc.
* **Security requirements**: Policies, service accounts, and other security considerations.

With all the necessary tools and prerequisites in place, we can finalize the deliverables for this section (**key deliverable**), which include the workload requirements for hardware, software, network, and security. Additionally, we will provide schemas for network and storage organization. Of course, if we plan to conduct further testing, such as smoke tests or load testing, that would be considered a separate process entirely.

For example, here is the simplified network schema for the MSR 4 deployment, illustrating the basic network structure and how the components are connected within the system.

![MSR 4 Network Schema](/images/graphs-in-your-head-or-how-to-assess-a-k8s-workload/msr-4-network-schema.png)

The following example illustrates one of the storage organization options for MSR 4, showcasing how storage components are structured and managed within the system.

![MSR 4 Storage Schema](/images/graphs-in-your-head-or-how-to-assess-a-k8s-workload/msr-4-storage-schema.png)


## **Conclusion**

We've walked through the process of assessing the workload, generating a variety of valuable artifacts along the way. Using tools and lab platforms, we were able to run and evaluate the application. As a result, we've gained insights into the workload, along with a collection of tables, diagrams, and documents that can be leveraged for a range of future tasks, including:

* Workload documentation
* Workload development
* Workload migration
* Kubernetes platform enhancements

And much more.

Let's summarize the steps, tools, and resources we've discussed in the following table.

|           Phase            |            Info Source                |              Deliverable                  |       Tool       |
|----------------------------|---------------------------------------|-------------------------------------------|------------------|
| Business-cases assessment  | Workload owners (product owners)      | Business cases list                       | N/A              |
|----------------------------|---------------------------------------|-------------------------------------------|------------------|
| Use-cases assessment       | - Technical documentation             | Use cases list                            | N/A              |
|                            | - Tech lead                           |                                           |                  |
|                            | - Architect                           |                                           |                  |
|----------------------------|---------------------------------------|-------------------------------------------|------------------|
| Workload concept           | All above                             | High-level architecture schema            | N/A              |
|----------------------------|---------------------------------------|-------------------------------------------|------------------|
| Installation method        | - Technical documentation             | Supply chain schema                       | N/A              |
|                            | - Tech lead                           |                                           |                  |
|                            | - Architect                           |                                           |                  |
|----------------------------|---------------------------------------|-------------------------------------------|------------------|
| Resource list              | - Technical documentation             | - Resources list                          | Lens             |
|                            | - Tech lead                           |                                           |                  |
|                            | - Architect                           |                                           |                  |
|                            | - Workload configuration              |                                           |                  |
|----------------------------|---------------------------------------|-------------------------------------------|------------------|
| Resources interaction      | - Technical documentation             | - Components interaction schema           | KubeView         |
|                            | - Tech lead                           | - Component schemas                       |                  |
|                            | - Architect                           |                                           |                  |
|                            | - Workload configuration              |                                           |                  |
|----------------------------|---------------------------------------|-------------------------------------------|------------------|
| Components configuration   | - Technical documentation             | Enhancing the above components            | - k9s            |
|                            | - Tech lead                           | and their interaction schemas             | - helm-dashboard |
|                            | - Architect                           |                                           |                  |
|                            | - Workload configuration              |                                           |                  |
|----------------------------|---------------------------------------|-------------------------------------------|------------------|
| Workloads requirements     | - Technical documentation             | - Network schema                          | N/A              |
|                            | - Tech lead                           | - Storage schema                          |                  |
|                            | - Architect                           | - HW requirements                         |                  |
|                            | - Workload configuration              | - Software req.                           |                  |
|                            |                                       | - Network req.                            |                  |
|                            |                                       | - Storage req.                            |                  |
|----------------------------|---------------------------------------|-------------------------------------------|------------------|

Please note that the tools mentioned throughout this article are designed to be run remotely, without the need to install them directly onto the cluster whenever possible. This means you can run them from your local machine and connect to the remote lab cluster with the workload. However, the list of tools can be extended to include those that require installation, such as ArgoCD with its inbound dashboard or Istio Dashboard (e.g., Kiali). These, however, are not the primary focus of this blog post.

This is certainly not a rigid framework, and anyone is free to create their own assessment plan and toolchain. However, by following the one outlined here, you can leverage this knowledge to guide and enhance your own journey.

This article provides a high-level overview of each work item, keeping descriptions intentionally brief. I plan to dive deeper into specific topics in future articles, covering their nuances in greater detail.
