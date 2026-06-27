import React, { useEffect, useState } from "react";
import { ShieldCheck, Warning, MagnifyingGlass, Bug } from "@phosphor-icons/react";
import { toast } from "sonner";
import api from "@/lib/api";
import { formatDistanceToNow } from "date-fns";

export default function Security() {
  const [scans, setScans] = useState([]);
  const [repos, setRepos] = useState([]);
  const [scanning, setScanning] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const [s, r] = await Promise.all([api.get("/security/scans"), api.get("/repos")]);
    setScans(s.data);
    setRepos(r.data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const runScan = async (repoId) => {
    setScanning(repoId);
    try {
      await api.post(`/security/scan/${repoId}`);
      toast.success("Scan complete");
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Scan failed");
    } finally {
      setScanning("");
    }
  };

  return (
    <div className="space-y-6">
      <header>
        <div className="micro-label mb-2">// security</div>
        <h1 className="font-display font-black text-4xl tracking-tighter">Security</h1>
        <p className="text-[#A1A1AA] text-sm mt-2">Snyk SCA + Trivy container scans — auto-injected into every pipeline. <span className="badge badge-warning ml-2">scans mocked</span></p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="surface p-5">
          <div className="micro-label">// run a scan</div>
          <div className="mt-3 space-y-2 max-h-64 overflow-y-auto">
            {repos.length === 0 && <div className="text-xs text-[#71717A]">Connect a repo first.</div>}
            {repos.map((r) => (
              <div key={r.id} className="flex items-center justify-between text-sm border border-[#262626] px-3 py-2">
                <span className="font-mono text-xs truncate">{r.full_name}</span>
                <button onClick={() => runScan(r.id)} disabled={scanning === r.id} data-testid={`scan-${r.id}`} className="btn-secondary text-xs px-3 py-1 inline-flex items-center gap-1">
                  {scanning === r.id ? <span className="ascii-loader" /> : <><MagnifyingGlass size={11} /> scan</>}
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-2 space-y-4">
          {loading ? (
            <div className="text-[#71717A] font-mono text-sm"><span className="ascii-loader" /> loading...</div>
          ) : scans.length === 0 ? (
            <div className="surface p-16 text-center">
              <ShieldCheck size={40} className="mx-auto text-[#262626]" />
              <div className="mt-4 font-display font-bold text-xl">No scans yet</div>
              <div className="text-sm text-[#A1A1AA] mt-2">Run a scan on any connected repo to detect vulnerabilities.</div>
            </div>
          ) : scans.map((s) => (
            <div key={s.id} className="surface p-5" data-testid={`scan-result-${s.id}`}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="font-display font-bold">{s.repo_name}</div>
                  <div className="text-xs text-[#71717A] mt-0.5 font-mono">{s.tool} · {formatDistanceToNow(new Date(s.scanned_at), { addSuffix: true })}</div>
                </div>
                <div className="flex items-center gap-2">
                  {s.summary.high > 0 && <span className="badge badge-error">{s.summary.high} high</span>}
                  {s.summary.medium > 0 && <span className="badge badge-warning">{s.summary.medium} med</span>}
                  {s.summary.low > 0 && <span className="badge">{s.summary.low} low</span>}
                  {s.summary.total === 0 && <span className="badge badge-success">clean</span>}
                </div>
              </div>
              <div className="mt-4 space-y-2">
                {s.vulnerabilities.map((v) => (
                  <div key={v.cve} className="flex items-start gap-3 border border-[#1A1A1A] px-3 py-2 text-xs">
                    <Bug size={14} className={
                      v.severity === "high" ? "text-[#E54D2E]" :
                      v.severity === "medium" ? "text-[#FFC53D]" : "text-[#71717A]"
                    } weight="duotone" />
                    <div className="flex-1">
                      <div className="font-mono">{v.cve} <span className="text-[#71717A]">/</span> {v.package}</div>
                      <div className="text-[#A1A1AA] mt-0.5">{v.title}</div>
                    </div>
                    {v.fix_available && <span className="badge badge-success">fix avail</span>}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
