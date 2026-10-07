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

async function testOpenAI() {
  const res = await fetch("https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=400&q=80");
  const buffer = await res.arrayBuffer();
  const base64 = Buffer.from(buffer).toString("base64");

  const openAiRes = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      max_tokens: 1000,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You are a circular economy assessor for RE:LOOP.
RE:LOOP STRICTLY AND EXCLUSIVELY assesses physical electronic devices, electrical equipment, and electronics hardware/components.

STEP 1: FIRST, inspect the photograph and classify whether it shows a physical electronic device or electronic component (anything that contains circuitry, a battery, a power cord/plug, an electric motor, or an electronic display/screen — for example: phones, laptops, PCs, monitors, CRT TVs, appliances with electronic controls, audio equipment, gaming consoles, cables, chargers, power supplies, circuit boards, cameras, printers, electronic tools, etc.).

If the photo does NOT depict an electronic item (for example: clothing, apparel, shoes, wooden/fabric furniture, plants, food, humans, pets/animals, books, tableware, sports gear, non-electronic toys, plastic containers, paper products, etc.):
You MUST return ONLY this JSON:
{
  "is_electronic": false,
  "rejection_reason": "Non-electronic object detected (briefly name what is in the photo, e.g., 'clothing' or 'wooden chair' or 'houseplant')."
}

STEP 2: If the photo DOES depict an electronic device or component, set "is_electronic": true and return:
{
  "is_electronic": true,
  "item_type": string,
  "brand": string | null,
  "estimated_age_years": number | null,
  "condition": "functional" | "cosmetic_damage" | "partially_working" | "severely_damaged",
  "condition_notes": string,
  "material_recoverable": boolean,
  "confidence": "high" | "medium" | "low"
}`,
        },
        {
          role: "user",
          content: [
            { type: "text", text: "Assess this item." },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${base64}`,
                detail: "low",
              },
            },
          ],
        },
      ],
    }),
  });

  console.log("OpenAI status:", openAiRes.status);
  const data = await openAiRes.json();
  console.log("OpenAI output:", JSON.stringify(data, null, 2));
}

testOpenAI();
