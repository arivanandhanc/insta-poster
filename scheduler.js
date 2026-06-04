const cron = require("node-cron");
const fs = require("fs");
const path = require("path");
const { generateCaption, getNextTopic } = require("./contentGenerator");
const { smartGenerateImage, cleanupImage } = require("./imageGenerator");
const { postToInstagram } = require("./instagramPoster");

// ─── POST LOG ─────────────────────────────────────────────────────────────────

const LOG_FILE = path.join(__dirname, "post_log.json");

function loadLog() {
  if (!fs.existsSync(LOG_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(LOG_FILE, "utf8"));
  } catch {
    return [];
  }
}

function saveLog(log) {
  fs.writeFileSync(LOG_FILE, JSON.stringify(log, null, 2));
}

function logPost(entry) {
  const log = loadLog();
  log.unshift({ ...entry, timestamp: new Date().toISOString() });
  // Keep last 500 entries
  saveLog(log.slice(0, 500));
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
    const { topic, category } = forcedTopic
      ? { topic: forcedTopic, category: forcedCategory || "Tamil Culture" }
      : getNextTopic();

    console.log(`\n📌 Topic: ${topic}`);
    console.log(`   Category: ${category}`);

    // Step 2: Generate content with Groq
    console.log("\n✍️  Generating content with Groq...");
    const content = await generateCaption(topic, category);
    console.log(`   ✅ Caption generated (${content.body?.length || 0} chars)`);
    console.log(`   Hook: "${content.hook}"`);

    // Step 3: Build full caption
    const fullCaption = `${content.hook}\n\n${content.body}\n\n${content.cta}\n\n${content.hashtags}`;

    // Step 4: Generate image with HF/Pollinations
    const timestamp = Date.now();
    const safeFilename = topic.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 40) + `_${timestamp}`;

    console.log("\n🎨 Generating image...");
    imagePath = await smartGenerateImage(content.image_prompt, safeFilename);

    if (!imagePath) {
      throw new Error("Image generation failed — no image to post");
    }

    // Step 5: Log content details
    console.log("\n📋 Content Preview:");
    console.log(`   Hook: ${content.hook}`);
    console.log(`   Caption length: ${fullCaption.length} chars`);
    console.log(`   Image: ${imagePath}`);

    if (dryRun) {
      console.log("\n🔵 DRY RUN — skipping Instagram post");
      logPost({
        type: "dry_run",
        topic,
        category,
        hook: content.hook,
        captionLength: fullCaption.length,
        imagePath,
      });
      return { success: true, dryRun: true, topic, content };
    }

    // Step 6: Post to Instagram
    console.log("\n📤 Posting to Instagram...");
    const result = await postToInstagram(imagePath, fullCaption);

    // Step 7: Log result
    logPost({
      type: result.success ? "success" : "failed",
      topic,
      category,
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
    // Always clean up temp image
    if (imagePath) cleanupImage(imagePath);
  }
}

// ─── POSTING SCHEDULE ─────────────────────────────────────────────────────────
// IST times converted to UTC (IST = UTC+5:30)
// 7:00 AM IST = 1:30 AM UTC
// 12:00 PM IST = 6:30 AM UTC
// 3:00 PM IST = 9:30 AM UTC
// 6:00 PM IST = 12:30 PM UTC
// 9:00 PM IST = 3:30 PM UTC

const SCHEDULE = [
  { cron: "30 1 * * *",  label: "7:00 AM IST  — Morning post (peak Tamil audience)" },
  { cron: "30 6 * * *",  label: "12:00 PM IST — Lunch scroll post" },
  { cron: "30 9 * * *",  label: "3:00 PM IST  — Afternoon engagement post" },
  { cron: "30 12 * * *", label: "6:00 PM IST  — Evening prime time post" },
  { cron: "30 15 * * *", label: "9:00 PM IST  — Night engagement post" },
];

function startScheduler() {
  console.log("\n🗓️  TAMIL BRAND SCHEDULER ACTIVE");
  console.log("─".repeat(60));
  SCHEDULE.forEach(({ cron: cronExpr, label }) => {
    console.log(`   ⏰ ${label}`);
    cron.schedule(cronExpr, () => {
      console.log(`\n⏰ Scheduled trigger: ${label}`);
      runPostPipeline();
    }, { timezone: "UTC" });
  });
  console.log("─".repeat(60));
  console.log(`   📊 5 posts per day — 35 posts per week — 150 posts/month`);
  console.log(`   📈 All categories rotate automatically`);
}

module.exports = { runPostPipeline, startScheduler, loadLog };
