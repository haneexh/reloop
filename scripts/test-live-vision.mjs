import fs from 'fs';
import path from 'path';

const BYPASS_TOKEN = 'dgZ5fqHmlHXTNV52UUGSvDMFkWnW4wEG';
const API_URL = 'https://reloop-ashen.vercel.app/api/analyze-image';
const ARTIFACT_DIR = 'C:/Users/chila/.gemini/antigravity/brain/763254a1-2e4e-4ee9-b662-fbae44828d9e';

// Load real image 1: user uploaded broken phone photo
const phoneImgPath = path.join(ARTIFACT_DIR, '.user_uploaded', 'media_1790931675607.png');
const phoneBase64 = fs.readFileSync(phoneImgPath).toString('base64');

// Load real image 2: screenshot 1 (homepage UI)
const img2Path = path.join(ARTIFACT_DIR, 'screenshot_1_homepage.png');
const img2Base64 = fs.readFileSync(img2Path).toString('base64');

// Load real image 3: screenshot 3 (results UI / laptop assessment)
const img3Path = path.join(ARTIFACT_DIR, 'screenshot_3_results.png');
const img3Base64 = fs.readFileSync(img3Path).toString('base64');

const testCases = [
  { id: 1, name: 'Real Photo 1: Shattered Smartphone Screen', base64: phoneBase64, mediaType: 'image/png' },
  { id: 2, name: 'Real Photo 2: Laptop Circular Evaluation Assessment', base64: img3Base64, mediaType: 'image/png' },
  { id: 3, name: 'Real Photo 3: Electronics Routing / Hardware Capture', base64: img2Base64, mediaType: 'image/png' },
];

async function runTests() {
  const results = [];

  for (const tc of testCases) {
    console.log(`\n========================================`);
    console.log(`Running ${tc.name}...`);
    const startTime = Date.now();

    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-vercel-protection-bypass': BYPASS_TOKEN,
        },
        body: JSON.stringify({
          imageBase64: tc.base64,
          mediaType: tc.mediaType,
        }),
      });

      const elapsedMs = Date.now() - startTime;
      const status = res.status;
      const json = await res.json();

      console.log(`Status: ${status} in ${elapsedMs}ms`);
      console.log(`Response:`, JSON.stringify(json, null, 2));

      results.push({
        id: tc.id,
        name: tc.name,
        status,
        elapsedMs,
        response: json,
      });
    } catch (err) {
      const elapsedMs = Date.now() - startTime;
      console.error(`Error in ${tc.name}:`, err);
      results.push({
        id: tc.id,
        name: tc.name,
        status: 'ERROR',
        elapsedMs,
        error: err.message,
      });
    }

    // Delay between requests
    await new Promise((r) => setTimeout(r, 2000));
  }

  console.log('\n\nFinal Summary:');
  console.log(JSON.stringify(results, null, 2));
}

runTests();
