import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { GitBranch, FlowArrow, Cube, CheckCircle, XCircle, ArrowRight, Lightning } from "@phosphor-icons/react";
import api from "@/api/client";
import { StatusBadge } from "@/components/StatusBadge";
import { formatDistanceToNow } from "date-fns";

const Stat = ({ label, value, sub, accent, testid }) => (
  <div className="surface p-5" data-testid={testid}>
    <div className="micro-label">{label}</div>
    <div className={`mt-2 font-mono text-3xl ${accent ? "text-[#E54D2E]" : "text-white"}`}>{value}</div>
    {sub && <div className="text-xs text-[#71717A] mt-1">{sub}</div>}
  </div>
);

export default function Dashboard() {
  const [m, setM] = useState(null);

  useEffect(() => {
    api.get("/metrics/dashboard").then(({ data }) => setM(data)).catch(() => {});
  }, []);

  return (
    <div className="space-y-8">
      <header className="flex items-start justify-between gap-6">
        <div>
          <div className="micro-label mb-2">// dashboard</div>
          <h1 className="font-display font-black text-4xl tracking-tighter">Control room</h1>
          <p className="text-[#A1A1AA] text-sm mt-2">Live status of every repo, pipeline, and deploy in your workspace.</p>
        </div>
        <Link to="/app/pipelines/new" data-testid="dash-new-pipeline" className="btn-primary inline-flex items-center gap-2">
          <Lightning size={14} weight="fill" /> Generate pipeline
        </Link>
      </header>

      {!m ? (
        <div className="text-[#71717A] font-mono text-sm"><span className="ascii-loader" /> loading metrics...</div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Stat testid="stat-repos" label="// connected repos" value={m.repos} sub="GitHub, GitLab, Bitbucket" />
            <Stat testid="stat-pipelines" label="// pipelines" value={m.pipelines} sub="across 4 CI platforms" />
            <Stat testid="stat-success" label="// success rate" value={`${m.success_rate}%`} sub={`${m.successful_runs} / ${m.runs} runs`} accent={m.success_rate >= 80} />
            <Stat testid="stat-deployments" label="// live deploys" value={m.deployments} sub="active production env" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 surface p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-display font-bold text-lg">Recent runs</h2>
                <Link to="/app/pipelines" className="micro-label hover:text-white">all pipelines →</Link>
              </div>
              {m.recent_runs.length === 0 ? (
                <div className="text-center py-12">
                  <FlowArrow size={32} className="mx-auto text-[#262626]" />
                  <div className="mt-3 text-sm text-[#71717A]">No runs yet</div>
                  <Link to="/app/pipelines/new" className="btn-secondary mt-4 inline-block">Generate your first pipeline</Link>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left">
                      <th className="micro-label pb-3">repository</th>
                      <th className="micro-label pb-3">status</th>
                      <th className="micro-label pb-3">stage</th>
                      <th className="micro-label pb-3">time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {m.recent_runs.map((r) => (
                      <tr key={r.id} className="border-t border-[#1A1A1A]">
                        <td className="py-3">
                          <Link to={`/app/runs/${r.id}`} className="font-mono text-xs hover:text-[#E54D2E]" data-testid={`recent-run-${r.id}`}>
                            {r.repo_name}
                          </Link>
                          <div className="text-[10px] text-[#71717A] font-mono">{r.commit_sha || "—"}</div>
                        </td>
                        <td className="py-3"><StatusBadge status={r.status} /></td>
                        <td className="py-3 font-mono text-xs text-[#A1A1AA]">{r.failed_stage || r.current_stage || "—"}</td>
                        <td className="py-3 text-xs text-[#71717A]">{r.started_at ? formatDistanceToNow(new Date(r.started_at), { addSuffix: true }) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="surface p-6">
              <h2 className="font-display font-bold text-lg mb-5">Quick start</h2>
              <div className="space-y-3">
                <Link to="/app/repos/connect" data-testid="dash-quick-connect" className="block border border-[#262626] p-4 hover:border-[#E54D2E] transition-colors group">
                  <GitBranch size={20} className="text-[#E54D2E] mb-2" weight="duotone" />
                  <div className="font-medium text-sm">Connect a repository</div>
                  <div className="text-xs text-[#71717A] mt-1">Paste a GitHub URL or pick from a provider</div>
                  <div className="mt-3 micro-label text-[#E54D2E] flex items-center gap-1">go <ArrowRight size={12} /></div>
                </Link>
                <Link to="/app/pipelines/new" data-testid="dash-quick-generate" className="block border border-[#262626] p-4 hover:border-[#E54D2E] transition-colors group">
                  <FlowArrow size={20} className="text-[#E54D2E] mb-2" weight="duotone" />
                  <div className="font-medium text-sm">Generate a pipeline</div>
                  <div className="text-xs text-[#71717A] mt-1">Let Claude build production YAML in 12s</div>
                  <div className="mt-3 micro-label text-[#E54D2E] flex items-center gap-1">go <ArrowRight size={12} /></div>
                </Link>
                <Link to="/app/deployments" className="block border border-[#262626] p-4 hover:border-[#E54D2E] transition-colors group">
                  <Cube size={20} className="text-[#E54D2E] mb-2" weight="duotone" />
                  <div className="font-medium text-sm">Review deployments</div>
                  <div className="text-xs text-[#71717A] mt-1">Roll back to any prior revision instantly</div>
                </Link>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
