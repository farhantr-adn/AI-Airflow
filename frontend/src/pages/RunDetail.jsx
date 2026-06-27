import React, { useEffect, useState, useRef } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Wrench, Cube, ArrowsClockwise, X } from "@phosphor-icons/react";
import { toast } from "sonner";
import api, { API } from "@/api/client";
import { StatusBadge } from "@/components/StatusBadge";
import PipelineDAG from "@/components/PipelineDAG";
import { formatDistanceToNow } from "date-fns";

export default function RunDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [run, setRun] = useState(null);
  const [pipeline, setPipeline] = useState(null);
  const [autofix, setAutofix] = useState("");
  const [fixing, setFixing] = useState(false);
  const logsRef = useRef(null);

  const load = async () => {
    try {
      const { data } = await api.get(`/runs/${id}`);
      setRun(data);
      if (data.pipeline_id && (!pipeline || pipeline.id !== data.pipeline_id)) {
        const p = await api.get(`/pipelines/${data.pipeline_id}`);
        setPipeline(p.data);
      }
    } catch {
      toast.error("Run not found");
      navigate("/app/pipelines");
    }
  };

  useEffect(() => { load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!run) return;
    if (run.status !== "running") return;
    const t = setInterval(load, 1500);
    return () => clearInterval(t);
  }, [run?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (logsRef.current) logsRef.current.scrollTop = logsRef.current.scrollHeight;
  }, [run?.logs?.length]);

  const requestAutofix = async () => {
    setAutofix("");
    setFixing(true);
    const token = localStorage.getItem("forge_token");
    try {
      const res = await fetch(`${API}/runs/${id}/autofix`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ model: "claude-sonnet-4-5-20250929", provider: "anthropic" }),
      });
      if (!res.ok) throw new Error(await res.text());
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const events = buf.split("\n\n");
        buf = events.pop() || "";
        for (const ev of events) {
          if (!ev.trim().startsWith("data:")) continue;
          try {
            const d = JSON.parse(ev.trim().slice(5).trim());
            if (d.delta) setAutofix((o) => o + d.delta);
          } catch (e) { /* ignore */ }
        }
      }
      toast.success("AutoFix complete");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setFixing(false);
    }
  };

  if (!run) return <div className="text-[#71717A] font-mono text-sm"><span className="ascii-loader" /> loading...</div>;

  return (
    <div className="space-y-6">
      <Link to={pipeline ? `/app/pipelines/${pipeline.id}` : "/app/pipelines"} className="text-xs text-[#71717A] hover:text-white inline-flex items-center gap-1"><ArrowLeft size={12} /> back</Link>

      <header className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="micro-label">// pipeline run</div>
            <StatusBadge status={run.status} />
            {run.commit_sha && <span className="badge">{run.commit_sha}</span>}
          </div>
          <h1 className="mt-2 font-display font-black text-3xl tracking-tighter font-mono">{run.id}</h1>
          <div className="text-sm text-[#A1A1AA] mt-1 font-mono">{run.repo_name} · started {formatDistanceToNow(new Date(run.started_at), { addSuffix: true })}</div>
        </div>
        {run.status === "failed" && (
          <button onClick={requestAutofix} disabled={fixing} data-testid="autofix-btn" className="btn-primary inline-flex items-center gap-2">
            {fixing ? <span className="ascii-loader" /> : <><Wrench size={14} weight="fill" /> AI AutoFix</>}
          </button>
        )}
      </header>

      <div className="surface p-6">
        <div className="micro-label mb-4">// stage graph</div>
        <PipelineDAG stages={pipeline?.stages || ["checkout", "install", "lint", "test", "security_scan", "build", "deploy", "rollback"]} run={run} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-4">
        {/* LOGS */}
        <div className="surface-panel overflow-hidden">
          <div className="px-4 py-2.5 border-b border-[#262626] bg-[#0a0a0a] sticky top-0 flex items-center justify-between">
            <span className="font-mono text-xs text-[#A1A1AA]">
              ● logs · {run.logs?.length || 0} lines {run.status === "running" && <span className="text-[#E54D2E] ml-2">streaming</span>}
            </span>
            <span className="font-mono text-xs text-[#71717A]">{run.current_stage || run.failed_stage || "done"}</span>
          </div>
          <div ref={logsRef} className="p-5 font-mono text-xs leading-relaxed bg-black h-[500px] overflow-auto" data-testid="run-logs">
            {(run.logs || []).map((l, i) => (
              <div key={i} className={`whitespace-pre-wrap ${l.level === "error" ? "text-[#E54D2E]" : l.line?.startsWith("━━━") ? "text-[#FFC53D] mt-2" : l.line?.startsWith("$") ? "text-[#71717A]" : l.line?.startsWith("✓") ? "text-[#46A758]" : "text-[#EDEDED]"}`}>
                <span className="text-[#3a3a3a] mr-3 select-none">{String(i + 1).padStart(3, "0")}</span>
                {l.line}
              </div>
            ))}
            {run.status === "running" && <div className="text-[#E54D2E] blink">█</div>}
          </div>
        </div>

        {/* RIGHT PANEL */}
        <div className="space-y-4">
          {autofix && (
            <div className="surface p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Wrench size={14} color="#E54D2E" weight="fill" />
                  <span className="font-display font-bold text-sm">AI AutoFix</span>
                </div>
                <button onClick={() => setAutofix("")} className="text-[#71717A] hover:text-white"><X size={14} /></button>
              </div>
              <pre className="font-mono text-xs whitespace-pre-wrap text-[#EDEDED] leading-relaxed max-h-[400px] overflow-auto" data-testid="autofix-output">{autofix}{fixing && <span className="blink text-[#E54D2E]">█</span>}</pre>
            </div>
          )}
          <div className="surface p-5 space-y-3 text-sm">
            <div>
              <div className="micro-label">// status</div>
              <div className="mt-1"><StatusBadge status={run.status} /></div>
            </div>
            {run.failed_stage && (
              <div>
                <div className="micro-label">// failed at</div>
                <div className="mt-1 font-mono text-[#E54D2E]">{run.failed_stage}</div>
              </div>
            )}
            <div>
              <div className="micro-label">// repo</div>
              <div className="mt-1 font-mono text-xs">{run.repo_name}</div>
            </div>
            {run.finished_at && (
              <div>
                <div className="micro-label">// finished</div>
                <div className="mt-1 text-xs">{formatDistanceToNow(new Date(run.finished_at), { addSuffix: true })}</div>
              </div>
            )}
          </div>

          {run.status === "failed" && !autofix && (
            <div className="surface p-5 border-l-2 border-[#E54D2E]">
              <div className="font-display font-bold text-sm">Run failed</div>
              <div className="text-xs text-[#A1A1AA] mt-1">Forge can analyze logs and suggest a fix — and patch the pipeline.</div>
              <button onClick={requestAutofix} disabled={fixing} data-testid="autofix-btn-side" className="mt-4 btn-primary text-xs inline-flex items-center gap-2 w-full justify-center">
                {fixing ? <span className="ascii-loader" /> : <><Wrench size={12} weight="fill" /> Run AI AutoFix</>}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
