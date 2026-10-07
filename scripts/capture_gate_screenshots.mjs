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
  console.log("=== CAPTURING REJECTION & NORMAL ANALYSIS SCREENSHOTS ===");
  console.log("Waiting 20s for Gemini rate limits to clear...");
  await new Promise((r) => setTimeout(r, 20000));

  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    defaultViewport: { width: 1280, height: 950 },
  });

  const page = await browser.newPage();

  // Test images
  const tempChairPath = path.resolve("test_chair.jpg");
  const tempPhonePath = path.resolve("test_phone.jpg");

  const chairB64 = await downloadBase64("https://images.unsplash.com/photo-1592078615290-033ee584e267?auto=format&fit=crop&w=400&q=80");
  const phoneB64 = await downloadBase64("https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=400&q=80");

  fs.writeFileSync(tempChairPath, Buffer.from(chairB64, "base64"));
  fs.writeFileSync(tempPhonePath, Buffer.from(phoneB64, "base64"));

  // 1. REJECTION TEST
  console.log("\n[1/2] Loading /analyze for non-electronic upload (Chair)...");
  await page.goto("https://reloop-ashen.vercel.app/analyze", { waitUntil: "networkidle0" });

  const fileInput1 = await page.$("input[type=file]");
  await fileInput1.uploadFile(tempChairPath);
  await new Promise((r) => setTimeout(r, 1500));

  console.log("Clicking 'Assess Item Condition' button...");
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll("button"));
    const btn = buttons.find((b) => b.textContent.includes("Assess Item Condition"));
    if (btn) {
      btn.click();
    } else {
      throw new Error("Assess button not found");
    }
  });

  console.log("Waiting for rejection alert banner...");
  await page.waitForFunction(
    () => document.body.innerText.includes("Non-Electronic Item Detected") || document.body.innerText.includes("Scope Policy Gate") || document.body.innerText.includes("RE:LOOP currently only assesses electronic items"),
    { timeout: 60000 }
  );
  await new Promise((r) => setTimeout(r, 2000));

  const rejectionScreenshotPath = "C:\\Users\\chila\\.gemini\\antigravity\\brain\\763254a1-2e4e-4ee9-b662-fbae44828d9e\\screenshot_rejection.png";
  await page.screenshot({ path: rejectionScreenshotPath, fullPage: false });
  console.log(`✅ Saved rejection screenshot to: ${rejectionScreenshotPath}`);

  // Wait 20s to ensure fresh quota for electronic item
  console.log("\nWaiting 20s before electronic test...");
  await new Promise((r) => setTimeout(r, 20000));

  // 2. NORMAL ELECTRONIC ANALYSIS TEST
  console.log("[2/2] Loading fresh /analyze for electronic upload (Smartphone)...");
  await page.goto("https://reloop-ashen.vercel.app/analyze", { waitUntil: "networkidle0" });

  const fileInput2 = await page.$("input[type=file]");
  await fileInput2.uploadFile(tempPhonePath);
  await new Promise((r) => setTimeout(r, 1500));

  console.log("Clicking 'Assess Item Condition' button...");
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll("button"));
    const btn = buttons.find((b) => b.textContent.includes("Assess Item Condition"));
    if (btn) {
      btn.click();
    } else {
      throw new Error("Assess button not found");
    }
  });

  console.log("Waiting for Step 02 / Human Verification...");
  await page.waitForFunction(
    () => document.body.innerText.includes("Step 02") || document.body.innerText.includes("Human Verification") || document.body.innerText.includes("Does this look right? Verify facts.") || document.body.innerText.includes("Confirm & Evaluate"),
    { timeout: 60000 }
  );
  await new Promise((r) => setTimeout(r, 2000));

  const normalAnalysisScreenshotPath = "C:\\Users\\chila\\.gemini\\antigravity\\brain\\763254a1-2e4e-4ee9-b662-fbae44828d9e\\screenshot_normal_analysis.png";
  await page.screenshot({ path: normalAnalysisScreenshotPath, fullPage: false });
  console.log(`✅ Saved normal analysis screenshot to: ${normalAnalysisScreenshotPath}`);

  await browser.close();

  if (fs.existsSync(tempChairPath)) fs.unlinkSync(tempChairPath);
  if (fs.existsSync(tempPhonePath)) fs.unlinkSync(tempPhonePath);
  console.log("\n🎉 Both screenshots captured successfully!");
}

run().catch((err) => {
  console.error("Execution failed:", err);
  process.exit(1);
});
