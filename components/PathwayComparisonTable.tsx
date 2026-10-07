import React from "react";
import type { PathwayComparison } from "@/lib/decisionEngine";

const ICON_MAP: Record<string, string> = {
  repair: "↻",
  reuse: "⟲",
  donate: "＋",
  resell: "↗",
  refurbish: "✦",
  recycle: "∞",
};

export function PathwayComparisonTable({
  comparisons,
}: {
  comparisons: PathwayComparison[];
}) {
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[#d8ddd7] pb-3">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#2e7d57] block">
            The Full Decision Set
          </span>
          <h2 className="text-xl font-bold font-display text-[#151817]">
            Compare all six pathways
          </h2>
        </div>
        <span className="text-xs text-[#6b746e] font-mono">
          Deterministic model · Live evaluated
        </span>
      </div>

      <div className="border border-[#d8ddd7] bg-white rounded-sm overflow-hidden">
        {/* Table Header */}
        <div className="hidden sm:grid sm:grid-cols-12 gap-3 px-4 py-2.5 bg-[#f4f5f1] border-b border-[#d8ddd7] text-[10px] font-bold uppercase tracking-wider text-[#6b746e]">
          <div className="col-span-5">Pathway</div>
          <div className="col-span-3">Economic View</div>
          <div className="col-span-2">CO2e Avoided</div>
          <div className="col-span-2">Viability Score</div>
        </div>

        {/* Table Rows */}
        <div className="divide-y divide-[#d8ddd7]">
          {comparisons.map((item) => {
            const isRec = item.isRecommended;
            const viabilityPct = Math.min(100, Math.max(0, item.viability * 10));

            return (
              <div
                key={item.action}
                className={`p-4 transition-colors ${
                  isRec
                    ? "bg-[#e6f2e8]/70 border-l-4 border-l-[#2e7d57]"
                    : "hover:bg-[#f4f5f1]/50"
                }`}
              >
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 sm:gap-4 items-center">
                  {/* Pathway Name & Badge */}
                  <div className="sm:col-span-5 flex items-start gap-3 min-w-0 pr-2">
                    <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-sm border border-[#d8ddd7] bg-white font-mono text-xs font-bold text-[#2e7d57] mt-0.5">
                      {ICON_MAP[item.action] || "•"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <strong className="font-display text-sm font-semibold capitalize text-[#151817]">
                          {item.title || item.action}
                        </strong>
                        {isRec && (
                          <span className="inline-flex items-center rounded-sm bg-[#2e7d57] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white whitespace-nowrap">
                            Recommended
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-[#6b746e] truncate">
                        {item.description}
                      </p>
                    </div>
                  </div>

                  {/* Economic View */}
                  <div className="sm:col-span-3 min-w-0 pr-2">
                    <div className="text-xs font-bold font-mono text-[#151817] whitespace-nowrap">
                      {item.economicType === "cost" ? "−" : ""}
                      ₹{item.economicValue.toLocaleString("en-IN")}
                    </div>
                    <span className="text-[10px] text-[#6b746e] block truncate">
                      {item.economicLabel}
                    </span>
                  </div>

                  {/* CO2e Avoided */}
                  <div className="sm:col-span-2 min-w-0 pr-2">
                    <div className="text-xs font-bold font-mono text-[#151817] whitespace-nowrap">
                      {item.co2eAvoided.toFixed(1)} kg
                    </div>
                    <span className="text-[10px] text-[#6b746e] block truncate">
                      avoided estimate
                    </span>
                  </div>

                  {/* Viability Bar Track */}
                  <div className="sm:col-span-2 min-w-0 flex items-center gap-2">
                    <div className="bar-track flex-1 min-w-[32px]">
                      <span
                        style={{
                          width: `${viabilityPct}%`,
                          backgroundColor: isRec ? "#2e7d57" : "#6b746e",
                        }}
                      />
                    </div>
                    <strong className="font-mono text-xs text-[#151817] w-6 text-right flex-shrink-0">
                      {item.viability.toFixed(1)}
                    </strong>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-sm border-l-4 border-l-[#2e7d57] bg-[#f4f5f1] p-3 text-[11px] text-[#6b746e]">
        <strong className="text-[#151817]">How to read this matrix: </strong>
        Monetary figures and carbon estimates reflect modeled post-purchase baselines in INR and kg CO2e. Viability is scored from 0.0 to 10.0 using deterministic PP-RI rules.
      </div>
    </section>
  );
}
