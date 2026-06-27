/** Deployments service. */
import client from "./client";

export const deploymentService = {
  list: () => client.get("/deployments").then((r) => r.data),
  rollback: (id) => client.post(`/deployments/${id}/rollback`).then((r) => r.data),
};
