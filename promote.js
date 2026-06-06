/**
 * Manual promotion runner.
 *   node promote.js post              → publish one real post
 *   node promote.js followmore [N]    → follow-back + bulk follow (default 25, capped at 60/day)
 *   node promote.js followback [N]    → follow back your followers only
 *   node promote.js engage [N]        → like + comment burst from Tamil hashtags
 *   node promote.js all               → post, then engage, then followmore
 *
 * All actions obey the safe daily limits and human-like delays in growthEngine.js.
 */
require("./dns-fix");
require("dotenv").config();

const { runPostPipeline } = require("./scheduler");
const {
  followMore, followBack, likeFromHashtag, commentFromHashtag, dmNewFollowers, getGrowthStats,
} = require("./growthEngine");

const TAGS = ["tamilculture", "tamilnadu", "tamilhistory", "tamiltemples", "tamilpride", "tamilfood"];
const pick = () => TAGS[Math.floor(Math.random() * TAGS.length)];
const stamp = () => new Date().toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" });

async function doPost() {
  console.log(`[${stamp()}] 📤 Posting…`);
  const r = await runPostPipeline({ dryRun: false });
  console.log(`[${stamp()}] ${r.success ? "✅ Posted" : "❌ Failed"}: ${r.topic || r.error}`);
  return r;
}

async function doEngage(n = 6) {
  console.log(`[${stamp()}] ❤️  Engaging…`);
  const liked = await likeFromHashtag(pick(), n);
  const commented = await commentFromHashtag(pick(), Math.max(1, Math.floor(n / 4)));
  console.log(`[${stamp()}] ✅ Liked ${liked}, commented ${commented}`);
}

async function main() {
  const cmd = (process.argv[2] || "all").toLowerCase();
  const n = Number(process.argv[3]) || 0;

  if (cmd === "post")             await doPost();
  else if (cmd === "followmore")  await followMore(n || 25);
  else if (cmd === "followback")  await followBack(n || 20);
  else if (cmd === "engage")      await doEngage(n || 6);
  else if (cmd === "dm")          await dmNewFollowers(n || 5);
  else if (cmd === "all")       { await doPost(); await doEngage(6); await followMore(25); await dmNewFollowers(5); }
  else { console.log("Unknown command. Use: post | followmore | followback | engage | dm | all"); process.exit(1); }

  const s = getGrowthStats().today;
  console.log(`\n[${stamp()}] 📊 TODAY → follows ${s.follows}/60 · likes ${s.likes}/150 · comments ${s.comments}/20`);
  console.log("✅ promote.js finished");
}

main().catch((e) => { console.error("💥 promote.js error:", e.message); process.exit(1); });
