"use client";

import { useEffect, useState, useMemo } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  evaluateItem,
  type RecommendedAction,
  type ItemCondition,
} from "@/lib/decisionEngine";
import {
  type PartnerLocation,
  type PartnerType,
  DEFAULT_USER_LOCATION,
  BENGALURU_PRESET_LOCATIONS,
  FALLBACK_PARTNERS,
  haversineDistanceKm,
  getRecommendedPartnerTypes,
  PARTNER_TYPE_META,
} from "@/lib/partners-data";
import { DestinationsPageSkeleton } from "@/components/LoadingSkeleton";

// Dynamically import Leaflet Map component to guarantee client-only execution
const DestinationMap = dynamic(() => import("@/components/DestinationMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full min-h-[420px] w-full items-center justify-center rounded-md border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex flex-col items-center gap-2 text-xs text-zinc-400">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900 dark:border-zinc-700 dark:border-t-zinc-100" />
        <span>Loading OpenStreetMap Layer...</span>
      </div>
    </div>
  ),
});

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

const ACTION_LABELS: Record<RecommendedAction, string> = {
  repair: "Repair",
  reuse: "Reuse",
  donate: "Donate",
  resell: "Resell",
  refurbish: "Refurbish",
  recycle: "Recycle",
};

export default function DestinationsPage() {
  const params = useParams();
  const itemId = Array.isArray(params?.itemId) ? params.itemId[0] : (params?.itemId as string);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [item, setItem] = useState<ItemRecord | null>(null);
  const [primaryAction, setPrimaryAction] = useState<RecommendedAction>("repair");

  // Geolocation state
  const [userLocation, setUserLocation] = useState<{
    lat: number;
    lng: number;
    name: string;
    isDetected: boolean;
  }>({
    lat: DEFAULT_USER_LOCATION.lat,
    lng: DEFAULT_USER_LOCATION.lng,
    name: DEFAULT_USER_LOCATION.name,
    isDetected: false,
  });
  const [geoLocating, setGeoLocating] = useState(false);
  const [geoNotice, setGeoNotice] = useState<string | null>(null);

  // Partners data state
  const [rawPartners, setRawPartners] = useState<PartnerLocation[]>(FALLBACK_PARTNERS);
  const [filterType, setFilterType] = useState<"recommended" | "all" | PartnerType>("recommended");
  const [selectedPartnerId, setSelectedPartnerId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // 1. Fetch Item, Recommendation & Partners
  useEffect(() => {
    if (!itemId) return;

    async function loadData() {
      try {
        setLoading(true);
        setError(null);

        // Fetch item details
        const { data: itemData, error: itemError } = await supabase
          .from("items")
          .select("*")
          .eq("id", itemId)
          .single();

        if (itemError || !itemData) {
          throw new Error(itemError?.message || "Item not found in database.");
        }

        setItem(itemData);

        // Fetch recommendation
        const { data: recData } = await supabase
          .from("recommendations")
          .select("*")
          .eq("item_id", itemId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

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

        const action = recData?.recommended_action || evaluation.recommended_action;
        setPrimaryAction(action);

        // Fetch partners from Supabase (fallback to FALLBACK_PARTNERS if empty or error)
        try {
          const { data: partnerRows, error: partnerError } = await supabase
            .from("partners")
            .select("*")
            .order("name", { ascending: true });

          if (!partnerError && partnerRows && partnerRows.length > 0) {
            setRawPartners(
              partnerRows.map((p) => ({
                id: p.id,
                name: p.name,
                partner_type: p.partner_type,
                lat: Number(p.lat),
                lng: Number(p.lng),
                city: p.city,
                contact: p.contact,
                verified: p.verified ?? true,
              }))
            );
          } else {
            setRawPartners(FALLBACK_PARTNERS);
          }
        } catch {
          setRawPartners(FALLBACK_PARTNERS);
        }
      } catch (err) {
        console.error("Destinations data error:", err);
        setError(err instanceof Error ? err.message : "Failed to load destinations.");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [itemId]);

  // 2. Browser Geolocation trigger
  const detectBrowserLocation = () => {
    if (!navigator.geolocation) {
      setGeoNotice("Browser geolocation is not supported on this device. Using manual location.");
      return;
    }

    setGeoLocating(true);
    setGeoNotice(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          name: `Current Location (${pos.coords.latitude.toFixed(3)}, ${pos.coords.longitude.toFixed(3)})`,
          isDetected: true,
        });
        setGeoLocating(false);
        setGeoNotice("Successfully detected your GPS location.");
      },
      (err) => {
        console.warn("Geolocation denied or failed:", err.message);
        setGeoLocating(false);
        setGeoNotice("Location access denied or unavailable. Fallback to Bengaluru Central.");
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
    );
  };

  // 3. Compute distances & sort matching partners
  const processedPartners = useMemo(() => {
    const matchingTypes = getRecommendedPartnerTypes(primaryAction);

    return rawPartners
      .map((partner) => {
        const distance = haversineDistanceKm(
          userLocation.lat,
          userLocation.lng,
          partner.lat,
          partner.lng
        );
        return {
          ...partner,
          distanceKm: distance,
        };
      })
      .filter((partner) => {
        // Filter by category tab
        if (filterType === "recommended") {
          return matchingTypes.includes(partner.partner_type);
        }
        if (filterType === "all") {
          return true;
        }
        return partner.partner_type === filterType;
      })
      .filter((partner) => {
        // Search query filter
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (
          partner.name.toLowerCase().includes(q) ||
          partner.city.toLowerCase().includes(q) ||
          (partner.contact && partner.contact.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0));
  }, [rawPartners, primaryAction, userLocation.lat, userLocation.lng, filterType, searchQuery]);

  if (loading) {
    return <DestinationsPageSkeleton />;
  }

  if (error || !item) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="rounded-md border border-red-200 bg-red-50 p-6 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300 space-y-3">
          <div className="font-semibold text-sm">Destination Map Unavailable</div>
          <p>{error || "Unable to locate item record."}</p>
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

  const recommendedPartnerTypes = getRecommendedPartnerTypes(primaryAction);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Top Header & Breadcrumb */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-200 pb-4 dark:border-zinc-800">
        <div>
          <div className="flex items-center gap-2">
            <Link
              href={`/analyze/${itemId}/results`}
              className="text-xs text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 transition-colors"
            >
              &larr; Circularity Results
            </Link>
            <span className="text-zinc-400">&bull;</span>
            <span className="font-mono text-xs text-zinc-500 dark:text-zinc-400">
              PHASE 5: DESTINATION ROUTING
            </span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 mt-1">
            Destination Partners & Drop-Off Nodes
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Routing <span className="font-medium text-zinc-900 dark:text-zinc-200 capitalize">{item.brand ? `${item.brand} ` : ""}{item.item_type}</span> to verified partners in Bengaluru based on primary circular pathway: <strong className="text-zinc-900 dark:text-zinc-100 uppercase">{ACTION_LABELS[primaryAction] || primaryAction}</strong>.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/analyze/${itemId}/results`}
            className="inline-flex items-center justify-center rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            View Evaluation
          </Link>
          <Link
            href="/analyze"
            className="inline-flex items-center justify-center rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            + New Intake
          </Link>
        </div>
      </div>

      {/* Geolocation Toolbar */}
      <div className="rounded-md border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-medium text-zinc-700 dark:text-zinc-300">
              Origin Location:
            </span>
            <select
              value={`${userLocation.lat},${userLocation.lng}`}
              onChange={(e) => {
                const [latStr, lngStr] = e.target.value.split(",");
                const preset = BENGALURU_PRESET_LOCATIONS.find(
                  (p) => `${p.lat},${p.lng}` === e.target.value
                );
                setUserLocation({
                  lat: parseFloat(latStr),
                  lng: parseFloat(lngStr),
                  name: preset ? preset.name : "Custom Selected Area",
                  isDetected: false,
                });
                setGeoNotice(null);
              }}
              className="rounded-md border border-zinc-300 bg-white px-2.5 py-1 text-xs text-zinc-900 focus:border-zinc-900 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-100"
            >
              {BENGALURU_PRESET_LOCATIONS.map((preset) => (
                <option key={preset.name} value={`${preset.lat},${preset.lng}`}>
                  {preset.name}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={detectBrowserLocation}
              disabled={geoLocating}
              className="inline-flex items-center gap-1.5 rounded-md border border-zinc-300 bg-zinc-50 px-2.5 py-1 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
            >
              {geoLocating ? (
                <span className="h-3 w-3 animate-spin rounded-full border border-zinc-400 border-t-zinc-900" />
              ) : (
                <svg
                  className="h-3.5 w-3.5 text-zinc-600 dark:text-zinc-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                  />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              )}
              <span>{userLocation.isDetected ? "Update GPS" : "Use My GPS Location"}</span>
            </button>
          </div>

          <div className="flex items-center gap-2 font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
            <span>Straight-line Haversine routing</span>
            <span>&bull;</span>
            <span className="font-semibold text-zinc-800 dark:text-zinc-200">
              {processedPartners.length} node{processedPartners.length === 1 ? "" : "s"} found
            </span>
          </div>
        </div>

        {geoNotice && (
          <div className="rounded border border-zinc-200 bg-zinc-50 p-2 text-[11px] text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
            {geoNotice}
          </div>
        )}
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Category Tabs */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setFilterType("recommended")}
            className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
              filterType === "recommended"
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
            }`}
          >
            Recommended ({recommendedPartnerTypes.join(" & ")})
          </button>

          <button
            type="button"
            onClick={() => setFilterType("all")}
            className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
              filterType === "all"
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
            }`}
          >
            All Partners ({rawPartners.length})
          </button>

          {(["repair", "refurbisher", "ngo", "recycler", "informal"] as PartnerType[]).map(
            (typeKey) => {
              const meta = PARTNER_TYPE_META[typeKey];
              return (
                <button
                  key={typeKey}
                  type="button"
                  onClick={() => setFilterType(typeKey)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                    filterType === typeKey
                      ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                      : "border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
                  }`}
                >
                  {meta.label}
                </button>
              );
            }
          )}
        </div>

        {/* Search input */}
        <div className="relative">
          <input
            type="text"
            placeholder="Search by name, area, or contact..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-64 rounded-md border border-zinc-300 bg-white px-3 py-1 text-xs text-zinc-900 placeholder-zinc-400 focus:border-zinc-900 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-100"
          />
        </div>
      </div>

      {/* Main 2-Column Content (Map + Sidebar) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Sorted Partner List (5 cols) */}
        <div className="lg:col-span-5 space-y-3 max-h-[580px] overflow-y-auto pr-1">
          {processedPartners.length === 0 ? (
            <div className="rounded-md border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900 space-y-2 text-xs text-zinc-500">
              <p className="font-semibold text-zinc-800 dark:text-zinc-200">
                No matching destination partners found
              </p>
              <p>Try switching to &quot;All Partners&quot; or clearing search terms.</p>
              <button
                type="button"
                onClick={() => {
                  setFilterType("all");
                  setSearchQuery("");
                }}
                className="mt-2 inline-flex rounded-md bg-zinc-900 px-3 py-1 text-xs text-white dark:bg-zinc-100 dark:text-zinc-900"
              >
                Show All 20 Partners
              </button>
            </div>
          ) : (
            processedPartners.map((partner) => {
              const meta = PARTNER_TYPE_META[partner.partner_type];
              const isSelected = partner.id === selectedPartnerId;
              const isInformal = meta.classification === "Informal";

              return (
                <div
                  key={partner.id}
                  onClick={() => setSelectedPartnerId(partner.id)}
                  className={`cursor-pointer rounded-md border p-3.5 space-y-2 transition-all ${
                    isSelected
                      ? "border-zinc-900 bg-zinc-50 shadow-sm ring-1 ring-zinc-900 dark:border-zinc-100 dark:bg-zinc-900 dark:ring-zinc-100"
                      : "border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50/50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase ${meta.bgClass} ${meta.textClass} border ${meta.borderClass}`}
                        >
                          {meta.label}
                        </span>
                        <span
                          className={`rounded px-1.5 py-0.5 font-mono text-[10px] ${
                            isInformal
                              ? "border border-dashed border-zinc-400 bg-zinc-100 text-zinc-700 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                              : "border border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400"
                          }`}
                        >
                          {meta.classification}
                        </span>
                        {partner.verified && (
                          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                            ✓ Verified
                          </span>
                        )}
                      </div>
                      <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 leading-snug pt-0.5">
                        {partner.name}
                      </h3>
                    </div>

                    <div className="text-right flex-shrink-0">
                      <div className="font-mono text-xs font-bold text-zinc-900 dark:text-zinc-100">
                        {partner.distanceKm} km
                      </div>
                      <div className="text-[10px] text-zinc-400 font-mono">straight-line</div>
                    </div>
                  </div>

                  {partner.contact && (
                    <div className="text-[11px] text-zinc-600 dark:text-zinc-400 border-t border-zinc-100 pt-1.5 dark:border-zinc-800 font-mono">
                      {partner.contact}
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-1 text-xs">
                    <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                      City: {partner.city}
                    </span>
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${partner.lat},${partner.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1 rounded bg-zinc-900 px-2.5 py-1 text-[11px] font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
                    >
                      <span>Get Directions</span>
                      <span>&rarr;</span>
                    </a>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Right Column: Interactive OpenStreetMap (7 cols) */}
        <div className="lg:col-span-7 space-y-3">
          <div className="h-[460px] w-full">
            <DestinationMap
              partners={processedPartners}
              userLocation={userLocation}
              selectedPartnerId={selectedPartnerId}
              onSelectPartner={(partner) => setSelectedPartnerId(partner.id)}
            />
          </div>

          {/* Map Legend & Research Classification Notice */}
          <div className="rounded-md border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 space-y-3 text-xs">
            <div className="font-semibold text-zinc-900 dark:text-zinc-100">
              Partner Legend & Classification Architecture
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-blue-600 border border-white flex-shrink-0" />
                <span className="text-zinc-600 dark:text-zinc-400">Formal Repair Lab</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-purple-600 border border-white flex-shrink-0" />
                <span className="text-zinc-600 dark:text-zinc-400">Refurbisher</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-emerald-600 border border-white flex-shrink-0" />
                <span className="text-zinc-600 dark:text-zinc-400">NGO / Donation</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-amber-600 border border-white flex-shrink-0" />
                <span className="text-zinc-600 dark:text-zinc-400">Certified Recycler</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-zinc-600 border border-dashed border-white flex-shrink-0" />
                <span className="text-zinc-600 dark:text-zinc-400">Informal Kabadiwala</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-blue-500 animate-pulse flex-shrink-0" />
                <span className="text-zinc-600 dark:text-zinc-400">Your Location</span>
              </div>
            </div>

            <div className="rounded border border-zinc-100 bg-zinc-50 p-2.5 text-[11px] text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400 leading-relaxed">
              <strong className="text-zinc-700 dark:text-zinc-300">Literature Grounding: </strong>
              Informal scrap collectors (Kabadiwalas) process over 90% of discarded urban electronics in India due to doorstep pickup convenience. RE:LOOP indexes both formal recyclers and verified informal nodes side-by-side to deliver transparent, accessible circular choices.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
