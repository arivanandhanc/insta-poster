/**
 * FACEBOOK ACCESS TOKEN GENERATOR
 * Run: node get-access-token.js
 *
 * Opens Graph API Explorer → you log in → token extracted automatically.
 * No redirect URI setup required.
 */
require("./dns-fix");
require("dotenv").config();
const axios = require("axios");
const fs   = require("fs");
const path = require("path");

let puppeteer;
try { puppeteer = require("puppeteer"); }
catch { console.error("Run: npm install puppeteer"); process.exit(1); }

const APP_ID     = process.env.FB_APP_ID     || "3047224988970011";
const APP_SECRET = process.env.FB_APP_SECRET || "4abc902c8323fc7462b977d7d1b3a8ff";
const SCOPES     = "instagram_basic,instagram_content_publish,pages_manage_posts,pages_read_engagement,pages_show_list,business_management";

const RENDER_API_KEY = process.env.RENDER_API_KEY;
const RENDER_SVC_ID  = process.env.RENDER_SERVICE_ID;

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Exchange short-lived → long-lived token ───────────────────────────────────
async function toLongLived(shortToken) {
  console.log("🔄 Exchanging for 60-day long-lived token...");
  const r = await axios.get("https://graph.facebook.com/v21.0/oauth/access_token", {
    params: {
      grant_type: "fb_exchange_token",
      client_id: APP_ID,
      client_secret: APP_SECRET,
      fb_exchange_token: shortToken,
    },
    timeout: 15000,
  });
  const token = r.data.access_token;
  console.log("   ✅ Long-lived token obtained (valid ~60 days)");
  return token;
}

// ── Save to .env ──────────────────────────────────────────────────────────────
function saveToEnv(token) {
  const envPath = path.join(__dirname, ".env");
  let content = fs.readFileSync(envPath, "utf8");
  const lines = content.split("\n");
  const idx = lines.findIndex((l) => l.startsWith("IG_ACCESS_TOKEN="));
  if (idx >= 0) lines[idx] = `IG_ACCESS_TOKEN=${token}`;
  else lines.push(`IG_ACCESS_TOKEN=${token}`);
  fs.writeFileSync(envPath, lines.join("\n"));
  console.log("   ✅ Saved to .env");
}

// ── Push to Render ────────────────────────────────────────────────────────────
async function pushToRender(token) {
  if (!RENDER_API_KEY || !RENDER_SVC_ID) {
    console.log("   ⚠️  No RENDER_API_KEY — update IG_ACCESS_TOKEN manually in Render dashboard");
    return;
  }
  try {
    const { data: envList } = await axios.get(
      `https://api.render.com/v1/services/${RENDER_SVC_ID}/env-vars`,
      { headers: { Authorization: `Bearer ${RENDER_API_KEY}`, Accept: "application/json" } }
    );
    const updated = (Array.isArray(envList) ? envList : []).map((e) => ({
      key: e.envVar?.key || e.key,
      value: (e.envVar?.key || e.key) === "IG_ACCESS_TOKEN" ? token : (e.envVar?.value || e.value || ""),
    }));
    if (!updated.find((e) => e.key === "IG_ACCESS_TOKEN")) updated.push({ key: "IG_ACCESS_TOKEN", value: token });

    await axios.put(
      `https://api.render.com/v1/services/${RENDER_SVC_ID}/env-vars`,
      updated,
      { headers: { Authorization: `Bearer ${RENDER_API_KEY}`, "Content-Type": "application/json", Accept: "application/json" } }
    );
    console.log("   ✅ Render env var updated!");

    // Trigger redeploy
    await axios.post(
      `https://api.render.com/v1/services/${RENDER_SVC_ID}/deploys`,
      { clearCache: "do_not_clear" },
      { headers: { Authorization: `Bearer ${RENDER_API_KEY}`, "Content-Type": "application/json", Accept: "application/json" } }
    );
    console.log("   ✅ Render redeploy triggered!");
  } catch (e) {
    console.error("   ❌ Render update failed:", e.response?.data || e.message);
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log("\n🔑 FACEBOOK ACCESS TOKEN GENERATOR");
  console.log("─".repeat(50));
  console.log("   A browser will open with Graph API Explorer.");
  console.log("   Follow the steps on screen.\n");

  const browser = await puppeteer.launch({
    headless: false,
    args: ["--start-maximized", "--disable-blink-features=AutomationControlled", "--no-sandbox"],
    defaultViewport: null,
  });

  const page = await browser.pages().then((p) => p[0]);
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => false });
  });

  // Open Graph API Explorer with the app pre-selected
  const explorerUrl = `https://developers.facebook.com/tools/explorer/?app_id=${APP_ID}&redirect_uri=https%3A%2F%2Fdevelopers.facebook.com%2Ftools%2Fexplorer%2F&scope=${SCOPES}`;
  await page.goto(explorerUrl, { waitUntil: "networkidle2", timeout: 30000 });

  console.log("📋 IN THE BROWSER:");
  console.log("   1. If not logged in → log in with Facebook");
  console.log("   2. Click 'Generate Access Token' button");
  console.log("   3. In the popup → click 'Continue as [your name]'");
  console.log("   4. Grant the requested permissions");
  console.log("   5. Wait — token will be captured automatically\n");
  console.log("⏳ Waiting up to 10 minutes for token generation...\n");

  let token = null;

  // Poll every 3 seconds for a token in the input field or URL
  for (let i = 0; i < 200; i++) {
    await wait(3000);

    try {
      // Try to extract token from the Graph API Explorer input field
      const extracted = await page.evaluate(() => {
        // Try the token input field
        const inputs = document.querySelectorAll("input[type='text'], input[placeholder*='token'], input[placeholder*='Token']");
        for (const input of inputs) {
          const val = input.value;
          if (val && val.startsWith("EAA") && val.length > 100) return val;
        }
        // Try any visible text that looks like a token
        const allText = document.body.innerText;
        const match = allText.match(/EAA[A-Za-z0-9]{100,}/);
        return match ? match[0] : null;
      });

      if (extracted) {
        token = extracted;
        console.log("✅ Token captured from Graph API Explorer!");
        break;
      }

      // Also check URL for access_token param (if the OAuth redirect happened)
      const currentUrl = page.url();
      if (currentUrl.includes("access_token=")) {
        const urlObj = new URL(currentUrl);
        const t = urlObj.searchParams.get("access_token") || urlObj.hash.match(/access_token=([^&]+)/)?.[1];
        if (t && t.startsWith("EAA")) {
          token = t;
          console.log("✅ Token captured from URL redirect!");
          break;
        }
      }
    } catch {}

    if (i % 10 === 9) console.log(`   Still waiting... (${(i + 1) * 3}s)`);
  }

  await browser.close();

  if (!token) {
    console.log("\n❌ Token not captured. Try:");
    console.log("   1. Make sure you clicked 'Generate Access Token' and approved permissions");
    console.log("   2. Re-run: node get-access-token.js");
    process.exit(1);
  }

  console.log("\n🔄 Processing token...");

  // Exchange for long-lived if it looks short-lived (short tokens work too but expire faster)
  let finalToken = token;
  try {
    finalToken = await toLongLived(token);
  } catch (e) {
    console.log("   ⚠️  Long-lived exchange failed — using token as-is:", e.message);
  }

  console.log("\n🎉 NEW ACCESS TOKEN:");
  console.log("─".repeat(55));
  console.log("IG_ACCESS_TOKEN=" + finalToken.slice(0, 40) + "...[truncated]");
  console.log("─".repeat(55));

  console.log("\n💾 Saving...");
  saveToEnv(finalToken);
  await pushToRender(finalToken);

  console.log("\n✅ Done! Token refreshed for another 60 days.");
  process.exit(0);
}

main().catch((e) => { console.error("Fatal:", e.message); process.exit(1); });
