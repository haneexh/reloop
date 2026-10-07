export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import type { PartnerLocation } from "@/lib/partners-data";

// In-memory cache for recent OSM queries: key -> { timestamp, data }
const queryCache = new Map<string, { timestamp: number; data: PartnerLocation[] }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://lz4.overpass-api.de/api/interpreter",
  "https://z.overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

import { parseOsmElements, type OsmElement } from "@/lib/osm-parser";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const latStr = searchParams.get("lat");
  const lngStr = searchParams.get("lng");
  const radiusKmStr = searchParams.get("radiusKm") || "15";

  const lat = parseFloat(latStr || "");
  const lng = parseFloat(lngStr || "");
  const radiusKm = Math.min(30, Math.max(1, parseFloat(radiusKmStr) || 15));
  const radiusMeters = Math.round(radiusKm * 1000);

  if (isNaN(lat) || isNaN(lng)) {
    return NextResponse.json(
      { success: false, error: "Valid latitude and longitude coordinates are required." },
      { status: 400 }
    );
  }

  // Check in-memory cache
  const cacheKey = `${lat.toFixed(2)},${lng.toFixed(2)},${radiusKm}`;
  const cached = queryCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return NextResponse.json({
      success: true,
      source: "osm_cache",
      count: cached.data.length,
      destinations: cached.data,
    });
  }

  // Build Overpass QL query strictly covering:
  // - shop=electronics_repair or craft=electronics_repair (repair)
  // - shop=mobile_phone with repair=yes (repair)
  // - repair=electronics (repair)
  // - shop=second_hand or shop=charity (reuse/donate/resell)
  // - amenity=recycling (recycle)
  const overpassQuery = `
[out:json][timeout:10];
(
  node["shop"="electronics_repair"](around:${radiusMeters},${lat},${lng});
  way["shop"="electronics_repair"](around:${radiusMeters},${lat},${lng});
  node["craft"="electronics_repair"](around:${radiusMeters},${lat},${lng});
  way["craft"="electronics_repair"](around:${radiusMeters},${lat},${lng});
  node["repair"="electronics"](around:${radiusMeters},${lat},${lng});
  way["repair"="electronics"](around:${radiusMeters},${lat},${lng});
  node["shop"="mobile_phone"]["repair"="yes"](around:${radiusMeters},${lat},${lng});
  way["shop"="mobile_phone"]["repair"="yes"](around:${radiusMeters},${lat},${lng});
  node["shop"="second_hand"](around:${radiusMeters},${lat},${lng});
  way["shop"="second_hand"](around:${radiusMeters},${lat},${lng});
  node["shop"="charity"](around:${radiusMeters},${lat},${lng});
  way["shop"="charity"](around:${radiusMeters},${lat},${lng});
  node["amenity"="recycling"](around:${radiusMeters},${lat},${lng});
  way["amenity"="recycling"](around:${radiusMeters},${lat},${lng});
);
out center tags;
`.trim();

  let osmElements: OsmElement[] = [];
  let successfulEndpoint = "";

  for (const ep of OVERPASS_ENDPOINTS) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const res = await fetch(ep, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "ReLoopCircularApp/1.0 (+https://reloop-ashen.vercel.app)",
        },
        body: `data=${encodeURIComponent(overpassQuery)}`,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json.elements)) {
          osmElements = json.elements;
          successfulEndpoint = ep;
          break;
        }
      } else {
        console.warn(`Overpass endpoint ${ep} returned HTTP ${res.status}`);
      }
    } catch (err) {
      console.warn(`Overpass query error on ${ep}:`, err instanceof Error ? err.message : String(err));
    }
  }

  const parsed = parseOsmElements(osmElements, lat, lng, radiusKm);

  // Store in cache if successful
  if (parsed.length > 0) {
    queryCache.set(cacheKey, { timestamp: Date.now(), data: parsed });
  }

  // Graceful response (never errors out if OSM returns empty or times out)
  return NextResponse.json({
    success: true,
    source: successfulEndpoint ? "osm" : "fallback",
    count: parsed.length,
    destinations: parsed,
  });
}
