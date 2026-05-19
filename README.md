# Guestbook Monitoring — 4IR Solutions Coding Exercise

## Overview

This project extends the Pulumi Kubernetes Guestbook example by integrating:

- Prometheus monitoring
- Grafana dashboards
- Redis exporter metrics
- Kubernetes cluster monitoring

The entire stack is deployed using Pulumi with TypeScript on Kubernetes.

Frontend and backend services expose Prometheus metrics through `redis-exporter` sidecar containers running on port `9121`.

Prometheus automatically discovers and scrapes metrics using Kubernetes pod annotations.



# Prerequisites

Install the following tools before deployment:

| Tool | Version |
|---|---|
| Node.js | v18+ |
| Pulumi CLI | v3+ |
| kubectl | latest |
| Minikube | latest |
| Helm | v3+ |
| Docker Desktop | latest |

---

# Deployment Instructions

## Step 1 — Start Docker Desktop

Open Docker Desktop and wait until the engine is running.

Verify:

```bash
docker ps
Step 2 — Start Minikube
minikube start --driver=docker --memory=4096 --cpus=2

Verify:

kubectl get nodes

Expected:

STATUS = Ready
Step 3 — Clone Repository
git clone https://github.com/vbharath13/guestbook-monitoring.git
cd guestbook-monitoring
Step 4 — Install Dependencies
npm install
Step 5 — Login to Pulumi
pulumi login --local

Initialize stack:

pulumi stack init dev
Step 6 — Deploy Infrastructure
pulumi up

Type:

yes

Deployment takes approximately 5–10 minutes.

Accessing Services
Guestbook Application
minikube service frontend --url
Grafana
minikube service kube-prometheus-stack-grafana -n monitoring --url

Credentials:

Field	Value
Username	admin
Password	Admin@1234
Prometheus
minikube service kube-prometheus-stack-prometheus -n monitoring --url
Grafana Dashboard

A Kubernetes monitoring dashboard was imported into Grafana using dashboard ID:

6417

Import steps:

Open Grafana
Dashboards → New → Import
Enter dashboard ID 6417
Select Prometheus datasource
Click Import

This dashboard visualizes:

Kubernetes pod metrics
Node metrics
Cluster resource usage
Guestbook infrastructure metrics
Verify Metrics Scraping
Method 1 — Prometheus Targets
Open Prometheus
Navigate to:
Status → Targets
Verify job:
guestbook-services

shows:

6/6 UP

This confirms:

frontend metrics scraping
Redis leader metrics scraping
Redis follower metrics scraping
Method 2 — Run PromQL Queries

Run:

redis_connected_clients

Additional queries:

redis_memory_used_bytes
redis_uptime_in_seconds
Method 3 — Verify in Grafana Explore
Open Grafana
Click Explore
Select Prometheus datasource
Run:
redis_connected_clients

You should see live metric values.

Kubernetes Resources Deployed

The stack deploys:

Guestbook frontend deployment
Redis leader deployment
Redis follower deployment
Redis exporter sidecars
Prometheus stack
Grafana
kube-state-metrics
node-exporter
Notes
Some default kube-prometheus-stack control plane targets may appear DOWN in Minikube environments due to local Kubernetes networking limitations.
Guestbook monitoring targets under guestbook-services should remain UP and actively scraped by Prometheus.
Metrics are exposed through Redis exporter sidecars on port 9121.
Cleanup

Destroy resources:

pulumi destroy

Stop Minikube:

minikube stop