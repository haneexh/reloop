import { parseOsmElements, classifyOsmElement, REPAIR_NEGATIVE_KEYWORDS, RECYCLING_NEGATIVE_KEYWORDS, SECOND_HAND_NEGATIVE_KEYWORDS, CHARITY_NEGATIVE_KEYWORDS } from "../lib/osm-parser.ts";

const lat = 17.449;
const lng = 78.391;
const radiusMeters = 15000;

const overpassQuery = `
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

console.log("Querying Overpass API for coordinates (17.449, 78.391)...");
const res = await fetch("https://lz4.overpass-api.de/api/interpreter", {
  method: "POST",
  headers: {
    "Content-Type": "application/x-www-form-urlencoded",
    "User-Agent": "ReLoopCircularApp/1.0",
  },
  body: `data=${encodeURIComponent(overpassQuery)}`,
});

const json = await res.json();
console.log(`Received ${json.elements?.length || 0} raw elements from Overpass.\n`);

const parsed = parseOsmElements(json.elements, lat, lng, 15);

console.log("=================================================");
console.log(`PARSED & TIGHTENED RESULTS (${parsed.length} items total)`);
console.log("=================================================\n");

const byType = {
  repair: [],
  recycler: [],
  refurbisher: [],
  ngo: [],
};

for (const p of parsed) {
  byType[p.partner_type].push(p);
}

console.log(`[REPAIR LABS] (${byType.repair.length} locations):`);
byType.repair.forEach((p, idx) => {
  console.log(`  ${idx + 1}. "${p.name}" | Dist: ${p.distanceKm} km | City: ${p.city} | Contact: ${p.contact || "N/A"}`);
});

console.log(`\n[RECYCLING HUBS] (${byType.recycler.length} locations):`);
byType.recycler.forEach((p, idx) => {
  console.log(`  ${idx + 1}. "${p.name}" | Dist: ${p.distanceKm} km | City: ${p.city} | Contact: ${p.contact || "N/A"}`);
});

console.log(`\n[SECOND-HAND / REFURBISH] (${byType.refurbisher.length} locations):`);
byType.refurbisher.forEach((p, idx) => {
  console.log(`  ${idx + 1}. "${p.name}" | Dist: ${p.distanceKm} km | City: ${p.city} | Contact: ${p.contact || "N/A"}`);
});

console.log(`\n[CHARITY / DONATION] (${byType.ngo.length} locations):`);
byType.ngo.forEach((p, idx) => {
  console.log(`  ${idx + 1}. "${p.name}" | Dist: ${p.distanceKm} km | City: ${p.city} | Contact: ${p.contact || "N/A"}`);
});
