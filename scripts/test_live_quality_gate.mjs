import fs from "fs";

async function downloadBase64(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download ${url}: ${res.statusText}`);
  const buffer = await res.arrayBuffer();
  return Buffer.from(buffer).toString("base64");
}

async function getOperatorCookie() {
  const res = await fetch("https://reloop-ashen.vercel.app/api/auth/operator", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role: "ADMIN", isDemo: true }),
  });
  const cookieHeader = res.headers.get("set-cookie");
  if (!cookieHeader) throw new Error("Could not obtain operator cookie");
  return cookieHeader.split(";")[0];
}

async function clearCache(cookie) {
  const res = await fetch("https://reloop-ashen.vercel.app/api/analyze-image/cache?clear_all=true", {
    method: "DELETE",
    headers: { Cookie: cookie },
  });
  return res.json();
}

async function run() {
  console.log("=== OBTAINING OPERATOR SESSION & CLEARING CACHE ===");
  const cookie = await getOperatorCookie();
  const clearResult = await clearCache(cookie);
  console.log("Cache clear result:", clearResult);

  const testCases = [
    {
      name: "Smartphone",
      url: "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=400&q=80",
    },
    {
      name: "Laptop",
      url: "https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?auto=format&fit=crop&w=400&q=80",
    },
    {
      name: "T-Shirt (Non-Electronic)",
      url: "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=400&q=80",
    },
  ];

  for (const tc of testCases) {
    console.log(`\n========================================`);
    console.log(`TESTING: ${tc.name}`);
    console.log(`Downloading ${tc.url}...`);
    const b64 = await downloadBase64(tc.url);

    const start = Date.now();
    const res = await fetch("https://reloop-ashen.vercel.app/api/analyze-image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        imageBase64: b64,
        mediaType: "image/jpeg",
      }),
    });
    const latency = Date.now() - start;
    const json = await res.json();

    console.log(`Response status: ${res.status} in ${latency}ms`);
    console.log("Full JSON response:", JSON.stringify(json, null, 2));

    // Sleep 3s between requests to be gentle on RPM
    await new Promise((r) => setTimeout(r, 3000));
  }
}

run().catch((e) => {
  console.error("Test failed:", e);
  process.exit(1);
});
