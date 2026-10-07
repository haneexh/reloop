async function verify() {
  const url = "https://reloop-ashen.vercel.app/analyze";
  const res = await fetch(url, {
    headers: { "x-vercel-protection-bypass": "dgZ5fqHmlHXTNV52UUGSvDMFkWnW4wEG" }
  });
  console.log("Status:", res.status);
  const html = await res.text();
  const chunkRegex = /src="(\/_next\/static\/chunks\/[^"]+)"/g;
  let match;
  let foundTakePhoto = false;
  let foundCapturePhoto = false;
  let foundEnvironmentCapture = false;

  while ((match = chunkRegex.exec(html)) !== null) {
    const chunkUrl = "https://reloop-ashen.vercel.app" + match[1];
    const chunkRes = await fetch(chunkUrl, {
      headers: { "x-vercel-protection-bypass": "dgZ5fqHmlHXTNV52UUGSvDMFkWnW4wEG" }
    });
    const js = await chunkRes.text();
    if (js.includes("Take Photo")) {
      foundTakePhoto = true;
    }
    if (js.includes("Capture Photo")) {
      foundCapturePhoto = true;
    }
    if (js.includes("capture") && js.includes("environment")) {
      foundEnvironmentCapture = true;
    }
  }

  console.log("Production JS bundle verification (/analyze):");
  console.log("- Take Photo option:", foundTakePhoto);
  console.log("- Live Capture Photo action:", foundCapturePhoto);
  console.log("- Mobile camera capture=\"environment\":", foundEnvironmentCapture);
}

verify().catch(console.error);
