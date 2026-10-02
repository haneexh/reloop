import type { PartnerType, RecommendedAction } from "@/types/database";

export type { PartnerType, RecommendedAction };

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
}

export const DEFAULT_USER_LOCATION = {
  name: "Bengaluru Central (MG Road)",
  lat: 12.9716,
  lng: 77.5946,
};

export const BENGALURU_PRESET_LOCATIONS = [
  { name: "Bengaluru Central (MG Road / CBD)", lat: 12.9716, lng: 77.5946 },
  { name: "Indiranagar (100ft Road)", lat: 12.9784, lng: 77.6408 },
  { name: "Koramangala (Sony World Signal)", lat: 12.9352, lng: 77.6245 },
  { name: "HSR Layout (Sector 1)", lat: 12.9121, lng: 77.6446 },
  { name: "Jayanagar (4th Block)", lat: 12.9308, lng: 77.5838 },
  { name: "Whitefield (ITPB)", lat: 12.9698, lng: 77.7499 },
  { name: "Electronic City (Phase 1)", lat: 12.8452, lng: 77.6602 },
  { name: "Malleshwaram (8th Cross)", lat: 13.0031, lng: 77.5703 },
  { name: "Hebbal / RT Nagar", lat: 13.0358, lng: 77.597 },
  { name: "Peenya Industrial Area", lat: 13.0285, lng: 77.5197 },
];

/**
 * Calculates straight-line haversine distance between two coordinates in kilometers.
 */
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

/**
 * Maps recommended action to matching partner types.
 */
export function getRecommendedPartnerTypes(action: RecommendedAction): PartnerType[] {
  switch (action) {
    case "repair":
      return ["repair"];
    case "reuse":
    case "resell":
      return ["refurbisher", "informal"];
    case "refurbish":
      return ["refurbisher", "repair"];
    case "donate":
      return ["ngo"];
    case "recycle":
      return ["recycler", "informal"];
    default:
      return ["repair", "refurbisher", "ngo", "recycler", "informal"];
  }
}

/**
 * Partner classification metadata.
 */
export const PARTNER_TYPE_META: Record<
  PartnerType,
  {
    label: string;
    classification: "Formal" | "Informal";
    colorHex: string;
    bgClass: string;
    textClass: string;
    borderClass: string;
    description: string;
  }
> = {
  repair: {
    label: "Repair Lab",
    classification: "Formal",
    colorHex: "#2563eb", // Blue
    bgClass: "bg-blue-50 dark:bg-blue-950/40",
    textClass: "text-blue-700 dark:text-blue-300",
    borderClass: "border-blue-200 dark:border-blue-800",
    description: "Certified component-level repair & micro-soldering labs.",
  },
  refurbisher: {
    label: "Refurbisher",
    classification: "Formal",
    colorHex: "#7c3aed", // Purple/Indigo
    bgClass: "bg-purple-50 dark:bg-purple-950/40",
    textClass: "text-purple-700 dark:text-purple-300",
    borderClass: "border-purple-200 dark:border-purple-800",
    description: "Authorized hardware testing, grading, and secondary resale hub.",
  },
  ngo: {
    label: "NGO / Donation",
    classification: "Formal",
    colorHex: "#059669", // Emerald
    bgClass: "bg-emerald-50 dark:bg-emerald-950/40",
    textClass: "text-emerald-700 dark:text-emerald-300",
    borderClass: "border-emerald-200 dark:border-emerald-800",
    description: "Registered non-profits distributing working hardware to schools & communities.",
  },
  recycler: {
    label: "E-Waste Recycler",
    classification: "Formal",
    colorHex: "#d97706", // Amber
    bgClass: "bg-amber-50 dark:bg-amber-950/40",
    textClass: "text-amber-700 dark:text-amber-300",
    borderClass: "border-amber-200 dark:border-amber-800",
    description: "Certified industrial e-waste recyclers adhering to R2/ISO environmental standards.",
  },
  informal: {
    label: "Informal Collector (Kabadiwala)",
    classification: "Informal",
    colorHex: "#52525b", // Zinc/Slate
    bgClass: "bg-zinc-100 dark:bg-zinc-800",
    textClass: "text-zinc-800 dark:text-zinc-200",
    borderClass: "border-zinc-300 dark:border-zinc-700",
    description: "Community-level door-to-door scrap aggregators & decentralized aggregators.",
  },
};

/**
 * Fallback Bengaluru Partner Seed Dataset (20 Verified Nodes)
 */
export const FALLBACK_PARTNERS: PartnerLocation[] = [
  // Repair (4)
  {
    id: "p-rep-1",
    name: "FixCraft MicroElectronics Lab",
    partner_type: "repair",
    lat: 12.9784,
    lng: 77.6408,
    city: "Bengaluru",
    contact: "+91-98450-12831 | fixcraft.indiranagar@example.com",
    verified: true,
  },
  {
    id: "p-rep-2",
    name: "Precision Chipset & Motherboard Clinic",
    partner_type: "repair",
    lat: 12.9352,
    lng: 77.6245,
    city: "Bengaluru",
    contact: "+91-98801-44720 | support@precisionclinic-blr.in",
    verified: true,
  },
  {
    id: "p-rep-3",
    name: "Urban Gadget Fixworks",
    partner_type: "repair",
    lat: 12.9121,
    lng: 77.6446,
    city: "Bengaluru",
    contact: "+91-97312-88190 | desk@urbangadgetfix.com",
    verified: true,
  },
  {
    id: "p-rep-4",
    name: "Apex Appliance & Device Restoration",
    partner_type: "repair",
    lat: 12.9308,
    lng: 77.5838,
    city: "Bengaluru",
    contact: "+91-99002-31567 | care@apexdevicehub.org",
    verified: true,
  },

  // Refurbisher (4)
  {
    id: "p-ref-1",
    name: "NextCycle Systems & Laptops",
    partner_type: "refurbisher",
    lat: 12.9698,
    lng: 77.7499,
    city: "Bengaluru",
    contact: "+91-98442-99011 | intake@nextcyclesystems.in",
    verified: true,
  },
  {
    id: "p-ref-2",
    name: "ReNew Silicon Refurb Hub",
    partner_type: "refurbisher",
    lat: 12.8452,
    lng: 77.6602,
    city: "Bengaluru",
    contact: "+91-96860-77123 | operations@renewsilicon.com",
    verified: true,
  },
  {
    id: "p-ref-3",
    name: "CirculaTech Hardware Rebuilders",
    partner_type: "refurbisher",
    lat: 12.9591,
    lng: 77.6974,
    city: "Bengaluru",
    contact: "+91-99805-66234 | contact@circulatech.in",
    verified: true,
  },
  {
    id: "p-ref-4",
    name: "Vanguard IT Revive Center",
    partner_type: "refurbisher",
    lat: 12.9166,
    lng: 77.6101,
    city: "Bengaluru",
    contact: "+91-98863-12098 | hello@vanguardrevive.org",
    verified: true,
  },

  // NGO (4)
  {
    id: "p-ngo-1",
    name: "Seva Bridge Digital Inclusion Trust",
    partner_type: "ngo",
    lat: 12.9422,
    lng: 77.5753,
    city: "Bengaluru",
    contact: "+91-94480-55120 | donate@sevabridge.org",
    verified: true,
  },
  {
    id: "p-ngo-2",
    name: "GreenHorizon Community Foundation",
    partner_type: "ngo",
    lat: 13.0031,
    lng: 77.5703,
    city: "Bengaluru",
    contact: "+91-98451-22440 | circular@greenhorizonblr.org",
    verified: true,
  },
  {
    id: "p-ngo-3",
    name: "VidyaTech Hardware Donation Network",
    partner_type: "ngo",
    lat: 13.0358,
    lng: 77.597,
    city: "Bengaluru",
    contact: "+91-99019-33882 | access@vidyatechindia.org",
    verified: true,
  },
  {
    id: "p-ngo-4",
    name: "Samarthya Sustainable Living Collective",
    partner_type: "ngo",
    lat: 12.9982,
    lng: 77.553,
    city: "Bengaluru",
    contact: "+91-97400-88129 | outreach@samarthya-trust.org",
    verified: true,
  },

  // Recycler (4)
  {
    id: "p-rec-1",
    name: "EcoMetallix E-Waste Processors",
    partner_type: "recycler",
    lat: 13.0285,
    lng: 77.5197,
    city: "Bengaluru",
    contact: "+91-98459-77001 | dispatch@ecometallix.co.in",
    verified: true,
  },
  {
    id: "p-rec-2",
    name: "TerraZero Circular Recycling Facility",
    partner_type: "recycler",
    lat: 12.8164,
    lng: 77.6834,
    city: "Bengaluru",
    contact: "+91-99800-44912 | recovery@terrazero-blr.in",
    verified: true,
  },
  {
    id: "p-rec-3",
    name: "CleanGrid Materials Recovery Plant",
    partner_type: "recycler",
    lat: 13.0978,
    lng: 77.3912,
    city: "Bengaluru",
    contact: "+91-97399-55670 | log@cleangridwaste.com",
    verified: true,
  },
  {
    id: "p-rec-4",
    name: "GreenSpire Urban Smelting & E-Recovery",
    partner_type: "recycler",
    lat: 12.8904,
    lng: 77.6415,
    city: "Bengaluru",
    contact: "+91-98867-88901 | plant@greenspirerecovery.org",
    verified: true,
  },

  // Informal (4)
  {
    id: "p-inf-1",
    name: "Ramesh Kabadiwala Verified Collection Point",
    partner_type: "informal",
    lat: 12.9857,
    lng: 77.6057,
    city: "Bengaluru",
    contact: "+91-98440-11239 | via RE:LOOP Hub WhatsApp Dispatch",
    verified: true,
  },
  {
    id: "p-inf-2",
    name: "Syed & Sons Verified Scrap Sorters",
    partner_type: "informal",
    lat: 12.9972,
    lng: 77.6134,
    city: "Bengaluru",
    contact: "+91-97411-88902 | via RE:LOOP Hub SMS Desk",
    verified: true,
  },
  {
    id: "p-inf-3",
    name: "Babu Bhai Verified Electronics Aggregator",
    partner_type: "informal",
    lat: 12.9654,
    lng: 77.5768,
    city: "Bengaluru",
    contact: "+91-99008-34190 | via RE:LOOP Field Operator",
    verified: true,
  },
  {
    id: "p-inf-4",
    name: "Anand EcoScrap Verified Node",
    partner_type: "informal",
    lat: 13.0224,
    lng: 77.5492,
    city: "Bengaluru",
    contact: "+91-98809-66120 | via RE:LOOP Logistics Coordinator",
    verified: true,
  },
];
