/** Catalog service - deployment strategies, cloud services, AI providers. */
import client from "./client";

export const catalogService = {
  strategies: () => client.get("/catalog/strategies").then((r) => r.data.strategies),
  cloudServices: () => client.get("/catalog/cloud-services").then((r) => r.data.cloud_services),
  aiProviders: () => client.get("/catalog/ai-providers").then((r) => r.data.providers),
};
