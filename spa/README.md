# SPA · 每日剧集电影推荐

一个**纯前端单页应用（SPA）**：每天自动抓取最新剧集与电影，告诉你「今天有什么新剧、接下来上线什么」，以及「在哪个平台看」。完全免费、零后端、可直接用 GitHub Pages 托管。

> 电视剧数据来自 [TVmaze](https://www.tvmaze.com/)（免 API Key，每日自动抓取）；电影板块默认使用精选种子数据，配置免费 TMDB Key 后自动转为每日真实数据（含真实海报与播出平台）。

---

## 功能

- **今日新剧**：今天正在播出 / 上线的最新剧集单集。
- **即将上线**：未来 7 天即将开播的剧集。
- **电影**：热门电影（默认精选种子；接 TMDB 后为实时热门）。
- **在哪看**：每张卡片标注播出平台（Netflix / Disney+ / Max / Apple TV+ / Prime Video / Hulu / Peacock / Paramount+ 等，以及传统电视网）。
- **平台筛选 + 搜索**：按平台一键过滤，按剧名 / 电影 / 平台关键词搜索。
- **深浅主题**：自动跟随系统，可手动切换，记忆偏好。
- **响应式**：PC 多列网格，手机自动单列。

---

## 技术架构

```
spa/
├─ index.html              # 单文件 SPA（HTML+CSS+JS 内联，零构建）
├─ scripts/
│  ├─ fetch_tvmaze.js      # 每日抓电视剧（TVmaze，免 Key）
│  └─ fetch_movies.js      # 抓电影（有 TMDB Key 抓实时，否则写精选种子）
├─ data/                   # 由 GitHub Actions 每日生成并提交
│  ├─ tv-today.json
│  ├─ tv-upcoming.json
│  ├─ movies.json
│  └─ meta.json
└─ .github/workflows/daily.yml   # 定时任务：每天抓取并 commit
```

数据流程：GitHub Actions 按计划运行脚本 → 抓取并写出 `data/*.json` → 提交回仓库 → GitHub Pages 直接托管静态文件，前端 `index.html` 拉取这些 JSON 渲染。前端**不依赖任何密钥**，API Key 只存在于仓库 Secrets 与 Action 运行环境。

---

## 部署（三步）

1. **Fork / Clone 本仓库**（或直接用本仓库）。
2. **开启 GitHub Pages**：仓库 `Settings → Pages → Source` 选择 **Deploy from a branch**，分支选 **`main`**，目录选 **`/root`**，保存。
   - 稍等一两分钟，访问 `https://<你的用户名>.github.io/spa/` 即可。
3. **等一次自动更新**：每天的定时任务（北京时间约 08:00）会生成真实数据；你也可以到 `Actions` 标签页手动 `Run workflow` 立即跑一次。

> 数据在首次 Action 运行前为空时，网站会回退到内置示例数据，界面照常可用。

---

## 可选：接入 TMDB 让电影变「实时」

电影板块默认是精选种子。想要每日真实热门电影 + 真实海报 + 精确播出平台：

1. 到 [themoviedb.org](https://www.themoviedb.org/) 免费注册，申请一个 API Key（v3 auth）。
2. 仓库 `Settings → Secrets and variables → Actions → New repository secret`：
   - `TMDB_API_KEY` = 你的 Key
   - （可选）`TMDB_REGION` = 地区代码，默认 `US`（如想看其它地区平台改成对应代码）
3. 手动触发一次 `每日数据更新` Action，电影数据即变为实时。

不配置也完全没问题——电视剧依旧每日实时更新。

---

## 本地预览 / 开发

```bash
# 预览网站（直接双击 index.html 也可，会用内置示例数据）
# 生成数据：
node scripts/fetch_tvmaze.js     # 需要网络访问 api.tvmaze.com
node scripts/fetch_movies.js     # 无 Key 时写精选种子；有 TMDB_API_KEY 时写实时
```

---

## 自定义

- **改默认地区 / 平台映射**：前端徽章颜色在 `index.html` 的 `PLATFORM_COLORS`；电影地区在 `fetch_movies.js` 的 `TMDB_REGION`。
- **改抓取数量 / 提前天数**：`fetch_tvmaze.js` 顶部的 `CAP`、`DAYS_UPCOMING`。
- **换更新时间**：`.github/workflows/daily.yml` 里的 cron 表达式。

---

## 说明

- 本站为公开信息的聚合展示，**播放请前往各平台官方渠道**。
- 数据版权归各数据源（TVmaze / TMDB）所有，本站仅做索引与推荐。
- 许可证：MIT
