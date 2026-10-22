import fs from "fs";
import path from "path";
import puppeteer from "puppeteer-core";

const chromePaths = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
];

const executablePath = chromePaths.find((p) => fs.existsSync(p));
const ARTIFACT_DIR = "C:\\Users\\chila\\.gemini\\antigravity\\brain\\763254a1-2e4e-4ee9-b662-fbae44828d9e";

async function downloadBase64(url) {
  const res = await fetch(url);
  const buffer = await res.arrayBuffer();
  return Buffer.from(buffer).toString("base64");
}

async function run() {
  console.log("==================================================");
  console.log("RE:LOOP FRESH FULL END-TO-END FLOW (PRODUCTION)");
  console.log("Target: https://reloop-ashen.vercel.app");
  console.log("==================================================\n");

  const phoneUrl = "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=400&q=80";
  console.log("Downloading test phone image...");
  const phoneB64 = await downloadBase64(phoneUrl);
  const tempPhonePath = path.resolve("test_phone_fresh.jpg");
  fs.writeFileSync(tempPhonePath, Buffer.from(phoneB64, "base64"));

  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    defaultViewport: { width: 1280, height: 950 },
  });

  const page = await browser.newPage();
  page.on("console", (msg) => {
    const text = msg.text();
    if (text.includes("error") || text.includes("Error") || text.includes("Scan") || text.includes("AI")) {
      console.log("[PAGE LOG]", text);
    }
  });

  // 1. GOTO /analyze
  console.log("Step 1: Navigating to /analyze...");
  await page.goto("https://reloop-ashen.vercel.app/analyze", { waitUntil: "networkidle0" });

  const fileInput = await page.$("input[type=file]");
  await fileInput.uploadFile(tempPhonePath);
  console.log("Uploaded file to file input, waiting 2s for client canvas resize...");
  await new Promise((r) => setTimeout(r, 2000));

  console.log("Step 2: Submitting image via 'Assess Item Condition' button...");
  const clickedAssess = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll("button"));
    const btn = buttons.find((b) => b.textContent && b.textContent.includes("Assess Item Condition"));
    if (btn) {
      btn.click();
      return true;
    }
    return false;
  });
  console.log("Clicked Assess Item Condition button:", clickedAssess);

  console.log("Step 3: Waiting for verification form (Step 02 / Human Verification)...");
  await page.waitForFunction(
    () =>
      document.body.innerText.includes("Step 02 / Human Verification") ||
      document.body.innerText.includes("Confirm & Save Item") ||
      document.body.innerText.includes("Item Category / Type"),
    { timeout: 60000 }
  );
  await new Promise((r) => setTimeout(r, 2000));

  console.log("Step 4: Confirming verified item facts via 'Confirm & Save Item'...");
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll("button"));
    const btn = buttons.find((b) => b.textContent && b.textContent.includes("Confirm & Save Item"));
    if (btn) btn.click();
  });

  console.log("Step 5: Waiting for decision engine results page (/analyze/[itemId]/results)...");
  let resultsUrl = page.url();
  const startWait = Date.now();
  while (!resultsUrl.includes("/results") && Date.now() - startWait < 30000) {
    await new Promise((r) => setTimeout(r, 500));
    resultsUrl = page.url();
  }
  console.log("Results URL reached:", resultsUrl);

  const itemIdMatch = resultsUrl.match(/\/analyze\/([^/]+)\/results/);
  const scannedItemId = itemIdMatch ? itemIdMatch[1] : null;
  console.log("Scanned Item ID:", scannedItemId);

  // Capture Results Screen (1280px & 375px)
  console.log("Capturing fresh scan results screenshots...");
  await page.setViewport({ width: 1280, height: 950 });
  await page.screenshot({ path: path.join(ARTIFACT_DIR, "fresh_scan_result_1280.png"), fullPage: false });

  await page.setViewport({ width: 375, height: 812 });
  await page.screenshot({ path: path.join(ARTIFACT_DIR, "fresh_scan_result_375.png"), fullPage: false });
  await page.setViewport({ width: 1280, height: 950 });

  // Step 6: Get "Schedule pickup for this item" link and navigate
  console.log("Step 6: Waiting for 'Schedule pickup for this item' link and navigating...");
  await page.waitForSelector('a[href*="/request?itemId="]', { timeout: 20000 });
  const pickupHref = await page.evaluate(() => {
    const link = document.querySelector('a[href*="/request?itemId="]');
    return link ? link.href : null;
  });
  console.log("Found Pickup Href:", pickupHref);

  await page.goto(pickupHref, { waitUntil: "networkidle0" });
  console.log("Request URL loaded:", page.url());
  await new Promise((r) => setTimeout(r, 2500));

  // Capture Prefilled Pickup Form Step 1
  console.log("Capturing prefilled pickup form screenshots...");
  await page.setViewport({ width: 1280, height: 950 });
  await page.screenshot({ path: path.join(ARTIFACT_DIR, "fresh_pickup_prefilled_1280.png"), fullPage: false });

  await page.setViewport({ width: 375, height: 812 });
  await page.screenshot({ path: path.join(ARTIFACT_DIR, "fresh_pickup_prefilled_375.png"), fullPage: false });
  await page.setViewport({ width: 1280, height: 950 });

  // Step 7: Proceed through the request stepper
  console.log("Step 7a: Continuing from Step 1 (Items) to Step 2 (Location)...");
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll("button")).find((b) => b.textContent && b.textContent.includes("Continue to Location"));
    if (btn) btn.click();
  });
  await new Promise((r) => setTimeout(r, 1200));

  console.log("Step 7b: Filling location address in Step 2...");
  await page.waitForSelector("#address-input", { timeout: 10000 });
  await page.type("#address-input", "Plot 104, Road No 36, Jubilee Hills, Hyderabad");
  await new Promise((r) => setTimeout(r, 1000));

  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll("button")).find((b) => b.textContent && b.textContent.includes("Continue to Schedule"));
    if (btn) btn.click();
  });
  await new Promise((r) => setTimeout(r, 1200));

  console.log("Step 7c: Filling contact details in Step 3...");
  await page.waitForSelector("#phone-input", { timeout: 10000 });
  await page.type("#phone-input", "+91-98765-43210");
  await page.type("#name-input", "Anita Rao");
  await new Promise((r) => setTimeout(r, 1000));

  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll("button")).find((b) => b.textContent && b.textContent.includes("Continue to Review"));
    if (btn) btn.click();
  });
  await new Promise((r) => setTimeout(r, 1500));

  console.log("Step 7d: Confirming and booking pickup in Step 4 via 'Confirm Pickup'...");
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll("button")).find((b) => b.textContent && b.textContent.includes("Confirm Pickup"));
    if (btn) btn.click();
  });

  // Step 8: Wait for Step 5 (Confirmed)
  console.log("Step 8: Waiting for booking confirmation and canonical token...");
  await page.waitForFunction(
    () => document.body.innerText.includes("Pickup requested") || document.body.innerText.includes("RLP-HYD-"),
    { timeout: 30000 }
  );
  await new Promise((r) => setTimeout(r, 2000));

  // Extract generated token
  const pageText = await page.evaluate(() => document.body.innerText);
  const tokenMatch = pageText.match(/RLP-HYD-[23456789ABCDEFGHJKMNPQRSTVWXYZ]{10}/i);
  const generatedToken = tokenMatch ? tokenMatch[0] : null;
  console.log("Generated Canonical Tracking Token:", generatedToken);

  if (generatedToken) {
    // Step 9: Open /track/[token]
    console.log(`Step 9: Opening /track/${generatedToken}...`);
    await page.goto(`https://reloop-ashen.vercel.app/track/${generatedToken}`, { waitUntil: "networkidle0" });
    await new Promise((r) => setTimeout(r, 2500));

    console.log("Capturing tracking pass screenshots...");
    await page.setViewport({ width: 1280, height: 950 });
    await page.screenshot({ path: path.join(ARTIFACT_DIR, "fresh_track_linked_1280.png"), fullPage: false });

    await page.setViewport({ width: 375, height: 812 });
    await page.screenshot({ path: path.join(ARTIFACT_DIR, "fresh_track_linked_375.png"), fullPage: false });
    await page.setViewport({ width: 1280, height: 950 });

    // Step 10: Open /collector
    console.log("Step 10: Opening /collector console...");
    await page.goto("https://reloop-ashen.vercel.app/collector", { waitUntil: "networkidle0" });
    await new Promise((r) => setTimeout(r, 3000));

    console.log("Capturing collector console screenshots...");
    await page.setViewport({ width: 1280, height: 950 });
    await page.screenshot({ path: path.join(ARTIFACT_DIR, "fresh_collector_linked_1280.png"), fullPage: false });

    await page.setViewport({ width: 375, height: 812 });
    await page.screenshot({ path: path.join(ARTIFACT_DIR, "fresh_collector_linked_375.png"), fullPage: false });
  }

  await browser.close();

  console.log("\n==================================================");
  console.log("E2E FRESH FLOW COMPLETE!");
  console.log("Scanned Item ID:", scannedItemId);
  console.log("Generated Tracking Token:", generatedToken);
  console.log("==================================================");
}

run().catch((e) => {
  console.error("Flow failed:", e);
  process.exit(1);
});
