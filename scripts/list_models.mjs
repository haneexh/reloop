import fs from "fs";

// Let's list models via Gemini API using the production key from .env.production.local or .env.local
const envContent = fs.readFileSync(".env.local", "utf8");
const match = envContent.match(/GEMINI_API_KEY=(.*)/);
const apiKey = match ? match[1].trim().replace(/^["']|["']$/g, "") : "";

async function listModels() {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
  console.log("Status:", res.status);
  const data = await res.json();
  if (data.models) {
    console.log("Available models:", data.models.map(m => m.name.replace("models/", "")));
  } else {
    console.log("Response:", data);
  }
}

listModels();
