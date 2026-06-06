/**
 * Full production test suite — safe to run repeatedly (never posts).
 *   node test-all.js            → run everything
 *   node test-all.js --quick    → skip the slow multi-image generation pass
 *   node test-all.js --images 6 → generate N test images (default 4)
 *
 * Validates: env config · content generation (Groq) · image pipeline (real
 * photo sources + branded compositing) · posting paths (Graph + private API,
 * status only) · growth session · dry-run pipeline.
 */
require("./dns-fix");
require("dotenv").config();
const fs   = require("fs");
const path = require("path");

const args   = process.argv.slice(2);
const QUICK  = args.includes("--quick");
const N_IMG  = Number((args[args.indexOf("--images") + 1]) || 0) || (QUICK ? 2 : 4);

let pass = 0, fail = 0, warn = 0;
const results = [];
const ok   = (n, d = "") => { pass++; results.push(["✅", n, d]); console.log(`✅ ${n}${d ? " — " + d : ""}`); };
const bad  = (n, d = "") => { fail++; results.push(["❌", n, d]); console.log(`❌ ${n}${d ? " — " + d : ""}`); };
const note = (n, d = "") => { warn++; results.push(["⚠️ ", n, d]); console.log(`⚠️  ${n}${d ? " — " + d : ""}`); };
const head = (s) => console.log("\n" + "═".repeat(64) + "\n" + s + "\n" + "═".repeat(64));

function isValidImage(fp) {
  if (!fp || !fs.existsSync(fp)) return false;
  const buf = fs.readFileSync(fp);
  if (buf.length < 8000) return false;
  // JPEG (FFD8FF), PNG (89504E47), or SVG (<?xml/<svg)
  const hex = buf.slice(0, 4).toString("hex").toUpperCase();
  const txt = buf.slice(0, 100).toString("utf8");
  return hex.startsWith("FFD8FF") || hex === "89504E47" || /<svg|<\?xml/.test(txt);
}

async function main() {
  const t0 = Date.now();

  // ── 1. MODULE LOAD ──────────────────────────────────────────────────────────
  head("1 · MODULE LOAD");
  let mods;
  try {
    mods = {
      content: require("./contentGenerator"),
      image:   require("./imageGenerator"),
      sched:   require("./scheduler"),
      poster:  require("./instagramPoster"),
      priv:    require("./instagramPrivatePoster"),
      growth:  require("./growthEngine"),
    };
    ok("All modules loaded", `${mods.content.ALL_TOPICS.length} topics, ${Object.keys(mods.content.CONTENT_TOPICS).length} categories`);
  } catch (e) {
    bad("Module load", e.message);
    return finish(t0);
  }

  // ── 2. ENV CONFIG ───────────────────────────────────────────────────────────
  head("2 · ENVIRONMENT CONFIG");
  const need = ["GROQ_API_KEY"];
  const posting = ["IG_SESSION_ID", "IG_BUSINESS_ACCOUNT_ID", "IG_ACCESS_TOKEN"];
  const optionalImg = ["HF_API_KEY", "TOGETHER_API_KEY", "FAL_KEY", "STABILITY_API_KEY", "PEXELS_API_KEY", "PIXABAY_API_KEY"];
  need.forEach((k) => (process.env[k] ? ok(`${k} set`) : bad(`${k} missing`, "content generation will fail")));
  posting.forEach((k) => (process.env[k] ? ok(`${k} set`) : note(`${k} missing`, "needed for live posting")));
  const imgKeys = optionalImg.filter((k) => process.env[k]);
  imgKeys.length ? ok("AI image keys", imgKeys.join(", "))
                 : note("No AI image keys", "will use free photo sources (Wikimedia/Openverse) — that's fine");

  // ── 3. CONTENT GENERATION (Groq) ───────────────────────────────────────────
  head("3 · CONTENT GENERATION (Groq)");
  let sampleTopic;
  try {
    sampleTopic = await mods.content.getNextTopic();
    const c = await mods.content.generateCaption(sampleTopic.topic, sampleTopic.category);
    const tags = (c.hashtags || "").split(/\s+/).filter(Boolean).length;
    if (c.hook && c.body && c.hashtags && c.image_prompt) {
      ok("Caption generated", `hook:"${c.hook.slice(0, 40)}" · ${c.body.length} chars · ${tags} tags`);
    } else {
      bad("Caption incomplete", JSON.stringify(Object.keys(c)));
    }
  } catch (e) {
    bad("Content generation", e.message);
  }

  // ── 4. IMAGE PIPELINE ───────────────────────────────────────────────────────
  head(`4 · IMAGE PIPELINE (${N_IMG} samples across categories)`);
  const cats = [
    { topic: "The Meenakshi Temple of Madurai", hook: "33,000 carved sculptures", category: "Tamil Temples" },
    { topic: "Chettinad cuisine and its spices", hook: "Tamil Nadu's boldest food", category: "Tamil Food" },
    { topic: "Pongal the harvest festival", hook: "Why Tamils thank the sun", category: "Tamil Festivals" },
    { topic: "The Chola dynasty's naval power", hook: "Tamil kings who ruled the seas", category: "Tamil History" },
    { topic: "Bharatanatyam classical dance", hook: "2000 years of Tamil dance", category: "Tamil Art" },
    { topic: "Kanchipuram silk sarees", hook: "The queen of silks", category: "Tamil Craft" },
  ];
  const made = [];
  for (let i = 0; i < N_IMG; i++) {
    const c = cats[i % cats.length];
    try {
      const fp = await mods.image.smartGenerateImage(c.topic, `selftest_${i}_${Date.now()}`, c);
      if (isValidImage(fp)) {
        const kb = Math.round(fs.statSync(fp).size / 1024);
        ok(`Image ${i + 1}/${N_IMG} [${c.category}]`, `${path.basename(fp)} (${kb}KB)`);
        made.push(fp);
      } else {
        bad(`Image ${i + 1} invalid`, fp);
      }
    } catch (e) {
      bad(`Image ${i + 1} error`, e.message);
    }
  }
  // cleanup test images
  made.forEach((fp) => { try { fs.unlinkSync(fp); } catch {} });

  // 4b. Guaranteed local fallback must ALWAYS work (offline safety net)
  try {
    const fp = mods.image.generateSVGImage("Offline test topic", "Guaranteed card", "Tamil History", `selftest_svg_${Date.now()}`);
    isValidImage(fp) ? ok("Local SVG fallback (offline safety net)") : bad("Local SVG fallback invalid");
    try { fs.unlinkSync(fp); } catch {}
  } catch (e) { bad("Local SVG fallback", e.message); }

  // ── 5. POSTING PATHS (status only — no posts) ──────────────────────────────
  head("5 · POSTING PATHS (status only — nothing is posted)");
  // Graph API token
  try {
    const stats = await mods.poster.getAccountStats();
    stats.error ? note("Graph API token", "expired/invalid — private API is the active poster")
                : ok("Graph API token valid", `@${stats.username} · ${stats.followers_count} followers`);
  } catch (e) { note("Graph API check", e.message); }
  // Private API session (this is the live posting path)
  try {
    const user = await mods.priv.verifySession();
    user ? ok("Private API session active", `@${user.username} (the live poster)`)
         : bad("Private API session", "expired — run node get-session.js");
  } catch (e) { bad("Private API session", e.message); }

  // ── 6. GROWTH ENGINE ────────────────────────────────────────────────────────
  head("6 · GROWTH ENGINE");
  try {
    const gs = mods.growth.getGrowthStats();
    ok("Growth stats", `follows ${gs.today.follows}/${gs.limits.follows} · likes ${gs.today.likes}/${gs.limits.likes} · engine ${gs.engineEnabled ? "ON" : "OFF"}`);
  } catch (e) { bad("Growth stats", e.message); }

  // ── 7. DRY-RUN PIPELINE (end-to-end, no post) ──────────────────────────────
  head("7 · DRY-RUN PIPELINE (full pipeline, no post)");
  try {
    const r = await mods.sched.runPostPipeline({ dryRun: true });
    r.success ? ok("Dry-run pipeline", `topic: "${r.topic}"`) : bad("Dry-run pipeline", r.error);
  } catch (e) { bad("Dry-run pipeline", e.message); }

  finish(t0);
}

function finish(t0) {
  head("SUMMARY");
  console.log(`   ✅ pass: ${pass}    ⚠️  warn: ${warn}    ❌ fail: ${fail}`);
  console.log(`   ⏱  ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  if (fail === 0) {
    console.log("\n🎉 ALL CRITICAL TESTS PASSED — production ready\n");
    process.exit(0);
  } else {
    console.log("\n❌ SOME TESTS FAILED — see ❌ lines above\n");
    process.exit(1);
  }
}

main().catch((e) => { console.error("\n💥 TEST RUNNER CRASHED:", e); process.exit(1); });
