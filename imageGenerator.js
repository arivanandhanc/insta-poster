const axios = require("axios");
const fs = require("fs");
const path = require("path");

const HF_API_URL = "https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-xl-base-1.0";

// ─── TAMIL CULTURE IMAGE STYLE PREFIX ────────────────────────────────────────
// Appended to every prompt for consistent brand aesthetic
const STYLE_PREFIX = "Tamil Nadu culture, South India, photorealistic, dramatic golden hour lighting, rich colors, high detail, 4k quality, cinematic composition,";
const STYLE_SUFFIX = "professional photography, Instagram worthy, vibrant colors, sharp focus";
const NEGATIVE_PROMPT = "blurry, low quality, cartoon, anime, western style, ugly, distorted, text, watermark, nsfw";

async function generateImage(imagePrompt, filename) {
  console.log(`🎨 Generating image: ${filename}`);
  console.log(`   Prompt: ${imagePrompt.slice(0, 80)}...`);

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
        timeout: 120000, // 2 minute timeout — HF can be slow
      }
    );

    // Save to temp directory
    const outputDir = path.join(__dirname, "temp_images");
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

    const filePath = path.join(outputDir, `${filename}.png`);
    fs.writeFileSync(filePath, response.data);

    console.log(`   ✅ Image saved: ${filePath}`);
    return filePath;
  } catch (err) {
    if (err.response?.status === 503) {
      // Model is loading — wait and retry
      console.log("   ⏳ HF model loading, waiting 20s and retrying...");
      await new Promise((r) => setTimeout(r, 20000));
      return generateImage(imagePrompt, filename + "_retry");
    }
    if (err.response?.status === 429) {
      console.log("   ⚠️ HF rate limited, waiting 60s...");
      await new Promise((r) => setTimeout(r, 60000));
      return generateImage(imagePrompt, filename + "_retry");
    }
    console.error(`   ❌ Image generation failed: ${err.message}`);
    // Return fallback placeholder path
    return null;
  }
}

// ─── FALLBACK: Pollinations.ai (no key needed) ────────────────────────────────
async function generateImageFallback(imagePrompt, filename) {
  console.log(`🎨 Using Pollinations fallback for: ${filename}`);

  const encodedPrompt = encodeURIComponent(`${STYLE_PREFIX} ${imagePrompt}, ${STYLE_SUFFIX}`);
  const url = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=1024&nologo=true`;

  try {
    const response = await axios.get(url, {
      responseType: "arraybuffer",
      timeout: 60000,
    });

    const outputDir = path.join(__dirname, "temp_images");
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

    const filePath = path.join(outputDir, `${filename}.png`);
    fs.writeFileSync(filePath, response.data);

    console.log(`   ✅ Fallback image saved: ${filePath}`);
    return filePath;
  } catch (err) {
    console.error(`   ❌ Fallback also failed: ${err.message}`);
    return null;
  }
}

// ─── SMART IMAGE GENERATOR (tries HF first, falls back to Pollinations) ──────
async function smartGenerateImage(imagePrompt, filename) {
  // Try HF if key exists
  if (process.env.HF_API_KEY && process.env.HF_API_KEY !== "your_hf_key_here") {
    const result = await generateImage(imagePrompt, filename);
    if (result) return result;
  }

  // Fallback to Pollinations (no key needed)
  return generateImageFallback(imagePrompt, filename);
}

function cleanupImage(filePath) {
  try {
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`   🗑️  Cleaned up: ${filePath}`);
    }
  } catch (err) {
    console.error(`   ⚠️  Cleanup failed: ${err.message}`);
  }
}

module.exports = { smartGenerateImage, cleanupImage };
