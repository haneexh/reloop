async function checkAllCategories() {
  const testCoords = [
    { city: "Hyderabad", lat: 17.449, lng: 78.391 },
    { city: "Bengaluru", lat: 12.9716, lng: 77.5946 },
    { city: "Delhi", lat: 28.6139, lng: 77.209 },
  ];

  for (const tc of testCoords) {
    console.log(`\n========================================`);
    console.log(`TESTING ${tc.city} (${tc.lat}, ${tc.lng})`);
    console.log(`========================================`);

    const query = `
[out:json][timeout:15];
(
  node["shop"="electronics_repair"](around:15000,${tc.lat},${tc.lng});
  way["shop"="electronics_repair"](around:15000,${tc.lat},${tc.lng});
  node["craft"="electronics_repair"](around:15000,${tc.lat},${tc.lng});
  way["craft"="electronics_repair"](around:15000,${tc.lat},${tc.lng});
  node["repair"="electronics"](around:15000,${tc.lat},${tc.lng});
  way["repair"="electronics"](around:15000,${tc.lat},${tc.lng});
  node["shop"="mobile_phone"]["repair"="yes"](around:15000,${tc.lat},${tc.lng});
  way["shop"="mobile_phone"]["repair"="yes"](around:15000,${tc.lat},${tc.lng});
  node["shop"="second_hand"](around:15000,${tc.lat},${tc.lng});
  way["shop"="second_hand"](around:15000,${tc.lat},${tc.lng});
  node["shop"="charity"](around:15000,${tc.lat},${tc.lng});
  way["shop"="charity"](around:15000,${tc.lat},${tc.lng});
  node["amenity"="recycling"](around:15000,${tc.lat},${tc.lng});
  way["amenity"="recycling"](around:15000,${tc.lat},${tc.lng});
);
out center tags;
`.trim();

    try {
      const res = await fetch("https://lz4.overpass-api.de/api/interpreter", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "ReLoopCircularApp/1.0",
        },
        body: `data=${encodeURIComponent(query)}`,
      });
      if (!res.ok) {
        console.warn(`Error on ${tc.city}: ${res.status}`);
        continue;
      }
      const data = await res.json();
      console.log(`Total raw elements found: ${data.elements?.length}`);
      
      const byCat = { repair: [], second_hand: [], charity: [], recycling: [] };
      for (const el of data.elements || []) {
        const t = el.tags || {};
        const name = t.name || "unnamed";
        if (t.shop === "electronics_repair" || t.craft === "electronics_repair" || t.repair === "electronics" || (t.shop === "mobile_phone" && t.repair === "yes")) {
          byCat.repair.push({ name, tags: t });
        } else if (t.shop === "second_hand") {
          byCat.second_hand.push({ name, tags: t });
        } else if (t.shop === "charity") {
          byCat.charity.push({ name, tags: t });
        } else if (t.amenity === "recycling") {
          byCat.recycling.push({ name, tags: t });
        }
      }

      console.log(`-- REPAIR (${byCat.repair.length}) --`);
      byCat.repair.forEach(x => console.log(`  * "${x.name}" ->`, x.tags));

      console.log(`-- SECOND HAND (${byCat.second_hand.length}) --`);
      byCat.second_hand.forEach(x => console.log(`  * "${x.name}" ->`, x.tags));

      console.log(`-- CHARITY (${byCat.charity.length}) --`);
      byCat.charity.forEach(x => console.log(`  * "${x.name}" ->`, x.tags));

      console.log(`-- RECYCLING (${byCat.recycling.length}) --`);
      byCat.recycling.forEach(x => console.log(`  * "${x.name}" ->`, x.tags));
    } catch (e) {
      console.error(e.message);
    }
  }
}

checkAllCategories();
