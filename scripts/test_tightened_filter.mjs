const lat = 17.449;
const lng = 78.391;
const radiusMeters = 15000;

// Non-electronics negative keyword filters
const REPAIR_NEGATIVE_NAMES = [
  "pump",
  "borewell",
  "bore well",
  "laundry",
  "dry clean",
  "dryclean",
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
  "auto",
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

const RECYCLING_NEGATIVE_NAMES = [
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

const SECOND_HAND_NEGATIVE_NAMES = [
  "book",
  "cloth",
  "garment",
  "dress",
  "furniture",
  "sofa",
  "auto",
  "car",
  "bike",
  "cycle",
  "apparel",
  "vintage wear",
];

const CHARITY_NEGATIVE_NAMES = [
  "book",
  "cloth",
  "apparel",
  "animal",
  "pet",
];

function isDisallowedName(name, negativeKeywords) {
  if (!name) return false;
  const lower = name.toLowerCase();
  return negativeKeywords.some((kw) => lower.includes(kw));
}

async function run() {
  const query = `
[out:json][timeout:15];
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

  const res = await fetch("https://lz4.overpass-api.de/api/interpreter", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "ReLoopCircularApp/1.0",
    },
    body: `data=${encodeURIComponent(query)}`,
  });

  const json = await res.json();
  console.log(`Fetched ${json.elements?.length} raw elements around Hyderabad.`);

  const filtered = [];
  const excluded = [];

  for (const el of json.elements || []) {
    const tags = el.tags || {};
    const name = tags.name || tags["name:en"] || "";

    // 1. Repair
    const isRepairTag =
      tags.shop === "electronics_repair" ||
      tags.craft === "electronics_repair" ||
      tags.repair === "electronics" ||
      (tags.shop === "mobile_phone" && tags.repair === "yes");

    if (isRepairTag) {
      if (isDisallowedName(name, REPAIR_NEGATIVE_NAMES)) {
        excluded.push({ reason: "Repair name sanity check failed", name, tags });
        continue;
      }
      filtered.push({ cat: "repair", name: name || "Local Electronics Repair Workshop", tags });
      continue;
    }

    // 2. Recycling
    if (tags.amenity === "recycling") {
      // Check if exclusively food, green waste, paper
      const isExclusivelyNonEwaste =
        (tags["recycling:food_waste"] === "yes" || tags["recycling:green_waste"] === "yes" || tags["recycling:paper"] === "yes") &&
        tags["recycling:electrical_appliances"] !== "yes" &&
        tags["recycling:electronics"] !== "yes" &&
        tags["recycling:batteries"] !== "yes" &&
        tags["recycling:small_appliances"] !== "yes";

      if (isExclusivelyNonEwaste || isDisallowedName(name, RECYCLING_NEGATIVE_NAMES)) {
        excluded.push({ reason: "Recycling non-e-waste check failed", name, tags });
        continue;
      }

      filtered.push({ cat: "recycler", name: name || "Community E-Waste & Recycling Point", tags });
      continue;
    }

    // 3. Second hand
    if (tags.shop === "second_hand") {
      if (isDisallowedName(name, SECOND_HAND_NEGATIVE_NAMES) || tags["second_hand"] === "clothes" || tags["clothes"] === "yes") {
        excluded.push({ reason: "Second hand non-electronics check failed", name, tags });
        continue;
      }
      filtered.push({ cat: "refurbisher", name: name || "Second-Hand Electronics Resale Center", tags });
      continue;
    }

    // 4. Charity
    if (tags.shop === "charity") {
      if (isDisallowedName(name, CHARITY_NEGATIVE_NAMES)) {
        excluded.push({ reason: "Charity non-electronics check failed", name, tags });
        continue;
      }
      filtered.push({ cat: "ngo", name: name || "Charity Donation Drop-off Point", tags });
      continue;
    }
  }

  console.log(`\n=== EXCLUDED (${excluded.length} items) ===`);
  excluded.forEach((x, i) => console.log(`  [${i+1}] "${x.name}" -> ${x.reason} (tags: ${JSON.stringify(x.tags)})`));

  console.log(`\n=== ACCEPTED (${filtered.length} items) ===`);
  filtered.forEach((x, i) => console.log(`  [${i+1}] [${x.cat.toUpperCase()}] "${x.name}"`));
}

run();
