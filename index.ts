
import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";

// ─────────────────────────────────────────
// NAMESPACE: monitoring
// ─────────────────────────────────────────
const monitoringNs = new k8s.core.v1.Namespace("monitoring", {
  metadata: { name: "monitoring" },
});

// ─────────────────────────────────────────
// GUESTBOOK: Redis Leader
// ─────────────────────────────────────────
const redisLeaderLabels = { app: "redis", role: "leader" };

const redisLeaderDeployment = new k8s.apps.v1.Deployment("redis-leader", {
  metadata: { name: "redis-leader" },
  spec: {
    replicas: 1,
    selector: { matchLabels: redisLeaderLabels },
    template: {
      metadata: {
        labels: redisLeaderLabels,
        annotations: {
          "prometheus.io/scrape": "true",
          "prometheus.io/port": "9121",
          "prometheus.io/path": "/metrics",
        },
      },
      spec: {
        containers: [
          {
            name: "redis-leader",
            image: "redis:6.0.5",
            ports: [{ containerPort: 6379, name: "redis" }],
          },
          {
            name: "redis-exporter",
            image: "oliver006/redis_exporter:v1.55.0",
            ports: [{ containerPort: 9121, name: "metrics" }],
            env: [{
              name: "REDIS_ADDR",
              value: "redis://localhost:6379",
            }],
            resources: {
              requests: {
                cpu: "10m",
                memory: "20Mi",
              },
            },
          },
        ],
      },
    },
  },
});

const redisLeaderService = new k8s.core.v1.Service("redis-leader-svc", {
  metadata: {
    name: "redis-leader",
    annotations: {
      "prometheus.io/scrape": "true",
      "prometheus.io/port": "9121",
    },
  },
  spec: {
    selector: redisLeaderLabels,
    ports: [
      { port: 6379, targetPort: 6379, name: "redis" },
      { port: 9121, targetPort: 9121, name: "metrics" },
    ],
  },
});

// ─────────────────────────────────────────
// GUESTBOOK: Redis Follower
// ─────────────────────────────────────────
const redisFollowerLabels = { app: "redis", role: "follower" };

const redisFollowerDeployment = new k8s.apps.v1.Deployment("redis-follower", {
  metadata: { name: "redis-follower" },
  spec: {
    replicas: 2,
    selector: { matchLabels: redisFollowerLabels },
    template: {
      metadata: {
        labels: redisFollowerLabels,
        annotations: {
          "prometheus.io/scrape": "true",
          "prometheus.io/port": "9121",
          "prometheus.io/path": "/metrics",
        },
      },
      spec: {
        containers: [
          {
            name: "redis-follower",
            image: "gcr.io/google_samples/gb-redis-follower:v2",
            ports: [{ containerPort: 6379, name: "redis" }],
            env: [{ name: "GET_HOSTS_FROM", value: "dns" }],
          },
          {
            name: "redis-exporter",
            image: "oliver006/redis_exporter:v1.55.0",
            ports: [{ containerPort: 9121, name: "metrics" }],
            env: [{
              name: "REDIS_ADDR",
              value: "redis://localhost:6379",
            }],
            resources: {
              requests: {
                cpu: "10m",
                memory: "20Mi",
              },
            },
          },
        ],
      },
    },
  },
});

const redisFollowerService = new k8s.core.v1.Service("redis-follower-svc", {
  metadata: {
    name: "redis-follower",
    annotations: {
      "prometheus.io/scrape": "true",
      "prometheus.io/port": "9121",
    },
  },
  spec: {
    selector: redisFollowerLabels,
    ports: [
      { port: 6379, targetPort: 6379, name: "redis" },
      { port: 9121, targetPort: 9121, name: "metrics" },
    ],
  },
});

// ─────────────────────────────────────────
// GUESTBOOK: Frontend + Redis Exporter Sidecar
// ─────────────────────────────────────────
const frontendLabels = { app: "guestbook", tier: "frontend" };

const frontendDeployment = new k8s.apps.v1.Deployment("frontend", {
  metadata: { name: "frontend" },
  spec: {
    replicas: 3,
    selector: { matchLabels: frontendLabels },
    template: {
      metadata: {
        labels: frontendLabels,
        annotations: {
          "prometheus.io/scrape": "true",
          "prometheus.io/port": "9121",
          "prometheus.io/path": "/metrics",
        },
      },
      spec: {
        containers: [
          {
            name: "php-redis",
            image: "gcr.io/google_samples/gb-frontend:v5",
            ports: [{ containerPort: 80, name: "http" }],
            env: [{ name: "GET_HOSTS_FROM", value: "dns" }],
            resources: {
              requests: {
                cpu: "100m",
                memory: "100Mi",
              },
            },
          },
          {
            name: "redis-exporter",
            image: "oliver006/redis_exporter:v1.55.0",
            ports: [{ containerPort: 9121, name: "metrics" }],
            env: [{
              name: "REDIS_ADDR",
              value: "redis://redis-leader:6379",
            }],
            resources: {
              requests: {
                cpu: "10m",
                memory: "20Mi",
              },
            },
          },
        ],
      },
    },
  },
});

const frontendService = new k8s.core.v1.Service("frontend-svc", {
  metadata: {
    name: "frontend",
    labels: frontendLabels,
    annotations: {
      "prometheus.io/scrape": "true",
      "prometheus.io/port": "9121",
      "prometheus.io/path": "/metrics",
    },
  },
  spec: {
    type: "NodePort",
    selector: frontendLabels,
    ports: [
      { port: 80, targetPort: 80, name: "http" },
      { port: 9121, targetPort: 9121, name: "metrics" },
    ],
  },
});

// ─────────────────────────────────────────
// MONITORING: Prometheus + Grafana via Helm
// ─────────────────────────────────────────
const grafanaPassword = "Admin@1234";

const prometheusStack = new k8s.helm.v3.Release("kube-prometheus-stack", {
  name: "kube-prometheus-stack",
  chart: "kube-prometheus-stack",
  namespace: monitoringNs.metadata.name,
  repositoryOpts: {
    repo: "https://prometheus-community.github.io/helm-charts",
  },
  values: {
    grafana: {
      adminPassword: grafanaPassword,
      service: {
        type: "NodePort",
        nodePort: 32000,
      },
      sidecar: {
        dashboards: {
          enabled: true,
          label: "grafana_dashboard",
        },
      },
    },
    prometheus: {
      prometheusSpec: {
        additionalScrapeConfigs: [
          {
            job_name: "guestbook-services",
            kubernetes_sd_configs: [{ role: "pod" }],
            relabel_configs: [
              {
                source_labels: [
                  "__meta_kubernetes_pod_annotation_prometheus_io_scrape",
                ],
                action: "keep",
                regex: "true",
              },
              {
                source_labels: [
                  "__meta_kubernetes_pod_annotation_prometheus_io_path",
                ],
                action: "replace",
                target_label: "__metrics_path__",
                regex: "(.+)",
              },
              {
                source_labels: [
                  "__address__",
                  "__meta_kubernetes_pod_annotation_prometheus_io_port",
                ],
                action: "replace",
                regex: "([^:]+)(?::\\d+)?;(\\d+)",
                replacement: "$1:$2",
                target_label: "__address__",
              },
            ],
          },
        ],
      },
    },
    alertmanager: { enabled: false },
    "prometheus-node-exporter": { enabled: true },
    "kube-state-metrics": { enabled: true },
  },
}, { dependsOn: [monitoringNs] });

// ─────────────────────────────────────────
// OUTPUTS
// ─────────────────────────────────────────
export const guestbookAccess =
  "Run: minikube service frontend --url";

export const grafanaAccess =
  "Run: minikube service kube-prometheus-stack-grafana -n monitoring --url";

export const grafanaCredentials = {
  username: "admin",
  password: grafanaPassword,
};

export const prometheusAccess =
  "Run: minikube service kube-prometheus-stack-prometheus -n monitoring --url";
