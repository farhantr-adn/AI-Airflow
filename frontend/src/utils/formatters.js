/** Misc formatters. */
import { formatDistanceToNow as fdtn } from "date-fns";

export const fromNow = (date) => {
  if (!date) return "—";
  try { return fdtn(new Date(date), { addSuffix: true }); }
  catch { return "—"; }
};

export const pipelineFileFor = (platform) => ({
  "github-actions": ".github/workflows/ci.yml",
  "gitlab-ci": ".gitlab-ci.yml",
  "jenkins": "Jenkinsfile",
  "bitbucket": "bitbucket-pipelines.yml",
}[platform] || "pipeline.yml");

export const platformLabel = (platform) => ({
  "github-actions": "GitHub Actions",
  "gitlab-ci": "GitLab CI",
  "jenkins": "Jenkins",
  "bitbucket": "Bitbucket",
}[platform] || platform);
