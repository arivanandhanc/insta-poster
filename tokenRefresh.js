require("./dns-fix");
const axios = require("axios");
const cron = require("node-cron");

// ─── REFRESH FACEBOOK LONG-LIVED TOKEN ───────────────────────────────────────
// Facebook long-lived tokens last 60 days. This exchanges the current token
// for a fresh 60-day token using the FB OAuth endpoint.
// Requires: FB_APP_ID + FB_APP_SECRET in env vars.
async function refreshToken() {
  const { FB_APP_ID, FB_APP_SECRET, IG_ACCESS_TOKEN } = process.env;

  if (!FB_APP_ID || !FB_APP_SECRET) {
    console.log("⚠️  Token auto-refresh skipped — add FB_APP_ID + FB_APP_SECRET in Render env vars");
    return false;
  }

  if (!IG_ACCESS_TOKEN) {
    console.log("⚠️  No IG_ACCESS_TOKEN set — cannot refresh");
    return false;
  }

  try {
    console.log("🔄 Refreshing Facebook access token...");
    const r = await axios.get("https://graph.facebook.com/v21.0/oauth/access_token", {
      params: {
        grant_type: "fb_exchange_token",
        client_id: FB_APP_ID,
        client_secret: FB_APP_SECRET,
        fb_exchange_token: IG_ACCESS_TOKEN,
      },
      timeout: 15000,
    });

    const newToken = r.data.access_token;
    if (!newToken) throw new Error("No token returned from Facebook");

    process.env.IG_ACCESS_TOKEN = newToken;
    console.log("✅ Token refreshed! Valid for another 60 days.");

    await updateRenderEnvVar("IG_ACCESS_TOKEN", newToken);
    return true;
  } catch (err) {
    const msg = err.response?.data?.error?.message || err.message;
    console.error("❌ Token refresh failed:", msg);
    return false;
  }
}

// ─── UPDATE RENDER ENV VAR VIA RENDER API ─────────────────────────────────────
// Requires: RENDER_API_KEY + RENDER_SERVICE_ID in env vars.
// Get API key:    Render dashboard → Account Settings → API Keys
// Get service ID: Render dashboard → your service → Settings → Service ID (srv-xxxxxxxx)
async function updateRenderEnvVar(key, value) {
  const { RENDER_API_KEY, RENDER_SERVICE_ID } = process.env;

  if (!RENDER_API_KEY || !RENDER_SERVICE_ID) {
    console.log("ℹ️  Render API not configured — add RENDER_API_KEY + RENDER_SERVICE_ID");
    console.log("   Manually update in Render dashboard: " + key + " = " + value.slice(0, 30) + "...");
    return;
  }

  try {
    // Get all current env vars from Render
    const { data: envList } = await axios.get(
      `https://api.render.com/v1/services/${RENDER_SERVICE_ID}/env-vars`,
      {
        headers: { Authorization: `Bearer ${RENDER_API_KEY}`, Accept: "application/json" },
        timeout: 10000,
      }
    );

    // Render returns [{envVar: {key, value}, cursor: "..."}, ...]
    const existing = Array.isArray(envList)
      ? envList.map((e) => ({
          key: e.envVar?.key || e.key,
          value: (e.envVar?.key || e.key) === key ? value : (e.envVar?.value || e.value || ""),
        }))
      : [];

    if (!existing.find((e) => e.key === key)) existing.push({ key, value });

    // Render API expects a plain array (not wrapped in {envVars: [...]})
    await axios.put(
      `https://api.render.com/v1/services/${RENDER_SERVICE_ID}/env-vars`,
      existing,
      {
        headers: {
          Authorization: `Bearer ${RENDER_API_KEY}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        timeout: 15000,
      }
    );

    console.log("✅ Render env var updated automatically — no manual action needed!");
  } catch (err) {
    const detail = err.response?.data ? JSON.stringify(err.response.data) : err.message;
    console.error("⚠️  Render env update failed:", detail);
    console.log("   Manually update IG_ACCESS_TOKEN in Render dashboard");
  }
}

// ─── CHECK TOKEN EXPIRY VIA FB DEBUG ENDPOINT ─────────────────────────────────
async function checkTokenExpiry() {
  const { FB_APP_ID, FB_APP_SECRET, IG_ACCESS_TOKEN } = process.env;
  if (!FB_APP_ID || !FB_APP_SECRET || !IG_ACCESS_TOKEN) return null;

  try {
    const r = await axios.get("https://graph.facebook.com/debug_token", {
      params: {
        input_token: IG_ACCESS_TOKEN,
        access_token: `${FB_APP_ID}|${FB_APP_SECRET}`,
      },
      timeout: 10000,
    });

    const data = r.data?.data;
    if (!data?.is_valid) return { valid: false, daysLeft: 0 };

    const expiresAt = data.expires_at;
    if (!expiresAt) return { valid: true, daysLeft: 999 };

    const daysLeft = Math.floor((expiresAt * 1000 - Date.now()) / 86400000);
    return { valid: true, daysLeft, expiresAt: new Date(expiresAt * 1000).toISOString() };
  } catch {
    return null;
  }
}

// ─── SCHEDULE: REFRESH ON 1ST AND 16TH OF EACH MONTH ─────────────────────────
function scheduleTokenRefresh() {
  cron.schedule(
    "0 21 1,16 * *", // 2:30am IST on 1st and 16th
    async () => {
      console.log("\n🔑 Scheduled FB token refresh...");
      await refreshToken();
    },
    { timezone: "UTC" }
  );

  console.log("🔑 Token auto-refresh scheduled (1st & 16th of each month)");
}

module.exports = { refreshToken, scheduleTokenRefresh, checkTokenExpiry, updateRenderEnvVar };
