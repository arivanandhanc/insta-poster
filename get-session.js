/**
 * ONE-TIME SESSION EXTRACTOR
 * Run: node get-session.js
 *
 * A browser opens → you log in manually with Facebook → session is saved.
 * Session stays valid ~3 months.
 */
require("./dns-fix");
require("dotenv").config();
let puppeteer;
try {
  puppeteer = require("puppeteer");
} catch {
  console.error("Puppeteer not installed. Run: npm install puppeteer");
  process.exit(1);
}
const fs = require("fs");
const path = require("path");
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function extractSession() {
  console.log("\n🌐 Opening Instagram in browser...");
  console.log("   → Log in manually using 'Continue with Facebook'");
  console.log("   → Once Instagram home page loads, session is captured automatically\n");

  const browser = await puppeteer.launch({
    headless: false,
    args: [
      "--start-maximized",
      "--disable-blink-features=AutomationControlled",
      "--no-sandbox",
    ],
    defaultViewport: null,
  });

  const page = await browser.pages().then((p) => p[0]);
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => false });
  });

  await page.goto("https://www.instagram.com/accounts/login/", {
    waitUntil: "networkidle2",
    timeout: 30000,
  });

  console.log("⏳ Waiting for you to log in... (up to 3 minutes)");
  console.log("   In the browser: click 'Continue with Facebook' → log in → wait for Instagram home\n");

  // Poll every 2 seconds for up to 5 minutes
  let sessionId = null;
  for (let i = 0; i < 150; i++) {
    await wait(2000);

    const url = page.url();
    const cookies = await page.cookies("https://www.instagram.com");
    const sid = cookies.find((c) => c.name === "sessionid")?.value;

    if (sid && url.includes("instagram.com") && !url.includes("login") && !url.includes("challenge")) {
      sessionId = sid;
      console.log("✅ Logged in! Session captured.");
      break;
    }

    if (i % 15 === 14) console.log(`   Still waiting... (${(i + 1) * 2}s)`);
  }

  if (sessionId) {
    const cookies = await page.cookies("https://www.instagram.com");
    const csrfToken = cookies.find((c) => c.name === "csrftoken")?.value;
    const dsUserId = cookies.find((c) => c.name === "ds_user_id")?.value;

    console.log("\n🎉 SESSION EXTRACTED!");
    console.log("─".repeat(55));
    console.log("IG_SESSION_ID=" + sessionId);
    if (csrfToken) console.log("IG_CSRF_TOKEN=" + csrfToken);
    console.log("─".repeat(55));

    // Auto-save to .env
    let envContent = fs.readFileSync(path.join(__dirname, ".env"), "utf8");
    const lines = envContent.split("\n");
    const upsert = (key, val) => {
      const idx = lines.findIndex((l) => l.startsWith(key + "="));
      if (idx >= 0) lines[idx] = `${key}=${val}`;
      else lines.push(`${key}=${val}`);
    };
    upsert("IG_SESSION_ID", sessionId);
    if (csrfToken) upsert("IG_CSRF_TOKEN", csrfToken);
    fs.writeFileSync(path.join(__dirname, ".env"), lines.join("\n"));

    console.log("\n✅ Saved to .env automatically!");
    console.log("\nNext step — test growth engine:");
    console.log('  node -e "require(\'./dns-fix\'); require(\'dotenv\').config(); require(\'./growthEngine\').runGrowthCycle().then(()=>process.exit(0))"');

    // Also remind about Render
    console.log("\nFor Render: add this to environment variables:");
    console.log("  Key: IG_SESSION_ID");
    console.log("  Value: " + sessionId.slice(0, 20) + "...");
  } else {
    console.log("\n❌ Session not captured — you may not have finished logging in.");
    console.log("   Current URL:", page.url());
  }

  await wait(3000);
  await browser.close();
  process.exit(0);
}

extractSession().catch((e) => {
  console.error("Fatal error:", e.message);
  process.exit(1);
});
