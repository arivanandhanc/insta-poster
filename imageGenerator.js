const axios = require("axios");
const fs = require("fs");
const path = require("path");

const HF_API_URL = "https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-xl-base-1.0";

const STYLE_PREFIX = "Tamil Nadu culture, South India, photorealistic, dramatic golden hour lighting, rich colors, high detail, 4k quality, cinematic composition,";
const STYLE_SUFFIX = "professional photography, Instagram worthy, vibrant colors, sharp focus";
const NEGATIVE_PROMPT = "blurry, low quality, cartoon, anime, western style, ugly, distorted, text, watermark, nsfw";

function ensureDir() {
  const dir = path.join(__dirname, "temp_images");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

async function generateImage(imagePrompt, filename) {
  console.log(`🎨 HuggingFace: ${filename}`);
  const fullPrompt = `${STYLE_PREFIX} ${imagePrompt}, ${STYLE_SUFFIX}`;

  try {
    const response = await axios.post(
      HF_API_URL,
      {
        inputs: fullPrompt,
        parameters: {
          negative_prompt: NEGATIVE_PROMPT,
          num_inference_steps: 30,
          guidance_scale: 7.5,
          width: 1024,
          height: 1024,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.HF_API_KEY}`,
          "Content-Type": "application/json",
          Accept: "image/png",
        },
        responseType: "arraybuffer",
        timeout: 120000,
      }
    );

    const filePath = path.join(ensureDir(), `${filename}.png`);
    fs.writeFileSync(filePath, response.data);
    console.log(`   ✅ HF image saved: ${filePath}`);
    return filePath;
  } catch (err) {
    if (err.response?.status === 503) {
      console.log("   ⏳ HF model loading, waiting 20s...");
      await new Promise((r) => setTimeout(r, 20000));
      return generateImage(imagePrompt, filename + "_r");
    }
    if (err.response?.status === 429) {
      console.log("   ⚠️ HF rate limited, waiting 60s...");
      await new Promise((r) => setTimeout(r, 60000));
      return generateImage(imagePrompt, filename + "_r");
    }
    // ENOTFOUND or other network error — skip to fallback silently
    console.log(`   ⚠️ HF unavailable (${err.code || err.response?.status}), trying fallback`);
    return null;
  }
}

// ─── FALLBACK: Pollinations.ai flux-schnell (free, fast) ────────────────────
async function generateImagePollinations(imagePrompt, filename, model = "flux-schnell") {
  console.log(`🎨 Pollinations (${model}): ${filename}`);

  const encodedPrompt = encodeURIComponent(`${STYLE_PREFIX} ${imagePrompt}, ${STYLE_SUFFIX}`);
  const url = `https://image.pollinations.ai/prompt/${encodedPrompt}?model=${model}&width=1024&height=1024&nologo=true&nofeed=true`;

  try {
    const response = await axios.get(url, {
      responseType: "arraybuffer",
      timeout: 90000,
      headers: { "User-Agent": "TamilNaduUnfiltered/1.0" },
    });

    // Verify we got an actual image (not an error HTML page)
    const contentType = response.headers["content-type"] || "";
    if (!contentType.includes("image")) {
      throw new Error(`Expected image, got: ${contentType}`);
    }

    const filePath = path.join(ensureDir(), `${filename}.png`);
    fs.writeFileSync(filePath, response.data);
    console.log(`   ✅ Pollinations image saved: ${filePath}`);
    return filePath;
  } catch (err) {
    console.error(`   ❌ Pollinations ${model} failed: ${err.message}`);
    return null;
  }
}

// ─── SMART: HF → Pollinations flux-schnell → Pollinations turbo ──────────────
async function smartGenerateImage(imagePrompt, filename) {
  // 1. Try HuggingFace (best quality, needs API key)
  if (process.env.HF_API_KEY && process.env.HF_API_KEY !== "your_hf_key_here") {
    const result = await generateImage(imagePrompt, filename);
    if (result) return result;
  }

  // 2. Pollinations flux-schnell (free, fast)
  const r1 = await generateImagePollinations(imagePrompt, filename, "flux-schnell");
  if (r1) return r1;

  // 3. Pollinations turbo (last resort)
  const r2 = await generateImagePollinations(imagePrompt, filename + "_t", "turbo");
  return r2;
}

function cleanupImage(filePath) {
  try {
    if (filePath && !filePath.startsWith("http") && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`   🗑️  Cleaned up: ${filePath}`);
    }
  } catch (err) {
    console.error(`   ⚠️  Cleanup failed: ${err.message}`);
  }
}

module.exports = { smartGenerateImage, cleanupImage };
