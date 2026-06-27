import React, { useEffect, useState, useRef } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Lightning, FloppyDisk, Copy, Cpu, ArrowsClockwise } from "@phosphor-icons/react";
import { toast } from "sonner";
import api, { API } from "@/lib/api";

const CLOUDS = ["aws", "gcp", "azure", "oracle", "cloudflare", "on-prem"];
const PLATFORMS = [
  { id: "github-actions", label: "GitHub Actions", file: ".github/workflows/ci.yml" },
  { id: "gitlab-ci", label: "GitLab CI", file: ".gitlab-ci.yml" },
  { id: "jenkins", label: "Jenkins", file: "Jenkinsfile" },
  { id: "bitbucket", label: "Bitbucket Pipelines", file: "bitbucket-pipelines.yml" },
];
const STRATEGIES = ["rolling", "blue-green", "canary", "recreate"];

export default function PipelineGenerator() {
  const location = useLocation();
  const navigate = useNavigate();
  const [repos, setRepos] = useState([]);
  const [models, setModels] = useState([]);
  const [form, setForm] = useState({
    repo_id: location.state?.repo_id || "",
    target_platform: "github-actions",
    cloud_target: "aws",
    deploy_strategy: "rolling",
    test_coverage: 80,
    enable_security: true,
    enable_monitoring: true,
    model: "claude-sonnet-4-5-20250929",
    provider: "anthropic",
    extra_requirements: "",
  });
  const [output, setOutput] = useState("");
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const abortRef = useRef(null);
  const outputRef = useRef(null);

  useEffect(() => {
    api.get("/repos").then(({ data }) => {
      setRepos(data);
      if (!form.repo_id && data.length) setForm((f) => ({ ...f, repo_id: data[0].id }));
    });
    api.get("/models").then(({ data }) => setModels(data.models));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (outputRef.current) outputRef.current.scrollTop = outputRef.current.scrollHeight;
  }, [output]);

  const setModel = (id) => {
    const m = models.find((x) => x.id === id);
    if (m) setForm((f) => ({ ...f, model: m.id, provider: m.provider }));
  };

  const generate = async (e) => {
    e?.preventDefault();
    if (!form.repo_id) { toast.error("Pick a repository"); return; }
    setOutput("");
    setGenerating(true);

    const token = localStorage.getItem("forge_token");
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const res = await fetch(`${API}/pipelines/generate`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(form),
        signal: ctrl.signal,
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || "Generation failed");
      }
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
          const line = ev.trim();
          if (!line.startsWith("data:")) continue;
          try {
            const d = JSON.parse(line.slice(5).trim());
            if (d.delta) setOutput((o) => o + d.delta);
            if (d.error) toast.error(d.error);
          } catch (e) { /* ignore */ }
        }
      }
      toast.success("Pipeline generated");
    } catch (err) {
      if (err.name !== "AbortError") toast.error(err.message);
    } finally {
      setGenerating(false);
    }
  };

  const save = async () => {
    if (!output.trim()) { toast.error("Generate first"); return; }
    setSaving(true);
    try {
      const repo = repos.find((r) => r.id === form.repo_id);
      const cleaned = output.replace(/^```[a-zA-Z]*\n?/g, "").replace(/```\s*$/g, "").trim();
      const { data } = await api.post("/pipelines", {
        repo_id: form.repo_id,
        name: `${repo?.name || "pipeline"}-${form.target_platform}`,
        target_platform: form.target_platform,
        cloud_target: form.cloud_target,
        deploy_strategy: form.deploy_strategy,
        yaml_content: cleaned,
        model: form.model,
        provider: form.provider,
        stages: ["checkout", "install", "lint", "test", "security_scan", "build", "deploy", "rollback"],
      });
      toast.success("Pipeline saved");
      navigate(`/app/pipelines/${data.id}`);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const copyOutput = () => {
    navigator.clipboard.writeText(output);
    toast.success("Copied");
  };

  const platform = PLATFORMS.find((p) => p.id === form.target_platform);

  return (
    <div className="space-y-6">
      <Link to="/app/pipelines" className="text-xs text-[#71717A] hover:text-white inline-flex items-center gap-1"><ArrowLeft size={12} /> back</Link>
      <header>
        <div className="micro-label mb-2">// ai pipeline generator</div>
        <h1 className="font-display font-black text-4xl tracking-tighter">New pipeline</h1>
        <p className="text-[#A1A1AA] text-sm mt-2">Claude analyzes your repo and emits production-grade YAML.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[400px_1fr] gap-6">
        {/* CONFIG */}
        <form onSubmit={generate} className="surface p-5 space-y-5">
          <Field label="// repository">
            <select data-testid="gen-repo-select" value={form.repo_id} onChange={(e) => setForm({ ...form, repo_id: e.target.value })} className="input">
              <option value="">— pick a repo —</option>
              {repos.map((r) => <option key={r.id} value={r.id}>{r.full_name}</option>)}
            </select>
            {repos.length === 0 && (
              <Link to="/app/repos/connect" className="text-xs text-[#E54D2E] mt-2 inline-block">+ connect a repo first</Link>
            )}
          </Field>

          <Field label="// target ci platform">
            <div className="grid grid-cols-2 gap-1">
              {PLATFORMS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  data-testid={`platform-${p.id}`}
                  onClick={() => setForm({ ...form, target_platform: p.id })}
                  className={`text-xs py-2 border ${form.target_platform === p.id ? "border-[#E54D2E] bg-[#E54D2E]/5 text-white" : "border-[#262626] text-[#A1A1AA] hover:border-[#3a3a3a]"}`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </Field>

          <Field label="// cloud target">
            <select data-testid="gen-cloud-select" value={form.cloud_target} onChange={(e) => setForm({ ...form, cloud_target: e.target.value })} className="input">
              {CLOUDS.map((c) => <option key={c} value={c}>{c.toUpperCase()}</option>)}
            </select>
          </Field>

          <Field label="// deploy strategy">
            <select data-testid="gen-strategy-select" value={form.deploy_strategy} onChange={(e) => setForm({ ...form, deploy_strategy: e.target.value })} className="input">
              {STRATEGIES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>

          <Field label={`// min test coverage: ${form.test_coverage}%`}>
            <input data-testid="gen-coverage" type="range" min={50} max={100} value={form.test_coverage}
                   onChange={(e) => setForm({ ...form, test_coverage: +e.target.value })}
                   className="w-full accent-[#E54D2E]" />
          </Field>

          <div className="space-y-2">
            <Toggle label="Enable Snyk + Trivy security scans" checked={form.enable_security} onChange={(v) => setForm({ ...form, enable_security: v })} testid="gen-security" />
            <Toggle label="Enable Prometheus / OTel hooks" checked={form.enable_monitoring} onChange={(v) => setForm({ ...form, enable_monitoring: v })} testid="gen-monitoring" />
          </div>

          <Field label="// ai model">
            <select data-testid="gen-model-select" value={form.model} onChange={(e) => setModel(e.target.value)} className="input">
              {models.map((m) => <option key={m.id} value={m.id}>{m.label}{m.default ? " · default" : ""}</option>)}
            </select>
          </Field>

          <Field label="// extra requirements">
            <textarea
              data-testid="gen-extra"
              value={form.extra_requirements}
              onChange={(e) => setForm({ ...form, extra_requirements: e.target.value })}
              rows={3}
              placeholder="e.g. use pnpm; cache node_modules; notify Slack on failure"
              className="input resize-none"
            />
          </Field>

          <button type="submit" disabled={generating} data-testid="gen-submit-btn" className="btn-primary w-full inline-flex items-center justify-center gap-2 py-3">
            {generating ? <><span className="ascii-loader" /> generating…</> : <><Lightning size={14} weight="fill" /> Generate pipeline</>}
          </button>
        </form>

        {/* OUTPUT */}
        <div className="surface-panel overflow-hidden flex flex-col min-h-[500px]">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#262626] bg-[#0a0a0a]">
            <div className="flex items-center gap-2 font-mono text-xs text-[#A1A1AA]">
              <Cpu size={12} weight="duotone" color="#E54D2E" />
              <span>{platform?.file || "pipeline.yml"}</span>
              {generating && <span className="text-[#E54D2E] ml-2">● streaming</span>}
            </div>
            <div className="flex items-center gap-2">
              <button onClick={copyOutput} disabled={!output} data-testid="gen-copy-btn" className="btn-ghost text-xs inline-flex items-center gap-1">
                <Copy size={12} /> copy
              </button>
              <button onClick={save} disabled={!output || saving} data-testid="gen-save-btn" className="btn-primary text-xs inline-flex items-center gap-1 px-3 py-1.5">
                {saving ? <span className="ascii-loader" /> : <><FloppyDisk size={12} weight="fill" /> save</>}
              </button>
            </div>
          </div>
          <pre ref={outputRef} className="flex-1 overflow-auto p-5 font-mono text-xs leading-relaxed text-[#EDEDED] bg-black whitespace-pre-wrap" data-testid="gen-output">
            {output || (
              <span className="text-[#71717A]">
                # Generated pipeline will stream here…{"\n"}
                # 1. Pick a repository on the left{"\n"}
                # 2. Choose target CI platform, cloud, and strategy{"\n"}
                # 3. Hit &quot;Generate pipeline&quot;
              </span>
            )}
            {generating && <span className="blink text-[#E54D2E]">█</span>}
          </pre>
        </div>
      </div>
    </div>
  );
}

const Field = ({ label, children }) => (
  <div>
    <div className="micro-label mb-2">{label}</div>
    {children}
  </div>
);

const Toggle = ({ label, checked, onChange, testid }) => (
  <button type="button" onClick={() => onChange(!checked)} data-testid={testid} className="w-full flex items-center justify-between py-2 text-sm text-[#A1A1AA] hover:text-white">
    <span>{label}</span>
    <span className={`w-9 h-5 border ${checked ? "border-[#E54D2E] bg-[#E54D2E]/10" : "border-[#262626]"} relative`}>
      <span className={`absolute top-0.5 ${checked ? "right-0.5 bg-[#E54D2E]" : "left-0.5 bg-[#71717A]"} w-3.5 h-3.5 transition-all`} />
    </span>
  </button>
);
