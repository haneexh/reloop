import { supabase } from "./supabase.ts";

export interface CollectionZone {
  id: string;
  name: string;
  code: string;
  center_lat: number;
  center_lng: number;
  radius_km: number;
}

export const FALLBACK_HYDERABAD_ZONES: CollectionZone[] = [
  {
    id: "00000000-0000-0000-0000-000000000001",
    name: "HITEC City & Madhapur",
    code: "ZONE-HYD-01",
    center_lat: 17.4486,
    center_lng: 78.3908,
    radius_km: 4.5,
  },
  {
    id: "00000000-0000-0000-0000-000000000002",
    name: "Gachibowli & Financial District",
    code: "ZONE-HYD-02",
    center_lat: 17.4401,
    center_lng: 78.3489,
    radius_km: 5.0,
  },
  {
    id: "00000000-0000-0000-0000-000000000003",
    name: "Kondapur & Botanical Garden",
    code: "ZONE-HYD-03",
    center_lat: 17.4699,
    center_lng: 78.3578,
    radius_km: 4.0,
  },
  {
    id: "00000000-0000-0000-0000-000000000004",
    name: "Jubilee Hills & Film Nagar",
    code: "ZONE-HYD-04",
    center_lat: 17.4319,
    center_lng: 78.4073,
    radius_km: 4.5,
  },
  {
    id: "00000000-0000-0000-0000-000000000005",
    name: "Banjara Hills & Somajiguda",
    code: "ZONE-HYD-05",
    center_lat: 17.4156,
    center_lng: 78.4357,
    radius_km: 4.5,
  },
  {
    id: "00000000-0000-0000-0000-000000000006",
    name: "Kukatpally & KPHB Colony",
    code: "ZONE-HYD-06",
    center_lat: 17.4938,
    center_lng: 78.3995,
    radius_km: 5.0,
  },
  {
    id: "00000000-0000-0000-0000-000000000007",
    name: "Begumpet & Ameerpet",
    code: "ZONE-HYD-07",
    center_lat: 17.4447,
    center_lng: 78.4664,
    radius_km: 4.0,
  },
  {
    id: "00000000-0000-0000-0000-000000000008",
    name: "Secunderabad & Paradise",
    code: "ZONE-HYD-08",
    center_lat: 17.4399,
    center_lng: 78.4983,
    radius_km: 5.0,
  },
  {
    id: "00000000-0000-0000-0000-000000000009",
    name: "Charminar & Old City",
    code: "ZONE-HYD-09",
    center_lat: 17.3616,
    center_lng: 78.4747,
    radius_km: 5.5,
  },
  {
    id: "00000000-0000-0000-0000-00000000010",
    name: "Uppal & Habsiguda",
    code: "ZONE-HYD-10",
    center_lat: 17.4042,
    center_lng: 78.5606,
    radius_km: 6.0,
  },
];

/**
 * Calculates Haversine distance in kilometers between two lat/lng pairs.
 */
export function calculateHaversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export interface ZoneResolutionResult {
  zone: CollectionZone;
  distanceKm: number;
  isWithinRadius: boolean;
  allZones: CollectionZone[];
}

/**
 * Fetches zones from live Supabase DB with graceful fallback to seeded constants.
 */
export async function getCollectionZones(): Promise<CollectionZone[]> {
  try {
    const { data, error } = await supabase
      .from("collection_zones")
      .select("id, name, code, center_lat, center_lng, radius_km")
      .order("code", { ascending: true });

    if (error || !data || data.length === 0) {
      return FALLBACK_HYDERABAD_ZONES;
    }

    return data.map((z) => ({
      id: z.id,
      name: z.name,
      code: z.code,
      center_lat: Number(z.center_lat),
      center_lng: Number(z.center_lng),
      radius_km: Number(z.radius_km),
    }));
  } catch {
    return FALLBACK_HYDERABAD_ZONES;
  }
}

/**
 * Resolves the closest municipal zone for given coordinates.
 */
export async function resolveZoneByCoordinates(
  lat: number,
  lng: number
): Promise<ZoneResolutionResult> {
  const zones = await getCollectionZones();
  return resolveZoneFromList(lat, lng, zones);
}

/**
 * Synchronous zone resolution against a pre-loaded zone list.
 */
export function resolveZoneFromList(
  lat: number,
  lng: number,
  zones: CollectionZone[] = FALLBACK_HYDERABAD_ZONES
): ZoneResolutionResult {
  if (!zones || zones.length === 0) {
    zones = FALLBACK_HYDERABAD_ZONES;
  }

  let closestZone = zones[0];
  let minDistance = Infinity;

  for (const zone of zones) {
    const dist = calculateHaversineDistanceKm(lat, lng, zone.center_lat, zone.center_lng);
    if (dist < minDistance) {
      minDistance = dist;
      closestZone = zone;
    }
  }

  return {
    zone: closestZone,
    distanceKm: Math.round(minDistance * 10) / 10,
    isWithinRadius: minDistance <= closestZone.radius_km,
    allZones: zones,
  };
}
