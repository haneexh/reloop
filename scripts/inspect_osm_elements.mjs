async function inspect() {
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
  node["shop"="second_hand"](around:${radiusMeters},${lat},${lng});
  way["shop"="second_hand"](around:${radiusMeters},${lat},${lng});
  node["shop"="charity"](around:${radiusMeters},${lat},${lng});
  way["shop"="charity"](around:${radiusMeters},${lat},${lng});
  node["amenity"="recycling"](around:${radiusMeters},${lat},${lng});
  way["amenity"="recycling"](around:${radiusMeters},${lat},${lng});
);
out center tags;
`.trim();

  const endpoints = [
    "https://lz4.overpass-api.de/api/interpreter",
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
  ];

  for (const ep of endpoints) {
    try {
      console.log(`Trying ${ep}...`);
      const res = await fetch(ep, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "ReLoopCircularApp/1.0 (+https://reloop-ashen.vercel.app)",
        },
        body: `data=${encodeURIComponent(overpassQuery)}`,
      });

      const text = await res.text();
      if (res.ok) {
        const json = JSON.parse(text);
        console.log(`Total elements: ${json.elements?.length}`);
        for (const el of json.elements || []) {
          console.log(`----------------------------------------`);
          console.log(`ID: ${el.type}/${el.id}`);
          console.log(`Name: "${el.tags?.name || "unnamed"}"`);
          console.log(`Tags:`, el.tags);
        }
        return;
      } else {
        console.warn(`Failed on ${ep}: status ${res.status}`);
      }
    } catch (e) {
      console.warn(`Error on ${ep}:`, e.message);
    }
  }
}

inspect();
