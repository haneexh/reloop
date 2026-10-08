"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { formatItemDisplayName, type RecommendedAction } from "@/lib/decisionEngine";
import type { SustainabilityMetrics } from "@/lib/sustainability-engine";
import type { RecoveryFacility } from "@/lib/recovery-engine";

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

interface TransferItem {
  id: string;
  facility_id: string;
  facility_name: string;
  facility_type: string;
  city: string;
  total_weight_kg: number;
  refurbished_pct: number;
  recycled_pct: number;
  residual_pct: number;
  transferred_at: string;
  breakdown?: {
    refurbished_kg: number;
    recycled_kg: number;
    residual_kg: number;
    unallocated_kg: number;
    is_complete: boolean;
  };
}

interface CandidateCollectionRecord {
  id: string;
  request_id: string;
  actual_weight_kg: number;
  verified_at: string;
}

const ACTION_COLORS: Record<RecommendedAction, { bg: string; text: string; border: string; bar: string }> = {
  repair: { bg: "bg-[#e6f2e8]", text: "text-[#2e7d57]", border: "border-[#2e7d57]/30", bar: "bg-[#2e7d57]" },
  reuse: { bg: "bg-[#f4f5f1]", text: "text-[#151817]", border: "border-[#d8ddd7]", bar: "bg-[#151817]" },
  donate: { bg: "bg-[#e6f2e8]", text: "text-[#173d2c]", border: "border-[#173d2c]/30", bar: "bg-[#173d2c]" },
  resell: { bg: "bg-[#f4f5f1]", text: "text-[#151817]", border: "border-[#6b746e]", bar: "bg-[#4B5047]" },
  refurbish: { bg: "bg-[#e6f2e8]", text: "text-[#2e7d57]", border: "border-[#2e7d57]/30", bar: "bg-[#2e7d57]" },
  recycle: { bg: "bg-[#FDF2EC]", text: "text-[#a3512b]", border: "border-[#a3512b]/30", bar: "bg-[#a3512b]" },
};

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState<"sustainability" | "transfers" | "logistics" | "items">("sustainability");
  const [userRole, setUserRole] = useState<"PUBLIC" | "DISPATCHER" | "FACILITY">("DISPATCHER");

  const [metrics, setMetrics] = useState<SustainabilityMetrics | null>(null);
  const [transfers, setTransfers] = useState<TransferItem[]>([]);
  const [facilities, setFacilities] = useState<RecoveryFacility[]>([]);
  const [items, setItems] = useState<ItemWithRecommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Transfer modal state
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [candidateRecords, setCandidateRecords] = useState<CandidateCollectionRecord[]>([]);
  const [selectedRecordIds, setSelectedRecordIds] = useState<string[]>([]);
  const [selectedFacilityId, setSelectedFacilityId] = useState<string>("");
  const [refurbPctInput, setRefurbPctInput] = useState<number>(40);
  const [recyclePctInput, setRecyclePctInput] = useState<number>(55);
  const [residualPctInput, setResidualPctInput] = useState<number>(5);
  const [transferNotesInput, setTransferNotesInput] = useState<string>("");
  const [transferSubmitting, setTransferSubmitting] = useState(false);
  const [transferError, setTransferError] = useState<string | null>(null);
  const [transferSuccess, setTransferSuccess] = useState<string | null>(null);

  // Fetch all dashboard data
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // 1. Sustainability API
      const sustRes = await fetch("/api/sustainability");
      const sustJson = await sustRes.json();
      if (sustJson.success) setMetrics(sustJson.data);

      // 2. Transfers API
      const trRes = await fetch("/api/recovery/transfers");
      const trJson = await trRes.json();
      if (trJson.success) setTransfers(trJson.data);

      // 3. Facilities API
      const facRes = await fetch("/api/recovery/facilities");
      const facJson = await facRes.json();
      if (facJson.success) setFacilities(facJson.data);

      // 4. Legacy Items
      const { data: itemData } = await supabase
        .from("items")
        .select(`*, recommendations (id, recommended_action, confidence, rationale)`)
        .order("created_at", { ascending: false });
      setItems((itemData as ItemWithRecommendation[]) || []);
    } catch (err) {
      console.error("Dashboard load error:", err);
      setError(err instanceof Error ? err.message : "Failed to load dashboard data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Open Transfer Modal
  const openTransferModal = async () => {
    setTransferError(null);
    setTransferSuccess(null);
    try {
      const { data: recs } = await supabase
        .from("collection_records")
        .select("id, request_id, actual_weight_kg, verified_at")
        .order("verified_at", { ascending: false });

      if (recs && recs.length > 0) {
        setCandidateRecords(recs.map((r) => ({
          id: r.id,
          request_id: r.request_id,
          actual_weight_kg: Number(r.actual_weight_kg),
          verified_at: r.verified_at,
        })));
        setSelectedRecordIds(recs.map((r) => r.id));
      }
      if (facilities.length > 0 && !selectedFacilityId) {
        setSelectedFacilityId(facilities[0].id);
      }
      setIsTransferModalOpen(true);
    } catch {
      setTransferError("Could not load candidate collection records.");
    }
  };

  // Selected records total weight
  const selectedBatchWeight = candidateRecords
    .filter((r) => selectedRecordIds.includes(r.id))
    .reduce((sum, r) => sum + r.actual_weight_kg, 0);

  const roundedBatchWeight = Math.round(selectedBatchWeight * 10) / 10;
  const currentAllocSum = refurbPctInput + recyclePctInput + residualPctInput;
  const isAllocationValid = currentAllocSum <= 100.01;

  // Submit Transfer
  const handleCreateTransfer = async () => {
    if (!selectedFacilityId) {
      setTransferError("Please select a destination facility.");
      return;
    }
    if (selectedRecordIds.length === 0) {
      setTransferError("Please select at least one collection record for this batch.");
      return;
    }
    if (currentAllocSum > 100.01) {
      setTransferError(`Total recovery allocation (${currentAllocSum}%) cannot exceed 100%.`);
      return;
    }

    setTransferSubmitting(true);
    setTransferError(null);

    try {
      const payload = {
        facility_id: selectedFacilityId,
        collection_record_ids: selectedRecordIds,
        transferred_weight_kg: roundedBatchWeight,
        refurbished_pct: refurbPctInput,
        recycled_pct: recyclePctInput,
        residual_pct: residualPctInput,
        notes: transferNotesInput,
        actor_role: userRole === "PUBLIC" ? "DISPATCHER" : userRole,
      };

      const res = await fetch("/api/recovery/transfers", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-role": userRole },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to commit recovery transfer.");
      }

      setTransferSuccess(`Successfully transferred ${roundedBatchWeight} kg to ${json.data.facility_name}!`);
      setTimeout(() => {
        setIsTransferModalOpen(false);
        fetchData();
      }, 1200);
    } catch (err: unknown) {
      setTransferError(err instanceof Error ? err.message : "Error creating transfer.");
    } finally {
      setTransferSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16 px-2 sm:px-4">
      {/* Top Header & Role Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#d8ddd7] pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-[#6b746e] uppercase tracking-wider mb-1">
            <Link href="/" className="hover:text-[#2e7d57]">Platform</Link>
            <span>/</span>
            <span className="text-[#151817] font-semibold">Sustainability Intelligence</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold font-display text-[#151817] tracking-tight">
            Municipal E-Waste Recovery &amp; Circular Dashboard
          </h1>
          <p className="text-xs text-[#6b746e] mt-0.5">
            Real-time mass balance, material recovery accounting, and fleet eco-efficiency.
          </p>
        </div>

        {/* View Perspective Selector */}
        <div className="flex items-center gap-2 self-start sm:self-auto bg-white border border-[#d8ddd7] rounded-sm p-1.5 text-xs font-mono">
          <span className="text-[#6b746e] text-[11px] px-1">Perspective:</span>
          <select
            value={userRole}
            onChange={(e) => setUserRole(e.target.value as "PUBLIC" | "DISPATCHER" | "FACILITY")}
            className="rounded-xs border border-[#d8ddd7] bg-[#f4f5f1] px-2 py-1 font-semibold text-[#151817]"
          >
            <option value="PUBLIC">Public Impact View</option>
            <option value="DISPATCHER">Operator: Dispatcher</option>
            <option value="FACILITY">Operator: Facility Lead</option>
          </select>
        </div>
      </div>

      {/* Public Aggregate Impact Banner */}
      {metrics && (
        <div className="rounded-sm bg-[#edf5f0] border border-[#bcdbc8] p-4 text-xs space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="font-bold text-[#1e583c] flex items-center gap-2 text-sm">
              <span>🌍</span> Public Environmental &amp; Circular Impact Summary
            </div>
            <span className="font-mono text-[11px] text-[#2e7d57]">
              Certified Records: {metrics.real_requests_count} real intake requests ({metrics.simulated_requests_count} simulated demo)
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1 font-mono">
            <div>
              <span className="text-[#6b746e] block text-[10px]">Total Diverted:</span>
              <strong className="text-base text-[#151817]">{metrics.diverted_weight_kg} kg</strong>
            </div>
            <div>
              <span className="text-[#6b746e] block text-[10px]">Recovery Rate:</span>
              <strong className="text-base text-[#2e7d57]">{metrics.recovery_rate_percent}%</strong>
            </div>
            <div>
              <span className="text-[#6b746e] block text-[10px]">Est. CO₂e Avoided:</span>
              <strong className="text-base text-[#151817]">~{metrics.estimated_co2e_avoided_kg} kg</strong>
            </div>
            <div>
              <span className="text-[#6b746e] block text-[10px]">Landfill Saved:</span>
              <strong className="text-base text-[#151817]">~{metrics.estimated_landfill_diverted_m3} m³</strong>
            </div>
          </div>
          <p className="text-[10px] text-[#6b746e] italic pt-1 border-t border-[#bcdbc8]/60">
            {metrics.environmental_methodology}
          </p>
        </div>
      )}

      {/* Tabs Navigation */}
      <div className="flex flex-wrap gap-2 border-b border-[#d8ddd7] pb-2 text-xs font-mono font-semibold">
        <button
          type="button"
          onClick={() => setActiveTab("sustainability")}
          className={`px-3 py-1.5 rounded-sm transition-colors ${
            activeTab === "sustainability"
              ? "bg-[#2e7d57] text-white"
              : "bg-white border border-[#d8ddd7] text-[#6b746e] hover:text-[#151817]"
          }`}
        >
          🌱 Circular Recovery &amp; Mass Balance
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("transfers")}
          className={`px-3 py-1.5 rounded-sm transition-colors ${
            activeTab === "transfers"
              ? "bg-[#2e7d57] text-white"
              : "bg-white border border-[#d8ddd7] text-[#6b746e] hover:text-[#151817]"
          }`}
        >
          🏭 Facility Transfers ({transfers.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("logistics")}
          className={`px-3 py-1.5 rounded-sm transition-colors ${
            activeTab === "logistics"
              ? "bg-[#2e7d57] text-white"
              : "bg-white border border-[#d8ddd7] text-[#6b746e] hover:text-[#151817]"
          }`}
        >
          🚚 Logistics &amp; Eco-Fleet
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("items")}
          className={`px-3 py-1.5 rounded-sm transition-colors ${
            activeTab === "items"
              ? "bg-[#2e7d57] text-white"
              : "bg-white border border-[#d8ddd7] text-[#6b746e] hover:text-[#151817]"
          }`}
        >
          📦 Item Assessment Registry ({items.length})
        </button>
      </div>

      {loading && (
        <div className="rounded-sm border border-[#d8ddd7] bg-white p-12 text-center">
          <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-[#2e7d57] border-t-transparent mb-3"></div>
          <div className="text-xs font-mono text-[#6b746e]">Loading Municipal Database Ledgers...</div>
        </div>
      )}

      {error && (
        <div className="rounded-sm bg-[#fdf2f2] border border-[#f5c6cb] p-4 text-xs text-[#721c24]">
          {error}
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 1: SUSTAINABILITY & CIRCULAR RECOVERY */}
      {/* ======================================================== */}
      {!loading && activeTab === "sustainability" && metrics && (
        <div className="space-y-6">
          {/* Top 6 KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-white border border-[#d8ddd7] rounded-sm p-4 text-center">
              <span className="text-[10px] font-mono uppercase text-[#6b746e] block">Collected Load</span>
              <span className="text-xl font-bold font-mono text-[#151817]">{metrics.collected_weight_kg} kg</span>
              <span className="text-[10px] text-[#6b746e] block mt-0.5">{metrics.collected_requests} pickups completed</span>
            </div>

            <div className="bg-white border border-[#d8ddd7] rounded-sm p-4 text-center">
              <span className="text-[10px] font-mono uppercase text-[#6b746e] block">Refurbished / Reuse</span>
              <span className="text-xl font-bold font-mono text-[#2e7d57]">{metrics.recovered_weight_kg} kg</span>
              <span className="text-[10px] text-[#2e7d57] block mt-0.5 font-semibold">High-value circular loop</span>
            </div>

            <div className="bg-white border border-[#d8ddd7] rounded-sm p-4 text-center">
              <span className="text-[10px] font-mono uppercase text-[#6b746e] block">Materials Recycled</span>
              <span className="text-xl font-bold font-mono text-[#151817]">{metrics.recycled_weight_kg} kg</span>
              <span className="text-[10px] text-[#6b746e] block mt-0.5">Smelting &amp; extraction</span>
            </div>

            <div className="bg-white border border-[#d8ddd7] rounded-sm p-4 text-center">
              <span className="text-[10px] font-mono uppercase text-[#6b746e] block">Landfill Residual</span>
              <span className="text-xl font-bold font-mono text-[#c26d24]">{metrics.residual_weight_kg} kg</span>
              <span className="text-[10px] text-[#6b746e] block mt-0.5">Non-recoverable slag</span>
            </div>

            <div className="bg-white border border-[#d8ddd7] rounded-sm p-4 text-center">
              <span className="text-[10px] font-mono uppercase text-[#6b746e] block">Diversion Rate</span>
              <span className="text-xl font-bold font-mono text-[#2e7d57]">{metrics.diversion_rate_percent}%</span>
              <span className="text-[10px] text-[#2e7d57] block mt-0.5 font-semibold">Kept from dump</span>
            </div>

            <div className="bg-white border border-[#d8ddd7] rounded-sm p-4 text-center">
              <span className="text-[10px] font-mono uppercase text-[#6b746e] block">Pickup Completion</span>
              <span className="text-xl font-bold font-mono text-[#151817]">{metrics.collection_completion_rate_percent}%</span>
              <span className="text-[10px] text-[#6b746e] block mt-0.5">{metrics.scheduled_requests} scheduled</span>
            </div>
          </div>

          {/* Mass Balance & Processing Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white border border-[#d8ddd7] rounded-sm p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-[#e9ede7] pb-2">
                <h3 className="text-xs font-bold uppercase font-mono text-[#151817]">
                  Material Mass Balance Allocation
                </h3>
                <span className="text-xs font-mono font-bold text-[#2e7d57]">
                  {metrics.collected_weight_kg} kg Total
                </span>
              </div>

              {/* Progress Bar Breakdown */}
              <div className="w-full bg-[#f4f5f1] h-6 rounded-xs flex overflow-hidden border border-[#d8ddd7]">
                <div
                  className="bg-[#2e7d57] text-[10px] text-white flex items-center justify-center font-mono font-bold"
                  style={{
                    width: `${metrics.collected_weight_kg > 0 ? (metrics.recovered_weight_kg / metrics.collected_weight_kg) * 100 : 0}%`,
                  }}
                  title={`Refurbished: ${metrics.recovered_weight_kg} kg`}
                >
                  {metrics.recovered_weight_kg > 0 ? `${metrics.recovered_weight_kg}kg` : ""}
                </div>
                <div
                  className="bg-[#151817] text-[10px] text-white flex items-center justify-center font-mono font-bold"
                  style={{
                    width: `${metrics.collected_weight_kg > 0 ? (metrics.recycled_weight_kg / metrics.collected_weight_kg) * 100 : 0}%`,
                  }}
                  title={`Recycled: ${metrics.recycled_weight_kg} kg`}
                >
                  {metrics.recycled_weight_kg > 0 ? `${metrics.recycled_weight_kg}kg` : ""}
                </div>
                <div
                  className="bg-[#c26d24] text-[10px] text-white flex items-center justify-center font-mono font-bold"
                  style={{
                    width: `${metrics.collected_weight_kg > 0 ? (metrics.residual_weight_kg / metrics.collected_weight_kg) * 100 : 0}%`,
                  }}
                  title={`Residual: ${metrics.residual_weight_kg} kg`}
                >
                  {metrics.residual_weight_kg > 0 ? `${metrics.residual_weight_kg}kg` : ""}
                </div>
                <div
                  className="bg-[#d8ddd7] text-[10px] text-[#6b746e] flex items-center justify-center font-mono"
                  style={{
                    width: `${metrics.collected_weight_kg > 0 ? (metrics.unprocessed_collected_kg / metrics.collected_weight_kg) * 100 : 0}%`,
                  }}
                  title={`Awaiting Transfer: ${metrics.unprocessed_collected_kg} kg`}
                >
                  {metrics.unprocessed_collected_kg > 0 ? `${metrics.unprocessed_collected_kg}kg` : ""}
                </div>
              </div>

              {/* Breakdown Legend */}
              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 bg-[#2e7d57] rounded-xs"></span>
                  <span>Refurbished: {metrics.recovered_weight_kg} kg</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 bg-[#151817] rounded-xs"></span>
                  <span>Recycled: {metrics.recycled_weight_kg} kg</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 bg-[#c26d24] rounded-xs"></span>
                  <span>Residual: {metrics.residual_weight_kg} kg</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 bg-[#d8ddd7] rounded-xs"></span>
                  <span>Awaiting Transfer: {metrics.unprocessed_collected_kg} kg</span>
                </div>
              </div>

              {userRole !== "PUBLIC" && (
                <div className="pt-2 border-t border-[#e9ede7]">
                  <button
                    type="button"
                    onClick={openTransferModal}
                    className="w-full rounded-sm bg-[#2e7d57] py-2 px-3 text-xs font-bold text-white uppercase tracking-wider hover:bg-[#246644] transition-colors"
                  >
                    + Create Facility Transfer Batch
                  </button>
                </div>
              )}
            </div>

            {/* Category Distribution */}
            <div className="bg-white border border-[#d8ddd7] rounded-sm p-5 space-y-3">
              <div className="flex items-center justify-between border-b border-[#e9ede7] pb-2">
                <h3 className="text-xs font-bold uppercase font-mono text-[#151817]">
                  E-Waste Category Distribution
                </h3>
                <span className="text-xs font-mono text-[#6b746e]">
                  {metrics.category_distribution.length} categories
                </span>
              </div>

              {metrics.category_distribution.length === 0 ? (
                <div className="p-6 text-center text-xs font-mono text-[#6b746e]">
                  Insufficient recorded data
                </div>
              ) : (
                <div className="space-y-2.5">
                  {metrics.category_distribution.slice(0, 5).map((cat) => (
                    <div key={cat.category} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="font-semibold text-[#151817]">{cat.category}</span>
                        <span className="font-mono text-[#6b746e]">
                          {cat.weight_kg} kg ({cat.percentage}%)
                        </span>
                      </div>
                      <div className="w-full bg-[#f4f5f1] h-1.5 rounded-full overflow-hidden">
                        <div
                          className="bg-[#2e7d57] h-full"
                          style={{ width: `${Math.min(100, cat.percentage)}%` }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: FACILITY TRANSFERS & CHAIN OF CUSTODY */}
      {/* ======================================================== */}
      {!loading && activeTab === "transfers" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase font-mono text-[#151817]">
              Accredited Facility Transfers Ledger ({transfers.length} Batches)
            </h2>
            {userRole !== "PUBLIC" && (
              <button
                type="button"
                onClick={openTransferModal}
                className="rounded-sm bg-[#2e7d57] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#246644]"
              >
                + New Transfer Batch
              </button>
            )}
          </div>

          {transfers.length === 0 ? (
            <div className="bg-white border border-[#d8ddd7] rounded-sm p-8 text-center space-y-3">
              <p className="text-xs font-mono text-[#6b746e]">
                No recovery facility transfers recorded in database yet.
              </p>
              {userRole !== "PUBLIC" && (
                <button
                  type="button"
                  onClick={openTransferModal}
                  className="rounded-sm bg-[#2e7d57] px-4 py-2 text-xs font-semibold text-white hover:bg-[#246644]"
                >
                  Create First Facility Transfer
                </button>
              )}
            </div>
          ) : (
            <div className="bg-white border border-[#d8ddd7] rounded-sm divide-y divide-[#e9ede7]">
              {transfers.map((t) => (
                <div key={t.id} className="p-4 space-y-2 text-xs">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <div className="font-semibold text-sm text-[#151817]">
                      {t.facility_name}
                      <span className="font-mono text-xs font-normal text-[#6b746e] ml-2">
                        [{t.facility_type.toUpperCase()}]
                      </span>
                    </div>
                    <div className="font-mono text-xs text-[#2e7d57] font-bold">
                      {t.total_weight_kg} kg Transferred
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-[11px] text-[#6b746e]">
                    <div>
                      <span>Refurbished: </span>
                      <strong className="text-[#2e7d57]">{t.refurbished_pct}%</strong>
                    </div>
                    <div>
                      <span>Recycled: </span>
                      <strong className="text-[#151817]">{t.recycled_pct}%</strong>
                    </div>
                    <div>
                      <span>Residual: </span>
                      <strong className="text-[#c26d24]">{t.residual_pct}%</strong>
                    </div>
                    <div>
                      <span>Date: </span>
                      <span>{new Date(t.transferred_at).toLocaleDateString()}</span>
                    </div>
                  </div>

                  {t.breakdown && !t.breakdown.is_complete && (
                    <div className="rounded-xs bg-[#fff3cd] border border-[#ffeeba] p-1.5 text-[10px] text-[#856404] font-mono">
                      ⚠ Incomplete recovery allocation: {t.breakdown.unallocated_kg} kg remains unallocated.
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 3: LOGISTICS & ECO-FLEET */}
      {/* ======================================================== */}
      {!loading && activeTab === "logistics" && metrics && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white border border-[#d8ddd7] rounded-sm p-5 text-center">
              <span className="text-[10px] font-mono uppercase text-[#6b746e] block">Collection Efficiency</span>
              <span className="text-2xl font-bold font-mono text-[#2e7d57]">
                {metrics.collection_efficiency_kg_per_km} kg/km
              </span>
              <p className="text-[11px] text-[#6b746e] mt-1">Payload mass harvested per transit kilometer</p>
            </div>

            <div className="bg-white border border-[#d8ddd7] rounded-sm p-5 text-center">
              <span className="text-[10px] font-mono uppercase text-[#6b746e] block">Fleet Utilization</span>
              <span className="text-2xl font-bold font-mono text-[#151817]">
                {metrics.vehicle_utilization_percent}%
              </span>
              <p className="text-[11px] text-[#6b746e] mt-1">Cargo bay capacity utilized across active fleet</p>
            </div>

            <div className="bg-white border border-[#d8ddd7] rounded-sm p-5 text-center">
              <span className="text-[10px] font-mono uppercase text-[#6b746e] block">Distance Saved vs FIFO</span>
              <span className="text-2xl font-bold font-mono text-[#2e7d57]">
                {metrics.route_distance_saved_km} km
              </span>
              <p className="text-[11px] text-[#6b746e] mt-1">Via capacity-aware 2-opt tour optimization</p>
            </div>
          </div>

          <div className="bg-white border border-[#d8ddd7] rounded-sm p-5 space-y-3">
            <h3 className="text-xs font-bold uppercase font-mono text-[#151817] border-b border-[#e9ede7] pb-2">
              Dispatch &amp; Field Operations Links
            </h3>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/dispatch"
                className="rounded-sm bg-[#151817] px-4 py-2 text-xs font-semibold text-white hover:bg-[#333a35]"
              >
                🗺 Open Dispatch &amp; Route Planner (/dispatch)
              </Link>
              <Link
                href="/collector"
                className="rounded-sm border border-[#2e7d57] px-4 py-2 text-xs font-semibold text-[#2e7d57] hover:bg-[#edf5f0]"
              >
                📱 Open Collector Mobile Cockpit (/collector)
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 4: ITEM ASSESSMENT REGISTRY (PRESERVED LEGACY VIEW) */}
      {/* ======================================================== */}
      {!loading && activeTab === "items" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-[#e9ede7] pb-2">
            <h2 className="text-xs font-bold uppercase font-mono text-[#151817]">
              Item Intake &amp; Circular Pathway Analysis ({items.length} Evaluated Hardware Records)
            </h2>
            <Link
              href="/analyze"
              className="rounded-sm bg-[#2e7d57] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#246644]"
            >
              + New Item Intake
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((item) => {
              const rec = item.recommendations?.[0];
              const action = rec?.recommended_action || "recycle";
              const colors = ACTION_COLORS[action];

              return (
                <div
                  key={item.id}
                  className="bg-white border border-[#d8ddd7] rounded-sm p-4 space-y-3 text-xs flex flex-col justify-between"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm text-[#151817]">
                        {formatItemDisplayName(item.item_type || "E-Waste", item.brand)}
                      </span>
                      <span
                        className={`rounded-xs px-2 py-0.5 text-[10px] font-mono font-bold uppercase ${colors.bg} ${colors.text} border ${colors.border}`}
                      >
                        {action}
                      </span>
                    </div>
                    <div className="text-[11px] text-[#6b746e] capitalize">
                      Condition: {item.condition?.replace("_", " ") || "Inspected"} • Age: {item.estimated_age_years ?? 3}y
                    </div>
                    {rec?.rationale && (
                      <p className="text-[11px] text-[#6b746e] line-clamp-2 italic">
                        &quot;{rec.rationale}&quot;
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#e9ede7] font-mono text-[11px]">
                    <div>
                      <span className="text-[#6b746e] block text-[10px]">Mass Avoided:</span>
                      <strong className="text-[#151817]">{item.waste_avoided_kg ?? 2.5} kg</strong>
                    </div>
                    <div>
                      <span className="text-[#6b746e] block text-[10px]">Est. CO₂e:</span>
                      <strong className="text-[#2e7d57]">~{item.co2e_saved_est ?? 15} kg</strong>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* FACILITY TRANSFER MODAL */}
      {/* ======================================================== */}
      {isTransferModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-3">
          <div className="bg-white rounded-sm border border-[#d8ddd7] max-w-lg w-full max-h-[92vh] overflow-y-auto p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-[#e9ede7] pb-3">
              <div>
                <span className="text-[10px] font-mono font-bold uppercase text-[#6b746e]">
                  Chain of Custody Handover
                </span>
                <h3 className="text-base font-bold font-display text-[#151817]">
                  Create Facility Recovery Transfer
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsTransferModalOpen(false)}
                className="text-lg font-bold text-[#6b746e] hover:text-[#151817]"
              >
                ✕
              </button>
            </div>

            {transferError && (
              <div className="rounded-sm bg-[#fdf2f2] border border-[#f5c6cb] p-2.5 text-xs text-[#721c24]">
                {transferError}
              </div>
            )}

            {transferSuccess && (
              <div className="rounded-sm bg-[#edf5f0] border border-[#bcdbc8] p-2.5 text-xs text-[#1e583c]">
                {transferSuccess}
              </div>
            )}

            {/* Destination Facility Selection */}
            <div className="space-y-1">
              <label className="block text-xs font-mono font-bold uppercase text-[#6b746e]">
                1. Select Destination Facility:
              </label>
              <select
                value={selectedFacilityId}
                onChange={(e) => setSelectedFacilityId(e.target.value)}
                className="w-full rounded-sm border border-[#d8ddd7] p-2 text-xs text-[#151817]"
              >
                {facilities.map((fac) => (
                  <option key={fac.id} value={fac.id}>
                    {fac.name} — [{fac.facility_type}] ({fac.city})
                  </option>
                ))}
              </select>
            </div>

            {/* Candidate Collection Records Checkboxes */}
            <div className="space-y-1">
              <div className="flex justify-between items-center text-xs font-mono">
                <span className="font-bold uppercase text-[#6b746e]">
                  2. Select Collected Batches:
                </span>
                <span className="font-bold text-[#2e7d57]">
                  Selected Total: {roundedBatchWeight} kg
                </span>
              </div>

              <div className="max-h-36 overflow-y-auto border border-[#d8ddd7] rounded-sm p-2 space-y-1 text-xs">
                {candidateRecords.length === 0 ? (
                  <div className="text-center text-[#6b746e] py-3 text-[11px]">
                    No unallocated collected records found.
                  </div>
                ) : (
                  candidateRecords.map((rec) => (
                    <label key={rec.id} className="flex items-center gap-2 hover:bg-[#f9faf9] p-1 rounded-xs cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedRecordIds.includes(rec.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedRecordIds([...selectedRecordIds, rec.id]);
                          } else {
                            setSelectedRecordIds(selectedRecordIds.filter((id) => id !== rec.id));
                          }
                        }}
                        className="rounded-xs"
                      />
                      <span className="font-mono">{rec.actual_weight_kg} kg</span>
                      <span className="text-[11px] text-[#6b746e]">
                        (Record: #{rec.id.slice(0, 8)} • {new Date(rec.verified_at).toLocaleDateString()})
                      </span>
                    </label>
                  ))
                )}
              </div>
            </div>

            {/* Material Recovery Breakdown */}
            <div className="space-y-2 border-t border-[#e9ede7] pt-3 text-xs">
              <div className="flex justify-between items-center font-mono">
                <span className="font-bold uppercase text-[#6b746e]">
                  3. Recovery Allocation (%):
                </span>
                <span className={`font-bold ${isAllocationValid ? "text-[#2e7d57]" : "text-[#721c24]"}`}>
                  Sum: {currentAllocSum}% {isAllocationValid ? "(Valid)" : "(Exceeds 100%)"}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[11px] text-[#2e7d57] font-semibold block">Refurbish %</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={refurbPctInput}
                    onChange={(e) => setRefurbPctInput(Number(e.target.value))}
                    className="w-full rounded-sm border border-[#d8ddd7] p-1.5 font-mono font-bold text-xs"
                  />
                  <span className="text-[10px] text-[#6b746e] block mt-0.5 font-mono">
                    ~{Math.round(roundedBatchWeight * (refurbPctInput / 100) * 10) / 10} kg
                  </span>
                </div>

                <div>
                  <label className="text-[11px] text-[#151817] font-semibold block">Recycle %</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={recyclePctInput}
                    onChange={(e) => setRecyclePctInput(Number(e.target.value))}
                    className="w-full rounded-sm border border-[#d8ddd7] p-1.5 font-mono font-bold text-xs"
                  />
                  <span className="text-[10px] text-[#6b746e] block mt-0.5 font-mono">
                    ~{Math.round(roundedBatchWeight * (recyclePctInput / 100) * 10) / 10} kg
                  </span>
                </div>

                <div>
                  <label className="text-[11px] text-[#c26d24] font-semibold block">Residual %</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={residualPctInput}
                    onChange={(e) => setResidualPctInput(Number(e.target.value))}
                    className="w-full rounded-sm border border-[#d8ddd7] p-1.5 font-mono font-bold text-xs"
                  />
                  <span className="text-[10px] text-[#6b746e] block mt-0.5 font-mono">
                    ~{Math.round(roundedBatchWeight * (residualPctInput / 100) * 10) / 10} kg
                  </span>
                </div>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1">
              <label className="block text-[11px] font-mono text-[#6b746e]">Operational Notes:</label>
              <input
                type="text"
                placeholder="Batch consignment notes..."
                value={transferNotesInput}
                onChange={(e) => setTransferNotesInput(e.target.value)}
                className="w-full rounded-sm border border-[#d8ddd7] p-1.5 text-xs text-[#151817]"
              />
            </div>

            {/* Modal Actions */}
            <div className="flex gap-2 pt-2 border-t border-[#e9ede7]">
              <button
                type="button"
                onClick={handleCreateTransfer}
                disabled={transferSubmitting || !isAllocationValid || selectedRecordIds.length === 0}
                className={`flex-1 rounded-sm py-2 px-3 text-xs font-bold uppercase tracking-wider text-white transition-colors ${
                  isAllocationValid && selectedRecordIds.length > 0 && !transferSubmitting
                    ? "bg-[#2e7d57] hover:bg-[#246644]"
                    : "bg-[#d8ddd7] text-[#6b746e] cursor-not-allowed"
                }`}
              >
                {transferSubmitting ? "Committing..." : "Confirm Facility Transfer"}
              </button>
              <button
                type="button"
                onClick={() => setIsTransferModalOpen(false)}
                className="rounded-sm border border-[#d8ddd7] px-3 py-2 text-xs font-semibold"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
