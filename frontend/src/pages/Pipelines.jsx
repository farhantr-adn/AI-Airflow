import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, FlowArrow, Code } from "@phosphor-icons/react";
import api from "@/lib/api";
import { StatusBadge } from "@/components/StatusBadge";
import { formatDistanceToNow } from "date-fns";

const platLabel = {
  "github-actions": "GitHub Actions",
  "gitlab-ci": "GitLab CI",
  "jenkins": "Jenkins",
  "bitbucket": "Bitbucket",
};

export default function Pipelines() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/pipelines").then(({ data }) => { setItems(data); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <div className="micro-label mb-2">// pipelines</div>
          <h1 className="font-display font-black text-4xl tracking-tighter">Pipelines</h1>
          <p className="text-[#A1A1AA] text-sm mt-2">{items.length} saved · across {new Set(items.map((p) => p.target_platform)).size} platforms</p>
        </div>
        <Link to="/app/pipelines/new" data-testid="pipelines-new-btn" className="btn-primary inline-flex items-center gap-2">
          <Plus size={14} weight="bold" /> New pipeline
        </Link>
      </header>

      {loading ? (
        <div className="text-[#71717A] font-mono text-sm"><span className="ascii-loader" /> loading...</div>
      ) : items.length === 0 ? (
        <div className="surface p-16 text-center">
          <FlowArrow size={40} className="mx-auto text-[#262626]" />
          <div className="mt-4 font-display font-bold text-xl">No pipelines yet</div>
          <div className="text-sm text-[#A1A1AA] mt-2">Generate your first AI-powered CI/CD pipeline.</div>
          <Link to="/app/pipelines/new" className="btn-primary mt-6 inline-block">Generate pipeline</Link>
        </div>
      ) : (
        <div className="surface overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[#0a0a0a]">
              <tr className="text-left border-b border-[#262626]">
                <th className="micro-label p-4">name</th>
                <th className="micro-label p-4">repo</th>
                <th className="micro-label p-4">platform</th>
                <th className="micro-label p-4">cloud</th>
                <th className="micro-label p-4">last run</th>
                <th className="micro-label p-4">runs</th>
                <th className="micro-label p-4">created</th>
              </tr>
            </thead>
            <tbody>
              {items.map((p) => (
                <tr key={p.id} className="border-b border-[#1A1A1A] hover:bg-[#121212] transition-colors">
                  <td className="p-4">
                    <Link to={`/app/pipelines/${p.id}`} data-testid={`pipeline-row-${p.id}`} className="font-medium hover:text-[#E54D2E]">{p.name}</Link>
                  </td>
                  <td className="p-4 font-mono text-xs text-[#A1A1AA]">{p.repo_name}</td>
                  <td className="p-4"><span className="badge">{platLabel[p.target_platform] || p.target_platform}</span></td>
                  <td className="p-4 font-mono text-xs uppercase">{p.cloud_target}</td>
                  <td className="p-4">{p.last_run_status ? <StatusBadge status={p.last_run_status} /> : <span className="text-[#71717A] text-xs">—</span>}</td>
                  <td className="p-4 font-mono text-xs">{p.run_count}</td>
                  <td className="p-4 text-xs text-[#71717A]">{formatDistanceToNow(new Date(p.created_at), { addSuffix: true })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
