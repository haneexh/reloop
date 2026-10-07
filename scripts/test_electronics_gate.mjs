import fs from "fs";
import path from "path";
import puppeteer from "puppeteer-core";

const chromePaths = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe"
];

const executablePath = chromePaths.find((p) => fs.existsSync(p));

const testImages = [
  {
    name: "chair (non-electronic)",
    url: "https://images.unsplash.com/photo-1592078615290-033ee584e267?auto=format&fit=crop&w=400&q=80",
    expectedElectronic: false,
  },
  {
    name: "t-shirt (non-electronic)",
    url: "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=400&q=80",
    expectedElectronic: false,
  },
  {
    name: "plant (non-electronic)",
    url: "https://images.unsplash.com/photo-1485955900006-10f4d324d411?auto=format&fit=crop&w=400&q=80",
    expectedElectronic: false,
  },
  {
    name: "smartphone (electronic)",
    url: "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=400&q=80",
    expectedElectronic: true,
  },
  {
    name: "laptop (electronic)",
    url: "https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?auto=format&fit=crop&w=400&q=80",
    expectedElectronic: true,
  },
];

async function downloadBase64(url) {
  const res = await fetch(url);
  const buffer = await res.arrayBuffer();
  return Buffer.from(buffer).toString("base64");
}

async function run() {
  console.log("=== 1. Testing API Endpoints Directly with 3s Spacing ===");
  for (const item of testImages) {
    console.log(`Testing ${item.name}...`);
    const base64 = await downloadBase64(item.url);
    const apiRes = await fetch("https://reloop-ashen.vercel.app/api/analyze-image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        imageBase64: base64,
        mediaType: "image/jpeg",
      }),
    });
    const json = await apiRes.json();
    console.log(`Response for ${item.name}:`, JSON.stringify(json, null, 2));
    if (item.expectedElectronic) {
      if (json.success && !json.not_electronic) {
        console.log(`✅ ${item.name} PASSED (accepted as electronic: ${json.data?.item_type})`);
      } else {
        console.error(`❌ ${item.name} FAILED`);
      }
    } else {
      if (!json.success && json.not_electronic) {
        console.log(`✅ ${item.name} PASSED (correctly rejected as non-electronic)`);
      } else {
        console.error(`❌ ${item.name} FAILED`);
      }
    }
    await new Promise((r) => setTimeout(r, 3500));
  }

  console.log("\n=== 2. Capturing Live Browser UI Screenshots ===");
  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    defaultViewport: { width: 1280, height: 950 },
  });

  const page = await browser.newPage();

  // Save temporary test images locally
  const tempChairPath = path.resolve("test_chair.jpg");
  const tempPhonePath = path.resolve("test_phone.jpg");

  const chairBuffer = Buffer.from(await downloadBase64(testImages[0].url), "base64");
  fs.writeFileSync(tempChairPath, chairBuffer);

  const phoneBuffer = Buffer.from(await downloadBase64(testImages[3].url), "base64");
  fs.writeFileSync(tempPhonePath, phoneBuffer);

  // --- UI Test 1: Non-electronic rejection on /analyze ---
  console.log("Navigating to https://reloop-ashen.vercel.app/analyze for rejection test...");
  await page.goto("https://reloop-ashen.vercel.app/analyze", { waitUntil: "networkidle0" });

  const fileInput = await page.$("input[type=file]");
  await fileInput.uploadFile(tempChairPath);
  await new Promise((r) => setTimeout(r, 1200));

  console.log("Clicking Start Circular Assessment for non-electronic chair...");
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll("button"));
    const btn = buttons.find((b) => b.textContent.includes("Start Assessment") || b.textContent.includes("Start Circular Assessment"));
    if (btn) btn.click();
  });

  // Wait for rejection banner to appear
  console.log("Waiting for rejection banner...");
  await page.waitForFunction(
    () => document.body.innerText.includes("Non-Electronic Item Detected") || document.body.innerText.includes("RE:LOOP currently only assesses electronic items"),
    { timeout: 40000 }
  );
  await new Promise((r) => setTimeout(r, 1500));

  const rejectionScreenshotPath = "C:\\Users\\chila\\.gemini\\antigravity\\brain\\763254a1-2e4e-4ee9-b662-fbae44828d9e\\screenshot_rejection.png";
  await page.screenshot({ path: rejectionScreenshotPath, fullPage: false });
  console.log(`Saved rejection screenshot to ${rejectionScreenshotPath}`);

  // Wait 4s to prevent rate limits
  await new Promise((r) => setTimeout(r, 4000));

  // --- UI Test 2: Normal electronic analysis on /analyze ---
  console.log("\nNavigating to fresh /analyze for electronic analysis test...");
  await page.goto("https://reloop-ashen.vercel.app/analyze", { waitUntil: "networkidle0" });

  const fileInput2 = await page.$("input[type=file]");
  await fileInput2.uploadFile(tempPhonePath);
  await new Promise((r) => setTimeout(r, 1200));

  console.log("Clicking Start Circular Assessment for smartphone...");
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll("button"));
    const btn = buttons.find((b) => b.textContent.includes("Start Assessment") || b.textContent.includes("Start Circular Assessment"));
    if (btn) btn.click();
  });

  // Wait for step 2 review to appear
  console.log("Waiting for human verification review step...");
  await page.waitForFunction(
    () => document.body.innerText.includes("Step 02 / Human Verification") || document.body.innerText.includes("Does this look right? Verify facts.") || document.body.innerText.includes("Confirm & Evaluate"),
    { timeout: 40000 }
  );
  await new Promise((r) => setTimeout(r, 1500));

  const normalAnalysisScreenshotPath = "C:\\Users\\chila\\.gemini\\antigravity\\brain\\763254a1-2e4e-4ee9-b662-fbae44828d9e\\screenshot_normal_analysis.png";
  await page.screenshot({ path: normalAnalysisScreenshotPath, fullPage: false });
  console.log(`Saved normal analysis screenshot to ${normalAnalysisScreenshotPath}`);

  await browser.close();

  // Clean up temp images
  if (fs.existsSync(tempChairPath)) fs.unlinkSync(tempChairPath);
  if (fs.existsSync(tempPhonePath)) fs.unlinkSync(tempPhonePath);
  console.log("All tests and screenshots completed successfully!");
}

run().catch((err) => {
  console.error("Test error:", err);
  process.exit(1);
});
