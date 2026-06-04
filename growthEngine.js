require("./dns-fix");
const { IgApiClient } = require("instagram-private-api");
const fs = require("fs");
const path = require("path");

// ─── DAILY ACTION LIMITS (safe for account health) ────────────────────────────
const LIMITS = {
  follows: 120,
  unfollows: 80,
  likes: 250,
  comments: 30,
  dms: 20,
  storyViews: 200,
};

// ─── TARGET HASHTAGS (Tamil diaspora + culture audience) ─────────────────────
const TARGET_HASHTAGS = [
  "tamilnadu", "tamil", "tamilculture", "tamizhan", "tamilhistory",
  "tamiltemples", "chennaidiaries", "tamilfood", "tamilfestival",
  "tamilsangam", "tamilnadu_ig", "incredibletamilnadu", "tamilpride",
  "southindia", "tamilheritagee", "dravidian", "cholaempire",
  "tamilachtm", "tamilunitedd", "tamilnewgen",
];

// ─── COMMENT BANK (varied, authentic-feeling) ────────────────────────────────
const COMMENTS = [
  "This is exactly what more people need to know! 🙏",
  "Tamil culture never fails to amaze me ❤️",
  "Sharing this with everyone I know! 🌟",
  "This is why we're so proud to be Tamil! 🏛️",
  "I never knew this — mind blown! 🤯",
  "Our history is so rich and beautiful 🌺",
  "Every Tamil needs to see this! ❤️🙏",
  "Incredible! The world needs to know about Tamil civilisation 🌍",
  "This gave me chills! Proud Tamil 🦁",
  "Such an underrated part of world history! 📚",
  "Bookmark this — important piece of our heritage 🔖",
  "Teaching my kids this today! ❤️",
  "So proud of our Tamil ancestors! 🏆",
  "This is why Tamil culture is eternal 🕉️",
  "Amazing facts! More people should follow this page 🙌",
];

// ─── DM TEMPLATES (welcome + promo) ──────────────────────────────────────────
const DM_WELCOME = [
  "🙏 Welcome to our Tamil culture family! We post daily about Tamil history, temples, food & achievements. Turn on notifications so you don't miss anything!",
  "Thank you for following! ❤️ TamilNadu Unfiltered posts amazing Tamil history facts daily. You'll love what we have coming up — stay tuned! 🏛️",
  "Vanakkam! 🙏 So glad you found us. We're on a mission to show the world how incredible Tamil civilisation is. Welcome to the family! 🌺",
];

// ─── ACTION LOG ───────────────────────────────────────────────────────────────
const GROWTH_LOG_FILE = path.join(__dirname, "growth_log.json");
const FOLLOW_LOG_FILE = path.join(__dirname, "follow_log.json");

function loadGrowthLog() {
  if (!fs.existsSync(GROWTH_LOG_FILE)) return [];
  try { return JSON.parse(fs.readFileSync(GROWTH_LOG_FILE, "utf8")); } catch { return []; }
}

function saveGrowthLog(log) {
  fs.writeFileSync(GROWTH_LOG_FILE, JSON.stringify(log.slice(0, 2000), null, 2));
}

function logAction(type, detail = "") {
  const log = loadGrowthLog();
  log.unshift({ type, detail, timestamp: new Date().toISOString() });
  saveGrowthLog(log);
}

function loadFollowLog() {
  if (!fs.existsSync(FOLLOW_LOG_FILE)) return {};
  try { return JSON.parse(fs.readFileSync(FOLLOW_LOG_FILE, "utf8")); } catch { return {}; }
}

function saveFollowLog(data) {
  fs.writeFileSync(FOLLOW_LOG_FILE, JSON.stringify(data, null, 2));
}

// Count actions done today
function todayCount(type) {
  const log = loadGrowthLog();
  const today = new Date().toISOString().split("T")[0];
  return log.filter((e) => e.type === type && e.timestamp.startsWith(today)).length;
}

// ─── INSTAGRAM PRIVATE API CLIENT ────────────────────────────────────────────
let _ig = null;
let _igReady = false;

async function getIg() {
  if (_igReady) return _ig;
  if (!process.env.IG_USERNAME || !process.env.IG_PASSWORD) return null;

  _ig = new IgApiClient();
  _ig.state.generateDevice(process.env.IG_USERNAME);

  // Load saved session if exists
  const sessionFile = path.join(__dirname, "ig_session.json");
  if (fs.existsSync(sessionFile)) {
    try {
      await _ig.importState(JSON.parse(fs.readFileSync(sessionFile, "utf8")));
      _igReady = true;
      console.log("✅ Growth engine: session restored");
      return _ig;
    } catch { /* session expired, re-login */ }
  }

  try {
    await _ig.account.login(process.env.IG_USERNAME, process.env.IG_PASSWORD);
    fs.writeFileSync(sessionFile, JSON.stringify(await _ig.exportState()));
    _igReady = true;
    console.log("✅ Growth engine: logged in");
  } catch (err) {
    console.error("❌ Growth engine login failed:", err.message);
    _ig = null;
  }
  return _ig;
}

// ─── HUMAN-LIKE DELAY ─────────────────────────────────────────────────────────
function delay(minMs = 2000, maxMs = 6000) {
  const ms = minMs + Math.random() * (maxMs - minMs);
  return new Promise((r) => setTimeout(r, ms));
}

// ─── FOLLOW USERS FROM TARGET HASHTAG ────────────────────────────────────────
async function followFromHashtag(hashtag, count = 15) {
  const ig = await getIg();
  if (!ig) return 0;

  const remaining = LIMITS.follows - todayCount("follow");
  if (remaining <= 0) {
    console.log("⏸️  Follow limit reached for today");
    return 0;
  }

  const toFollow = Math.min(count, remaining);
  let followed = 0;

  try {
    console.log(`👤 Following ${toFollow} users from #${hashtag}`);
    const feed = ig.feed.tags(hashtag);
    const posts = await feed.items();
    const followLog = loadFollowLog();

    for (const post of posts.slice(0, toFollow * 2)) {
      if (followed >= toFollow) break;
      const userId = post.user.pk.toString();
      if (followLog[userId]) continue; // already followed

      await delay(3000, 7000);
      try {
        await ig.friendship.create(post.user.pk);
        followLog[userId] = { username: post.user.username, followedAt: new Date().toISOString() };
        logAction("follow", `@${post.user.username}`);
        followed++;
        console.log(`   ✅ Followed @${post.user.username} (${followed}/${toFollow})`);
      } catch (e) {
        if (e.message?.includes("feedback_required")) {
          console.log("   ⚠️ Instagram rate limit — pausing follows for 10min");
          await delay(600000, 600000);
          break;
        }
      }
    }
    saveFollowLog(followLog);
  } catch (err) {
    console.error("❌ Follow error:", err.message);
  }
  return followed;
}

// ─── LIKE POSTS ON TARGET HASHTAG ────────────────────────────────────────────
async function likeFromHashtag(hashtag, count = 20) {
  const ig = await getIg();
  if (!ig) return 0;

  const remaining = LIMITS.likes - todayCount("like");
  if (remaining <= 0) return 0;

  const toLike = Math.min(count, remaining);
  let liked = 0;

  try {
    const feed = ig.feed.tags(hashtag);
    const posts = await feed.items();
    console.log(`❤️  Liking ${toLike} posts from #${hashtag}`);

    for (const post of posts.slice(0, toLike)) {
      await delay(2000, 5000);
      try {
        await ig.media.like({ mediaId: post.pk, moduleInfo: { module_name: "feed_timeline" } });
        logAction("like", `#${hashtag}`);
        liked++;
      } catch (e) {
        if (e.message?.includes("feedback_required")) {
          await delay(300000, 300000);
          break;
        }
      }
    }
    console.log(`   ✅ Liked ${liked} posts`);
  } catch (err) {
    console.error("❌ Like error:", err.message);
  }
  return liked;
}

// ─── COMMENT ON POSTS ─────────────────────────────────────────────────────────
async function commentFromHashtag(hashtag, count = 5) {
  const ig = await getIg();
  if (!ig) return 0;

  const remaining = LIMITS.comments - todayCount("comment");
  if (remaining <= 0) return 0;

  const toComment = Math.min(count, remaining);
  let commented = 0;

  try {
    const feed = ig.feed.tags(hashtag);
    const posts = await feed.items();
    const recentPosts = posts.filter((p) => p.like_count > 50).slice(0, toComment * 2);
    console.log(`💬 Commenting on ${toComment} posts from #${hashtag}`);

    for (const post of recentPosts) {
      if (commented >= toComment) break;
      const comment = COMMENTS[Math.floor(Math.random() * COMMENTS.length)];
      await delay(10000, 20000);
      try {
        await ig.media.comment({ mediaId: post.pk, text: comment });
        logAction("comment", `#${hashtag}: "${comment.slice(0, 40)}"`);
        commented++;
        console.log(`   ✅ Commented on post by @${post.user.username}`);
      } catch (e) {
        if (e.message?.includes("feedback_required")) {
          await delay(600000, 600000);
          break;
        }
      }
    }
  } catch (err) {
    console.error("❌ Comment error:", err.message);
  }
  return commented;
}

// ─── DM NEW FOLLOWERS ─────────────────────────────────────────────────────────
async function dmNewFollowers() {
  const ig = await getIg();
  if (!ig) return 0;

  const remaining = LIMITS.dms - todayCount("dm");
  if (remaining <= 0) return 0;

  let sent = 0;
  try {
    const followersResponse = await ig.feed.accountFollowers().items();
    const followLog = loadFollowLog();
    const dmed = new Set(
      loadGrowthLog()
        .filter((e) => e.type === "dm")
        .map((e) => e.detail)
    );

    console.log(`💬 Checking new followers for DMs`);

    for (const follower of followersResponse.slice(0, 30)) {
      if (sent >= remaining) break;
      const username = follower.username;
      if (dmed.has(username)) continue;

      await delay(5000, 12000);
      const msg = DM_WELCOME[Math.floor(Math.random() * DM_WELCOME.length)];

      try {
        const thread = ig.entity.directThread([follower.pk.toString()]);
        await thread.broadcastText(msg);
        logAction("dm", username);
        sent++;
        console.log(`   ✅ DM sent to @${username}`);
      } catch (e) {
        console.log(`   ⚠️ DM failed for @${username}: ${e.message}`);
      }
    }
  } catch (err) {
    console.error("❌ DM error:", err.message);
  }
  return sent;
}

// ─── UNFOLLOW NON-FOLLOWERS (after 4 days) ────────────────────────────────────
async function unfollowNonFollowers() {
  const ig = await getIg();
  if (!ig) return 0;

  const remaining = LIMITS.unfollows - todayCount("unfollow");
  if (remaining <= 0) return 0;

  let unfollowed = 0;
  const followLog = loadFollowLog();
  const fourDaysAgo = Date.now() - 4 * 24 * 60 * 60 * 1000;

  try {
    const followingFeed = ig.feed.accountFollowing();
    const following = await followingFeed.items();
    const followingIds = new Set(following.map((u) => u.pk.toString()));

    const toUnfollow = Object.entries(followLog)
      .filter(([, data]) => {
        const followedAt = new Date(data.followedAt).getTime();
        return followedAt < fourDaysAgo && !data.unfollowedAt;
      })
      .slice(0, remaining);

    console.log(`🔄 Unfollowing ${toUnfollow.length} non-followers`);

    for (const [userId, data] of toUnfollow) {
      if (!followingIds.has(userId)) {
        followLog[userId].unfollowedAt = new Date().toISOString();
        continue;
      }
      await delay(3000, 7000);
      try {
        await ig.friendship.destroy(userId);
        followLog[userId].unfollowedAt = new Date().toISOString();
        logAction("unfollow", `@${data.username}`);
        unfollowed++;
      } catch (e) {
        if (e.message?.includes("feedback_required")) {
          await delay(300000, 300000);
          break;
        }
      }
    }
    saveFollowLog(followLog);
    console.log(`   ✅ Unfollowed ${unfollowed}`);
  } catch (err) {
    console.error("❌ Unfollow error:", err.message);
  }
  return unfollowed;
}

// ─── FULL DAILY GROWTH CYCLE ─────────────────────────────────────────────────
async function runGrowthCycle() {
  const ig = await getIg();
  if (!ig) {
    console.log("⚠️  Growth engine disabled — set IG_USERNAME + IG_PASSWORD in env vars");
    return;
  }

  console.log("\n🚀 GROWTH ENGINE CYCLE STARTED");
  console.log("─".repeat(50));

  // Pick random hashtags for this cycle
  const tags = [...TARGET_HASHTAGS].sort(() => 0.5 - Math.random()).slice(0, 4);

  for (const tag of tags) {
    await followFromHashtag(tag, 8);
    await delay(5000, 10000);
    await likeFromHashtag(tag, 15);
    await delay(8000, 15000);
    if (Math.random() > 0.5) await commentFromHashtag(tag, 2);
    await delay(10000, 20000);
  }

  await dmNewFollowers();
  await delay(5000, 10000);

  // Unfollow cycle (once per day only)
  const hour = new Date().getHours();
  if (hour === 22) await unfollowNonFollowers();

  console.log("─".repeat(50));
  console.log(`✅ Growth cycle complete | Follows today: ${todayCount("follow")} | Likes: ${todayCount("like")} | Comments: ${todayCount("comment")} | DMs: ${todayCount("dm")}`);
}

// ─── STATS ────────────────────────────────────────────────────────────────────
function getGrowthStats() {
  const today = new Date().toISOString().split("T")[0];
  const log = loadGrowthLog();
  const todayLog = log.filter((e) => e.timestamp.startsWith(today));

  const countType = (type) => todayLog.filter((e) => e.type === type).length;
  const followLog = loadFollowLog();
  const totalFollowed = Object.keys(followLog).length;
  const unfollowed = Object.values(followLog).filter((d) => d.unfollowedAt).length;

  return {
    today: {
      follows: countType("follow"),
      unfollows: countType("unfollow"),
      likes: countType("like"),
      comments: countType("comment"),
      dms: countType("dm"),
    },
    limits: LIMITS,
    allTime: {
      totalFollowed,
      totalUnfollowed: unfollowed,
      totalActions: log.length,
    },
    recentActions: log.slice(0, 20),
    engineEnabled: !!(process.env.IG_USERNAME && process.env.IG_PASSWORD),
  };
}

module.exports = { runGrowthCycle, getGrowthStats, followFromHashtag, likeFromHashtag, commentFromHashtag, dmNewFollowers };
