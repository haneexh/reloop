"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { resolveCategoryBaseline, type RecommendedAction } from "@/lib/decisionEngine";
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

const ACTION_COLORS: Record<RecommendedAction, { bg: string; text: string; bar: string }> = {
  repair: {
    bg: "bg-blue-50 dark:bg-blue-950/40",
    text: "text-blue-700 dark:text-blue-300",
    bar: "bg-blue-600",
  },
  reuse: {
    bg: "bg-teal-50 dark:bg-teal-950/40",
    text: "text-teal-700 dark:text-teal-300",
    bar: "bg-teal-600",
  },
  donate: {
    bg: "bg-emerald-50 dark:bg-emerald-950/40",
    text: "text-emerald-700 dark:text-emerald-300",
    bar: "bg-emerald-600",
  },
  resell: {
    bg: "bg-indigo-50 dark:bg-indigo-950/40",
    text: "text-indigo-700 dark:text-indigo-300",
    bar: "bg-indigo-600",
  },
  refurbish: {
    bg: "bg-purple-50 dark:bg-purple-950/40",
    text: "text-purple-700 dark:text-purple-300",
    bar: "bg-purple-600",
  },
  recycle: {
    bg: "bg-amber-50 dark:bg-amber-950/40",
    text: "text-amber-700 dark:text-amber-300",
    bar: "bg-amber-600",
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
    // Economic value preserved = Secondary market value + Avoided new purchase replacement saving (new retail minus repair cost)
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
      // If no recommendation record, default to reuse or recycle based on condition
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

  // Live Community Impact Calculations (Past 7 days & All-time collective repair)
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

  const totalRepairedItems = items.filter(
    (item) => item.recommendations?.[0]?.recommended_action === "repair"
  );
  const totalRepairedCount = totalRepairedItems.length;
  const totalRepairedCo2e = totalRepairedItems.reduce(
    (acc, item) => acc + (item.co2e_saved_est ? Number(item.co2e_saved_est) : 0),
    0
  );

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-200 pb-4 dark:border-zinc-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center rounded border border-zinc-200 bg-zinc-100 px-2 py-0.5 font-mono text-[11px] font-medium text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
              AGGREGATE IMPACT
            </span>
            <span className="text-xs text-zinc-400">&bull;</span>
            <span className="font-mono text-xs text-zinc-500 dark:text-zinc-400">
              LIVE DATABASE METRICS
            </span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 mt-1">
            Circularity Impact Dashboard
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Real-time aggregate carbon avoidance, landfill mass diversion, and economic value preserved across all intake evaluations.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fetchDashboardData()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
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
            className="inline-flex items-center justify-center rounded-md bg-zinc-900 px-3.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            + New Intake
          </Link>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
          <div className="font-semibold mb-0.5">Database Query Error</div>
          <div>{error}</div>
        </div>
      )}

      {/* Loading State */}
      {loading ? (
        <DashboardPageSkeleton />
      ) : totalItems === 0 ? (
        /* Empty State: True zero state when no rows exist */
        <div className="rounded-md border border-dashed border-zinc-300 bg-zinc-50 p-12 text-center dark:border-zinc-800 dark:bg-zinc-950 space-y-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-zinc-300 bg-white text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
            <svg
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.75}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
          </div>

          <div className="space-y-1 max-w-sm mx-auto">
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
              No Items Recorded Yet
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
              The aggregate impact dashboard computes live metrics from actual database rows. Analyze your first item to begin tracking avoided carbon emissions, diverted landfill waste, and preserved economic value.
            </p>
          </div>

          <div className="pt-2">
            <Link
              href="/analyze"
              className="inline-flex items-center justify-center rounded-md bg-zinc-900 px-5 py-2 text-xs font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              Analyze Your First Item &rarr;
            </Link>
          </div>
        </div>
      ) : (
        /* ===================================================================== */
        /* METRICS & BREAKDOWN DISPLAY */
        /* ===================================================================== */
        <div className="space-y-8">
          {/* Lightweight Community Impact Widget */}
          <div className="rounded-md border border-zinc-200 bg-zinc-50 p-5 dark:border-zinc-800 dark:bg-zinc-900/60">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span className="font-mono text-xs font-semibold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                    Community Circularity Pulse
                  </span>
                  <span className="text-zinc-400">&bull;</span>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">
                    Past 7 Days
                  </span>
                </div>
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  This community has repaired{" "}
                  <span className="font-mono font-bold text-zinc-950 dark:text-white">
                    {repairedThisWeekCount} {repairedThisWeekCount === 1 ? "device" : "devices"}
                  </span>{" "}
                  this week &rarr;{" "}
                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    {co2eSavedThisWeek.toFixed(1)} kg CO₂e
                  </span>{" "}
                  avoided
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {repairedThisWeekCount > 0
                    ? `Live aggregate data from all intake submissions. Direct hardware manufacturing carbon avoided.`
                    : `All-time community repair routing: ${totalRepairedCount} devices (${totalRepairedCo2e.toFixed(1)} kg CO₂e avoided). Submit an item to boost this week's community repair count.`}
                </p>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <div className="rounded border border-zinc-200 bg-white px-3 py-2 text-right dark:border-zinc-800 dark:bg-zinc-950">
                  <div className="text-[10px] font-mono text-zinc-400 uppercase">Weekly Repair Rate</div>
                  <div className="font-mono text-sm font-bold text-zinc-900 dark:text-zinc-100">
                    {itemsThisWeek.length > 0
                      ? `${Math.round((repairedThisWeekCount / itemsThisWeek.length) * 100)}%`
                      : "0%"}
                  </div>
                </div>
                <Link
                  href="/analyze"
                  className="inline-flex items-center justify-center rounded-md bg-zinc-900 px-3.5 py-2 text-xs font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
                >
                  + Add Intake
                </Link>
              </div>
            </div>
          </div>

          {/* Top 4 Impact KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* KPI 1: Items Processed */}
            <div className="rounded-md border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900 space-y-1.5">
              <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Total Items Evaluated
              </div>
              <div className="text-2xl font-bold font-mono text-zinc-900 dark:text-zinc-50">
                {totalItems}
              </div>
              <div className="text-[11px] text-zinc-400">
                Direct circular intake submissions
              </div>
            </div>

            {/* KPI 2: Total CO2e Avoided */}
            <div className="rounded-md border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900 space-y-1.5">
              <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Total CO₂e Avoided
              </div>
              <div className="text-2xl font-bold font-mono text-zinc-900 dark:text-zinc-50">
                {totalCo2eAvoidedKg.toLocaleString()} <span className="text-sm font-normal text-zinc-400">kg</span>
              </div>
              <div className="text-[11px] text-zinc-400">
                Avoided cradle-to-gate embodied carbon
              </div>
            </div>

            {/* KPI 3: Economic Value Preserved */}
            <div className="rounded-md border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900 space-y-1.5">
              <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Economic Value Preserved
              </div>
              <div className="text-2xl font-bold font-mono text-zinc-900 dark:text-zinc-50">
                ₹{Math.round(totalEconomicValuePreserved).toLocaleString("en-IN")}
              </div>
              <div className="text-[11px] text-zinc-400">
                Resale salvage + replacement savings
              </div>
            </div>

            {/* KPI 4: Landfill Waste Diverted */}
            <div className="rounded-md border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900 space-y-1.5">
              <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Landfill Waste Diverted
              </div>
              <div className="text-2xl font-bold font-mono text-zinc-900 dark:text-zinc-50">
                {totalWasteDivertedKg.toFixed(1)} <span className="text-sm font-normal text-zinc-400">kg</span>
              </div>
              <div className="text-[11px] text-zinc-400">
                Direct physical mass diverted from dump
              </div>
            </div>
          </div>

          {/* Recommendation Breakdown Chart */}
          <div className="rounded-md border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 pb-3 dark:border-zinc-800">
              <div>
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  Six-Pathway Recommendation Breakdown
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Distribution of primary lifecycle routing across all processed hardware
                </p>
              </div>
              <span className="font-mono text-xs text-zinc-500 dark:text-zinc-400">
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
                        <span className="font-medium text-zinc-900 dark:text-zinc-100">
                          {pathway.label}
                        </span>
                        <span
                          className={`rounded px-1.5 py-0.2 font-mono text-[10px] font-bold uppercase ${meta.bg} ${meta.text}`}
                        >
                          {pathway.count} item{pathway.count === 1 ? "" : "s"}
                        </span>
                      </div>
                      <span className="font-mono text-xs text-zinc-500 dark:text-zinc-400">
                        {percentage}%
                      </span>
                    </div>

                    <div className="w-full bg-zinc-100 h-2.5 rounded-full overflow-hidden dark:bg-zinc-800">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${meta.bar}`}
                        style={{ width: `${Math.max(pathway.count > 0 ? 3 : 0, barWidth)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Processed Items Table */}
          <div className="rounded-md border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 pb-3 dark:border-zinc-800">
              <div>
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  Recent Evaluated Items
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Chronological log of intake submissions and circular economy actions
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-zinc-200 text-zinc-500 dark:border-zinc-800 dark:text-zinc-400 font-mono text-[11px] uppercase">
                    <th className="pb-2.5 font-medium">Item & Brand</th>
                    <th className="pb-2.5 font-medium">Condition</th>
                    <th className="pb-2.5 font-medium">Recommendation</th>
                    <th className="pb-2.5 font-medium text-right">CO₂e Avoided</th>
                    <th className="pb-2.5 font-medium text-right">Secondary Value</th>
                    <th className="pb-2.5 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                  {items.map((item) => {
                    const primaryRec =
                      (item.recommendations?.[0]?.recommended_action as RecommendedAction) ||
                      (item.condition === "severely_damaged" ? "recycle" : "reuse");
                    const colorMeta = ACTION_COLORS[primaryRec] || ACTION_COLORS.reuse;

                    return (
                      <tr key={item.id} className="hover:bg-zinc-50/60 dark:hover:bg-zinc-800/30 transition-colors">
                        <td className="py-3 pr-3">
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-9 flex-shrink-0 overflow-hidden rounded border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 flex items-center justify-center">
                              {item.image_url ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={item.image_url}
                                  alt={item.item_type || "Item"}
                                  className="h-full w-full object-contain"
                                />
                              ) : (
                                <span className="text-[10px] font-mono text-zinc-400">Item</span>
                              )}
                            </div>
                            <div>
                              <div className="font-semibold text-zinc-900 dark:text-zinc-100 capitalize">
                                {item.item_type}
                              </div>
                              <div className="text-[11px] text-zinc-400 font-mono">
                                {item.brand || "Generic"} &bull; {item.estimated_age_years !== null ? `${item.estimated_age_years}y` : "Age N/A"}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="py-3 pr-3 capitalize text-zinc-600 dark:text-zinc-400">
                          {(item.condition || "functional").replace("_", " ")}
                        </td>

                        <td className="py-3 pr-3">
                          <span
                            className={`inline-flex rounded px-2 py-0.5 font-mono text-[10px] font-bold uppercase ${colorMeta.bg} ${colorMeta.text}`}
                          >
                            {primaryRec}
                          </span>
                        </td>

                        <td className="py-3 pr-3 text-right font-mono font-semibold text-zinc-900 dark:text-zinc-100">
                          {item.co2e_saved_est ?? 0} kg
                        </td>

                        <td className="py-3 pr-3 text-right font-mono text-zinc-900 dark:text-zinc-100">
                          ₹{(item.resale_value_est ?? 0).toLocaleString("en-IN")}
                        </td>

                        <td className="py-3 text-right">
                          <div className="flex items-center justify-end gap-2 font-mono text-[11px]">
                            <Link
                              href={`/analyze/${item.id}/results`}
                              className="text-zinc-900 hover:underline dark:text-zinc-100"
                            >
                              Results
                            </Link>
                            <span className="text-zinc-300 dark:text-zinc-700">|</span>
                            <Link
                              href={`/analyze/${item.id}/destinations`}
                              className="text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
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
