import { resolveCategoryBaseline } from "./decisionEngine.ts";

export interface EwasteCategoryInfo {
  categoryKey: string;
  label: string;
  group: "IT & Computing" | "Consumer & Displays" | "Small Appliances" | "Accessories & Peripherals";
  avgWeightKg: number;
  potentialHazards: string[];
  defaultAgeYears: number;
}

export const EWASTE_TAXONOMY: EwasteCategoryInfo[] = [
  {
    categoryKey: "laptop",
    label: "Laptop / Notebook",
    group: "IT & Computing",
    avgWeightKg: 2.2,
    potentialHazards: ["Lithium-ion Battery"],
    defaultAgeYears: 3,
  },
  {
    categoryKey: "smartphone",
    label: "Smartphone",
    group: "IT & Computing",
    avgWeightKg: 0.2,
    potentialHazards: ["Lithium-ion Battery"],
    defaultAgeYears: 2,
  },
  {
    categoryKey: "tablet",
    label: "Tablet / iPad",
    group: "IT & Computing",
    avgWeightKg: 0.5,
    potentialHazards: ["Lithium-ion Battery"],
    defaultAgeYears: 3,
  },
  {
    categoryKey: "desktop_pc",
    label: "Desktop PC / Tower",
    group: "IT & Computing",
    avgWeightKg: 8.5,
    potentialHazards: ["Heavy Metals", "Lead Solder"],
    defaultAgeYears: 4,
  },
  {
    categoryKey: "crt_tv",
    label: "CRT Television / Tube TV",
    group: "Consumer & Displays",
    avgWeightKg: 24.0,
    potentialHazards: ["Lead Glass", "Phosphor Coating", "High Voltage Vacuum Tube"],
    defaultAgeYears: 15,
  },
  {
    categoryKey: "crt_monitor",
    label: "CRT / Legacy Monitor",
    group: "Consumer & Displays",
    avgWeightKg: 14.0,
    potentialHazards: ["Lead Glass", "Phosphor Coating"],
    defaultAgeYears: 14,
  },
  {
    categoryKey: "printer",
    label: "Printer / Scanner",
    group: "IT & Computing",
    avgWeightKg: 6.5,
    potentialHazards: ["Toner Residue", "Chemical Inks"],
    defaultAgeYears: 4,
  },
  {
    categoryKey: "media_player",
    label: "VCR / DVD / Media Player",
    group: "Consumer & Displays",
    avgWeightKg: 3.5,
    potentialHazards: ["Capacitors"],
    defaultAgeYears: 12,
  },
  {
    categoryKey: "audio_stereo",
    label: "Radio / Stereo / Amplifier",
    group: "Consumer & Displays",
    avgWeightKg: 5.0,
    potentialHazards: ["Transformer Oils", "Heavy Coils"],
    defaultAgeYears: 6,
  },
  {
    categoryKey: "small_appliance",
    label: "Small Home Appliance (Microwave, Mixer, etc.)",
    group: "Small Appliances",
    avgWeightKg: 4.5,
    potentialHazards: ["Capacitors", "Heating Elements"],
    defaultAgeYears: 4,
  },
  {
    categoryKey: "feature_phone",
    label: "Feature Phone / Keypad Mobile",
    group: "IT & Computing",
    avgWeightKg: 0.15,
    potentialHazards: ["Lithium / NiMH Battery"],
    defaultAgeYears: 8,
  },
  {
    categoryKey: "landline_phone",
    label: "Landline / Corded Phone",
    group: "IT & Computing",
    avgWeightKg: 0.7,
    potentialHazards: [],
    defaultAgeYears: 7,
  },
  {
    categoryKey: "camera",
    label: "Camera (Digital / Film)",
    group: "Consumer & Displays",
    avgWeightKg: 0.6,
    potentialHazards: ["Battery"],
    defaultAgeYears: 5,
  },
  {
    categoryKey: "other_electronics",
    label: "Cables, Chargers, Adapters & Peripherals",
    group: "Accessories & Peripherals",
    avgWeightKg: 1.5,
    potentialHazards: ["PVC Jacketing", "Copper Cores"],
    defaultAgeYears: 3,
  },
];

/**
 * Resolves standard category key using device aliases and keywords.
 */
export function resolveCategoryKey(itemType: string): string {
  const norm = (itemType || "").toLowerCase().replace(/[-_\s]+/g, "_");

  // Exact taxonomy key or label match first
  for (const tax of EWASTE_TAXONOMY) {
    if (norm === tax.categoryKey || norm === tax.label.toLowerCase().replace(/[-_\s]+/g, "_")) {
      return tax.categoryKey;
    }
  }

  // CRT & Legacy Displays
  if (norm.includes("crt_monitor") || (norm.includes("crt") && (norm.includes("monitor") || norm.includes("screen")))) {
    return "crt_monitor";
  }
  if (
    norm.includes("crt") ||
    norm.includes("trinitron") ||
    norm.includes("tube_tv") ||
    norm.includes("box_tv") ||
    norm.includes("picture_tube")
  ) {
    return "crt_tv";
  }

  // Desktops & Workstations
  if (norm.includes("desktop") || norm.includes("tower") || norm.includes("workstation") || norm.includes("cpu_cabinet")) {
    return "desktop_pc";
  }

  // Laptops
  if (
    norm.includes("laptop") ||
    norm.includes("macbook") ||
    norm.includes("notebook") ||
    norm.includes("thinkpad") ||
    norm.includes("chromebook")
  ) {
    return "laptop";
  }

  // Tablets
  if (norm.includes("tablet") || norm.includes("ipad") || norm.includes("kindle")) {
    return "tablet";
  }

  // Landline & Feature Phones (must precede general smartphone)
  if (norm.includes("landline") || norm.includes("corded_phone") || norm.includes("rotary") || norm.includes("intercom")) {
    return "landline_phone";
  }
  if (
    norm.includes("feature_phone") ||
    norm.includes("keypad") ||
    norm.includes("basic_phone") ||
    norm.includes("dumb_phone") ||
    norm.includes("3310")
  ) {
    return "feature_phone";
  }

  // Smartphones
  if (
    norm.includes("smartphone") ||
    norm.includes("iphone") ||
    norm.includes("galaxy") ||
    norm.includes("pixel") ||
    norm.includes("android") ||
    norm.includes("mobile") ||
    norm.includes("phone")
  ) {
    return "smartphone";
  }

  // Printers & Scanners
  if (norm.includes("printer") || norm.includes("scanner") || norm.includes("laserjet") || norm.includes("deskjet")) {
    return "printer";
  }

  // Media Players
  if (
    norm.includes("vcr") ||
    norm.includes("dvd") ||
    norm.includes("vhs") ||
    norm.includes("cassette") ||
    norm.includes("blu_ray") ||
    norm.includes("bluray")
  ) {
    return "media_player";
  }

  // Audio & Stereo
  if (
    norm.includes("stereo") ||
    norm.includes("radio") ||
    norm.includes("speaker") ||
    norm.includes("soundbar") ||
    norm.includes("amplifier") ||
    norm.includes("boombox")
  ) {
    return "audio_stereo";
  }

  // Cameras
  if (norm.includes("camera") || norm.includes("dslr") || norm.includes("camcorder") || norm.includes("digicam")) {
    return "camera";
  }

  // Small Appliances
  if (
    norm.includes("microwave") ||
    norm.includes("blender") ||
    norm.includes("mixer") ||
    norm.includes("toaster") ||
    norm.includes("appliance")
  ) {
    return "small_appliance";
  }

  // Substring check across taxonomy labels
  for (const tax of EWASTE_TAXONOMY) {
    if (norm.includes(tax.categoryKey) || tax.label.toLowerCase().includes(norm)) {
      return tax.categoryKey;
    }
  }

  return "other_electronics";
}

/**
 * Maps a raw detected or free-text item type into the structured taxonomy.
 */
export function mapItemToTaxonomy(itemType: string): EwasteCategoryInfo {
  const key = resolveCategoryKey(itemType);
  const matched = EWASTE_TAXONOMY.find((t) => t.categoryKey === key);

  if (matched) return matched;

  const baseline = resolveCategoryBaseline(itemType);
  return {
    categoryKey: "other_electronics",
    label: itemType.trim() || "Unlisted Electronic Item",
    group: "Accessories & Peripherals",
    avgWeightKg: baseline.weight_kg || 2.0,
    potentialHazards: ["Circuitry"],
    defaultAgeYears: 3,
  };
}
