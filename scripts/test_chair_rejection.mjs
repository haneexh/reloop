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
  console.log("Sleeping 25s to completely clear any Gemini RPM limit...");
  await new Promise((r) => setTimeout(r, 25000));

  const chairBase64 = await downloadBase64("https://images.unsplash.com/photo-1592078615290-033ee584e267?auto=format&fit=crop&w=400&q=80");
  
  console.log("Testing API directly for Chair...");
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

  console.log("Sleeping 15s before launching browser for rejection UI capture...");
  await new Promise((r) => setTimeout(r, 15000));

  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    defaultViewport: { width: 1280, height: 950 },
  });

  const page = await browser.newPage();
  const tempChairPath = path.resolve("test_chair.jpg");
  fs.writeFileSync(tempChairPath, Buffer.from(chairBase64, "base64"));

  console.log("Navigating to /analyze...");
  await page.goto("https://reloop-ashen.vercel.app/analyze", { waitUntil: "networkidle0" });

  const fileInput = await page.$("input[type=file]");
  await fileInput.uploadFile(tempChairPath);
  await new Promise((r) => setTimeout(r, 1500));

  console.log("Submitting non-electronic item...");
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll("button"));
    const btn = buttons.find((b) => b.textContent.includes("Start Assessment") || b.textContent.includes("Start Circular Assessment"));
    if (btn) btn.click();
  });

  console.log("Waiting for rejection alert banner...");
  await page.waitForFunction(
    () => document.body.innerText.includes("Scope Policy Gate") || document.body.innerText.includes("Non-Electronic Item Detected") || document.body.innerText.includes("RE:LOOP currently only assesses electronic items"),
    { timeout: 60000 }
  );
  await new Promise((r) => setTimeout(r, 2000));

  const rejectionScreenshotPath = "C:\\Users\\chila\\.gemini\\antigravity\\brain\\763254a1-2e4e-4ee9-b662-fbae44828d9e\\screenshot_rejection.png";
  await page.screenshot({ path: rejectionScreenshotPath, fullPage: false });
  console.log(`Successfully saved rejection screenshot to ${rejectionScreenshotPath}`);

  await browser.close();
  if (fs.existsSync(tempChairPath)) fs.unlinkSync(tempChairPath);

  // Now sleep 20s and do smartphone normal analysis
  console.log("Sleeping 20s before capturing normal smartphone analysis screenshot...");
  await new Promise((r) => setTimeout(r, 20000));

  const phoneBase64 = await downloadBase64("https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=400&q=80");
  const tempPhonePath = path.resolve("test_phone.jpg");
  fs.writeFileSync(tempPhonePath, Buffer.from(phoneBase64, "base64"));

  const browser2 = await puppeteer.launch({
    executablePath,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    defaultViewport: { width: 1280, height: 950 },
  });

  const page2 = await browser2.newPage();
  console.log("Navigating to /analyze for phone...");
  await page2.goto("https://reloop-ashen.vercel.app/analyze", { waitUntil: "networkidle0" });

  const fileInput2 = await page2.$("input[type=file]");
  await fileInput2.uploadFile(tempPhonePath);
  await new Promise((r) => setTimeout(r, 1500));

  console.log("Submitting electronic smartphone...");
  await page2.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll("button"));
    const btn = buttons.find((b) => b.textContent.includes("Start Assessment") || b.textContent.includes("Start Circular Assessment"));
    if (btn) btn.click();
  });

  console.log("Waiting for review step...");
  await page2.waitForFunction(
    () => document.body.innerText.includes("Step 02 / Human Verification") || document.body.innerText.includes("Does this look right? Verify facts.") || document.body.innerText.includes("Confirm & Evaluate"),
    { timeout: 60000 }
  );
  await new Promise((r) => setTimeout(r, 2000));

  const normalAnalysisScreenshotPath = "C:\\Users\\chila\\.gemini\\antigravity\\brain\\763254a1-2e4e-4ee9-b662-fbae44828d9e\\screenshot_normal_analysis.png";
  await page2.screenshot({ path: normalAnalysisScreenshotPath, fullPage: false });
  console.log(`Successfully saved normal analysis screenshot to ${normalAnalysisScreenshotPath}`);

  await browser2.close();
  if (fs.existsSync(tempPhonePath)) fs.unlinkSync(tempPhonePath);
  console.log("All done!");
}

run().catch((err) => {
  console.error("Run error:", err);
  process.exit(1);
});
