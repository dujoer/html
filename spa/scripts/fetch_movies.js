#!/usr/bin/env node
"use strict";
// 电影板块：
//  - 若配置了 TMDB_API_KEY（GitHub Secrets），则每日抓取真实热门电影 + 播出平台（美国区），
//    并带真实海报；否则回退到内置「精选种子数据」，保证开箱即用。
// 输出：data/movies.json，并回写 data/meta.json 的 moviesCount / moviesSource。
const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data");
const TMDB = "https://api.themoviedb.org/3";
const REGION = process.env.TMDB_REGION || "US";
const KEY = process.env.TMDB_API_KEY || "";
const IMG = "https://image.tmdb.org/t/p/w500";
const CAP = 40;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const stripHtml = (s) => (s || "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

function readMeta() {
  try {
    return JSON.parse(fs.readFileSync(path.join(DATA_DIR, "meta.json"), "utf8"));
  } catch (e) {
    return {};
  }
}
function writeMeta(patch) {
  const m = Object.assign(readMeta(), patch, { generatedAt: new Date().toISOString() });
  fs.writeFileSync(path.join(DATA_DIR, "meta.json"), JSON.stringify(m, null, 2));
  return m;
}

// ---- 内置精选种子（无 TMDB Key 时使用）----
const SEED = [
  { title: "Dune: Part Two", year: 2024, rating: 8.5, genres: ["科幻", "冒险"], platforms: ["Max", "Prime Video"], summary: "沙丘续章，保罗·厄崔迪联合契妮与弗雷曼人复仇。" },
  { title: "Oppenheimer", year: 2023, rating: 8.3, genres: ["剧情", "传记"], platforms: ["Peacock", "Apple TV+"], summary: "原子弹之父奥本海默的传记史诗。" },
  { title: "Spider-Man: Across the Spider-Verse", year: 2023, rating: 8.4, genres: ["动画", "动作"], platforms: ["Netflix"], summary: "多元宇宙蜘蛛侠的视觉盛宴。" },
  { title: "The Batman", year: 2022, rating: 7.8, genres: ["动作", "犯罪"], platforms: ["Max", "HBO"], summary: "黑暗骑士早期破案之旅。" },
  { title: "Everything Everywhere All at Once", year: 2022, rating: 7.9, genres: ["喜剧", "科幻"], platforms: ["Prime Video", "Apple TV+"], summary: "多元宇宙下的家庭温情与荒诞。" },
  { title: "Top Gun: Maverick", year: 2022, rating: 8.2, genres: ["动作", "剧情"], platforms: ["Paramount+"], summary: "马averick 重返蓝天，传承与突破。" },
  { title: "Avatar: The Way of Water", year: 2022, rating: 7.6, genres: ["科幻", "冒险"], platforms: ["Disney+"], summary: "潘多拉海洋世界的续章。" },
  { title: "John Wick: Chapter 4", year: 2023, rating: 7.7, genres: ["动作", "惊悚"], platforms: ["Peacock", "Prime Video"], summary: "杀神约翰·威克的高潮之战。" },
  { title: "Barbie", year: 2023, rating: 6.9, genres: ["喜剧", "奇幻"], platforms: ["Max"], summary: "芭比踏上自我认知之旅。" },
  { title: "Guardians of the Galaxy Vol. 3", year: 2023, rating: 7.9, genres: ["科幻", "动作"], platforms: ["Disney+"], summary: "银河护卫队终章。" },
  { title: "The Super Mario Bros. Movie", year: 2023, rating: 7.0, genres: ["动画", "冒险"], platforms: ["Peacock"], summary: "马力欧大电影。" },
  { title: "Mission: Impossible – Dead Reckoning", year: 2023, rating: 7.6, genres: ["动作", "惊悚"], platforms: ["Paramount+"], summary: "不可能任务系列新作。" },
  { title: "Elemental", year: 2023, rating: 7.0, genres: ["动画", "喜剧"], platforms: ["Disney+"], summary: "皮克斯元素都市的爱情故事。" },
  { title: "Past Lives", year: 2023, rating: 7.8, genres: ["剧情", "爱情"], platforms: ["Prime Video", "Apple TV+"], summary: "缘分与命运交织的温柔故事。" },
  { title: "Spiderman No Way Home", year: 2021, rating: 8.2, genres: ["动作", "科幻"], platforms: ["Netflix"], summary: "三代蜘蛛侠同框。" },
  { title: "Black Panther: Wakanda Forever", year: 2022, rating: 7.2, genres: ["动作", "科幻"], platforms: ["Disney+"], summary: "瓦坎达的哀悼与守护。" },
  { title: "Elvis", year: 2022, rating: 7.3, genres: ["传记", "剧情"], platforms: ["Hulu", "Disney+"], summary: "猫王传记电影。" },
  { title: "The Whale", year: 2022, rating: 7.6, genres: ["剧情"], platforms: ["Hulu"], summary: "布兰登·费舍主演的救赎故事。" },
  { title: "Nope", year: 2022, rating: 6.8, genres: ["科幻", "惊悚"], platforms: ["Peacock"], summary: "乔丹·皮尔执导的悬疑科幻。" },
  { title: "Glass Onion", year: 2022, rating: 7.9, genres: ["喜剧", "悬疑"], platforms: ["Netflix"], summary: "利刃出鞘续作。" }
];

function seedMovies() {
  return SEED.map((m, i) => ({
    id: "seed-" + i,
    title: m.title,
    type: "movie",
    year: m.year,
    genres: m.genres,
    rating: m.rating,
    summary: m.summary,
    image: null,
    platforms: m.platforms,
    url: null,
  }));
}

async function tmdbFetch(pathStr) {
  const sep = pathStr.indexOf("?") === -1 ? "?" : "&";
  const url = TMDB + pathStr + sep + "api_key=" + encodeURIComponent(KEY);
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error("tmdb " + pathStr + " -> " + res.status);
  return res.json();
}

async function main() {
  fs.mkdirSync(DATA_DIR, { recursive: true });

  if (!KEY) {
    const items = seedMovies();
    fs.writeFileSync(
      path.join(DATA_DIR, "movies.json"),
      JSON.stringify({ generatedAt: new Date().toISOString(), source: "curated", items })
    );
    const meta = writeMeta({ moviesCount: items.length, moviesSource: "curated" });
    console.log("MOVIES (curated seed):", items.length);
    return meta;
  }

  // 有 Key：抓真实数据
  let genreMap = {};
  try {
    const gl = await tmdbFetch("/genre/movie/list?language=zh-CN");
    (gl.genres || []).forEach((g) => (genreMap[g.id] = g.name));
  } catch (e) {
    console.error("genre list failed:", e.message);
  }
  await sleep(200);

  const trending = await tmdbFetch("/trending/movie/week?language=zh-CN");
  const movies = (trending.results || []).slice(0, CAP);
  const items = [];

  for (const mv of movies) {
    let providers = [];
    try {
      const det = await tmdbFetch("/movie/" + mv.id + "?append_to_response=watch/providers");
      const us = det["watch/providers"] && det["watch/providers"].results && det["watch/providers"].results[REGION];
      if (us) {
        const flat = (us.flatrate || []).map((p) => p.provider_name);
        providers = Array.from(new Set(flat));
      }
      items.push({
        id: "tmdb-" + mv.id,
        title: mv.title,
        type: "movie",
        year: mv.release_date ? parseInt(mv.release_date.slice(0, 4), 10) : null,
        genres: (mv.genre_ids || []).map((id) => genreMap[id] || "").filter(Boolean),
        rating: mv.vote_average != null ? Math.round(mv.vote_average * 10) / 10 : null,
        summary: stripHtml(mv.overview),
        image: mv.poster_path ? IMG + mv.poster_path : null,
        platforms: providers,
        url: "https://www.themoviedb.org/movie/" + mv.id,
      });
    } catch (e) {
      console.error("movie " + mv.id + " failed:", e.message);
    }
    await sleep(200);
  }

  fs.writeFileSync(
    path.join(DATA_DIR, "movies.json"),
    JSON.stringify({ generatedAt: new Date().toISOString(), source: "TMDB", items })
  );
  const meta = writeMeta({ moviesCount: items.length, moviesSource: "TMDB" });
  console.log("MOVIES (TMDB):", items.length);
  return meta;
}

if (require.main === module) {
  main().catch((e) => {
    console.error("FATAL", e);
    process.exit(1);
  });
}
module.exports = { main };
