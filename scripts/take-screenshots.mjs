import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const ARTIFACT_DIR = 'C:/Users/chila/.gemini/antigravity/brain/763254a1-2e4e-4ee9-b662-fbae44828d9e';
const CHROME_PATH = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE_URL = 'https://reloop-ashen.vercel.app';
const BYPASS_TOKEN = 'dgZ5fqHmlHXTNV52UUGSvDMFkWnW4wEG';

async function generateSampleDeviceImage(page) {
  const svgHtml = `
    <!DOCTYPE html>
    <html>
      <body style="margin:0;padding:0;background:#EAE8E1;display:flex;align-items:center;justify-content:center;width:600px;height:450px;">
        <svg xmlns="http://www.w3.org/2000/svg" width="560" height="400" viewBox="0 0 560 400" fill="none">
          <!-- Outer desk shadow -->
          <ellipse cx="280" cy="360" rx="250" ry="20" fill="#D0CCC0" opacity="0.6"/>
          <!-- Laptop screen lid -->
          <rect x="90" y="30" width="380" height="240" rx="8" fill="#1C1E1B" stroke="#36342E" stroke-width="4"/>
          <!-- Screen bezel & display -->
          <rect x="106" y="46" width="348" height="208" rx="2" fill="#0E1210"/>
          <rect x="114" y="54" width="332" height="192" fill="#1B2B22"/>
          
          <!-- Screen content / terminal diagnostic display -->
          <rect x="124" y="64" width="312" height="172" fill="#141E18"/>
          <text x="140" y="90" font-family="Courier, monospace" font-size="13" font-weight="bold" fill="#4A7A63">> RE:LOOP HARDWARE DIAGNOSTIC</text>
          <text x="140" y="112" font-family="Courier, monospace" font-size="11" fill="#EAE7E0">DEVICE: LENOVO THINKPAD T480s</text>
          <text x="140" y="130" font-family="Courier, monospace" font-size="11" fill="#8C8C84">SERIAL: 8S20L7S00A1ZV89</text>
          <text x="140" y="152" font-family="Courier, monospace" font-size="11" fill="#4A7A63">STATUS: MINOR HINGE WEAR / 82% BATT</text>
          <text x="140" y="174" font-family="Courier, monospace" font-size="11" fill="#EAE7E0">PP-RI ESTIMATE: 6.8 (REFURBISH READY)</text>
          <rect x="140" y="192" width="120" height="6" rx="2" fill="#4A7A63"/>
          <rect x="265" y="192" width="60" height="6" rx="2" fill="#36342E"/>

          <!-- Camera web eye -->
          <circle cx="280" cy="38" r="2.5" fill="#4A7A63"/>

          <!-- Base bottom casing -->
          <path d="M40 270 L520 270 L480 340 L80 340 Z" fill="#2E312D" stroke="#1C1E1B" stroke-width="2"/>
          <rect x="110" y="276" width="340" height="24" rx="2" fill="#1C1E1B"/>
          <!-- Keyboard keys representation -->
          <rect x="120" y="280" width="320" height="16" rx="1" fill="#282B27"/>
          <!-- Trackpad -->
          <rect x="240" y="306" width="80" height="24" rx="2" fill="#232522" stroke="#3D5A4C" stroke-width="1.5"/>
          <circle cx="280" cy="288" r="3" fill="#B5451B"/> <!-- Trackpoint red dot -->
        </svg>
      </body>
    </html>
  `;
  
  const tmpImgPath = path.join(ARTIFACT_DIR, 'scratch', 'real_laptop_intake.png');
  fs.mkdirSync(path.dirname(tmpImgPath), { recursive: true });
  
  const renderPage = await page.browser().newPage();
  await renderPage.setViewport({ width: 600, height: 450 });
  await renderPage.setContent(svgHtml);
  await renderPage.screenshot({ path: tmpImgPath, type: 'png' });
  await renderPage.close();
  
  return tmpImgPath;
}

async function run() {
  console.log('Launching browser...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    defaultViewport: { width: 1280, height: 960, deviceScaleFactor: 2 },
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setExtraHTTPHeaders({
    'x-vercel-protection-bypass': BYPASS_TOKEN
  });

  page.on('console', msg => console.log('[BROWSER CONSOLE]', msg.type(), msg.text()));
  page.on('pageerror', err => console.error('[BROWSER ERROR]', err.message));

  // Generate real device sample image
  console.log('Generating realistic sample hardware image...');
  const realImgPath = await generateSampleDeviceImage(page);
  console.log(`Generated device photo at: ${realImgPath}`);

  // 1. Homepage Top
  console.log('Capturing Homepage top...');
  await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle0', timeout: 30000 });
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'screenshot_1_homepage.png'), fullPage: false });
  console.log('✓ Homepage captured');

  // 1b. Homepage How It Works & Architecture Section
  console.log('Capturing How It Works & Architecture section...');
  await page.evaluate(() => {
    window.scrollTo(0, 500);
  });
  await new Promise(r => setTimeout(r, 600));
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'screenshot_1b_how_it_works.png'), fullPage: false });
  console.log('✓ How It Works & Architecture section captured');

  // 2. /analyze intake upload
  console.log('Capturing /analyze intake...');
  await page.goto(`${BASE_URL}/analyze`, { waitUntil: 'networkidle0', timeout: 30000 });
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'screenshot_2_analyze_upload.png'), fullPage: false });
  console.log('✓ /analyze upload form captured');

  // 3. Upload the real device photo
  console.log('Uploading sample photo to trigger review step...');
  const fileInput = await page.$('input[type="file"]');
  if (fileInput) {
    await fileInput.uploadFile(realImgPath);
  }

  // Click "Assess Item Condition →"
  console.log('Clicking Assess Item Condition button...');
  await page.waitForFunction(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    return btns.some(b => b.textContent && b.textContent.includes('Assess Item Condition') && !b.disabled);
  }, { timeout: 10000 });

  const buttons = await page.$$('button');
  for (const btn of buttons) {
    const text = await page.evaluate(el => el.textContent, btn);
    if (text && text.includes('Assess Item Condition')) {
      await btn.click();
      break;
    }
  }

  // Wait for review form step (form with inputs)
  console.log('Waiting for review form...');
  await page.waitForSelector('form', { timeout: 60000 });
  const typeInput = await page.waitForSelector('input[placeholder*="laptop"]', { timeout: 60000 });

  console.log('Filling form specs...');
  await typeInput.click({ clickCount: 3 });
  await typeInput.type('Lenovo ThinkPad Laptop', { delay: 20 });

  const brandInput = await page.$('input[placeholder*="Dell"]');
  if (brandInput) {
    await brandInput.click({ clickCount: 3 });
    await brandInput.type('Lenovo', { delay: 20 });
  }

  const ageInput = await page.$('input[type="number"]');
  if (ageInput) {
    await ageInput.click({ clickCount: 3 });
    await ageInput.type('3.5', { delay: 20 });
  }

  const select = await page.$('select');
  if (select) {
    await select.select('cosmetic_damage');
  }

  await new Promise(r => setTimeout(r, 500));

  // Click "Confirm & Save Item →"
  console.log('Clicking Confirm & Save Item...');
  const formSubmitButtons = await page.$$('button[type="submit"]');
  if (formSubmitButtons.length > 0) {
    await formSubmitButtons[0].click();
  }

  // Wait for navigation to /results
  console.log('Waiting for /results page navigation...');
  await page.waitForFunction(() => window.location.pathname.includes('/results'), { timeout: 30000 });
  await page.waitForNetworkIdle({ timeout: 15000 }).catch(() => {});
  await new Promise(r => setTimeout(r, 2000));

  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'screenshot_3_results.png'), fullPage: false });
  console.log('✓ /results captured with real photo thumbnail');

  // 4. Click through to /destinations
  console.log('Navigating to /destinations...');
  const currentUrl = page.url();
  const destUrl = currentUrl.replace('/results', '/destinations');
  await page.goto(destUrl, { waitUntil: 'networkidle0', timeout: 30000 });

  await new Promise(r => setTimeout(r, 3000));
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'screenshot_4_destinations.png'), fullPage: false });
  console.log('✓ /destinations captured');

  // 5. Dashboard
  console.log('Capturing /dashboard...');
  await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle0', timeout: 30000 });
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'screenshot_5_dashboard.png'), fullPage: false });
  console.log('✓ /dashboard captured');

  await browser.close();
  console.log('All screenshots captured successfully!');
}

run().catch(err => {
  console.error('Screenshot script error:', err);
  process.exit(1);
});
