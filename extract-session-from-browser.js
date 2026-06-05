/**
 * MANUAL SESSION EXTRACTOR
 *
 * When Puppeteer is blocked by Instagram verification:
 *
 * 1. Open Chrome/Edge and go to instagram.com
 * 2. Log in manually (complete any verification on your phone)
 * 3. Open DevTools (F12) → Console tab
 * 4. Paste this one-liner and press Enter:
 *
 *    document.cookie.split(';').map(c=>c.trim()).filter(c=>c.startsWith('sessionid=')||c.startsWith('csrftoken=')).join('\n')
 *
 * 5. Copy the output, then run:
 *    node extract-session-from-browser.js "sessionid=XXXX" "csrftoken=YYYY"
 *
 * OR: Run this script with no args to get the console command to paste.
 */
require("dotenv").config();
const fs   = require("fs");
const path = require("path");
const axios = require("axios");

const RENDER_API_KEY = process.env.RENDER_API_KEY;
const RENDER_SVC_ID  = process.env.RENDER_SERVICE_ID;

const args = process.argv.slice(2);

if (!args.length) {
  console.log("\n📋 MANUAL SESSION EXTRACTION");
  console.log("─".repeat(55));
  console.log("1. Open Chrome/Edge → go to instagram.com");
  console.log("2. Log in (complete phone verification if asked)");
  console.log("3. Press F12 → Console tab");
  console.log("4. Paste this and press Enter:\n");
  console.log(`   document.cookie.split(';').map(c=>c.trim()).filter(c=>c.startsWith('sessionid=')||c.startsWith('csrftoken=')).join('\\n')`);
  console.log("\n5. Copy the output, then run:");
  console.log(`   node extract-session-from-browser.js "sessionid=XXXX" "csrftoken=YYYY"\n`);
  process.exit(0);
}

// Parse args like "sessionid=XXXX" "csrftoken=YYYY"
const parsed = {};
for (const arg of args) {
  const [k, ...rest] = arg.replace(/^"|"$/g, "").split("=");
  if (k && rest.length) parsed[k.trim()] = rest.join("=").trim();
}

const sessionId = parsed["sessionid"];
const csrfToken = parsed["csrftoken"];

if (!sessionId) {
  console.error("❌ No sessionid found in arguments");
  process.exit(1);
}

async function save() {
  // Update .env
  const envPath = path.join(__dirname, ".env");
  let content = fs.readFileSync(envPath, "utf8");
  const lines = content.split("\n");
  const upsert = (key, val) => {
    const idx = lines.findIndex((l) => l.startsWith(key + "="));
    if (idx >= 0) lines[idx] = `${key}=${val}`;
    else lines.push(`${key}=${val}`);
  };
  upsert("IG_SESSION_ID", encodeURIComponent(sessionId));
  if (csrfToken) upsert("IG_CSRF_TOKEN", csrfToken);
  fs.writeFileSync(envPath, lines.join("\n"));
  console.log("✅ Saved to .env");

  // Push to Render
  if (!RENDER_API_KEY || !RENDER_SVC_ID) {
    console.log("⚠️  No RENDER_API_KEY — update manually in Render dashboard");
    return;
  }

  try {
    const { data: envList } = await axios.get(
      `https://api.render.com/v1/services/${RENDER_SVC_ID}/env-vars`,
      { headers: { Authorization: `Bearer ${RENDER_API_KEY}`, Accept: "application/json" } }
    );

    const updated = (Array.isArray(envList) ? envList : []).map((e) => {
      const k = e.envVar?.key || e.key;
      const v = e.envVar?.value || e.value || "";
      if (k === "IG_SESSION_ID") return { key: k, value: encodeURIComponent(sessionId) };
      if (k === "IG_CSRF_TOKEN" && csrfToken) return { key: k, value: csrfToken };
      return { key: k, value: v };
    });

    if (!updated.find((e) => e.key === "IG_SESSION_ID")) updated.push({ key: "IG_SESSION_ID", value: encodeURIComponent(sessionId) });
    if (csrfToken && !updated.find((e) => e.key === "IG_CSRF_TOKEN")) updated.push({ key: "IG_CSRF_TOKEN", value: csrfToken });

    await axios.put(
      `https://api.render.com/v1/services/${RENDER_SVC_ID}/env-vars`,
      updated,
      { headers: { Authorization: `Bearer ${RENDER_API_KEY}`, "Content-Type": "application/json", Accept: "application/json" } }
    );
    console.log("✅ Render env vars updated!");

    await axios.post(
      `https://api.render.com/v1/services/${RENDER_SVC_ID}/deploys`,
      { clearCache: "do_not_clear" },
      { headers: { Authorization: `Bearer ${RENDER_API_KEY}`, "Content-Type": "application/json", Accept: "application/json" } }
    );
    console.log("✅ Render redeploy triggered!");
  } catch (e) {
    console.error("❌ Render update failed:", e.response?.data || e.message);
  }
}

console.log(`\n🔑 Session ID: ${sessionId.slice(0, 20)}...`);
if (csrfToken) console.log(`🔑 CSRF Token: ${csrfToken.slice(0, 15)}...`);
console.log("\n💾 Saving to .env and Render...");
save().then(() => {
  console.log("\n✅ Done! Growth engine will activate on next Render restart.");
  process.exit(0);
});
