const Groq = require("groq-sdk");

// Lazy init — only create client when actually needed
let _groq = null;
function getGroq() {
  if (!_groq) _groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  return _groq;
}



// ─── CONTENT UNIVERSE ─────────────────────────────────────────────────────────

const CONTENT_TOPICS = {
  "Tamil History": [
    "Chola Empire naval supremacy in Southeast Asia",
    "Pallava dynasty and Mahabalipuram construction",
    "Battle of Talaiyalanganam — Tamil military history",
    "Pandya kingdom and ancient pearl trade",
    "Sangam Age — Tamil civilization 300 BCE",
    "Rajendra Chola's conquest to the Ganges",
    "Ancient Tamil trade routes with Rome and Greece",
    "Karikala Cholan and the Grand Anicut dam",
    "Tamil merchant guilds that ruled Indian Ocean trade",
    "The mystery of the Indus Valley Tamil connection",
    "Veerapandiya Kattabomman's resistance",
    "Tamil kings who donated to foreign kingdoms",
    "Hidden inscriptions that rewrote Tamil history",
    "The forgotten women warriors of Tamil Nadu",
    "Archaeological discoveries at Keeladi",
  ],
  "Tamil Temples": [
    "Brihadeeswarar Temple — engineering mystery solved",
    "Meenakshi Amman Temple — 33,000 sculptures story",
    "Ranganathaswamy Temple — largest temple complex in India",
    "Shore Temple Mahabalipuram — swallowed by sea",
    "Nataraja Temple Chidambaram — cosmic dance secret",
    "Hidden temples of the Nilgiri hills",
    "Airavatesvara Temple — music from stone steps",
    "The 108 Divya Desam temples of Tamil Nadu",
    "Cave temples carved before iron tools existed",
    "Temple tanks that survived 2000 years",
    "The astronomical alignment of Tamil temples",
    "Forgotten temples buried under modern cities",
    "Temple architecture that predates Greek columns",
    "The Gopuram — why Tamil towers grew so tall",
    "Kanchipuram — city of 1000 temples history",
  ],
  "Tamil Food": [
    "Kanji — the ancient Tamil superfood eaten for 3000 years",
    "Chettinad spices that were traded with Rome",
    "How idli was invented — the real story",
    "Ancient Tamil feast — what a Sangam-era Tamil ate",
    "Forgotten village foods of Tamil Nadu",
    "Pongal — the dish that fed armies and farmers",
    "Palm sugar jaggery — Tamil Nadu's liquid gold",
    "The Tamil banana leaf meal — science behind the ritual",
    "Kozhukattai — Ganesha's favourite Tamil sweet",
    "Ancient Tamil alcoholic drink — Toddy culture",
    "Murungai — Tamil Nadu's miracle tree recipes",
    "Festival-specific foods of each Tamil district",
    "How Chettinad became India's most complex cuisine",
    "Tamil Nadu's forgotten grain crops",
    "Street food of Tamil Nadu — 100 year history",
  ],
  "Tamil Festivals": [
    "Pongal — deeper meaning most Tamils don't know",
    "Thai Pusam — kavadi tradition origin story",
    "Aadi Perukku — Tamil Nadu's water festival",
    "Navarathri Golu — hidden symbolism explained",
    "Karthigai Deepam — the light festival older than Diwali",
    "Panguni Uthiram — Tamil Nadu's most romantic festival",
    "Chittirai festival — Meenakshi Thirukalyanam story",
    "Jallikattu — 5000 year history and real meaning",
    "Arudra Darisanam — the dance of Shiva festival",
    "Village festivals you've never heard of",
    "How Tamils celebrate each month — full calendar",
    "Ancient Tamil New Year traditions",
    "Festival foods tied to Tamil astronomy",
    "Regional festival differences across 38 districts",
    "The forgotten festivals of ancient Tamil Nadu",
  ],
  "Tamil Literature": [
    "Thirukkural — wisdom that runs global corporations",
    "Silappatikaram — Tamil's oldest novel story",
    "Sangam poetry — the world's oldest secular literature",
    "Avvaiyar — the greatest Tamil poet who was a woman",
    "Kamba Ramayanam vs Valmiki — Tamil poet's bold differences",
    "Manimekalai — the forgotten Buddhist Tamil epic",
    "Tolkappiyam — Tamil grammar older than Sanskrit grammar",
    "Tamil poets who challenged kings and won",
    "The 18 Sangam anthologies explained simply",
    "Thiruvasagam — Manickavasagar's divine poems",
    "Lost Tamil texts that scholars are searching for",
    "Purananuru — battlefield poetry of ancient Tamils",
    "How Thirukkural is quoted in UN speeches",
    "Tamil literature translated into 100+ languages",
    "Ancient Tamil love poems — Akam poetry explained",
  ],
  "Tamil Language": [
    "Tamil is 2000+ years old — proof from inscriptions",
    "Words in English that came from Tamil",
    "The Tamil script — most scientific writing system",
    "Ancient Tamil words with no translation in any language",
    "How Tamil survived 2000 years without changing core grammar",
    "Tamil numbers and the zero concept connection",
    "Grantha script — when Tamil met Sanskrit",
    "Tamil dialects — how language changes district by district",
    "The 247 letters of Tamil — explained simply",
    "Tamil words used in space science and medicine",
    "Forgotten Tamil words that should come back",
    "Why linguists call Tamil a language miracle",
    "The oldest Tamil inscription ever found",
    "Tamil's influence on Southeast Asian languages",
    "How to read ancient Tamil inscriptions",
  ],
  "Tamil Achievers": [
    "APJ Abdul Kalam — Tamil boy who became rocket scientist",
    "Srinivasa Ramanujan — genius who shocked Cambridge",
    "Subramaniam Chandrasekhar — Nobel Prize Tamil astrophysicist",
    "M.S. Subbulakshmi — voice that moved the United Nations",
    "C.V. Raman — Tamil Nadu's Nobel Prize physicist",
    "Tamil entrepreneurs running billion dollar companies",
    "Tamil doctors who changed modern medicine",
    "Tamil athletes who made the world watch",
    "Tamil architects designing the world's biggest buildings",
    "Tamil women who broke every glass ceiling",
    "Tamil scientists at NASA and ISRO",
    "Global Tamil CEOs leading Fortune 500 companies",
    "Tamil artists whose work is in world museums",
    "Tamil activists who changed laws globally",
    "Young Tamil innovators under 30",
  ],
  "Tamil Nadu Tourism": [
    "Kodaikanal — the lake city secrets most tourists miss",
    "Chettinad mansions — the abandoned palaces story",
    "Dhanushkodi — India's ghost town at land's end",
    "Yelagiri — Tamil Nadu's hidden hill station",
    "Ancient cave paintings of Tamil Nadu",
    "The hidden beach villages of Rameswaram",
    "Courtallam — waterfall capital of Tamil Nadu",
    "Ooty Botanical Garden — 150 year history",
    "Tranquebar — Tamil Nadu's Danish colony",
    "Nagapattinam — the Buddhist port city history",
    "The 5 sacred peaks of Tamil Nadu",
    "Tribal villages of the Nilgiris — Toda people",
    "Kalakkad Mundanthurai — Tamil Nadu's wildest forest",
    "Salt pan lakes and flamingo watching in Tamil Nadu",
    "Road trip — Chennai to Kanyakumari hidden stops",
  ],
};

const ALL_TOPICS = Object.entries(CONTENT_TOPICS).flatMap(([category, topics]) =>
  topics.map((topic) => ({ category, topic }))
);

// ─── TOPIC ROTATION ───────────────────────────────────────────────────────────

let topicIndex = 0;

function getNextTopic() {
  const item = ALL_TOPICS[topicIndex % ALL_TOPICS.length];
  topicIndex++;
  return item;
}

function getRandomTopic() {
  return ALL_TOPICS[Math.floor(Math.random() * ALL_TOPICS.length)];
}

// ─── GROQ CONTENT GENERATION ──────────────────────────────────────────────────

const BRAND_SYSTEM = `You are the content director of "TamilNadu Unfiltered" — the world's largest Tamil Nadu culture Instagram brand.

BRAND VOICE: Premium, educational, emotionally resonant. Proud without being divisive. Facts only — never myths as facts.

PSYCHOLOGY: Use pride, nostalgia, curiosity, and discovery ethically to drive shares and saves.

INSTAGRAM RULES:
- First line must STOP THE SCROLL (hook)
- Write for mobile readers — short sentences
- Every post must teach something they can tell someone today
- End with a clear CTA (save / share / comment)
- Hashtags: mix broad (#TamilNadu) + niche (#CholaDynasty) + location (#Chennai)`;

async function generateCaption(topic, category) {
  const prompt = `Write an Instagram caption for TamilNadu Unfiltered.

Topic: ${topic}
Category: ${category}

Return ONLY valid JSON, no markdown, no explanation:
{
  "hook": "first line that stops scrolling (max 12 words)",
  "body": "main caption body (150-200 words, emotional, educational, facts only)",
  "cta": "call to action line",
  "hashtags": "30 hashtags as single string",
  "image_prompt": "detailed text-to-image prompt for this topic (Tamil culture, photorealistic style, dramatic lighting)",
  "alt_text": "accessibility description of ideal image"
}`;

  const response = await getGroq().chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      { role: "system", content: BRAND_SYSTEM },
      { role: "user", content: prompt },
    ],
    temperature: 0.8,
    max_tokens: 1000,
  });

  const text = response.choices[0].message.content.trim();
  try {
    return JSON.parse(text);
  } catch {
    // Try to extract JSON if model added extra text
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error("Groq returned invalid JSON: " + text.slice(0, 200));
  }
}

async function generateReelScript(topic, category) {
  const prompt = `Write a 60-second Instagram Reel script for TamilNadu Unfiltered.

Topic: ${topic}
Category: ${category}

Return ONLY valid JSON:
{
  "hook_text": "on-screen text for first 3 seconds",
  "hook_voiceover": "spoken words for first 3 seconds",
  "script": [
    {"time": "0-5s", "voiceover": "...", "visual": "...", "text_overlay": "..."},
    {"time": "5-15s", "voiceover": "...", "visual": "...", "text_overlay": "..."},
    {"time": "15-30s", "voiceover": "...", "visual": "...", "text_overlay": "..."},
    {"time": "30-45s", "voiceover": "...", "visual": "...", "text_overlay": "..."},
    {"time": "45-60s", "voiceover": "...", "visual": "...", "text_overlay": "..."}
  ],
  "music_mood": "describe music style",
  "cta": "end screen CTA"
}`;

  const response = await getGroq().chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      { role: "system", content: BRAND_SYSTEM },
      { role: "user", content: prompt },
    ],
    temperature: 0.8,
    max_tokens: 1200,
  });

  const text = response.choices[0].message.content.trim();
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error("Invalid JSON from Groq");
  }
}

async function generateCarousel(topic, category) {
  const prompt = `Write a 9-slide Instagram Carousel for TamilNadu Unfiltered.

Topic: ${topic}
Category: ${category}

Return ONLY valid JSON:
{
  "cover": {"headline": "thumb-stopping title", "subheadline": "curiosity hook"},
  "slides": [
    {"number": 1, "headline": "max 8 words", "body": "max 35 words", "visual": "describe image"},
    {"number": 2, "headline": "...", "body": "...", "visual": "..."},
    {"number": 3, "headline": "...", "body": "...", "visual": "..."},
    {"number": 4, "headline": "...", "body": "...", "visual": "..."},
    {"number": 5, "headline": "...", "body": "...", "visual": "..."},
    {"number": 6, "headline": "...", "body": "...", "visual": "..."},
    {"number": 7, "headline": "...", "body": "...", "visual": "..."}
  ],
  "final_slide": {"cta": "follow + save message", "account": "@tamilnadu.unfiltered"}
}`;

  const response = await getGroq().chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      { role: "system", content: BRAND_SYSTEM },
      { role: "user", content: prompt },
    ],
    temperature: 0.8,
    max_tokens: 1500,
  });

  const text = response.choices[0].message.content.trim();
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error("Invalid JSON from Groq");
  }
}

async function generateBulkIdeas(category, count = 30) {
  const prompt = `Generate ${count} unique Instagram content ideas for TamilNadu Unfiltered.
Category focus: ${category || "all categories evenly"}

Return ONLY a valid JSON array:
[
  {
    "topic": "specific content topic",
    "category": "which pillar",
    "type": "reel or carousel or caption",
    "hook": "one viral hook line",
    "viral_angle": "why this will spread",
    "emotion": "pride or curiosity or nostalgia or discovery"
  }
]`;

  const response = await getGroq().chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      { role: "system", content: BRAND_SYSTEM },
      { role: "user", content: prompt },
    ],
    temperature: 0.9,
    max_tokens: 3000,
  });

  const text = response.choices[0].message.content.trim();
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\[[\s\S]*\]/);
    if (match) return JSON.parse(match[0]);
    throw new Error("Invalid JSON from Groq");
  }
}

module.exports = {
  generateCaption,
  generateReelScript,
  generateCarousel,
  generateBulkIdeas,
  getNextTopic,
  getRandomTopic,
  CONTENT_TOPICS,
  ALL_TOPICS,
};
