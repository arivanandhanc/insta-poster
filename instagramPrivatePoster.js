/**
 * Instagram Private API Poster
 * Posts photos using the Instagram mobile app API (session-based).
 * No Facebook Developer App or access token needed.
 * Same auth method as the growth engine (session cookie).
 */
require("./dns-fix");
const axios    = require("axios");
const fs       = require("fs");
const path     = require("path");
const FormData = require("form-data");

const IG_BASE   = "https://i.instagram.com";
const IG_UA     = "Instagram 295.0.0.32.109 Android (28/9; 420dpi; 1080x2220; OnePlus; ONEPLUS A6013; OnePlus6T; qcom; en_US; 497264312)";
const IG_APP_ID = "936619743392459";

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function getHeaders(extra = {}) {
  const sessionId = decodeURIComponent(process.env.IG_SESSION_ID || "");
  const csrf      = process.env.IG_CSRF_TOKEN || "";
  return {
    "User-Agent":          IG_UA,
    "Cookie":              `sessionid=${sessionId}; csrftoken=${csrf}`,
    "X-CSRFToken":         csrf,
    "X-IG-App-ID":         IG_APP_ID,
    "X-IG-Capabilities":   "3brTvwE=",
    "X-IG-Connection-Type":"WIFI",
    "Accept-Language":     "en-US",
    ...extra,
  };
}

// ── Verify session is alive ───────────────────────────────────────────────────
async function verifySession() {
  if (!process.env.IG_SESSION_ID) return false;
  try {
    const r = await axios.get(`${IG_BASE}/api/v1/accounts/current_user/?edit=true`, {
      headers: getHeaders(), timeout: 10000,
    });
    return !!r.data?.user;
  } catch {
    return false;
  }
}

// ── Step 1: Upload image to Instagram ────────────────────────────────────────
async function uploadPhoto(imagePath) {
  const uploadId = String(Date.now());
  const imageBuffer = fs.readFileSync(imagePath);
  const ext = path.extname(imagePath).toLowerCase();
  const mime = ext === ".png" ? "image/png" : "image/jpeg";

  const fd = new FormData();
  fd.append("upload_id",  uploadId);
  fd.append("media_type", "1");
  fd.append("image",      imageBuffer, { filename: `photo${ext}`, contentType: mime });

  const r = await axios.post(
    `${IG_BASE}/api/v1/media/upload/photo/`,
    fd,
    {
      headers: {
        ...getHeaders(fd.getHeaders()),
        "X-Entity-Type":    "image/jpeg",
        "X-Entity-Length":  imageBuffer.length,
        "X-Instagram-Rupload-Params": JSON.stringify({ media_type: 1, upload_id: uploadId }),
      },
      timeout: 60000,
      maxContentLength: Infinity,
      maxBodyLength:    Infinity,
    }
  );

  const returnedId = r.data?.upload_id || uploadId;
  console.log(`   ✅ Image uploaded (upload_id: ${returnedId})`);
  return returnedId;
}

// ── Step 2: Configure (publish) the post ─────────────────────────────────────
async function configurePost(uploadId, caption) {
  const csrf = process.env.IG_CSRF_TOKEN || "";
  const uuid = `${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;

  const body = new URLSearchParams({
    upload_id:   uploadId,
    caption:     caption.slice(0, 2200),
    source_type: "4",
    _csrftoken:  csrf,
    _uuid:       uuid,
    device_id:   `android-${uuid.slice(0, 16)}`,
  });

  const r = await axios.post(
    `${IG_BASE}/api/v1/media/configure/`,
    body.toString(),
    {
      headers: getHeaders({ "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" }),
      timeout: 30000,
      validateStatus: () => true,
    }
  );

  if (r.status === 200 && r.data?.media?.id) {
    const postId   = r.data.media.id;
    const shortcode = r.data.media.code;
    console.log(`   ✅ Published! Post ID: ${postId}`);
    return { success: true, postId, url: shortcode ? `https://www.instagram.com/p/${shortcode}/` : null };
  }

  if (r.status === 400 && r.data?.message?.includes("feedback_required")) {
    throw new Error("Instagram flagged the account — complete the challenge in the Instagram app");
  }
  if (r.status === 403 || r.status === 401) {
    throw new Error("Session expired — run node get-session.js or extract-session-from-browser.js");
  }
  throw new Error(`Configure failed (${r.status}): ${JSON.stringify(r.data).slice(0, 120)}`);
}

// ── Main post function ────────────────────────────────────────────────────────
async function postViaPrivateAPI(imagePath, caption) {
  console.log("\n📱 Instagram Private API posting...");

  if (!process.env.IG_SESSION_ID) {
    return { success: false, error: "No IG_SESSION_ID — run node get-session.js" };
  }

  const sessionOk = await verifySession();
  if (!sessionOk) {
    return { success: false, error: "Session invalid/expired — run node extract-session-from-browser.js" };
  }

  try {
    console.log("   Uploading image...");
    const uploadId = await uploadPhoto(imagePath);

    // Small human-like delay
    await wait(2000 + Math.random() * 2000);

    console.log("   Publishing post...");
    const result = await configurePost(uploadId, caption);
    console.log(`\n🎉 Posted via Private API!`);
    if (result.url) console.log(`   View at: ${result.url}`);
    return result;

  } catch (err) {
    console.error(`\n❌ Private API post failed: ${err.message}`);
    return { success: false, error: err.message };
  }
}

module.exports = { postViaPrivateAPI, verifySession };
