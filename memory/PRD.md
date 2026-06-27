# Forge — AI-Powered SaaS CI/CD Platform — PRD

## Original Problem Statement
AI-Powered SaaS CI/CD Platform. React + FastAPI + MongoDB. Repo integration (GitHub/GitLab/Bitbucket). AI engine reads repo structure + tech stack and auto-generates CI/CD pipelines (build/test/deploy/rollback) for GitHub Actions / GitLab CI / Jenkins / Bitbucket Pipelines. Multi-cloud deploy (AWS/GCP/Azure/Oracle/Cloudflare/on-prem). Security (Snyk, Trivy). Monitoring (Prometheus, Grafana, ELK). Auto-fix on errors. Rollback. **Iteration 2 additions**: Output format options (YAML / Shell scripts / Terraform / CloudFormation). BYOK — bring your own AI tokens (OpenAI GPT-4 / Anthropic Claude / LLaMA-3 via Groq).

## User Choices (verbatim across all rounds)
- End-to-end MVP with real AI integration (external deploys/scans/OAuth mocked, AI is real).
- AI models: Claude Sonnet 4.5 default + GPT-5.2 + Gemini 3 Flash via Emergent Universal LLM Key.
- Both Emergent Google login AND JWT email/password on same login page.
- Real GitHub public-repo fetching; mocked OAuth for GitLab/Bitbucket.
- All 4 CI platforms supported.
- Output formats: YAML / Scripts / Terraform / CloudFormation (NEW).
- BYOK: users can save OpenAI, Anthropic, or OpenAI-compatible (Groq/OpenRouter for LLaMA-3) keys (NEW).
- Project must follow the requested folder structure (controllers / middleware / models / routes / services / utils / config + app + server) for the backend, and (api / components / hooks / layouts / pages / context / utils / styles + App + index + routes.js) for the frontend.

## User Personas
- **Solo developer** (Hacker tier): skip writing CI YAML.
- **Senior engineer at a startup** (Team): consistent, secure pipelines + auto-rollback.
- **Platform engineer at enterprise**: multi-cloud, SSO/RBAC, on-prem deploys, IaC-first (Terraform/CloudFormation).
- **AI-curious developer**: wants to plug in their own LLaMA-3 / GPT-4 key for cost/latency reasons.

## Architecture
- **Backend** — FastAPI, modular: `server.py` (entrypoint stub) → `src/app.py` → `src/routes/` aggregates `src/controllers/*` which depend on `src/services/*`, `src/middleware/auth.py`, `src/models/schemas.py`, `src/utils/*`, `src/config/`.
- **Frontend** — React 19, modular: `src/api/` (axios client + service modules), `src/context/AuthContext.jsx`, `src/hooks/`, `src/layouts/AppShell.jsx`, `src/pages/*.jsx`, `src/components/*.jsx`, `src/styles/`, `src/utils/`, centralised `src/routes.js`.
- **AI** — unified `stream_emergent` (emergentintegrations LlmChat) + `stream_openai_compat` (AsyncOpenAI with optional `base_url`) + `stream_anthropic` (against Anthropic's OpenAI-compat endpoint). Driven by `output_format` system prompts (yaml / scripts / terraform / cloudformation).
- **BYOK storage** — `db.api_keys` collection; keys encrypted at rest via Fernet keyed from JWT_SECRET. Plaintext / encrypted blob never returned by API; only `api_key_masked` ("••••••XXXX").

## Implemented in v1 (2026-01)
- Auth (JWT + Emergent Google) · Landing · Dashboard · Repo integration (real GitHub + mocked OAuth) · AI Pipeline Generator (SSE streaming) · Pipeline detail (DAG/YAML/Runs) · Run detail (live logs + AI AutoFix) · Deployments + 1-click rollback · Security scans (mocked) · Settings + audit log · Cmd+K palette.

## Implemented in v1.1 (this iteration)
- **Project restructure** — backend into `src/{config,controllers,middleware,models,routes,services,utils}` + `server.py` stub. Frontend into `src/{api,components,context,hooks,layouts,pages,styles,utils}` + `routes.js`.
- **Output Format selector** — Pipeline Generator emits YAML, Shell Scripts (Makefile + `scripts/*.sh`), Terraform HCL, or AWS CloudFormation. Distinct system prompts per format. Output file label updates accordingly.
- **BYOK (Bring Your Own Key)** — Settings page → `ApiKeyManager` (`/app/frontend/src/components/ApiKeyManager.jsx`). Supports:
  - `openai` mode → OpenAI directly (GPT-4 / GPT-4o etc.)
  - `anthropic` mode → Anthropic via OpenAI-compat endpoint (Claude family)
  - `openai-compat` mode → any OpenAI-compatible endpoint (Groq for LLaMA-3, OpenRouter, Together AI, etc.) with custom base_url
- **AI Engine selector in Pipeline Generator** — dropdown lists "Emergent (built-in · default)" + every saved BYOK key; selecting BYOK shows a `model id` input pre-filled with the key's default model. Backend `_resolve_stream` decrypts the key on demand and routes to the right SDK.
- **Encryption** — `/app/backend/src/utils/crypto.py` (Fernet, SHA256 of JWT_SECRET → base64 → key). `api_key_encrypted` excluded from every response projection.
- **Preset shortcuts** in ApiKeyManager — one-click presets for Groq (LLaMA-3), OpenRouter, Together AI, OpenAI, Anthropic.
- **14 new backend tests** in `/app/backend/tests/test_byok_and_formats.py` — 100% pass.

## Backlog
- **P1**: Real GitHub OAuth, real Snyk, real cloud deploys.
- **P1**: Use the `anthropic` SDK for the anthropic-BYOK branch (current OpenAI-compat works for path-wiring but is limited for some Claude features).
- **P1**: Refetch BYOK keys on PipelineGenerator focus to remove the one-time "just created a key, not appearing" UX race.
- **P2**: Pipeline template marketplace, Vault/Secrets Manager, multi-tenant org workspaces with RBAC/SSO, real Prometheus/Grafana/ELK hooks, persistent run queue (Celery/RQ instead of in-memory asyncio).
- **P2**: Stream errors include upstream status code separately for richer UI handling.

## Next Tasks
- Validate BYOK with real provider keys (user-supplied) when they're ready.
- (optional) Wire shadcn AlertDialog into ApiKeyManager delete confirmation in place of `window.confirm`.

## Test credentials
- JWT: `forge_test@example.com / forgepass123` (see `/app/memory/test_credentials.md`).
