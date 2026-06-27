import React from "react";
import { CheckCircle, XCircle, CircleNotch, Circle } from "@phosphor-icons/react";

const STAGE_META = {
  checkout: { label: "Checkout" },
  install: { label: "Install" },
  lint: { label: "Lint" },
  test: { label: "Test" },
  security_scan: { label: "Security" },
  build: { label: "Build" },
  deploy: { label: "Deploy" },
  rollback: { label: "Rollback", manual: true },
};

function statusClass(s) {
  if (s === "success") return "border-[#46A758] text-[#46A758] bg-[#46A758]/5";
  if (s === "failed") return "border-[#E54D2E] text-[#E54D2E] bg-[#E54D2E]/5";
  if (s === "running") return "border-white text-white bg-white/5";
  return "border-[#262626] text-[#71717A]";
}

function StageIcon({ s }) {
  if (s === "success") return <CheckCircle size={14} weight="fill" />;
  if (s === "failed") return <XCircle size={14} weight="fill" />;
  if (s === "running") return <CircleNotch size={14} className="animate-spin" />;
  return <Circle size={14} />;
}

export default function PipelineDAG({ stages = [], run = null }) {
  const items = stages.filter((s) => s !== "rollback");
  const rollback = stages.includes("rollback");

  const getStatus = (stage) => {
    if (!run) return "idle";
    return run.stage_status?.[stage] || (run.current_stage === stage ? "running" : "idle");
  };

  return (
    <div className="overflow-x-auto" data-testid="pipeline-dag">
      <div className="flex items-center gap-0 min-w-fit">
        {items.map((stage, i) => {
          const s = getStatus(stage);
          const next = items[i + 1] ? getStatus(items[i + 1]) : null;
          return (
            <React.Fragment key={stage}>
              <div className={`flex-shrink-0 border ${statusClass(s)} px-4 py-3 transition-all`} data-testid={`stage-${stage}`}>
                <div className="flex items-center gap-2 font-mono text-xs">
                  <StageIcon s={s} />
                  <span className="uppercase tracking-wider">{STAGE_META[stage]?.label || stage}</span>
                </div>
                {run?.stage_started?.[stage] && (
                  <div className="text-[10px] text-[#71717A] mt-1 font-mono">{stage === run.current_stage ? "running…" : s}</div>
                )}
              </div>
              {i < items.length - 1 && (
                <div className={`flex-shrink-0 h-px w-8 ${
                  next === "running" ? "bg-white pipe-running" :
                  next === "success" ? "bg-[#46A758]" :
                  next === "failed" ? "bg-[#E54D2E]" :
                  "bg-[#262626]"
                }`} />
              )}
            </React.Fragment>
          );
        })}
        {rollback && (
          <>
            <div className="flex-shrink-0 mx-4 text-[#71717A] font-mono text-xs">⤴</div>
            <div className="flex-shrink-0 border border-dashed border-[#FFC53D] text-[#FFC53D] bg-[#FFC53D]/5 px-4 py-3" data-testid="stage-rollback">
              <div className="flex items-center gap-2 font-mono text-xs">
                <Circle size={14} />
                <span className="uppercase tracking-wider">Rollback</span>
              </div>
              <div className="text-[10px] mt-1 font-mono text-[#71717A]">manual / on-fail</div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
