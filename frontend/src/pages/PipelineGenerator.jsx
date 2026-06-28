import React, { useEffect, useState, useRef } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Lightning, FloppyDisk, Copy, Cpu } from "@phosphor-icons/react";
import { toast } from "sonner";
import api, { API } from "@/api/client";
import { catalogService } from "@/api";
import { CloudLogo, ProviderLogo, CLOUD_LABEL } from "@/components/Logos";

const PLATFORMS = [
  { id: "github-actions", label: "GitHub Actions", file: ".github/workflows/ci.yml" },
  { id: "gitlab-ci", label: "GitLab CI", file: ".gitlab-ci.yml" },
  { id: "jenkins", label: "Jenkins", file: "Jenkinsfile" },
  { id: "bitbucket", label: "Bitbucket Pipelines", file: "bitbucket-pipelines.yml" },
];

const OUTPUT_FORMATS = [
  { id: "yaml", label: "YAML", file: (p) => ({ "github-actions": ".github/workflows/ci.yml", "gitlab-ci": ".gitlab-ci.yml", "jenkins": "Jenkinsfile", "bitbucket": "bitbucket-pipelines.yml" }[p] || "pipeline.yml"), desc: "Native pipeline file for the CI platform" },
  { id: "scripts", label: "Scripts", file: () => "Makefile + scripts/*.sh", desc: "POSIX shell scripts + Makefile orchestrator" },
  { id: "terraform", label: "Terraform", file: () => "main.tf + variables.tf + outputs.tf", desc: "HCL provisioning the CI/CD infra" },
  { id: "cloudformation", label: "CloudFormation", file: () => "cloudformation/pipeline.yaml", desc: "AWS CFN: CodePipeline + CodeBuild + ECR" },
];

const CLOUD_ORDER = ["aws", "gcp", "azure", "oracle", "cloudflare", "on-prem"];

export default function PipelineGenerator() {
  const location = useLocation();
  const navigate = useNavigate();
  const [repos, setRepos] = useState([]);
  const [providers, setProviders] = useState([]);
  const [cloudServices, setCloudServices] = useState({});
  const [strategies, setStrategies] = useState([]);
  const [userKeys, setUserKeys] = useState([]);
  const [form, setForm] = useState({
    repo_id: location.state?.repo_id || "",
    target_platform: "github-actions",
    cloud_target: "aws",
    cloud_service: "ecs",
    deploy_strategy: location.state?.deploy_strategy || "rolling",
    test_coverage: 80,
    enable_security: true,
    enable_monitoring: true,
    output_format: "yaml",
    provider: "anthropic",
    model: "claude-sonnet-4-5-20250929",
    extra_requirements: "",
    api_key_id: "",
    custom_model: "",
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
    catalogService.aiProviders().then(setProviders);
    catalogService.cloudServices().then(setCloudServices);
    catalogService.strategies().then(setStrategies);
    api.get("/api-keys").then(({ data }) => setUserKeys(data)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (outputRef.current) outputRef.current.scrollTop = outputRef.current.scrollHeight;
  }, [output]);

  // When cloud target changes, reset cloud_service to the first option of the new cloud
  useEffect(() => {
    const list = cloudServices[form.cloud_target] || [];
    if (list.length && !list.find((s) => s.id === form.cloud_service)) {
      setForm((f) => ({ ...f, cloud_service: list[0].id }));
    }
  }, [form.cloud_target, cloudServices]); // eslint-disable-line react-hooks/exhaustive-deps

  const setProvider = (pid) => {
    const p = providers.find((x) => x.id === pid);
    if (!p) return;
    setForm((f) => ({ ...f, provider: pid, model: p.models[0]?.id || f.model }));
  };

  const setModelId = (mid) => setForm((f) => ({ ...f, model: mid }));

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
  const outputFormat = OUTPUT_FORMATS.find((f) => f.id === form.output_format);
  const outputFileLabel = outputFormat?.file(form.target_platform) || platform?.file || "pipeline.yml";

  return (
    <div className="space-y-6">
      <Link to="/app/pipelines" className="text-xs text-[#71717A] hover:text-white inline-flex items-center gap-1"><ArrowLeft size={12} /> back</Link>
      <header>
        <div className="micro-label mb-2">// ai pipeline generator</div>
        <h1 className="font-display font-black text-4xl tracking-tighter">New pipeline</h1>
        <p className="text-[#A1A1AA] text-sm mt-2">AI analyzes your repo and emits production-grade YAML, shell scripts, Terraform, or CloudFormation.</p>
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

          <Field label="// output format">
            <div className="grid grid-cols-2 gap-1">
              {OUTPUT_FORMATS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  data-testid={`format-${f.id}`}
                  onClick={() => setForm({ ...form, output_format: f.id })}
                  className={`text-xs py-2 border ${form.output_format === f.id ? "border-[#E54D2E] bg-[#E54D2E]/5 text-white" : "border-[#262626] text-[#A1A1AA] hover:border-[#3a3a3a]"}`}
                  title={f.desc}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <div className="text-[10px] text-[#71717A] mt-1.5 font-mono">{OUTPUT_FORMATS.find((f) => f.id === form.output_format)?.desc}</div>
          </Field>

          <Field label="// cloud target">
            <div className="grid grid-cols-3 gap-1" data-testid="cloud-grid">
              {CLOUD_ORDER.map((c) => (
                <button
                  key={c}
                  type="button"
                  data-testid={`cloud-${c}`}
                  onClick={() => setForm({ ...form, cloud_target: c })}
                  className={`flex flex-col items-center justify-center gap-1 py-3 border transition-colors ${
                    form.cloud_target === c
                      ? "border-[#E54D2E] bg-[#E54D2E]/5"
                      : "border-[#262626] hover:border-[#3a3a3a]"
                  }`}
                  title={CLOUD_LABEL[c]}
                >
                  <CloudLogo id={c} size={22} mono={form.cloud_target !== c} />
                  <span className={`text-[10px] font-mono ${form.cloud_target === c ? "text-white" : "text-[#71717A]"}`}>{CLOUD_LABEL[c]}</span>
                </button>
              ))}
            </div>
          </Field>

          <Field label={`// service (${CLOUD_LABEL[form.cloud_target]})`}>
            <select
              data-testid="gen-cloud-service"
              value={form.cloud_service}
              onChange={(e) => setForm({ ...form, cloud_service: e.target.value })}
              className="input"
            >
              {(cloudServices[form.cloud_target] || []).map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
          </Field>

          <Field label="// deploy strategy">
            <select data-testid="gen-strategy-select" value={form.deploy_strategy} onChange={(e) => setForm({ ...form, deploy_strategy: e.target.value })} className="input">
              {strategies.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
            <Link to="/app/strategies" className="text-[10px] text-[#E54D2E] mt-1 inline-block">// not sure? compare strategies →</Link>
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

          <Field label="// ai engine">
            <select
              data-testid="gen-key-source"
              value={form.api_key_id}
              onChange={(e) => setForm({ ...form, api_key_id: e.target.value })}
              className="input"
            >
              <option value="">Emergent (built-in · default)</option>
              {userKeys.map((k) => (
                <option key={k.id} value={k.id}>BYOK · {k.label} ({k.mode})</option>
              ))}
            </select>
            {userKeys.length === 0 && (
              <Link to="/app/settings" className="text-[10px] text-[#E54D2E] mt-1 inline-block">+ add your own OpenAI / Anthropic / LLaMA-3 key</Link>
            )}
          </Field>

          {form.api_key_id ? (
            <Field label="// model id (BYOK)">
              <input
                data-testid="gen-custom-model"
                value={form.custom_model}
                onChange={(e) => setForm({ ...form, custom_model: e.target.value })}
                className="input font-mono text-xs"
                placeholder={userKeys.find((k) => k.id === form.api_key_id)?.default_model || "gpt-4o / claude-3-5-sonnet-20241022 / llama-3.1-70b-versatile"}
              />
              <div className="text-[10px] text-[#71717A] mt-1">Leave empty to use the key&apos;s default model.</div>
            </Field>
          ) : (
            <>
              <Field label="// ai provider">
                <div className="grid grid-cols-4 gap-1" data-testid="provider-grid">
                  {providers.filter((p) => p.emergent).map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      data-testid={`provider-${p.id}`}
                      onClick={() => setProvider(p.id)}
                      className={`flex flex-col items-center justify-center gap-1 py-3 border transition-colors ${
                        form.provider === p.id
                          ? "border-[#E54D2E] bg-[#E54D2E]/5"
                          : "border-[#262626] hover:border-[#3a3a3a]"
                      }`}
                      title={p.label}
                    >
                      <ProviderLogo id={p.icon} size={20} mono={form.provider !== p.id} />
                      <span className={`text-[10px] font-mono ${form.provider === p.id ? "text-white" : "text-[#71717A]"}`}>{p.label.split(" ")[0]}</span>
                    </button>
                  ))}
                </div>
              </Field>

              <Field label="// model version">
                <select
                  data-testid="gen-model-select"
                  value={form.model}
                  onChange={(e) => setModelId(e.target.value)}
                  className="input"
                >
                  {(providers.find((p) => p.id === form.provider)?.models || []).map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}{m.default ? " · default" : ""}
                    </option>
                  ))}
                </select>
              </Field>

              {/* LLaMA hint - only emergent providers shown above; LLaMA is BYOK */}
              {providers.find((p) => p.id === "llama") && (
                <div className="text-[10px] text-[#71717A] -mt-2">
                  Want <span className="inline-flex items-center gap-1"><ProviderLogo id="meta" size={10} /> LLaMA-3</span>?{" "}
                  <Link to="/app/settings" className="text-[#E54D2E] hover:underline">add a Groq / OpenRouter key</Link>.
                </div>
              )}
            </>
          )}

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
              <span>{outputFileLabel}</span>
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
