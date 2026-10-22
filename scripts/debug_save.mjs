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

  await page.goto("https://reloop-ashen.vercel.app/analyze", { waitUntil: "networkidle0" });
  const fileInput = await page.$("input[type=file]");
  await fileInput.uploadFile("test_phone_fresh.jpg");
  await new Promise((r) => setTimeout(r, 2000));

  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll("button")).find((b) => b.textContent?.includes("Assess Item Condition"));
    if (btn) btn.click();
  });

  await page.waitForFunction(() => document.body.innerText.includes("Confirm & Save Item"), { timeout: 30000 });
  console.log("At review screen!");

  // Now click Confirm & Save Item
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll("button")).find((b) => b.textContent?.includes("Confirm & Save Item"));
    if (btn) btn.click();
  });

  await new Promise((r) => setTimeout(r, 6000));
  console.log("Current URL after 6s:", page.url());
  const errorText = await page.evaluate(() => {
    const err = document.querySelector(".bg-\\[\\#FAECE6\\]") || document.querySelector("[class*='FAECE6']");
    return err ? err.innerText : "No error banner";
  });
  console.log("Error banner on page:", errorText);

  await browser.close();
}
run();
