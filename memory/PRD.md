# Forge — AI-Powered SaaS CI/CD Platform — PRD

## Original Problem Statement
AI-Powered SaaS CI/CD Platform. Architecture: React frontend, FastAPI backend, MongoDB. Core features: repo integration (OAuth/SSH to GitHub/GitLab/Bitbucket), AI engine that reads repo structure + tech stack and auto-generates CI/CD pipelines (build/test/deploy/rollback) using best practices for GitHub Actions, GitLab CI, Jenkins, Bitbucket Pipelines. Multi-cloud deployment (AWS/GCP/Azure/Oracle/Cloudflare/on-prem). Security integration (Snyk, Trivy). Monitoring/Logging (Prometheus, Grafana, ELK). Auto-fix on pipeline errors. Rollback. AI use cases: pipeline auto-generation, code-quality insights, security enhancements, optimization. Industry best practices: 12-factor, immutable infra, zero-trust, automated test+rollback, continuous monitoring.

## User Choices
- **MVP scope**: full end-to-end with real AI + UI; external integrations (GitHub OAuth, Snyk, cloud deploys) mocked with clear UI placeholders.
- **AI models**: Claude Sonnet 4.5 default + GPT-5.2 + Gemini 3 Flash (user-selectable), powered by Emergent Universal LLM Key.
- **Repo integration**: real public-repo fetching via GitHub API; OAuth flow mocked for GitLab/Bitbucket; paste-URL primary entry.
- **Stack**: Python FastAPI + React + MongoDB.
- **Auth**: BOTH Emergent Google login AND JWT email/password on same login page.
- **CI platforms**: All 4 (GitHub Actions, GitLab CI, Jenkins, Bitbucket Pipelines).

## User Personas
- **Solo developer** ("Hacker") — wants to skip writing CI YAML on side projects.
- **Senior engineer at a startup** ("Team") — needs consistent, secure pipelines across many repos, auto-rollback when a deploy breaks.
- **Platform engineer at enterprise** ("Enterprise") — multi-cloud, multi-tenant, SSO/RBAC, on-prem deploys.

## Architecture
- **Frontend**: React 19 SPA, React Router, Tailwind. Distinctive dark-mode "Swiss / engineering schematic" aesthetic (tomato red `#E54D2E` accent, Chivo + IBM Plex Sans + JetBrains Mono). Cmd+K command palette, pipeline DAG visualizer (custom), terminal-style log viewer with SSE streaming.
- **Backend**: FastAPI + Motor (async MongoDB). REST under `/api/*`. SSE for AI streaming. Background tasks for pipeline run simulation.
- **AI**: `emergentintegrations.llm.chat.LlmChat` with streaming. Provider-switchable. System prompts engineered for each CI platform.
- **DB collections**: users, user_sessions, repos, pipelines, pipeline_runs, deployments, security_scans, audit_logs.

## Implemented in v1 (2026-01)
- ✅ **Auth**: JWT email/password (register + login). Emergent Google OAuth (full callback flow with cookies). Unified `/api/auth/me` accepts both cookie + Bearer.
- ✅ **Landing page**: hero with live-simulation terminal, features grid, pipeline workflow, multi-cloud grid, 3-tier pricing.
- ✅ **Dashboard**: KPI stats (repos, pipelines, success rate, live deploys) + recent runs table + quick-start actions.
- ✅ **Repository integration**: real GitHub public-repo fetch (metadata + languages + root tree → tech stack detection); mocked OAuth for GitLab/Bitbucket; mocked "Use OAuth" import for sample repos.
- ✅ **AI Pipeline Generator**: real SSE-streamed YAML generation. Configurable: CI platform (4 options), cloud (6), deploy strategy (4), coverage gate, security toggle, monitoring toggle, model selector (6 LLMs), extra requirements. Live streaming display. Copy + save.
- ✅ **Pipeline detail**: tabs (Overview with DAG, YAML, Runs). Manual trigger. Delete.
- ✅ **Pipeline DAG visualizer**: stage rectangles with status colors + connecting lines + rollback branch.
- ✅ **Pipeline run engine** (mocked): background task streams logs through 7 stages (checkout, install, lint, test, security_scan, build, deploy). Random ~15% chance of fail on test/build/security stages. Creates Deployment on success.
- ✅ **Run detail page**: live-polling logs with stage coloring + DAG with live status + AI AutoFix sidebar.
- ✅ **AI AutoFix**: streams Claude's RCA + fix steps + pipeline patch when a run fails.
- ✅ **Deployments**: list with rollback button (rollback flips status, optionally restores prior version's "live" status).
- ✅ **Security scans**: mocked Snyk+Trivy with CVE samples, severity grouping.
- ✅ **Settings**: account info, AI model list with default highlighted, integration status (mocked badges), audit log.
- ✅ **Command palette** (Cmd+K) with navigation + actions.
- ✅ **Audit log** for repo connect, pipeline save, pipeline run, deployment rollback.

## Backlog (Future / P1)
- **P1**: Real GitHub OAuth (needs client ID/secret). Real GitLab/Bitbucket connect.
- **P1**: Real Snyk integration (needs token).
- **P1**: Real cloud deploys (AWS ECR/ECS, GCP Cloud Run, Azure Container Apps, k8s).
- **P2**: Custom AI models trained on pipeline success/failure data.
- **P2**: Pipeline template marketplace.
- **P2**: Vault / AWS Secrets Manager.
- **P2**: Multi-tenant SaaS scaling (Kubernetes namespaces).
- **P2**: Real Prometheus/Grafana/ELK hooks (currently injected into YAML but not connected).
- **P2**: Webhook receivers for real pipeline executions outside Forge.
- **P2**: Team / org workspaces, RBAC, SSO.

## Next Tasks
- Run testing subagent (backend + frontend end-to-end).
- Address any blockers found.
