"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { DemandIntelligenceSummary, ZoneSpatialDemand } from "@/lib/demand-engine";
import { OptimizedRoute } from "@/lib/route-optimizer";
import { DeferredRequestRecord } from "@/lib/scheduler";

// Dynamic import for Leaflet map to prevent SSR window reference error
const DispatchRouteMap = dynamic(
  () => import("@/components/DispatchRouteMap"),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-[420px] rounded-sm border border-[#d8ddd7] bg-[#f4f5f1] flex items-center justify-center font-mono text-xs text-[#6b746e]">
        Initializing Leaflet Tactical Route Engine...
      </div>
    ),
  }
);

interface OptimizationSummary {
  total_vehicles_used: number;
  total_stops_served: number;
  total_load_kg: number;
  baseline_total_distance_km: number;
  optimized_total_distance_km: number;
  total_distance_saved_km: number;
  overall_distance_reduction_percent: number;
  average_capacity_utilization_percent: number;
  total_estimated_duration_minutes: number;
}

export default function DispatchPage() {
  const [demandData, setDemandData] = useState<DemandIntelligenceSummary | null>(null);
  const [isLoadingDemand, setIsLoadingDemand] = useState(true);
  const [demandError, setDemandError] = useState<string | null>(null);

  // Planning Controls
  const [planningDate, setPlanningDate] = useState<string>(() => {
    return new Date().toISOString().split("T")[0];
  });
  const [planningSlot, setPlanningSlot] = useState<string>("ALL");

  // Optimization & Generation State
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optError, setOptError] = useState<string | null>(null);
  const [routes, setRoutes] = useState<OptimizedRoute[]>([]);
  const [optSummary, setOptSummary] = useState<OptimizationSummary | null>(null);
  const [deferredRequests, setDeferredRequests] = useState<DeferredRequestRecord[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);

  // Persistence State
  const [isPersisting, setIsPersisting] = useState(false);
  const [persistSuccessMsg, setPersistSuccessMsg] = useState<string | null>(null);
  const [persistedRoutes, setPersistedRoutes] = useState<Array<{
    id: string;
    route_date: string;
    vehicle_code: string;
    total_distance_km: number;
    total_load_kg: number;
    status: string;
  }>>([]);

  // Load Demand Intelligence & Existing Routes
  const loadDemandIntelligence = async () => {
    setIsLoadingDemand(true);
    setDemandError(null);
    try {
      const res = await fetch("/api/demand");
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to load demand intelligence.");
      }
      setDemandData(json.data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error loading demand intelligence.";
      setDemandError(msg);
    } finally {
      setIsLoadingDemand(false);
    }
  };

  const loadPersistedRoutes = async () => {
    try {
      const res = await fetch("/api/routes");
      const json = await res.json();
      if (res.ok && json.success) {
        setPersistedRoutes(json.data || []);
      }
    } catch (err) {
      console.warn("Notice: could not load persisted routes history:", err);
    }
  };

  useEffect(() => {
    loadDemandIntelligence();
    loadPersistedRoutes();
  }, []);

  // Run Route Optimization
  const handleGeneratePlan = async (persist = false) => {
    setIsOptimizing(true);
    setOptError(null);
    setPersistSuccessMsg(null);

    try {
      const res = await fetch("/api/routes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planning_date: planningDate,
          planning_slot: planningSlot === "ALL" ? null : planningSlot,
          persist,
        }),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error || "Route optimization failed.");
      }

      setRoutes(json.data.routes || []);
      setOptSummary(json.data.summary || null);
      setDeferredRequests(json.data.deferred_requests || []);

      if (persist) {
        setPersistSuccessMsg(
          `Successfully committed ${json.data.persisted_route_ids?.length || 0} route(s) to municipal fleet ledger with ROUTE_GENERATED and ROUTE_OPTIMIZED audit records.`
        );
        loadPersistedRoutes();
        loadDemandIntelligence();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Plan generation failed.";
      setOptError(msg);
    } finally {
      setIsOptimizing(false);
      setIsPersisting(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header & Breadcrumb */}
      <div>
        <div className="flex items-center gap-2 text-xs font-mono text-[#6b746e] uppercase tracking-wider mb-1">
          <Link href="/" className="hover:text-[#2e7d57]">Platform</Link>
          <span>/</span>
          <span className="text-[#151817] font-semibold">Municipal Operations</span>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-display font-bold text-[#151817] tracking-tight">
              Collection Operations &amp; Fleet Scheduling
            </h1>
            <p className="mt-1 text-xs text-[#4b554d] max-w-2xl">
              Capacity-constrained routing heuristic, demand density forecasting, and digital dispatch execution for Greater Hyderabad e-waste collection.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                loadDemandIntelligence();
                loadPersistedRoutes();
              }}
              className="inline-flex items-center gap-1.5 rounded-sm border border-[#d8ddd7] bg-white px-3 py-1.5 text-xs font-mono text-[#151817] hover:bg-[#f4f5f1]"
            >
              ⟳ Refresh Demand
            </button>
          </div>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-sm border border-[#d8ddd7] bg-white p-4">
          <span className="text-[11px] font-mono text-[#6b746e] uppercase">Pending Requests</span>
          <div className="text-2xl font-bold font-mono text-[#151817] mt-1">
            {demandData?.planning_summary.pending_unassigned_requests ?? "—"}
          </div>
          <span className="text-[10px] text-[#6b746e]">Awaiting route allocation</span>
        </div>

        <div className="rounded-sm border border-[#d8ddd7] bg-white p-4">
          <span className="text-[11px] font-mono text-[#6b746e] uppercase">Total Active Load</span>
          <div className="text-2xl font-bold font-mono text-[#2e7d57] mt-1">
            {demandData?.planning_summary.total_planning_weight_kg ?? "—"} <span className="text-sm">kg</span>
          </div>
          <span className="text-[10px] text-[#6b746e]">Across all municipal zones</span>
        </div>

        <div className="rounded-sm border border-[#d8ddd7] bg-white p-4">
          <span className="text-[11px] font-mono text-[#6b746e] uppercase">Critical / High Zones</span>
          <div className="text-2xl font-bold font-mono text-[#b33a3a] mt-1">
            {(demandData?.planning_summary.critical_zones_count ?? 0) +
              (demandData?.planning_summary.high_demand_zones_count ?? 0)}
          </div>
          <span className="text-[10px] text-[#6b746e]">Requiring urgent collection</span>
        </div>

        <div className="rounded-sm border border-[#d8ddd7] bg-white p-4">
          <span className="text-[11px] font-mono text-[#6b746e] uppercase">Real Request Share</span>
          <div className="text-2xl font-bold font-mono text-[#151817] mt-1">
            {demandData?.planning_summary.real_requests_percentage ?? 0}%
          </div>
          <span className="text-[10px] text-[#6b746e]">Preserves seed separation</span>
        </div>
      </div>

      {demandError && (
        <div className="rounded-sm border border-[#f5c6cb] bg-[#fdf2f2] p-3 text-xs text-[#721c24]">
          <strong>Notice:</strong> {demandError}
        </div>
      )}

      {/* Planning Controls Panel */}
      <div className="rounded-sm border border-[#d8ddd7] bg-white p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-[#e9ede7] pb-3">
          <h2 className="text-xs font-bold text-[#151817] uppercase tracking-wider font-mono">
            Dispatcher Planning Horizon
          </h2>
          <span className="text-[11px] font-mono text-[#6b746e]">
            Deterministic Heuristic · 2-Opt &amp; Relocate
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-[#151817] mb-1">
              Planning Collection Date
            </label>
            <input
              type="date"
              value={planningDate}
              onChange={(e) => setPlanningDate(e.target.value)}
              className="w-full rounded-sm border border-[#d8ddd7] bg-[#fdfdfc] p-2 text-xs font-mono text-[#151817] focus:border-[#2e7d57] focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#151817] mb-1">
              Time Window Batch
            </label>
            <select
              value={planningSlot}
              onChange={(e) => setPlanningSlot(e.target.value)}
              className="w-full rounded-sm border border-[#d8ddd7] bg-[#fdfdfc] p-2 text-xs text-[#151817] focus:border-[#2e7d57] focus:outline-none"
            >
              <option value="ALL">All Available Windows (Full Day)</option>
              <option value="09:00 - 12:00">Morning (09:00 - 12:00)</option>
              <option value="12:00 - 15:00">Afternoon (12:00 - 15:00)</option>
              <option value="15:00 - 18:00">Evening (15:00 - 18:00)</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              type="button"
              disabled={isOptimizing}
              onClick={() => handleGeneratePlan(false)}
              className="w-full rounded-sm bg-[#2e7d57] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#246644] transition-colors disabled:opacity-50"
            >
              {isOptimizing ? "Optimizing Routes..." : "⚡ Generate Collection Plan"}
            </button>
          </div>
        </div>
      </div>

      {optError && (
        <div className="rounded-sm border border-[#f5c6cb] bg-[#fdf2f2] p-4 text-xs text-[#721c24]">
          <strong>Optimization Notice:</strong> {optError}
        </div>
      )}

      {persistSuccessMsg && (
        <div className="rounded-sm border border-[#bcdbc8] bg-[#edf5f0] p-4 text-xs text-[#1e583c] flex items-center justify-between">
          <div>
            <strong className="font-bold">✓ Committed: </strong>
            {persistSuccessMsg}
          </div>
        </div>
      )}

      {/* Generated Route Solution Comparison */}
      {optSummary && (
        <div className="space-y-6">
          <div className="rounded-sm border border-[#2e7d57] bg-white p-5 space-y-4 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#e9ede7] pb-3">
              <div>
                <h2 className="text-sm font-bold text-[#151817]">
                  Optimization Solution Summary — {planningDate}
                </h2>
                <p className="text-xs text-[#6b746e]">
                  Comparing unsequenced baseline tour against 2-opt capacity-aware route plan.
                </p>
              </div>
              <button
                type="button"
                disabled={isPersisting || routes.length === 0}
                onClick={() => {
                  setIsPersisting(true);
                  handleGeneratePlan(true);
                }}
                className="inline-flex items-center gap-1.5 rounded-sm bg-[#151817] px-4 py-2 text-xs font-bold text-white hover:bg-[#2e7d57] transition-colors disabled:opacity-40"
              >
                {isPersisting ? "Committing Routes..." : "✓ Commit & Persist Routes to Fleet"}
              </button>
            </div>

            {/* Metrics Comparative Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
              <div className="rounded-sm bg-[#f4f5f1] p-3 border border-[#e2e6df]">
                <div className="text-[10px] font-mono text-[#6b746e] uppercase">Vehicles Used</div>
                <div className="text-lg font-bold font-mono text-[#151817]">
                  {optSummary.total_vehicles_used}
                </div>
              </div>

              <div className="rounded-sm bg-[#f4f5f1] p-3 border border-[#e2e6df]">
                <div className="text-[10px] font-mono text-[#6b746e] uppercase">Stops Served</div>
                <div className="text-lg font-bold font-mono text-[#151817]">
                  {optSummary.total_stops_served}
                </div>
              </div>

              <div className="rounded-sm bg-[#f4f5f1] p-3 border border-[#e2e6df]">
                <div className="text-[10px] font-mono text-[#6b746e] uppercase">Total Load</div>
                <div className="text-lg font-bold font-mono text-[#2e7d57]">
                  {optSummary.total_load_kg} kg
                </div>
              </div>

              <div className="rounded-sm bg-[#f4f5f1] p-3 border border-[#e2e6df]">
                <div className="text-[10px] font-mono text-[#6b746e] uppercase">Optimized Dist</div>
                <div className="text-lg font-bold font-mono text-[#151817]">
                  {optSummary.optimized_total_distance_km} km
                </div>
                <span className="text-[10px] text-[#6b746e] line-through">
                  {optSummary.baseline_total_distance_km} km
                </span>
              </div>

              <div className="rounded-sm bg-[#edf5f0] p-3 border border-[#bcdbc8]">
                <div className="text-[10px] font-mono text-[#1e583c] uppercase font-bold">Distance Saved</div>
                <div className="text-lg font-bold font-mono text-[#2e7d57]">
                  -{optSummary.total_distance_saved_km} km
                </div>
                <span className="text-[10px] font-bold text-[#2e7d57]">
                  {optSummary.overall_distance_reduction_percent}% reduction
                </span>
              </div>

              <div className="rounded-sm bg-[#f4f5f1] p-3 border border-[#e2e6df]">
                <div className="text-[10px] font-mono text-[#6b746e] uppercase">Avg Fleet Util</div>
                <div className="text-lg font-bold font-mono text-[#151817]">
                  {optSummary.average_capacity_utilization_percent}%
                </div>
              </div>
            </div>
          </div>

          {/* Interactive Route Map & Route Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Map Column (7 cols) */}
            <div className="lg:col-span-7 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#151817] font-mono">
                  Tactical Route Traversal Map
                </h3>
                {selectedVehicleId && (
                  <button
                    type="button"
                    onClick={() => setSelectedVehicleId(null)}
                    className="text-[11px] font-mono text-[#2e7d57] hover:underline"
                  >
                    View All Routes
                  </button>
                )}
              </div>
              <DispatchRouteMap
                routes={routes}
                zones={demandData?.spatial || []}
                selectedVehicleId={selectedVehicleId}
                onSelectRoute={(vId) => setSelectedVehicleId(vId)}
              />
            </div>

            {/* Route Cards Column (5 cols) */}
            <div className="lg:col-span-5 space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#151817] font-mono">
                Vehicle Schedules ({routes.length})
              </h3>

              {routes.map((route) => {
                const isSelected = selectedVehicleId === route.vehicle_id;
                return (
                  <div
                    key={route.vehicle_id}
                    onClick={() =>
                      setSelectedVehicleId(isSelected ? null : route.vehicle_id)
                    }
                    className={`cursor-pointer rounded-sm border p-4 space-y-3 transition-colors ${
                      isSelected
                        ? "border-[#2e7d57] bg-[#f9fbf9] shadow-sm"
                        : "border-[#d8ddd7] bg-white hover:bg-[#fafafa]"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-bold text-[#151817]">
                          {route.vehicle_code}
                        </span>
                        <span className="rounded-sm bg-[#e9ede7] px-1.5 py-0.5 text-[10px] font-mono text-[#151817]">
                          {route.vehicle_type}
                        </span>
                      </div>
                      <span className="font-mono text-xs font-bold text-[#2e7d57]">
                        {route.total_distance_km} km
                      </span>
                    </div>

                    <p className="text-xs text-[#4b554d] leading-relaxed">
                      {route.explanation}
                    </p>

                    {/* Progress Bar for Capacity */}
                    <div>
                      <div className="flex justify-between text-[11px] font-mono text-[#6b746e] mb-1">
                        <span>Load: {route.total_load_kg} / {route.capacity_kg} kg</span>
                        <span>{route.utilization_percentage}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-[#e9ede7] rounded-sm overflow-hidden">
                        <div
                          className="h-full bg-[#2e7d57]"
                          style={{ width: `${Math.min(100, route.utilization_percentage)}%` }}
                        />
                      </div>
                    </div>

                    {/* Stops sequence snippet */}
                    <div className="text-[11px] text-[#6b746e] font-mono pt-1 border-t border-[#e9ede7]">
                      Stops sequence: {route.stops_count} collections · est. {route.estimated_duration_minutes} min duration
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Deferred Requests Drawer / Table */}
          {deferredRequests.length > 0 && (
            <div className="rounded-sm border border-[#e8dfcf] bg-[#faf8f2] p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-[#665022] uppercase tracking-wider font-mono">
                    Deferred Requests ({deferredRequests.length})
                  </h3>
                  <p className="text-[11px] text-[#8a6d3b]">
                    Requests that could not be accommodated in this planning cycle with explicit reasons.
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border border-[#e8dfcf] bg-white">
                  <thead className="bg-[#f4efe4] text-[#665022] font-mono text-[10px] uppercase">
                    <tr>
                      <th className="p-2 border-b border-[#e8dfcf]">Request ID</th>
                      <th className="p-2 border-b border-[#e8dfcf]">Priority</th>
                      <th className="p-2 border-b border-[#e8dfcf]">Est. Weight</th>
                      <th className="p-2 border-b border-[#e8dfcf]">Reason</th>
                      <th className="p-2 border-b border-[#e8dfcf]">Explanation</th>
                      <th className="p-2 border-b border-[#e8dfcf]">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e8dfcf]">
                    {deferredRequests.map((d) => (
                      <tr key={d.request_id} className="hover:bg-[#fbfaf6]">
                        <td className="p-2 font-mono text-[11px]">#{d.request_id.slice(0, 8)}</td>
                        <td className="p-2 uppercase font-mono text-[10px]">{d.request.priority}</td>
                        <td className="p-2 font-mono">{d.request.estimated_weight_kg} kg</td>
                        <td className="p-2 font-mono font-bold text-[#a03636] text-[10px]">
                          {d.reason}
                        </td>
                        <td className="p-2 text-[#4b554d] text-[11px]">{d.explanation}</td>
                        <td className="p-2 text-[#6b746e] text-[11px] italic">{d.suggested_action}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Demand Zones & Forecast Table */}
      <div className="rounded-sm border border-[#d8ddd7] bg-white p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-[#e9ede7] pb-3">
          <div>
            <h2 className="text-xs font-bold text-[#151817] uppercase tracking-wider font-mono">
              Municipal Zone Demand &amp; Inflow Forecasts
            </h2>
            <p className="text-xs text-[#6b746e]">
              Deterministic demand density and priority pressure across all 10 GHMC zones.
            </p>
          </div>
        </div>

        {isLoadingDemand ? (
          <div className="p-8 text-center font-mono text-xs text-[#6b746e]">
            Loading demand intelligence...
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {demandData?.spatial.map((zone: ZoneSpatialDemand) => {
              const forecast = demandData.forecasts.find((f) => f.zone_id === zone.zone_id);
              const level = forecast?.demand_level || "LOW";
              const levelColor =
                level === "CRITICAL"
                  ? "bg-[#fdf2f2] text-[#b33a3a] border-[#f5c6cb]"
                  : level === "HIGH"
                  ? "bg-[#fff8e6] text-[#8a5d00] border-[#f5dfa8]"
                  : level === "MEDIUM"
                  ? "bg-[#edf5f0] text-[#1e583c] border-[#bcdbc8]"
                  : "bg-[#f4f5f1] text-[#6b746e] border-[#d8ddd7]";

              return (
                <div
                  key={zone.zone_id}
                  className="rounded-sm border border-[#d8ddd7] p-4 space-y-3 bg-[#fafafa]"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-mono text-xs font-bold text-[#151817]">
                        {zone.zone_code}
                      </span>
                      <h4 className="text-sm font-semibold text-[#151817]">{zone.zone_name}</h4>
                    </div>
                    <span
                      className={`rounded-sm border px-2 py-0.5 text-[10px] font-mono font-bold uppercase ${levelColor}`}
                    >
                      {level} DEMAND
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-xs font-mono">
                    <div className="bg-white p-2 rounded-sm border border-[#e9ede7]">
                      <span className="text-[#6b746e] text-[10px] block">Requests</span>
                      <span className="font-bold text-[#151817]">{zone.request_count}</span>
                    </div>
                    <div className="bg-white p-2 rounded-sm border border-[#e9ede7]">
                      <span className="text-[#6b746e] text-[10px] block">Total Load</span>
                      <span className="font-bold text-[#2e7d57]">
                        {zone.total_estimated_weight_kg} kg
                      </span>
                    </div>
                    <div className="bg-white p-2 rounded-sm border border-[#e9ede7]">
                      <span className="text-[#6b746e] text-[10px] block">Demand Score</span>
                      <span className="font-bold text-[#151817]">{zone.demand_score}</span>
                    </div>
                  </div>

                  {forecast?.explanation && (
                    <p className="text-[11px] text-[#4b554d] leading-relaxed">
                      {forecast.explanation}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Persisted Routes History Table */}
      {persistedRoutes.length > 0 && (
        <div className="rounded-sm border border-[#d8ddd7] bg-white p-5 space-y-3">
          <h2 className="text-xs font-bold text-[#151817] uppercase tracking-wider font-mono">
            Active Dispatched Routes in Ledger ({persistedRoutes.length})
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border border-[#e9ede7]">
              <thead className="bg-[#f4f5f1] text-[#6b746e] font-mono text-[10px] uppercase">
                <tr>
                  <th className="p-2 border-b border-[#e9ede7]">Route ID</th>
                  <th className="p-2 border-b border-[#e9ede7]">Date</th>
                  <th className="p-2 border-b border-[#e9ede7]">Vehicle</th>
                  <th className="p-2 border-b border-[#e9ede7]">Distance</th>
                  <th className="p-2 border-b border-[#e9ede7]">Load</th>
                  <th className="p-2 border-b border-[#e9ede7]">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e9ede7] font-mono">
                {persistedRoutes.map((r) => (
                  <tr key={r.id} className="hover:bg-[#f9faf8]">
                    <td className="p-2">#{r.id.slice(0, 8)}</td>
                    <td className="p-2">{r.route_date}</td>
                    <td className="p-2 font-bold">{r.vehicle_code}</td>
                    <td className="p-2">{r.total_distance_km} km</td>
                    <td className="p-2">{r.total_load_kg} kg</td>
                    <td className="p-2 uppercase font-bold text-[#2e7d57]">{r.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
