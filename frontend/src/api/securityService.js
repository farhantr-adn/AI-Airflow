/** Security scan service. */
import client from "./client";

export const securityService = {
  scan: (repoId) => client.post(`/security/scan/${repoId}`).then((r) => r.data),
  list: (repoId) => client.get("/security/scans", { params: repoId ? { repo_id: repoId } : {} }).then((r) => r.data),
};
