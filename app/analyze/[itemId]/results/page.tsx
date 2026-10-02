"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  evaluateItem,
  type DecisionResult,
  type RecommendedAction,
  type ItemCondition,
} from "@/lib/decisionEngine";

import { ResultsPageSkeleton } from "@/components/LoadingSkeleton";

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
        <div className="rounded-md border border-red-200 bg-red-50 p-6 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300 space-y-3">
          <div className="font-semibold text-sm">Assessment Not Available</div>
          <p>{error || "Unable to retrieve the requested item record."}</p>
          <div className="pt-2 flex gap-3">
            <Link
              href="/analyze"
              className="inline-flex items-center justify-center rounded-md bg-zinc-900 px-4 py-2 text-xs font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900"
            >
              Analyze an Item
            </Link>
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-md border border-zinc-300 bg-white px-4 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
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
  const alt1 = recommendation?.alt_action_1 || decision.alt_action_1;
  const alt2 = recommendation?.alt_action_2 || decision.alt_action_2;

  // Format numbers
  const formattedRepair = `₹${(item.repair_cost_est ?? decision.repair_cost_est).toLocaleString("en-IN")}`;
  const formattedResale = `₹${(item.resale_value_est ?? decision.resale_value_est).toLocaleString("en-IN")}`;
  const co2eSaved = item.co2e_saved_est ?? decision.co2e_saved_kg;
  const wasteDiverted = item.waste_avoided_kg ?? decision.waste_avoided_kg;

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      {/* Top Navigation & Status Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-200 pb-4 dark:border-zinc-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center rounded border border-zinc-200 bg-zinc-100 px-2 py-0.5 font-mono text-[11px] font-medium text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
              PHASE 4 ACTIVE
            </span>
            <span className="text-xs text-zinc-400">&bull;</span>
            <span className="font-mono text-xs text-zinc-500 dark:text-zinc-400">
              ID: {item.id.slice(0, 8)}...
            </span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 mt-1">
            Circularity Assessment & Lifecycle Routing
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/analyze"
            className="inline-flex items-center justify-center rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            + New Intake
          </Link>
          <button
            onClick={() => window.print()}
            type="button"
            className="inline-flex items-center justify-center rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Print Summary
          </button>
        </div>
      </div>

      {/* ======================================================================= */}
      {/* SECTION 1: ITEM OVERVIEW & CORE METRICS BAR */}
      {/* ======================================================================= */}
      <section className="rounded-md border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-center">
          {/* Photo Preview / Badge */}
          <div className="flex items-center gap-4 md:col-span-2">
            <div className="h-24 w-24 flex-shrink-0 overflow-hidden rounded-md border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 flex items-center justify-center">
              {item.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.image_url}
                  alt={item.item_type || "Analyzed item"}
                  className="h-full w-full object-contain"
                />
              ) : (
                <div className="text-[11px] font-mono text-zinc-400 text-center p-2">
                  No Photo
                </div>
              )}
            </div>

            <div className="space-y-1">
              <div className="text-xs font-mono uppercase tracking-wider text-zinc-400">
                {item.brand || "Unspecified Brand"}
              </div>
              <h2 className="text-lg font-semibold capitalize text-zinc-900 dark:text-zinc-100">
                {item.item_type}
              </h2>
              <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                <span className="inline-flex items-center rounded border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[11px] font-medium capitalize text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
                  Condition: {(item.condition || "functional").replace("_", " ")}
                </span>
                <span className="inline-flex items-center rounded border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[11px] font-mono text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
                  Age: {item.estimated_age_years !== null ? `${item.estimated_age_years} yrs` : "Unknown"}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Stat: Financial Baseline */}
          <div className="rounded-md border border-zinc-100 bg-zinc-50/80 p-3.5 dark:border-zinc-800 dark:bg-zinc-950/60 space-y-1">
            <div className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
              Fair Secondary Value
            </div>
            <div className="text-xl font-bold font-mono text-zinc-900 dark:text-zinc-100">
              {formattedResale}
            </div>
            <div className="text-[11px] text-zinc-500 font-mono">
              Est. Repair: {formattedRepair}
            </div>
          </div>

          {/* Quick Stat: Environmental Baseline */}
          <div className="rounded-md border border-zinc-100 bg-zinc-50/80 p-3.5 dark:border-zinc-800 dark:bg-zinc-950/60 space-y-1">
            <div className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
              Avoided Carbon & Waste
            </div>
            <div className="text-xl font-bold font-mono text-zinc-900 dark:text-zinc-100">
              {co2eSaved} kg CO₂e
            </div>
            <div className="text-[11px] text-zinc-500 font-mono">
              Diverts: {wasteDiverted} kg e-waste
            </div>
          </div>
        </div>
      </section>

      {/* ======================================================================= */}
      {/* SECTION 2: PRIMARY RECOMMENDATION & RATIONALE */}
      {/* ======================================================================= */}
      <section className="rounded-md border-2 border-zinc-900 bg-zinc-900 text-white p-6 dark:border-zinc-100 dark:bg-zinc-950 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800 pb-3 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono uppercase tracking-wider text-zinc-400">
              Primary Lifecycle Recommendation
            </span>
          </div>
          <div className="inline-flex items-center gap-1.5 rounded border border-zinc-700 bg-zinc-800/80 px-2.5 py-0.5 font-mono text-xs text-zinc-200">
            <span>Confidence:</span>
            <span className="font-semibold text-white">{confidencePct}%</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
          <div className="md:col-span-2 space-y-2">
            <div className="flex items-center gap-3">
              <span className="rounded-md bg-white px-3 py-1 text-sm font-bold uppercase tracking-wider text-zinc-950 dark:bg-zinc-100 dark:text-zinc-900">
                {ACTION_LABELS[primaryAction] || primaryAction}
              </span>
              <span className="text-xs text-zinc-400">
                Ranked #1 of 6 circular routes
              </span>
            </div>
            <p className="text-sm leading-relaxed text-zinc-200 font-normal pt-1">
              {rationale}
            </p>
          </div>

          {/* Alternative Routes Box */}
          <div className="rounded-md border border-zinc-800 bg-zinc-800/50 p-3.5 space-y-2 text-xs">
            <div className="font-mono text-[11px] uppercase tracking-wider text-zinc-400">
              Secondary Alternatives
            </div>
            <div className="space-y-1.5">
              {alt1 && (
                <div className="flex items-center justify-between rounded border border-zinc-700/60 bg-zinc-900/60 px-2.5 py-1.5">
                  <span className="text-zinc-300 font-medium capitalize">
                    {ACTION_LABELS[alt1 as RecommendedAction] || alt1}
                  </span>
                  <span className="font-mono text-[10px] text-zinc-400">Option 2</span>
                </div>
              )}
              {alt2 && (
                <div className="flex items-center justify-between rounded border border-zinc-700/60 bg-zinc-900/60 px-2.5 py-1.5">
                  <span className="text-zinc-300 font-medium capitalize">
                    {ACTION_LABELS[alt2 as RecommendedAction] || alt2}
                  </span>
                  <span className="font-mono text-[10px] text-zinc-400">Option 3</span>
                </div>
              )}
              {!alt1 && !alt2 && (
                <div className="text-zinc-400 italic">No alternative routes viable.</div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ======================================================================= */}
      {/* SECTION 3: POST-PURCHASE REPAIRABILITY INDEX (PP-RI) & WEIGHTS */}
      {/* ======================================================================= */}
      <section className="rounded-md border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 pb-4 dark:border-zinc-800">
          <div>
            <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
              Post-Purchase Repairability Index (PP-RI)
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Deterministic 0–10 score evaluating economic feasibility, hardware condition, and component longevity.
            </p>
          </div>
          <div className="inline-flex items-center rounded border border-zinc-200 bg-zinc-50 px-2.5 py-1 font-mono text-xs font-semibold text-zinc-800 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
            {decision.ppri_level}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
          {/* PP-RI Gauge Block */}
          <div className="flex flex-col items-center justify-center rounded-md border border-zinc-100 bg-zinc-50 p-6 dark:border-zinc-800 dark:bg-zinc-950 space-y-2 text-center">
            <div className="text-xs font-mono uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              PP-RI Composite Score
            </div>
            <div className="flex items-baseline gap-1 font-mono">
              <span className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                {decision.ppri_score.toFixed(1)}
              </span>
              <span className="text-lg font-medium text-zinc-400">/ 10</span>
            </div>

            {/* Score Bar */}
            <div className="w-full bg-zinc-200 h-2 rounded-full overflow-hidden dark:bg-zinc-800 mt-2">
              <div
                className="bg-zinc-900 dark:bg-zinc-100 h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(5, decision.ppri_score * 10))}%` }}
              />
            </div>

            <div className="flex justify-between w-full text-[10px] font-mono text-zinc-400 pt-1">
              <span>0.0 (Scrap)</span>
              <span>5.0 (Moderate)</span>
              <span>10.0 (Optimal)</span>
            </div>
          </div>

          {/* Three Weight Breakdown Components */}
          <div className="md:col-span-2 space-y-3.5">
            <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Weight Component Breakdown (Sums to 100%)
            </div>

            {/* Component 1: Cost Ratio */}
            <div className="rounded-md border border-zinc-100 bg-zinc-50/60 p-3 dark:border-zinc-800 dark:bg-zinc-950/40 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-zinc-900 dark:text-zinc-100">
                  1. Economic Feasibility Ratio
                </span>
                <div className="flex items-center gap-2 font-mono text-[11px]">
                  <span className="text-zinc-500">Weight: 45%</span>
                  <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                    {decision.breakdown.cost_ratio_score.toFixed(1)} / 10
                  </span>
                </div>
              </div>
              <div className="w-full bg-zinc-200 h-1.5 rounded-full overflow-hidden dark:bg-zinc-800">
                <div
                  className="bg-zinc-700 dark:bg-zinc-300 h-full rounded-full"
                  style={{ width: `${decision.breakdown.cost_ratio_score * 10}%` }}
                />
              </div>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Repair cost ({formattedRepair}) is {Math.round(decision.breakdown.repair_cost_ratio * 100)}% of fair market value ({formattedResale}).
              </p>
            </div>

            {/* Component 2: Condition */}
            <div className="rounded-md border border-zinc-100 bg-zinc-50/60 p-3 dark:border-zinc-800 dark:bg-zinc-950/40 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-zinc-900 dark:text-zinc-100">
                  2. Physical & Hardware Condition
                </span>
                <div className="flex items-center gap-2 font-mono text-[11px]">
                  <span className="text-zinc-500">Weight: 35%</span>
                  <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                    {decision.breakdown.condition_score.toFixed(1)} / 10
                  </span>
                </div>
              </div>
              <div className="w-full bg-zinc-200 h-1.5 rounded-full overflow-hidden dark:bg-zinc-800">
                <div
                  className="bg-zinc-700 dark:bg-zinc-300 h-full rounded-full"
                  style={{ width: `${decision.breakdown.condition_score * 10}%` }}
                />
              </div>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 capitalize">
                Assessed in {(item.condition || "functional").replace("_", " ")} status.
              </p>
            </div>

            {/* Component 3: Age */}
            <div className="rounded-md border border-zinc-100 bg-zinc-50/60 p-3 dark:border-zinc-800 dark:bg-zinc-950/40 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-zinc-900 dark:text-zinc-100">
                  3. Lifecycle Age & Longevity
                </span>
                <div className="flex items-center gap-2 font-mono text-[11px]">
                  <span className="text-zinc-500">Weight: 20%</span>
                  <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                    {decision.breakdown.age_score.toFixed(1)} / 10
                  </span>
                </div>
              </div>
              <div className="w-full bg-zinc-200 h-1.5 rounded-full overflow-hidden dark:bg-zinc-800">
                <div
                  className="bg-zinc-700 dark:bg-zinc-300 h-full rounded-full"
                  style={{ width: `${decision.breakdown.age_score * 10}%` }}
                />
              </div>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Estimated hardware age: {item.estimated_age_years !== null ? `${item.estimated_age_years} years` : "3.0 years baseline"}.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ======================================================================= */}
      {/* SECTION 4: SIX-PATHWAY COMPREHENSIVE COMPARISON */}
      {/* ======================================================================= */}
      <section className="space-y-4">
        <div>
          <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            Six-Pathway Circular Lifecycle Comparison
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Evaluating all 6 circular alternatives side-by-side with economic return and environmental impact.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {decision.pathways.map((pathway) => {
            const isOptimal = pathway.action === primaryAction;
            return (
              <div
                key={pathway.action}
                className={`rounded-md border p-4.5 space-y-3 transition-colors flex flex-col justify-between ${
                  isOptimal
                    ? "border-zinc-900 bg-white ring-1 ring-zinc-900 dark:border-zinc-100 dark:bg-zinc-900 dark:ring-zinc-100"
                    : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
                }`}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                        {pathway.title}
                      </span>
                      {isOptimal && (
                        <span className="rounded bg-zinc-900 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-white dark:bg-zinc-100 dark:text-zinc-900">
                          Recommended
                        </span>
                      )}
                    </div>
                    <span
                      className={`font-mono text-[11px] px-2 py-0.5 rounded border capitalize ${
                        pathway.suitability === "optimal"
                          ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                          : pathway.suitability === "viable"
                            ? "border-zinc-300 bg-zinc-100 text-zinc-800 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                            : "border-zinc-200 bg-zinc-50 text-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-500"
                      }`}
                    >
                      {pathway.suitability.replace("_", " ")}
                    </span>
                  </div>

                  <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-normal">
                    {pathway.description}
                  </p>
                </div>

                <div className="space-y-2 pt-2 border-t border-zinc-100 dark:border-zinc-800 text-xs">
                  {/* Economic impact */}
                  <div className="rounded bg-zinc-50 p-2 dark:bg-zinc-950 space-y-0.5">
                    <div className="text-[10px] font-mono text-zinc-400 uppercase">
                      Financial Metric
                    </div>
                    <div className="font-semibold text-zinc-900 dark:text-zinc-100">
                      {pathway.economicHeadline}
                    </div>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-tight">
                      {pathway.economicDetail}
                    </p>
                  </div>

                  {/* Environmental impact */}
                  <div className="rounded bg-zinc-50 p-2 dark:bg-zinc-950 space-y-0.5">
                    <div className="text-[10px] font-mono text-zinc-400 uppercase">
                      Carbon & Material
                    </div>
                    <div className="font-semibold text-zinc-900 dark:text-zinc-100">
                      {pathway.environmentalHeadline}
                    </div>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-tight">
                      {pathway.environmentalDetail}
                    </p>
                  </div>

                  {/* Key advantage */}
                  <div className="text-[11px] text-zinc-600 dark:text-zinc-400 pt-1">
                    <span className="font-medium text-zinc-900 dark:text-zinc-200">Key Tradeoff: </span>
                    {pathway.tradeoff}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ======================================================================= */}
      {/* SECTION 5: SUSTAINABILITY VS ECONOMICS SIDE-BY-SIDE */}
      {/* ======================================================================= */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Economic Balance Card */}
        <div className="rounded-md border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900 space-y-3">
          <div className="border-b border-zinc-100 pb-2.5 dark:border-zinc-800">
            <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Economic Evaluation
            </h4>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Secondary market liquidity & recovery metrics
            </p>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b border-zinc-50 dark:border-zinc-800/60">
              <span className="text-zinc-600 dark:text-zinc-400">Fair Secondary Market Value</span>
              <span className="font-mono font-semibold text-zinc-900 dark:text-zinc-100">
                {formattedResale}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-zinc-50 dark:border-zinc-800/60">
              <span className="text-zinc-600 dark:text-zinc-400">Estimated Repair Cost</span>
              <span className="font-mono font-semibold text-zinc-900 dark:text-zinc-100">
                {formattedRepair}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-zinc-50 dark:border-zinc-800/60">
              <span className="text-zinc-600 dark:text-zinc-400">Repair-to-Value Ratio</span>
              <span className="font-mono font-semibold text-zinc-900 dark:text-zinc-100">
                {Math.round(decision.breakdown.repair_cost_ratio * 100)}%
              </span>
            </div>
            <div className="flex justify-between py-1 pt-2 font-medium">
              <span className="text-zinc-900 dark:text-zinc-100">Financial Recommendation</span>
              <span className="font-mono text-zinc-900 dark:text-zinc-100 uppercase">
                {primaryAction}
              </span>
            </div>
          </div>
        </div>

        {/* Sustainability Impact Card */}
        <div className="rounded-md border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900 space-y-3">
          <div className="border-b border-zinc-100 pb-2.5 dark:border-zinc-800">
            <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Environmental Footprint
            </h4>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Avoided cradle-to-gate manufacturing emissions
            </p>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b border-zinc-50 dark:border-zinc-800/60">
              <span className="text-zinc-600 dark:text-zinc-400">Avoided Embodied Emissions</span>
              <span className="font-mono font-semibold text-zinc-900 dark:text-zinc-100">
                {co2eSaved} kg CO₂e
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-zinc-50 dark:border-zinc-800/60">
              <span className="text-zinc-600 dark:text-zinc-400">Landfill Waste Diverted</span>
              <span className="font-mono font-semibold text-zinc-900 dark:text-zinc-100">
                {wasteDiverted} kg
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-zinc-50 dark:border-zinc-800/60">
              <span className="text-zinc-600 dark:text-zinc-400">Circular Pathway Efficiency</span>
              <span className="font-mono font-semibold text-zinc-900 dark:text-zinc-100">
                {primaryAction === "recycle" ? "Material Recovery" : "100% Hardware Retention"}
              </span>
            </div>
            <div className="flex justify-between py-1 pt-2 font-medium">
              <span className="text-zinc-900 dark:text-zinc-100">Ecological Verdict</span>
              <span className="font-mono text-zinc-900 dark:text-zinc-100">
                Positive Net Delta
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ======================================================================= */}
      {/* SECTION 6: DESTINATION PARTNERS ROUTING (PHASE 5) */}
      {/* ======================================================================= */}
      <section className="rounded-md border border-zinc-900 bg-zinc-900 text-white p-6 dark:border-zinc-100 dark:bg-zinc-950 space-y-4">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-400"></span>
            <span className="font-mono text-xs uppercase tracking-wider text-zinc-300 font-semibold">
              Phase 5 Active: Local Destination Mapping
            </span>
          </div>
          <span className="font-mono text-[11px] text-zinc-400">
            Bengaluru Partner Network
          </span>
        </div>

        <p className="text-xs text-zinc-300 leading-relaxed">
          Connect directly with verified local repair technicians, authorized electronics refurbishers, registered community NGOs, certified e-waste processors, and verified informal kabadiwala collection points sorted by straight-line distance from your location.
        </p>

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <Link
            href={`/analyze/${itemId}/destinations`}
            className="inline-flex items-center justify-center rounded-md bg-white px-5 py-2 text-xs font-semibold text-zinc-950 transition-colors hover:bg-zinc-100 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-200"
          >
            Find Destination Partners on Map &rarr;
          </Link>
          <Link
            href="/analyze"
            className="inline-flex items-center justify-center rounded-md border border-zinc-700 bg-zinc-800/80 px-4 py-2 text-xs font-medium text-zinc-200 transition-colors hover:bg-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
          >
            Analyze Another Item
          </Link>
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-zinc-700 bg-zinc-800/80 px-4 py-2 text-xs font-medium text-zinc-200 transition-colors hover:bg-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
          >
            Back to Overview
          </Link>
        </div>
      </section>
    </div>
  );
}
