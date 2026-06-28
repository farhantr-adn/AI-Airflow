import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowsClockwise, ArrowsDownUp, ChartLineUp, EyeSlash, Lightning,
  ListChecks, ArrowRight, CheckCircle, XCircle, Target,
} from "@phosphor-icons/react";
import { catalogService } from "@/api";

const STRATEGY_META = {
  "rolling":    { icon: ArrowsClockwise, accent: "#46A758", howto: "Replace instances in batches. New pods are created and become Ready before old ones are terminated. Kubernetes' default deployment strategy." },
  "blue-green": { icon: ArrowsDownUp,    accent: "#3B82F6", howto: "Run two identical environments. The 'green' stack runs the new version; once smoke tests pass, the load balancer / DNS flips traffic from blue → green instantly." },
  "canary":     { icon: ChartLineUp,     accent: "#E54D2E", howto: "Route a small slice of traffic (e.g. 5%) to the new version. Watch SLOs (error rate, p99 latency). If healthy, expand to 25% → 50% → 100%; otherwise rollback automatically." },
  "shadow":     { icon: EyeSlash,        accent: "#A78BFA", howto: "Mirror live production traffic to the new version, but discard its responses. Compare metrics/responses offline. Ideal for validating new ML models or risky refactors." },
  "big-bang":   { icon: Lightning,       accent: "#FFC53D", howto: "Stop the old version, deploy the new version, start it. Simplest possible deploy — expect a brief outage and no incremental safety net." },
  "phased":     { icon: ListChecks,      accent: "#46A758", howto: "Roll out in named stages (us-east → eu-west → apac, or internal → beta → GA). Each phase has its own gate / approval. Common in regulated industries." },
};

const BUSINESS_FIT = [
  { tag: "High-availability SaaS", strategies: ["blue-green", "canary"] },
  { tag: "Microservices on Kubernetes", strategies: ["rolling", "canary"] },
  { tag: "Mission-critical (payments, auth)", strategies: ["blue-green"] },
  { tag: "AI / ML model validation", strategies: ["shadow"] },
  { tag: "Global B2C app (regional traffic)", strategies: ["phased", "canary"] },
  { tag: "Internal tools / hobby project", strategies: ["big-bang", "rolling"] },
  { tag: "Compliance-heavy (FinTech, Health)", strategies: ["phased", "blue-green"] },
];

export default function Strategies() {
  const [strategies, setStrategies] = useState([]);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    catalogService.strategies().then((s) => {
      setStrategies(s);
      setSelected(s[0]?.id);
    });
  }, []);

  const current = strategies.find((s) => s.id === selected);
  const M = current ? STRATEGY_META[current.id] : null;

  return (
    <div className="space-y-6">
      <header>
        <div className="micro-label mb-2">// deployment strategies</div>
        <h1 className="font-display font-black text-4xl tracking-tighter">Pick the right rollout for your business</h1>
        <p className="text-[#A1A1AA] text-sm mt-2 max-w-3xl">
          Six battle-tested deployment strategies, each suited to a different risk profile and team maturity. Pick one to see the full breakdown — then jump straight into generating a pipeline.
        </p>
      </header>

      {/* Strategy tabs */}
      <div className="border border-[#262626] flex flex-wrap gap-px bg-[#262626]" data-testid="strategy-tabs">
        {strategies.map((s) => {
          const meta = STRATEGY_META[s.id] || { icon: Target, accent: "#A1A1AA" };
          const Icon = meta.icon;
          const active = selected === s.id;
          return (
            <button
              key={s.id}
              data-testid={`strategy-tab-${s.id}`}
              onClick={() => setSelected(s.id)}
              className={`flex-1 min-w-[150px] bg-[#0A0A0A] px-4 py-4 text-left transition-colors ${active ? "border-l-2 border-[#E54D2E]" : ""}`}
            >
              <div className="flex items-center gap-2">
                <Icon size={18} weight="duotone" color={active ? meta.accent : "#A1A1AA"} />
                <span className={`font-display font-bold text-sm ${active ? "text-white" : "text-[#A1A1AA]"}`}>{s.label}</span>
              </div>
              <div className="text-[10px] text-[#71717A] mt-1 font-mono">complexity {"●".repeat(s.complexity)}{"○".repeat(5 - s.complexity)}</div>
            </button>
          );
        })}
      </div>

      {/* Selected detail */}
      {current && M && (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
          <div className="surface p-8 space-y-6" data-testid={`strategy-detail-${current.id}`}>
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 border border-[#262626] grid place-items-center" style={{ borderColor: M.accent + "55" }}>
                <M.icon size={28} weight="duotone" color={M.accent} />
              </div>
              <div>
                <h2 className="font-display font-black text-3xl tracking-tighter">{current.label}</h2>
                <p className="text-[#A1A1AA] mt-1">{current.summary}</p>
              </div>
            </div>

            <Section title="// how it works">
              <p className="text-sm leading-relaxed text-[#EDEDED]">{M.howto}</p>
            </Section>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Section title="// pros" accent="#46A758">
                <ul className="space-y-2">
                  {current.pros.map((p) => (
                    <li key={p} className="flex items-start gap-2 text-sm">
                      <CheckCircle size={14} weight="fill" color="#46A758" className="mt-0.5 flex-shrink-0" /> {p}
                    </li>
                  ))}
                </ul>
              </Section>
              <Section title="// cons" accent="#E54D2E">
                <ul className="space-y-2">
                  {current.cons.map((c) => (
                    <li key={c} className="flex items-start gap-2 text-sm">
                      <XCircle size={14} weight="fill" color="#E54D2E" className="mt-0.5 flex-shrink-0" /> {c}
                    </li>
                  ))}
                </ul>
              </Section>
            </div>

            <Section title="// best for">
              <div className="flex items-start gap-2 text-sm border-l-2 pl-4 py-1" style={{ borderColor: M.accent }}>
                <Target size={14} className="mt-1 flex-shrink-0" color={M.accent} weight="fill" /> {current.best_for}
              </div>
            </Section>

            <div className="pt-2 flex flex-wrap items-center gap-3">
              <Link
                to="/app/pipelines/new"
                state={{ deploy_strategy: current.id }}
                data-testid={`strategy-use-btn-${current.id}`}
                className="btn-primary inline-flex items-center gap-2"
              >
                <Lightning size={14} weight="fill" /> Generate pipeline with {current.label}
                <ArrowRight size={14} />
              </Link>
              <span className="text-xs text-[#71717A]">we'll preselect this strategy in the AI generator</span>
            </div>
          </div>

          {/* Business fit sidebar */}
          <aside className="surface p-6 h-fit" data-testid="business-fit">
            <div className="micro-label mb-4">// which one fits your business?</div>
            <div className="space-y-3">
              {BUSINESS_FIT.map((row) => (
                <div key={row.tag} className="border-b border-[#1A1A1A] pb-3 last:border-0">
                  <div className="text-xs text-[#A1A1AA] mb-1.5">{row.tag}</div>
                  <div className="flex flex-wrap gap-1">
                    {row.strategies.map((sid) => {
                      const s = strategies.find((x) => x.id === sid);
                      const meta = STRATEGY_META[sid];
                      if (!s) return null;
                      return (
                        <button
                          key={sid}
                          onClick={() => setSelected(sid)}
                          className={`badge ${selected === sid ? "badge-success" : ""}`}
                          style={selected !== sid ? { color: meta?.accent } : undefined}
                        >
                          {s.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </aside>
        </div>
      )}

      {/* Quick comparison table */}
      <div className="surface overflow-hidden">
        <div className="px-6 py-4 border-b border-[#262626] flex items-center justify-between">
          <h2 className="font-display font-bold">Comparison at a glance</h2>
          <span className="micro-label">all six side-by-side</span>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-[#0a0a0a]">
            <tr className="text-left border-b border-[#262626]">
              <th className="micro-label p-4">strategy</th>
              <th className="micro-label p-4">downtime</th>
              <th className="micro-label p-4">rollback</th>
              <th className="micro-label p-4">cost</th>
              <th className="micro-label p-4">complexity</th>
              <th className="micro-label p-4">best for</th>
            </tr>
          </thead>
          <tbody>
            {strategies.map((s) => {
              const tag = {
                "rolling":    { down: "near-zero",   rb: "moderate",  cost: "$",   },
                "blue-green": { down: "zero",        rb: "instant",   cost: "$$",  },
                "canary":     { down: "zero",        rb: "automatic", cost: "$$",  },
                "shadow":     { down: "n/a",         rb: "n/a",       cost: "$$$", },
                "big-bang":   { down: "expected",    rb: "manual",    cost: "$",   },
                "phased":     { down: "near-zero",   rb: "per-phase", cost: "$$",  },
              }[s.id];
              return (
                <tr
                  key={s.id}
                  onClick={() => setSelected(s.id)}
                  className={`border-b border-[#1A1A1A] hover:bg-[#121212] cursor-pointer ${selected === s.id ? "bg-[#121212]" : ""}`}
                  data-testid={`compare-row-${s.id}`}
                >
                  <td className="p-4 font-display font-bold">{s.label}</td>
                  <td className="p-4 font-mono text-xs">{tag?.down}</td>
                  <td className="p-4 font-mono text-xs">{tag?.rb}</td>
                  <td className="p-4 font-mono text-xs">{tag?.cost}</td>
                  <td className="p-4 font-mono text-xs">{"●".repeat(s.complexity)}{"○".repeat(5 - s.complexity)}</td>
                  <td className="p-4 text-xs text-[#A1A1AA]">{s.best_for}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const Section = ({ title, children, accent }) => (
  <div>
    <div className="micro-label mb-2" style={accent ? { color: accent } : undefined}>{title}</div>
    {children}
  </div>
);
