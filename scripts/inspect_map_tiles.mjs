import puppeteer from "puppeteer-core";

const browser = await puppeteer.launch({
  executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  headless: true,
  args: ["--no-sandbox", "--disable-setuid-sandbox"],
});

const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 1100, deviceScaleFactor: 2 });

const tileLogs = [];
page.on("request", r => {
  if (r.url().includes("tile.openstreetmap.org")) {
    tileLogs.push({ url: r.url(), type: "request" });
  }
});
page.on("response", r => {
  if (r.url().includes("tile.openstreetmap.org")) {
    tileLogs.push({ url: r.url(), status: r.status() });
  }
});
page.on("requestfailed", r => {
  if (r.url().includes("tile.openstreetmap.org")) {
    tileLogs.push({ url: r.url(), error: r.failure()?.errorText });
  }
});

console.log("Navigating to http://localhost:3000/destinations...");
await page.goto("http://localhost:3000/destinations", { waitUntil: "networkidle2", timeout: 30000 });

// Wait for dynamic component to compile and leaflet tiles to appear
try {
  await page.waitForSelector(".leaflet-tile-loaded", { timeout: 15000 });
} catch {
  console.log("Waiting for .leaflet-tile fallback...");
  await page.waitForSelector(".leaflet-tile", { timeout: 10000 });
}
await new Promise(r => setTimeout(r, 2000));

// Click "Repair Lab" tab
const buttons = await page.$$("button");
for (const btn of buttons) {
  const text = await page.evaluate(el => el.textContent, btn);
  if (text && text.includes("Repair Lab")) {
    await btn.click();
    console.log("Clicked Repair Lab");
    break;
  }
}

await new Promise(r => setTimeout(r, 3000));

// Inspect leaflet container and tiles
const mapDetails = await page.evaluate(() => {
  const container = document.querySelector(".leaflet-container");
  const tileImgs = Array.from(document.querySelectorAll(".leaflet-tile")).map(img => ({
    src: img.src,
    complete: img.complete,
    naturalWidth: img.naturalWidth,
    naturalHeight: img.naturalHeight,
    visible: img.style.visibility,
    opacity: img.style.opacity,
    display: window.getComputedStyle(img).display,
    width: window.getComputedStyle(img).width,
    height: window.getComputedStyle(img).height,
  }));
  return {
    containerWidth: container?.clientWidth,
    containerHeight: container?.clientHeight,
    totalTiles: tileImgs.length,
    tiles: tileImgs.slice(0, 5),
  };
});

console.log("Map Details:", JSON.stringify(mapDetails, null, 2));
console.log("Tile requests count:", tileLogs.length);
console.log("Sample tile logs:", tileLogs.slice(0, 6));

// Take full page screenshot
await page.screenshot({
  path: "C:\\Users\\chila\\.gemini\\antigravity\\brain\\763254a1-2e4e-4ee9-b662-fbae44828d9e\\screenshot_tightened_osm_destinations.png",
  fullPage: false,
});
console.log("Saved screenshot_tightened_osm_destinations.png");

// Take a screenshot of the map element itself
const mapElement = await page.$(".leaflet-container");
if (mapElement) {
  await mapElement.screenshot({
    path: "C:\\Users\\chila\\.gemini\\antigravity\\brain\\763254a1-2e4e-4ee9-b662-fbae44828d9e\\screenshot_map_element.png",
  });
  console.log("Saved screenshot_map_element.png");
}

await browser.close();
