require("./dns-fix");
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const { runPostPipeline, startScheduler, loadLog } = require("./scheduler");
const { generateCaption, generateReelScript, generateCarousel, generateBulkIdeas, getRandomTopic, CONTENT_TOPICS, ALL_TOPICS } = require("./contentGenerator");
const { getAccountStats } = require("./instagramPoster");
const { runGrowthCycle, getGrowthStats, followFromHashtag, likeFromHashtag, commentFromHashtag } = require("./growthEngine");

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
<title>TamilNadu Unfiltered — Control Panel v2</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;600;700&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Space Grotesk', sans-serif; background: #0a0a0a; color: #f0f0f0; min-height: 100vh; }
  .header { background: linear-gradient(135deg, #8B0000 0%, #CC4400 50%, #FF6B00 100%); padding: 2rem; text-align: center; }
  .header h1 { font-size: 2rem; font-weight: 700; }
  .header p { opacity: 0.85; margin-top: 0.5rem; }
  .header .stats-bar { display: flex; gap: 2rem; justify-content: center; margin-top: 1rem; flex-wrap: wrap; }
  .header .stat-item { text-align: center; }
  .header .stat-item .val { font-size: 1.5rem; font-weight: 700; }
  .header .stat-item .lbl { font-size: 0.7rem; opacity: 0.8; text-transform: uppercase; }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1.5rem; padding: 2rem; max-width: 1600px; margin: 0 auto; }
  .card { background: #141414; border: 1px solid #2a2a2a; border-radius: 12px; padding: 1.5rem; }
  .card h2 { font-size: 0.9rem; color: #FF6B00; margin-bottom: 1rem; text-transform: uppercase; letter-spacing: 1px; }
  .btn { background: #FF6B00; color: white; border: none; padding: 0.75rem 1.5rem; border-radius: 8px; cursor: pointer; font-family: inherit; font-weight: 600; width: 100%; margin-bottom: 0.75rem; font-size: 0.9rem; transition: background 0.2s; }
  .btn:hover { background: #e55d00; }
  .btn:disabled { background: #333; cursor: not-allowed; }
  .btn.secondary { background: #2a2a2a; }
  .btn.secondary:hover { background: #333; }
  .btn.danger { background: #8B0000; }
  .btn.success { background: #1a5c1a; }
  .btn.success:hover { background: #227a22; }
  .stat { display: flex; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px solid #1e1e1e; font-size: 0.9rem; }
  .stat-val { color: #FF6B00; font-weight: 600; }
  .stat-val.green { color: #4CAF50; }
  .stat-val.blue { color: #64B5F6; }
  .log-entry { background: #1a1a1a; border-radius: 6px; padding: 0.75rem; margin-bottom: 0.5rem; font-size: 0.8rem; border-left: 3px solid #FF6B00; }
  .log-entry.failed, .log-entry.error { border-left-color: #8B0000; }
  .log-entry.dry_run { border-left-color: #444; }
  .log-entry.follow { border-left-color: #64B5F6; }
  .log-entry.like { border-left-color: #f06292; }
  .log-entry.comment { border-left-color: #81C784; }
  .log-entry.dm { border-left-color: #FFD54F; }
  .output { background: #0f0f0f; border: 1px solid #2a2a2a; border-radius: 8px; padding: 1rem; margin-top: 1rem; font-size: 0.8rem; white-space: pre-wrap; max-height: 400px; overflow-y: auto; color: #aaa; display: none; }
  .badge { display: inline-block; background: #FF6B00; color: white; border-radius: 99px; padding: 0.1rem 0.6rem; font-size: 0.7rem; font-weight: 700; margin-left: 0.5rem; }
  .badge.green { background: #2e7d32; }
  .badge.blue { background: #1565c0; }
  select, input { background: #1a1a1a; border: 1px solid #2a2a2a; color: #f0f0f0; padding: 0.5rem; border-radius: 6px; width: 100%; margin-bottom: 0.75rem; font-family: inherit; }
  .status { text-align: center; padding: 0.5rem; border-radius: 6px; margin-top: 0.5rem; font-size: 0.85rem; }
  .status.ok { background: #0a2a0a; color: #4CAF50; }
  .status.warn { background: #2a1a0a; color: #FF9800; }
  .progress-bar { background: #1a1a1a; border-radius: 99px; height: 8px; margin: 0.3rem 0; overflow: hidden; }
  .progress-fill { height: 100%; background: linear-gradient(90deg, #FF6B00, #ff9a44); border-radius: 99px; transition: width 0.5s; }
  .progress-fill.blue { background: linear-gradient(90deg, #1565c0, #64B5F6); }
  .progress-fill.green { background: linear-gradient(90deg, #2e7d32, #81C784); }
  .progress-fill.pink { background: linear-gradient(90deg, #880e4f, #f06292); }
  .tab-row { display: flex; gap: 0.5rem; margin-bottom: 1rem; }
  .tab { background: #1a1a1a; border: 1px solid #2a2a2a; color: #aaa; padding: 0.4rem 0.8rem; border-radius: 6px; cursor: pointer; font-size: 0.8rem; }
  .tab.active { background: #FF6B00; color: white; border-color: #FF6B00; }
  .spinner { display: inline-block; width: 14px; height: 14px; border: 2px solid rgba(255,107,0,0.3); border-radius: 50%; border-top-color: #FF6B00; animation: spin 0.8s linear infinite; margin-right: 6px; }
  @keyframes spin { to { transform: rotate(360deg); } }
</style>
</head>
<body>

<div class="header">
  <h1>🏛️ TamilNadu Unfiltered</h1>
  <p>Instagram Growth Engine v2 — Groq + HuggingFace FLUX + Growth Automation</p>
  <div class="stats-bar">
    <div class="stat-item"><div class="val" id="hdr-topics">—</div><div class="lbl">Total Topics</div></div>
    <div class="stat-item"><div class="val" id="hdr-posts">—</div><div class="lbl">Posts Today</div></div>
    <div class="stat-item"><div class="val" id="hdr-follows">—</div><div class="lbl">Follows Today</div></div>
    <div class="stat-item"><div class="val" id="hdr-likes">—</div><div class="lbl">Likes Today</div></div>
    <div class="stat-item"><div class="val" id="hdr-followers">—</div><div class="lbl">IG Followers</div></div>
  </div>
</div>

<div class="grid">

  <!-- QUICK POST -->
  <div class="card">
    <h2>⚡ Quick Post</h2>
    <button class="btn" id="btn-post" onclick="triggerPost(false)">🚀 Post to Instagram NOW</button>
    <button class="btn secondary" onclick="triggerPost(true)">🔵 Dry Run (no post)</button>
    <div id="post-output" class="output"></div>
  </div>

  <!-- CUSTOM TOPIC -->
  <div class="card">
    <h2>✍️ Custom Topic Post</h2>
    <select id="category-select">
      <option value="">Auto-select category</option>
      ${Object.keys(CONTENT_TOPICS).map(c => `<option>${c}</option>`).join("")}
    </select>
    <input type="text" id="custom-topic" placeholder="e.g. Chola Navy history" />
    <button class="btn" onclick="customPost(false)">🚀 Post Custom Topic</button>
    <button class="btn secondary" onclick="customPost(true)">🔵 Preview Only</button>
    <div id="custom-output" class="output"></div>
  </div>

  <!-- GROWTH ENGINE -->
  <div class="card">
    <h2>🚀 Growth Engine <span class="badge" id="growth-badge">Loading...</span></h2>
    <div id="growth-stats-box">
      <div class="stat"><span>Follows today</span><span class="stat-val blue" id="g-follows">—</span></div>
      <div style="padding:0.2rem 0"><div class="progress-bar"><div class="progress-fill blue" id="pb-follows" style="width:0%"></div></div></div>
      <div class="stat"><span>Likes today</span><span class="stat-val" id="g-likes" style="color:#f06292">—</span></div>
      <div style="padding:0.2rem 0"><div class="progress-bar"><div class="progress-fill pink" id="pb-likes" style="width:0%"></div></div></div>
      <div class="stat"><span>Comments today</span><span class="stat-val green" id="g-comments">—</span></div>
      <div style="padding:0.2rem 0"><div class="progress-bar"><div class="progress-fill green" id="pb-comments" style="width:0%"></div></div></div>
      <div class="stat"><span>DMs today</span><span class="stat-val" id="g-dms" style="color:#FFD54F">—</span></div>
      <div class="stat"><span>All-time followed</span><span class="stat-val blue" id="g-total-follows">—</span></div>
    </div>
    <button class="btn success" id="btn-growth" onclick="runGrowth()">▶️ Run Growth Cycle Now</button>
    <button class="btn secondary" onclick="runFollowOnly()">👤 Follow from Hashtag</button>
    <button class="btn secondary" onclick="runLikeOnly()">❤️ Like Hashtag Posts</button>
    <div id="growth-output" class="output"></div>
    <div id="growth-status" class="status warn" style="margin-top:0.5rem">⚠️ Add IG_SESSION_ID to Render env vars to enable growth</div>
  </div>

  <!-- CONTENT PREVIEW -->
  <div class="card">
    <h2>👁️ Preview Content</h2>
    <select id="preview-category">
      <option value="">Any category</option>
      ${Object.keys(CONTENT_TOPICS).map(c => `<option>${c}</option>`).join("")}
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
      <option value="">All 20 categories</option>
      ${Object.keys(CONTENT_TOPICS).map(c => `<option>${c}</option>`).join("")}
    </select>
    <button class="btn secondary" onclick="getBulkIdeas(30)">Generate 30 Ideas</button>
    <button class="btn secondary" onclick="getBulkIdeas(50)">Generate 50 Ideas</button>
    <div id="ideas-output" class="output"></div>
  </div>

  <!-- ACCOUNT STATS -->
  <div class="card">
    <h2>📊 Instagram Stats</h2>
    <button class="btn secondary" onclick="getStats()">Refresh Stats</button>
    <div class="stat"><span>Followers</span><span class="stat-val" id="stat-followers">—</span></div>
    <div class="stat"><span>Total Posts</span><span class="stat-val" id="stat-posts">—</span></div>
    <div class="stat"><span>Username</span><span class="stat-val" id="stat-username">—</span></div>
    <div class="stat"><span>Posts Today</span><span class="stat-val" id="stat-today">—</span></div>
    <div class="stat"><span>Posts This Month</span><span class="stat-val" id="stat-month">—</span></div>
    <div class="stat"><span>Total Logged</span><span class="stat-val" id="stat-total">—</span></div>
  </div>

  <!-- POST LOG -->
  <div class="card">
    <h2>📋 Post History <span class="badge" id="log-count">0</span></h2>
    <div class="tab-row">
      <button class="tab active" onclick="setLogTab('posts',this)">Posts</button>
      <button class="tab" onclick="setLogTab('growth',this)">Growth</button>
    </div>
    <button class="btn secondary" onclick="loadRecentLog()">Refresh</button>
    <div id="log-output" style="margin-top:1rem;"></div>
  </div>

  <!-- SCHEDULE -->
  <div class="card">
    <h2>🗓️ Posting Schedule</h2>
    <div class="stat"><span>7am – 11pm IST</span><span class="stat-val">Every hour</span></div>
    <div class="stat"><span>Posts per day</span><span class="stat-val">17</span></div>
    <div class="stat"><span>Posts per week</span><span class="stat-val">119</span></div>
    <div class="stat"><span>Posts per month</span><span class="stat-val">~510</span></div>
    <div class="stat"><span>Growth cycles/day</span><span class="stat-val">7×</span></div>
    <div class="stat"><span>Image styles</span><span class="stat-val">8 rotating</span></div>
    <div class="stat"><span>Categories</span><span class="stat-val">20</span></div>
    <div class="stat"><span>Topics (unlimited)</span><span class="stat-val">∞ AI</span></div>
    <div class="status ok">✅ All Systems Active</div>
  </div>

  <!-- TOKEN STATUS -->
  <div class="card">
    <h2>🔑 Token Status</h2>
    <div id="token-status-box">
      <div class="stat"><span>Access Token</span><span class="stat-val" id="token-valid">Checking...</span></div>
      <div class="stat"><span>IG Account</span><span class="stat-val" id="token-account">—</span></div>
    </div>
    <div style="margin-top:1rem">
      <input type="text" id="new-token-input" placeholder="Paste new IG_ACCESS_TOKEN here" style="font-size:0.75rem" />
      <button class="btn secondary" onclick="refreshToken()">🔄 Update Token</button>
    </div>
    <div id="token-output" class="output"></div>
    <div class="status warn" style="margin-top:0.5rem;font-size:0.75rem">Tokens expire every 60 days. Get new one at developers.facebook.com → Graph API Explorer</div>
  </div>

  <!-- REACH CALCULATOR -->
  <div class="card">
    <h2>📈 Reach Projector</h2>
    <div class="stat"><span>Posts/month</span><span class="stat-val">~510</span></div>
    <div class="stat"><span>Avg reach/post (conservative)</span><span class="stat-val">2,000</span></div>
    <div class="stat"><span>Growth follows/month</span><span class="stat-val">3,600</span></div>
    <div class="stat"><span>Est. followers in 3 months</span><span class="stat-val green">~5,000+</span></div>
    <div class="stat"><span>Est. monthly reach (month 3)</span><span class="stat-val green">~500K</span></div>
    <div class="stat"><span>Target 1M reach</span><span class="stat-val green">Month 4-5</span></div>
  </div>

</div>

<script>
let logTab = 'posts';
function setLogTab(tab, el) {
  logTab = tab;
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  loadRecentLog();
}

async function api(endpoint, body) {
  const res = await fetch(endpoint, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) });
  return res.json();
}

async function triggerPost(dryRun) {
  const btn = document.getElementById('btn-post');
  const out = document.getElementById('post-output');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span>' + (dryRun ? 'Running dry run...' : 'Posting...');
  out.style.display = 'block';
  out.textContent = dryRun ? '🔵 Generating content...' : '🚀 Full pipeline running (image gen + Instagram post)...';
  const data = await api('/api/post', { dryRun });
  out.textContent = JSON.stringify(data, null, 2);
  btn.disabled = false;
  btn.textContent = '🚀 Post to Instagram NOW';
  loadStats(); loadRecentLog();
}

async function customPost(dryRun) {
  const topic = document.getElementById('custom-topic').value;
  const category = document.getElementById('category-select').value;
  if (!topic) { alert('Enter a topic first!'); return; }
  const out = document.getElementById('custom-output');
  out.style.display = 'block';
  out.textContent = dryRun ? '🔵 Generating preview...' : '🚀 Posting custom topic...';
  const data = await api('/api/post', { topic, category, dryRun });
  out.textContent = JSON.stringify(data, null, 2);
}

async function previewCaption() {
  const category = document.getElementById('preview-category').value;
  const out = document.getElementById('preview-output');
  out.style.display = 'block'; out.textContent = '✍️ Generating caption...';
  const data = await api('/api/preview/caption', { category });
  out.textContent = JSON.stringify(data, null, 2);
}
async function previewReel() {
  const category = document.getElementById('preview-category').value;
  const out = document.getElementById('preview-output');
  out.style.display = 'block'; out.textContent = '🎬 Generating reel script...';
  const data = await api('/api/preview/reel', { category });
  out.textContent = JSON.stringify(data, null, 2);
}
async function previewCarousel() {
  const category = document.getElementById('preview-category').value;
  const out = document.getElementById('preview-output');
  out.style.display = 'block'; out.textContent = '🎠 Generating carousel...';
  const data = await api('/api/preview/carousel', { category });
  out.textContent = JSON.stringify(data, null, 2);
}

async function getBulkIdeas(count) {
  const category = document.getElementById('ideas-category').value;
  const out = document.getElementById('ideas-output');
  out.style.display = 'block'; out.textContent = \`💡 Generating \${count} ideas...\`;
  const data = await api('/api/ideas', { category, count });
  out.textContent = JSON.stringify(data, null, 2);
}

async function runGrowth() {
  const btn = document.getElementById('btn-growth');
  const out = document.getElementById('growth-output');
  btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>Growth cycle running...';
  out.style.display = 'block'; out.textContent = '🚀 Running follow + like + comment + DM cycle...';
  const data = await fetch('/api/growth/run').then(r => r.json());
  out.textContent = JSON.stringify(data, null, 2);
  btn.disabled = false; btn.textContent = '▶️ Run Growth Cycle Now';
  loadGrowthStats();
}

async function runFollowOnly() {
  const out = document.getElementById('growth-output');
  out.style.display = 'block'; out.textContent = '👤 Following users from Tamil hashtags...';
  const data = await fetch('/api/growth/follow').then(r => r.json());
  out.textContent = JSON.stringify(data, null, 2);
  loadGrowthStats();
}

async function runLikeOnly() {
  const out = document.getElementById('growth-output');
  out.style.display = 'block'; out.textContent = '❤️ Liking posts from Tamil hashtags...';
  const data = await fetch('/api/growth/like').then(r => r.json());
  out.textContent = JSON.stringify(data, null, 2);
  loadGrowthStats();
}

async function getStats() {
  const data = await fetch('/api/stats').then(r => r.json());
  if (data.followers_count !== undefined) {
    document.getElementById('stat-followers').textContent = (data.followers_count||0).toLocaleString();
    document.getElementById('stat-posts').textContent = data.media_count || '—';
    document.getElementById('stat-username').textContent = '@' + (data.username || '—');
    document.getElementById('hdr-followers').textContent = (data.followers_count||0).toLocaleString();
  }
}

async function loadStats() {
  const data = await fetch('/api/stats-local').then(r => r.json());
  document.getElementById('hdr-topics').textContent = data.totalTopics + '+';
  document.getElementById('stat-today').textContent = data.postsToday;
  document.getElementById('stat-month').textContent = data.postsThisMonth;
  document.getElementById('stat-total').textContent = data.postsLogged;
  document.getElementById('hdr-posts').textContent = data.postsToday;
}

async function loadGrowthStats() {
  const d = await fetch('/api/growth/stats').then(r => r.json());
  document.getElementById('g-follows').textContent = d.today.follows + ' / ' + d.limits.follows;
  document.getElementById('g-likes').textContent = d.today.likes + ' / ' + d.limits.likes;
  document.getElementById('g-comments').textContent = d.today.comments + ' / ' + d.limits.comments;
  document.getElementById('g-dms').textContent = d.today.dms + ' / ' + d.limits.dms;
  document.getElementById('g-total-follows').textContent = d.allTime.totalFollowed.toLocaleString();
  document.getElementById('pb-follows').style.width = Math.min(100, (d.today.follows / d.limits.follows) * 100) + '%';
  document.getElementById('pb-likes').style.width = Math.min(100, (d.today.likes / d.limits.likes) * 100) + '%';
  document.getElementById('pb-comments').style.width = Math.min(100, (d.today.comments / d.limits.comments) * 100) + '%';
  document.getElementById('growth-badge').textContent = d.engineEnabled ? 'ACTIVE' : 'SETUP NEEDED';
  document.getElementById('growth-badge').style.background = d.engineEnabled ? '#2e7d32' : '#8B0000';
  document.getElementById('growth-status').textContent = d.engineEnabled ? '✅ Growth engine active' : '⚠️ Add IG_SESSION_ID to Render env vars to enable growth follows/likes/DMs';
  document.getElementById('growth-status').className = 'status ' + (d.engineEnabled ? 'ok' : 'warn');
  document.getElementById('hdr-follows').textContent = d.today.follows;
  document.getElementById('hdr-likes').textContent = d.today.likes;
}

async function loadRecentLog() {
  if (logTab === 'growth') {
    const d = await fetch('/api/growth/stats').then(r => r.json());
    const out = document.getElementById('log-output');
    document.getElementById('log-count').textContent = d.allTime.totalActions;
    const typeColor = {follow:'#64B5F6', like:'#f06292', comment:'#81C784', dm:'#FFD54F', unfollow:'#aaa'};
    out.innerHTML = d.recentActions.map(e => \`
      <div class="log-entry \${e.type}">
        <strong style="color:\${typeColor[e.type]||'#FF6B00'}">\${e.type.toUpperCase()}</strong> — \${new Date(e.timestamp).toLocaleString('en-IN')}<br>
        \${e.detail || ''}
      </div>\`).join('');
  } else {
    const data = await fetch('/api/log').then(r => r.json());
    const out = document.getElementById('log-output');
    document.getElementById('log-count').textContent = data.length;
    out.innerHTML = data.slice(0, 15).map(e => \`
      <div class="log-entry \${e.type}">
        <strong>\${e.type.toUpperCase()}</strong> — \${new Date(e.timestamp).toLocaleString('en-IN')}<br>
        \${e.topic || ''}<br>
        \${e.hook ? '<em>' + e.hook + '</em>' : ''}
        \${e.error ? '<span style="color:#f66">' + e.error + '</span>' : ''}
      </div>\`).join('');
  }
}

async function checkTokenStatus() {
  const d = await fetch('/api/token-status').then(r => r.json());
  const el = document.getElementById('token-valid');
  const acEl = document.getElementById('token-account');
  if (d.valid) {
    el.textContent = '✅ Valid';
    el.style.color = '#4CAF50';
    acEl.textContent = '@' + (d.account?.username || '—') + ' (' + (d.account?.followers_count||0).toLocaleString() + ' followers)';
  } else {
    el.textContent = '❌ EXPIRED — update required';
    el.style.color = '#f66';
    acEl.textContent = d.error?.slice(0,60) || 'Unknown error';
    document.getElementById('token-status-box').style.border = '1px solid #8B0000';
    document.getElementById('token-status-box').style.padding = '0.5rem';
    document.getElementById('token-status-box').style.borderRadius = '6px';
  }
}

async function refreshToken() {
  const token = document.getElementById('new-token-input').value.trim();
  if (!token) { alert('Paste your new token first'); return; }
  const out = document.getElementById('token-output');
  out.style.display = 'block';
  out.textContent = 'Updating token...';
  const d = await fetch('/api/refresh-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token })
  }).then(r => r.json());
  out.textContent = JSON.stringify(d, null, 2);
  checkTokenStatus();
}

// Init
loadStats();
loadGrowthStats();
loadRecentLog();
getStats();
checkTokenStatus();
setInterval(loadGrowthStats, 60000);
setInterval(loadStats, 60000);
setInterval(checkTokenStatus, 300000);
</script>
</body>
</html>`);
});

// ─── API ROUTES ───────────────────────────────────────────────────────────────

app.post("/api/post", async (req, res) => {
  const { topic, category, dryRun = true } = req.body;
  const result = await runPostPipeline({ topic, category, dryRun });
  res.json(result);
});

app.post("/api/preview/caption", async (req, res) => {
  const { topic, category } = req.body;
  const { topic: t, category: c } = topic
    ? { topic, category: category || "Tamil Culture" }
    : getRandomTopic();
  try {
    const content = await generateCaption(t, c);
    res.json({ topic: t, category: c, content });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/api/preview/reel", async (req, res) => {
  const { topic, category } = req.body;
  const { topic: t, category: c } = topic
    ? { topic, category: category || "Tamil Culture" }
    : getRandomTopic();
  try {
    const script = await generateReelScript(t, c);
    res.json({ topic: t, category: c, script });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/api/preview/carousel", async (req, res) => {
  const { topic, category } = req.body;
  const { topic: t, category: c } = topic
    ? { topic, category: category || "Tamil Culture" }
    : getRandomTopic();
  try {
    const carousel = await generateCarousel(t, c);
    res.json({ topic: t, category: c, carousel });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/api/ideas", async (req, res) => {
  const { category, count = 30 } = req.body;
  try {
    const ideas = await generateBulkIdeas(category, count);
    res.json({ ideas, count: ideas.length });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get("/api/stats", async (req, res) => {
  const stats = await getAccountStats();
  res.json(stats);
});

app.get("/api/stats-local", (req, res) => {
  const log = loadLog();
  const today = new Date().toISOString().split("T")[0];
  const thisMonth = new Date().toISOString().slice(0, 7);
  res.json({
    totalTopics: ALL_TOPICS.length,
    categories: Object.keys(CONTENT_TOPICS).length,
    postsLogged: log.length,
    postsToday: log.filter((e) => e.timestamp?.startsWith(today)).length,
    postsThisMonth: log.filter((e) => e.timestamp?.startsWith(thisMonth)).length,
    successPosts: log.filter((e) => e.type === "success").length,
  });
});

app.get("/api/log", (req, res) => { res.json(loadLog()); });

// ─── GROWTH API ROUTES ────────────────────────────────────────────────────────

app.get("/api/growth/stats", (req, res) => {
  res.json(getGrowthStats());
});

app.get("/api/growth/run", async (req, res) => {
  runGrowthCycle().catch((e) => console.error("Growth cycle error:", e.message));
  res.json({ started: true, message: "Growth cycle started — check server logs" });
});

app.get("/api/growth/follow", async (req, res) => {
  const tag = "tamilnadu";
  const followed = await followFromHashtag(tag, 15);
  res.json({ followed, hashtag: tag });
});

app.get("/api/growth/like", async (req, res) => {
  const tag = "tamilculture";
  const liked = await likeFromHashtag(tag, 20);
  res.json({ liked, hashtag: tag });
});

// ─── HEALTH CHECK ────────────────────────────────────────────────────────────
app.get("/api/health", async (req, res) => {
  const axios = require("axios");
  const log = loadLog();
  const today = new Date().toISOString().split("T")[0];

  // Check IG token
  let tokenOk = false, igUsername = null;
  try {
    const r = await axios.get(`https://graph.facebook.com/v21.0/${process.env.IG_BUSINESS_ACCOUNT_ID}`, {
      params: { fields: "username,followers_count", access_token: process.env.IG_ACCESS_TOKEN },
      timeout: 8000,
    });
    tokenOk = true;
    igUsername = r.data.username;
  } catch {}

  const { getGrowthStats } = require("./growthEngine");
  const gs = getGrowthStats();

  res.json({
    status: tokenOk ? "ok" : "token_expired",
    token: tokenOk ? "✅ valid" : "❌ expired — get new token at developers.facebook.com/tools/explorer",
    igAccount: igUsername || "unknown",
    growthEngine: gs.engineEnabled ? "✅ active" : "❌ needs IG_SESSION_ID env var",
    postsToday: log.filter((e) => e.timestamp?.startsWith(today)).length,
    postsTotal: log.length,
    successfulPosts: log.filter((e) => e.type === "success").length,
    lastPost: log[0]?.timestamp || "none",
    uptime: process.uptime().toFixed(0) + "s",
    topics: ALL_TOPICS.length + "+ (unlimited AI)",
    actions: gs.today,
  });
});

// ─── TOKEN REFRESH ───────────────────────────────────────────────────────────
app.post("/api/refresh-token", (req, res) => {
  const { token } = req.body;
  if (!token || token.length < 20) return res.status(400).json({ error: "Invalid token" });
  process.env.IG_ACCESS_TOKEN = token;
  res.json({ success: true, message: "Token updated in memory. Also update Render env var IG_ACCESS_TOKEN." });
});

app.get("/api/token-status", async (req, res) => {
  try {
    const r = await require("axios").get(
      `https://graph.facebook.com/v21.0/${process.env.IG_BUSINESS_ACCOUNT_ID}`,
      { params: { fields: "id,username,followers_count", access_token: process.env.IG_ACCESS_TOKEN } }
    );
    res.json({ valid: true, account: r.data });
  } catch (e) {
    const err = e.response?.data?.error;
    res.json({ valid: false, error: err?.message || e.message, code: err?.code });
  }
});

// ─── START ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║     TAMILNADU UNFILTERED v2 — GROWTH AUTOMATION ENGINE      ║
╠══════════════════════════════════════════════════════════════╣
║  Dashboard : http://localhost:${PORT}                         ║
║  Posts/day : 17 (every hour, 7am-11pm IST)                   ║
║  Topics    : ${ALL_TOPICS.length}+ hardcoded + unlimited AI generation      ║
║  Image AI  : HuggingFace FLUX + Pollinations fallback         ║
║  Growth    : Follow/Like/Comment/DM automation               ║
╚══════════════════════════════════════════════════════════════╝
  `);
  startScheduler();
});
