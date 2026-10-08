"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  evaluateItem,
  formatItemDisplayName,
  type DecisionResult,
  type RecommendedAction,
  type ItemCondition,
} from "@/lib/decisionEngine";

import { ResultsPageSkeleton } from "@/components/LoadingSkeleton";
import { ProcessRail } from "@/components/ProcessRail";
import { PpriMeter } from "@/components/PpriMeter";
import { PathwayComparisonTable } from "@/components/PathwayComparisonTable";

interface ItemRecord {
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
}

interface RecommendationRecord {
  id: string;
  item_id: string;
  recommended_action: RecommendedAction;
  confidence: number | null;
  rationale: string | null;
  alt_action_1: string | null;
  alt_action_2: string | null;
  created_at: string;
}

const ACTION_LABELS: Record<RecommendedAction, string> = {
  repair: "Repair",
  reuse: "Reuse",
  donate: "Donate",
  resell: "Resell",
  refurbish: "Refurbish",
  recycle: "Recycle",
};

export default function ResultsPage() {
  const params = useParams();
  const itemId = Array.isArray(params?.itemId) ? params.itemId[0] : (params?.itemId as string);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [item, setItem] = useState<ItemRecord | null>(null);
  const [recommendation, setRecommendation] = useState<RecommendationRecord | null>(null);
  const [decision, setDecision] = useState<DecisionResult | null>(null);

  useEffect(() => {
    if (!itemId) return;

    async function loadItemAndRecommendation() {
      try {
        setLoading(true);
        setError(null);

        // 1. Fetch item details
        const { data: itemData, error: itemError } = await supabase
          .from("items")
          .select("*")
          .eq("id", itemId)
          .single();

        if (itemError || !itemData) {
          throw new Error(itemError?.message || "Item not found in database.");
        }

        setItem(itemData);

        // 2. Fetch or compute recommendation
        const { data: recData } = await supabase
          .from("recommendations")
          .select("*")
          .eq("item_id", itemId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        // 3. Compute deterministic decision engine evaluation
        const condition = (itemData.condition || "functional") as ItemCondition;
        const evaluation = evaluateItem({
          item_type: itemData.item_type || "item",
          brand: itemData.brand,
          estimated_age_years: itemData.estimated_age_years,
          condition: ["functional", "cosmetic_damage", "partially_working", "severely_damaged"].includes(
            condition
          )
            ? condition
            : "functional",
          material_recoverable: true,
        });

        setDecision(evaluation);

        if (recData) {
          setRecommendation(recData);
        } else {
          // If no recommendation record exists yet, persist the calculated one
          const { data: newRec } = await supabase
            .from("recommendations")
            .insert({
              item_id: itemData.id,
              recommended_action: evaluation.recommended_action,
              confidence: evaluation.confidence,
              rationale: evaluation.rationale,
              alt_action_1: evaluation.alt_action_1,
              alt_action_2: evaluation.alt_action_2,
            })
            .select()
            .single();

          if (newRec) {
            setRecommendation(newRec);
          }
        }
      } catch (err) {
        console.error("Results load error:", err);
        setError(err instanceof Error ? err.message : "Failed to load item analysis.");
      } finally {
        setLoading(false);
      }
    }

    loadItemAndRecommendation();
  }, [itemId]);

  if (loading) {
    return <ResultsPageSkeleton />;
  }

  if (error || !item || !decision) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="rounded-sm border border-[#a3512b]/40 bg-[#fff2ed] p-6 text-xs text-[#a3512b] space-y-3">
          <div className="font-semibold text-sm">Assessment Not Available</div>
          <p>{error || "Unable to retrieve the requested item record."}</p>
          <div className="pt-2 flex gap-3">
            <Link
              href="/analyze"
              className="inline-flex items-center justify-center rounded-sm bg-[#2e7d57] px-4 py-2 text-xs font-semibold text-white hover:bg-[#246644]"
            >
              Start New Intake
            </Link>
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-sm border border-[#d8ddd7] bg-white px-4 py-2 text-xs font-medium text-[#151817] hover:bg-[#e9ede7]"
            >
              Return to Overview
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const primaryAction = recommendation?.recommended_action || decision.recommended_action;
  const rationale = recommendation?.rationale || decision.rationale;
  const confidencePct = Math.round((recommendation?.confidence ?? decision.confidence) * 100);
  const itemDisplayName = formatItemDisplayName(item.brand, item.item_type);

  // Format numbers
  const formattedRepair = `₹${(item.repair_cost_est ?? decision.repair_cost_est).toLocaleString("en-IN")}`;
  const formattedResale = `₹${(item.resale_value_est ?? decision.resale_value_est).toLocaleString("en-IN")}`;
  const co2eSaved = item.co2e_saved_est ?? decision.co2e_saved_kg;
  const wasteDiverted = item.waste_avoided_kg ?? decision.waste_avoided_kg;

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      {/* 4-Step Process Rail */}
      <ProcessRail active={3} />

      {/* Top Navigation & Title Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#d8ddd7] pb-4">
        <div>
          <div className="flex items-center gap-2 font-mono text-xs text-[#6b746e]">
            <Link href="/analyze" className="hover:text-[#151817] transition-colors">
              &larr; Intake Assessment
            </Link>
            <span>|</span>
            <span>RECORD: {item.id.slice(0, 8)}</span>
          </div>
          <h1 className="text-2xl font-bold font-display text-[#151817] mt-1">
            Here is what makes the most sense next.
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/analyze"
            className="inline-flex items-center justify-center rounded-sm border border-[#d8ddd7] bg-white px-3.5 py-1.5 text-xs font-medium text-[#151817] transition-colors hover:bg-[#e9ede7]"
          >
            + New Intake
          </Link>
          <button
            onClick={() => window.print()}
            type="button"
            className="inline-flex items-center justify-center rounded-sm border border-[#d8ddd7] bg-white px-3.5 py-1.5 text-xs font-medium text-[#151817] transition-colors hover:bg-[#e9ede7]"
          >
            Print Spec Sheet
          </button>
        </div>
      </div>

      {/* ======================================================================= */}
      {/* SECTION 1: PRIMARY RECOMMENDATION & CONFIRMED ITEM OVERVIEW */}
      {/* ======================================================================= */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-px bg-[#d8ddd7] border border-[#d8ddd7] rounded-sm overflow-hidden">
        {/* Left Side: Recommended Action Hero */}
        <div className="lg:col-span-7 bg-[#173d2c] text-white p-6 sm:p-8 flex flex-col justify-between space-y-6">
          <div className="space-y-3">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#9ec4ad]">
              Recommended Circular Pathway
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold font-display text-white leading-tight">
              {ACTION_LABELS[primaryAction] || primaryAction} this {itemDisplayName}.
            </h2>
            <p className="text-xs text-white/80 leading-relaxed pt-1">
              {rationale}
            </p>
          </div>

          <div className="flex flex-wrap items-end justify-between gap-4 border-t border-white/20 pt-4">
            <div>
              <span className="text-[10px] font-mono uppercase tracking-widest text-[#9ec4ad] block">
                Model Confidence
              </span>
              <div className="text-2xl font-bold font-display text-white">
                {confidencePct}%
              </div>
            </div>

            <Link
              href={`/analyze/${itemId}/destinations`}
              className="inline-flex items-center justify-center rounded-sm bg-white px-4 py-2.5 text-xs font-bold text-[#151817] transition-transform hover:-translate-y-0.5 hover:bg-[#f4f5f1]"
            >
              Find a Destination Partner &rarr;
            </Link>
          </div>
        </div>

        {/* Right Side: Confirmed Hardware Specs & Key KPIs */}
        <div className="lg:col-span-5 bg-white p-6 flex flex-col justify-between space-y-5">
          <div className="flex items-start gap-4">
            {/* Real Uploaded Photo Thumbnail */}
            <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-sm border border-[#d8ddd7] bg-[#f4f5f1] flex items-center justify-center">
              {item.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.image_url}
                  alt={item.item_type || "Analyzed item"}
                  className="h-full w-full object-cover"
                  onError={(e) => {
                    e.currentTarget.src = "https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?auto=format&fit=crop&w=400&q=80";
                  }}
                />
              ) : (
                <div className="text-[10px] font-mono text-[#6b746e] text-center p-1">
                  No Photo
                </div>
              )}
            </div>

            <div className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#6b746e]">
                Confirmed Information
              </span>
              <h3 className="text-base font-bold font-display text-[#151817]">
                {itemDisplayName}
              </h3>
              <p className="text-[11px] text-[#6b746e]">
                {item.estimated_age_years !== null ? `${item.estimated_age_years} yrs old` : "3.0 yrs baseline"} · Condition: {(item.condition || "functional").replace("_", " ")}
              </p>
            </div>
          </div>

          {/* 4 Stats Grid */}
          <div className="grid grid-cols-2 gap-2 border-t border-[#d8ddd7] pt-4">
            <div className="rounded-sm bg-[#f4f5f1] p-2.5">
              <span className="text-[10px] text-[#6b746e] block">Estimated Repair</span>
              <strong className="font-mono text-sm text-[#151817] font-bold">
                {formattedRepair}
              </strong>
            </div>

            <div className="rounded-sm bg-[#f4f5f1] p-2.5">
              <span className="text-[10px] text-[#6b746e] block">Estimated Resale</span>
              <strong className="font-mono text-sm text-[#151817] font-bold">
                {formattedResale}
              </strong>
            </div>

            <div className="rounded-sm bg-[#f4f5f1] p-2.5">
              <span className="text-[10px] text-[#6b746e] block">CO2e Avoided</span>
              <strong className="font-mono text-sm text-[#2e7d57] font-bold">
                {co2eSaved} kg
              </strong>
            </div>

            <div className="rounded-sm bg-[#f4f5f1] p-2.5">
              <span className="text-[10px] text-[#6b746e] block">Landfill Diverted</span>
              <strong className="font-mono text-sm text-[#151817] font-bold">
                {wasteDiverted} kg
              </strong>
            </div>
          </div>
        </div>
      </section>

      {/* ======================================================================= */}
      {/* SECTION 2: PP-RI GAUGE & 6-PATHWAY COMPARISON MATRIX */}
      {/* ======================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: 6-Pathway Tabular Comparison Table */}
        <div className="lg:col-span-8 space-y-6">
          <PathwayComparisonTable comparisons={decision.pathways} />
        </div>

        {/* Right Column: PP-RI Semi-Circular Gauge Meter */}
        <div className="lg:col-span-4 space-y-6">
          <PpriMeter score={decision.ppri_score} level={decision.ppri_level} />

          <div className="rounded-sm border border-[#d8ddd7] bg-white p-5 space-y-3">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#2e7d57] block">
              Why this result
            </span>
            <h4 className="text-sm font-bold font-display text-[#151817]">
              Deterministic, not mysterious.
            </h4>
            <p className="text-xs text-[#6b746e] leading-relaxed">
              The PP-RI score weighs repair ratio (45%), physical wear (35%), and hardware age (20%). The circular rules compare viability across all six pathways before proposing the recommended circular pathway.
            </p>
            <div className="pt-1">
              <Link
                href="/analyze"
                className="text-xs font-semibold text-[#2e7d57] hover:underline"
              >
                Assess another item &rarr;
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* ======================================================================= */}
      {/* SECTION 3: PHYSICAL FULFILLMENT BANNER */}
      {/* ======================================================================= */}
      <section className="rounded-sm border border-[#d8ddd7] bg-[#e9ede7] p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#d8ddd7] pb-3">
          <div className="font-display text-sm uppercase tracking-wider text-[#151817] font-bold">
            Fulfillment &amp; Destination Routing
          </div>
          <span className="font-mono text-[11px] text-[#6b746e]">
            40 Verified Indian Nodes (Hyderabad + Bengaluru)
          </span>
        </div>

        <p className="text-xs text-[#151817] leading-relaxed">
          Route this {itemDisplayName} to verified local repair clinics, authorized electronics refurbishers, registered community NGOs, certified recyclers, or decentralized informal scrap collectors sorted by straight-line distance.
        </p>

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <Link
            href={`/analyze/${itemId}/destinations`}
            className="inline-flex items-center justify-center rounded-sm bg-[#2e7d57] px-5 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-[#246644]"
          >
            Find Destination Partners on Map &rarr;
          </Link>
          <Link
            href="/analyze"
            className="inline-flex items-center justify-center rounded-sm border border-[#d8ddd7] bg-white px-4 py-2.5 text-xs font-medium text-[#151817] transition-colors hover:bg-[#f4f5f1]"
          >
            Analyze Another Item
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center rounded-sm border border-[#d8ddd7] bg-white px-4 py-2.5 text-xs font-medium text-[#151817] transition-colors hover:bg-[#f4f5f1]"
          >
            View Fleet Dashboard
          </Link>
        </div>
      </section>
    </div>
  );
}
