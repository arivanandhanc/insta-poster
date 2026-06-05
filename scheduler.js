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
    imagePath = await smartGenerateImage(content.image_prompt, safeFilename);

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

// ─── SCHEDULE: EVERY HOUR 7am–11pm IST ───────────────────────────────────────
// IST = UTC+5:30. Hours in UTC: 7am IST = 01:30 UTC, 11pm IST = 17:30 UTC
// Cron every hour on the half, from 01:30 to 17:30 UTC = 16 posts/day
const HOURLY_SCHEDULE = [
  { cron: "30 1 * * *",  label: "7:00 AM IST" },
  { cron: "30 2 * * *",  label: "8:00 AM IST" },
  { cron: "30 3 * * *",  label: "9:00 AM IST" },
  { cron: "30 4 * * *",  label: "10:00 AM IST" },
  { cron: "30 5 * * *",  label: "11:00 AM IST" },
  { cron: "30 6 * * *",  label: "12:00 PM IST" },
  { cron: "30 7 * * *",  label: "1:00 PM IST" },
  { cron: "30 8 * * *",  label: "2:00 PM IST" },
  { cron: "30 9 * * *",  label: "3:00 PM IST" },
  { cron: "30 10 * * *", label: "4:00 PM IST" },
  { cron: "30 11 * * *", label: "5:00 PM IST" },
  { cron: "30 12 * * *", label: "6:00 PM IST" },
  { cron: "30 13 * * *", label: "7:00 PM IST" },
  { cron: "30 14 * * *", label: "8:00 PM IST" },
  { cron: "30 15 * * *", label: "9:00 PM IST" },
  { cron: "30 16 * * *", label: "10:00 PM IST" },
  { cron: "30 17 * * *", label: "11:00 PM IST" },
];

// Growth engine runs every 90 minutes during active hours
const GROWTH_SCHEDULES = [
  "0 2 * * *",   // 7:30 AM IST
  "30 4 * * *",  // 10:00 AM IST
  "0 7 * * *",   // 12:30 PM IST
  "30 9 * * *",  // 3:00 PM IST
  "0 12 * * *",  // 5:30 PM IST
  "30 14 * * *", // 8:00 PM IST
  "0 17 * * *",  // 10:30 PM IST
];

function startScheduler() {
  console.log("\n🗓️  HOURLY POST SCHEDULER ACTIVE — 17 posts/day");
  console.log("─".repeat(60));

  HOURLY_SCHEDULE.forEach(({ cron: cronExpr, label }) => {
    console.log(`   ⏰ ${label}`);
    cron.schedule(cronExpr, () => {
      console.log(`\n⏰ Scheduled trigger: ${label}`);
      runPostPipeline();
    }, { timezone: "UTC" });
  });

  console.log("─".repeat(60));
  console.log(`   📊 17 posts/day — 119/week — ~510/month`);
  console.log(`   🌐 ~1000 unique topics — AI generates more when needed`);

  // Growth engine schedule
  if (process.env.IG_USERNAME && process.env.IG_PASSWORD) {
    console.log("\n🚀 GROWTH ENGINE SCHEDULER ACTIVE");
    GROWTH_SCHEDULES.forEach((cronExpr) => {
      cron.schedule(cronExpr, () => {
        console.log("\n🔄 Running growth cycle...");
        runGrowthCycle().catch((e) => console.error("Growth cycle error:", e.message));
      }, { timezone: "UTC" });
    });
    console.log("   ✅ Growth cycles: 7x per day");
    console.log("   📈 Follow 120/day | Like 250/day | Comment 30/day | DM 20/day");
  } else {
    console.log("\n⚠️  Growth engine disabled — add IG_USERNAME + IG_PASSWORD to env vars");
  }

  // Token auto-refresh (1st & 16th of each month)
  scheduleTokenRefresh();

  console.log("─".repeat(60));
}

module.exports = { runPostPipeline, startScheduler, loadLog };
