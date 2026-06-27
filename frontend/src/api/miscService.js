/** Misc: dashboard metrics, audit log, available AI models. */
import client from "./client";

export const metricsService = {
  dashboard: () => client.get("/metrics/dashboard").then((r) => r.data),
};

export const settingsService = {
  models: () => client.get("/models").then((r) => r.data),
  auditLog: () => client.get("/audit-logs").then((r) => r.data),
};
