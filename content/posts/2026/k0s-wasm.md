---
# Post title - will be auto-generated from filename if not changed
title: "Running WebAssembly Workloads on k0s: A Complete Guide"

# Publication date - automatically set to current date/time
date: 2026-01-28T18:58:00Z

# Author name - replace with your name
author: "Prashant Ramhit"

# slug:
slug: "k0s-wasm"

# SEO and Social Media
keywords: 
  - kubernetes
  - k0s
  - WASM
  - Wasmtime

tags:
  - kubernetes
  - k0s
  - WASM
  - Wasmtime
  - Platform
  

categories:
  - engineering
  - tutorials
  - platform

# Set to false when ready to publish
draft: false

description: "Learn how to run WASM applications on kubernetes with k0s"

# Series information
series: ["Kubernetes, k0s, WASM"]
series_weight: 1

# Related content suggestions
related: true

# Schema.org metadata for rich snippets
schema:
  type: "TechArticle"
  audience: "Developers, DevOps Engineers, Platform Engineers"
  proficiencyLevel: "Intermediate to Advanced"

image: "images/2026/k0s-wasm/header.png"
---

## Introduction

WebAssembly (Wasm) provides a lightweight execution model with fast startup times, small binaries, and strong isolation. As Wasm adoption grows, it is increasingly used for workloads that prioritize portability, performance, and security across heterogeneous environments.

These characteristics make it a practical alternative to containers for certain Kubernetes use cases.

In this post, we configure WebAssembly support on k0s using the runwasi project and deploy workloads with both Wasmtime and WasmEdge.

The focus is on a working, repeatable setup that can be used in development and production environments.

## Why WebAssembly on Kubernetes

Running WebAssembly workloads on Kubernetes offers several practical benefits:

- Fast startup: Modules start in milliseconds rather than seconds
- Small images: Wasm artifacts are typically much smaller than container images
- Process isolation: Sandboxing is enforced by the runtime
- Portability: The same binary runs across architectures

These properties are especially useful for edge deployments, short-lived jobs, and multi-tenant environments.

## Prerequisites

You will need:

- A running k0s cluster
- kubectl configured for cluster access

Installation instructions are available in the official documentation: https://docs.k0sproject.io/stable/install/

### Step 1: Install Build Dependencies

The runwasi shims are built in Rust, so a Rust toolchain is required.

```
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env

rustc --version
cargo --version
```

On Ubuntu:

```
apt install rustup
```

### Step 2: Build and Install runwasi

The runwasi project provides containerd shims that connect Kubernetes to WebAssembly runtimes.

In this setup, we use:

- Wasmtime for general-purpose execution
- WasmEdge for edge-oriented workloads

Both runtimes support WASI and integrate cleanly with containerd.

```
cd /tmp
git clone https://github.com/containerd/runwasi.git
cd runwasi

./scripts/setup-linux.sh

make build-wasmtime
make build-wasmedge

sudo make install-wasmtime
sudo make install-wasmedge

ls -la /usr/local/bin/containerd-shim-*
```

These shims translate container lifecycle operations into runtime-specific WebAssembly calls.

### Step 3: Configure k0s for WebAssembly

k0s uses containerd and supports drop-in configuration files.

Create a runtime configuration file:

```
tee /etc/k0s/containerd.d/runwasi.toml > /dev/null <<'EOF'
[plugins."io.containerd.grpc.v1.cri".containerd.runtimes.wasmtime]
  runtime_type = "io.containerd.wasmtime.v1"

[plugins."io.containerd.grpc.v1.cri".containerd.runtimes.wasmedge]
  runtime_type = "io.containerd.wasmedge.v1"
EOF
```

This registers both runtimes with containerd.

Restart k0s:

```
systemctl restart k0scontroller
```

Verify:

```
systemctl status k0scontroller
```

### Step 4: Create RuntimeClasses

RuntimeClass allows Kubernetes to select different runtimes per workload.

Create entries for both runtimes:

```
kubectl apply -f - <<EOF
apiVersion: node.k8s.io/v1
kind: RuntimeClass
metadata:
  name: wasmtime
handler: wasmtime
EOF

kubectl apply -f - <<EOF
apiVersion: node.k8s.io/v1
kind: RuntimeClass
metadata:
  name: wasmedge
handler: wasmedge
EOF
```

Verify:
```
kubectl get runtimeclass
```

Expected output:
```
NAME        HANDLER
wasmtime    wasmtime
wasmedge    wasmedge
```

### Step 5: Deploy WebAssembly Workloads

We can now deploy example workloads using the official runwasi demo image.

### Wasmtime

```
kubectl apply -f - <<EOF
apiVersion: v1
kind: Pod
metadata:
  name: wasm-wasmtime
spec:
  runtimeClassName: wasmtime
  restartPolicy: Never
  containers:
  - name: wasm-demo
    image: ghcr.io/containerd/runwasi/wasi-demo-app:latest
    command: ["/wasi-demo-app.wasm", "echo", "Hello from Wasmtime!"]
EOF
```

### WasmEdge

```
kubectl apply -f - <<EOF
apiVersion: v1
kind: Pod
metadata:
  name: wasm-wasmedge
spec:
  runtimeClassName: wasmedge
  restartPolicy: Never
  containers:
  - name: wasm-demo
    image: ghcr.io/containerd/runwasi/wasi-demo-app:latest
    command: ["/wasi-demo-app.wasm", "echo", "Hello from WasmEdge!"]
EOF
```

The key difference from standard pods is the **runtimeClassName** field.

Check the logs:

```
kubectl logs wasm-wasmtime
kubectl logs wasm-wasmedge
```

You should see the expected output.

### Troubleshooting

### RuntimeClass Not Found

```
kubectl get runtimeclass
```

### Unknown Runtime

Verify shim installation and configuration:

```
ls -la /usr/local/bin/containerd-shim-*
cat /etc/k0s/containerd.d/runwasi.toml
```

### Startup Issues

Check controller logs:

```
sudo journalctl -u k0scontroller -n 50
```

## Use Cases

WebAssembly on k0s is well suited for:

- Far Edge and remote deployments
- Serverless-style workloads
- Multi-tenant platforms
- Resource-sensitive microservices
- Secure plugin execution
- Airgapped infrastructure

These scenarios benefit most from fast startup and low memory overhead.

## Limitations

Current constraints include:

- Restricted system access through WASI
- Smaller ecosystem compared to containers
- Best language support in Rust, C/C++, and Go
- Tooling still evolving

These should be evaluated before migrating production workloads.

## Conclusion

Running WebAssembly workloads on k0s combines Kubernetes orchestration with lightweight execution.

With a small amount of configuration, multiple runtimes can coexist alongside traditional containers. This makes it possible to introduce Wasm incrementally without restructuring existing deployments.

The combination is particularly useful for edge and constrained environments, where startup latency and memory usage matter.

As the ecosystem matures, WebAssembly is likely to become a standard option for specific classes of Kubernetes workloads rather than a replacement for containers.

## Resources

- k0s Documentation - https://docs.k0sproject.io/
- runwasi - https://github.com/containerd/runwasi
- WebAssembly - https://webassembly.org/
- WASI - https://wasi.dev/
- Wasmtime - https://wasmtime.dev/
- WasmEdge - https://wasmedge.org/
