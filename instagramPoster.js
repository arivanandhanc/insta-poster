const axios = require("axios");
const fs = require("fs");
const path = require("path");
const FormData = require("form-data");

const IG_BASE = "https://graph.instagram.com/v21.0";
const FB_BASE = "https://graph.facebook.com/v21.0";

// ─── UPLOAD IMAGE TO IMGBB (free image hosting for Instagram API) ─────────────
// Instagram API needs a public URL — we host on imgbb free tier
async function uploadImageToHost(imagePath) {
  console.log("☁️  Uploading image to host...");

  // If already a public URL (Pollinations), use it directly
  if (imagePath.startsWith("http")) {
    console.log(`   ✅ Using direct URL`);
    return imagePath;
  }

  // No IMGBB key — self-host via our own Express /images route
  if (!process.env.IMGBB_API_KEY || process.env.IMGBB_API_KEY === "your_imgbb_key_here" || process.env.IMGBB_API_KEY === "") {
    const baseUrl = (process.env.RENDER_EXTERNAL_URL || process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`).replace(/\/$/, "");
    const filename = path.basename(imagePath);
    const url = `${baseUrl}/images/${filename}`;
    console.log(`   ✅ Self-hosted: ${url}`);
    return url;
  }

  const imageData = fs.readFileSync(imagePath, { encoding: "base64" });

  const form = new FormData();
  form.append("key", process.env.IMGBB_API_KEY);
  form.append("image", imageData);
  form.append("expiration", "604800"); // 7 days

  const response = await axios.post("https://api.imgbb.com/1/upload", form, {
    headers: form.getHeaders(),
    timeout: 30000,
  });

  const url = response.data.data.url;
  console.log(`   ✅ Image hosted: ${url}`);
  return url;
}

// ─── CREATE INSTAGRAM MEDIA CONTAINER ────────────────────────────────────────
async function createMediaContainer(imageUrl, caption) {
  console.log("📦 Creating Instagram media container...");

  const response = await axios.post(
    `${FB_BASE}/${process.env.IG_BUSINESS_ACCOUNT_ID}/media`,
    {
      image_url: imageUrl,
      caption: caption,
      access_token: process.env.IG_ACCESS_TOKEN,
    },
    {
      timeout: 30000,
      validateStatus: (s) => {
        if (s !== 200) {
          // Log the status for debugging but let axios throw
        }
        return s === 200;
      },
    }
  ).catch((err) => {
    const detail = err.response?.data ? JSON.stringify(err.response.data) : err.message;
    throw new Error(`Container creation failed (${err.response?.status}): ${detail}`);
  });

  const containerId = response.data.id;
  console.log(`   ✅ Container created: ${containerId}`);
  return containerId;
}

// ─── WAIT FOR CONTAINER TO BE READY ──────────────────────────────────────────
async function waitForContainer(containerId, maxWait = 60000) {
  console.log("⏳ Waiting for container to be ready...");
  const start = Date.now();

  while (Date.now() - start < maxWait) {
    const response = await axios.get(`${FB_BASE}/${containerId}`, {
      params: {
        fields: "status_code,status",
        access_token: process.env.IG_ACCESS_TOKEN,
      },
    });

    const { status_code } = response.data;

    if (status_code === "FINISHED") {
      console.log("   ✅ Container ready");
      return true;
    }
    if (status_code === "ERROR") {
      throw new Error("Instagram container processing failed");
    }

    console.log(`   Status: ${status_code} — waiting 5s...`);
    await new Promise((r) => setTimeout(r, 5000));
  }

  throw new Error("Container ready timeout");
}

// ─── PUBLISH CONTAINER ────────────────────────────────────────────────────────
async function publishContainer(containerId) {
  console.log("🚀 Publishing to Instagram...");

  const response = await axios.post(
    `${FB_BASE}/${process.env.IG_BUSINESS_ACCOUNT_ID}/media_publish`,
    {
      creation_id: containerId,
      access_token: process.env.IG_ACCESS_TOKEN,
    },
    { timeout: 30000 }
  );

  const postId = response.data.id;
  console.log(`   ✅ Published! Post ID: ${postId}`);
  return postId;
}

// ─── GET POST INSIGHTS ────────────────────────────────────────────────────────
async function getPostInsights(postId) {
  try {
    const response = await axios.get(`${FB_BASE}/${postId}/insights`, {
      params: {
        metric: "impressions,reach,likes_count,comments_count,saved,shares",
        access_token: process.env.IG_ACCESS_TOKEN,
      },
    });
    return response.data.data;
  } catch {
    return null;
  }
}

// ─── MAIN POST FUNCTION ───────────────────────────────────────────────────────
async function postToInstagram(imagePath, caption) {
  console.log("\n📸 Starting Instagram post workflow...");

  try {
    // Step 1: Upload image to public host
    const imageUrl = await uploadImageToHost(imagePath);

    // Step 2: Create container
    const containerId = await createMediaContainer(imageUrl, caption);

    // Step 3: Wait for processing
    await waitForContainer(containerId);

    // Step 4: Publish
    const postId = await publishContainer(containerId);

    console.log(`\n🎉 Successfully posted to Instagram!`);
    console.log(`   Post ID: ${postId}`);
    console.log(`   View at: https://www.instagram.com/p/${postId}/`);

    return { success: true, postId, imageUrl };
  } catch (err) {
    console.error(`\n❌ Instagram posting failed: ${err.message}`);
    return { success: false, error: err.message };
  }
}

// ─── GET ACCOUNT STATS ────────────────────────────────────────────────────────
async function getAccountStats() {
  try {
    const response = await axios.get(
      `${FB_BASE}/${process.env.IG_BUSINESS_ACCOUNT_ID}`,
      {
        params: {
          fields: "followers_count,media_count,name,username,biography",
          access_token: process.env.IG_ACCESS_TOKEN,
        },
      }
    );
    return response.data;
  } catch (err) {
    return { error: err.message };
  }
}

module.exports = { postToInstagram, getAccountStats, getPostInsights };
