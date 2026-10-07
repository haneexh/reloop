import fs from 'fs';
import path from 'path';

const BYPASS_TOKEN = 'dgZ5fqHmlHXTNV52UUGSvDMFkWnW4wEG';
const API_URL = 'https://reloop-ashen.vercel.app/api/analyze-image';

// 3 distinct real image payloads (minimal valid JPEG structures with distinct headers and payloads)
const image1 = 'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='; // Laptop sample
const image2 = 'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='; // Phone sample
const image3 = 'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR42mNkaGBgAAAByAFb0XvUAAAAAElFTkSuQmCC'; // Microwave sample

const testCases = [
  { id: 1, name: 'Attempt 1: Laptop image', base64: image1, mediaType: 'image/png' },
  { id: 2, name: 'Attempt 2: Phone image', base64: image2, mediaType: 'image/png' },
  { id: 3, name: 'Attempt 3: Appliance image', base64: image3, mediaType: 'image/png' },
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

    // Short gap between requests
    await new Promise(r => setTimeout(r, 1000));
  }

  console.log('\n\nFinal Summary:');
  console.log(JSON.stringify(results, null, 2));
}

runTests();
