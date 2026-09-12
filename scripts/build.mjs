import { access, cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const output = new URL("dist/", root);
const siteOrigin = "https://trace-type.com";
const episodeGuides = JSON.parse(await readFile(new URL("data/episode-guides.json", root), "utf8"));

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function safeJson(value) {
  return JSON.stringify(value).replaceAll("<", "\\u003c");
}

function episodePage(episode, index, episodes) {
  const number = String(episode.number).padStart(2, "0");
  const canonical = `${siteOrigin}/lab/${episode.id}/`;
  const pageTitle = `EP ${number}「${episode.title}」 — TRACE / TYPE`;
  const description = `${episode.title}：${episode.subtitle}。TRACE / TYPEで架空ログを読み、セキュリティ調査の考え方を学ぶエピソードです。`;
  const intro = episode.learningIntro;
  const guide = episodeGuides[episode.id];
  const guideHtml = guide ? `<section aria-labelledby="guideTitle">
      <h2 id="guideTitle">調査の考え方を知る</h2>
      ${guide.map(({ question, answer }) => `<h3>${escapeHtml(question)}</h3><p>${escapeHtml(answer)}</p>`).join("\n      ")}
      </section>` : "";
  const previous = episodes[index - 1];
  const next = episodes[index + 1];
  const schema = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: pageTitle,
    url: canonical,
    description,
    isPartOf: { "@type": "WebSite", name: "TRACE / TYPE", url: `${siteOrigin}/` },
    inLanguage: "ja-JP",
    breadcrumb: {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "TRACE / TYPE", item: `${siteOrigin}/` },
        { "@type": "ListItem", position: 2, name: "エピソードの内容", item: `${siteOrigin}/about#episodes` },
        { "@type": "ListItem", position: 3, name: `EP ${number} ${episode.title}`, item: canonical },
      ],
    },
  };
  const missionItems = episode.missions
    .map(
      (mission) =>
        `        <li><strong>${escapeHtml(mission.title)}</strong><span>${escapeHtml(mission.goal)}</span></li>`,
    )
    .join("\n");
  const previousLink = previous
    ? `<a class="home-resume" href="../${previous.id}/">← EP ${String(previous.number).padStart(2, "0")}</a>`
    : "";
  const nextLink = next
    ? `<a class="home-resume" href="../${next.id}/">EP ${String(next.number).padStart(2, "0")} →</a>`
    : "";
  return `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="description" content="${escapeHtml(description)}">
  <title>${escapeHtml(pageTitle)}</title>
  <meta name="theme-color" content="#101113">
  <link rel="canonical" href="${canonical}">
  <meta property="og:locale" content="ja_JP">
  <meta property="og:type" content="article">
  <meta property="og:title" content="${escapeHtml(pageTitle)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:url" content="${canonical}">
  <meta property="og:site_name" content="TRACE / TYPE">
  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" content="${escapeHtml(pageTitle)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <script type="application/ld+json">${safeJson(schema)}</script>
  <link rel="stylesheet" href="../../home.css">
  <link rel="icon" href="../../favicon.svg" type="image/svg+xml">
</head>
<body class="home-page">
  <header class="home-nav" aria-label="グローバルナビゲーション">
    <a class="home-wordmark" href="../../">TRACE / TYPE</a>
    <a class="home-resume" href="../../lab.html?episode=${episode.id}">EP ${number}を始める →</a>
  </header>
  <main class="home-main">
    <nav class="episode-landing-nav breadcrumbs" aria-label="パンくずリスト">
      <a href="../../">TRACE / TYPE</a><span aria-hidden="true">/</span>
      <a href="../../about.html#episodes">エピソードの内容</a><span aria-hidden="true">/</span>
      <span aria-current="page">EP ${number} ${escapeHtml(episode.title)}</span>
    </nav>
    <article class="home-hero page-article episode-landing" aria-labelledby="episodeLandingTitle">
      <p class="home-tagline">EP ${number} / EPISODE BRIEF</p>
      <h1 id="episodeLandingTitle">${escapeHtml(episode.title)}</h1>
      <p>${escapeHtml(episode.subtitle)}</p>
      <p>${escapeHtml(episode.briefing)}</p>

      ${intro ? `<h2>このエピソードで学ぶこと</h2>
      <p>${escapeHtml(intro.body)}</p>
      <p>${escapeHtml(intro.focus)}</p>` : ""}

      <h2>ミッション</h2>
      <ol>
${missionItems}
      </ol>

      ${guideHtml}

      <p><a class="home-resume" href="../../lab.html?episode=${episode.id}">ブラウザラボでEP ${number}を始める →</a></p>
      <nav class="episode-landing-nav" aria-label="エピソード移動">
        ${previousLink}
        <a class="home-resume" href="../../about.html#episodes">概要一覧</a>
        ${nextLink}
      </nav>
    </article>
  </main>
  <footer class="home-footer">
    <span class="home-footer-copy">TRACE / TYPE · タイピングで学ぶセキュリティ教材</span>
    <a class="home-resume" href="../../about.html">TRACE / TYPEとは</a>
    <a class="home-resume" href="../../how-to-play.html">遊び方</a>
    <a class="home-resume" href="../../faq.html">FAQ</a>
    <a class="home-resume" href="../../safety.html">安全方針</a>
  </footer>
</body>
</html>
`;
}

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });

const runtimeFiles = [
  "index.html",
  "lab.html",
  "home.css",
  "styles.css",
  "tokens.css",
  "home.js",
  "app.js",
  "progression.js",
  "typing-engine.js",
  "favicon.svg",
];

for (const file of runtimeFiles) {
  await cp(new URL(file, root), new URL(file, output));
}

await cp(new URL("data/", root), new URL("data/", output), { recursive: true });

const optionalFiles = [
  "404.html",
  "about.html",
  "how-to-play.html",
  "faq.html",
  "safety.html",
  "privacy.html",
  "robots.txt",
  "sitemap.xml",
  "_headers",
];
for (const file of optionalFiles) {
  try {
    await access(new URL(file, root));
    await cp(new URL(file, root), new URL(file, output));
  } catch {
    // Optional deployment metadata is copied only when it exists.
  }
}

const missionData = JSON.parse(
  await readFile(new URL("data/missions.json", root), "utf8"),
);
for (const [index, episode] of missionData.episodes.entries()) {
  const episodeDirectory = new URL(`lab/${episode.id}/`, output);
  await mkdir(episodeDirectory, { recursive: true });
  await writeFile(
    new URL("index.html", episodeDirectory),
    episodePage(episode, index, missionData.episodes),
    "utf8",
  );
}

console.log(
  `Built ${runtimeFiles.length} runtime files, ${missionData.episodes.length} episode pages, and data/ into dist/`,
);
