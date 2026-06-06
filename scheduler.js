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
    imagePath = await smartGenerateImage(content.image_prompt, safeFilename, { topic, hook: content.hook, category });

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

// Posting cadence is random (10–30 min) — see scheduleNextPost() below.

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

// ─── RANDOM-INTERVAL POST TRIGGER (10–30 min, active hours only) ──────────────
// Posts at a fresh random gap each time so the cadence looks human, not robotic.
const POST_MIN_MINUTES = Number(process.env.POST_MIN_MINUTES) || 10;
const POST_MAX_MINUTES = Number(process.env.POST_MAX_MINUTES) || 30;
const ACTIVE_START_IST = Number(process.env.ACTIVE_START_IST) || 7;   // 7 AM IST
const ACTIVE_END_IST   = Number(process.env.ACTIVE_END_IST)   || 23;  // 11 PM IST

function istHour() {
  return Number(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata", hour: "2-digit", hour12: false }));
}

function scheduleNextPost() {
  const minutes = POST_MIN_MINUTES + Math.random() * (POST_MAX_MINUTES - POST_MIN_MINUTES);
  const ms = Math.round(minutes * 60 * 1000);
  const fireAt = new Date(Date.now() + ms).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" });
  console.log(`   ⏰ Next post in ${minutes.toFixed(1)} min (~${fireAt} IST)`);

  setTimeout(async () => {
    const h = istHour();
    if (h >= ACTIVE_START_IST && h < ACTIVE_END_IST) {
      console.log(`\n⏰ Random trigger fired (${h}:00 IST active window)`);
      try { await runPostPipeline(); } catch (e) { console.error("Post error:", e.message); }
    } else {
      console.log(`\n😴 ${h}:00 IST — off-hours, skipping post`);
    }
    scheduleNextPost(); // reschedule with a new random gap
  }, ms);
}

function startScheduler() {
  console.log(`\n🗓️  RANDOM-INTERVAL SCHEDULER ACTIVE — every ${POST_MIN_MINUTES}-${POST_MAX_MINUTES} min`);
  console.log("─".repeat(60));

  scheduleNextPost();

  const avgGap = (POST_MIN_MINUTES + POST_MAX_MINUTES) / 2;
  const perDay = Math.round(((ACTIVE_END_IST - ACTIVE_START_IST) * 60) / avgGap);
  console.log("─".repeat(60));
  console.log(`   📊 ~${perDay} posts/day (active ${ACTIVE_START_IST}:00–${ACTIVE_END_IST}:00 IST)`);
  console.log(`   🎲 Randomised gaps so cadence looks human`);
  console.log(`   🌐 Free photo sources (Wikimedia/Openverse) + branded compositing + SVG fallback`);

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
