import React, { useEffect, useState } from "react";
import { User, Key, Cpu, Cloud, ShieldCheck } from "@phosphor-icons/react";
import api from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function Settings() {
  const { user } = useAuth();
  const [models, setModels] = useState([]);
  const [audit, setAudit] = useState([]);

  useEffect(() => {
    api.get("/models").then(({ data }) => setModels(data.models));
    api.get("/audit-logs").then(({ data }) => setAudit(data));
  }, []);

  return (
    <div className="space-y-6">
      <header>
        <div className="micro-label mb-2">// settings</div>
        <h1 className="font-display font-black text-4xl tracking-tighter">Settings</h1>
        <p className="text-[#A1A1AA] text-sm mt-2">Account, AI models, credentials, and audit trail.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="surface p-5 lg:col-span-1">
          <div className="flex items-center gap-2 mb-4">
            <User size={16} color="#E54D2E" weight="duotone" />
            <h2 className="font-display font-bold">Account</h2>
          </div>
          <div className="space-y-3 text-sm">
            <Row label="name" value={user?.name} />
            <Row label="email" value={user?.email} mono />
            <Row label="role" value={user?.role} mono />
            <Row label="provider" value={user?.auth_provider} mono />
            <Row label="user_id" value={user?.user_id} mono small />
          </div>
        </div>

        <div className="surface p-5 lg:col-span-2">
          <div className="flex items-center gap-2 mb-4">
            <Cpu size={16} color="#E54D2E" weight="duotone" />
            <h2 className="font-display font-bold">AI models</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {models.map((m) => (
              <div key={m.id} className={`border ${m.default ? "border-[#E54D2E] bg-[#E54D2E]/5" : "border-[#262626]"} p-3`} data-testid={`model-${m.id}`}>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm">{m.label}</span>
                  {m.default && <span className="badge badge-success">default</span>}
                </div>
                <div className="text-[10px] text-[#71717A] mt-1 font-mono">{m.provider} · {m.id}</div>
              </div>
            ))}
          </div>
          <div className="mt-4 text-xs text-[#71717A]">Models are powered by the Emergent Universal LLM Key. No keys needed.</div>
        </div>

        <div className="surface p-5 lg:col-span-3">
          <div className="flex items-center gap-2 mb-4">
            <Cloud size={16} color="#E54D2E" weight="duotone" />
            <h2 className="font-display font-bold">Integrations</h2>
            <span className="badge badge-warning ml-auto">mocked in MVP</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
            {[
              ["GitHub OAuth", "Real public-repo fetch · OAuth flow mocked"],
              ["Snyk", "SCA scans mocked"],
              ["Trivy", "Container scans mocked"],
              ["AWS / GCP / Azure", "Deploys simulated"],
              ["Prometheus", "Metrics hooks injected into YAML"],
              ["Grafana", "Dashboard templates"],
              ["ELK", "Log shipping mocked"],
              ["Vault", "Secrets manager (planned)"],
            ].map(([n, d]) => (
              <div key={n} className="border border-[#262626] p-3">
                <div className="text-sm font-medium">{n}</div>
                <div className="text-xs text-[#71717A] mt-1">{d}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="surface p-5 lg:col-span-3">
          <div className="flex items-center gap-2 mb-4">
            <ShieldCheck size={16} color="#E54D2E" weight="duotone" />
            <h2 className="font-display font-bold">Audit log</h2>
          </div>
          <div className="space-y-1 max-h-[400px] overflow-y-auto font-mono text-xs">
            {audit.length === 0 && <div className="text-[#71717A]">No events yet.</div>}
            {audit.map((a) => (
              <div key={a.id} className="flex items-center gap-3 border-b border-[#1A1A1A] py-2" data-testid={`audit-${a.id}`}>
                <span className="text-[#71717A] w-44">{new Date(a.ts).toISOString().replace("T", " ").slice(0, 19)}</span>
                <span className="text-[#E54D2E] w-44">{a.action}</span>
                <span className="text-[#A1A1AA] flex-1 truncate">{JSON.stringify(a.meta)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const Row = ({ label, value, mono, small }) => (
  <div>
    <div className="micro-label">{label}</div>
    <div className={`mt-1 ${mono ? "font-mono" : ""} ${small ? "text-xs" : ""}`}>{value || "—"}</div>
  </div>
);
