---
# Post title - will be auto-generated from filename if not changed
title: "Kubernetes Control Plane Load Balancing(CPLB) Explained"

slug: "kubernetes-cplb-explained"

# Publication date - automatically set to current date/time
date: 2025-02-20T00:00:00Z

# Author name - replace with your name
author: "Juan Luis de Sousa-Valadas"

# Tags for categorizing content (e.g., automation, mlops, devops, aiops)
tags: ["kubernetes", "load balancing", "control plane", "high availability", "k0s", "cplb"]

# Categories for broader grouping (e.g., engineering, operations, tutorials)
categories: ["engineering", "operations", "tutorials"]

# Set to false when ready to publish
draft: false

# Brief description/summary of the post (recommended for SEO and post listings)
description: "Learn how k0s implements Control Plane Load Balancing (CPLB) for highly available Kubernetes clusters"

image: "images/control-plane-load-balancing-explained/feature-image.png"
---

A highly available Kubernetes cluster requires, among other things, a highly available control plane. In order to achieve this we need multiple apiserver replicas with a highly available load balancer. You can read more about [high availability in k0s documentation](https://docs.k0sproject.io/stable/high-availability/).

A typical load balancer listens on the API address and forwards the traffic to all control plane nodes:

![Traditional load balancer](/images/control-plane-load-balancing-explained/traditional-load-balancer.png)

Although most load balancing as a service solution hide this complexity, the load balancer itself has to be highly available, meaning it must have an IP address that is shared between two or more load balancers in order to avoid having a SPOF (single point of failure):

![High availability load balancer](/images/control-plane-load-balancing-explained/high-availability-load-balancer.png)

Most environments provide load balancing solutions out of the box and, if available, k0s recommends using them over [CPLB](https://docs.k0sproject.io/stable/cplb/) (control plane load balancing) and [NLLB](https://docs.k0sproject.io/stable/nllb/)(node-local load balancing). Usually services such as AWS ELB hide these details from the end user and simply provide an IP address or hostname.

However, if you are in an environment which doesn't provide an externally managed highly available load balancer, such as vSphere, k0s can set up and manage a loadbalancer.

## CPLB architecture compared to a traditional load balancer

In CPLB there is [VIP (Virtual IP)](https://en.wikipedia.org/wiki/Virtual_IP_address) shared by the highly available load balancers floating between all control plane nodes and a load balancer which redirects the traffic to all kube-apiserver instances:

![CPLB architecture](/images/control-plane-load-balancing-explained/cplb-architecture.png)

CPLB deploys a [Keepalived](https://www.keepalived.org/) instance which is responsible for having a VIP floating between control plane nodes using [VRRP](https://en.wikipedia.org/wiki/Virtual_Router_Redundancy_Protocol). K0s configures Keepalived so that all control plane nodes are equal and a VIP only moves to another node if there is a problem with the current leader. Once the traffic reaches the control plane node on the VIP, the traffic gets forwarded to one of the control plane nodes.

## The new userspace reverse proxy load balancer

Up to 1.32 k0s, CPLB relied on [Keepalived](https://www.keepalived.org/) for both virtual IP addresses and load balancing (which uses IPVS). Unfortunately this was fairly complex and couldn't work in some environments.

In 1.32 k0s introduces a new load balancer for CPLB which works in userspace as part of the k0s controller process instead of relying on keepalived's IPVS load balancer. However, users can still opt-in for the IPVS load balancer.

The new k0s [userspace reverse proxy load balancer](https://docs.k0sproject.io/v1.32.1+k0s.0/cplb/#load-balancing-userspace-reverse-proxy) has significant advantages, for instance it's compatible with controller+worker set ups, it's much easier to debug and has a simpler network flow.

K0s listens on a new socket which is a load balancer listening on a different port. The traffic sent to the VIP on the apiserver port is redirected to the new port  and an iptables rule that forwards all the traffic destined for the virtual IP address on the apiserver port to the load balancer. Then the load balancer establishes a new connection against one apiserver chosen with round robin and simply acts as a TCP proxy:

![Userspace reverse proxy load balancer](/images/control-plane-load-balancing-explained/userspace-reverse-proxy-load-balancer.png)

## Understanding CPLB and NLLB together

NLLB is a node-local load balancer. This means the load balancing happens on each worker node individually and is only intended as a load balancer between workers and control plane.

CPLB is a load balancer for the control plane which was intended originally for external users to access the control plane from outside the cluster. Depending on the configuration, it may also be used by the worker nodes.

CPLB and NLLB are fully compatible with each other and are actively tested together. Most users will be able to rely only on CPLB, however some users may prefer to use NLLB to reduce the load in the control plane nodes since NLLB does the load balancing in each worker worker node or to have better network segmentation.

## Real life example with k0sctl

A minimal example without NLLB looks like:

```yaml
apiVersion: k0sctl.k0sproject.io/v1beta1
kind: Cluster
metadata:
  name: k0s-cluster
spec:
  hosts:
  - role: controller
    ssh:
      address: controller-0.k0s.lab
      # CPLB requires this if spec.api.externalAddress is defined
      installFlags:
      - --disable-components=endpoint-reconciler
      user: root
      keyPath: ~/.ssh/k0s_lab_id_rsa
  - role: controller
    ssh:
      address: controller-1.k0s.lab
      # CPLB requires this if spec.api.externalAddress is defined
      installFlags:
      - --disable-components=endpoint-reconciler
      user: root
      keyPath: ~/.ssh/k0s_lab_id_rsa
  - role: controller
    ssh:
      address: controller-2.k0s.lab
      # CPLB requires this if spec.api.externalAddress is defined
      installFlags:
      - --disable-components=endpoint-reconciler
      user: root
      keyPath: ~/.ssh/k0s_lab_id_rsa
  - role: worker
    ssh:
      address: worker-0.k0s.lab
      user: root
      keyPath: ~/.ssh/k0s_lab_id_rsa
  - role: worker
    ssh:
      address: worker-1.k0s.lab
      user: root
      keyPath: ~/.ssh/k0s_lab_id_rsa
  k0s:
    version: v1.32.1+k0s.0
    config:
      spec:
        api:
          externalAddress: 10.0.0.100
        network:
          controlPlaneLoadBalancing:
            enabled: true
            type: Keepalived
            keepalived:
              vrrpInstances:
              - virtualIPs: ["10.0.0.100/24"]
                authPass: BuyK0s
```

A minimal example with NLLB looks like:

```yaml
apiVersion: k0sctl.k0sproject.io/v1beta1
kind: Cluster
metadata:
  name: k0s-cluster
spec:
  hosts:
  - role: controller
    ssh:
      address: controller-0.k0s.lab
      user: root
      keyPath: ~/.ssh/k0s_lab_id_rsa
  # <snip>
  - role: worker
    ssh:
      address: worker-0.k0s.lab
      user: root
      keyPath: ~/.ssh/k0s_lab_id_rsa
  # <snip>
  k0s:
    version: v1.32.1+k0s.0
    config:
        network:
          controlPlaneLoadBalancing:
            enabled: true
            type: Keepalived
            keepalived:
              vrrpInstances:
              - virtualIPs: ["10.0.0.100/24"]
                authPass: BuyK0s

          nodeLocalLoadBalancing: # optional, but CPLB will often be used with NLLB.
            enabled: true
            type: EnvoyProxy
```

## Migrating from IPVS load balancer to userspace load balancer

Simply remove the virtualServers section from the k0s configuration file and restart each control plane node one by one. CPLB configuration is always managed in the configuration file, even if you use dynamic configuration. In a minimal example it would look like this:

```yaml
spec:
  network:
    controlPlaneLoadBalancing:
      enabled: true
      type: Keepalived
      keepalived:
        vrrpInstances:
        - virtualIPs: ["10.0.0.100/24"]
          authPass: BuyK0s
        virtualServers:
        - ipAddress: "10.0.0.100"
```

And after removing it, it would look like this:

```yaml
spec:
  network:
    controlPlaneLoadBalancing:
      enabled: true
      type: Keepalived
      keepalived:
        vrrpInstances:
        - virtualIPs: ["10.0.0.100/24"]
          authPass: BuyK0s
```

Restart the control plane nodes one by one:

```bash
systemctl restart k0scontroller
```

Once the k0scontroller is restarted, actually verify that the load balancer is working by connecting to the userspace proxy port:

```bash
openssl s_client -connect 127.0.0.1:6444 </dev/null 2>/dev/null | openssl x509 -text
```

Run this a few times and you should get all kube-apiservers certificates, once this is verified move to the next one.

## Final thoughts

In summary, ensuring a highly available Kubernetes control plane is critical, and load balancing plays a key role. If externally managed load balancers aren’t an option, k0s provides CPLB for environments lacking them.

CPLB, with its evolution to a userspace reverse proxy load balancer, offers a simplified and more compatible approach compared to the previous IPVS-based system. When combined with k0s it is possible to build lightweight, but highly available Kubernetes clusters.
