"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { DemandIntelligenceSummary, ZoneSpatialDemand } from "@/lib/demand-engine";
import { OptimizedRoute } from "@/lib/route-optimizer";
import { DeferredRequestRecord } from "@/lib/scheduler";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

// Dynamic import for Leaflet map to prevent SSR window reference error
const DispatchRouteMap = dynamic(
  () => import("@/components/DispatchRouteMap"),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-[400px] rounded-[3px] border border-[#d8ddd7] bg-[#f4f5f1] flex items-center justify-center font-mono text-xs text-[#6b746e]">
        Initializing tactical route map...
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

  // Active step tab (1: Demand Review, 2: Collection Planning, 3: Route Review)
  const [activeWorkflowStep, setActiveWorkflowStep] = useState<1 | 2 | 3>(1);

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
      setActiveWorkflowStep(3); // Jump to route review upon generation

      if (persist) {
        setPersistSuccessMsg(
          `Successfully committed ${json.data.persisted_route_ids?.length || 0} route(s) to the fleet ledger.`
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

  const highDemandCount =
    (demandData?.planning_summary.critical_zones_count ?? 0) +
    (demandData?.planning_summary.high_demand_zones_count ?? 0);

  return (
    <div className="space-y-8">
      {/* 1. Header & Context */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-[#6b746e]">
          <Link href="/" className="hover:text-[#151817]">Home</Link>
          <span>/</span>
          <span className="text-[#151817]">Operations</span>
          <span>/</span>
          <span className="font-mono text-[#2e7d57] font-bold">Dispatch Hub</span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#d8ddd7] pb-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-display font-bold text-[#151817]">
              Collection Operations
            </h1>
            <p className="text-xs sm:text-sm text-[#6b746e] mt-1">
              Plan today&apos;s pickups based on demand, vehicle capacity and collection windows.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                loadDemandIntelligence();
                loadPersistedRoutes();
              }}
            >
              ⟳ Refresh Data
            </Button>
          </div>
        </div>
      </div>

      {/* 2. Top Summary KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 space-y-1">
          <span className="text-[11px] font-mono text-[#6b746e] uppercase block">
            Pickups to Plan
          </span>
          <div className="text-2xl font-bold font-mono text-[#151817]">
            {demandData?.planning_summary.pending_unassigned_requests ?? "-"}
          </div>
          <span className="text-[11px] text-[#6b746e] block">
            Awaiting vehicle assignment
          </span>
        </Card>

        <Card className="p-4 space-y-1">
          <span className="text-[11px] font-mono text-[#6b746e] uppercase block">
            Scheduled Weight
          </span>
          <div className="text-2xl font-bold font-mono text-[#2e7d57]">
            {demandData?.planning_summary.total_planning_weight_kg ?? "-"} <span className="text-sm font-normal">kg</span>
          </div>
          <span className="text-[11px] text-[#6b746e] block">
            Across active requests
          </span>
        </Card>

        <Card className="p-4 space-y-1">
          <span className="text-[11px] font-mono text-[#6b746e] uppercase block">
            Available Vehicles
          </span>
          <div className="text-2xl font-bold font-mono text-[#151817]">
            {routes.length > 0 ? routes.length : "6 Fleet Units"}
          </div>
          <span className="text-[11px] text-[#6b746e] block">
            Ready for route dispatch
          </span>
        </Card>

        <Card className="p-4 space-y-1">
          <span className="text-[11px] font-mono text-[#6b746e] uppercase block">
            High-Demand Areas
          </span>
          <div className="text-2xl font-bold font-mono text-[#991b1b]">
            {highDemandCount} Zones
          </div>
          <span className="text-[11px] text-[#6b746e] block">
            Prioritized for route clustering
          </span>
        </Card>
      </div>

      {demandError && (
        <div className="rounded-[3px] border border-[#f5c6cb] bg-[#fdf2f2] p-3.5 text-xs text-[#721c24]">
          <strong>Notice: </strong> {demandError}
        </div>
      )}

      {/* 3. Primary Operator Workflow Steps */}
      <div className="border-b border-[#d8ddd7]">
        <div className="flex items-center gap-6 text-xs font-semibold">
          {[
            { num: 1, label: "1. Review Demand" },
            { num: 2, label: "2. Plan Collections" },
            { num: 3, label: "3. Review Routes" },
          ].map((step) => {
            const isTabActive = activeWorkflowStep === step.num;
            return (
              <button
                key={step.num}
                type="button"
                onClick={() => setActiveWorkflowStep(step.num as 1 | 2 | 3)}
                className={`pb-3 border-b-2 transition-colors ${
                  isTabActive
                    ? "border-[#2e7d57] text-[#151817] font-bold"
                    : "border-transparent text-[#6b746e] hover:text-[#151817]"
                }`}
              >
                {step.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ========================================================= */}
      {/* WORKFLOW 1: REVIEW DEMAND & FORECAST */}
      {/* ========================================================= */}
      {activeWorkflowStep === 1 && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-[#151817]">
                Neighborhood Demand Intelligence
              </h2>
              <p className="text-xs text-[#6b746e]">
                Current verified intake density and spatial concentration across municipal zones.
              </p>
            </div>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => setActiveWorkflowStep(2)}
            >
              Proceed to Plan Collections &rarr;
            </Button>
          </div>

          {isLoadingDemand ? (
            <Card className="p-8 text-center font-mono text-xs text-[#6b746e]">
              Loading neighborhood demand data...
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {demandData?.spatial.map((zone: ZoneSpatialDemand) => {
                const forecast = demandData.forecasts.find((f) => f.zone_id === zone.zone_id);
                const level = forecast?.demand_level || "LOW";
                const isCritical = level === "CRITICAL" || level === "HIGH";

                return (
                  <Card
                    key={zone.zone_id}
                    className={`p-4 space-y-3 transition-colors ${
                      isCritical ? "border-[#f5c6cb] bg-[#fffaf9]" : "bg-white"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-[10px] font-mono text-[#6b746e] uppercase block">
                          {zone.zone_code}
                        </span>
                        <h3 className="font-display text-sm font-bold text-[#151817]">
                          {zone.zone_name}
                        </h3>
                      </div>
                      <Badge
                        variant={level === "CRITICAL" ? "danger" : level === "HIGH" ? "warning" : "neutral"}
                        size="sm"
                      >
                        {level} DEMAND
                      </Badge>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-xs font-mono">
                      <div className="p-2 rounded-[2px] bg-[#f4f5f1]">
                        <span className="text-[10px] text-[#6b746e] block">Pickups</span>
                        <span className="font-bold text-[#151817]">{zone.request_count}</span>
                      </div>
                      <div className="p-2 rounded-[2px] bg-[#f4f5f1]">
                        <span className="text-[10px] text-[#6b746e] block">Total Load</span>
                        <span className="font-bold text-[#2e7d57]">{zone.total_estimated_weight_kg} kg</span>
                      </div>
                      <div className="p-2 rounded-[2px] bg-[#f4f5f1]">
                        <span className="text-[10px] text-[#6b746e] block">Pressure Score</span>
                        <span className="font-semibold text-[#151817]">{zone.demand_score}</span>
                      </div>
                    </div>

                    {forecast?.explanation && (
                      <p className="text-[11px] text-[#6b746e] leading-relaxed pt-1 border-t border-[#d8ddd7]">
                        {forecast.explanation}
                      </p>
                    )}
                  </Card>
                );
              })}
            </div>
          )}

          {/* Collection Demand Forecast Notice */}
          <Card className="p-5 bg-[#e9ede7] border-[#d8ddd7] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#151817] uppercase tracking-wider font-mono">
                Collection demand forecast · Baseline run-rate forecast
              </span>
              <span className="text-[11px] font-mono text-[#2e7d57]">
                Deterministic Run-Rate
              </span>
            </div>
            <p className="text-xs text-[#6b746e] leading-relaxed">
              Based on recent intake and historical collection patterns. Demand scores group nearby pickups into coherent vehicle corridors to prevent empty deadhead miles.
            </p>
          </Card>
        </div>
      )}

      {/* ========================================================= */}
      {/* WORKFLOW 2: PLAN COLLECTIONS */}
      {/* ========================================================= */}
      {activeWorkflowStep === 2 && (
        <div className="space-y-6">
          <div className="space-y-1">
            <h2 className="text-base font-bold text-[#151817]">
              Configure Collection Run
            </h2>
            <p className="text-xs text-[#6b746e]">
              Set the date and arrival window to run capacity-aware fleet scheduling.
            </p>
          </div>

          <Card className="p-5 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#151817] mb-1">
                  Collection Date
                </label>
                <input
                  type="date"
                  value={planningDate}
                  onChange={(e) => setPlanningDate(e.target.value)}
                  className="w-full rounded-[3px] border border-[#d8ddd7] bg-white p-2.5 text-xs font-mono text-[#151817] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2e7d57]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#151817] mb-1">
                  Time Window Batch
                </label>
                <select
                  value={planningSlot}
                  onChange={(e) => setPlanningSlot(e.target.value)}
                  className="w-full rounded-[3px] border border-[#d8ddd7] bg-white p-2.5 text-xs text-[#151817] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2e7d57]"
                >
                  <option value="ALL">All Available Windows (Full Day)</option>
                  <option value="09:00 - 12:00">Morning (9:00 AM – 12:00 PM)</option>
                  <option value="12:00 - 15:00">Afternoon (1:00 PM – 4:00 PM)</option>
                  <option value="15:00 - 18:00">Evening (4:00 PM – 7:00 PM)</option>
                </select>
              </div>
            </div>

            {/* Fleet Availability Card */}
            <div className="rounded-[3px] border border-[#d8ddd7] bg-[#f9faf8] p-4 space-y-3">
              <span className="text-xs font-bold text-[#151817] uppercase tracking-wider font-mono block">
                Available Fleet Vehicles
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-3 bg-white border border-[#d8ddd7] rounded-[2px] space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold font-mono">EV-VAN-01</span>
                    <Badge variant="success" size="sm">Available</Badge>
                  </div>
                  <span className="text-[#6b746e] block text-[11px]">Capacity: 400 kg · Electric</span>
                </div>

                <div className="p-3 bg-white border border-[#d8ddd7] rounded-[2px] space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold font-mono">EV-VAN-02</span>
                    <Badge variant="success" size="sm">Available</Badge>
                  </div>
                  <span className="text-[#6b746e] block text-[11px]">Capacity: 450 kg · Electric</span>
                </div>

                <div className="p-3 bg-white border border-[#d8ddd7] rounded-[2px] space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold font-mono">CNG-TRUCK-01</span>
                    <Badge variant="success" size="sm">Available</Badge>
                  </div>
                  <span className="text-[#6b746e] block text-[11px]">Capacity: 850 kg · Medium Fleet</span>
                </div>
              </div>
            </div>

            {/* Action Bar */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-[#d8ddd7]">
              <span className="text-xs text-[#6b746e]">
                Optimization methodology: Clarke-Wright heuristic with 2-Opt route smoothing.
              </span>
              <Button
                type="button"
                variant="primary"
                disabled={isOptimizing}
                onClick={() => handleGeneratePlan(false)}
                className="w-full sm:w-auto px-6 py-2.5"
              >
                {isOptimizing ? "Planning Routes..." : "Plan Collection Routes &rarr;"}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* ========================================================= */}
      {/* WORKFLOW 3: REVIEW ROUTES & DISPATCH */}
      {/* ========================================================= */}
      {activeWorkflowStep === 3 && (
        <div className="space-y-6">
          {routes.length === 0 && !isOptimizing && (
            <Card className="p-8 text-center space-y-3">
              <p className="text-sm font-semibold text-[#151817]">No routes planned yet for {planningDate}</p>
              <p className="text-xs text-[#6b746e] max-w-sm mx-auto">
                Generate collection routes using the button below or adjust your planning horizon in Step 2.
              </p>
              <Button
                type="button"
                variant="primary"
                onClick={() => handleGeneratePlan(false)}
              >
                Plan Collection Routes Now
              </Button>
            </Card>
          )}

          {optError && (
            <div className="rounded-[3px] border border-[#f5c6cb] bg-[#fdf2f2] p-4 text-xs text-[#721c24]">
              <strong>Notice: </strong> {optError}
            </div>
          )}

          {persistSuccessMsg && (
            <div className="rounded-[3px] border border-[#bcdbc8] bg-[#edf5f0] p-4 text-xs text-[#1e583c] flex items-center justify-between">
              <div>
                <strong className="font-bold">✓ Committed: </strong>
                {persistSuccessMsg}
              </div>
            </div>
          )}

          {/* Generated Solution Comparative Summary */}
          {optSummary && (
            <div className="space-y-6">
              <Card className="border-[#2e7d57] p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#d8ddd7] pb-3">
                  <div>
                    <h2 className="text-base font-bold text-[#151817]">
                      Optimization Summary: {planningDate}
                    </h2>
                    <p className="text-xs text-[#6b746e]">
                      Comparing current intake order against capacity-aware route plan.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="primary"
                    disabled={isPersisting || routes.length === 0}
                    onClick={() => {
                      setIsPersisting(true);
                      handleGeneratePlan(true);
                    }}
                  >
                    {isPersisting ? "Committing Routes..." : "✓ Commit & Dispatch Routes to Fleet"}
                  </Button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                  <div className="p-3 bg-[#f4f5f1] rounded-[3px] border border-[#d8ddd7]">
                    <span className="text-[10px] font-mono text-[#6b746e] uppercase block">Vehicles</span>
                    <span className="text-lg font-bold font-mono text-[#151817]">
                      {optSummary.total_vehicles_used}
                    </span>
                  </div>

                  <div className="p-3 bg-[#f4f5f1] rounded-[3px] border border-[#d8ddd7]">
                    <span className="text-[10px] font-mono text-[#6b746e] uppercase block">Stops Served</span>
                    <span className="text-lg font-bold font-mono text-[#151817]">
                      {optSummary.total_stops_served}
                    </span>
                  </div>

                  <div className="p-3 bg-[#f4f5f1] rounded-[3px] border border-[#d8ddd7]">
                    <span className="text-[10px] font-mono text-[#6b746e] uppercase block">Total Load</span>
                    <span className="text-lg font-bold font-mono text-[#2e7d57]">
                      {optSummary.total_load_kg} kg
                    </span>
                  </div>

                  <div className="p-3 bg-[#f4f5f1] rounded-[3px] border border-[#d8ddd7]">
                    <span className="text-[10px] font-mono text-[#6b746e] uppercase block">Optimized Dist</span>
                    <span className="text-lg font-bold font-mono text-[#151817]">
                      {optSummary.optimized_total_distance_km} km
                    </span>
                    <span className="text-[10px] text-[#6b746e] block">
                      Intake: {optSummary.baseline_total_distance_km} km
                    </span>
                  </div>

                  <div className="p-3 bg-[#edf5f0] rounded-[3px] border border-[#bcdbc8]">
                    <span className="text-[10px] font-mono text-[#1e583c] uppercase block font-bold">
                      Distance Saved
                    </span>
                    <span className="text-lg font-bold font-mono text-[#2e7d57]">
                      {optSummary.total_distance_saved_km > 0
                        ? `-${optSummary.total_distance_saved_km} km`
                        : "0 km"}
                    </span>
                    <span className="text-[10px] text-[#2e7d57] font-semibold block">
                      {optSummary.overall_distance_reduction_percent}% reduction
                    </span>
                  </div>

                  <div className="p-3 bg-[#f4f5f1] rounded-[3px] border border-[#d8ddd7]">
                    <span className="text-[10px] font-mono text-[#6b746e] uppercase block">Avg Fleet Util</span>
                    <span className="text-lg font-bold font-mono text-[#151817]">
                      {optSummary.average_capacity_utilization_percent}%
                    </span>
                  </div>
                </div>
              </Card>

              {/* Map & Vehicle Schedules Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                <div className="lg:col-span-7 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider font-mono text-[#151817]">
                      Route Traversal Map
                    </span>
                    {selectedVehicleId && (
                      <button
                        type="button"
                        onClick={() => setSelectedVehicleId(null)}
                        className="text-[11px] font-mono text-[#2e7d57] hover:underline"
                      >
                        Show All Routes
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

                <div className="lg:col-span-5 space-y-3">
                  <span className="text-xs font-bold uppercase tracking-wider font-mono text-[#151817] block">
                    Planned Vehicle Routes ({routes.length})
                  </span>

                  {routes.map((route) => {
                    const isSelected = selectedVehicleId === route.vehicle_id;
                    const isNearCap = route.utilization_percentage >= 90;

                    return (
                      <div
                        key={route.vehicle_id}
                        onClick={() => setSelectedVehicleId(isSelected ? null : route.vehicle_id)}
                        className={`p-4 rounded-[3px] border cursor-pointer space-y-3 transition-colors ${
                          isSelected
                            ? "border-[#2e7d57] bg-[#edf5f0]"
                            : "border-[#d8ddd7] bg-white hover:bg-[#f9faf8]"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm font-bold text-[#151817]">
                              {route.vehicle_code}
                            </span>
                            <span className="text-[10px] font-mono text-[#6b746e] bg-[#f4f5f1] px-1.5 py-0.5 rounded-[2px]">
                              {route.vehicle_type}
                            </span>
                          </div>
                          <span className="font-mono text-xs font-bold text-[#2e7d57]">
                            {route.total_distance_km} km
                          </span>
                        </div>

                        <p className="text-xs text-[#151817] leading-relaxed">
                          {route.explanation}
                        </p>

                        {/* Capacity Utilization Progress Bar */}
                        <div className="space-y-1">
                          <div className="flex justify-between text-[11px] font-mono">
                            <span className="text-[#6b746e]">
                              Payload: {route.total_load_kg} / {route.capacity_kg} kg
                            </span>
                            <span className={`font-semibold ${isNearCap ? "text-[#991b1b]" : "text-[#151817]"}`}>
                              {route.utilization_percentage}% capacity
                            </span>
                          </div>
                          <div className="h-1.5 w-full bg-[#d8ddd7] rounded-sm overflow-hidden">
                            <div
                              className={`h-full ${isNearCap ? "bg-[#991b1b]" : "bg-[#2e7d57]"}`}
                              style={{ width: `${Math.min(100, route.utilization_percentage)}%` }}
                            />
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-[11px] font-mono text-[#6b746e] pt-1 border-t border-[#d8ddd7]">
                          <span>{route.stops_count} pickups scheduled</span>
                          <span>~{route.estimated_duration_minutes} min duration</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Deferred Requests Notice (Crucial Operational UX) */}
              {deferredRequests.length > 0 && (
                <Card className="border-[#f5dfa8] bg-[#fffdf5] p-5 space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge variant="warning" size="sm">Needs Attention</Badge>
                        <h3 className="text-sm font-bold text-[#8a5d00]">
                          {deferredRequests.length} pickup(s) could not be assigned in this run
                        </h3>
                      </div>
                      <p className="text-xs text-[#665022] mt-1">
                        These requests exceed active vehicle capacity or conflict with available route constraints.
                      </p>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border border-[#e8dfcf] bg-white">
                      <thead className="bg-[#f4efe4] text-[#665022] font-mono text-[10px] uppercase">
                        <tr>
                          <th className="p-2 border-b border-[#e8dfcf]">Request Token</th>
                          <th className="p-2 border-b border-[#e8dfcf]">Priority</th>
                          <th className="p-2 border-b border-[#e8dfcf]">Weight</th>
                          <th className="p-2 border-b border-[#e8dfcf]">Reason</th>
                          <th className="p-2 border-b border-[#e8dfcf]">Operational Explanation</th>
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
                              {d.reason.replace(/_/g, " ")}
                            </td>
                            <td className="p-2 text-[#151817] text-[11px]">{d.explanation}</td>
                            <td className="p-2 text-[#6b746e] text-[11px] italic">{d.suggested_action}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}
            </div>
          )}
        </div>
      )}

      {/* 4. Active Dispatched Fleet Ledger */}
      {persistedRoutes.length > 0 && (
        <Card className="p-5 space-y-3">
          <CardHeader className="p-0 pb-3 border-b border-[#d8ddd7]">
            <CardTitle>Active Dispatched Routes in Ledger ({persistedRoutes.length})</CardTitle>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#f4f5f1] text-[#6b746e] font-mono text-[10px] uppercase">
                <tr>
                  <th className="p-2.5 border-b border-[#d8ddd7]">Route ID</th>
                  <th className="p-2.5 border-b border-[#d8ddd7]">Date</th>
                  <th className="p-2.5 border-b border-[#d8ddd7]">Vehicle</th>
                  <th className="p-2.5 border-b border-[#d8ddd7]">Distance</th>
                  <th className="p-2.5 border-b border-[#d8ddd7]">Load</th>
                  <th className="p-2.5 border-b border-[#d8ddd7]">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#d8ddd7] font-mono">
                {persistedRoutes.map((r) => (
                  <tr key={r.id} className="hover:bg-[#f9faf8]">
                    <td className="p-2.5">#{r.id.slice(0, 8)}</td>
                    <td className="p-2.5">{r.route_date}</td>
                    <td className="p-2.5 font-bold text-[#151817]">{r.vehicle_code}</td>
                    <td className="p-2.5">{r.total_distance_km} km</td>
                    <td className="p-2.5">{r.total_load_kg} kg</td>
                    <td className="p-2.5">
                      <Badge variant="success" size="sm">{r.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
