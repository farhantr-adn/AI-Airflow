import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Cube, ArrowsClockwise, ArrowSquareOut } from "@phosphor-icons/react";
import { toast } from "sonner";
import api from "@/api/client";
import { StatusBadge } from "@/components/StatusBadge";
import { formatDistanceToNow } from "date-fns";

export default function Deployments() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => api.get("/deployments").then(({ data }) => { setItems(data); setLoading(false); }).catch(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const rollback = async (id) => {
    if (!window.confirm("Roll back this deployment to the previous live revision?")) return;
    try {
      const { data } = await api.post(`/deployments/${id}/rollback`);
      toast.success(data.rollback_to ? `Rolled back to ${data.rollback_to}` : "Rolled back (no prior revision)");
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Rollback failed");
    }
  };

  return (
    <div className="space-y-6">
      <header>
        <div className="micro-label mb-2">// deployments</div>
        <h1 className="font-display font-black text-4xl tracking-tighter">Deployments</h1>
        <p className="text-[#A1A1AA] text-sm mt-2">Every successful build that landed in production. Roll back any with one click.</p>
      </header>

      {loading ? (
        <div className="text-[#71717A] font-mono text-sm"><span className="ascii-loader" /> loading...</div>
      ) : items.length === 0 ? (
        <div className="surface p-16 text-center">
          <Cube size={40} className="mx-auto text-[#262626]" />
          <div className="mt-4 font-display font-bold text-xl">No deployments yet</div>
          <div className="text-sm text-[#A1A1AA] mt-2">Successful pipeline runs will produce deployments here.</div>
        </div>
      ) : (
        <div className="surface overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[#0a0a0a]">
              <tr className="text-left border-b border-[#262626]">
                <th className="micro-label p-4">repo</th>
                <th className="micro-label p-4">version</th>
                <th className="micro-label p-4">env</th>
                <th className="micro-label p-4">cloud · strategy</th>
                <th className="micro-label p-4">status</th>
                <th className="micro-label p-4">deployed</th>
                <th className="micro-label p-4 text-right">actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((d) => (
                <tr key={d.id} className="border-b border-[#1A1A1A] hover:bg-[#121212]" data-testid={`deployment-row-${d.id}`}>
                  <td className="p-4 font-mono text-xs">{d.repo_name}</td>
                  <td className="p-4 font-mono text-xs">{d.version}</td>
                  <td className="p-4"><span className="badge">{d.environment}</span></td>
                  <td className="p-4 font-mono text-xs text-[#A1A1AA]">{d.cloud_target.toUpperCase()} · {d.strategy}</td>
                  <td className="p-4"><StatusBadge status={d.status} /></td>
                  <td className="p-4 text-xs text-[#71717A]">{formatDistanceToNow(new Date(d.deployed_at), { addSuffix: true })}</td>
                  <td className="p-4 text-right">
                    <div className="flex items-center gap-2 justify-end">
                      <a href={d.url} target="_blank" rel="noreferrer" className="btn-ghost text-xs inline-flex items-center gap-1">
                        <ArrowSquareOut size={12} /> open
                      </a>
                      {!d.rolled_back && d.status === "live" && (
                        <button
                          onClick={() => rollback(d.id)}
                          data-testid={`rollback-btn-${d.id}`}
                          className="btn-secondary text-xs inline-flex items-center gap-1 text-[#FFC53D] border-[#FFC53D]/40 hover:bg-[#FFC53D]/10"
                        >
                          <ArrowsClockwise size={12} /> rollback
                        </button>
                      )}
                      {d.rolled_back && <span className="text-xs text-[#71717A] font-mono">→ {d.rollback_to}</span>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
