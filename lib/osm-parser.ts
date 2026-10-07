export type PartnerType = "repair" | "refurbisher" | "recycler" | "ngo" | "informal";

export interface PartnerLocation {
  id: string;
  name: string;
  partner_type: PartnerType;
  lat: number;
  lng: number;
  city: string;
  contact: string | null;
  verified: boolean;
  distanceKm?: number;
  source?: "osm" | "verified";
  isLiveOsm?: boolean;
  address?: string | null;
}

export interface OsmElement {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

export function haversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((R * c).toFixed(1));
}

// Non-electronics negative keyword filters to weed out mis-tagged OSM entries
export const REPAIR_NEGATIVE_KEYWORDS = [
  "pump",
  "borewell",
  "bore well",
  "laundry",
  "dry clean",
  "dryclean",
  "iron",
  "pressing",
  "jeeves",
  "tailor",
  "salon",
  "parlour",
  "parlor",
  "spa",
  "plumb",
  "weld",
  "weild",
  "cycle",
  "bicycle",
  "tyre",
  "tire",
  "mechanic",
  "motor",
  "car ",
  "bike",
  "shoe",
  "footwear",
  "leather",
  "sofa",
  "furniture",
  "carpenter",
  "watch",
  "clock",
  "sewing",
];

export const RECYCLING_NEGATIVE_KEYWORDS = [
  "paper mart",
  "old paper",
  "waste paper",
  "wet waste",
  "food waste",
  "bottle",
  "glass",
  "plastic packaging",
  "compost",
];

export const SECOND_HAND_NEGATIVE_KEYWORDS = [
  "book",
  "cloth",
  "garment",
  "dress",
  "furniture",
  "sofa",
  "car",
  "bike",
  "cycle",
  "apparel",
  "vintage wear",
  "thrift",
];

export const CHARITY_NEGATIVE_KEYWORDS = [
  "book",
  "cloth",
  "apparel",
  "animal",
  "pet",
  "dog",
  "cat",
];

export function hasDisallowedKeyword(text: string, negativeKeywords: string[]): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();
  return negativeKeywords.some((kw) => lower.includes(kw));
}

export function classifyOsmElement(
  tags: Record<string, string>,
  rawName: string
): { partnerType: PartnerType; sanitizedName: string } | null {
  const name = rawName || tags.name || tags["name:en"] || tags["brand"] || "";

  // 1. Repair: ONLY accept tags specifically indicating electronics repair
  // Strictly reject generic shop=repair, craft=repair, or amenity=repair_shop without electronics qualifier
  const isElectronicsRepair =
    tags.shop === "electronics_repair" ||
    tags.craft === "electronics_repair" ||
    tags.repair === "electronics" ||
    (tags.shop === "mobile_phone" && tags.repair === "yes");

  if (isElectronicsRepair) {
    if (hasDisallowedKeyword(name, REPAIR_NEGATIVE_KEYWORDS)) {
      return null;
    }
    const displayName =
      name.trim() ||
      (tags.operator ? `${tags.operator} Repair Lab` : "Local Electronics Repair Workshop");
    return { partnerType: "repair", sanitizedName: displayName };
  }

  // 2. Recycling (e-waste only)
  if (tags.amenity === "recycling") {
    const hasEwasteTag =
      tags["recycling:electrical_appliances"] === "yes" ||
      tags["recycling:electronics"] === "yes" ||
      tags["recycling:batteries"] === "yes" ||
      tags["recycling:small_appliances"] === "yes";

    const isExclusivelyNonEwaste =
      (tags["recycling:food_waste"] === "yes" ||
        tags["recycling:green_waste"] === "yes" ||
        tags["recycling:paper"] === "yes" ||
        tags["recycling:glass"] === "yes") &&
      !hasEwasteTag;

    if (isExclusivelyNonEwaste || hasDisallowedKeyword(name, RECYCLING_NEGATIVE_KEYWORDS)) {
      return null;
    }

    const typeHint = tags.recycling_type || hasEwasteTag ? "E-Waste" : "Appliance";
    const displayName = name.trim() || `Community ${typeHint} Recycling Point`;
    return { partnerType: "recycler", sanitizedName: displayName };
  }

  // 3. Second-hand (refurbish/reuse/resell)
  if (tags.shop === "second_hand") {
    if (
      tags["second_hand"] === "clothes" ||
      tags["clothes"] === "yes" ||
      hasDisallowedKeyword(name, SECOND_HAND_NEGATIVE_KEYWORDS)
    ) {
      return null;
    }
    const displayName = name.trim() || "Second-Hand Electronics Resale Center";
    return { partnerType: "refurbisher", sanitizedName: displayName };
  }

  // 4. Charity (donate)
  if (tags.shop === "charity") {
    if (hasDisallowedKeyword(name, CHARITY_NEGATIVE_KEYWORDS)) {
      return null;
    }
    const displayName =
      name.trim() ||
      (tags.operator ? `${tags.operator} Charity Hub` : "Community Charity Donation Drop-off");
    return { partnerType: "ngo", sanitizedName: displayName };
  }

  return null;
}

export function parseOsmElements(
  elements: OsmElement[],
  originLat: number,
  originLng: number,
  radiusKm: number
): PartnerLocation[] {
  const partners: PartnerLocation[] = [];
  const seenCoords = new Set<string>();

  for (const el of elements) {
    const lat = el.lat ?? el.center?.lat;
    const lng = el.lon ?? el.center?.lon;
    if (lat === undefined || lng === undefined) continue;

    // Deduplicate exact or near-identical coordinates (< 10 meters)
    const coordKey = `${lat.toFixed(4)},${lng.toFixed(4)}`;
    if (seenCoords.has(coordKey)) continue;
    seenCoords.add(coordKey);

    const dist = haversineDistanceKm(originLat, originLng, lat, lng);
    if (dist > radiusKm) continue;

    const tags = el.tags || {};
    const rawName = tags.name || tags["name:en"] || tags["brand"] || "";

    const classification = classifyOsmElement(tags, rawName);
    if (!classification) continue;

    const { partnerType, sanitizedName } = classification;

    // Extract contact / address details
    const contactParts: string[] = [];
    if (tags.phone || tags["contact:phone"]) {
      contactParts.push(`Tel: ${tags.phone || tags["contact:phone"]}`);
    }
    if (tags.opening_hours) {
      contactParts.push(`Hours: ${tags.opening_hours}`);
    }
    if (tags.website || tags["contact:website"]) {
      contactParts.push(tags.website || tags["contact:website"]);
    }
    const street = [tags["addr:housenumber"], tags["addr:street"]].filter(Boolean).join(" ");
    if (street) {
      contactParts.push(street);
    }

    const city =
      tags["addr:city"] ||
      tags["addr:suburb"] ||
      tags["addr:district"] ||
      tags["addr:county"] ||
      "Local Area";

    partners.push({
      id: `osm_${el.type}_${el.id}`,
      name: sanitizedName,
      partner_type: partnerType,
      lat,
      lng,
      city,
      contact: contactParts.length > 0 ? contactParts.join(" • ") : null,
      verified: true,
      distanceKm: dist,
      source: "osm",
      isLiveOsm: true,
      address: street || null,
    });
  }

  // Sort by straight-line distance
  partners.sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0));
  return partners;
}
