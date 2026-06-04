require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const { runPostPipeline, startScheduler, loadLog } = require("./scheduler");
const { generateCaption, generateReelScript, generateCarousel, generateBulkIdeas, getNextTopic, getRandomTopic, CONTENT_TOPICS, ALL_TOPICS } = require("./contentGenerator");
const { getAccountStats, getPostInsights } = require("./instagramPoster");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("public"));
app.use("/images", express.static(path.join(__dirname, "temp_images")));

// ─── DASHBOARD HTML ───────────────────────────────────────────────────────────
app.get("/", (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>TamilNadu Unfiltered — Control Panel</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;600;700&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Space Grotesk', sans-serif; background: #0a0a0a; color: #f0f0f0; min-height: 100vh; }
  .header { background: linear-gradient(135deg, #8B0000 0%, #CC4400 50%, #FF6B00 100%); padding: 2rem; text-align: center; }
  .header h1 { font-size: 2rem; font-weight: 700; letter-spacing: -0.5px; }
  .header p { opacity: 0.85; margin-top: 0.5rem; }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1.5rem; padding: 2rem; max-width: 1400px; margin: 0 auto; }
  .card { background: #141414; border: 1px solid #2a2a2a; border-radius: 12px; padding: 1.5rem; }
  .card h2 { font-size: 1rem; color: #FF6B00; margin-bottom: 1rem; text-transform: uppercase; letter-spacing: 1px; }
  .btn { background: #FF6B00; color: white; border: none; padding: 0.75rem 1.5rem; border-radius: 8px; cursor: pointer; font-family: inherit; font-weight: 600; width: 100%; margin-bottom: 0.75rem; font-size: 0.9rem; transition: background 0.2s; }
  .btn:hover { background: #e55d00; }
  .btn.secondary { background: #2a2a2a; }
  .btn.secondary:hover { background: #333; }
  .btn.danger { background: #8B0000; }
  .stat { display: flex; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px solid #1e1e1e; font-size: 0.9rem; }
  .stat-val { color: #FF6B00; font-weight: 600; }
  .log-entry { background: #1a1a1a; border-radius: 6px; padding: 0.75rem; margin-bottom: 0.5rem; font-size: 0.8rem; border-left: 3px solid #FF6B00; }
  .log-entry.failed { border-left-color: #8B0000; }
  .log-entry.dry_run { border-left-color: #444; }
  .output { background: #0f0f0f; border: 1px solid #2a2a2a; border-radius: 8px; padding: 1rem; margin-top: 1rem; font-size: 0.8rem; white-space: pre-wrap; max-height: 400px; overflow-y: auto; color: #aaa; display: none; }
  .badge { display: inline-block; background: #FF6B00; color: white; border-radius: 99px; padding: 0.1rem 0.6rem; font-size: 0.7rem; font-weight: 700; margin-left: 0.5rem; }
  select, input { background: #1a1a1a; border: 1px solid #2a2a2a; color: #f0f0f0; padding: 0.5rem; border-radius: 6px; width: 100%; margin-bottom: 0.75rem; font-family: inherit; }
  .status { text-align: center; padding: 0.5rem; border-radius: 6px; margin-top: 0.5rem; font-size: 0.85rem; }
  .status.ok { background: #0a2a0a; color: #4CAF50; }
  .status.warn { background: #2a1a0a; color: #FF9800; }
</style>
</head>
<body>

<div class="header">
  <h1>🏛️ TamilNadu Unfiltered</h1>
  <p>Instagram Content Automation Engine — Groq + Hugging Face</p>
</div>

<div class="grid">

  <!-- QUICK POST -->
  <div class="card">
    <h2>⚡ Quick Post</h2>
    <button class="btn" onclick="triggerPost(false)">🚀 Post to Instagram NOW</button>
    <button class="btn secondary" onclick="triggerPost(true)">🔵 Dry Run (no post)</button>
    <div id="post-output" class="output"></div>
  </div>

  <!-- CUSTOM TOPIC -->
  <div class="card">
    <h2>✍️ Custom Topic Post</h2>
    <select id="category-select">
      <option value="">Auto-select category</option>
      <option>Tamil History</option>
      <option>Tamil Temples</option>
      <option>Tamil Villages</option>
      <option>Tamil Food</option>
      <option>Tamil Festivals</option>
      <option>Tamil Literature</option>
      <option>Tamil Language</option>
      <option>Tamil Achievers</option>
      <option>Tamil Nadu Tourism</option>
    </select>
    <input type="text" id="custom-topic" placeholder="e.g. Chola Navy history" />
    <button class="btn" onclick="customPost(false)">🚀 Post Custom Topic</button>
    <button class="btn secondary" onclick="customPost(true)">🔵 Preview Only</button>
    <div id="custom-output" class="output"></div>
  </div>

  <!-- CONTENT PREVIEW -->
  <div class="card">
    <h2>👁️ Preview Content</h2>
    <select id="preview-category">
      <option value="">Any category</option>
      <option>Tamil History</option>
      <option>Tamil Temples</option>
      <option>Tamil Food</option>
      <option>Tamil Festivals</option>
      <option>Tamil Literature</option>
    </select>
    <button class="btn secondary" onclick="previewCaption()">📝 Preview Caption</button>
    <button class="btn secondary" onclick="previewReel()">🎬 Preview Reel Script</button>
    <button class="btn secondary" onclick="previewCarousel()">🎠 Preview Carousel</button>
    <div id="preview-output" class="output"></div>
  </div>

  <!-- BULK IDEAS -->
  <div class="card">
    <h2>💡 Bulk Content Ideas</h2>
    <select id="ideas-category">
      <option value="">All categories</option>
      <option>Tamil History</option>
      <option>Tamil Temples</option>
      <option>Tamil Food</option>
      <option>Tamil Festivals</option>
      <option>Tamil Literature</option>
      <option>Tamil Language</option>
      <option>Tamil Achievers</option>
      <option>Tamil Nadu Tourism</option>
    </select>
    <button class="btn secondary" onclick="getBulkIdeas(30)">Generate 30 Ideas</button>
    <button class="btn secondary" onclick="getBulkIdeas(50)">Generate 50 Ideas</button>
    <div id="ideas-output" class="output"></div>
  </div>

  <!-- ACCOUNT STATS -->
  <div class="card">
    <h2>📊 Account Stats</h2>
    <button class="btn secondary" onclick="getStats()">Refresh Stats</button>
    <div id="stats-output">
      <div class="stat"><span>Followers</span><span class="stat-val" id="stat-followers">—</span></div>
      <div class="stat"><span>Total Posts</span><span class="stat-val" id="stat-posts">—</span></div>
      <div class="stat"><span>Username</span><span class="stat-val" id="stat-username">—</span></div>
    </div>
  </div>

  <!-- POST LOG -->
  <div class="card">
    <h2>📋 Recent Posts <span class="badge" id="log-count">0</span></h2>
    <button class="btn secondary" onclick="loadRecentLog()">Refresh Log</button>
    <div id="log-output" style="margin-top:1rem;"></div>
  </div>

  <!-- SCHEDULE INFO -->
  <div class="card">
    <h2>🗓️ Auto-Schedule</h2>
    <div class="stat"><span>7:00 AM IST</span><span class="stat-val">Morning Post</span></div>
    <div class="stat"><span>12:00 PM IST</span><span class="stat-val">Lunch Post</span></div>
    <div class="stat"><span>3:00 PM IST</span><span class="stat-val">Afternoon Post</span></div>
    <div class="stat"><span>6:00 PM IST</span><span class="stat-val">Prime Time Post</span></div>
    <div class="stat"><span>9:00 PM IST</span><span class="stat-val">Night Post</span></div>
    <div class="stat"><span>Total / Week</span><span class="stat-val">35 posts</span></div>
    <div class="stat"><span>Total / Month</span><span class="stat-val">~150 posts</span></div>
    <div class="status ok">✅ Scheduler Active</div>
  </div>

  <!-- TOPIC UNIVERSE -->
  <div class="card">
    <h2>🌐 Content Universe</h2>
    <div class="stat"><span>Total unique topics</span><span class="stat-val" id="topic-count">—</span></div>
    <div class="stat"><span>Categories</span><span class="stat-val">9</span></div>
    <div class="stat"><span>Content at 5/day</span><span class="stat-val">~8 months</span></div>
    <button class="btn secondary" onclick="getNextTopicPreview()">👁️ Next Scheduled Topic</button>
    <div id="next-topic-output" class="output"></div>
  </div>

</div>

<script>
async function api(endpoint, body) {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return res.json();
}

async function triggerPost(dryRun) {
  const out = document.getElementById('post-output');
  out.style.display = 'block';
  out.textContent = dryRun ? '🔵 Running dry run...' : '🚀 Posting to Instagram...';
  const data = await api('/api/post', { dryRun });
  out.textContent = JSON.stringify(data, null, 2);
}

async function customPost(dryRun) {
  const topic = document.getElementById('custom-topic').value;
  const category = document.getElementById('category-select').value;
  if (!topic) { alert('Enter a topic first!'); return; }
  const out = document.getElementById('custom-output');
  out.style.display = 'block';
  out.textContent = dryRun ? '🔵 Generating preview...' : '🚀 Posting...';
  const data = await api('/api/post', { topic, category, dryRun });
  out.textContent = JSON.stringify(data, null, 2);
}

async function previewCaption() {
  const category = document.getElementById('preview-category').value;
  const out = document.getElementById('preview-output');
  out.style.display = 'block';
  out.textContent = '✍️ Generating caption...';
  const data = await api('/api/preview/caption', { category });
  out.textContent = JSON.stringify(data, null, 2);
}

async function previewReel() {
  const category = document.getElementById('preview-category').value;
  const out = document.getElementById('preview-output');
  out.style.display = 'block';
  out.textContent = '🎬 Generating reel script...';
  const data = await api('/api/preview/reel', { category });
  out.textContent = JSON.stringify(data, null, 2);
}

async function previewCarousel() {
  const category = document.getElementById('preview-category').value;
  const out = document.getElementById('preview-output');
  out.style.display = 'block';
  out.textContent = '🎠 Generating carousel...';
  const data = await api('/api/preview/carousel', { category });
  out.textContent = JSON.stringify(data, null, 2);
}

async function getBulkIdeas(count) {
  const category = document.getElementById('ideas-category').value;
  const out = document.getElementById('ideas-output');
  out.style.display = 'block';
  out.textContent = \`💡 Generating \${count} ideas...\`;
  const data = await api('/api/ideas', { category, count });
  out.textContent = JSON.stringify(data, null, 2);
}

async function getStats() {
  const data = await fetch('/api/stats').then(r => r.json());
  if (data.followers_count !== undefined) {
    document.getElementById('stat-followers').textContent = data.followers_count?.toLocaleString() || '—';
    document.getElementById('stat-posts').textContent = data.media_count || '—';
    document.getElementById('stat-username').textContent = '@' + (data.username || '—');
  }
}

async function loadRecentLog() {
  const data = await fetch('/api/log').then(r => r.json());
  const out = document.getElementById('log-output');
  document.getElementById('log-count').textContent = data.length;
  out.innerHTML = data.slice(0, 10).map(e => \`
    <div class="log-entry \${e.type}">
      <strong>\${e.type.toUpperCase()}</strong> — \${new Date(e.timestamp).toLocaleString('en-IN')}<br>
      \${e.topic || ''}<br>
      \${e.hook ? '<em>' + e.hook + '</em>' : ''}
      \${e.error ? '<span style="color:#f66">' + e.error + '</span>' : ''}
    </div>
  \`).join('');
}

async function getNextTopicPreview() {
  const data = await fetch('/api/next-topic').then(r => r.json());
  const out = document.getElementById('next-topic-output');
  out.style.display = 'block';
  out.textContent = JSON.stringify(data, null, 2);
}

// Init
document.getElementById('topic-count').textContent = 'Loading...';
fetch('/api/stats-local').then(r => r.json()).then(d => {
  document.getElementById('topic-count').textContent = d.totalTopics;
});
loadRecentLog();
</script>
</body>
</html>`);
});

// ─── API ROUTES ───────────────────────────────────────────────────────────────

// Trigger a post (immediate)
app.post("/api/post", async (req, res) => {
  const { topic, category, dryRun = true } = req.body;
  const result = await runPostPipeline({ topic, category, dryRun });
  res.json(result);
});

// Preview caption only
app.post("/api/preview/caption", async (req, res) => {
  const { topic, category } = req.body;
  const { topic: t, category: c } = topic
    ? { topic, category: category || "Tamil Culture" }
    : getRandomTopic();
  try {
    const content = await generateCaption(t, c);
    res.json({ topic: t, category: c, content });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Preview reel script
app.post("/api/preview/reel", async (req, res) => {
  const { topic, category } = req.body;
  const { topic: t, category: c } = topic
    ? { topic, category: category || "Tamil Culture" }
    : getRandomTopic();
  try {
    const script = await generateReelScript(t, c);
    res.json({ topic: t, category: c, script });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Preview carousel
app.post("/api/preview/carousel", async (req, res) => {
  const { topic, category } = req.body;
  const { topic: t, category: c } = topic
    ? { topic, category: category || "Tamil Culture" }
    : getRandomTopic();
  try {
    const carousel = await generateCarousel(t, c);
    res.json({ topic: t, category: c, carousel });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Bulk ideas
app.post("/api/ideas", async (req, res) => {
  const { category, count = 30 } = req.body;
  try {
    const ideas = await generateBulkIdeas(category, count);
    res.json({ ideas, count: ideas.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Account stats from Instagram
app.get("/api/stats", async (req, res) => {
  const stats = await getAccountStats();
  res.json(stats);
});

// Local stats
app.get("/api/stats-local", (req, res) => {
  const log = loadLog();
  res.json({
    totalTopics: ALL_TOPICS.length,
    categories: Object.keys(CONTENT_TOPICS).length,
    postsLogged: log.length,
    successPosts: log.filter((e) => e.type === "success").length,
  });
});

// Post log
app.get("/api/log", (req, res) => {
  res.json(loadLog());
});

// Next scheduled topic
app.get("/api/next-topic", (req, res) => {
  const next = getNextTopic();
  res.json(next);
});

// ─── START ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║        TAMILNADU UNFILTERED — AUTOMATION ENGINE             ║
╠══════════════════════════════════════════════════════════════╣
║  Dashboard : http://localhost:${PORT}                         ║
║  Stack     : Groq (content) + HuggingFace (images)          ║
║  Posts/day : 5 (7am, 12pm, 3pm, 6pm, 9pm IST)               ║
║  Topics    : ${ALL_TOPICS.length} unique content topics loaded              ║
╚══════════════════════════════════════════════════════════════╝
  `);

  // Start the automatic posting scheduler
  startScheduler();
});
