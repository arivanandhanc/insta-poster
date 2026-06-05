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

// Map topic → Unsplash/Flickr search keywords for stock photo fallbacks
function topicToKeywords(topic = "") {
  const t = topic.toLowerCase();
  if (t.match(/temple|kovil|chola|pallava|dravidian|gopuram/)) return "Tamil,Nadu,temple,South,India";
  if (t.match(/food|cuisine|dosa|idli|biryani|samayal/))       return "Tamil,Nadu,food,South,India";
  if (t.match(/festival|pongal|diwali|karthigai|celebration/)) return "Tamil,Nadu,festival,South,India";
  if (t.match(/war|battle|king|emperor|chera|pandya|chola/))   return "India,ancient,history,Tamil,heritage";
  if (t.match(/dance|music|bharatanatyam|carnatic/))           return "Tamil,Nadu,dance,classical,India";
  if (t.match(/river|lake|sea|ocean|underwater|coast/))        return "South,India,coastal,nature,water";
  if (t.match(/village|agriculture|farmer|rural/))             return "Tamil,Nadu,village,rural,India";
  if (t.match(/science|innovation|technology|math/))           return "India,science,innovation,heritage";
  if (t.match(/literature|poem|sangam|thirukku/))              return "Tamil,Nadu,culture,heritage,India";
  return "Tamil,Nadu,South,India,heritage";
}

// ── 1. HuggingFace FLUX ───────────────────────────────────────────────────────
async function tryHuggingFace(prompt, filename) {
  if (!process.env.HF_API_KEY) return null;
  console.log(`🎨 [1] HuggingFace FLUX`);
  try {
    const r = await axios({
      url: HF_URL, method: "post",
      data: { inputs: `Tamil Nadu, ${prompt.slice(0, 100)}, photorealistic, cinematic, golden hour` },
      headers: { Authorization: `Bearer ${process.env.HF_API_KEY}`, "Content-Type": "application/json", Accept: "image/jpeg" },
      responseType: "arraybuffer", timeout: 90000,
    });
    if (r.data.length < 5000) throw new Error("Response too small — likely error");
    const fp = path.join(ensureDir(), `${filename}.jpg`);
    fs.writeFileSync(fp, r.data);
    console.log(`   ✅ HuggingFace OK (${r.data.length} bytes)`);
    return fp;
  } catch (e) {
    const s = Buffer.from(e.response?.data || []).toString().slice(0, 80);
    console.log(`   ⚠️  HF (${e.response?.status}): ${s || e.message}`);
    return null;
  }
}

// ── 2. Together AI — FLUX.1-schnell-Free ─────────────────────────────────────
async function tryTogetherAI(prompt, filename) {
  if (!process.env.TOGETHER_API_KEY) return null;
  console.log(`🎨 [2] Together AI FLUX`);
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
    console.log(`   ⚠️  Together AI: ${e.response?.data?.error || e.message}`);
    return null;
  }
}

// ── 3. Stability AI ───────────────────────────────────────────────────────────
async function tryStabilityAI(prompt, filename) {
  if (!process.env.STABILITY_API_KEY) return null;
  console.log(`🎨 [3] Stability AI`);
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
    console.log(`   ⚠️  Stability AI: ${e.response?.status}`);
    return null;
  }
}

// ── 4. DeepAI text2img (free account — add DEEPAI_API_KEY) ───────────────────
async function tryDeepAI(prompt, filename) {
  if (!process.env.DEEPAI_API_KEY) return null;
  console.log(`🎨 [4] DeepAI text2img`);
  try {
    const FormData = require("form-data");
    const fd = new FormData();
    fd.append("text", `Tamil Nadu South India, ${prompt.slice(0, 150)}, photorealistic, vibrant, cinematic`);
    const r = await axios.post("https://api.deepai.org/api/text2img", fd, {
      headers: { ...fd.getHeaders(), "api-key": process.env.DEEPAI_API_KEY },
      timeout: 60000,
    });
    const imageUrl = r.data?.output_url;
    if (!imageUrl) throw new Error("No output URL");
    const img = await axios.get(imageUrl, { responseType: "arraybuffer", timeout: 30000 });
    const fp = path.join(ensureDir(), `${filename}.jpg`);
    fs.writeFileSync(fp, img.data);
    console.log(`   ✅ DeepAI OK`);
    return fp;
  } catch (e) {
    console.log(`   ⚠️  DeepAI: ${e.response?.data?.err || e.message}`);
    return null;
  }
}

// ── 5. Prodia SD (free account — add PRODIA_API_KEY) ─────────────────────────
async function tryProdia(prompt, filename) {
  if (!process.env.PRODIA_API_KEY) return null;
  console.log(`🎨 [5] Prodia (Stable Diffusion)`);
  try {
    const gen = await axios.get("https://api.prodia.com/v1/sd/generate", {
      params: { apikey: process.env.PRODIA_API_KEY, prompt: `Tamil Nadu, ${prompt.slice(0, 100)}, photorealistic, 8k, vibrant`, model: "dreamshaperXL10_alpha2.safetensors [c8afe2ef]", steps: 25, width: 1024, height: 1024 },
      timeout: 10000,
    });
    const jobId = gen.data?.job;
    if (!jobId) throw new Error("No job ID");
    // Poll for completion
    for (let i = 0; i < 20; i++) {
      await wait(4000);
      const status = await axios.get(`https://api.prodia.com/v1/job/${jobId}`, { params: { apikey: process.env.PRODIA_API_KEY }, timeout: 10000 });
      if (status.data?.status === "succeeded") {
        const img = await axios.get(status.data.imageUrl, { responseType: "arraybuffer", timeout: 30000 });
        const fp = path.join(ensureDir(), `${filename}.jpg`);
        fs.writeFileSync(fp, img.data);
        console.log(`   ✅ Prodia OK`);
        return fp;
      }
      if (status.data?.status === "failed") throw new Error("Job failed");
    }
    throw new Error("Timeout");
  } catch (e) {
    console.log(`   ⚠️  Prodia: ${e.message}`);
    return null;
  }
}

// ── 6. Pollinations (multiple models, simplified URL) ─────────────────────────
async function tryPollinations(prompt, filename, model, layer) {
  console.log(`🎨 [${layer}] Pollinations (${model})`);
  const p    = encodeURIComponent(`Tamil Nadu, ${prompt.slice(0, 120)}, photorealistic, cinematic`);
  const seed = Math.floor(Math.random() * 999999);
  const url  = model
    ? `https://image.pollinations.ai/prompt/${p}?model=${model}&width=1024&height=1024&seed=${seed}`
    : `https://image.pollinations.ai/prompt/${p}?width=1024&height=1024&seed=${seed}`;
  for (let i = 0; i < 2; i++) {
    try {
      const r = await axios.get(url, {
        responseType: "arraybuffer", timeout: 90000,
        headers: { "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36" },
      });
      if (!(r.headers["content-type"] || "").includes("image")) throw new Error("Not an image");
      if (r.data.length < 5000) throw new Error("Image too small");
      const fp = path.join(ensureDir(), `${filename}.png`);
      fs.writeFileSync(fp, r.data);
      console.log(`   ✅ Pollinations ${model || "default"} OK`);
      return fp;
    } catch (e) {
      if (i === 0) { await wait(8000); continue; }
      console.log(`   ⚠️  Pollinations ${model || "default"}: ${e.response?.status || e.message}`);
      return null;
    }
  }
  return null;
}

// ── 6b. Replicate — open-source SDXL/FLUX (free credits on signup) ───────────
async function tryReplicate(prompt, filename) {
  if (!process.env.REPLICATE_API_TOKEN) return null;
  console.log(`🎨 [6b] Replicate (SDXL)`);
  try {
    const r1 = await axios.post(
      "https://api.replicate.com/v1/models/stability-ai/sdxl/predictions",
      { input: { prompt: `Tamil Nadu, South India, ${prompt.slice(0, 150)}, photorealistic, cinematic, vibrant, 8k`, width: 1024, height: 1024, num_outputs: 1 } },
      { headers: { Authorization: `Bearer ${process.env.REPLICATE_API_TOKEN}`, "Content-Type": "application/json" }, timeout: 15000 }
    );
    const predId = r1.data.id;
    if (!predId) throw new Error("No prediction ID");
    for (let i = 0; i < 30; i++) {
      await wait(3000);
      const poll = await axios.get(`https://api.replicate.com/v1/predictions/${predId}`, {
        headers: { Authorization: `Bearer ${process.env.REPLICATE_API_TOKEN}` }, timeout: 10000,
      });
      if (poll.data.status === "succeeded") {
        const imgUrl = poll.data.output?.[0];
        if (!imgUrl) throw new Error("No output URL");
        const img = await axios.get(imgUrl, { responseType: "arraybuffer", timeout: 30000 });
        const fp = path.join(ensureDir(), `${filename}.jpg`);
        fs.writeFileSync(fp, img.data);
        console.log(`   ✅ Replicate OK`);
        return fp;
      }
      if (poll.data.status === "failed") throw new Error("Prediction failed");
    }
    throw new Error("Timeout");
  } catch (e) {
    console.log(`   ⚠️  Replicate: ${e.response?.data?.detail || e.message}`);
    return null;
  }
}

// ── 6c. Fal.ai — fast FLUX (free credits on signup) ──────────────────────────
async function tryFalAI(prompt, filename) {
  if (!process.env.FAL_KEY) return null;
  console.log(`🎨 [6c] Fal.ai (FLUX)`);
  try {
    const r = await axios.post(
      "https://fal.run/fal-ai/flux/schnell",
      { prompt: `Tamil Nadu, South India, ${prompt.slice(0, 150)}, photorealistic, cinematic`, image_size: "square_hd", num_images: 1, num_inference_steps: 4 },
      { headers: { Authorization: `Key ${process.env.FAL_KEY}`, "Content-Type": "application/json" }, timeout: 60000 }
    );
    const imgUrl = r.data?.images?.[0]?.url;
    if (!imgUrl) throw new Error("No image URL");
    const img = await axios.get(imgUrl, { responseType: "arraybuffer", timeout: 30000 });
    const fp = path.join(ensureDir(), `${filename}.jpg`);
    fs.writeFileSync(fp, img.data);
    console.log(`   ✅ Fal.ai OK`);
    return fp;
  } catch (e) {
    console.log(`   ⚠️  Fal.ai: ${e.response?.data?.detail || e.message}`);
    return null;
  }
}

// ── 6d. Pexels — high-quality stock photos (free API key) ─────────────────────
async function tryPexels(topic, filename) {
  if (!process.env.PEXELS_API_KEY) return null;
  console.log(`🎨 [6d] Pexels (stock photos)`);
  const kw = topicToKeywords(topic).replace(/,/g, " ");
  try {
    const r = await axios.get(`https://api.pexels.com/v1/search?query=${encodeURIComponent(kw)}&per_page=15&orientation=square`, {
      headers: { Authorization: process.env.PEXELS_API_KEY }, timeout: 15000,
    });
    const photos = r.data?.photos;
    if (!photos?.length) throw new Error("No results");
    const pick = photos[Math.floor(Math.random() * Math.min(8, photos.length))];
    const imgUrl = pick.src?.large2x || pick.src?.large;
    const img = await axios.get(imgUrl, { responseType: "arraybuffer", timeout: 30000 });
    const fp = path.join(ensureDir(), `${filename}.jpg`);
    fs.writeFileSync(fp, img.data);
    console.log(`   ✅ Pexels OK`);
    return fp;
  } catch (e) {
    console.log(`   ⚠️  Pexels: ${e.message}`);
    return null;
  }
}

// ── 6e. Pixabay — free images (free API key, no attribution needed) ───────────
async function tryPixabay(topic, filename) {
  if (!process.env.PIXABAY_API_KEY) return null;
  console.log(`🎨 [6e] Pixabay (stock photos)`);
  const kw = topicToKeywords(topic).replace(/,/g, "+");
  try {
    const r = await axios.get(`https://pixabay.com/api/?key=${process.env.PIXABAY_API_KEY}&q=${encodeURIComponent(kw)}&image_type=photo&orientation=vertical&min_width=1000&per_page=20`, {
      timeout: 15000,
    });
    const hits = r.data?.hits;
    if (!hits?.length) throw new Error("No results");
    const pick = hits[Math.floor(Math.random() * Math.min(8, hits.length))];
    const imgUrl = pick.largeImageURL;
    const img = await axios.get(imgUrl, { responseType: "arraybuffer", timeout: 30000 });
    const fp = path.join(ensureDir(), `${filename}.jpg`);
    fs.writeFileSync(fp, img.data);
    console.log(`   ✅ Pixabay OK`);
    return fp;
  } catch (e) {
    console.log(`   ⚠️  Pixabay: ${e.message}`);
    return null;
  }
}

// ── 9. Lexica.art — search existing AI images (FREE, no auth) ─────────────────
async function tryLexica(prompt, topic, filename) {
  console.log(`🎨 [9] Lexica.art (AI image search)`);
  try {
    const q = `Tamil Nadu South India ${prompt.slice(0, 60)}`;
    const r = await axios.get(`https://lexica.art/api/v1/search?q=${encodeURIComponent(q)}`, {
      timeout: 15000, headers: { "User-Agent": "Mozilla/5.0" },
    });
    const images = r.data?.images;
    if (!images?.length) throw new Error("No results");
    const pick = images[Math.floor(Math.random() * Math.min(8, images.length))];
    const srcUrl = pick.src || pick.srcSmall;
    if (!srcUrl) throw new Error("No src URL");
    const img = await axios.get(srcUrl, { responseType: "arraybuffer", timeout: 30000, headers: { "User-Agent": "Mozilla/5.0" } });
    const fp = path.join(ensureDir(), `${filename}.jpg`);
    fs.writeFileSync(fp, img.data);
    console.log(`   ✅ Lexica.art OK`);
    return fp;
  } catch (e) {
    console.log(`   ⚠️  Lexica.art: ${e.message}`);
    return null;
  }
}

// ── 10. Unsplash Source (FREE, no auth) ───────────────────────────────────────
async function tryUnsplash(topic, filename) {
  console.log(`🎨 [10] Unsplash (stock photos)`);
  const kw = topicToKeywords(topic);
  try {
    const r = await axios.get(`https://source.unsplash.com/1080x1080/?${kw}`, {
      responseType: "arraybuffer", timeout: 20000, maxRedirects: 10,
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
    });
    if (!(r.headers["content-type"] || "").includes("image")) throw new Error("Not an image");
    const fp = path.join(ensureDir(), `${filename}.jpg`);
    fs.writeFileSync(fp, r.data);
    console.log(`   ✅ Unsplash OK`);
    return fp;
  } catch (e) {
    console.log(`   ⚠️  Unsplash: ${e.response?.status || e.message}`);
    return null;
  }
}

// ── 11. Lorem Flickr (FREE, Flickr CC photos, no auth) ───────────────────────
async function tryLoremFlickr(topic, filename) {
  console.log(`🎨 [11] Lorem Flickr (CC photos)`);
  const kw = topicToKeywords(topic).replace(/,/g, "/");
  try {
    const r = await axios.get(`https://loremflickr.com/1080/1080/${kw}?lock=${Math.floor(Math.random() * 99999)}`, {
      responseType: "arraybuffer", timeout: 20000, maxRedirects: 10,
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    if (!(r.headers["content-type"] || "").includes("image")) throw new Error("Not an image");
    const fp = path.join(ensureDir(), `${filename}.jpg`);
    fs.writeFileSync(fp, r.data);
    console.log(`   ✅ Lorem Flickr OK`);
    return fp;
  } catch (e) {
    console.log(`   ⚠️  Lorem Flickr: ${e.response?.status || e.message}`);
    return null;
  }
}

// ── 12. SVG Canvas — GUARANTEED (pure JS, zero internet, never fails) ─────────
function generateSVGImage(topic, hook, filename) {
  console.log(`🎨 [12] SVG Canvas (local — guaranteed)`);

  const esc  = (s) => String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  const wrap = (text, max) => {
    const words = String(text).split(" ");
    const lines = []; let cur = "";
    for (const w of words) {
      if ((cur + " " + w).trim().length <= max) cur = (cur + " " + w).trim();
      else { if (cur) lines.push(cur); cur = w; }
    }
    if (cur) lines.push(cur);
    return lines;
  };

  const hookLines  = wrap(hook  || topic, 20);
  const topicLines = wrap(topic || hook,  30).slice(0, 3);
  const hookY      = 300;
  const topicY     = hookY + hookLines.length * 82 + 90;

  const hookSVG = hookLines.map((l, i) =>
    `<text x="540" y="${hookY + i * 82}" font-family="Georgia,'Times New Roman',serif" font-size="68" font-weight="bold" fill="#FFFFFF" text-anchor="middle">${esc(l)}</text>`
  ).join("\n  ");

  const topicSVG = topicLines.map((l, i) =>
    `<text x="540" y="${topicY + i * 58}" font-family="Arial,Helvetica,sans-serif" font-size="42" fill="#FFD700" text-anchor="middle">${esc(l)}</text>`
  ).join("\n  ");

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1080" height="1080" xmlns="http://www.w3.org/2000/svg">
<defs>
  <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="#110200"/>
    <stop offset="40%" stop-color="#2a0700"/>
    <stop offset="100%" stop-color="#040404"/>
  </linearGradient>
  <linearGradient id="fade" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0%" stop-color="#FF6B00" stop-opacity="0"/>
    <stop offset="25%" stop-color="#FF6B00"/>
    <stop offset="75%" stop-color="#FF6B00"/>
    <stop offset="100%" stop-color="#FF6B00" stop-opacity="0"/>
  </linearGradient>
  <linearGradient id="gold" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0%" stop-color="#FFD700" stop-opacity="0"/>
    <stop offset="25%" stop-color="#FFD700"/>
    <stop offset="75%" stop-color="#FFD700"/>
    <stop offset="100%" stop-color="#FFD700" stop-opacity="0"/>
  </linearGradient>
  <radialGradient id="glow" cx="50%" cy="40%" r="55%">
    <stop offset="0%" stop-color="#CC3300" stop-opacity="0.25"/>
    <stop offset="100%" stop-color="#CC3300" stop-opacity="0"/>
  </radialGradient>
</defs>
<rect width="1080" height="1080" fill="url(#bg)"/>
<rect width="1080" height="1080" fill="url(#glow)"/>
<rect x="12" y="12" width="1056" height="1056" fill="none" stroke="#FF6B00" stroke-width="3"/>
<rect x="20" y="20" width="1040" height="1040" fill="none" stroke="#FF6B00" stroke-width="1" stroke-dasharray="12,7" opacity="0.5"/>
<polyline points="12,80 12,12 80,12"    fill="none" stroke="#FFD700" stroke-width="6"/>
<polyline points="1000,12 1068,12 1068,80"  fill="none" stroke="#FFD700" stroke-width="6"/>
<polyline points="12,1000 12,1068 80,1068"  fill="none" stroke="#FFD700" stroke-width="6"/>
<polyline points="1000,1068 1068,1068 1068,1000" fill="none" stroke="#FFD700" stroke-width="6"/>
<rect x="12" y="12" width="1056" height="108" fill="#FF6B00" fill-opacity="0.18"/>
<text x="540" y="78" font-family="Arial,Helvetica,sans-serif" font-size="32" font-weight="bold" fill="#FF6B00" text-anchor="middle" letter-spacing="5">TAMILNADU UNFILTERED</text>
<rect x="60" y="122" width="960" height="2.5" fill="url(#fade)"/>
<circle cx="60" cy="123" r="5" fill="#FF6B00"/>
<circle cx="1020" cy="123" r="5" fill="#FF6B00"/>
${hookSVG}
<rect x="160" y="${topicY - 48}" width="760" height="2" fill="url(#gold)"/>
${topicSVG}
<rect x="60" y="942" width="960" height="2.5" fill="url(#fade)"/>
<circle cx="60" cy="943" r="5" fill="#FF6B00"/>
<circle cx="1020" cy="943" r="5" fill="#FF6B00"/>
<rect x="12" y="952" width="1056" height="116" fill="#FF6B00" fill-opacity="0.10"/>
<text x="540" y="994" font-family="Arial,Helvetica,sans-serif" font-size="24" fill="#FF6B00" text-anchor="middle">#TamilHistory #TamilCulture #TamilNadu #TamilPride</text>
<text x="540" y="1042" font-family="Arial,Helvetica,sans-serif" font-size="20" fill="#888" text-anchor="middle">Follow for daily Tamil heritage stories</text>
</svg>`;

  try {
    const { Resvg } = require("@resvg/resvg-js");
    const pngData = new Resvg(svg, { fitTo: { mode: "width", value: 1080 } }).render().asPng();
    const fp = path.join(ensureDir(), `${filename}_canvas.png`);
    fs.writeFileSync(fp, pngData);
    console.log(`   ✅ SVG canvas OK (${pngData.length} bytes)`);
    return fp;
  } catch (e) {
    const fp = path.join(ensureDir(), `${filename}_canvas.svg`);
    fs.writeFileSync(fp, svg);
    return fp;
  }
}

// ── MASTER PIPELINE — 12 layers, never fails ──────────────────────────────────
async function smartGenerateImage(imagePrompt, filename, { topic = "", hook = "" } = {}) {
  const p = imagePrompt || topic;

  const r1 = await tryHuggingFace(p, filename);
  if (r1) return r1;

  const r2 = await tryTogetherAI(p, filename + "_tog");
  if (r2) return r2;

  const r3 = await tryStabilityAI(p, filename + "_stab");
  if (r3) return r3;

  const r4 = await tryDeepAI(p, filename + "_dap");
  if (r4) return r4;

  const r5 = await tryProdia(p, filename + "_pro");
  if (r5) return r5;

  const r6b = await tryReplicate(p, filename + "_rep");
  if (r6b) return r6b;

  const r6c = await tryFalAI(p, filename + "_fal");
  if (r6c) return r6c;

  const r6d = await tryPexels(topic || p, filename + "_pex");
  if (r6d) return r6d;

  const r6e = await tryPixabay(topic || p, filename + "_pix");
  if (r6e) return r6e;

  const r6 = await tryPollinations(p, filename + "_pol1", null, "6f");
  if (r6) return r6;

  const r7 = await tryPollinations(p, filename + "_pol2", "flux", "6g");
  if (r7) return r7;

  const r8 = await tryPollinations(p, filename + "_pol3", "turbo", "6h");
  if (r8) return r8;

  const r9 = await tryLexica(p, topic, filename + "_lex");
  if (r9) return r9;

  const r10 = await tryUnsplash(topic || p, filename + "_uns");
  if (r10) return r10;

  const r11 = await tryLoremFlickr(topic || p, filename + "_flk");
  if (r11) return r11;

  // Layer 12 — GUARANTEED
  return generateSVGImage(topic || p, hook || p, filename);
}

function cleanupImage(filePath) {
  try {
    if (filePath && !filePath.startsWith("http") && fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch {}
}

module.exports = { smartGenerateImage, cleanupImage };
