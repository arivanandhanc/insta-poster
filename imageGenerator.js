require("./dns-fix"); // ensure DoH fallback is active
const axios = require("axios");
const fs = require("fs");
const path = require("path");

// HF retired api-inference.huggingface.co — new endpoint is router.huggingface.co
const HF_API_URL = "https://router.huggingface.co/hf-inference/models/black-forest-labs/FLUX.1-schnell";

function ensureDir() {
  const dir = path.join(__dirname, "temp_images");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

async function generateImage(imagePrompt, filename) {
  console.log(`🎨 HuggingFace FLUX: ${filename}`);
  // Short prompt — FLUX works best with concise prompts
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
      await new Promise((r) => setTimeout(r, 20000));
      return generateImage(imagePrompt, filename + "_r");
    }
    if (err.response?.status === 429) {
      console.log("   ⚠️ HF rate limited, retrying in 60s...");
      await new Promise((r) => setTimeout(r, 60000));
      return generateImage(imagePrompt, filename + "_r");
    }
    const detail = err.response?.data ? Buffer.from(err.response.data).toString().slice(0, 120) : "";
    console.log(`   ⚠️ HF unavailable (${err.response?.status || err.code}): ${detail || err.message}`);
    return null;
  }
}

async function generateImagePollinations(imagePrompt, filename, model = "flux-schnell", retries = 6) {
  console.log(`🎨 Pollinations (${model}): ${filename}`);
  const shortPrompt = `Tamil Nadu, South India, ${imagePrompt.slice(0, 100)}, photorealistic, cinematic, vibrant`;
  const encodedPrompt = encodeURIComponent(shortPrompt);
  const url = `https://image.pollinations.ai/prompt/${encodedPrompt}?model=${model}&width=1024&height=1024&nologo=true&nofeed=true`;

  for (let i = 0; i < retries; i++) {
    try {
      const response = await axios.get(url, {
        responseType: "arraybuffer",
        timeout: 90000,
        headers: { "User-Agent": "TamilNaduUnfiltered/1.0" },
      });

      const contentType = response.headers["content-type"] || "";
      if (!contentType.includes("image")) {
        throw new Error(`Expected image, got: ${contentType}`);
      }

      const filePath = path.join(ensureDir(), `${filename}.png`);
      fs.writeFileSync(filePath, response.data);
      console.log(`   ✅ Pollinations image saved (${response.data.length} bytes)`);
      return filePath;
    } catch (err) {
      const isRetryable = err.response?.status === 402 || err.code === "ENOTFOUND";
      if (isRetryable && i < retries - 1) {
        const wait = (i + 1) * 6000;
        console.log(`   ⏳ Pollinations retry ${i + 1}/${retries} in ${wait / 1000}s (${err.response?.status || err.code})`);
        await new Promise((r) => setTimeout(r, wait));
        continue;
      }
      console.error(`   ❌ Pollinations ${model} failed: ${err.message}`);
      return null;
    }
  }
  return null;
}

// HF FLUX → Pollinations flux-schnell → Pollinations turbo
async function smartGenerateImage(imagePrompt, filename) {
  if (process.env.HF_API_KEY && process.env.HF_API_KEY !== "your_hf_key_here") {
    const r = await generateImage(imagePrompt, filename);
    if (r) return r;
  }

  const r1 = await generateImagePollinations(imagePrompt, filename, "flux-schnell");
  if (r1) return r1;

  return generateImagePollinations(imagePrompt, filename + "_t", "turbo");
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
