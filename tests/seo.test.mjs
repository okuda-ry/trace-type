import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const publicPages = [
  "index.html",
  "lab.html",
  "about.html",
  "how-to-play.html",
  "faq.html",
  "safety.html",
  "privacy.html",
];

const episodePages = Array.from(
  { length: 20 },
  (_, index) => `https://trace-type.com/lab/ep${String(index + 1).padStart(2, "0")}/`,
);

test("public HTML pages expose consistent search and social metadata", async () => {
  for (const page of publicPages) {
    const html = await readFile(page, "utf8");
    assert.match(html, /<html lang="ja">/);
    assert.match(html, /<title>[^<]+<\/title>/);
    assert.match(html, /<meta name="description" content="[^"]+">/);
    assert.match(html, /<link rel="canonical" href="https:\/\/trace-type\.com\//);
    assert.match(html, /<meta property="og:title" content="[^"]+">/);
    assert.match(html, /<meta property="og:description" content="[^"]+">/);
    assert.match(html, /<meta property="og:url" content="https:\/\/trace-type\.com\//);
    assert.match(html, /<meta name="twitter:card" content="summary">/);
    assert.match(html, /<meta name="twitter:title" content="[^"]+">/);
    assert.match(html, /<meta name="twitter:description" content="[^"]+">/);
  }
});

test("robots explicitly permits OAI-SearchBot without changing GPTBot policy", async () => {
  const robots = await readFile("robots.txt", "utf8");
  assert.match(robots, /User-agent: OAI-SearchBot\s+Allow: \/\s+/);
  assert.match(robots, /User-agent: \*\s+Allow: \/\s+/);
  assert.match(robots, /Sitemap: https:\/\/trace-type\.com\/sitemap\.xml/);
  assert.doesNotMatch(robots, /User-agent: GPTBot/);
});

test("sitemap contains only the intended canonical public URLs", async () => {
  const sitemap = await readFile("sitemap.xml", "utf8");
  const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(
    (match) => match[1],
  );
  const expected = [
    "https://trace-type.com/",
    "https://trace-type.com/lab.html",
    "https://trace-type.com/safety.html",
    "https://trace-type.com/privacy.html",
    "https://trace-type.com/about.html",
    "https://trace-type.com/how-to-play.html",
    "https://trace-type.com/faq.html",
    ...episodePages,
  ];
  assert.deepEqual(locs, expected);
  assert.ok(locs.every((url) => !url.includes("?")));
  assert.ok(locs.every((url) => !url.includes("404") && !url.includes("/api")));
});

test("index and lab retain useful copy before JavaScript executes", async () => {
  const index = await readFile("index.html", "utf8");
  const lab = await readFile("lab.html", "utf8");
  assert.equal((index.match(/class="home-episode-row"/g) || []).length, 20);
  assert.match(index, /置き去りの作業メモ/);
  assert.match(lab, /20エピソード・96ミッション/);
  assert.match(lab, /実際のシステムには接続せず/);
});
