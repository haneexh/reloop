import puppeteer from "puppeteer-core";

const browser = await puppeteer.launch({
  executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  headless: true,
  args: ["--no-sandbox", "--disable-setuid-sandbox"],
});

const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 1100, deviceScaleFactor: 2 });

console.log("Navigating to http://localhost:3000/destinations...");
await page.goto("http://localhost:3000/destinations", { waitUntil: "networkidle2", timeout: 30000 });

// Wait for OSM data query to finish (either "Live OpenStreetMap data" badge appears or "Verified Partners" fallback)
try {
  await page.waitForFunction(
    () => document.body.innerText.includes("Live OpenStreetMap data") || document.body.innerText.includes("Verified Partners"),
    { timeout: 12000 }
  );
} catch (e) {
  console.log("Timed out waiting for text, waiting 3s...");
  await new Promise(r => setTimeout(r, 3000));
}

// Click the "Repair Lab" tab filter
try {
  const buttons = await page.$$("button");
  for (const btn of buttons) {
    const text = await page.evaluate(el => el.textContent, btn);
    if (text && text.includes("Repair Lab")) {
      await btn.click();
      console.log("Clicked Repair Lab filter tab");
      break;
    }
  }
} catch (e) {
  console.log("Could not click Repair Lab filter:", e);
}

await new Promise(r => setTimeout(r, 1000));

const screenshotPath = "C:\\Users\\chila\\.gemini\\antigravity\\brain\\763254a1-2e4e-4ee9-b662-fbae44828d9e\\screenshot_tightened_osm_destinations.png";
await page.screenshot({ path: screenshotPath, fullPage: false });

console.log(`Screenshot saved to ${screenshotPath}`);
await browser.close();
