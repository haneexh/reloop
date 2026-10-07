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
  source?: "osm" | "verified";
  isLiveOsm?: boolean;
  address?: string | null;
}

export const MAX_LOCAL_RADIUS_KM = 50;

/**
 * Default location set to Hyderabad (Host city of Hackathon)
 */
export const DEFAULT_USER_LOCATION = {
  name: "Hyderabad (HITEC City / Madhapur)",
  lat: 17.4486,
  lng: 78.3908,
};

export const MAJOR_INDIAN_CITIES = [
  { name: "Hyderabad, Telangana", city: "Hyderabad", lat: 17.4486, lng: 78.3908 },
  { name: "Bengaluru, Karnataka", city: "Bengaluru", lat: 12.9716, lng: 77.5946 },
  { name: "Mumbai, Maharashtra", city: "Mumbai", lat: 19.076, lng: 72.8777 },
  { name: "Delhi / NCR", city: "Delhi", lat: 28.6139, lng: 77.209 },
  { name: "Chennai, Tamil Nadu", city: "Chennai", lat: 13.0827, lng: 80.2707 },
  { name: "Kolkata, West Bengal", city: "Kolkata", lat: 22.5726, lng: 88.3639 },
  { name: "Pune, Maharashtra", city: "Pune", lat: 18.5204, lng: 73.8567 },
  { name: "Ahmedabad, Gujarat", city: "Ahmedabad", lat: 23.0225, lng: 72.5714 },
  { name: "Jaipur, Rajasthan", city: "Jaipur", lat: 26.9124, lng: 75.7873 },
  { name: "Surat, Gujarat", city: "Surat", lat: 21.1702, lng: 72.8311 },
  { name: "Lucknow, Uttar Pradesh", city: "Lucknow", lat: 26.8467, lng: 80.9462 },
  { name: "Kochi, Kerala", city: "Kochi", lat: 9.9312, lng: 76.2673 },
  { name: "Chandigarh", city: "Chandigarh", lat: 30.7333, lng: 76.7794 },
  { name: "Indore, Madhya Pradesh", city: "Indore", lat: 22.7196, lng: 75.8577 },
  { name: "Visakhapatnam, Andhra Pradesh", city: "Visakhapatnam", lat: 17.6868, lng: 83.2185 },
  { name: "Coimbatore, Tamil Nadu", city: "Coimbatore", lat: 11.0168, lng: 76.9558 },
  { name: "Bhopal, Madhya Pradesh", city: "Bhopal", lat: 23.2599, lng: 77.4126 },
  { name: "Patna, Bihar", city: "Patna", lat: 25.5941, lng: 85.1376 },
];

export const HYDERABAD_PRESET_LOCATIONS = [
  { name: "Hyderabad - HITEC City / Madhapur (Hackathon Area)", lat: 17.4486, lng: 78.3908, city: "Hyderabad" },
  { name: "Hyderabad - Gachibowli (Financial District)", lat: 17.4401, lng: 78.3489, city: "Hyderabad" },
  { name: "Hyderabad - Banjara Hills (Road No. 12)", lat: 17.4156, lng: 78.4357, city: "Hyderabad" },
  { name: "Hyderabad - Jubilee Hills (Checkpost)", lat: 17.4319, lng: 78.4073, city: "Hyderabad" },
  { name: "Hyderabad - Secunderabad (Paradise / Station)", lat: 17.4399, lng: 78.4983, city: "Hyderabad" },
  { name: "Hyderabad - Kukatpally (KPHB Colony)", lat: 17.4938, lng: 78.3995, city: "Hyderabad" },
  { name: "Hyderabad - Begumpet / Airport Corridor", lat: 17.4447, lng: 78.4664, city: "Hyderabad" },
  { name: "Hyderabad - Charminar / Old City", lat: 17.3616, lng: 78.4747, city: "Hyderabad" },
  { name: "Hyderabad - Uppal / Nacharam", lat: 17.4042, lng: 78.5606, city: "Hyderabad" },
];

export const BENGALURU_PRESET_LOCATIONS = [
  { name: "Bengaluru - Central (MG Road / CBD)", lat: 12.9716, lng: 77.5946, city: "Bengaluru" },
  { name: "Bengaluru - Indiranagar (100ft Road)", lat: 12.9784, lng: 77.6408, city: "Bengaluru" },
  { name: "Bengaluru - Koramangala (Sony World Signal)", lat: 12.9352, lng: 77.6245, city: "Bengaluru" },
  { name: "Bengaluru - HSR Layout (Sector 1)", lat: 12.9121, lng: 77.6446, city: "Bengaluru" },
  { name: "Bengaluru - Jayanagar (4th Block)", lat: 12.9308, lng: 77.5838, city: "Bengaluru" },
  { name: "Bengaluru - Whitefield (ITPB)", lat: 12.9698, lng: 77.7499, city: "Bengaluru" },
  { name: "Bengaluru - Electronic City (Phase 1)", lat: 12.8452, lng: 77.6602, city: "Bengaluru" },
  { name: "Bengaluru - Malleshwaram (8th Cross)", lat: 13.0031, lng: 77.5703, city: "Bengaluru" },
  { name: "Bengaluru - Hebbal / RT Nagar", lat: 13.0358, lng: 77.597, city: "Bengaluru" },
  { name: "Bengaluru - Peenya Industrial Area", lat: 13.0285, lng: 77.5197, city: "Bengaluru" },
];

export const PRESET_LOCATIONS = [
  ...MAJOR_INDIAN_CITIES,
  ...HYDERABAD_PRESET_LOCATIONS,
  ...BENGALURU_PRESET_LOCATIONS,
];

/**
 * Searches for a matched city or returns null if not recognized
 */
export function resolveIndianCityLocation(query: string): { name: string; lat: number; lng: number } | null {
  if (!query || !query.trim()) return null;
  const q = query.trim().toLowerCase();
  
  // Exact or prefix match against major cities or presets
  const found = PRESET_LOCATIONS.find((item) => {
    const itemName = item.name.toLowerCase();
    const city = "city" in item && typeof item.city === "string" ? item.city.toLowerCase() : "";
    return itemName.includes(q) || (city && city.includes(q)) || q.includes(city);
  });

  if (found) {
    return { name: found.name, lat: found.lat, lng: found.lng };
  }
  return null;
}

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
 * Merges Live OpenStreetMap destinations with Verified Seed Partners:
 * For each category:
 * - If Overpass returns real results (>= 2), show those as the primary list for that category.
 * - If Overpass returns few or no results (< 2), fall back to showing the existing verified partner entries for that category.
 * - Preserves verified informal nodes (since informal scrap collectors are not mapped on OSM).
 */
export function mergeOsmWithFallbackPartners(
  osmPartners: PartnerLocation[],
  verifiedPartners: PartnerLocation[]
): {
  merged: PartnerLocation[];
  liveOsmCount: number;
  verifiedCount: number;
  categoriesWithLiveOsm: PartnerType[];
} {
  const allCategories: PartnerType[] = ["repair", "refurbisher", "ngo", "recycler", "informal"];
  const merged: PartnerLocation[] = [];
  const categoriesWithLiveOsm: PartnerType[] = [];
  let liveOsmCount = 0;
  let verifiedCount = 0;

  for (const cat of allCategories) {
    const osmInCat = osmPartners.filter((p) => p.partner_type === cat);
    const verifiedInCat = verifiedPartners.filter((p) => p.partner_type === cat);

    if (osmInCat.length >= 2) {
      // Primary live OSM data for this category
      categoriesWithLiveOsm.push(cat);
      for (const p of osmInCat) {
        merged.push({ ...p, source: "osm", isLiveOsm: true });
        liveOsmCount++;
      }
    } else if (osmInCat.length === 1) {
      // 1 OSM result: show the live OSM result first, supplemented with verified partners
      categoriesWithLiveOsm.push(cat);
      merged.push({ ...osmInCat[0], source: "osm", isLiveOsm: true });
      liveOsmCount++;
      for (const p of verifiedInCat) {
        merged.push({ ...p, source: "verified", isLiveOsm: false });
        verifiedCount++;
      }
    } else {
      // Few or no OSM results (0): gracefully fall back to verified partner entries
      for (const p of verifiedInCat) {
        merged.push({ ...p, source: "verified", isLiveOsm: false });
        verifiedCount++;
      }
    }
  }

  // Sort overall by distanceKm
  merged.sort((a, b) => (a.distanceKm ?? 99999) - (b.distanceKm ?? 99999));

  return {
    merged,
    liveOsmCount,
    verifiedCount,
    categoriesWithLiveOsm,
  };
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
    colorHex: "#3D5A4C", // Forest
    bgClass: "bg-[#EAEFEA]",
    textClass: "text-[#3D5A4C]",
    borderClass: "border-[#3D5A4C]/30",
    description: "Component-level repair and micro-soldering labs.",
  },
  refurbisher: {
    label: "Refurbisher",
    classification: "Formal",
    colorHex: "#1C1E1B", // Charcoal
    bgClass: "bg-[#E6E2D6]",
    textClass: "text-[#1C1E1B]",
    borderClass: "border-[#1C1E1B]/30",
    description: "Hardware testing, grading, and secondary resale hub.",
  },
  ngo: {
    label: "NGO / Donation",
    classification: "Formal",
    colorHex: "#4D6B5C", // Forest Muted
    bgClass: "bg-[#EAEFEA]",
    textClass: "text-[#3D5A4C]",
    borderClass: "border-[#4D6B5C]/30",
    description: "Non-profit organizations distributing working hardware to schools and community centers.",
  },
  recycler: {
    label: "E-Waste Recycler",
    classification: "Formal",
    colorHex: "#B5451B", // Rust
    bgClass: "bg-[#FAECE6]",
    textClass: "text-[#B5451B]",
    borderClass: "border-[#B5451B]/30",
    description: "Certified industrial e-waste recyclers adhering to R2/ISO standards.",
  },
  informal: {
    label: "Informal Collector (Kabadiwala)",
    classification: "Informal",
    colorHex: "#8C8C84", // Stone Gray
    bgClass: "bg-[#EFECE4]",
    textClass: "text-[#1C1E1B]",
    borderClass: "border-[#8C8C84]/40",
    description: "Door-to-door scrap aggregators and local scrap recovery hubs.",
  },
};

/**
 * 40 Verified Partner Seed Nodes (20 Hyderabad + 20 Bengaluru)
 */
export const FALLBACK_PARTNERS: PartnerLocation[] = [
  // ============================================================================
  // HYDERABAD PARTNERS (20 Verified Nodes)
  // ============================================================================

  // Hyderabad Repair (4)
  {
    id: "hyd-rep-1",
    name: "Deccan Silicon & Logic Board Clinic",
    partner_type: "repair",
    lat: 17.4486,
    lng: 78.3908,
    city: "Hyderabad",
    contact: "+91-98490-12844 | support@deccansilicon.in",
    verified: true,
  },
  {
    id: "hyd-rep-2",
    name: "CyberTowers MicroFix Lab",
    partner_type: "repair",
    lat: 17.4504,
    lng: 78.3809,
    city: "Hyderabad",
    contact: "+91-98851-77210 | intake@cybertowersfix.com",
    verified: true,
  },
  {
    id: "hyd-rep-3",
    name: "Nizam Chipset & Hardware Restorations",
    partner_type: "repair",
    lat: 17.4399,
    lng: 78.4983,
    city: "Hyderabad",
    contact: "+91-99081-33245 | desk@nizamrestorations.org",
    verified: true,
  },
  {
    id: "hyd-rep-4",
    name: "Kukatpally Device Care & Soldering Center",
    partner_type: "repair",
    lat: 17.4938,
    lng: 78.3995,
    city: "Hyderabad",
    contact: "+91-97011-88432 | kphb.care@gadgetclinic.in",
    verified: true,
  },

  // Hyderabad Refurbisher (4)
  {
    id: "hyd-ref-1",
    name: "Charminar Circular Systems",
    partner_type: "refurbisher",
    lat: 17.4401,
    lng: 78.3489,
    city: "Hyderabad",
    contact: "+91-98480-44911 | sales@charminarcircular.in",
    verified: true,
  },
  {
    id: "hyd-ref-2",
    name: "HITEC Revive Hardware Labs",
    partner_type: "refurbisher",
    lat: 17.4699,
    lng: 78.3578,
    city: "Hyderabad",
    contact: "+91-99499-12340 | intake@hitecrevive.org",
    verified: true,
  },
  {
    id: "hyd-ref-3",
    name: "Kakatiya Tech Refurb Hub",
    partner_type: "refurbisher",
    lat: 17.4375,
    lng: 78.4482,
    city: "Hyderabad",
    contact: "+91-98660-55789 | ops@kakatiyarefurb.com",
    verified: true,
  },
  {
    id: "hyd-ref-4",
    name: "Golconda Electronics Rebuilders",
    partner_type: "refurbisher",
    lat: 17.4447,
    lng: 78.4664,
    city: "Hyderabad",
    contact: "+91-97033-66120 | refurb@golcondarebuilders.in",
    verified: true,
  },

  // Hyderabad NGO (4)
  {
    id: "hyd-ngo-1",
    name: "Telangana Digital Inclusion Trust",
    partner_type: "ngo",
    lat: 17.4156,
    lng: 78.4357,
    city: "Hyderabad",
    contact: "+91-94400-88120 | donate@telanganadigitaltrust.org",
    verified: true,
  },
  {
    id: "hyd-ngo-2",
    name: "Hyderabad VidyaTech Community Network",
    partner_type: "ngo",
    lat: 17.4319,
    lng: 78.4073,
    city: "Hyderabad",
    contact: "+91-98491-33200 | contact@vidyatechhyd.org",
    verified: true,
  },
  {
    id: "hyd-ngo-3",
    name: "Deccan Green Bridge Foundation",
    partner_type: "ngo",
    lat: 17.3871,
    lng: 78.4792,
    city: "Hyderabad",
    contact: "+91-99890-77112 | outreach@deccangreenbridge.org",
    verified: true,
  },
  {
    id: "hyd-ngo-4",
    name: "Samarthya Hyderabad Sustainable Tech Hub",
    partner_type: "ngo",
    lat: 17.3916,
    lng: 78.4398,
    city: "Hyderabad",
    contact: "+91-98666-44331 | donate@samarthyahyd.org",
    verified: true,
  },

  // Hyderabad Recycler (4)
  {
    id: "hyd-rec-1",
    name: "Cherlapally Eco-Recovery & Smelting",
    partner_type: "recycler",
    lat: 17.4623,
    lng: 78.6012,
    city: "Hyderabad",
    contact: "+91-98495-66778 | plant@cherlapallyrecovery.co.in",
    verified: true,
  },
  {
    id: "hyd-rec-2",
    name: "Deccan Zero-Waste Material Processors",
    partner_type: "recycler",
    lat: 17.5186,
    lng: 78.4522,
    city: "Hyderabad",
    contact: "+91-99480-22119 | ops@deccanzero.in",
    verified: true,
  },
  {
    id: "hyd-rec-3",
    name: "PearlCity Urban Minerals & E-Waste Refiners",
    partner_type: "recycler",
    lat: 17.4674,
    lng: 78.4412,
    city: "Hyderabad",
    contact: "+91-98661-88900 | dispatch@pearlcityminerals.com",
    verified: true,
  },
  {
    id: "hyd-rec-4",
    name: "Telangana GreenSpire Industrial Recovery Facility",
    partner_type: "recycler",
    lat: 17.4042,
    lng: 78.5606,
    city: "Hyderabad",
    contact: "+91-97010-33445 | intake@greenspiretelangana.org",
    verified: true,
  },

  // Hyderabad Informal (4)
  {
    id: "hyd-inf-1",
    name: "Yadagiri Verified Scrap Aggregation Point",
    partner_type: "informal",
    lat: 17.4428,
    lng: 78.3842,
    city: "Hyderabad",
    contact: "+91-98481-99023 | via RE:LOOP Hyderabad WhatsApp Dispatch",
    verified: true,
  },
  {
    id: "hyd-inf-2",
    name: "Khaleel Bhai Verified Electronics Kabadiwala",
    partner_type: "informal",
    lat: 17.3616,
    lng: 78.4747,
    city: "Hyderabad",
    contact: "+91-98850-66124 | via RE:LOOP South Zone Coordinator",
    verified: true,
  },
  {
    id: "hyd-inf-3",
    name: "Cyberabad Green Scrap Sorters",
    partner_type: "informal",
    lat: 17.4968,
    lng: 78.3546,
    city: "Hyderabad",
    contact: "+91-99088-22310 | via RE:LOOP Logistics Desk",
    verified: true,
  },
  {
    id: "hyd-inf-4",
    name: "Secunderabad EcoCollector Verified Node",
    partner_type: "informal",
    lat: 17.4412,
    lng: 78.4891,
    city: "Hyderabad",
    contact: "+91-97001-44567 | via RE:LOOP Field Operator",
    verified: true,
  },

  // ============================================================================
  // BENGALURU PARTNERS (20 Verified Nodes)
  // ============================================================================

  // Bengaluru Repair (4)
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

  // Bengaluru Refurbisher (4)
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

  // Bengaluru NGO (4)
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

  // Bengaluru Recycler (4)
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

  // Bengaluru Informal (4)
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
