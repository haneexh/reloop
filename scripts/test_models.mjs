import fs from "fs";

const envContent = fs.readFileSync(".env.local", "utf8");
const match = envContent.match(/GEMINI_API_KEY=(.*)/);
const apiKey = match ? match[1].trim().replace(/^["']|["']$/g, "") : "";

async function test() {
  const models = [
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-1.5-flash",
    "gemini-2.5-pro",
    "gemini-1.5-pro",
  ];
  for (const m of models) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: "Respond with {\"test\": true}" }] }],
          generationConfig: { responseMimeType: "application/json" }
        })
      });
      console.log(m, "Status:", res.status);
      if (!res.ok) {
        console.log(await res.text());
      } else {
        const d = await res.json();
        console.log(m, "Output:", d.candidates?.[0]?.content?.parts?.[0]?.text);
      }
    } catch (e) {
      console.log(m, "Error:", e.message);
    }
  }
}

test();
