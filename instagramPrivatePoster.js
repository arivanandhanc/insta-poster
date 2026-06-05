/**
 * Instagram Private API Poster — uses Instagram's mobile Rupload protocol.
 * No Facebook App/Graph API needed. Uses session cookie auth.
 */
require("./dns-fix");
const axios    = require("axios");
const fs       = require("fs");
const path     = require("path");
const FormData = require("form-data");

const IG_BASE   = "https://i.instagram.com";
const IG_UA     = "Instagram 295.0.0.32.109 Android (28/9; 420dpi; 1080x2220; OnePlus; ONEPLUS A6013; OnePlus6T; qcom; en_US; 497264312)";
const IG_APP_ID = "936619743392459";
const wait      = (ms) => new Promise((r) => setTimeout(r, ms));

function getHeaders(extra = {}) {
  const sessionId = decodeURIComponent(process.env.IG_SESSION_ID || "");
  const csrf      = process.env.IG_CSRF_TOKEN || "";
  return {
    "User-Agent":            IG_UA,
    "Cookie":                `sessionid=${sessionId}; csrftoken=${csrf}; ds_user_id=${process.env.IG_USER_ID || ""}`,
    "X-CSRFToken":           csrf,
    "X-IG-App-ID":           IG_APP_ID,
    "X-IG-Capabilities":     "3brTvwE=",
    "X-IG-Connection-Type":  "WIFI",
    "Accept-Language":       "en-US,en;q=0.9",
    "Accept-Encoding":       "gzip, deflate",
    ...extra,
  };
}

// ── Verify session ────────────────────────────────────────────────────────────
async function verifySession() {
  if (!process.env.IG_SESSION_ID) return null;
  try {
    const r = await axios.get(`${IG_BASE}/api/v1/accounts/current_user/?edit=true`, {
      headers: getHeaders(), timeout: 10000,
    });
    return r.data?.user || null;
  } catch { return null; }
}

// ── Convert any image to JPEG (Instagram requires JPEG) ──────────────────────
async function toJpeg(imagePath) {
  try {
    const sharp = require("sharp");
    const outPath = imagePath.replace(/\.[^.]+$/, "_ig.jpg");
    await sharp(imagePath).jpeg({ quality: 92 }).toFile(outPath);
    return outPath;
  } catch {
    // sharp not available — return as-is (PNG may work too)
    return imagePath;
  }
}

// ── Step 1: Upload via Rupload protocol ───────────────────────────────────────
async function uploadPhoto(imagePath) {
  // Convert to JPEG for Instagram compatibility
  const jpegPath    = await toJpeg(imagePath);
  const imageBuffer = fs.readFileSync(jpegPath);
  const isJpeg      = /\.jpe?g$/i.test(jpegPath);
  const mime        = "image/jpeg";
  const uploadId    = String(Date.now());
  const entityName  = `${uploadId}_0_${Math.floor(Math.random() * 1e9)}`;

  console.log(`   Uploading ${Math.round(imageBuffer.length / 1024)}KB image...`);

  const ruploadParams = JSON.stringify({
    media_type:            1,
    upload_id:             uploadId,
    upload_media_height:   1080,
    upload_media_width:    1080,
    upload_media_duration_ms: 0,
    for_album:             false,
  });

  const r = await axios.post(
    `${IG_BASE}/rupload_igphoto/${entityName}`,
    imageBuffer,
    {
      headers: getHeaders({
        "Content-Type":                   "application/octet-stream",
        "X-Instagram-Rupload-Params":     ruploadParams,
        "X-Entity-Type":                  mime,
        "X-Entity-Name":                  entityName,
        "X-Entity-Length":                String(imageBuffer.length),
        "Offset":                         "0",
        "Content-Length":                 String(imageBuffer.length),
      }),
      timeout:           120000,
      maxContentLength:  Infinity,
      maxBodyLength:     Infinity,
    }
  );

  const returnedUploadId = r.data?.upload_id || uploadId;
  console.log(`   ✅ Upload OK (id: ${returnedUploadId})`);
  return returnedUploadId;
}

// ── Step 2: Configure (publish) ───────────────────────────────────────────────
async function configurePost(uploadId, caption) {
  const csrf   = process.env.IG_CSRF_TOKEN || "";
  const uuid   = require("crypto").randomUUID();
  const userId = process.env.IG_USER_ID || "";

  const payload = {
    upload_id:   uploadId,
    caption:     caption.slice(0, 2200),
    source_type: "4",
    _csrftoken:  csrf,
    _uuid:       uuid,
    _uid:        userId,
    media_type:  "1",
    device_id:   `android-${uuid.replace(/-/g, "").slice(0, 16)}`,
  };

  const body = new URLSearchParams(payload).toString();

  const r = await axios.post(
    `${IG_BASE}/api/v1/media/configure/`,
    body,
    {
      headers: getHeaders({
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      }),
      timeout: 30000,
      validateStatus: () => true,
    }
  );

  if (r.status === 200 && (r.data?.media?.id || r.data?.status === "ok")) {
    const media     = r.data.media;
    const postId    = media?.id || uploadId;
    const shortcode = media?.code;
    console.log(`   ✅ Published! Post ID: ${postId}`);
    return {
      success: true,
      postId,
      url: shortcode ? `https://www.instagram.com/p/${shortcode}/` : `https://www.instagram.com/p/${postId}/`,
    };
  }

  // Handle common errors with useful messages
  const msg = r.data?.message || JSON.stringify(r.data).slice(0, 200);
  if (r.status === 403 || r.status === 401) throw new Error("session_expired");
  if (msg.includes("feedback_required") || msg.includes("challenge")) throw new Error("challenge_required");
  if (r.status === 400 && msg.includes("spam")) throw new Error("spam_detected — slow down");
  throw new Error(`configure_failed(${r.status}): ${msg}`);
}

// ── Step 3: Get user ID (needed for configure payload) ────────────────────────
async function getUserId() {
  if (process.env.IG_USER_ID) return process.env.IG_USER_ID;
  try {
    const r = await axios.get(`${IG_BASE}/api/v1/accounts/current_user/?edit=true`, {
      headers: getHeaders(), timeout: 10000,
    });
    const uid = String(r.data?.user?.pk || "");
    if (uid) process.env.IG_USER_ID = uid;
    return uid;
  } catch { return ""; }
}

// ── Main export ───────────────────────────────────────────────────────────────
async function postViaPrivateAPI(imagePath, caption) {
  console.log("\n📱 Private API (Rupload)...");

  if (!process.env.IG_SESSION_ID) {
    return { success: false, error: "No session — run node get-session.js" };
  }

  // Fetch user ID for configure payload
  await getUserId();

  try {
    const uploadId = await uploadPhoto(imagePath);
    await wait(1500 + Math.random() * 1500); // human pause
    const result = await configurePost(uploadId, caption);
    console.log(`🎉 Posted! ${result.url}`);
    return result;
  } catch (err) {
    if (err.message === "session_expired") {
      return { success: false, error: "session_expired" };
    }
    console.error(`❌ Private API failed: ${err.message}`);
    return { success: false, error: err.message };
  }
}

module.exports = { postViaPrivateAPI, verifySession };
