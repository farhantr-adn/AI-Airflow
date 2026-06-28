import React from "react";
import { Link } from "react-router-dom";
import { Lightning, GitBranch, Cube, ShieldCheck, ChartLineUp, ArrowsClockwise, Code, Terminal, Cpu, ArrowRight } from "@phosphor-icons/react";
import { CloudLogo, CLOUD_LABEL } from "@/components/Logos";

export default function Landing() {
  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#EDEDED]">
      {/* NAV */}
      <nav className="sticky top-0 z-40 border-b border-[#1A1A1A] bg-[#0A0A0A]/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2" data-testid="nav-logo">
            <div className="w-7 h-7 bg-[#E54D2E] grid place-items-center">
              <Lightning weight="fill" size={16} color="#fff" />
            </div>
            <span className="font-display font-black text-lg tracking-tighter">FORGE</span>
          </Link>
          <div className="hidden md:flex items-center gap-7 text-sm text-[#A1A1AA]">
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#pipeline" className="hover:text-white transition-colors">Pipeline</a>
            <a href="#cloud" className="hover:text-white transition-colors">Cloud</a>
            <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/login" data-testid="nav-login-btn" className="btn-ghost">Sign in</Link>
            <Link to="/signup" data-testid="nav-signup-btn" className="btn-primary">Start free</Link>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="relative overflow-hidden border-b border-[#1A1A1A]">
        <div className="absolute inset-0 crosshair-bg opacity-60" />
        <div className="absolute inset-0 grain pointer-events-none" />
        <div className="relative max-w-7xl mx-auto px-6 pt-24 pb-32 grid grid-cols-1 lg:grid-cols-12 gap-12">
          <div className="lg:col-span-7">
            <div className="inline-flex items-center gap-2 border border-[#262626] bg-[#121212] px-3 py-1.5 mb-8" data-testid="hero-badge">
              <span className="w-1.5 h-1.5 bg-[#46A758] rounded-full blink" />
              <span className="micro-label" style={{ color: "#A1A1AA" }}>v1.0 · AI-Powered CI/CD · Now in preview</span>
            </div>
            <h1 className="font-display font-black text-5xl sm:text-6xl lg:text-7xl leading-[0.95] tracking-tighter" data-testid="hero-title">
              Ship code at<br />
              <span className="text-[#E54D2E]">terminal velocity</span>.<br />
              <span className="text-[#A1A1AA]">Without writing YAML.</span>
            </h1>
            <p className="mt-8 text-lg text-[#A1A1AA] max-w-xl leading-relaxed">
              Forge analyzes your repo, generates production-grade CI/CD pipelines with Claude Sonnet 4.5,
              auto-fixes failed builds, and rolls back broken deploys — across any cloud, in seconds.
            </p>
            <div className="mt-10 flex items-center gap-4">
              <Link to="/signup" data-testid="hero-cta-primary" className="btn-primary inline-flex items-center gap-2">
                Start forging <ArrowRight size={16} weight="bold" />
              </Link>
              <Link to="/login" data-testid="hero-cta-secondary" className="btn-secondary">
                Sign in
              </Link>
            </div>
            <div className="mt-12 grid grid-cols-3 gap-6 max-w-lg">
              {[
                ["12s", "avg gen time"],
                ["4 CI", "platforms"],
                ["6 cloud", "targets"],
              ].map(([n, l]) => (
                <div key={l}>
                  <div className="font-mono text-3xl text-white">{n}</div>
                  <div className="micro-label mt-1">{l}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Terminal preview */}
          <div className="lg:col-span-5 lg:mt-4">
            <div className="surface-panel font-mono text-sm overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2 border-b border-[#1A1A1A] bg-[#0a0a0a]">
                <div className="w-2.5 h-2.5 rounded-full bg-[#E54D2E]/70" />
                <div className="w-2.5 h-2.5 rounded-full bg-[#FFC53D]/70" />
                <div className="w-2.5 h-2.5 rounded-full bg-[#46A758]/70" />
                <span className="ml-3 text-[#71717A] text-xs tracking-wider">forge › generate</span>
              </div>
              <div className="p-5 space-y-1.5 leading-relaxed">
                <div className="text-[#71717A]">$ forge analyze github.com/acme/payments-api</div>
                <div className="text-[#A1A1AA]">→ detected: <span className="text-white">Go 1.22</span>, Docker, k8s</div>
                <div className="text-[#A1A1AA]">→ stack: <span className="text-white">stripe-go, gin, pgx</span></div>
                <div className="text-[#71717A] mt-3">$ forge generate --target=github-actions --cloud=aws</div>
                <div className="text-[#46A758]">✓ pipeline generated · 87 lines</div>
                <div className="text-[#46A758]">✓ snyk scan job injected</div>
                <div className="text-[#46A758]">✓ blue-green deploy stage configured</div>
                <div className="text-[#46A758]">✓ rollback workflow attached</div>
                <div className="mt-3 text-[#71717A]">$ forge run</div>
                <div className="text-[#A1A1AA]">[checkout]   <span className="text-[#46A758]">✓</span> 1.2s</div>
                <div className="text-[#A1A1AA]">[install]    <span className="text-[#46A758]">✓</span> 4.1s</div>
                <div className="text-[#A1A1AA]">[test]       <span className="text-[#46A758]">✓</span> 7.8s · 89.3% coverage</div>
                <div className="text-[#A1A1AA]">[security]   <span className="text-[#46A758]">✓</span> 0 high vulns</div>
                <div className="text-[#A1A1AA]">[build]      <span className="text-[#46A758]">✓</span> 12.4s</div>
                <div className="text-[#A1A1AA]">[deploy]     <span className="text-white">⠼</span> rolling out 3/3<span className="blink">_</span></div>
              </div>
            </div>
            <div className="mt-3 micro-label text-right">live simulation</div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="border-b border-[#1A1A1A] py-24">
        <div className="max-w-7xl mx-auto px-6">
          <div className="mb-16">
            <div className="micro-label mb-4">// capabilities</div>
            <h2 className="font-display font-black text-4xl lg:text-5xl tracking-tighter max-w-3xl">
              Every stage. Every cloud. <span className="text-[#71717A]">Zero boilerplate.</span>
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-[#262626] border border-[#262626]">
            {[
              { icon: Cpu, title: "AI Pipeline Generation", desc: "Claude Sonnet 4.5, GPT-5.2, or Gemini 3 Flash analyzes your stack and emits production-grade YAML." },
              { icon: GitBranch, title: "Repo Integration", desc: "Connect GitHub, GitLab, Bitbucket. Detects frameworks, dependencies, container configs automatically." },
              { icon: Cube, title: "Multi-Cloud Deploy", desc: "AWS · GCP · Azure · Oracle · Cloudflare · on-prem. The pipeline adapts to your target." },
              { icon: ShieldCheck, title: "Security Built-In", desc: "Snyk SCA + Trivy container scans injected by default. Severity-gated builds." },
              { icon: ArrowsClockwise, title: "Auto-Rollback", desc: "Failed deploy? One click reverts to the last live revision. AI suggests root-cause patches." },
              { icon: ChartLineUp, title: "Live Observability", desc: "Prometheus, Grafana, ELK hooks pre-wired. Watch pipelines stream in a real-time terminal." },
            ].map((f) => (
              <div key={f.title} className="bg-[#0A0A0A] p-8 surface-hover transition-all duration-150">
                <f.icon size={28} weight="duotone" color="#E54D2E" />
                <h3 className="font-display font-bold text-xl mt-5 tracking-tight">{f.title}</h3>
                <p className="text-[#A1A1AA] text-sm mt-2 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PIPELINE SECTION */}
      <section id="pipeline" className="border-b border-[#1A1A1A] py-24 relative overflow-hidden">
        <div className="absolute inset-0 crosshair-bg opacity-30" />
        <div className="relative max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 gap-12">
          <div className="lg:col-span-5">
            <div className="micro-label mb-4">// workflow</div>
            <h2 className="font-display font-black text-4xl lg:text-5xl tracking-tighter">
              From git push to <span className="text-[#E54D2E]">live deploy</span> in 4 steps.
            </h2>
            <div className="mt-10 space-y-6">
              {[
                ["01", "Connect repo", "Paste a URL or OAuth into GitHub/GitLab/Bitbucket."],
                ["02", "AI analyzes", "Detects languages, frameworks, containers, secrets."],
                ["03", "Pipeline emitted", "GitHub Actions, GitLab CI, Jenkins, or Bitbucket — your choice."],
                ["04", "Deploy & monitor", "Auto-rollback on failure. Auto-fix on broken builds."],
              ].map(([n, t, d]) => (
                <div key={n} className="flex gap-5 border-l border-[#262626] pl-5">
                  <div className="font-mono text-[#E54D2E] text-sm">{n}</div>
                  <div>
                    <div className="font-display font-bold text-lg">{t}</div>
                    <div className="text-[#A1A1AA] text-sm mt-1">{d}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="lg:col-span-7">
            <div className="surface-panel p-8">
              <div className="micro-label mb-6 text-[#A1A1AA]">pipeline · payments-api · run #142</div>
              <div className="flex items-center gap-2 overflow-x-auto pb-4">
                {[
                  { name: "checkout", s: "success" },
                  { name: "install", s: "success" },
                  { name: "lint", s: "success" },
                  { name: "test", s: "success" },
                  { name: "security", s: "success" },
                  { name: "build", s: "success" },
                  { name: "deploy", s: "running" },
                ].map((stage, i, arr) => (
                  <React.Fragment key={stage.name}>
                    <div className={`flex-shrink-0 border px-3 py-2 font-mono text-xs ${
                      stage.s === "success" ? "border-[#46A758] text-[#46A758] bg-[#46A758]/5" :
                      stage.s === "running" ? "border-white text-white bg-white/5 badge-running" : "border-[#262626] text-[#71717A]"
                    }`}>
                      {stage.s === "success" ? "✓" : stage.s === "running" ? "⠼" : "○"} {stage.name}
                    </div>
                    {i < arr.length - 1 && (
                      <div className={`flex-shrink-0 h-px w-6 ${
                        arr[i + 1].s === "success" || arr[i + 1].s === "running" ? "bg-[#46A758]" : "bg-[#262626]"
                      }`} />
                    )}
                  </React.Fragment>
                ))}
              </div>
              <div className="mt-6 bg-black border border-[#1A1A1A] p-4 font-mono text-xs">
                <div className="text-[#71717A]">[deploy] $ kubectl rollout status deploy/payments-api</div>
                <div className="text-[#A1A1AA]">[deploy] Waiting for deployment &quot;payments-api&quot; rollout to finish: 2 of 3 updated...</div>
                <div className="text-[#A1A1AA]">[deploy] Waiting for deployment &quot;payments-api&quot; rollout to finish: 3 of 3 updated...</div>
                <div className="text-[#46A758]">[deploy] deployment &quot;payments-api&quot; successfully rolled out<span className="blink">_</span></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CLOUD GRID */}
      <section id="cloud" className="border-b border-[#1A1A1A] py-24">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-12">
            <div className="micro-label mb-4">// universal targets</div>
            <h2 className="font-display font-black text-4xl lg:text-5xl tracking-tighter">
              Any cloud. <span className="text-[#71717A]">Or none.</span>
            </h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-px bg-[#262626] border border-[#262626]">
            {["aws", "gcp", "azure", "oracle", "cloudflare", "on-prem"].map((c) => (
              <div key={c} className="bg-[#0A0A0A] p-8 flex flex-col items-center justify-center gap-3 surface-hover transition-all">
                <CloudLogo id={c} size={40} />
                <div className="font-display font-bold text-sm text-[#A1A1AA] tracking-tight">{CLOUD_LABEL[c]}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="border-b border-[#1A1A1A] py-24">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <div className="micro-label mb-4">// pricing</div>
            <h2 className="font-display font-black text-4xl lg:text-5xl tracking-tighter">Pay for runs. Not seats.</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-[#262626] border border-[#262626]">
            {[
              { name: "Hacker", price: "$0", desc: "For solo projects", features: ["3 repos", "100 runs/mo", "GitHub Actions only", "Community support"] },
              { name: "Team", price: "$49", desc: "For shipping teams", features: ["Unlimited repos", "5,000 runs/mo", "All CI platforms", "Auto-rollback", "Priority support"], featured: true },
              { name: "Enterprise", price: "Custom", desc: "For scale", features: ["Unlimited everything", "SSO + RBAC", "On-prem deploys", "Dedicated CSM", "SLA 99.95%"] },
            ].map((tier) => (
              <div key={tier.name} className={`bg-[#0A0A0A] p-10 ${tier.featured ? "border-l-2 border-[#E54D2E]" : ""}`}>
                {tier.featured && <div className="micro-label text-[#E54D2E] mb-3">// recommended</div>}
                <div className="font-display font-bold text-2xl">{tier.name}</div>
                <div className="mt-2 text-sm text-[#A1A1AA]">{tier.desc}</div>
                <div className="mt-6 font-display font-black text-5xl tracking-tighter">{tier.price}<span className="text-base text-[#71717A] font-normal">{tier.price !== "Custom" && "/mo"}</span></div>
                <ul className="mt-8 space-y-3 text-sm">
                  {tier.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-[#A1A1AA]">
                      <span className="text-[#E54D2E] mt-0.5">›</span> {f}
                    </li>
                  ))}
                </ul>
                <Link to="/signup" data-testid={`pricing-${tier.name.toLowerCase()}-cta`} className={`mt-8 inline-block w-full text-center ${tier.featured ? "btn-primary" : "btn-secondary"}`}>
                  {tier.price === "Custom" ? "Talk to sales" : "Start free"}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 crosshair-bg opacity-50" />
        <div className="relative max-w-4xl mx-auto px-6 text-center">
          <h2 className="font-display font-black text-5xl lg:text-6xl tracking-tighter">
            Stop hand-writing<br /><span className="text-[#E54D2E]">CI/CD.</span>
          </h2>
          <p className="mt-6 text-[#A1A1AA] max-w-xl mx-auto">Let an AI engineer that&apos;s seen 10,000 pipelines do it. In 12 seconds. With rollback built-in.</p>
          <Link to="/signup" data-testid="footer-cta" className="mt-10 btn-primary inline-flex items-center gap-2 text-base px-6 py-3">
            Get early access <ArrowRight size={18} weight="bold" />
          </Link>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-[#1A1A1A] py-10">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-[#E54D2E] grid place-items-center"><Lightning weight="fill" size={12} color="#fff" /></div>
            <span className="font-display font-black tracking-tighter">FORGE</span>
            <span className="micro-label ml-2">© 2026</span>
          </div>
          <div className="font-mono text-xs text-[#71717A]">built for engineers · ⠿</div>
        </div>
      </footer>
    </div>
  );
}
