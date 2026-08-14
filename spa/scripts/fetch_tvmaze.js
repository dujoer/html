#!/usr/bin/env node
"use strict";
// 每日从 TVmaze（免 API Key）抓取「今日新剧」与「未来 7 天即将上线」剧集。
// 输出：data/tv-today.json, data/tv-upcoming.json，并回写 data/meta.json 的电视剧计数。
const fs = require("fs");
const path = require("path");

const BASE = "https://api.tvmaze.com";
const UA = "spa-daily-recommender";
const DATA_DIR = path.join(__dirname, "..", "data");
const DAYS_UPCOMING = 7;
const CAP = 60;

const pad = (n) => (n < 10 ? "0" + n : "" + n);
const fmt = (d) =>
  d.getUTCFullYear() + "-" + pad(d.getUTCMonth() + 1) + "-" + pad(d.getUTCDate());
const stripHtml = (s) =>
  (s || "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function readMeta() {
  try {
    return JSON.parse(fs.readFileSync(path.join(DATA_DIR, "meta.json"), "utf8"));
  } catch (e) {
    return {};
  }
}
function writeMeta(patch) {
  const m = Object.assign(readMeta(), patch, {
    generatedAt: new Date().toISOString(),
  });
  fs.writeFileSync(path.join(DATA_DIR, "meta.json"), JSON.stringify(m, null, 2));
  return m;
}

async function getSchedule(dateStr) {
  const url = BASE + "/schedule?date=" + encodeURIComponent(dateStr);
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "application/json" },
  });
  if (!res.ok) throw new Error("schedule " + dateStr + " -> " + res.status);
  return res.json();
}

function normalizePlatforms(show) {
  const list = [];
  const wc = show.webChannel && show.webChannel.name;
  const net = show.network && show.network.name;
  if (wc) list.push({ name: wc, type: "streaming" });
  if (net && net !== wc) list.push({ name: net, type: "network" });
  return list;
}

function build(episodes, pickEarliest) {
  const map = new Map();
  for (const ep of episodes) {
    const show = ep.show || (ep._embedded && ep._embedded.show);
    if (!show || !show.id) continue;
    if (!map.has(show.id)) map.set(show.id, { show, eps: [] });
    map.get(show.id).eps.push(ep);
  }
  const items = [];
  for (const { show, eps } of map.values()) {
    const plats = normalizePlatforms(show);
    let chosen;
    if (pickEarliest) {
      chosen = eps
        .slice()
        .sort((a, b) => (a.airdate || "").localeCompare(b.airdate || ""))[0];
    } else {
      chosen = eps
        .slice()
        .sort(
          (a, b) =>
            (b.season || 0) * 100 + (b.number || 0) -
            ((a.season || 0) * 100 + (a.number || 0))
        )[0];
    }
    items.push({
      id: show.id,
      title: show.name,
      type: "tv",
      premiered: show.premiered || null,
      genres: show.genres || [],
      rating: show.rating && show.rating.average != null ? show.rating.average : null,
      summary: stripHtml(show.summary),
      image: show.image && (show.image.original || show.image.medium) ? (show.image.original || show.image.medium) : null,
      network: show.network ? show.network.name : null,
      webChannel: show.webChannel ? show.webChannel.name : null,
      platforms: plats.map((p) => p.name),
      episode: chosen
        ? { season: chosen.season, number: chosen.number, name: chosen.name, airdate: chosen.airdate }
        : null,
      url: show.url || null,
    });
  }
  items.sort((a, b) => (b.rating || 0) - (a.rating || 0));
  return items.slice(0, CAP);
}

async function main() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const today = new Date();
  let todayEps = [];
  let upEps = [];

  try {
    todayEps = await getSchedule(fmt(today));
  } catch (e) {
    console.error("today fetch failed:", e.message);
  }
  await sleep(250);

  for (let i = 1; i <= DAYS_UPCOMING; i++) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() + i);
    try {
      const eps = await getSchedule(fmt(d));
      upEps = upEps.concat(eps);
    } catch (e) {
      console.error("upcoming " + fmt(d) + " failed:", e.message);
    }
    await sleep(250);
  }

  const todayItems = build(todayEps, false);
  const upItems = build(upEps, true);

  fs.writeFileSync(
    path.join(DATA_DIR, "tv-today.json"),
    JSON.stringify({ generatedAt: new Date().toISOString(), source: "TVmaze", items: todayItems })
  );
  fs.writeFileSync(
    path.join(DATA_DIR, "tv-upcoming.json"),
    JSON.stringify({ generatedAt: new Date().toISOString(), source: "TVmaze", items: upItems })
  );

  const meta = writeMeta({
    source: "TVmaze",
    tvTodayCount: todayItems.length,
    tvUpcomingCount: upItems.length,
  });
  console.log("TVMAZE done:", JSON.stringify({ today: todayItems.length, upcoming: upItems.length }));
  return meta;
}

if (require.main === module) {
  main().catch((e) => {
    console.error("FATAL", e);
    process.exit(1);
  });
}
module.exports = { main };
