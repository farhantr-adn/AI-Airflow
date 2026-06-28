/** Centralized application routes. */
export const ROUTES = {
  // Public
  landing: "/",
  login: "/login",
  signup: "/signup",
  // App (protected)
  app: "/app",
  dashboard: "/app",
  repos: "/app/repos",
  reposConnect: "/app/repos/connect",
  pipelines: "/app/pipelines",
  pipelinesNew: "/app/pipelines/new",
  pipelineDetail: (id) => `/app/pipelines/${id}`,
  runDetail: (id) => `/app/runs/${id}`,
  deployments: "/app/deployments",
  security: "/app/security",
  strategies: "/app/strategies",
  settings: "/app/settings",
};
