require("./dns-fix");
const axios = require("axios");
const fs    = require("fs");
const path  = require("path");

const HF_URL = "https://router.huggingface.co/hf-inference/models/black-forest-labs/FLUX.1-schnell";
const wait   = (ms) => new Promise((r) => setTimeout(r, ms));
const UA     = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

const BRAND  = (process.env.BRAND_NAME || "TAMILNADU UNFILTERED").toUpperCase();
const HANDLE = process.env.IG_USERNAME ? `@${process.env.IG_USERNAME}` : "";

function ensureDir() {
  const dir = path.join(__dirname, "temp_images");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// Providers that hit a hard quota/credit/auth wall are disabled for the rest of
// the process so we don't waste seconds retrying them on every post (24×/day).
const _disabled = new Set();
function disableProvider(name, reason) {
  if (!_disabled.has(name)) {
    _disabled.add(name);
    console.log(`   ⏭️  Disabling ${name} for this run (${reason})`);
  }
}
function isDepletionError(status, body = "") {
  return status === 402 || status === 401 ||
    /deplet|quota|credit|exceeded|insufficient|limit reached|payment required/i.test(String(body));
}

// ── Anti-repeat: remember the last N image identifiers so posts stay fresh ─────
const HISTORY_FILE = path.join(__dirname, "image_history.json");
const HISTORY_MAX  = 200;
function loadImgHistory() {
  try { return JSON.parse(fs.readFileSync(HISTORY_FILE, "utf8")); } catch { return []; }
}
function isUsedImage(id) {
  if (!id) return false;
  return loadImgHistory().includes(id);
}
function recordImage(id) {
  if (!id) return;
  let h = loadImgHistory();
  if (h.includes(id)) return;
  h.unshift(id);
  h = h.slice(0, HISTORY_MAX);
  try { fs.writeFileSync(HISTORY_FILE, JSON.stringify(h)); } catch {}
}
// Pick a fresh (not-recently-used) item from a list; falls back to any if all used.
function pickFresh(items, idOf) {
  const fresh = items.filter((it) => !isUsedImage(idOf(it)));
  const pool = fresh.length ? fresh : items;
  return pool[Math.floor(Math.random() * pool.length)];
}

// ── Category → accent colour theme (for overlay + SVG fallback) ───────────────
function categoryTheme(category = "", topic = "") {
  const t = (category + " " + topic).toLowerCase();
  if (t.match(/temple|kovil|gopuram|spiritual|god|deity/))   return { accent: "#FFD54A", glow: "#7a5a00", tag: "#TamilTemples" };
  if (t.match(/food|cuisine|dosa|idli|biryani|samayal/))     return { accent: "#FF7043", glow: "#7a2a00", tag: "#TamilFood" };
  if (t.match(/festival|pongal|deepavali|karthigai|celebr/)) return { accent: "#FF4D8D", glow: "#7a0030", tag: "#TamilFestivals" };
  if (t.match(/war|battle|king|emperor|chola|pandya|chera|history|warrior/)) return { accent: "#FFB300", glow: "#5a3a00", tag: "#TamilHistory" };
  if (t.match(/dance|music|bharatanatyam|carnatic|art/))     return { accent: "#26C6DA", glow: "#004a52", tag: "#TamilArt" };
  if (t.match(/literature|poem|sangam|thirukkural|language/))return { accent: "#AB7CFF", glow: "#2e1a52", tag: "#TamilLiterature" };
  if (t.match(/nature|river|sea|coast|hill|forest|village/)) return { accent: "#66BB6A", glow: "#1a4a1c", tag: "#TamilNadu" };
  return { accent: "#FF6B00", glow: "#5a2600", tag: "#TamilPride" };
}

// ── Topic → concrete searchable photo queries (ordered, most → least specific) ─
function topicToQueries(topic = "", category = "") {
  const t = (topic + " " + category).toLowerCase();
  // Pull notable capitalised proper nouns straight from the topic
  const proper = (topic.match(/\b[A-Z][a-zA-Z]{3,}\b/g) || [])
    .filter((w) => !["The", "Tamil", "Nadu", "This", "When", "What", "Why", "How", "Their", "These"].includes(w))
    .slice(0, 3).join(" ");

  // subject = a noun that keeps a proper-noun query on-theme (so "Chettinad" → "Chettinad cuisine")
  let subject, base;
  if (t.match(/temple|kovil|gopuram|pallava|dravidian|shrine/))         { subject = "temple";  base = ["Tamil Nadu temple gopuram", "Dravidian temple architecture", "Meenakshi Amman Temple"]; }
  else if (t.match(/food|cuisine|dosa|idli|biryani|samayal|sappadu|dish|recipe/)) { subject = "cuisine"; base = ["South Indian food banana leaf", "Tamil Nadu cuisine thali", "dosa idli sambar"]; }
  else if (t.match(/festival|pongal|deepavali|karthigai|jallikattu|celebration/)) { subject = "festival"; base = ["Pongal festival Tamil Nadu", "Tamil Nadu festival kolam", "Jallikattu"]; }
  else if (t.match(/war|battle|king|emperor|chola|pandya|chera|warrior|army|navy|dynasty/)) { subject = "sculpture"; base = ["Chola bronze sculpture", "Brihadeeswarar Temple Thanjavur", "ancient Tamil history"]; }
  else if (t.match(/dance|music|bharatanatyam|carnatic|instrument/))    { subject = "dance";   base = ["Bharatanatyam dancer", "Carnatic music Tamil Nadu", "Tamil classical dance"]; }
  else if (t.match(/literature|poem|sangam|thirukkural|language|script|poet/)) { subject = "manuscript"; base = ["Tamil script palm leaf manuscript", "Thiruvalluvar statue", "ancient Tamil inscription"]; }
  else if (t.match(/river|lake|sea|ocean|coast|beach|kanyakumari/))     { subject = "coast";   base = ["Kanyakumari coast", "Marina Beach Chennai", "Cauvery river Tamil Nadu"]; }
  else if (t.match(/hill|mountain|ooty|kodaikanal|western ghats|tea/))  { subject = "hills";   base = ["Ooty hills Tamil Nadu", "Western Ghats tea estate", "Kodaikanal landscape"]; }
  else if (t.match(/village|agriculture|farmer|rural|paddy/))           { subject = "village"; base = ["Tamil Nadu village paddy field", "rural Tamil Nadu farmer", "South India countryside"]; }
  else if (t.match(/science|innovation|technology|astronomy|math/))     { subject = "heritage"; base = ["ancient Indian astronomy", "Tamil Nadu heritage", "Indian observatory"]; }
  else if (t.match(/saree|silk|kanchipuram|textile|craft|painting/))    { subject = "saree";   base = ["Kanchipuram silk saree", "Tamil Nadu handicraft", "Tanjore painting"]; }
  else { subject = "heritage"; base = ["Tamil Nadu heritage", "Tamil Nadu culture", "South India temple"]; }

  const queries = [];
  if (proper) {
    const properQ = proper.toLowerCase().includes(subject) ? `${proper} Tamil Nadu` : `${proper} ${subject} Tamil Nadu`;
    queries.push(properQ);
  }
  queries.push(...base);
  return [...new Set(queries)];
}

// ── Download a remote image to a temp file ────────────────────────────────────
async function download(url, filename, ext = "jpg") {
  const img = await axios.get(url, { responseType: "arraybuffer", timeout: 30000, headers: { "User-Agent": UA } });
  if (!(img.headers["content-type"] || "").includes("image")) throw new Error("not an image");
  if (img.data.length < 4000) throw new Error("image too small");
  const fp = path.join(ensureDir(), `${filename}.${ext}`);
  fs.writeFileSync(fp, img.data);
  return fp;
}

// ════════════════════════════════════════════════════════════════════════════
//  BRANDED PROMO COMPOSITE  — turns a raw photo into a designed 1080×1080 post
// ════════════════════════════════════════════════════════════════════════════
function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function wrapText(text, max) {
  const words = String(text).trim().split(/\s+/);
  const lines = []; let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length <= max) cur = (cur + " " + w).trim();
    else { if (cur) lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  return lines;
}

function buildOverlaySVG({ hook = "", category = "", topic = "" }) {
  const { accent, tag } = categoryTheme(category, topic);
  const headline = (hook || topic || "Tamil Heritage").trim();
  // Larger font for short hooks, smaller for long ones
  const fontSize = headline.length <= 22 ? 84 : headline.length <= 40 ? 68 : 56;
  const maxChars = headline.length <= 22 ? 16 : headline.length <= 40 ? 22 : 28;
  const lines = wrapText(headline, maxChars).slice(0, 3);
  const lineH = fontSize + 12;
  const blockH = lines.length * lineH;
  const baseY = 1080 - 170 - blockH + fontSize; // sit above the footer

  const headlineSVG = lines.map((l, i) =>
    `<text x="64" y="${baseY + i * lineH}" font-family="Georgia,'Times New Roman',serif" font-size="${fontSize}" font-weight="bold" fill="#FFFFFF" stroke="#000000" stroke-width="1" paint-order="stroke">${esc(l)}</text>`
  ).join("\n  ");

  const followCTA = HANDLE ? `Follow ${esc(HANDLE)} for daily Tamil stories` : "Follow for daily Tamil heritage stories";

  return `<svg width="1080" height="1080" xmlns="http://www.w3.org/2000/svg">
<defs>
  <linearGradient id="botFade" x1="0" y1="0" x2="0" y2="1">
    <stop offset="48%" stop-color="#000000" stop-opacity="0"/>
    <stop offset="78%" stop-color="#000000" stop-opacity="0.55"/>
    <stop offset="100%" stop-color="#000000" stop-opacity="0.92"/>
  </linearGradient>
  <linearGradient id="topFade" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="#000000" stop-opacity="0.75"/>
    <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
  </linearGradient>
</defs>
<rect x="0" y="0" width="1080" height="170" fill="url(#topFade)"/>
<rect x="0" y="430" width="1080" height="650" fill="url(#botFade)"/>
<rect x="14" y="14" width="1052" height="1052" fill="none" stroke="${accent}" stroke-width="3" opacity="0.85"/>
<text x="64" y="80" font-family="Arial,Helvetica,sans-serif" font-size="30" font-weight="bold" fill="${accent}" letter-spacing="4">${esc(BRAND)}</text>
<rect x="64" y="${baseY - fontSize - 26}" width="120" height="7" fill="${accent}"/>
${headlineSVG}
<text x="64" y="1024" font-family="Arial,Helvetica,sans-serif" font-size="26" fill="${accent}">${esc(tag)} #TamilNadu #TamilCulture</text>
<text x="64" y="1058" font-family="Arial,Helvetica,sans-serif" font-size="22" fill="#dddddd">${followCTA}</text>
</svg>`;
}

// Convert any raw photo → branded square promo post (sharp required)
async function compositePromo(rawPath, { hook, category, topic, filename }) {
  const sharp = require("sharp");
  const overlay = Buffer.from(buildOverlaySVG({ hook, category, topic }));
  const base = await sharp(rawPath)
    .resize(1080, 1080, { fit: "cover", position: "attention" })
    .modulate({ saturation: 1.08 })
    .toBuffer();
  const fp = path.join(ensureDir(), `${filename}_promo.jpg`);
  await sharp(base).composite([{ input: overlay, top: 0, left: 0 }]).jpeg({ quality: 88 }).toFile(fp);
  // remove the raw intermediate
  try { if (rawPath !== fp && fs.existsSync(rawPath)) fs.unlinkSync(rawPath); } catch {}
  return fp;
}

// ════════════════════════════════════════════════════════════════════════════
//  AI ART PROVIDERS  (return finished artwork — used directly, no compositing)
// ════════════════════════════════════════════════════════════════════════════

async function tryHuggingFace(prompt, filename) {
  if (!process.env.HF_API_KEY || _disabled.has("HuggingFace")) return null;
  console.log(`🎨 [AI] HuggingFace FLUX`);
  try {
    const r = await axios({
      url: HF_URL, method: "post",
      data: { inputs: `Tamil Nadu, ${prompt.slice(0, 100)}, photorealistic, cinematic, golden hour` },
      headers: { Authorization: `Bearer ${process.env.HF_API_KEY}`, "Content-Type": "application/json", Accept: "image/jpeg" },
      responseType: "arraybuffer", timeout: 90000,
    });
    if (r.data.length < 5000) throw new Error("Response too small");
    const fp = path.join(ensureDir(), `${filename}.jpg`);
    fs.writeFileSync(fp, r.data);
    console.log(`   ✅ HuggingFace OK (${r.data.length} bytes)`);
    return fp;
  } catch (e) {
    const s = Buffer.from(e.response?.data || []).toString().slice(0, 70);
    console.log(`   ⚠️  HF (${e.response?.status}): ${s || e.message}`);
    if (isDepletionError(e.response?.status, s)) disableProvider("HuggingFace", "credits depleted");
    return null;
  }
}

async function tryTogetherAI(prompt, filename) {
  if (!process.env.TOGETHER_API_KEY || _disabled.has("TogetherAI")) return null;
  console.log(`🎨 [AI] Together AI FLUX`);
  try {
    const r = await axios.post(
      "https://api.together.xyz/v1/images/generations",
      { model: "black-forest-labs/FLUX.1-schnell-Free", prompt: `Tamil Nadu, ${prompt.slice(0, 150)}, photorealistic, cinematic`, width: 1024, height: 1024, steps: 4, n: 1 },
      { headers: { Authorization: `Bearer ${process.env.TOGETHER_API_KEY}` }, timeout: 90000 }
    );
    const url = r.data?.data?.[0]?.url;
    if (!url) throw new Error("No URL");
    const fp = await download(url, filename);
    console.log(`   ✅ Together AI OK`);
    return fp;
  } catch (e) {
    const msg = e.response?.data?.error?.message || e.message;
    console.log(`   ⚠️  Together AI: ${msg}`);
    if (isDepletionError(e.response?.status, msg)) disableProvider("TogetherAI", "quota/credits");
    return null;
  }
}

async function tryStabilityAI(prompt, filename) {
  if (!process.env.STABILITY_API_KEY || _disabled.has("StabilityAI")) return null;
  console.log(`🎨 [AI] Stability AI`);
  try {
    const FormData = require("form-data");
    const fd = new FormData();
    fd.append("prompt", `Tamil Nadu, ${prompt.slice(0, 150)}, photorealistic, cinematic`);
    fd.append("output_format", "jpeg");
    const r = await axios.post(
      "https://api.stability.ai/v2beta/stable-image/generate/core", fd,
      { headers: { ...fd.getHeaders(), Authorization: `Bearer ${process.env.STABILITY_API_KEY}`, Accept: "image/*" }, responseType: "arraybuffer", timeout: 60000 }
    );
    const fp = path.join(ensureDir(), `${filename}.jpg`);
    fs.writeFileSync(fp, r.data);
    console.log(`   ✅ Stability AI OK`);
    return fp;
  } catch (e) {
    console.log(`   ⚠️  Stability AI: ${e.response?.status || e.message}`);
    if (isDepletionError(e.response?.status)) disableProvider("StabilityAI", "quota/credits");
    return null;
  }
}

async function tryFalAI(prompt, filename) {
  if (!process.env.FAL_KEY || _disabled.has("FalAI")) return null;
  console.log(`🎨 [AI] Fal.ai FLUX`);
  try {
    const r = await axios.post(
      "https://fal.run/fal-ai/flux/schnell",
      { prompt: `Tamil Nadu, South India, ${prompt.slice(0, 150)}, photorealistic, cinematic`, image_size: "square_hd", num_images: 1, num_inference_steps: 4 },
      { headers: { Authorization: `Key ${process.env.FAL_KEY}`, "Content-Type": "application/json" }, timeout: 60000 }
    );
    const imgUrl = r.data?.images?.[0]?.url;
    if (!imgUrl) throw new Error("No image URL");
    const fp = await download(imgUrl, filename);
    console.log(`   ✅ Fal.ai OK`);
    return fp;
  } catch (e) {
    const msg = e.response?.data?.detail || e.message;
    console.log(`   ⚠️  Fal.ai: ${msg}`);
    if (isDepletionError(e.response?.status, msg)) disableProvider("FalAI", "quota/credits");
    return null;
  }
}

// ════════════════════════════════════════════════════════════════════════════
//  PHOTO PROVIDERS  (return a RAW photo path → composited into a branded post)
// ════════════════════════════════════════════════════════════════════════════

// Wikimedia Commons — FREE, no key, real on-topic Tamil Nadu photos
async function tryWikimedia(topic, category, filename) {
  console.log(`📷 [Photo] Wikimedia Commons`);
  const queries = topicToQueries(topic, category);
  for (const q of queries) {
    try {
      const r = await axios.get("https://commons.wikimedia.org/w/api.php", {
        params: {
          action: "query", format: "json", generator: "search",
          gsrsearch: q, gsrnamespace: 6, gsrlimit: 20,
          gsroffset: Math.floor(Math.random() * 10), // vary results for freshness
          prop: "imageinfo", iiprop: "url|mime|size", iiurlwidth: 1200,
        },
        timeout: 18000, headers: { "User-Agent": "TamilAutoBot/2.0 (Instagram heritage education)" },
      });
      const pages = Object.values(r.data?.query?.pages || {});
      const imgs = pages
        .map((p) => p.imageinfo?.[0])
        .filter((i) => i && /jpe?g|png/i.test(i.mime || "") && (i.thumbwidth || i.width || 0) >= 800);
      if (!imgs.length) continue;
      const pick = pickFresh(imgs, (i) => i.url);          // skip recently-used
      const fp = await download(pick.thumburl || pick.url, filename);
      recordImage(pick.url);
      console.log(`   ✅ Wikimedia OK ("${q}")`);
      return fp;
    } catch (e) {
      // try next query
    }
  }
  console.log(`   ⚠️  Wikimedia: no usable results`);
  return null;
}

// Openverse — FREE, no key, CC-licensed photos
async function tryOpenverse(topic, category, filename) {
  console.log(`📷 [Photo] Openverse`);
  const queries = topicToQueries(topic, category);
  for (const q of queries) {
    try {
      const r = await axios.get("https://api.openverse.org/v1/images/", {
        params: { q, page_size: 12, mature: false, license_type: "all" },
        timeout: 18000, headers: { "User-Agent": "TamilAutoBot/2.0" },
      });
      const results = (r.data?.results || []).filter((i) => i.url && (i.width || 0) >= 800);
      if (!results.length) continue;
      // prefer not-recently-used, shuffle, then try downloads until one succeeds (some Flickr CDNs rate-limit)
      const freshFirst = results.slice(0, 12).sort(() => Math.random() - 0.5)
        .sort((a, b) => (isUsedImage(a.url) ? 1 : 0) - (isUsedImage(b.url) ? 1 : 0));
      for (const item of freshFirst) {
        try {
          const fp = await download(item.url, filename);
          recordImage(item.url);
          console.log(`   ✅ Openverse OK ("${q}")`);
          return fp;
        } catch { /* next item */ }
      }
    } catch (e) {
      // try next query
    }
  }
  console.log(`   ⚠️  Openverse: no usable results`);
  return null;
}

// Pexels — high-quality stock (free API key, optional)
async function tryPexels(topic, category, filename) {
  if (!process.env.PEXELS_API_KEY) return null;
  console.log(`📷 [Photo] Pexels`);
  try {
    const q = topicToQueries(topic, category)[0];
    const r = await axios.get("https://api.pexels.com/v1/search", {
      params: { query: q, per_page: 15, orientation: "square" },
      headers: { Authorization: process.env.PEXELS_API_KEY }, timeout: 15000,
    });
    const photos = r.data?.photos;
    if (!photos?.length) throw new Error("No results");
    const pick = photos[Math.floor(Math.random() * Math.min(8, photos.length))];
    const fp = await download(pick.src?.large2x || pick.src?.large, filename);
    console.log(`   ✅ Pexels OK`);
    return fp;
  } catch (e) {
    console.log(`   ⚠️  Pexels: ${e.message}`);
    return null;
  }
}

// Pixabay — free images (free API key, optional)
async function tryPixabay(topic, category, filename) {
  if (!process.env.PIXABAY_API_KEY) return null;
  console.log(`📷 [Photo] Pixabay`);
  try {
    const q = topicToQueries(topic, category)[0];
    const r = await axios.get("https://pixabay.com/api/", {
      params: { key: process.env.PIXABAY_API_KEY, q, image_type: "photo", min_width: 1000, per_page: 20 },
      timeout: 15000,
    });
    const hits = r.data?.hits;
    if (!hits?.length) throw new Error("No results");
    const pick = hits[Math.floor(Math.random() * Math.min(8, hits.length))];
    const fp = await download(pick.largeImageURL, filename);
    console.log(`   ✅ Pixabay OK`);
    return fp;
  } catch (e) {
    console.log(`   ⚠️  Pixabay: ${e.message}`);
    return null;
  }
}

// ════════════════════════════════════════════════════════════════════════════
//  GUARANTEED LOCAL FALLBACK  — designed SVG card (no internet, never fails)
// ════════════════════════════════════════════════════════════════════════════
function generateSVGImage(topic, hook, category, filename) {
  console.log(`🎨 [Local] SVG Canvas (guaranteed)`);
  const { accent, glow, tag } = categoryTheme(category, topic);

  const hookLines  = wrapText(hook || topic, 18).slice(0, 4);
  const topicLines = wrapText(topic || hook, 32).slice(0, 3);
  const hookY      = 340;
  const topicY     = hookY + hookLines.length * 84 + 80;

  const hookSVG = hookLines.map((l, i) =>
    `<text x="540" y="${hookY + i * 84}" font-family="Georgia,'Times New Roman',serif" font-size="70" font-weight="bold" fill="#FFFFFF" text-anchor="middle">${esc(l)}</text>`
  ).join("\n  ");
  const topicSVG = topicLines.map((l, i) =>
    `<text x="540" y="${topicY + i * 56}" font-family="Arial,Helvetica,sans-serif" font-size="40" fill="${accent}" text-anchor="middle">${esc(l)}</text>`
  ).join("\n  ");

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1080" height="1080" xmlns="http://www.w3.org/2000/svg">
<defs>
  <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0%" stop-color="#120300"/>
    <stop offset="45%" stop-color="#240800"/>
    <stop offset="100%" stop-color="#050505"/>
  </linearGradient>
  <radialGradient id="glow" cx="50%" cy="38%" r="60%">
    <stop offset="0%" stop-color="${glow}" stop-opacity="0.55"/>
    <stop offset="100%" stop-color="${glow}" stop-opacity="0"/>
  </radialGradient>
  <linearGradient id="line" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0%" stop-color="${accent}" stop-opacity="0"/>
    <stop offset="50%" stop-color="${accent}"/>
    <stop offset="100%" stop-color="${accent}" stop-opacity="0"/>
  </linearGradient>
</defs>
<rect width="1080" height="1080" fill="url(#bg)"/>
<rect width="1080" height="1080" fill="url(#glow)"/>
<rect x="14" y="14" width="1052" height="1052" fill="none" stroke="${accent}" stroke-width="3"/>
<rect x="22" y="22" width="1036" height="1036" fill="none" stroke="${accent}" stroke-width="1" stroke-dasharray="12,7" opacity="0.45"/>
<polyline points="14,84 14,14 84,14"          fill="none" stroke="#FFD700" stroke-width="6"/>
<polyline points="996,14 1066,14 1066,84"      fill="none" stroke="#FFD700" stroke-width="6"/>
<polyline points="14,996 14,1066 84,1066"      fill="none" stroke="#FFD700" stroke-width="6"/>
<polyline points="996,1066 1066,1066 1066,996" fill="none" stroke="#FFD700" stroke-width="6"/>
<text x="540" y="120" font-family="Arial,Helvetica,sans-serif" font-size="34" font-weight="bold" fill="${accent}" text-anchor="middle" letter-spacing="6">${esc(BRAND)}</text>
<rect x="90" y="150" width="900" height="2.5" fill="url(#line)"/>
${hookSVG}
<rect x="290" y="${topicY - 50}" width="500" height="2" fill="url(#line)"/>
${topicSVG}
<rect x="90" y="936" width="900" height="2.5" fill="url(#line)"/>
<text x="540" y="990" font-family="Arial,Helvetica,sans-serif" font-size="26" fill="${accent}" text-anchor="middle">${esc(tag)} #TamilNadu #TamilCulture #TamilPride</text>
<text x="540" y="1034" font-family="Arial,Helvetica,sans-serif" font-size="22" fill="#999" text-anchor="middle">${HANDLE ? "Follow " + esc(HANDLE) + " for daily Tamil heritage" : "Follow for daily Tamil heritage stories"}</text>
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

// ════════════════════════════════════════════════════════════════════════════
//  MASTER PIPELINE
//  1) AI art (if API keys present) → use as-is
//  2) Real free photos (Wikimedia → Openverse → Pexels → Pixabay) → brand it
//  3) Guaranteed designed SVG card
// ════════════════════════════════════════════════════════════════════════════
async function smartGenerateImage(imagePrompt, filename, { topic = "", hook = "", category = "" } = {}) {
  const p = imagePrompt || topic;

  // ── Stage 1: AI art providers (only run if their key is set) ──
  const artProviders = [
    () => tryHuggingFace(p, filename),
    () => tryTogetherAI(p, filename + "_tog"),
    () => tryFalAI(p, filename + "_fal"),
    () => tryStabilityAI(p, filename + "_stab"),
  ];
  for (const provider of artProviders) {
    const art = await provider();
    if (art) return art;
  }

  // ── Stage 2: real free photos → branded composite ──
  const photoProviders = [
    () => tryWikimedia(topic || p, category, filename + "_wiki"),
    () => tryOpenverse(topic || p, category, filename + "_ov"),
    () => tryPexels(topic || p, category, filename + "_pex"),
    () => tryPixabay(topic || p, category, filename + "_pix"),
  ];
  for (const provider of photoProviders) {
    const raw = await provider();
    if (raw) {
      try {
        return await compositePromo(raw, { hook, category, topic, filename });
      } catch (e) {
        console.log(`   ⚠️  Compositing failed (${e.message}) — using raw photo`);
        return raw;
      }
    }
  }

  // ── Stage 3: guaranteed local card ──
  return generateSVGImage(topic || p, hook || p, category, filename);
}

function cleanupImage(filePath) {
  try {
    if (filePath && !filePath.startsWith("http") && fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch {}
}

module.exports = { smartGenerateImage, cleanupImage, compositePromo, topicToQueries, categoryTheme, generateSVGImage };
