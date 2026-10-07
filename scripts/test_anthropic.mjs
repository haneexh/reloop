import fs from "fs";

const envContent = fs.readFileSync(".env.local", "utf8");
const env = {};
envContent.split("\n").forEach((line) => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    let val = match[2].trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    env[match[1].trim()] = val;
  }
});

async function testTshirt() {
  const res = await fetch("https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=400&q=80");
  const buffer = await res.arrayBuffer();
  const base64 = Buffer.from(buffer).toString("base64");

  // Call Anthropic
  const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 1000,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: "image/jpeg",
                data: base64,
              },
            },
            {
              type: "text",
              text: `You are a circular economy assessor for RE:LOOP.
RE:LOOP STRICTLY AND EXCLUSIVELY assesses physical electronic devices, electrical equipment, and electronics hardware/components.

STEP 1: FIRST, inspect the photograph and classify whether it shows a physical electronic device or electronic component (anything that contains circuitry, a battery, a power cord/plug, an electric motor, or an electronic display/screen — for example: phones, laptops, PCs, monitors, CRT TVs, appliances with electronic controls, audio equipment, gaming consoles, cables, chargers, power supplies, circuit boards, cameras, printers, electronic tools, etc.).

If the photo does NOT depict an electronic item (for example: clothing, apparel, shoes, wooden/fabric furniture, plants, food, humans, pets/animals, books, tableware, sports gear, non-electronic toys, plastic containers, paper products, etc.):
You MUST return ONLY this JSON:
{
  "is_electronic": false,
  "rejection_reason": "Non-electronic object detected (briefly name what is in the photo, e.g., 'clothing' or 'wooden chair' or 'houseplant')."
}

STEP 2: If the photo DOES depict an electronic device or component, set "is_electronic": true and return full fields. Output raw JSON only.`,
            },
          ],
        },
      ],
    }),
  });

  console.log("Anthropic status:", anthropicRes.status);
  const data = await anthropicRes.json();
  console.log("Anthropic output:", JSON.stringify(data, null, 2));
}

testTshirt();
