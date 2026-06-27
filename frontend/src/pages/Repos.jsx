import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { GitBranch, Star, Trash, Plus, Code } from "@phosphor-icons/react";
import { toast } from "sonner";
import api from "@/lib/api";

export default function Repos() {
  const [repos, setRepos] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const { data } = await api.get("/repos");
      setRepos(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const remove = async (id) => {
    if (!window.confirm("Delete this repo and its pipelines?")) return;
    try {
      await api.delete(`/repos/${id}`);
      toast.success("Repository removed");
      load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed");
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <div className="micro-label mb-2">// repositories</div>
          <h1 className="font-display font-black text-4xl tracking-tighter">Repositories</h1>
          <p className="text-[#A1A1AA] text-sm mt-2">{repos.length} connected · across GitHub, GitLab, Bitbucket</p>
        </div>
        <Link to="/app/repos/connect" data-testid="repos-connect-btn" className="btn-primary inline-flex items-center gap-2">
          <Plus size={14} weight="bold" /> Connect repo
        </Link>
      </header>

      {loading ? (
        <div className="text-[#71717A] font-mono text-sm"><span className="ascii-loader" /> loading...</div>
      ) : repos.length === 0 ? (
        <div className="surface p-16 text-center">
          <GitBranch size={40} className="mx-auto text-[#262626]" />
          <div className="mt-4 font-display font-bold text-xl">No repositories yet</div>
          <div className="text-sm text-[#A1A1AA] mt-2 max-w-sm mx-auto">Connect a repo so Forge can analyze its stack and generate CI/CD pipelines.</div>
          <Link to="/app/repos/connect" className="btn-primary mt-6 inline-block">Connect your first repo</Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {repos.map((r) => (
            <div key={r.id} data-testid={`repo-card-${r.id}`} className="surface p-5 hover:border-[#E54D2E] transition-colors group">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="micro-label text-[#71717A]">{r.provider}</span>
                  {r.mocked && <span className="badge badge-warning">mock</span>}
                </div>
                <button onClick={() => remove(r.id)} data-testid={`repo-delete-${r.id}`} className="text-[#71717A] hover:text-[#E54D2E] p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Trash size={14} />
                </button>
              </div>
              <div className="mt-3 font-display font-bold text-base truncate" title={r.full_name}>{r.full_name}</div>
              {r.description && <div className="text-xs text-[#A1A1AA] mt-1 line-clamp-2">{r.description}</div>}
              <div className="mt-4 flex flex-wrap gap-1">
                {(r.tech_stack?.languages || []).slice(0, 3).map((l) => (
                  <span key={l} className="badge">{l}</span>
                ))}
                {(r.tech_stack?.frameworks || []).slice(0, 2).map((f) => (
                  <span key={f} className="badge badge-info">{f}</span>
                ))}
              </div>
              <div className="mt-4 pt-4 border-t border-[#1A1A1A] flex items-center justify-between text-xs text-[#71717A]">
                <span className="font-mono">{r.default_branch}</span>
                <Link to="/app/pipelines/new" state={{ repo_id: r.id }} data-testid={`repo-generate-${r.id}`} className="text-[#E54D2E] hover:underline">generate pipeline →</Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
