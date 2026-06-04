
require("./dns-fix");
const axios = require("axios");
const fs = require("fs");
const path = require("path");

// ─── DAILY ACTION LIMITS ──────────────────────────────────────────────────────
// Instagram bans accounts for rapid automation. These limits + human-like delays
// are the MAXIMUM you can do without triggering detection.
const LIMITS = {
  follows: 150,    // 7 cycles × ~20/cycle — spaced 3min apart
  unfollows: 100,
  likes: 400,      // 7 cycles × ~55/cycle — spaced 45s apart
  comments: 40,    // 7 cycles × ~5/cycle — spaced 8min apart
  dms: 25,
};

// ─── TARGET HASHTAGS ──────────────────────────────────────────────────────────
const TARGET_HASHTAGS = [
  "tamilnadu", "tamil", "tamilculture", "tamizhan", "tamilhistory",
  "tamiltemples", "chennaidiaries", "tamilfood", "tamilfestival",
  "tamilnadu_ig", "incredibletamilnadu", "tamilpride",
  "southindia", "dravidian", "cholaempire", "tamildiaspora",
  "tamilachievements", "tamilviral", "tamilnewgen", "tamilheritage",
];

// ─── COMMENT BANK ────────────────────────────────────────────────────────────
const COMMENTS = [
  "This is exactly what more people need to know! 🙏",
  "Tamil culture never fails to amaze me ❤️",
  "Sharing this with everyone I know! 🌟",
  "This is why we're so proud to be Tamil! 🏛️",
  "I never knew this — mind blown! 🤯",
  "Our history is so rich and beautiful 🌺",
  "Every Tamil needs to see this! ❤️🙏",
  "The world needs to know about Tamil civilisation 🌍",
  "This gave me chills! Proud Tamil 🦁",
  "Such an underrated part of world history! 📚",
  "Bookmark this — important piece of our heritage 🔖",
  "Teaching my kids this today! ❤️",
  "So proud of our Tamil ancestors! 🏆",
  "This is why Tamil culture is eternal 🕉️",
  "Amazing! More people should follow this page 🙌",
];

// ─── DM WELCOME MESSAGES ─────────────────────────────────────────────────────
const DM_WELCOME = [
  "🙏 Welcome to our Tamil culture family! We post daily about Tamil history, temples, food & achievements. Turn on notifications so you don't miss anything!",
  "Thank you for following! ❤️ TamilNadu Unfiltered posts amazing Tamil history facts daily. Stay tuned! 🏛️",
  "Vanakkam! 🙏 So glad you found us. We're on a mission to show the world how incredible Tamil civilisation is! 🌺",
];

// ─── LOGS ─────────────────────────────────────────────────────────────────────
const GROWTH_LOG = path.join(__dirname, "growth_log.json");
const FOLLOW_LOG = path.join(__dirname, "follow_log.json");

function loadGrowthLog() {
  try { return JSON.parse(fs.readFileSync(GROWTH_LOG, "utf8")); } catch { return []; }
}
function saveGrowthLog(log) {
  fs.writeFileSync(GROWTH_LOG, JSON.stringify(log.slice(0, 2000), null, 2));
}
function logAction(type, detail = "") {
  const log = loadGrowthLog();
  log.unshift({ type, detail, timestamp: new Date().toISOString() });
  saveGrowthLog(log);
}
function loadFollowLog() {
  try { return JSON.parse(fs.readFileSync(FOLLOW_LOG, "utf8")); } catch { return {}; }
}
function saveFollowLog(d) {
  fs.writeFileSync(FOLLOW_LOG, JSON.stringify(d, null, 2));
}
function todayCount(type) {
  const today = new Date().toISOString().split("T")[0];
  return loadGrowthLog().filter((e) => e.type === type && e.timestamp.startsWith(today)).length;
}

// ─── HTTP CLIENT (web session-based, no private-api library) ─────────────────
const IG_UA = "Instagram 295.0.0.32.109 Android (28/9; 420dpi; 1080x2220; OnePlus; ONEPLUS A6013; OnePlus6T; qcom; en_US; 497264312)";
const IG_APP_ID = "936619743392459";

function getHeaders() {
  const sessionId = decodeURIComponent(process.env.IG_SESSION_ID || "");
  const csrf = process.env.IG_CSRF_TOKEN || "";
  return {
    "User-Agent": IG_UA,
    Cookie: `sessionid=${sessionId}; csrftoken=${csrf}`,
    "X-CSRFToken": csrf,
    "X-IG-App-ID": IG_APP_ID,
    "X-IG-Capabilities": "3brTvwE=",
    "X-IG-Connection-Type": "WIFI",
  };
}

let _sessionVerified = false;

async function verifySession() {
  if (_sessionVerified) return true;
  if (!process.env.IG_SESSION_ID) return false;
  try {
    const r = await axios.get(
      "https://i.instagram.com/api/v1/accounts/current_user/?edit=true",
      { headers: getHeaders(), timeout: 10000 }
    );
    if (r.data?.user) {
      _sessionVerified = true;
      console.log(`✅ Growth engine active for @${r.data.user.username}`);
      return true;
    }
    return false;
  } catch (err) {
    if (err.response?.status === 400) {
      console.log("⚠️  Session expired — run: node get-session.js");
    } else {
      console.log("⚠️  Session check failed:", err.message);
    }
    return false;
  }
}

// ─── HUMAN-LIKE DELAY ────────────────────────────────────────────────────────
// Longer delays = undetected. Faster = session ban. Don't reduce these.
const delay = (min = 2000, max = 6000) =>
  new Promise((r) => setTimeout(r, min + Math.random() * (max - min)));

const delayFollow = () => delay(45000, 90000);   // 45-90s between follows
const delayLike   = () => delay(8000, 20000);    // 8-20s between likes
const delayComment = () => delay(180000, 360000); // 3-6min between comments

// ─── SEARCH POSTS BY HASHTAG ─────────────────────────────────────────────────
async function getHashtagPosts(hashtag) {
  try {
    const r = await axios.post(
      `https://i.instagram.com/api/v1/tags/${hashtag}/sections/`,
      `max_id=&page=1&_uuid=${Math.random().toString(36)}&tab=recent&include_persistent=0`,
      {
        headers: {
          ...getHeaders(),
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        },
        timeout: 12000,
      }
    );
    const sections = r.data?.sections || [];
    const posts = [];
    for (const section of sections) {
      const medias = section.layout_content?.medias || [];
      for (const m of medias) {
        if (m.media) posts.push(m.media);
      }
    }
    return posts;
  } catch {
    return [];
  }
}

// ─── FOLLOW USER ──────────────────────────────────────────────────────────────
// Returns: 'ok' | 'ratelimit' | 'session_expired' | 'error'
async function followUser(userId, username) {
  try {
    const r = await axios.post(
      `https://i.instagram.com/api/v1/friendships/create/${userId}/`,
      `_uuid=${Math.random().toString(36).slice(2)}&user_id=${userId}`,
      { headers: { ...getHeaders(), "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" }, timeout: 12000, validateStatus: () => true }
    );
    if (r.status === 200) { logAction("follow", `@${username}`); return "ok"; }
    if (r.status === 403 || r.status === 401) return "session_expired";
    if (r.status === 429 || r.data?.spam) { console.log("   ⚠️ Rate limit hit"); return "ratelimit"; }
    return "error";
  } catch { return "error"; }
}

// ─── LIKE POST ────────────────────────────────────────────────────────────────
async function likePost(mediaId) {
  try {
    const r = await axios.post(
      `https://i.instagram.com/api/v1/media/${mediaId}/like/`,
      `_uuid=${Math.random().toString(36).slice(2)}&media_id=${mediaId}&d=1`,
      { headers: { ...getHeaders(), "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" }, timeout: 12000, validateStatus: () => true }
    );
    if (r.status === 200) { logAction("like", `media:${mediaId}`); return "ok"; }
    if (r.status === 403 || r.status === 401) return "session_expired";
    if (r.status === 429) return "ratelimit";
    return "error";
  } catch { return "error"; }
}

// ─── COMMENT ON POST ─────────────────────────────────────────────────────────
async function commentOnPost(mediaId, username) {
  const text = COMMENTS[Math.floor(Math.random() * COMMENTS.length)];
  try {
    await axios.post(
      `https://i.instagram.com/api/v1/media/${mediaId}/comment/`,
      `comment_text=${encodeURIComponent(text)}&_uuid=${encodeURIComponent(Math.random().toString(36))}`,
      {
        headers: {
          ...getHeaders(),
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        },
        timeout: 10000,
      }
    );
    logAction("comment", `@${username}: "${text.slice(0, 40)}"`);
    return true;
  } catch {
    return false;
  }
}

// ─── FOLLOW FROM HASHTAG ──────────────────────────────────────────────────────
async function followFromHashtag(hashtag, count = 15) {
  const remaining = LIMITS.follows - todayCount("follow");
  if (remaining <= 0) { console.log("⏸️  Follow limit reached"); return 0; }

  const toFollow = Math.min(count, remaining);
  const followLog = loadFollowLog();
  const posts = await getHashtagPosts(hashtag);
  let followed = 0;

  console.log(`👤 Following up to ${toFollow} from #${hashtag} (${posts.length} posts found)`);

  for (const post of posts) {
    if (followed >= toFollow) break;
    const userId = String(post.user?.pk || post.user?.id);
    const username = post.user?.username || "unknown";
    if (!userId || followLog[userId]) continue;

    await delayFollow();  // 45-90s human-like pause
    const result = await followUser(userId, username);
    if (result === "ok") {
      followLog[userId] = { username, followedAt: new Date().toISOString() };
      followed++;
      console.log(`   ✅ Followed @${username} (${followed}/${toFollow})`);
    } else if (result === "session_expired") {
      console.log("   ⚠️ Session expired — run node get-session.js");
      break;
    } else if (result === "ratelimit") {
      console.log("   ⏸️ Rate limit — stopping follows for this cycle");
      break;
    }
  }

  saveFollowLog(followLog);
  return followed;
}

// ─── LIKE FROM HASHTAG ────────────────────────────────────────────────────────
async function likeFromHashtag(hashtag, count = 20) {
  const remaining = LIMITS.likes - todayCount("like");
  if (remaining <= 0) return 0;

  const toLike = Math.min(count, remaining);
  const posts = await getHashtagPosts(hashtag);
  if (posts.length === 0) return 0;

  let liked = 0;
  console.log(`❤️  Liking up to ${toLike} posts from #${hashtag} (${posts.length} found)`);

  for (const post of posts.slice(0, toLike)) {
    await delayLike();  // 8-20s human-like pause
    const mediaId = post.pk || post.id;
    if (!mediaId) continue;
    const result = await likePost(mediaId);
    if (result === "ok") {
      liked++;
      console.log(`   ✅ Liked @${post.user?.username} (${liked}/${toLike})`);
    } else if (result === "session_expired") {
      console.log("   ⚠️ Session expired during likes — run node get-session.js");
      break;
    } else if (result === "ratelimit") {
      console.log("   ⏸️ Rate limit — stopping likes");
      break;
    }
  }
  return liked;
}

// ─── COMMENT FROM HASHTAG ─────────────────────────────────────────────────────
async function commentFromHashtag(hashtag, count = 4) {
  const remaining = LIMITS.comments - todayCount("comment");
  if (remaining <= 0) return 0;

  const toComment = Math.min(count, remaining);
  const posts = await getHashtagPosts(hashtag);
  if (posts.length === 0) return 0;

  const active = posts.filter((p) => (p.like_count || 0) > 20).slice(0, toComment * 3);
  let commented = 0;
  console.log(`💬 Commenting on up to ${toComment} posts from #${hashtag}`);

  for (const post of active) {
    if (commented >= toComment) break;
    await delay(15000, 30000);
    const mediaId = post.pk || post.id;
    if (!mediaId) continue;
    const ok = await commentOnPost(mediaId, post.user?.username);
    if (ok) {
      commented++;
      console.log(`   ✅ Commented on @${post.user?.username} (${commented}/${toComment})`);
    }
  }
  return commented;
}

// ─── UNFOLLOW NON-FOLLOWERS (after 4 days) ────────────────────────────────────
async function unfollowNonFollowers() {
  const remaining = LIMITS.unfollows - todayCount("unfollow");
  if (remaining <= 0) return 0;

  const followLog = loadFollowLog();
  const fourDaysAgo = Date.now() - 4 * 24 * 60 * 60 * 1000;
  const stale = Object.entries(followLog)
    .filter(([, d]) => new Date(d.followedAt).getTime() < fourDaysAgo && !d.unfollowedAt)
    .slice(0, remaining);

  let unfollowed = 0;
  for (const [userId, data] of stale) {
    await delay(4000, 8000);
    try {
      await axios.post(
        `https://i.instagram.com/api/v1/friendships/destroy/${userId}/`,
        `_uuid=${encodeURIComponent(Math.random().toString(36))}&user_id=${userId}`,
        {
          headers: {
            ...getHeaders(),
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
          },
          timeout: 10000,
        }
      );
      followLog[userId].unfollowedAt = new Date().toISOString();
      logAction("unfollow", `@${data.username}`);
      unfollowed++;
      console.log(`   🔄 Unfollowed @${data.username}`);
    } catch {}
  }

  saveFollowLog(followLog);
  return unfollowed;
}

// ─── FULL GROWTH CYCLE ────────────────────────────────────────────────────────
async function runGrowthCycle() {
  const ok = await verifySession();
  if (!ok) {
    console.log("⚠️  Growth engine disabled — run: node get-session.js");
    return;
  }

  console.log("\n🚀 GROWTH ENGINE CYCLE");
  console.log("─".repeat(50));

  // Pick 5 random hashtags per cycle
  const tags = [...TARGET_HASHTAGS].sort(() => 0.5 - Math.random()).slice(0, 5);

  for (const tag of tags) {
    await followFromHashtag(tag, 12);     // 12 follows per hashtag
    await delay(5000, 10000);
    await likeFromHashtag(tag, 20);       // 20 likes per hashtag
    await delay(6000, 12000);
    if (Math.random() > 0.4) await commentFromHashtag(tag, 3);  // 3 comments, 60% chance
    await delay(8000, 15000);
  }

  const hour = new Date().getHours();
  if (hour >= 21) await unfollowNonFollowers();

  const s = getGrowthStats().today;
  console.log("─".repeat(50));
  console.log(`✅ Cycle done | Follows: ${s.follows} | Likes: ${s.likes} | Comments: ${s.comments}`);
}

// ─── STATS ────────────────────────────────────────────────────────────────────
function getGrowthStats() {
  const today = new Date().toISOString().split("T")[0];
  const log = loadGrowthLog();
  const todayLog = log.filter((e) => e.timestamp.startsWith(today));
  const count = (type) => todayLog.filter((e) => e.type === type).length;
  const followLog = loadFollowLog();

  return {
    today: {
      follows: count("follow"),
      unfollows: count("unfollow"),
      likes: count("like"),
      comments: count("comment"),
      dms: count("dm"),
    },
    limits: LIMITS,
    allTime: {
      totalFollowed: Object.keys(followLog).length,
      totalUnfollowed: Object.values(followLog).filter((d) => d.unfollowedAt).length,
      totalActions: log.length,
    },
    recentActions: log.slice(0, 20),
    engineEnabled: !!process.env.IG_SESSION_ID,
  };
}

module.exports = {
  runGrowthCycle,
  getGrowthStats,
  verifySession,
  followFromHashtag,
  likeFromHashtag,
  commentFromHashtag,
  unfollowNonFollowers,
};
