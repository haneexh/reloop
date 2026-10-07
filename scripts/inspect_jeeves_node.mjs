const eps = [
  "https://overpass-api.de/api/interpreter",
  "https://lz4.overpass-api.de/api/interpreter",
  "https://z.overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

for (const ep of eps) {
  try {
    const res = await fetch(ep, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "ReLoop/1.0",
      },
      body: "data=" + encodeURIComponent("[out:json];node(5892276109);out meta tags;"),
    });

    if (res.ok) {
      const data = await res.json();
      console.log(`Success from ${ep}:`);
      console.log(JSON.stringify(data, null, 2));
      process.exit(0);
    } else {
      console.log(`${ep} returned HTTP ${res.status}`);
    }
  } catch (err) {
    console.log(`${ep} failed: ${err.message}`);
  }
}
