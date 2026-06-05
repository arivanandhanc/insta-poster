require("./dns-fix");
const cron = require("node-cron");
const fs = require("fs");
const path = require("path");
const { generateCaption, getNextTopic } = require("./contentGenerator");
const { smartGenerateImage, cleanupImage } = require("./imageGenerator");
const { postToInstagram } = require("./instagramPoster");
const { runGrowthCycle } = require("./growthEngine");
const { scheduleTokenRefresh, refreshToken } = require("./tokenRefresh");

// ─── POST LOG ─────────────────────────────────────────────────────────────────
const LOG_FILE = path.join(__dirname, "post_log.json");

function loadLog() {
  if (!fs.existsSync(LOG_FILE)) return [];
  try { return JSON.parse(fs.readFileSync(LOG_FILE, "utf8")); } catch { return []; }
}

function saveLog(log) {
  fs.writeFileSync(LOG_FILE, JSON.stringify(log, null, 2));
}

function logPost(entry) {
  const log = loadLog();
  log.unshift({ ...entry, timestamp: new Date().toISOString() });
  saveLog(log.slice(0, 1000));
}

// ─── SINGLE POST PIPELINE ─────────────────────────────────────────────────────
async function runPostPipeline(options = {}) {
  const { topic: forcedTopic, category: forcedCategory, dryRun = false } = options;

  console.log("\n" + "═".repeat(60));
  console.log(`🕐 Post pipeline started: ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST`);
  console.log("═".repeat(60));

  let imagePath = null;

  try {
    // Step 1: Pick topic
    const topicData = forcedTopic
      ? { topic: forcedTopic, category: forcedCategory || "Tamil Culture" }
      : await getNextTopic();

    const { topic, category } = topicData;
    console.log(`\n📌 Topic: ${topic}`);
    console.log(`   Category: ${category}${topicData.aiGenerated ? " [AI-generated]" : ""}`);

    // Step 2: Generate content with Groq
    console.log("\n✍️  Generating content with Groq...");
    const content = await generateCaption(topic, category);
    console.log(`   ✅ Caption generated (${content.body?.length || 0} chars)`);
    console.log(`   Hook: "${content.hook}"`);

    // Step 3: Build full caption
    const fullCaption = `${content.hook}\n\n${content.body}\n\n${content.cta}\n\n${content.hashtags}`;

    // Step 4: Generate image
    const timestamp = Date.now();
    const safeFilename = topic.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 40) + `_${timestamp}`;

    console.log("\n🎨 Generating image...");
    imagePath = await smartGenerateImage(content.image_prompt, safeFilename, { topic, hook: content.hook });

    if (!imagePath) throw new Error("Image generation failed — no image to post");

    console.log("\n📋 Content Preview:");
    console.log(`   Hook: ${content.hook}`);
    console.log(`   Caption length: ${fullCaption.length} chars`);
    console.log(`   Image: ${imagePath}`);

    if (dryRun) {
      console.log("\n🔵 DRY RUN — skipping Instagram post");
      logPost({ type: "dry_run", topic, category, hook: content.hook, captionLength: fullCaption.length, imagePath });
      return { success: true, dryRun: true, topic, content };
    }

    // Step 5: Post to Instagram
    console.log("\n📤 Posting to Instagram...");
    const result = await postToInstagram(imagePath, fullCaption);

    logPost({
      type: result.success ? "success" : "failed",
      topic, category,
      hook: content.hook,
      postId: result.postId,
      imageUrl: result.imageUrl,
      error: result.error,
    });

    return { success: result.success, topic, category, postId: result.postId };
  } catch (err) {
    console.error(`\n❌ Pipeline error: ${err.message}`);
    logPost({ type: "error", error: err.message });
    return { success: false, error: err.message };
  } finally {
    if (imagePath) cleanupImage(imagePath);
  }
}

// ─── PEAK-HOUR SCHEDULE (IST) ─────────────────────────────────────────────────
// IST = UTC+5:30
// Peak:     7-9am, 12-2pm, 7-11pm → post every 30 min
// Off-peak: 9am-12pm, 2-7pm       → post every 60 min
// Total: ~24 posts/day (Instagram API max is 25)
const POST_SCHEDULE = [
  // ── MORNING PEAK (7:00–9:00 AM IST = 01:30–03:30 UTC) ──
  { cron: "30 1 * * *",  label: "7:00 AM IST  🔥 peak" },
  { cron: "0  2 * * *",  label: "7:30 AM IST  🔥 peak" },
  { cron: "30 2 * * *",  label: "8:00 AM IST  🔥 peak" },
  { cron: "0  3 * * *",  label: "8:30 AM IST  🔥 peak" },
  // ── OFF-PEAK (9:00 AM–12:00 PM IST = 03:30–06:30 UTC) ──
  { cron: "30 3 * * *",  label: "9:00 AM IST" },
  { cron: "30 4 * * *",  label: "10:00 AM IST" },
  { cron: "30 5 * * *",  label: "11:00 AM IST" },
  // ── LUNCH PEAK (12:00–2:00 PM IST = 06:30–08:30 UTC) ──
  { cron: "30 6 * * *",  label: "12:00 PM IST 🔥 peak" },
  { cron: "0  7 * * *",  label: "12:30 PM IST 🔥 peak" },
  { cron: "30 7 * * *",  label: "1:00 PM IST  🔥 peak" },
  { cron: "0  8 * * *",  label: "1:30 PM IST  🔥 peak" },
  // ── OFF-PEAK (2:00–7:00 PM IST = 08:30–13:30 UTC) ──
  { cron: "30 8 * * *",  label: "2:00 PM IST" },
  { cron: "30 9 * * *",  label: "3:00 PM IST" },
  { cron: "30 10 * * *", label: "4:00 PM IST" },
  { cron: "30 11 * * *", label: "5:00 PM IST" },
  { cron: "30 12 * * *", label: "6:00 PM IST" },
  // ── EVENING PEAK (7:00–11:00 PM IST = 13:30–17:30 UTC) ──
  { cron: "30 13 * * *", label: "7:00 PM IST  🔥 peak" },
  { cron: "0  14 * * *", label: "7:30 PM IST  🔥 peak" },
  { cron: "30 14 * * *", label: "8:00 PM IST  🔥 peak" },
  { cron: "0  15 * * *", label: "8:30 PM IST  🔥 peak" },
  { cron: "30 15 * * *", label: "9:00 PM IST  🔥 peak" },
  { cron: "0  16 * * *", label: "9:30 PM IST  🔥 peak" },
  { cron: "30 16 * * *", label: "10:00 PM IST 🔥 peak" },
  { cron: "0  17 * * *", label: "10:30 PM IST 🔥 peak" },
];

// Growth engine: every 60 min during active hours (10 cycles/day)
const GROWTH_SCHEDULES = [
  "0  2 * * *",  // 7:30 AM IST
  "0  4 * * *",  // 9:30 AM IST
  "0  6 * * *",  // 11:30 AM IST
  "0  8 * * *",  // 1:30 PM IST
  "0  10 * * *", // 3:30 PM IST
  "0  12 * * *", // 5:30 PM IST
  "0  13 * * *", // 6:30 PM IST
  "0  14 * * *", // 7:30 PM IST
  "0  15 * * *", // 8:30 PM IST (peak — max follows)
  "0  16 * * *", // 9:30 PM IST (peak — max follows)
];

function startScheduler() {
  console.log("\n🗓️  PEAK-OPTIMISED SCHEDULER ACTIVE — 24 posts/day");
  console.log("─".repeat(60));

  POST_SCHEDULE.forEach(({ cron: cronExpr, label }) => {
    console.log(`   ⏰ ${label}`);
    cron.schedule(cronExpr, () => {
      console.log(`\n⏰ Scheduled trigger: ${label}`);
      runPostPipeline();
    }, { timezone: "UTC" });
  });

  console.log("─".repeat(60));
  console.log(`   📊 24 posts/day — 168/week — ~720/month`);
  console.log(`   🔥 Peak hours (7-9am, 12-2pm, 7-11pm) → post every 30 min`);
  console.log(`   🌐 9-layer image fallback — SVG canvas as final guarantee`);

  // Growth engine schedule
  if (process.env.IG_USERNAME && process.env.IG_PASSWORD) {
    console.log("\n🚀 GROWTH ENGINE SCHEDULER ACTIVE");
    GROWTH_SCHEDULES.forEach((cronExpr) => {
      cron.schedule(cronExpr, () => {
        console.log("\n🔄 Running growth cycle...");
        runGrowthCycle().catch((e) => console.error("Growth cycle error:", e.message));
      }, { timezone: "UTC" });
    });
    console.log("   ✅ Growth cycles: 10x per day");
    console.log("   📈 Follow 150/day | Like 400/day | Comment 40/day");
  } else {
    console.log("\n⚠️  Growth engine disabled — add IG_USERNAME + IG_PASSWORD to env vars");
  }

  // Token auto-refresh (1st & 16th of each month)
  scheduleTokenRefresh();

  console.log("─".repeat(60));
}

module.exports = { runPostPipeline, startScheduler, loadLog };
