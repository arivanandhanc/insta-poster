/**
 * FULLY AUTOMATED SESSION EXTRACTOR
 * 1. Opens your existing Chrome profile (already logged in to Instagram)
 * 2. If verification code needed — reads it from Gmail automatically
 * 3. Saves session to .env + Render
 * Run: node get-session.js
 */
require("./dns-fix");
require("dotenv").config();

const axios    = require("axios");
const fs       = require("fs");
const path     = require("path");
const os       = require("os");
const wait     = (ms) => new Promise((r) => setTimeout(r, ms));

const FB_EMAIL       = process.env.FB_EMAIL           || "";
const FB_PASS        = process.env.FB_PASSWORD        || "";
const GMAIL_APP_PASS = (process.env.GMAIL_APP_PASSWORD || "").replace(/\s/g, "");
const RENDER_API_KEY = process.env.RENDER_API_KEY;
const RENDER_SVC_ID  = process.env.RENDER_SERVICE_ID;

const CHROME_EXE   = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const CHROME_DATA  = process.env.LOCALAPPDATA + "\\Google\\Chrome\\User Data";

// ── Gmail: read latest verification code ─────────────────────────────────────
async function getVerificationCode(timeout = 120000) {
  let { ImapFlow } = require("imapflow");
  const client = new ImapFlow({
    host:   "imap.gmail.com",
    port:   993,
    secure: true,
    auth: { user: FB_EMAIL, pass: GMAIL_APP_PASS },
    logger: false,
  });

  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    try {
      await client.connect();
      await client.mailboxOpen("INBOX");

      // Search for recent Instagram/Facebook verification emails
      const since = new Date(Date.now() - 10 * 60 * 1000); // last 10 min
      const uids = await client.search({ since, from: ["instagram", "facebook", "facebookmail"] });

      for (const uid of uids.reverse()) {
        const msg = await client.fetchOne(uid, { bodyParts: ["TEXT"], envelope: true });
        const text = msg?.bodyParts?.get("TEXT")?.toString() || "";
        // Extract 6-digit code
        const match = text.match(/\b(\d{6})\b/);
        if (match) {
          await client.logout();
          console.log(`   ✅ Verification code found: ${match[1]}`);
          return match[1];
        }
      }

      await client.logout();
    } catch (e) {
      // Silent fail — try again
    }
    await wait(5000);
  }
  return null;
}

// ── Render push ───────────────────────────────────────────────────────────────
async function pushToRender(sessionId, csrfToken) {
  if (!RENDER_API_KEY || !RENDER_SVC_ID) return;
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
    if (!updated.find(e => e.key === "IG_SESSION_ID")) updated.push({ key: "IG_SESSION_ID", value: encodeURIComponent(sessionId) });
    if (csrfToken && !updated.find(e => e.key === "IG_CSRF_TOKEN")) updated.push({ key: "IG_CSRF_TOKEN", value: csrfToken });
    await axios.put(`https://api.render.com/v1/services/${RENDER_SVC_ID}/env-vars`, updated,
      { headers: { Authorization: `Bearer ${RENDER_API_KEY}`, "Content-Type": "application/json", Accept: "application/json" } });
    await axios.post(`https://api.render.com/v1/services/${RENDER_SVC_ID}/deploys`, { clearCache: "do_not_clear" },
      { headers: { Authorization: `Bearer ${RENDER_API_KEY}`, "Content-Type": "application/json", Accept: "application/json" } });
    console.log("✅ Render updated + redeploy triggered!");
  } catch (e) { console.log("⚠️  Render push failed:", e.message); }
}

function saveToEnv(sessionId, csrfToken) {
  const envPath = path.join(__dirname, ".env");
  let lines = fs.readFileSync(envPath, "utf8").split("\n");
  const upsert = (k, v) => {
    const idx = lines.findIndex(l => l.startsWith(k + "="));
    if (idx >= 0) lines[idx] = `${k}=${v}`;
    else lines.push(`${k}=${v}`);
  };
  upsert("IG_SESSION_ID", encodeURIComponent(sessionId));
  if (csrfToken) upsert("IG_CSRF_TOKEN", csrfToken);
  fs.writeFileSync(envPath, lines.join("\n"));
  process.env.IG_SESSION_ID = encodeURIComponent(sessionId);
  if (csrfToken) process.env.IG_CSRF_TOKEN = csrfToken;
}

async function extractSession() {
  console.log("\n🤖 FULLY AUTOMATED SESSION EXTRACTOR");
  console.log("─".repeat(50));
  console.log(`   Account:  @${process.env.IG_USERNAME}`);
  console.log(`   Gmail:    ${FB_EMAIL} (for verification codes)`);
  console.log("─".repeat(50) + "\n");

  let puppeteer;
  try {
    const extra   = require("puppeteer-extra");
    const stealth = require("puppeteer-extra-plugin-stealth");
    extra.use(stealth());
    puppeteer = extra;
  } catch {
    puppeteer = require("puppeteer");
  }

  // Copy Chrome profile to temp dir (so we can use existing cookies)
  const tempProfile = path.join(os.tmpdir(), "ig-session-" + Date.now());
  let copied = false;

  if (fs.existsSync(CHROME_DATA)) {
    try {
      const src  = (f) => path.join(CHROME_DATA, f);
      const dst  = (f) => path.join(tempProfile, f);

      fs.mkdirSync(path.join(tempProfile, "Default", "Network"), { recursive: true });

      // Files needed to decrypt cookies
      const filesToCopy = [
        ["Local State",                         "Local State"],
        ["Default/Cookies",                     "Default/Cookies"],
        ["Default/Network/Cookies",             "Default/Network/Cookies"],
        ["Default/Login Data",                  "Default/Login Data"],
        ["Default/Web Data",                    "Default/Web Data"],
      ];

      for (const [s, d] of filesToCopy) {
        try {
          const srcPath = src(s);
          if (fs.existsSync(srcPath)) {
            fs.mkdirSync(path.dirname(dst(d)), { recursive: true });
            fs.copyFileSync(srcPath, dst(d));
          }
        } catch {}
      }

      copied = true;
      console.log("   ✅ Chrome profile cookies copied\n");
    } catch (e) {
      console.log("   ⚠️  Profile copy failed:", e.message);
    }
  }

  const launchOpts = {
    headless:        false,
    defaultViewport: null,
    args: [
      "--start-maximized",
      "--disable-blink-features=AutomationControlled",
      "--no-sandbox",
      "--disable-setuid-sandbox",
    ],
  };

  if (copied && fs.existsSync(CHROME_EXE)) {
    launchOpts.executablePath = CHROME_EXE;
    launchOpts.userDataDir    = tempProfile;
  } else if (fs.existsSync(CHROME_EXE)) {
    launchOpts.executablePath = CHROME_EXE;
  }

  const browser = await puppeteer.launch(launchOpts);
  const page    = await browser.pages().then(p => p[0]);

  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => false });
    window.chrome = { runtime: {} };
  }).catch(() => {});

  // Navigate to Instagram
  await page.goto("https://www.instagram.com/", { waitUntil: "domcontentloaded", timeout: 60000 });
  await wait(3000);

  let sessionId = null;
  let codeEntered = false;

  console.log("⏳ Extracting session...\n");

  for (let i = 0; i < 300; i++) {
    await wait(2000);

    try {
      const url     = page.url();
      const cookies = await page.cookies("https://www.instagram.com").catch(() => []);
      const sid     = cookies.find(c => c.name === "sessionid")?.value;

      // ── Auto-click "Continue with Facebook" on Instagram login ────────────
      if (url.includes("login") || url.includes("accounts/login")) {
        await page.evaluate(() => {
          const all = [...document.querySelectorAll("a, button, [role='button']")];
          const fb  = all.find(e => {
            const t = (e.textContent || "").toLowerCase();
            const h = (e.href || "").toLowerCase();
            return t.includes("facebook") || h.includes("facebook");
          });
          if (fb) fb.click();
        }).catch(() => {});
      }

      // ── Auto-fill Facebook credentials if on FB login page ────────────────
      if (url.includes("facebook.com") && (url.includes("/login") || url.includes("Login"))) {
        await page.evaluate(({ email, pass }) => {
          const emailInp = document.querySelector('#email, input[name="email"]');
          const passInp  = document.querySelector('#pass,  input[name="pass"]');
          if (emailInp && !emailInp.value) {
            emailInp.value = email;
            emailInp.dispatchEvent(new Event("input", { bubbles: true }));
            emailInp.dispatchEvent(new Event("change", { bubbles: true }));
          }
          if (passInp && !passInp.value) {
            passInp.value = pass;
            passInp.dispatchEvent(new Event("input", { bubbles: true }));
            passInp.dispatchEvent(new Event("change", { bubbles: true }));
          }
          const btn = document.querySelector('[name="login"], button[type="submit"]');
          if (btn && emailInp?.value && passInp?.value) btn.click();
        }, { email: FB_EMAIL, pass: FB_PASS }).catch(() => {});
        await wait(2000);
      }

      // ── Auto-click OAuth "Continue as [Name]" dialog ──────────────────────
      if (url.includes("facebook.com") && url.includes("dialog")) {
        await page.evaluate(() => {
          const btns = [...document.querySelectorAll("button, [role='button']")];
          const ok   = btns.find(b => /^(continue|ok|allow)/i.test((b.textContent || "").trim()));
          if (ok) ok.click();
        }).catch(() => {});
      }

      // ── Auto-enter verification code (read from Gmail) ────────────────────
      const isCodePage = url.includes("codeentry") || url.includes("two_factor") ||
        url.includes("checkpoint") || url.includes("challenge");

      if (isCodePage && !codeEntered) {
        console.log("   📱 Verification code page — checking Gmail...");
        const code = await getVerificationCode(60000);
        if (code) {
          codeEntered = true;
          // Try to type the code into the input
          await page.evaluate((c) => {
            const inputs = document.querySelectorAll('input[type="text"], input[type="number"], input[inputmode="numeric"]');
            for (const inp of inputs) {
              inp.value = c;
              inp.dispatchEvent(new Event("input", { bubbles: true }));
              inp.dispatchEvent(new Event("change", { bubbles: true }));
            }
          }, code);
          await wait(500);
          // Click submit
          await page.evaluate(() => {
            const btns = [...document.querySelectorAll("button")];
            const submit = btns.find(b => /submit|confirm|continue|next|verify/i.test(b.textContent));
            if (submit) submit.click();
            else { const f = document.querySelector("form"); if (f) f.submit(); }
          });
          console.log(`   ✅ Code ${code} entered and submitted`);
          await wait(4000);
        } else {
          console.log("   ⚠️  No code found in Gmail — enter it manually in the browser");
        }
      }

      // ── Dismiss Instagram popups ───────────────────────────────────────────
      if (sid) {
        await page.evaluate(() => {
          const btns = [...document.querySelectorAll("button")];
          const skip = btns.find(b => /not now|skip|later/i.test(b.textContent));
          if (skip) skip.click();
        }).catch(() => {});
      }

      const isBlocked = isCodePage || url.includes("challenge") || url.includes("identify");

      if (sid && url.includes("instagram.com") && !url.includes("login") && !isBlocked) {
        sessionId = sid;
        console.log("✅ Session captured!");
        break;
      }
    } catch {}

    if (i % 30 === 29) console.log(`   Waiting... (${Math.round((i + 1) * 2 / 60)} min)`);
  }

  if (sessionId) {
    const cookies   = await page.cookies("https://www.instagram.com");
    const csrfToken = cookies.find(c => c.name === "csrftoken")?.value;

    console.log("\n🎉 SESSION EXTRACTED!");
    console.log("─".repeat(55));
    console.log("IG_SESSION_ID=" + sessionId.slice(0, 30) + "...");
    if (csrfToken) console.log("IG_CSRF_TOKEN=" + csrfToken);
    console.log("─".repeat(55));

    saveToEnv(sessionId, csrfToken);
    console.log("✅ Saved to .env");

    console.log("\n📡 Pushing to Render...");
    await pushToRender(sessionId, csrfToken);
    console.log("✅ Done! Session is live.");
  } else {
    console.log("\n❌ Could not capture session. URL:", page.url());
  }

  // Cleanup temp profile
  try { fs.rmSync(tempProfile, { recursive: true, force: true }); } catch {}

  await wait(3000);
  await browser.close();
  process.exit(sessionId ? 0 : 1);
}

extractSession().catch(e => { console.error("Fatal:", e.message); process.exit(1); });
