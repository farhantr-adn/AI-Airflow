/** CI/CD constants reused across pipeline pages. */
export const CLOUD_TARGETS = ["aws", "gcp", "azure", "oracle", "cloudflare", "on-prem"];

export const CI_PLATFORMS = [
  { id: "github-actions", label: "GitHub Actions", file: ".github/workflows/ci.yml" },
  { id: "gitlab-ci", label: "GitLab CI", file: ".gitlab-ci.yml" },
  { id: "jenkins", label: "Jenkins", file: "Jenkinsfile" },
  { id: "bitbucket", label: "Bitbucket Pipelines", file: "bitbucket-pipelines.yml" },
];

export const DEPLOY_STRATEGIES = ["rolling", "blue-green", "canary", "recreate"];

export const DEFAULT_STAGES = [
  "checkout", "install", "lint", "test", "security_scan", "build", "deploy", "rollback",
];
