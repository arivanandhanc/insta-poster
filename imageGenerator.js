require("./dns-fix");
const axios = require("axios");
const fs    = require("fs");
const path  = require("path");

const HF_URL = "https://router.huggingface.co/hf-inference/models/black-forest-labs/FLUX.1-schnell";
const wait   = (ms) => new Promise((r) => setTimeout(r, ms));

function ensureDir() {
  const dir = path.join(__dirname, "temp_images");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// ── 1. HuggingFace FLUX ───────────────────────────────────────────────────────
async function tryHuggingFace(prompt, filename) {
  if (!process.env.HF_API_KEY) return null;
  console.log(`🎨 [1/9] HuggingFace FLUX`);
  try {
    const r = await axios({
      url: HF_URL, method: "post",
      data: { inputs: `Tamil Nadu, ${prompt.slice(0, 100)}, photorealistic, cinematic, golden hour` },
      headers: { Authorization: `Bearer ${process.env.HF_API_KEY}`, "Content-Type": "application/json", Accept: "image/jpeg" },
      responseType: "arraybuffer", timeout: 90000,
    });
    if (r.status === 503) { await wait(20000); return tryHuggingFace(prompt, filename + "_r"); }
    const fp = path.join(ensureDir(), `${filename}.jpg`);
    fs.writeFileSync(fp, r.data);
    console.log(`   ✅ HuggingFace OK (${r.data.length} bytes)`);
    return fp;
  } catch (e) {
    const s = Buffer.from(e.response?.data || []).toString().slice(0, 80);
    console.log(`   ⚠️  HF failed (${e.response?.status}): ${s || e.message}`);
    return null;
  }
}

// ── 2. Together AI — FLUX.1-schnell-Free (free signup) ───────────────────────
async function tryTogetherAI(prompt, filename) {
  if (!process.env.TOGETHER_API_KEY) return null;
  console.log(`🎨 [2/9] Together AI FLUX`);
  try {
    const r = await axios.post(
      "https://api.together.xyz/v1/images/generations",
      { model: "black-forest-labs/FLUX.1-schnell-Free", prompt: `Tamil Nadu, ${prompt.slice(0, 150)}, photorealistic, cinematic`, width: 1024, height: 1024, steps: 4, n: 1 },
      { headers: { Authorization: `Bearer ${process.env.TOGETHER_API_KEY}` }, timeout: 90000 }
    );
    const url = r.data?.data?.[0]?.url;
    if (!url) throw new Error("No URL");
    const img = await axios.get(url, { responseType: "arraybuffer", timeout: 30000 });
    const fp = path.join(ensureDir(), `${filename}.jpg`);
    fs.writeFileSync(fp, img.data);
    console.log(`   ✅ Together AI OK`);
    return fp;
  } catch (e) {
    console.log(`   ⚠️  Together AI failed: ${e.response?.data?.error || e.message}`);
    return null;
  }
}

// ── 3. Stability AI (free credits on signup) ──────────────────────────────────
async function tryStabilityAI(prompt, filename) {
  if (!process.env.STABILITY_API_KEY) return null;
  console.log(`🎨 [3/9] Stability AI`);
  try {
    const FormData = require("form-data");
    const fd = new FormData();
    fd.append("prompt", `Tamil Nadu, ${prompt.slice(0, 150)}, photorealistic, cinematic`);
    fd.append("output_format", "jpeg");
    const r = await axios.post(
      "https://api.stability.ai/v2beta/stable-image/generate/ultra",
      fd,
      { headers: { ...fd.getHeaders(), Authorization: `Bearer ${process.env.STABILITY_API_KEY}`, Accept: "image/*" }, responseType: "arraybuffer", timeout: 60000 }
    );
    const fp = path.join(ensureDir(), `${filename}.jpg`);
    fs.writeFileSync(fp, r.data);
    console.log(`   ✅ Stability AI OK`);
    return fp;
  } catch (e) {
    console.log(`   ⚠️  Stability AI failed: ${e.response?.status}`);
    return null;
  }
}

// ── 4-7. Pollinations (multiple models, no key needed) ────────────────────────
async function tryPollinations(prompt, filename, model, attempt) {
  console.log(`🎨 [${attempt}/9] Pollinations (${model})`);
  const seed = Math.floor(Math.random() * 999999);
  const p = encodeURIComponent(`Tamil Nadu South India, ${prompt.slice(0, 120)}, photorealistic, cinematic, vibrant`);
  const url = `https://image.pollinations.ai/prompt/${p}?model=${model}&width=1024&height=1024&seed=${seed}`;
  for (let i = 0; i < 3; i++) {
    try {
      const r = await axios.get(url, {
        responseType: "arraybuffer", timeout: 90000,
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0" },
      });
      if (!(r.headers["content-type"] || "").includes("image")) throw new Error("Not an image");
      const fp = path.join(ensureDir(), `${filename}.png`);
      fs.writeFileSync(fp, r.data);
      console.log(`   ✅ Pollinations ${model} OK`);
      return fp;
    } catch (e) {
      if (i < 2) { await wait((i + 1) * 10000); continue; }
      console.log(`   ⚠️  Pollinations ${model} failed: ${e.response?.status || e.message}`);
      return null;
    }
  }
  return null;
}

// ── 8. Craiyon (completely free, no account, slower) ─────────────────────────
async function tryCraiyon(prompt, filename) {
  console.log(`🎨 [8/9] Craiyon (free)`);
  try {
    const r = await axios.post(
      "https://backend.craiyon.com/generate",
      { prompt: `Tamil Nadu, South India, ${prompt.slice(0, 80)}, photorealistic` },
      { headers: { "Content-Type": "application/json", "User-Agent": "Mozilla/5.0" }, timeout: 120000 }
    );
    const images = r.data?.images;
    if (!images?.length) throw new Error("No images");
    const fp = path.join(ensureDir(), `${filename}.jpg`);
    fs.writeFileSync(fp, Buffer.from(images[0], "base64"));
    console.log(`   ✅ Craiyon OK`);
    return fp;
  } catch (e) {
    console.log(`   ⚠️  Craiyon failed: ${e.message}`);
    return null;
  }
}

// ── 9. SVG Canvas Generator — NEVER FAILS (pure JavaScript, zero deps) ────────
function generateSVGImage(topic, hook, filename) {
  console.log(`🎨 [9/9] SVG Canvas (local — guaranteed)`);

  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  // Word-wrap helper
  const wrap = (text, maxChars) => {
    const words = String(text).split(" ");
    const lines = [];
    let cur = "";
    for (const w of words) {
      if ((cur + " " + w).trim().length <= maxChars) { cur = (cur + " " + w).trim(); }
      else { if (cur) lines.push(cur); cur = w; }
    }
    if (cur) lines.push(cur);
    return lines;
  };

  const hookLines  = wrap(hook  || topic, 22);
  const topicLines = wrap(topic || hook,  32).slice(0, 3);

  const hookY  = 290;
  const topicY = hookY + hookLines.length * 80 + 80;

  const hookSVG = hookLines.map((l, i) =>
    `<text x="540" y="${hookY + i * 80}" font-family="Georgia,'Times New Roman',serif" font-size="64" font-weight="bold" fill="#FFFFFF" text-anchor="middle" dominant-baseline="middle">${esc(l)}</text>`
  ).join("\n  ");

  const topicSVG = topicLines.map((l, i) =>
    `<text x="540" y="${topicY + i * 56}" font-family="Arial,Helvetica,sans-serif" font-size="40" fill="#FFD700" text-anchor="middle" dominant-baseline="middle">${esc(l)}</text>`
  ).join("\n  ");

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1080" height="1080" xmlns="http://www.w3.org/2000/svg">
<defs>
  <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="#120300"/>
    <stop offset="45%" stop-color="#2a0800"/>
    <stop offset="100%" stop-color="#060606"/>
  </linearGradient>
  <linearGradient id="fade" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0%" stop-color="#FF6B00" stop-opacity="0"/>
    <stop offset="30%" stop-color="#FF6B00"/>
    <stop offset="70%" stop-color="#FF6B00"/>
    <stop offset="100%" stop-color="#FF6B00" stop-opacity="0"/>
  </linearGradient>
  <linearGradient id="gold" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0%" stop-color="#FFD700" stop-opacity="0"/>
    <stop offset="30%" stop-color="#FFD700"/>
    <stop offset="70%" stop-color="#FFD700"/>
    <stop offset="100%" stop-color="#FFD700" stop-opacity="0"/>
  </linearGradient>
  <radialGradient id="glow" cx="50%" cy="50%" r="50%">
    <stop offset="0%" stop-color="#FF6B00" stop-opacity="0.15"/>
    <stop offset="100%" stop-color="#FF6B00" stop-opacity="0"/>
  </radialGradient>
</defs>

<!-- Background -->
<rect width="1080" height="1080" fill="url(#bg)"/>
<rect width="1080" height="1080" fill="url(#glow)"/>

<!-- Outer border double -->
<rect x="12" y="12" width="1056" height="1056" fill="none" stroke="#FF6B00" stroke-width="3"/>
<rect x="20" y="20" width="1040" height="1040" fill="none" stroke="#FF6B00" stroke-width="1" stroke-dasharray="10,6" opacity="0.6"/>

<!-- Corner accents -->
<polyline points="12,80 12,12 80,12"  fill="none" stroke="#FFD700" stroke-width="5"/>
<polyline points="1000,12 1068,12 1068,80" fill="none" stroke="#FFD700" stroke-width="5"/>
<polyline points="12,1000 12,1068 80,1068" fill="none" stroke="#FFD700" stroke-width="5"/>
<polyline points="1000,1068 1068,1068 1068,1000" fill="none" stroke="#FFD700" stroke-width="5"/>

<!-- Header band -->
<rect x="12" y="12" width="1056" height="105" fill="#FF6B00" fill-opacity="0.18"/>

<!-- Account name -->
<text x="540" y="75" font-family="Arial,Helvetica,sans-serif" font-size="34" font-weight="bold" fill="#FF6B00" text-anchor="middle" letter-spacing="4">TAMILNADU UNFILTERED</text>

<!-- Header separator -->
<rect x="60" y="118" width="960" height="2.5" fill="url(#fade)"/>
<circle cx="60" cy="119" r="5" fill="#FF6B00"/>
<circle cx="1020" cy="119" r="5" fill="#FF6B00"/>

<!-- Hook text (large white bold) -->
${hookSVG}

<!-- Divider between hook and topic -->
<rect x="180" y="${topicY - 45}" width="720" height="2" fill="url(#gold)"/>

<!-- Topic text (golden) -->
${topicSVG}

<!-- Bottom separator -->
<rect x="60" y="940" width="960" height="2.5" fill="url(#fade)"/>
<circle cx="60" cy="941" r="5" fill="#FF6B00"/>
<circle cx="1020" cy="941" r="5" fill="#FF6B00"/>

<!-- Footer band -->
<rect x="12" y="950" width="1056" height="118" fill="#FF6B00" fill-opacity="0.10"/>

<!-- Hashtags -->
<text x="540" y="992" font-family="Arial,Helvetica,sans-serif" font-size="24" fill="#FF6B00" text-anchor="middle">#TamilHistory #TamilCulture #TamilNadu #TamilPride</text>
<text x="540" y="1040" font-family="Arial,Helvetica,sans-serif" font-size="20" fill="#888" text-anchor="middle">Follow for daily Tamil heritage stories</text>
</svg>`;

  try {
    const { Resvg } = require("@resvg/resvg-js");
    const resvg = new Resvg(svg, { fitTo: { mode: "width", value: 1080 } });
    const pngData = resvg.render().asPng();
    const fp = path.join(ensureDir(), `${filename}_canvas.png`);
    fs.writeFileSync(fp, pngData);
    console.log(`   ✅ SVG canvas image generated (${pngData.length} bytes)`);
    return fp;
  } catch (e) {
    // Ultra-last resort: save the SVG itself (some hosts accept SVG)
    console.log(`   ⚠️  resvg failed (${e.message}) — saving SVG directly`);
    const fp = path.join(ensureDir(), `${filename}_canvas.svg`);
    fs.writeFileSync(fp, svg);
    return fp;
  }
}

// ── MASTER PIPELINE — tries all 9 providers in order ──────────────────────────
async function smartGenerateImage(imagePrompt, filename, { topic = "", hook = "" } = {}) {
  const r1 = await tryHuggingFace(imagePrompt, filename);
  if (r1) return r1;

  const r2 = await tryTogetherAI(imagePrompt, filename + "_t");
  if (r2) return r2;

  const r3 = await tryStabilityAI(imagePrompt, filename + "_s");
  if (r3) return r3;

  const r4 = await tryPollinations(imagePrompt, filename + "_p1", "flux", 4);
  if (r4) return r4;

  const r5 = await tryPollinations(imagePrompt, filename + "_p2", "flux-realism", 5);
  if (r5) return r5;

  const r6 = await tryPollinations(imagePrompt, filename + "_p3", "turbo", 6);
  if (r6) return r6;

  const r7 = await tryPollinations(imagePrompt, filename + "_p4", "dreamshaper", 7);
  if (r7) return r7;

  const r8 = await tryCraiyon(imagePrompt, filename + "_cr");
  if (r8) return r8;

  // Layer 9: LOCAL SVG — GUARANTEED, needs no internet
  return generateSVGImage(topic || imagePrompt, hook || imagePrompt, filename);
}

function cleanupImage(filePath) {
  try {
    if (filePath && !filePath.startsWith("http") && fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch {}
}

module.exports = { smartGenerateImage, cleanupImage };
