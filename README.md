# TamilNadu Unfiltered — Instagram Automation Engine

> Auto-posts 5x daily to Instagram using Groq AI (content) + Hugging Face (images).
> Zero manual work after setup.

---

## What This Does

Automatically, on a peak-hour schedule (IST):
1. Picks a topic from 730+ Tamil culture topics (rotates, plus unlimited AI topics)
2. Generates caption + hashtags using **Groq AI (free)**
3. Generates a **branded 1080×1080 promo image** (see below)
4. Posts to Instagram (private API session — no Facebook app needed)
5. Runs the growth engine (follow / like / comment) and logs everything

---

## Image Pipeline (works with ZERO API keys)

The image generator is a multi-stage pipeline that **never fails**:

1. **AI art** — HuggingFace / Together / Fal / Stability (only if you add a key).
   Depleted providers auto-disable for the session so they aren't retried.
2. **Real photos → branded** — searches **Wikimedia Commons** and **Openverse**
   (both free, no key) for an on-topic Tamil Nadu photo, then composites it into
   a designed 1080×1080 post: real photo + gradient + headline + branding + tags.
   Optional **Pexels / Pixabay** keys slot in here too.
3. **Local SVG card** — a guaranteed, offline, category-themed text card if every
   network source is down.

You get genuine, relevant, professional-looking posts out of the box. Add any AI
key from `.env.example` to upgrade stage 1 to generated art.

### Run the tests (safe — never posts)
```bash
npm test            # full suite: content, images, posting paths, growth, dry-run
npm run test:quick  # faster, fewer image samples
```

---

## STEP 1 — Get Your Free API Keys

### A) Groq API Key (for content generation)
1. Go to **console.groq.com**
2. Sign up free
3. Go to API Keys → Create Key
4. Copy the key → paste in `.env` as `GROQ_API_KEY`

### B) Hugging Face API Key (for image generation)
1. Go to **huggingface.co** → Sign up free
2. Click your profile → Settings → Access Tokens
3. New Token → Read permission
4. Copy → paste in `.env` as `HF_API_KEY`

### C) ImgBB API Key (free image hosting)
1. Go to **imgbb.com** → Sign up free
2. Go to **api.imgbb.com** → Get API key
3. Copy → paste in `.env` as `IMGBB_API_KEY`

---

## STEP 2 — Set Up Instagram Business Account

1. Open Instagram app
2. Create account: **@tamilnadu.unfiltered** (or your chosen name)
3. Settings → Account → **Switch to Professional Account**
4. Choose **Creator** or **Business**
5. Create a Facebook Page (any name) and connect it

---

## STEP 3 — Get Instagram Graph API Access

1. Go to **developers.facebook.com**
2. Click **My Apps → Create App → Business**
3. App name: "TamilNadu Unfiltered"
4. Add product: **Instagram Graph API**
5. Go to **Instagram Basic Display** or **Graph API Explorer**
6. Generate a Page Access Token with these permissions:
   - `instagram_basic`
   - `instagram_content_publish`
   - `pages_read_engagement`
7. Copy the token → paste as `IG_ACCESS_TOKEN`

### Get Your Instagram Business Account ID:
```
GET https://graph.facebook.com/v21.0/me/accounts?access_token=YOUR_TOKEN
```
Then:
```
GET https://graph.facebook.com/v21.0/PAGE_ID?fields=instagram_business_account&access_token=YOUR_TOKEN
```
Copy the `id` → paste as `IG_BUSINESS_ACCOUNT_ID`

---

## STEP 4 — Install and Run

```bash
# Install dependencies
npm install

# Copy env file
cp .env.example .env

# Fill in all 5 keys in .env file

# Start the server
node server.js
```

Open **http://localhost:3000** — you'll see the control dashboard.

---

## STEP 5 — Test Before Going Live

1. Open the dashboard at http://localhost:3000
2. Click **"🔵 Dry Run"** — generates content without posting
3. Check the preview looks good
4. Click **"🚀 Post to Instagram NOW"** to test a real post
5. If it works → the scheduler runs automatically from now on

---

## Content Universe (135 unique topics)

| Category | Topics |
|---|---|
| Tamil History | 15 topics |
| Tamil Temples | 15 topics |
| Tamil Food | 15 topics |
| Tamil Festivals | 15 topics |
| Tamil Literature | 15 topics |
| Tamil Language | 15 topics |
| Tamil Achievers | 15 topics |
| Tamil Nadu Tourism | 15 topics |
| Tamil Villages | (mixed in) |

Topics rotate automatically — no repeats for months.

---

## Posting Schedule (IST)

| Time | Type |
|---|---|
| 7:00 AM | Morning post (peak Tamil diaspora time) |
| 12:00 PM | Lunch scroll |
| 3:00 PM | Afternoon |
| 6:00 PM | Prime time |
| 9:00 PM | Night engagement |

**5 posts/day → 35/week → ~150/month**

---

## Dashboard Features

- 🚀 Post immediately (any topic or custom)
- 🔵 Dry run (preview without posting)
- 👁️ Preview captions, reel scripts, carousels
- 💡 Generate bulk content ideas
- 📊 Live account stats
- 📋 Post history log
- 🗓️ Schedule overview

---

## Free Tier Limits

| Service | Free Limit | Our Usage |
|---|---|---|
| Groq | 14,400 req/day | ~10/day ✅ |
| Hugging Face | Unlimited (slow) | ~5/day ✅ |
| ImgBB | 32MB/image | Fine ✅ |
| Instagram API | 200 posts/day | 5/day ✅ |

Everything runs within free tiers.
