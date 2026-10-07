import fs from "fs";

// Let's check Vercel env or test with curl against models
const envContent = fs.readFileSync(".env.production.local", "utf8");
console.log("Prod env loaded");
