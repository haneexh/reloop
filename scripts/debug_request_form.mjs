import fs from "fs";
import puppeteer from "puppeteer-core";

const chromePaths = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
];
const executablePath = chromePaths.find((p) => fs.existsSync(p));

async function run() {
  const browser = await puppeteer.launch({ executablePath, headless: true, args: ["--no-sandbox"] });
  const page = await browser.newPage();
  page.on("console", (msg) => console.log("PAGE LOG:", msg.type(), msg.text()));
  page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));
  page.on("request", (req) => {
    if (req.url().includes("/api/requests") && req.method() === "POST") {
      console.log("REQUEST BODY:", req.postData());
    }
  });
  page.on("response", async (res) => {
    if (res.url().includes("/api/requests")) {
      console.log("NETWORK /api/requests status:", res.status());
      try {
        const text = await res.text();
        console.log("NETWORK /api/requests body:", text);
      } catch (e) {
        console.log("Could not read body:", e.message);
      }
    }
  });

  const url = "https://reloop-ashen.vercel.app/request?itemId=9c9b1519-aca3-4834-b30e-6f135d8cfc11&pathway=resell";
  console.log("Loading URL:", url);
  await page.goto(url, { waitUntil: "networkidle0" });
  await new Promise((r) => setTimeout(r, 2000));

  console.log("Step 1 -> 2");
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll("button")).find((b) => b.textContent && b.textContent.includes("Continue to Location"));
    if (btn) btn.click();
  });
  await new Promise((r) => setTimeout(r, 1000));

  console.log("Step 2 address typing");
  await page.waitForSelector("#address-input");
  await page.type("#address-input", "Plot 104, Road No 36, Jubilee Hills, Hyderabad");
  await new Promise((r) => setTimeout(r, 1000));

  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll("button")).find((b) => b.textContent && b.textContent.includes("Continue to Schedule"));
    if (btn) btn.click();
  });
  await new Promise((r) => setTimeout(r, 1000));

  console.log("Step 3 contact typing");
  await page.waitForSelector("#phone-input");
  await page.type("#phone-input", "+91-98765-43210");
  await page.type("#name-input", "Anita Rao");
  await new Promise((r) => setTimeout(r, 1000));

  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll("button")).find((b) => b.textContent && b.textContent.includes("Continue to Review"));
    if (btn) btn.click();
  });
  await new Promise((r) => setTimeout(r, 1500));

  console.log("Step 4 click Confirm Pickup");
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll("button")).find((b) => b.textContent && b.textContent.includes("Confirm Pickup"));
    if (btn) btn.click();
  });

  await new Promise((r) => setTimeout(r, 5000));
  const pageText = await page.evaluate(() => document.body.innerText);
  console.log("PAGE TEXT AFTER 5s:\n", pageText.slice(0, 1000));

  await browser.close();
}
run();
