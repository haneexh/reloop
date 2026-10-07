"use client";

import { useEffect, useState, useMemo } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  evaluateItem,
  formatItemDisplayName,
  type RecommendedAction,
  type ItemCondition,
} from "@/lib/decisionEngine";
import {
  type PartnerLocation,
  type PartnerType,
  DEFAULT_USER_LOCATION,
  PRESET_LOCATIONS,
  MAJOR_INDIAN_CITIES,
  HYDERABAD_PRESET_LOCATIONS,
  BENGALURU_PRESET_LOCATIONS,
  FALLBACK_PARTNERS,
  MAX_LOCAL_RADIUS_KM,
  haversineDistanceKm,
  resolveIndianCityLocation,
  getRecommendedPartnerTypes,
  mergeOsmWithFallbackPartners,
  PARTNER_TYPE_META,
} from "@/lib/partners-data";
import { DestinationsPageSkeleton } from "@/components/LoadingSkeleton";
import { ProcessRail } from "@/components/ProcessRail";

// Dynamically import Leaflet Map component to guarantee client-only execution
const DestinationMap = dynamic(() => import("@/components/DestinationMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full min-h-[420px] w-full items-center justify-center rounded-sm border border-[#d8ddd7] bg-white">
      <div className="flex flex-col items-center gap-2 text-xs text-[#6b746e]">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#d8ddd7] border-t-[#151817]" />
        <span className="font-mono">Loading OpenStreetMap tiles...</span>
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
  } | null>({
    lat: DEFAULT_USER_LOCATION.lat,
    lng: DEFAULT_USER_LOCATION.lng,
    name: DEFAULT_USER_LOCATION.name,
    isDetected: false,
  });
  const [geoLocating, setGeoLocating] = useState<boolean>(true);
  const [geoNotice, setGeoNotice] = useState<string | null>(null);
  const [customCityInput, setCustomCityInput] = useState<string>("");

  // Partners data state
  const [rawPartners, setRawPartners] = useState<PartnerLocation[]>(FALLBACK_PARTNERS);
  const [osmPartners, setOsmPartners] = useState<PartnerLocation[]>([]);
  const [osmLoading, setOsmLoading] = useState<boolean>(false);
  const [filterType, setFilterType] = useState<"recommended" | "all" | PartnerType>("recommended");
  const [selectedPartnerId, setSelectedPartnerId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch real-world Overpass OSM locations when userLocation changes
  useEffect(() => {
    if (!userLocation) {
      setOsmPartners([]);
      return;
    }

    const currentLoc = userLocation;
    let isCurrent = true;
    async function loadOsmData() {
      try {
        setOsmLoading(true);
        const res = await fetch(
          `/api/osm-destinations?lat=${currentLoc.lat}&lng=${currentLoc.lng}&radiusKm=15`
        );
        if (res.ok) {
          const json = await res.json();
          if (isCurrent && Array.isArray(json.destinations)) {
            setOsmPartners(json.destinations);
          }
        }
      } catch {
        if (isCurrent) setOsmPartners([]);
      } finally {
        if (isCurrent) setOsmLoading(false);
      }
    }

    loadOsmData();
    return () => {
      isCurrent = false;
    };
  }, [userLocation]);

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
          throw new Error(itemError?.message || "Item record was not found in the database.");
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

  // 2. Browser Geolocation on mount (with 8s timeout)
  useEffect(() => {
    if (typeof window === "undefined") return;

    if (!navigator.geolocation) {
      setGeoLocating(false);
      setGeoNotice("Browser geolocation is not supported on this device. Showing Hyderabad by default.");
      return;
    }

    setGeoLocating(true);
    setGeoNotice(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          name: `Live GPS (${pos.coords.latitude.toFixed(3)}, ${pos.coords.longitude.toFixed(3)})`,
          isDetected: true,
        });
        setGeoLocating(false);
        setGeoNotice("GPS location verified. Sorting by nearest straight-line distance.");
      },
      (err) => {
        console.warn("Initial geolocation prompt:", err.message);
        setGeoLocating(false);
        setGeoNotice(
          "Location access was not granted or timed out. Showing Hyderabad by default - select your city or area below to re-sort."
        );
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
    );
  }, []);

  // Manual Geolocation re-trigger
  const detectBrowserLocation = () => {
    if (!navigator.geolocation) {
      setGeoNotice("Browser geolocation is not supported on this device. Using preset location.");
      return;
    }

    setGeoLocating(true);
    setGeoNotice(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          name: `Live GPS (${pos.coords.latitude.toFixed(3)}, ${pos.coords.longitude.toFixed(3)})`,
          isDetected: true,
        });
        setGeoLocating(false);
        setGeoNotice("GPS location verified. Sorting by nearest straight-line distance.");
      },
      (err) => {
        console.warn("Geolocation denied or failed:", err.message);
        setGeoLocating(false);
        setGeoNotice("Location access was denied or timed out. Please choose your city or area from the list below.");
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
    );
  };

  // Handle custom city / area text input submit
  const handleCustomCitySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customCityInput.trim()) return;

    const matched = resolveIndianCityLocation(customCityInput);
    if (matched) {
      setUserLocation({
        lat: matched.lat,
        lng: matched.lng,
        name: matched.name,
        isDetected: false,
      });
      setGeoNotice(`Centered on ${matched.name}. Partners re-sorted.`);
      setCustomCityInput("");
    } else {
      setGeoNotice(`Could not match "${customCityInput}". Please select a city from the dropdown list.`);
    }
  };

  // 3. Merge Live OSM with Fallback Partners and compute distances
  const { mergedList, liveOsmTotal } = useMemo(() => {
    if (!userLocation) {
      return {
        mergedList: rawPartners.map((p) => ({ ...p, source: "verified" as const, isLiveOsm: false })),
        liveOsmTotal: 0,
        verifiedTotal: rawPartners.length,
      };
    }

    const fallbackWithDist: PartnerLocation[] = rawPartners.map((p) => ({
      ...p,
      distanceKm: haversineDistanceKm(userLocation.lat, userLocation.lng, p.lat, p.lng),
      source: "verified" as const,
      isLiveOsm: false,
    }));

    const osmWithDist: PartnerLocation[] = osmPartners.map((p) => ({
      ...p,
      distanceKm:
        p.distanceKm !== undefined
          ? p.distanceKm
          : haversineDistanceKm(userLocation.lat, userLocation.lng, p.lat, p.lng),
      source: "osm" as const,
      isLiveOsm: true,
    }));

    const { merged, liveOsmCount, verifiedCount } = mergeOsmWithFallbackPartners(
      osmWithDist,
      fallbackWithDist
    );

    return {
      mergedList: merged,
      liveOsmTotal: liveOsmCount,
      verifiedTotal: verifiedCount,
    };
  }, [rawPartners, osmPartners, userLocation]);

  const processedPartners = useMemo(() => {
    const matchingTypes = getRecommendedPartnerTypes(primaryAction);

    return mergedList
      .filter((partner) => {
        if (filterType === "recommended") {
          return matchingTypes.includes(partner.partner_type);
        }
        if (filterType === "all") {
          return true;
        }
        return partner.partner_type === filterType;
      })
      .filter((partner) => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (
          partner.name.toLowerCase().includes(q) ||
          partner.city.toLowerCase().includes(q) ||
          (partner.contact && partner.contact.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => {
        if (userLocation && a.distanceKm !== undefined && b.distanceKm !== undefined) {
          return a.distanceKm - b.distanceKm;
        }
        return a.name.localeCompare(b.name);
      });
  }, [mergedList, primaryAction, userLocation, filterType, searchQuery]);

  // 4. Graceful distance detection: check if NO partner is within local radius (50km)
  const isOutsideLocalCoverage = useMemo(() => {
    if (!userLocation || processedPartners.length === 0) return false;
    return processedPartners.every(
      (p) => p.distanceKm !== undefined && p.distanceKm > MAX_LOCAL_RADIUS_KM
    );
  }, [processedPartners, userLocation]);

  const nearestPartner = processedPartners[0];

  if (loading) {
    return <DestinationsPageSkeleton />;
  }

  if (error || !item) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="rounded-sm border border-[#a3512b] bg-white p-6 text-xs text-[#151817] space-y-3">
          <div className="font-semibold text-sm text-[#a3512b]">Destination Map Unavailable</div>
          <p>{error || "Unable to locate item record."}</p>
          <div className="pt-2 flex gap-3">
            <Link
              href="/analyze"
              className="inline-flex items-center justify-center rounded-sm bg-[#2e7d57] px-4 py-2 text-xs font-semibold text-white hover:bg-[#246644]"
            >
              Analyze an item
            </Link>
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-sm border border-[#d8ddd7] bg-white px-4 py-2 text-xs font-medium text-[#151817] hover:border-[#2e7d57]"
            >
              Return to overview
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
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#d8ddd7] pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Link
              href={`/analyze/${itemId}/results`}
              className="text-xs text-[#6b746e] hover:text-[#151817] transition-colors"
            >
              &larr; Results
            </Link>
            <span className="text-[#6b746e]">/</span>
            <span className="font-mono text-xs text-[#6b746e]">
              ROUTING DESTINATIONS
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[#151817]">
            Destination Partners & Drop-off Nodes
          </h1>
          <p className="text-xs text-[#6b746e]">
            Routing <span className="font-medium text-[#151817]">{formatItemDisplayName(item.brand, item.item_type)}</span> for recommended pathway: <strong className="text-[#2e7d57] uppercase">{ACTION_LABELS[primaryAction] || primaryAction}</strong>.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/analyze/${itemId}/results`}
            className="inline-flex items-center justify-center rounded-sm border border-[#d8ddd7] bg-white px-3 py-1.5 text-xs font-medium text-[#151817] transition-colors hover:border-[#2e7d57]"
          >
            View evaluation
          </Link>
          <Link
            href="/analyze"
            className="inline-flex items-center justify-center rounded-sm bg-[#2e7d57] px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#246644]"
          >
            Analyze another item
          </Link>
        </div>
      </div>

      {/* 4-Step Process Rail */}
      <ProcessRail active={4} />

      {/* Live Geolocation Mount Loading Banner */}
      {geoLocating && (
        <div className="flex items-center justify-between gap-3 rounded-sm border border-[#d8ddd7] bg-white p-3 text-xs text-[#151817]">
          <div className="flex items-center gap-2.5">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#2e7d57] border-t-transparent flex-shrink-0" />
            <span className="font-medium text-xs text-[#151817]">
              Finding destinations near you...
            </span>
          </div>
          <span className="text-[11px] text-[#6b746e] hidden sm:inline font-mono">
            Location is used only to compute straight-line distances. It is not stored.
          </span>
        </div>
      )}

      {/* Geolocation & Location Controls Toolbar */}
      <div className="rounded-sm border border-[#d8ddd7] bg-white p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Origin Picker / City Dropdown */}
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="font-medium text-[#151817]">
              Origin:
            </span>

            <select
              value={userLocation ? `${userLocation.lat},${userLocation.lng}` : "unsorted"}
              onChange={(e) => {
                if (e.target.value === "unsorted") {
                  setUserLocation(null);
                  setGeoNotice("Showing all partners unsorted.");
                  return;
                }
                const [latStr, lngStr] = e.target.value.split(",");
                const preset = PRESET_LOCATIONS.find(
                  (p) => `${p.lat},${p.lng}` === e.target.value
                );
                setUserLocation({
                  lat: parseFloat(latStr),
                  lng: parseFloat(lngStr),
                  name: preset ? preset.name : "Selected City",
                  isDetected: false,
                });
                setGeoNotice(preset ? `Centered on ${preset.name}.` : null);
              }}
              className="rounded-sm border border-[#d8ddd7] bg-white px-2.5 py-1 text-xs text-[#151817] focus:border-[#2e7d57] focus:outline-none"
            >
              <optgroup label="Major Indian Cities">
                {MAJOR_INDIAN_CITIES.map((city) => (
                  <option key={city.name} value={`${city.lat},${city.lng}`}>
                    {city.name}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Hyderabad">
                {HYDERABAD_PRESET_LOCATIONS.map((preset) => (
                  <option key={preset.name} value={`${preset.lat},${preset.lng}`}>
                    {preset.name}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Bengaluru">
                {BENGALURU_PRESET_LOCATIONS.map((preset) => (
                  <option key={preset.name} value={`${preset.lat},${preset.lng}`}>
                    {preset.name}
                  </option>
                ))}
              </optgroup>
              <optgroup label="General">
                <option value="unsorted">Unsorted (All locations)</option>
              </optgroup>
            </select>

            {/* Quick GPS Refresh Button */}
            <button
              type="button"
              onClick={detectBrowserLocation}
              disabled={geoLocating}
              className="inline-flex items-center gap-1.5 rounded-sm border border-[#d8ddd7] bg-[#f4f5f1] px-2.5 py-1 text-xs font-medium text-[#151817] transition-colors hover:bg-[#e9ede7] disabled:opacity-50"
            >
              {geoLocating ? (
                <span className="h-3 w-3 animate-spin rounded-full border border-[#6b746e] border-t-[#151817]" />
              ) : (
                <svg className="h-3.5 w-3.5 text-[#2e7d57]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              )}
              <span>{userLocation?.isDetected ? "GPS active" : "Use GPS"}</span>
            </button>

            {/* Manual City / Area Text Search */}
            <form onSubmit={handleCustomCitySubmit} className="inline-flex items-center gap-1">
              <input
                type="text"
                placeholder="Search city or area..."
                value={customCityInput}
                onChange={(e) => setCustomCityInput(e.target.value)}
                className="w-44 sm:w-52 rounded-sm border border-[#d8ddd7] bg-white px-2 py-1 text-xs text-[#151817] placeholder-[#6b746e] focus:border-[#2e7d57] focus:outline-none"
              />
              <button
                type="submit"
                className="rounded-sm bg-[#151817] px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-[#2e7d57]"
              >
                Set
              </button>
            </form>

            {/* Skip / Show Unsorted button */}
            {userLocation && (
              <button
                type="button"
                onClick={() => {
                  setUserLocation(null);
                  setGeoNotice("Location filter cleared. Showing all partners unsorted.");
                }}
                className="text-[11px] text-[#6b746e] hover:text-[#151817] underline underline-offset-2"
              >
                Clear location
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 font-mono text-[11px] text-[#6b746e]">
            {osmLoading && (
              <span className="text-[#2e7d57] flex items-center gap-1 font-sans text-xs">
                <span className="h-3 w-3 animate-spin rounded-full border border-[#2e7d57] border-t-transparent" />
                Querying OSM...
              </span>
            )}
            {liveOsmTotal > 0 && (
              <span className="rounded-sm bg-emerald-50 border border-emerald-300 px-1.5 py-0.5 text-emerald-800 font-semibold flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse" />
                {liveOsmTotal} Live OSM
              </span>
            )}
            <span>{userLocation ? "Haversine sort" : "Unsorted"}</span>
            <span>/</span>
            <span className="font-semibold text-[#151817]">
              {processedPartners.length} node{processedPartners.length === 1 ? "" : "s"}
            </span>
          </div>
        </div>

        {/* Privacy Note */}
        <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#d8ddd7] text-[11px] text-[#6b746e]">
          <div className="flex items-center gap-1.5">
            <svg className="h-3.5 w-3.5 text-[#2e7d57] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <span>
              We use your location only to find nearby circular-economy partners - it is never stored.
            </span>
          </div>
          {userLocation && (
            <span className="font-mono text-[10.5px] text-[#151817]">
              Origin: {userLocation.name}
            </span>
          )}
        </div>

        {geoNotice && (
          <div className="rounded-sm border border-[#d8ddd7] bg-[#f4f5f1] p-2 text-[11px] text-[#151817] font-mono">
            {geoNotice}
          </div>
        )}
      </div>

      {/* Graceful "No Partners Near You" Radius Notice */}
      {isOutsideLocalCoverage && (
        <div className="rounded-sm border border-[#a3512b] bg-white p-3.5 text-xs text-[#151817] flex items-start gap-3">
          <div className="mt-0.5 rounded-sm bg-[#a3512b]/10 p-1 text-[#a3512b] flex-shrink-0">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div className="space-y-1">
            <div className="font-semibold text-[#a3512b]">
              No verified partners found in your immediate area (&lt;50 km) yet
            </div>
            <p className="text-[#6b746e] text-[11.5px] leading-relaxed">
              Showing nearest available options across our network. The closest verified partner is{" "}
              <strong className="text-[#151817]">{nearestPartner?.name}</strong> located{" "}
              <span className="font-mono font-bold text-[#151817]">{nearestPartner?.distanceKm} km away</span> in{" "}
              <span>{nearestPartner?.city}</span>.
            </p>
          </div>
        </div>
      )}

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Category Tabs */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setFilterType("recommended")}
            className={`rounded-sm px-3 py-1 text-xs font-mono font-medium transition-colors ${
              filterType === "recommended"
                ? "bg-[#2e7d57] text-white"
                : "border border-[#d8ddd7] bg-white text-[#151817] hover:border-[#2e7d57]"
            }`}
          >
            Recommended ({recommendedPartnerTypes.join(" & ")})
          </button>

          <button
            type="button"
            onClick={() => setFilterType("all")}
            className={`rounded-sm px-3 py-1 text-xs font-mono font-medium transition-colors ${
              filterType === "all"
                ? "bg-[#2e7d57] text-white"
                : "border border-[#d8ddd7] bg-white text-[#151817] hover:border-[#2e7d57]"
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
                  className={`rounded-sm px-2.5 py-1 text-xs font-mono font-medium transition-colors ${
                    filterType === typeKey
                      ? "bg-[#2e7d57] text-white"
                      : "border border-[#d8ddd7] bg-white text-[#151817] hover:border-[#2e7d57]"
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
            placeholder="Search by name, city, area..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-64 rounded-sm border border-[#d8ddd7] bg-white px-3 py-1 text-xs text-[#151817] placeholder-[#6b746e] focus:border-[#2e7d57] focus:outline-none"
          />
        </div>
      </div>

      {/* Main 2-Column Content (List + Map) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Sorted Partner List (5 cols) */}
        <div className="lg:col-span-5 space-y-3 max-h-[580px] overflow-y-auto pr-1">
          {processedPartners.length === 0 ? (
            <div className="rounded-sm border border-[#d8ddd7] bg-white p-8 text-center space-y-2 text-xs text-[#6b746e]">
              <p className="font-semibold text-[#151817]">
                No matching destination partners found
              </p>
              <p>Try switching to &quot;All Partners&quot; or clearing your search term.</p>
              <button
                type="button"
                onClick={() => {
                  setFilterType("all");
                  setSearchQuery("");
                }}
                className="mt-2 inline-flex rounded-sm bg-[#2e7d57] px-3 py-1 text-xs font-semibold text-white"
              >
                Show All {rawPartners.length} Partners
              </button>
            </div>
          ) : (
            processedPartners.map((partner) => {
              const meta = PARTNER_TYPE_META[partner.partner_type];
              const isSelected = partner.id === selectedPartnerId;
              const isInformal = meta.classification === "Informal";
              const isLongDistance = (partner.distanceKm ?? 0) > MAX_LOCAL_RADIUS_KM;

              return (
                <div
                  key={partner.id}
                  onClick={() => setSelectedPartnerId(partner.id)}
                  className={`cursor-pointer rounded-sm border p-3.5 space-y-2 transition-all ${
                    isSelected
                      ? "border-[#2e7d57] bg-[#f4f5f1]"
                      : "border-[#d8ddd7] bg-white hover:border-[#2e7d57]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className={`rounded-sm px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase ${meta.bgClass} ${meta.textClass} border ${meta.borderClass}`}
                        >
                          {meta.label}
                        </span>
                        <span
                          className={`rounded-sm px-1.5 py-0.5 font-mono text-[10px] ${
                            isInformal
                              ? "border border-dashed border-[#6b746e] bg-[#e9ede7] text-[#151817]"
                              : "border border-[#d8ddd7] bg-[#f4f5f1] text-[#6b746e]"
                          }`}
                        >
                          {meta.classification}
                        </span>
                        {partner.isLiveOsm ? (
                          <span className="rounded-sm border border-emerald-300 bg-emerald-50 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-emerald-800 flex items-center gap-1">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse" />
                            Live OpenStreetMap data
                          </span>
                        ) : partner.verified ? (
                          <span className="font-mono text-[10px] text-[#2e7d57] font-semibold">
                            [VERIFIED]
                          </span>
                        ) : null}
                      </div>
                      <h3 className="text-sm font-semibold text-[#151817] leading-snug pt-0.5">
                        {partner.name}
                      </h3>
                    </div>

                    <div className="text-right flex-shrink-0">
                      {partner.distanceKm !== undefined ? (
                        <>
                          <div className={`font-mono text-xs font-bold ${isLongDistance ? "text-[#a3512b]" : "text-[#151817]"}`}>
                            {partner.distanceKm} km
                          </div>
                          <div className="text-[10px] text-[#6b746e] font-mono">
                            {isLongDistance ? "regional" : "distance"}
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="font-mono text-xs text-[#6b746e]">
                            Unsorted
                          </div>
                          <div className="text-[10px] text-[#6b746e] font-mono">
                            Directory
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {partner.contact && (
                    <div className="text-[11px] text-[#6b746e] border-t border-[#d8ddd7] pt-1.5 font-mono">
                      {partner.contact}
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-1 text-xs">
                    <span className="font-mono text-[11px] text-[#6b746e]">
                      LOC: {partner.city}
                    </span>
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${partner.lat},${partner.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1 rounded-sm bg-[#151817] px-2.5 py-1 text-[11px] font-semibold text-white transition-colors hover:bg-[#2e7d57]"
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

          {/* Map Legend */}
          <div className="rounded-sm border border-[#d8ddd7] bg-white p-4 space-y-3 text-xs">
            <div className="font-semibold text-[#151817]">
              Partner Categories & System Grounding
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 font-mono text-[11px]">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-sm bg-[#2e7d57] border border-[#d8ddd7] flex-shrink-0" />
                <span className="text-[#151817]">Formal Repair</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-sm bg-[#173d2c] border border-[#d8ddd7] flex-shrink-0" />
                <span className="text-[#151817]">Refurbisher</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-sm bg-[#4D6B53] border border-[#d8ddd7] flex-shrink-0" />
                <span className="text-[#151817]">NGO / Donation</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-sm bg-[#a3512b] border border-[#d8ddd7] flex-shrink-0" />
                <span className="text-[#151817]">Certified Recycler</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-sm bg-[#151817] border border-dashed border-[#6b746e] flex-shrink-0" />
                <span className="text-[#151817]">Informal Node</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-sm bg-[#6b746e] flex-shrink-0" />
                <span className="text-[#151817]">User Origin</span>
              </div>
            </div>

            <div className="rounded-sm border border-[#d8ddd7] bg-[#f4f5f1] p-2.5 text-[11px] text-[#6b746e] leading-relaxed">
              <strong className="text-[#151817]">Operational Note: </strong>
              Informal scrap collectors process over 90% of discarded electronics in India. RE:LOOP maps verified informal collectors alongside formal recycling plants to provide complete, realistic routing options.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
