"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { resolveCategoryBaseline, formatItemDisplayName, type RecommendedAction } from "@/lib/decisionEngine";
import { DashboardPageSkeleton } from "@/components/LoadingSkeleton";

interface ItemWithRecommendation {
  id: string;
  image_url: string | null;
  item_type: string | null;
  brand: string | null;
  estimated_age_years: number | null;
  condition: string | null;
  repair_cost_est: number | null;
  resale_value_est: number | null;
  co2e_saved_est: number | null;
  waste_avoided_kg: number | null;
  created_at: string;
  recommendations?: Array<{
    id: string;
    recommended_action: RecommendedAction;
    confidence: number | null;
    rationale: string | null;
  }>;
}

const ACTION_COLORS: Record<RecommendedAction, { bg: string; text: string; border: string; bar: string }> = {
  repair: {
    bg: "bg-[#e6f2e8]",
    text: "text-[#2e7d57]",
    border: "border-[#2e7d57]/30",
    bar: "bg-[#2e7d57]",
  },
  reuse: {
    bg: "bg-[#f4f5f1]",
    text: "text-[#151817]",
    border: "border-[#d8ddd7]",
    bar: "bg-[#151817]",
  },
  donate: {
    bg: "bg-[#e6f2e8]",
    text: "text-[#173d2c]",
    border: "border-[#173d2c]/30",
    bar: "bg-[#173d2c]",
  },
  resell: {
    bg: "bg-[#f4f5f1]",
    text: "text-[#151817]",
    border: "border-[#6b746e]",
    bar: "bg-[#4B5047]",
  },
  refurbish: {
    bg: "bg-[#e6f2e8]",
    text: "text-[#2e7d57]",
    border: "border-[#2e7d57]/30",
    bar: "bg-[#2e7d57]",
  },
  recycle: {
    bg: "bg-[#FDF2EC]",
    text: "text-[#a3512b]",
    border: "border-[#a3512b]/30",
    bar: "bg-[#a3512b]",
  },
};

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<ItemWithRecommendation[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchErr } = await supabase
        .from("items")
        .select(`
          *,
          recommendations (
            id,
            recommended_action,
            confidence,
            rationale
          )
        `)
        .order("created_at", { ascending: false });

      if (fetchErr) {
        throw new Error(fetchErr.message);
      }

      setItems((data as ItemWithRecommendation[]) || []);
    } catch (err) {
      console.error("Dashboard fetch error:", err);
      setError(err instanceof Error ? err.message : "Failed to load dashboard metrics from database.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Aggregate computations directly from live rows
  const totalItems = items.length;

  const totalCo2eAvoidedKg = items.reduce((acc, item) => {
    return acc + (item.co2e_saved_est ? Number(item.co2e_saved_est) : 0);
  }, 0);

  const totalWasteDivertedKg = items.reduce((acc, item) => {
    return acc + (item.waste_avoided_kg ? Number(item.waste_avoided_kg) : 0);
  }, 0);

  const totalEconomicValuePreserved = items.reduce((acc, item) => {
    const resaleVal = item.resale_value_est ? Number(item.resale_value_est) : 0;
    const repairCost = item.repair_cost_est ? Number(item.repair_cost_est) : 0;
    const baseline = resolveCategoryBaseline(item.item_type || "other");
    const avoidedReplacement = Math.max(0, baseline.new_price_est - repairCost);
    return acc + resaleVal + avoidedReplacement;
  }, 0);

  // Breakdown across all six distinct pathways
  const actionCounts: Record<RecommendedAction, number> = {
    repair: 0,
    reuse: 0,
    donate: 0,
    resell: 0,
    refurbish: 0,
    recycle: 0,
  };

  items.forEach((item) => {
    const primaryRec = item.recommendations?.[0]?.recommended_action;
    if (primaryRec && primaryRec in actionCounts) {
      actionCounts[primaryRec] += 1;
    } else {
      if (item.condition === "severely_damaged") {
        actionCounts.recycle += 1;
      } else {
        actionCounts.reuse += 1;
      }
    }
  });

  const pathwaysList: Array<{ action: RecommendedAction; label: string; count: number }> = [
    { action: "repair", label: "Repair", count: actionCounts.repair },
    { action: "reuse", label: "Reuse", count: actionCounts.reuse },
    { action: "donate", label: "Donate", count: actionCounts.donate },
    { action: "resell", label: "Resell", count: actionCounts.resell },
    { action: "refurbish", label: "Refurbish", count: actionCounts.refurbish },
    { action: "recycle", label: "Recycle", count: actionCounts.recycle },
  ];

  const maxActionCount = Math.max(1, ...Object.values(actionCounts));

  // Live Community Impact Calculations (Past 7 days)
  const now = new Date().getTime();
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  const itemsThisWeek = items.filter(
    (item) => now - new Date(item.created_at).getTime() <= sevenDaysMs
  );
  const repairedThisWeek = itemsThisWeek.filter(
    (item) => item.recommendations?.[0]?.recommended_action === "repair"
  );
  const repairedThisWeekCount = repairedThisWeek.length;
  const co2eSavedThisWeek = repairedThisWeek.reduce(
    (acc, item) => acc + (item.co2e_saved_est ? Number(item.co2e_saved_est) : 0),
    0
  );

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#d8ddd7] pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-[#6b746e]">
              DATABASE AUDIT / LIVE AGGREGATE
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[#151817]">
            Circularity Impact Dashboard
          </h1>
          <p className="text-xs text-[#6b746e]">
            Computed live from items and recommendations recorded in Supabase.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fetchDashboardData()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-sm border border-[#d8ddd7] bg-white px-3 py-1.5 text-xs font-medium text-[#151817] transition-colors hover:bg-[#e9ede7] disabled:opacity-50"
          >
            <svg
              className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            <span>Refresh</span>
          </button>
          <Link
            href="/analyze"
            className="inline-flex items-center justify-center rounded-sm bg-[#2e7d57] px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#246644]"
          >
            Analyze an item
          </Link>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="rounded-sm border border-[#a3512b] bg-white p-4 text-xs text-[#151817]">
          <div className="font-semibold text-[#a3512b] mb-0.5">Database Query Error</div>
          <div>{error}</div>
        </div>
      )}

      {/* Loading State */}
      {loading ? (
        <DashboardPageSkeleton />
      ) : totalItems === 0 ? (
        /* Empty State */
        <div className="rounded-sm border border-dashed border-[#d8ddd7] bg-white p-12 text-center space-y-4">
          <div className="space-y-1 max-w-sm mx-auto">
            <h2 className="text-base font-semibold text-[#151817]">
              No items recorded yet
            </h2>
            <p className="text-xs text-[#6b746e] leading-relaxed">
              This dashboard computes aggregate metrics directly from database rows. Analyze an item to begin tracking avoided carbon emissions, diverted landfill waste, and preserved economic value.
            </p>
          </div>

          <div className="pt-2">
            <Link
              href="/analyze"
              className="inline-flex items-center justify-center rounded-sm bg-[#2e7d57] px-5 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#246644]"
            >
              Analyze an item &rarr;
            </Link>
          </div>
        </div>
      ) : (
        /* Metrics Display */
        <div className="space-y-8">
          {/* Community Pulse Banner */}
          <div className="rounded-sm border border-[#d8ddd7] bg-white p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-semibold uppercase tracking-wider text-[#2e7d57]">
                    COMMUNITY REPAIR PULSE: 7 DAYS
                  </span>
                </div>
                <p className="text-sm font-medium text-[#151817]">
                  This community has repaired{" "}
                  <span className="font-mono font-bold">
                    {repairedThisWeekCount} {repairedThisWeekCount === 1 ? "device" : "devices"}
                  </span>{" "}
                  this week :{" "}
                  <span className="font-mono font-bold text-[#2e7d57]">
                    {co2eSavedThisWeek.toFixed(1)} kg CO2e
                  </span>{" "}
                  avoided
                </p>
                <p className="text-xs text-[#6b746e]">
                  Direct manufacturing emissions avoided by extending device lifespans through verified repair pathways.
                </p>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <div className="rounded-sm border border-[#d8ddd7] bg-[#f4f5f1] px-3 py-2 text-right">
                  <div className="text-[10px] font-mono text-[#6b746e] uppercase">Repair Ratio</div>
                  <div className="font-mono text-sm font-bold text-[#151817]">
                    {itemsThisWeek.length > 0
                      ? `${Math.round((repairedThisWeekCount / itemsThisWeek.length) * 100)}%`
                      : "0%"}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Top 4 Impact KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* KPI 1 */}
            <div className="rounded-sm border border-[#d8ddd7] bg-white p-5 space-y-1">
              <div className="text-xs font-medium text-[#6b746e]">
                Items Evaluated
              </div>
              <div className="text-2xl font-bold font-mono text-[#151817]">
                {totalItems}
              </div>
              <div className="text-[11px] font-mono text-[#6b746e]">
                Logged intake records
              </div>
            </div>

            {/* KPI 2 */}
            <div className="rounded-sm border border-[#d8ddd7] bg-white p-5 space-y-1">
              <div className="text-xs font-medium text-[#6b746e]">
                CO2e Avoided
              </div>
              <div className="text-2xl font-bold font-mono text-[#151817]">
                {totalCo2eAvoidedKg.toLocaleString()} <span className="text-xs font-normal text-[#6b746e]">kg</span>
              </div>
              <div className="text-[11px] font-mono text-[#6b746e]">
                Embodied carbon retained
              </div>
            </div>

            {/* KPI 3 */}
            <div className="rounded-sm border border-[#d8ddd7] bg-white p-5 space-y-1">
              <div className="text-xs font-medium text-[#6b746e]">
                Economic Value Preserved
              </div>
              <div className="text-2xl font-bold font-mono text-[#151817]">
                ₹{Math.round(totalEconomicValuePreserved).toLocaleString("en-IN")}
              </div>
              <div className="text-[11px] font-mono text-[#6b746e]">
                Resale value + avoided replacement
              </div>
            </div>

            {/* KPI 4 */}
            <div className="rounded-sm border border-[#d8ddd7] bg-white p-5 space-y-1">
              <div className="text-xs font-medium text-[#6b746e]">
                Landfill Mass Diverted
              </div>
              <div className="text-2xl font-bold font-mono text-[#151817]">
                {totalWasteDivertedKg.toFixed(1)} <span className="text-xs font-normal text-[#6b746e]">kg</span>
              </div>
              <div className="text-[11px] font-mono text-[#6b746e]">
                E-waste diverted
              </div>
            </div>
          </div>

          {/* Recommendation Breakdown Chart */}
          <div className="rounded-sm border border-[#d8ddd7] bg-white p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#d8ddd7] pb-3">
              <div>
                <h2 className="text-sm font-semibold text-[#151817]">
                  Pathway Recommendation Distribution
                </h2>
                <p className="text-xs text-[#6b746e]">
                  Breakdown across the 6 circular lifecycle pathways
                </p>
              </div>
              <span className="font-mono text-xs text-[#6b746e]">
                {totalItems} total decision{totalItems === 1 ? "" : "s"}
              </span>
            </div>

            <div className="space-y-3.5">
              {pathwaysList.map((pathway) => {
                const percentage = totalItems > 0 ? Math.round((pathway.count / totalItems) * 100) : 0;
                const barWidth = totalItems > 0 ? Math.round((pathway.count / maxActionCount) * 100) : 0;
                const meta = ACTION_COLORS[pathway.action];

                return (
                  <div key={pathway.action} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-[#151817]">
                          {pathway.label}
                        </span>
                        <span
                          className={`rounded-sm px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase border ${meta.bg} ${meta.text} ${meta.border}`}
                        >
                          {pathway.count} item{pathway.count === 1 ? "" : "s"}
                        </span>
                      </div>
                      <span className="font-mono text-xs text-[#6b746e]">
                        {percentage}%
                      </span>
                    </div>

                    <div className="w-full bg-[#e9ede7] h-2 rounded-sm overflow-hidden">
                      <div
                        className={`h-full rounded-sm transition-all duration-300 ${meta.bar}`}
                        style={{ width: `${Math.max(pathway.count > 0 ? 3 : 0, barWidth)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Processed Items Table */}
          <div className="rounded-sm border border-[#d8ddd7] bg-white p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#d8ddd7] pb-3">
              <div>
                <h2 className="text-sm font-semibold text-[#151817]">
                  Intake Log
                </h2>
                <p className="text-xs text-[#6b746e]">
                  Evaluated hardware items and computed pathways
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#d8ddd7] text-[#6b746e] font-mono text-[11px] uppercase">
                    <th className="pb-2.5 font-medium">Item</th>
                    <th className="pb-2.5 font-medium">Condition</th>
                    <th className="pb-2.5 font-medium">Action</th>
                    <th className="pb-2.5 font-medium text-right">CO2e Saved</th>
                    <th className="pb-2.5 font-medium text-right">Est. Resale</th>
                    <th className="pb-2.5 font-medium text-right">Links</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#d8ddd7]">
                  {items.map((item) => {
                    const primaryRec =
                      (item.recommendations?.[0]?.recommended_action as RecommendedAction) ||
                      (item.condition === "severely_damaged" ? "recycle" : "reuse");
                    const colorMeta = ACTION_COLORS[primaryRec] || ACTION_COLORS.reuse;

                    return (
                      <tr key={item.id} className="hover:bg-[#f4f5f1] transition-colors">
                        <td className="py-3 pr-3">
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-9 flex-shrink-0 overflow-hidden rounded-sm border border-[#d8ddd7] bg-[#f4f5f1] flex items-center justify-center">
                              {item.image_url ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={item.image_url}
                                  alt={item.item_type || "Item"}
                                  className="h-full w-full object-contain"
                                />
                              ) : (
                                <span className="text-[10px] font-mono text-[#6b746e]">IMG</span>
                              )}
                            </div>
                            <div>
                              <div className="font-semibold text-[#151817]">
                                {formatItemDisplayName(null, item.item_type)}
                              </div>
                              <div className="text-[11px] text-[#6b746e] font-mono">
                                {item.brand || "Generic"} / {item.estimated_age_years !== null ? `${item.estimated_age_years}y` : "Age N/A"}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="py-3 pr-3 text-[#151817] font-mono">
                          {(item.condition || "functional").replace("_", " ")}
                        </td>

                        <td className="py-3 pr-3">
                          <span
                            className={`inline-flex rounded-sm px-2 py-0.5 font-mono text-[10px] font-bold uppercase border ${colorMeta.bg} ${colorMeta.text} ${colorMeta.border}`}
                          >
                            {primaryRec}
                          </span>
                        </td>

                        <td className="py-3 pr-3 text-right font-mono font-semibold text-[#151817]">
                          {item.co2e_saved_est ?? 0} kg
                        </td>

                        <td className="py-3 pr-3 text-right font-mono text-[#151817]">
                          ₹{(item.resale_value_est ?? 0).toLocaleString("en-IN")}
                        </td>

                        <td className="py-3 text-right">
                          <div className="flex items-center justify-end gap-2 font-mono text-[11px]">
                            <Link
                              href={`/analyze/${item.id}/results`}
                              className="text-[#2e7d57] hover:underline"
                            >
                              Results
                            </Link>
                            <span className="text-[#6b746e]">/</span>
                            <Link
                              href={`/analyze/${item.id}/destinations`}
                              className="text-[#6b746e] hover:text-[#151817]"
                            >
                              Map
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
