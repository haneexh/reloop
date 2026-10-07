import React from "react";

interface PpriMeterProps {
  score: number;
  level: string;
}

export function PpriMeter({ score, level }: PpriMeterProps) {
  // Clamp score between 0.0 and 10.0
  const validScore = Math.max(0, Math.min(10, Number(score) || 0));
  const degrees = Math.round((validScore / 10) * 180);

  return (
    <div className="rounded-sm border border-[#d8ddd7] bg-white p-6 space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-widest text-[#2e7d57]">
          PP-RI Score
        </span>
        <span className="rounded-sm border border-[#e5c98a] bg-[#fff8e8] px-2 py-0.5 text-[10px] font-medium tracking-wider text-[#8b631a] uppercase">
          Proposed Framework
        </span>
      </div>

      <div
        className="gauge"
        style={{ "--gauge-degrees": `${degrees}deg` } as React.CSSProperties}
      >
        <div className="gauge-inner">
          <strong className="text-4xl text-[#151817]">
            {validScore.toFixed(1)}
          </strong>
          <span className="text-xs text-[#6b746e]">/ 10</span>
        </div>
      </div>

      <div className="flex justify-between text-[9px] font-mono font-semibold tracking-widest text-[#6b746e] px-2">
        <span>LOW (0-4.9)</span>
        <span>MODERATE (5.0-7.4)</span>
        <span>HIGH (7.5-10.0)</span>
      </div>

      <div className="flex items-baseline justify-between border-t border-[#d8ddd7] pt-4">
        <strong className="font-display text-base font-semibold text-[#151817]">
          {level}
        </strong>
        <span className="text-[11px] text-[#6b746e]">
          Post-Purchase Repairability Index
        </span>
      </div>

      <p className="text-[11px] leading-relaxed text-[#6b746e] border-t border-[#f4f5f1] pt-3">
        Formulaic composite score evaluating repair cost ratio (45%), physical wear (35%), and hardware age (20%) against replacement baselines.
      </p>
    </div>
  );
}
