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

async function downloadBase64(url) {
  const res = await fetch(url);
  const buffer = await res.arrayBuffer();
  return Buffer.from(buffer).toString("base64");
}

async function run() {
  console.log("Waiting 15 seconds for any rate-limit window to clear...");
  await new Promise((r) => setTimeout(r, 15000));

  console.log("\n--- Test 1: Non-electronic Chair ---");
  const chairBase64 = await downloadBase64("https://images.unsplash.com/photo-1592078615290-033ee584e267?auto=format&fit=crop&w=400&q=80");
  const res1 = await fetch("https://reloop-ashen.vercel.app/api/analyze-image", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      imageBase64: chairBase64,
      mediaType: "image/jpeg",
    }),
  });
  const json1 = await res1.json();
  console.log("Chair API Result:", JSON.stringify(json1, null, 2));

  console.log("\nWaiting 10 seconds before electronic test...");
  await new Promise((r) => setTimeout(r, 10000));

  console.log("\n--- Test 2: Electronic Smartphone ---");
  const phoneBase64 = await downloadBase64("https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=400&q=80");
  const res2 = await fetch("https://reloop-ashen.vercel.app/api/analyze-image", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      imageBase64: phoneBase64,
      mediaType: "image/jpeg",
    }),
  });
  const json2 = await res2.json();
  console.log("Phone API Result:", JSON.stringify(json2, null, 2));

  console.log("\n--- Test 3: Capturing Live UI Screenshots ---");
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

  fs.writeFileSync(tempChairPath, Buffer.from(chairBase64, "base64"));
  fs.writeFileSync(tempPhonePath, Buffer.from(phoneBase64, "base64"));

  // 1. Screenshot Rejection
  console.log("Loading /analyze for non-electronic upload...");
  await page.goto("https://reloop-ashen.vercel.app/analyze", { waitUntil: "networkidle0" });

  const fileInput = await page.$("input[type=file]");
  await fileInput.uploadFile(tempChairPath);
  await new Promise((r) => setTimeout(r, 1000));

  console.log("Clicking assessment button...");
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll("button"));
    const btn = buttons.find((b) => b.textContent.includes("Start Assessment") || b.textContent.includes("Start Circular Assessment"));
    if (btn) btn.click();
  });

  console.log("Waiting for rejection UI banner...");
  await page.waitForFunction(
    () => document.body.innerText.includes("Non-Electronic Item Detected") || document.body.innerText.includes("RE:LOOP currently only assesses electronic items"),
    { timeout: 45000 }
  );
  await new Promise((r) => setTimeout(r, 1500));

  const rejectionScreenshotPath = "C:\\Users\\chila\\.gemini\\antigravity\\brain\\763254a1-2e4e-4ee9-b662-fbae44828d9e\\screenshot_rejection.png";
  await page.screenshot({ path: rejectionScreenshotPath, fullPage: false });
  console.log(`Saved rejection screenshot to ${rejectionScreenshotPath}`);

  console.log("Waiting 10 seconds before electronic UI test...");
  await new Promise((r) => setTimeout(r, 10000));

  // 2. Screenshot Normal Analysis
  console.log("Loading /analyze for electronic upload...");
  await page.goto("https://reloop-ashen.vercel.app/analyze", { waitUntil: "networkidle0" });

  const fileInput2 = await page.$("input[type=file]");
  await fileInput2.uploadFile(tempPhonePath);
  await new Promise((r) => setTimeout(r, 1000));

  console.log("Clicking assessment button...");
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll("button"));
    const btn = buttons.find((b) => b.textContent.includes("Start Assessment") || b.textContent.includes("Start Circular Assessment"));
    if (btn) btn.click();
  });

  console.log("Waiting for review step...");
  await page.waitForFunction(
    () => document.body.innerText.includes("Step 02 / Human Verification") || document.body.innerText.includes("Does this look right? Verify facts.") || document.body.innerText.includes("Confirm & Evaluate"),
    { timeout: 45000 }
  );
  await new Promise((r) => setTimeout(r, 1500));

  const normalAnalysisScreenshotPath = "C:\\Users\\chila\\.gemini\\antigravity\\brain\\763254a1-2e4e-4ee9-b662-fbae44828d9e\\screenshot_normal_analysis.png";
  await page.screenshot({ path: normalAnalysisScreenshotPath, fullPage: false });
  console.log(`Saved normal analysis screenshot to ${normalAnalysisScreenshotPath}`);

  await browser.close();

  if (fs.existsSync(tempChairPath)) fs.unlinkSync(tempChairPath);
  if (fs.existsSync(tempPhonePath)) fs.unlinkSync(tempPhonePath);
  console.log("Single test and screenshot run finished!");
}

run().catch((err) => {
  console.error("Run error:", err);
  process.exit(1);
});
