import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MagnifyingGlass, GitBranch, FlowArrow, Cube, House, Plus, ShieldCheck } from "@phosphor-icons/react";

const items = [
  { id: "dash", label: "Dashboard", to: "/app", icon: House, kind: "Navigation" },
  { id: "repos", label: "Repositories", to: "/app/repos", icon: GitBranch, kind: "Navigation" },
  { id: "pipes", label: "Pipelines", to: "/app/pipelines", icon: FlowArrow, kind: "Navigation" },
  { id: "deps", label: "Deployments", to: "/app/deployments", icon: Cube, kind: "Navigation" },
  { id: "sec", label: "Security", to: "/app/security", icon: ShieldCheck, kind: "Navigation" },
  { id: "new-pipe", label: "New pipeline", to: "/app/pipelines/new", icon: Plus, kind: "Action" },
  { id: "connect", label: "Connect a repo", to: "/app/repos/connect", icon: Plus, kind: "Action" },
];

export default function CommandPalette({ onClose }) {
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const navigate = useNavigate();

  const filtered = items.filter((it) => it.label.toLowerCase().includes(q.toLowerCase()));

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, filtered.length - 1)); }
      if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
      if (e.key === "Enter") {
        e.preventDefault();
        const sel = filtered[active];
        if (sel) { navigate(sel.to); onClose(); }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, navigate, active, filtered]);

  useEffect(() => { setActive(0); }, [q]);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm grid place-items-start pt-[15vh]" onClick={onClose} data-testid="cmdk-overlay">
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-xl bg-black/80 backdrop-blur-xl border border-white/10 shadow-2xl">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10">
          <MagnifyingGlass size={18} className="text-[#71717A]" />
          <input
            autoFocus
            data-testid="cmdk-input"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search commands, repos, pipelines..."
            className="flex-1 bg-transparent outline-none text-sm placeholder:text-[#71717A]"
          />
          <span className="font-mono text-xs text-[#71717A]">ESC</span>
        </div>
        <div className="max-h-[300px] overflow-y-auto p-2">
          {filtered.length === 0 && <div className="px-3 py-6 text-center text-sm text-[#71717A]">No results</div>}
          {filtered.map((it, i) => (
            <button
              key={it.id}
              data-testid={`cmdk-item-${it.id}`}
              onClick={() => { navigate(it.to); onClose(); }}
              onMouseEnter={() => setActive(i)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm text-left ${
                i === active ? "bg-white/5 text-white" : "text-[#A1A1AA]"
              }`}
            >
              <it.icon size={16} weight="duotone" />
              <span className="flex-1">{it.label}</span>
              <span className="micro-label">{it.kind}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
