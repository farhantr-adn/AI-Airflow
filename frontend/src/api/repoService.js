/** Repository service. */
import client from "./client";

export const repoService = {
  list: () => client.get("/repos").then((r) => r.data),
  get: (id) => client.get(`/repos/${id}`).then((r) => r.data),
  connect: (provider, url) => client.post("/repos/connect", { provider, url }).then((r) => r.data),
  oauthMock: (provider) => client.post(`/repos/oauth-mock/${provider}`).then((r) => r.data),
  remove: (id) => client.delete(`/repos/${id}`).then((r) => r.data),
};
