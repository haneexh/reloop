import fs from "fs";

const env = fs.readFileSync(".env.production.local", "utf8");
const m = env.match(/GEMINI_API_KEY=(.*)/);
const key = m ? m[1].trim().replace(/^['"]|['"]$/g, "") : "";

async function check() {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
  const data = await res.json();
  if (data.models) {
    console.log("Success! Models:", data.models.map(x => x.name.replace("models/", "")));
  } else {
    console.log("Failed:", data);
  }
}

check();
