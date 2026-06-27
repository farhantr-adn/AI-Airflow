import React, { useState, useEffect } from "react";
import { NavLink, Outlet, useNavigate, Link } from "react-router-dom";
import {
  House, GitBranch, FlowArrow, Cube, ShieldCheck, Gear, SignOut, Lightning, MagnifyingGlass, Terminal, Plus,
} from "@phosphor-icons/react";
import { useAuth } from "@/hooks/useAuth";
import CommandPalette from "@/components/CommandPalette";

const navItems = [
  { to: "/app", label: "Dashboard", icon: House, end: true, testid: "nav-dashboard" },
  { to: "/app/repos", label: "Repositories", icon: GitBranch, testid: "nav-repos" },
  { to: "/app/pipelines", label: "Pipelines", icon: FlowArrow, testid: "nav-pipelines" },
  { to: "/app/deployments", label: "Deployments", icon: Cube, testid: "nav-deployments" },
  { to: "/app/security", label: "Security", icon: ShieldCheck, testid: "nav-security" },
  { to: "/app/settings", label: "Settings", icon: Gear, testid: "nav-settings" },
];

export default function AppShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const doLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#EDEDED] grid grid-cols-[220px_1fr]">
      {/* SIDEBAR */}
      <aside className="border-r border-[#1A1A1A] bg-[#0A0A0A] flex flex-col">
        <Link to="/app" className="px-5 h-16 flex items-center gap-2 border-b border-[#1A1A1A]" data-testid="sidebar-logo">
          <div className="w-7 h-7 bg-[#E54D2E] grid place-items-center"><Lightning weight="fill" size={16} color="#fff" /></div>
          <span className="font-display font-black text-lg tracking-tighter">FORGE</span>
        </Link>
        <nav className="flex-1 px-3 py-5 space-y-0.5">
          <div className="micro-label px-2 py-2">// workspace</div>
          {navItems.map((it) => (
            <NavLink
              key={it.to}
              to={it.to}
              end={it.end}
              data-testid={it.testid}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 text-sm transition-colors border-l-2 ${
                  isActive
                    ? "bg-[#1A1A1A] text-white border-[#E54D2E]"
                    : "text-[#A1A1AA] hover:text-white hover:bg-[#121212] border-transparent"
                }`
              }
            >
              <it.icon size={16} weight="duotone" />
              {it.label}
            </NavLink>
          ))}

          <div className="mt-6 px-2">
            <Link
              to="/app/pipelines/new"
              data-testid="sidebar-new-pipeline-btn"
              className="btn-primary w-full inline-flex items-center justify-center gap-2 text-xs py-2.5"
            >
              <Plus size={14} weight="bold" /> New pipeline
            </Link>
          </div>
        </nav>
        <div className="p-3 border-t border-[#1A1A1A] space-y-2">
          <button
            data-testid="sidebar-cmdk-btn"
            onClick={() => setPaletteOpen(true)}
            className="w-full flex items-center justify-between gap-2 px-3 py-2 text-xs text-[#71717A] border border-[#262626] hover:border-[#E54D2E] hover:text-white transition-colors"
          >
            <span className="flex items-center gap-2"><MagnifyingGlass size={14} /> Search</span>
            <span className="font-mono">⌘K</span>
          </button>
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="w-8 h-8 bg-[#1A1A1A] border border-[#262626] grid place-items-center font-mono text-xs">
              {user?.name?.[0]?.toUpperCase() || "?"}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs text-white truncate" data-testid="sidebar-user-name">{user?.name}</div>
              <div className="text-[10px] text-[#71717A] truncate">{user?.email}</div>
            </div>
            <button onClick={doLogout} data-testid="sidebar-logout-btn" className="text-[#71717A] hover:text-[#E54D2E] transition-colors p-1">
              <SignOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* MAIN */}
      <main className="overflow-x-hidden">
        <div className="px-8 py-6 max-w-[1600px]">
          <Outlet />
        </div>
      </main>

      {paletteOpen && <CommandPalette onClose={() => setPaletteOpen(false)} />}
    </div>
  );
}
