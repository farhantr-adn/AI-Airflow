"""Static registries: deployment strategies, cloud service variants, AI models grouped by provider."""

# ----------------------------- Deployment strategies --------------------
DEPLOY_STRATEGIES = [
    {
        "id": "rolling",
        "label": "Rolling Update",
        "summary": "Gradually replaces old instances with new ones, one by one or in batches.",
        "pros": ["Near-zero downtime", "Default in Kubernetes", "Resource-efficient"],
        "cons": ["Slower rollout", "Harder rollback mid-flight"],
        "best_for": "Stateless microservices on Kubernetes — the safe default.",
        "complexity": 2,
    },
    {
        "id": "blue-green",
        "label": "Blue-Green",
        "summary": "Two identical environments (Blue = current, Green = new). Switch traffic instantly.",
        "pros": ["Instant rollback", "Minimal downtime", "Easy to validate before cut-over"],
        "cons": ["Requires double infrastructure", "Higher cost"],
        "best_for": "Mission-critical apps that need fast rollback (payments, auth).",
        "complexity": 3,
    },
    {
        "id": "canary",
        "label": "Canary Release",
        "summary": "Ship the new version to a small % of users first, then progressively expand.",
        "pros": ["Early bug detection", "Controlled blast radius", "Real-user feedback"],
        "cons": ["Needs traffic splitting", "Strong observability required", "Slower full rollout"],
        "best_for": "Large user bases and risk-sensitive features (A/B safe).",
        "complexity": 4,
    },
    {
        "id": "shadow",
        "label": "Shadow Deployment",
        "summary": "New version runs alongside old and receives mirrored traffic — but does not affect users.",
        "pros": ["Real traffic testing", "Zero user impact", "Great for perf validation"],
        "cons": ["Resource-intensive (2× compute)", "Complex setup", "Side-effects must be guarded"],
        "best_for": "AI/ML model validation, performance baselining, high-stakes refactors.",
        "complexity": 5,
    },
    {
        "id": "big-bang",
        "label": "Big Bang",
        "summary": "Replace all instances at once with the new version. Simple, fast, risky.",
        "pros": ["Simplest implementation", "Fastest end-to-end"],
        "cons": ["High risk", "Downtime likely", "Hard rollback"],
        "best_for": "Small apps, internal tools, hobby projects.",
        "complexity": 1,
    },
    {
        "id": "phased",
        "label": "Phased Deployment",
        "summary": "Roll out by region, team, or environment in deliberate stages.",
        "pros": ["Controlled exposure", "Compliance-friendly", "Regional risk isolation"],
        "cons": ["Longer cycle", "Coordination overhead"],
        "best_for": "Global SaaS with regional traffic and compliance requirements.",
        "complexity": 4,
    },
]
DEPLOY_STRATEGY_IDS = [s["id"] for s in DEPLOY_STRATEGIES]


# ----------------------------- Cloud services ---------------------------
# Each cloud → list of viable deployment "service" variants. AI uses this to
# tailor the pipeline (e.g. AWS+ECS vs AWS+Lambda generate very different YAML).
CLOUD_SERVICES = {
    "aws": [
        {"id": "ecs", "label": "ECS (Fargate)"},
        {"id": "eks", "label": "EKS (Kubernetes)"},
        {"id": "lambda", "label": "Lambda"},
        {"id": "beanstalk", "label": "Elastic Beanstalk"},
        {"id": "apprunner", "label": "App Runner"},
        {"id": "ec2", "label": "EC2"},
    ],
    "gcp": [
        {"id": "cloud-run", "label": "Cloud Run"},
        {"id": "gke", "label": "GKE (Kubernetes)"},
        {"id": "app-engine", "label": "App Engine"},
        {"id": "compute-engine", "label": "Compute Engine"},
        {"id": "cloud-functions", "label": "Cloud Functions"},
    ],
    "azure": [
        {"id": "container-apps", "label": "Container Apps"},
        {"id": "aks", "label": "AKS (Kubernetes)"},
        {"id": "app-service", "label": "App Service"},
        {"id": "functions", "label": "Functions"},
        {"id": "vm", "label": "Virtual Machines"},
    ],
    "oracle": [
        {"id": "oke", "label": "OKE (Kubernetes)"},
        {"id": "functions", "label": "Functions"},
        {"id": "compute", "label": "Compute"},
    ],
    "cloudflare": [
        {"id": "workers", "label": "Workers"},
        {"id": "pages", "label": "Pages"},
        {"id": "containers", "label": "Containers (beta)"},
    ],
    "on-prem": [
        {"id": "k8s", "label": "Kubernetes (self-hosted)"},
        {"id": "docker-compose", "label": "Docker Compose"},
        {"id": "bare-metal", "label": "Bare Metal"},
    ],
}


# ----------------------------- AI providers + models --------------------
# Models grouped by provider for the UI. The `emergent` field tells the FE
# whether this model is reachable via the built-in Emergent universal key.
AI_PROVIDERS = [
    {
        "id": "anthropic",
        "label": "Anthropic",
        "icon": "anthropic",
        "emergent": True,
        "models": [
            {"id": "claude-sonnet-4-5-20250929", "label": "Claude Sonnet 4.5", "default": True},
            {"id": "claude-sonnet-4-6", "label": "Claude Sonnet 4.6"},
            {"id": "claude-3-5-sonnet-20241022", "label": "Claude 3.5 Sonnet"},
            {"id": "claude-3-opus-20240229", "label": "Claude 3 Opus"},
            {"id": "claude-3-haiku-20240307", "label": "Claude 3 Haiku"},
        ],
    },
    {
        "id": "openai",
        "label": "OpenAI",
        "icon": "openai",
        "emergent": True,
        "models": [
            {"id": "gpt-5.4", "label": "GPT-5.4"},
            {"id": "gpt-5.2", "label": "GPT-5.2"},
            {"id": "gpt-4o", "label": "GPT-4o"},
            {"id": "gpt-4-turbo", "label": "GPT-4 Turbo"},
            {"id": "gpt-4", "label": "GPT-4"},
        ],
    },
    {
        "id": "gemini",
        "label": "Google Gemini",
        "icon": "gemini",
        "emergent": True,
        "models": [
            {"id": "gemini-3.1-pro-preview", "label": "Gemini 3.1 Pro"},
            {"id": "gemini-3-flash-preview", "label": "Gemini 3 Flash"},
            {"id": "gemini-2.0-flash", "label": "Gemini 2.0 Flash"},
            {"id": "gemini-1.5-pro", "label": "Gemini 1.5 Pro"},
        ],
    },
    {
        "id": "llama",
        "label": "Meta LLaMA",
        "icon": "meta",
        "emergent": False,   # requires BYOK via Groq / OpenRouter / Together
        "models": [
            {"id": "llama-3.3-70b-versatile", "label": "LLaMA 3.3 70B (Groq)"},
            {"id": "llama-3.1-70b-versatile", "label": "LLaMA 3.1 70B (Groq)"},
            {"id": "llama-3.1-8b-instant", "label": "LLaMA 3.1 8B (Groq)"},
            {"id": "meta-llama/llama-3.1-70b-instruct", "label": "LLaMA 3.1 70B (OpenRouter)"},
        ],
    },
]
