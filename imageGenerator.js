require("./dns-fix");
const axios = require("axios");
const fs = require("fs");
const path = require("path");

const HF_API_URL = "https://router.huggingface.co/hf-inference/models/black-forest-labs/FLUX.1-schnell";

function ensureDir() {
  const dir = path.join(__dirname, "temp_images");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// ── 1. HuggingFace FLUX ───────────────────────────────────────────────────────
async function generateHF(imagePrompt, filename) {
  console.log(`🎨 HuggingFace FLUX: ${filename}`);
  const prompt = `Tamil Nadu, ${imagePrompt.slice(0, 100)}, photorealistic, cinematic, golden hour, vibrant colors`;
  try {
    const response = await axios({
      url: HF_API_URL,
      method: "post",
      data: { inputs: prompt },
      headers: {
        Authorization: `Bearer ${process.env.HF_API_KEY}`,
        "Content-Type": "application/json",
        Accept: "image/jpeg",
      },
      responseType: "arraybuffer",
      timeout: 120000,
    });
    const filePath = path.join(ensureDir(), `${filename}.jpg`);
    fs.writeFileSync(filePath, response.data);
    console.log(`   ✅ HF image saved (${response.data.length} bytes)`);
    return filePath;
  } catch (err) {
    if (err.response?.status === 503) {
      console.log("   ⏳ HF model loading, retrying in 20s...");
      await wait(20000);
      return generateHF(imagePrompt, filename + "_r");
    }
    const detail = err.response?.data ? Buffer.from(err.response.data).toString().slice(0, 120) : "";
    console.log(`   ⚠️ HF unavailable (${err.response?.status || err.code}): ${detail || err.message}`);
    return null;
  }
}

// ── 2. Pollinations (free, no account needed) ─────────────────────────────────
// Note: nologo/nofeed are premium params — omitting them avoids 402
async function generatePollinations(imagePrompt, filename, model = "flux", retries = 4) {
  console.log(`🎨 Pollinations (${model}): ${filename}`);
  const shortPrompt = `Tamil Nadu South India, ${imagePrompt.slice(0, 120)}, photorealistic, cinematic, vibrant`;
  const seed = Math.floor(Math.random() * 999999);
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(shortPrompt)}?model=${model}&width=1024&height=1024&seed=${seed}`;

  for (let i = 0; i < retries; i++) {
    try {
      const response = await axios.get(url, {
        responseType: "arraybuffer",
        timeout: 90000,
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
      });
      const contentType = response.headers["content-type"] || "";
      if (!contentType.includes("image")) throw new Error(`Expected image, got: ${contentType}`);
      const filePath = path.join(ensureDir(), `${filename}.png`);
      fs.writeFileSync(filePath, response.data);
      console.log(`   ✅ Pollinations ${model} saved (${response.data.length} bytes)`);
      return filePath;
    } catch (err) {
      const status = err.response?.status;
      if ((status === 402 || status === 429 || err.code === "ENOTFOUND") && i < retries - 1) {
        const delay = (i + 1) * 8000;
        console.log(`   ⏳ Pollinations retry ${i + 1}/${retries} in ${delay / 1000}s (${status || err.code})`);
        await wait(delay);
        continue;
      }
      console.error(`   ❌ Pollinations ${model} failed: ${err.message}`);
      return null;
    }
  }
  return null;
}

// ── 3. Together AI — FLUX.1-schnell-Free (free, needs API key) ────────────────
// Sign up free at: together.ai — get API key → add TOGETHER_API_KEY to Render env
async function generateTogetherAI(imagePrompt, filename) {
  if (!process.env.TOGETHER_API_KEY) return null;
  console.log(`🎨 Together AI (FLUX.1-schnell): ${filename}`);
  const prompt = `Tamil Nadu, South India, ${imagePrompt.slice(0, 150)}, photorealistic, cinematic, detailed, vibrant colors`;
  try {
    const r = await axios.post(
      "https://api.together.xyz/v1/images/generations",
      { model: "black-forest-labs/FLUX.1-schnell-Free", prompt, width: 1024, height: 1024, steps: 4, n: 1 },
      {
        headers: { Authorization: `Bearer ${process.env.TOGETHER_API_KEY}`, "Content-Type": "application/json" },
        timeout: 90000,
      }
    );
    const imageUrl = r.data?.data?.[0]?.url;
    if (!imageUrl) throw new Error("No image URL returned");

    // Download the image
    const imgRes = await axios.get(imageUrl, { responseType: "arraybuffer", timeout: 30000 });
    const filePath = path.join(ensureDir(), `${filename}.jpg`);
    fs.writeFileSync(filePath, imgRes.data);
    console.log(`   ✅ Together AI image saved (${imgRes.data.length} bytes)`);
    return filePath;
  } catch (err) {
    console.log(`   ⚠️ Together AI failed: ${err.response?.data?.error || err.message}`);
    return null;
  }
}

// ── 4. Stability AI — free credits on sign-up ─────────────────────────────────
// Sign up at: platform.stability.ai → add STABILITY_API_KEY to Render env
async function generateStabilityAI(imagePrompt, filename) {
  if (!process.env.STABILITY_API_KEY) return null;
  console.log(`🎨 Stability AI (SD Ultra): ${filename}`);
  const prompt = `Tamil Nadu, South India, ${imagePrompt.slice(0, 150)}, photorealistic, cinematic, vibrant, detailed`;
  try {
    const formData = new (require("form-data"))();
    formData.append("prompt", prompt);
    formData.append("output_format", "jpeg");
    const r = await axios.post(
      "https://api.stability.ai/v2beta/stable-image/generate/ultra",
      formData,
      {
        headers: {
          ...formData.getHeaders(),
          Authorization: `Bearer ${process.env.STABILITY_API_KEY}`,
          Accept: "image/*",
        },
        responseType: "arraybuffer",
        timeout: 60000,
      }
    );
    const filePath = path.join(ensureDir(), `${filename}.jpg`);
    fs.writeFileSync(filePath, r.data);
    console.log(`   ✅ Stability AI image saved (${r.data.length} bytes)`);
    return filePath;
  } catch (err) {
    console.log(`   ⚠️ Stability AI failed: ${err.response?.status} ${err.message}`);
    return null;
  }
}

// ── SMART PIPELINE: try all providers in order ───────────────────────────────
async function smartGenerateImage(imagePrompt, filename) {
  // 1. HuggingFace FLUX (free credits monthly)
  if (process.env.HF_API_KEY) {
    const r = await generateHF(imagePrompt, filename);
    if (r) return r;
  }

  // 2. Together AI FLUX (free tier — add TOGETHER_API_KEY)
  const r2 = await generateTogetherAI(imagePrompt, filename + "_tog");
  if (r2) return r2;

  // 3. Stability AI (free credits on sign-up — add STABILITY_API_KEY)
  const r3 = await generateStabilityAI(imagePrompt, filename + "_stab");
  if (r3) return r3;

  // 4. Pollinations flux model (no key needed)
  const r4 = await generatePollinations(imagePrompt, filename + "_p1", "flux");
  if (r4) return r4;

  // 5. Pollinations flux-realism
  const r5 = await generatePollinations(imagePrompt, filename + "_p2", "flux-realism");
  if (r5) return r5;

  // 6. Pollinations turbo (SDXL — most different, highest chance of working)
  const r6 = await generatePollinations(imagePrompt, filename + "_p3", "turbo");
  if (r6) return r6;

  // 7. Pollinations dreamshaper
  const r7 = await generatePollinations(imagePrompt, filename + "_p4", "dreamshaper");
  if (r7) return r7;

  console.error("❌ All image providers failed — check API credits");
  return null;
}

function cleanupImage(filePath) {
  try {
    if (filePath && !filePath.startsWith("http") && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch {}
}

module.exports = { smartGenerateImage, cleanupImage };
