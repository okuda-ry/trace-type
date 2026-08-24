import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  flattenMissions,
  isMissionUnlocked,
  nextMissionPosition,
  episodeProgress,
  normalizeCompleted,
  normalizeMisses,
  resolveInitialMissionId,
} from "../progression.js";

const data = JSON.parse(fs.readFileSync(new URL("../data/missions.json", import.meta.url)));
const all = flattenMissions(data);
const required = ["id", "order", "title", "goal", "context", "category", "command", "tokens", "output", "evidence", "handoff", "quiz"];
const allowedKinds = new Set(["command", "option", "argument", "operator"]);
function shellOperators(command) {
  const found = [];
  let quote = "";
  let escaped = false;
  for (const char of command) {
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\" && quote) {
      escaped = true;
      continue;
    }
    if (quote) {
      if (char === quote) quote = "";
      continue;
    }
    if (char === "'" || char === '"') {
      quote = char;
    } else if (char === "|" || char === ">" || char === ";") {
      found.push(char);
    }
  }
  return found;
}

test("schema has twenty episodes and ninety-six missions", () => {
  assert.equal(data.version, 2);
  assert.equal(data.episodes.length, 20);
  assert.equal(all.length, 96);
  assert.equal(new Set(all.map((m) => m.id)).size, 96);
  for (const [index, ep] of data.episodes.entries()) {
    assert.equal(ep.number, index + 1);
    assert.equal(ep.id, "ep" + String(index + 1).padStart(2, "0"));
    assert.equal(ep.missions.length, index < 4 ? 4 : 5);
    ep.missions.forEach((m, i) => {
      assert.equal(m.id, ep.id + "-m" + (i + 1));
      assert.equal(m.order, i + 1);
    });
  }
});

test("each episode starts unlocked and gates only its next mission", () => {
  for (const ep of data.episodes) {
    assert.equal(isMissionUnlocked(data, ep.missions[0].id, []), true, ep.id);
    assert.equal(isMissionUnlocked(data, ep.missions[1].id, []), false, ep.id);
    assert.equal(
      isMissionUnlocked(data, ep.missions[1].id, [ep.missions[0].id]),
      true,
      ep.id,
    );
  }
  assert.equal(isMissionUnlocked(data, "ep02-m2", ["ep01-m4"]), false);
});

test("previous completion unlocks next and boundary next works", () => {
  assert.equal(isMissionUnlocked(data, all[1].id, [all[0].id]), true);
  assert.equal(nextMissionPosition(data, all[3].id).id, all[4].id);
});

test("episode progress counts completed missions", () => {
  assert.deepEqual(episodeProgress(data, "ep01", ["ep01-m1", "ep01-m2"]), { done: 2, total: 4 });
  assert.deepEqual(episodeProgress(data, "ep05", ["ep05-m1"]), { done: 1, total: 5 });
  assert.deepEqual(episodeProgress(data, "ep01", ["ep01-m1", "ep01-m1", "ep01-m2"]), { done: 2, total: 4 });
});

test("all missions have required fields and ordered tokens", () => {
  for (const m of all) {
    for (const key of required) assert.ok(m[key], m.id + ": missing " + key);
    let cursor = 0;
    for (const token of m.tokens) {
      assert.ok(allowedKinds.has(token.kind), m.id + ": token kind " + token.kind);
      assert.ok(token.text, m.id + ": empty token");
      const at = m.command.indexOf(token.text, cursor);
      assert.ok(at >= cursor, m.id + ": token order " + token.text);
      cursor = at + token.text.length;
    }
  }
});

test("outputs start with their exact command prompt", () => {
  for (const m of all) {
    const ep = data.episodes.find((item) => item.id === m.episodeId);
    const prefix = ep && ep.number === 16 ? "PS> " : "$ ";
    assert.equal(m.output.split("\n")[0], prefix + m.command, m.id);
    assert.ok(m.output.trim().length > prefix.length);
  }
});

test("choices are four unique short options with one answer", () => {
  for (const m of all) {
    assert.equal(m.quiz.choices.length, 4, m.id);
    assert.equal(new Set(m.quiz.choices).size, 4, m.id);
    assert.ok(Number.isInteger(m.quiz.answer) && m.quiz.answer >= 0 && m.quiz.answer < 4, m.id);
    for (const choice of m.quiz.choices) assert.ok(choice.length <= 18, m.id + ": " + choice);
  }
  assert.equal(new Set(all.map((m) => JSON.stringify(m.quiz.choices))).size, all.length);
});

test("handoffs and quiz explanations are nonempty and unique", () => {
  assert.equal(new Set(all.map((m) => m.handoff)).size, all.length);
  assert.equal(new Set(all.map((m) => m.quiz.explain)).size, all.length);
  assert.ok(all.every((m) => m.handoff && m.quiz.explain));
});

test("command strings avoid dangerous operations", () => {
  const forbidden = /(?:^|[;&|]\s*)(?:sudo(?!\s+-l(?:\s|$))|systemctl\s+(?:start|stop|restart|enable|disable)|kubectl\s+(?:exec|apply|delete)|(?:rm|shred|dd)(?:\s|$)|(?:curl|wget|nc|nmap|hydra)(?:\s|$))/i;
  for (const m of all) assert.equal(forbidden.test(m.command), false, m.id + ": " + m.command);
});

test("fictional targets use .test and RFC5737 addresses only", () => {
  const text = JSON.stringify(data);
  assert.equal(/(?:^|[^0-9])(?:10\.0\.|172\.(?:1[6-9]|2[0-9]|3[01])\.|192\.168\.)/.test(text), false);
  for (const ip of text.match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g) || []) {
    assert.ok(["192.0.2.", "198.51.100.", "203.0.113."].some((prefix) => ip.startsWith(prefix)), ip);
  }
  for (const domain of text.match(/\b[a-z0-9-]+\.(?:com|net|org|io|local|internal|test)\b/gi) || []) {
    assert.ok(domain.toLowerCase().endsWith(".test"), domain);
  }
});

test("expected choices for the original sixteen missions remain stable", () => {
  const expected = {
    "ep01-m1": "現在の作業ディレクトリ", "ep01-m2": ".case-idなど隠し項目も表示", "ep01-m3": "教材内の現在の作業ディレクトリ", "ep01-m4": "ops-traineeとNS-248",
    "ep02-m1": "現在の有効ユーザー", "ep02-m2": "ユーザーの所属グループ", "ep02-m3": "許可ルールを実行せず確認", "ep02-m4": "restart試行は拒否・記録された",
    "ep03-m1": "MX配送先の変更", "ep03-m2": "対応するIPv4アドレス", "ep03-m3": "ドメインのメール配送先", "ep03-m4": "MX変更の承認記録がない",
    "ep04-m1": "大文字小文字を区別しない", "ep04-m2": "左の出力をgrepへ渡す", "ep04-m3": "一致行をerrors.txtへ送る", "ep04-m4": "同一IPの連続事象。要追加調査",
  };
  for (const [id, choice] of Object.entries(expected)) {
    const m = all.find((item) => item.id === id);
    assert.equal(m.quiz.choices[m.quiz.answer], choice, id);
  }
});

test("progression state normalization remains safe", () => {
  assert.deepEqual(normalizeCompleted(data, ["ep01-m1", "ep01-m1", "unknown"]), ["ep01-m1"]);
  assert.deepEqual(normalizeMisses(data, { "ep01-m1": 2.9, "ep01-m2": Number.NaN, "ep01-m3": -1, unknown: 4, "ep01-m4": 0 }), { "ep01-m1": 2, "ep01-m4": 0 });
  assert.equal(resolveInitialMissionId(data, ["ep01-m1"], "missing"), "ep01-m2");
  assert.equal(resolveInitialMissionId(data, [], null), "ep01-m1");
  assert.equal(resolveInitialMissionId(data, [], "ep06-m1"), "ep06-m1");
  assert.equal(resolveInitialMissionId(data, [], "ep06-m2"), "ep01-m1");
  assert.equal(resolveInitialMissionId(data, ["ep01-m1"], "ep01-m1"), "ep01-m1");
  assert.equal(resolveInitialMissionId(data, all.map((m) => m.id), null), "ep20-m5");
  assert.equal(resolveInitialMissionId({ episodes: [] }, [], "x"), null);
});

test("operators are represented as tokens", () => {
  assert.ok(all.find((m) => m.command.includes("|")).tokens.some((t) => t.text === "|"));
  assert.ok(all.find((m) => m.command.includes(">")).tokens.some((t) => t.text === ">"));
});

test("content avoids generic teaching placeholders", () => {
  const text = JSON.stringify(data);
  assert.equal(/をこのコマンド内の要素として読みます|の役割を確認すると|実行前に対象と結果を確認する|この出力は|するを行い|するへ進みます|前の手掛かりを受けて安全に確認する|Training evidence for|この確認で大切な判断は？|固有手掛かり/.test(text), false);
});

test("visible copy avoids simulation jargon", () => {
  const visible = fs.readFileSync(new URL("../lab.html", import.meta.url), "utf8") + fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
  assert.equal(/模擬|SAFE SIMULATION|模擬証拠|模擬実行/.test(visible), false);
});

test("token explanations are substantive", () => {
  for (const m of all) {
    for (const token of m.tokens) {
      assert.ok(token.meaning && token.meaning.length >= 10, m.id + ": meaning");
      assert.ok(token.why && token.why.length >= 10, m.id + ": why");
      assert.ok(token.safety && token.safety.length >= 10, m.id + ": safety");
    }
  }
});

test("narrative evidence keys remain present", () => {
  const text = JSON.stringify(data);
  for (const key of ["ops-trainee", "NS-248", "ticket=NONE", "source=203.0.113.17", "result=denied", "侵害確定とは断定"]) {
    assert.ok(text.includes(key), key);
  }
});

test("attack-oriented teaching terms are absent", () => {
  const text = JSON.stringify(data);
  assert.equal(/sudo -i|su -|credential theft|exploit/i.test(text), false);
});

test("shell operators are tokenized only outside quoted expressions", () => {
  for (const m of all) {
    const operators = shellOperators(m.command);
    for (const operator of new Set(operators)) {
      assert.ok(m.tokens.some((token) => token.text === operator), m.id + ": " + operator);
    }
  }
});

test("commands stay within typing length budget", () => {
  for (const m of all) assert.ok(m.command.length <= 100, m.id + ": " + m.command.length);
});

test("app keeps episode progress map synchronized on state changes", () => {
  const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
  assert.match(app, /function syncEpisodeMap\(\)/);
  assert.match(app, /function renderEpisode\(\)[\s\S]*?syncEpisodeMap\(\);/);
  assert.match(app, /b\.onclick = \(\) => \{\s*selectEpisode\(i\);/);
  assert.match(app, /function episodeMissionId\(index\)/);
  assert.match(app, /function selectEpisode\(index\)[\s\S]*?select\(id\)[\s\S]*?closeEpisodePicker\(\);/);
  assert.match(app, /b\.onclick = \(\) => select\(m\.id\)/);
  assert.match(app, /function answer\([\s\S]*?completed = \[\.\.\.new Set/);
  assert.match(app, /completed = \[\];[\s\S]*?select\(missions\[0\]\.id\)/);
  assert.match(app, /function renderEpisode\(\)[\s\S]*?syncEpisodeMap\(\);/);
});

test("app revalidates教材 data on load", () => {
  const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
  assert.match(app, /fetch\("\.\/data\/missions\.json",\s*\{\s*cache:\s*["']no-cache["']\s*\}\)/);
  assert.doesNotMatch(app, /fetch\("\.\/data\/missions\.json",\s*\{\s*cache:\s*["']no-store["']/);
});

test("lab page busts app and stylesheet caches for the current教材 release", () => {
  const lab = fs.readFileSync(new URL("../lab.html", import.meta.url), "utf8");
  assert.match(lab, /<script\s+type="module"\s+src="app\.js\?v=20260825-home1"><\/script>/);
  assert.match(lab, /<link\s+rel="stylesheet"\s+href="styles\.css\?v=20260825-home1">/);
});

test("app busts its module dependency caches with the same release key", () => {
  const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
  assert.match(app, /from "\.\/typing-engine\.js\?v=20260825-home1"/);
  assert.match(app, /from "\.\/progression\.js\?v=20260825-home1"/);
});

test("desktop mission panel has an accessible collapsible rail", () => {
  const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
  const css = fs.readFileSync(new URL("../styles.css", import.meta.url), "utf8");
  const lab = fs.readFileSync(new URL("../lab.html", import.meta.url), "utf8");
  assert.match(lab, /id="storyToggle"[^>]*aria-controls="storyContent"[^>]*aria-expanded="true"[^>]*aria-label="左欄を閉じる"[^>]*title="左欄を閉じる"/);
  assert.match(lab, /<span class="story-toggle-label" id="storyToggleLabel">左欄を閉じる<\/span>/);
  assert.match(lab, /<div class="story-content" id="storyContent">[\s\S]*id="episodeTitle"[\s\S]*id="missionSequence"/);
  assert.match(app, /const missionPanelStorageKey = "trace-v2-mission-panel-collapsed"/);
  assert.match(app, /function isDesktopMissionPanel\(\)[\s\S]*min-width: 60rem/);
  assert.match(app, /e\.storyContent\.hidden = collapsed/);
  assert.match(app, /e\.storyToggle\.setAttribute\("aria-expanded", String\(!collapsed\)\)/);
  assert.match(app, /const label = collapsed \? "左欄を開く" : "左欄を閉じる"/);
  assert.match(app, /e\.storyToggle\.title = label/);
  assert.match(app, /missionPanelMedia\.addEventListener\("change", syncMissionPanel\)/);
  assert.match(css, /@media \(min-width: 60rem\)[\s\S]*?\.lab-layout\.story-panel-collapsed[\s\S]*?grid-template-columns: 48px minmax\(0, 1fr\) minmax\(300px, 340px\)/);
  assert.match(css, /@media \(min-width: 60rem\)[\s\S]*?\.story-toggle \{[\s\S]*?display: inline-flex/);
  assert.match(css, /\.story-toggle-label[\s\S]*?clip-path: inset\(50%\)/);
  assert.match(css, /\.story-toggle \{[\s\S]*?width: 44px[\s\S]*?height: 44px[\s\S]*?border: 1px solid transparent[\s\S]*?background: transparent[\s\S]*?white-space: nowrap/);
  assert.match(css, /@media \(min-width: 60rem\)[\s\S]*?\.story-column \{[\s\S]*?position: relative[\s\S]*?border-inline-end: 1px solid var\(--color-rule\)[\s\S]*?padding-inline-end/);
  assert.match(css, /@media \(min-width: 60rem\)[\s\S]*?\.story-toggle \{[\s\S]*?position: absolute[\s\S]*?inset-inline-end: 0/);
  assert.match(css, /\.story-panel-collapsed \.story-column[\s\S]*?padding-inline: 0/);
  assert.doesNotMatch(css, /transition\s*:\s*all/);
});

test("episode map stays readable in desktop grids and scrolls on mobile", () => {
  const css = fs.readFileSync(new URL("../styles.css", import.meta.url), "utf8");
  assert.match(css, /@media \(min-width: 40rem\)[\s\S]*?\.episode-button \{[\s\S]*?flex-direction: column;[\s\S]*?min-height: 52px;[\s\S]*?height: auto;/);
  assert.match(css, /\.episode-button span \{[\s\S]*?overflow: visible;[\s\S]*?text-overflow: clip;[\s\S]*?white-space: normal;/);
  assert.match(css, /@media \(min-width: 60rem\) and \(max-width: 71\.99rem\)[\s\S]*?grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(css, /@media \(max-width: 39\.99rem\)[\s\S]*?\.episode-picker\[open\] \.episode-map[\s\S]*?flex-direction: column;[\s\S]*?overflow-y: auto;/);
  assert.match(css, /\.episode-picker\[open\] \.episode-button span[\s\S]*?white-space: normal;/);
});

test("episode disclosure keeps every episode selectable and synchronized", () => {
  const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
  const css = fs.readFileSync(new URL("../styles.css", import.meta.url), "utf8");
  const lab = fs.readFileSync(new URL("../lab.html", import.meta.url), "utf8");
  assert.match(app, /button\.disabled = false/);
  assert.match(app, /button\.setAttribute\("aria-disabled", "false"\)/);
  assert.match(app, /e\.currentSummary\.textContent/);
  assert.match(app, /e\.currentProgress\.textContent/);
  assert.match(app, /renderText\(button, p\.done \+ "\/" \+ p\.total \+ " 完了", "small"\)/);
  assert.match(lab, /<details class="episode-picker" id="episodePicker">/);
  assert.match(lab, /<summary class="episode-picker-summary" aria-label="エピソードを選ぶ" aria-controls="episodeMap" aria-expanded="false">/);
  assert.match(lab, /id="episodeMap"/);
  assert.match(app, /function syncEpisodePickerState\(\)/);
  assert.match(app, /e\.picker\?\.addEventListener\("toggle", \(\) => \{[\s\S]*?requestAnimationFrame\(scrollCurrentEpisodeIntoView\)/);
  assert.match(css, /\.episode-picker-summary[\s\S]*?min-height: 44px/);
  assert.match(css, /\.episode-picker\[open\] \.episode-map[\s\S]*?max-height:[\s\S]*?overflow-y: auto/);
});

test("command palette has useful grouped search and keyboard accessibility", () => {
  const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
  const lab = fs.readFileSync(new URL("../lab.html", import.meta.url), "utf8");
  const css = fs.readFileSync(new URL("../styles.css", import.meta.url), "utf8");
  assert.match(lab, /エピソード／ミッションへ移動/);
  assert.match(lab, /EP名・ミッション名・コマンドを検索/);
  assert.match(lab, /role="combobox"[\s\S]*aria-controls="paletteResults"[\s\S]*aria-expanded="false"[\s\S]*aria-haspopup="listbox"/);
  assert.match(lab, /role="listbox"/);
  assert.match(lab, /↑↓ 移動 · Enter 決定 · Esc 閉じる/);
  assert.match(app, /const maxResults = 8/);
  assert.match(app, /ep\.id/);
  assert.match(app, /String\(ep\.number\)\.padStart\(2, "0"\)/);
  assert.match(app, /const nearby = \[\.\.\.new Set\(\[episodeIndex, episodeIndex \+ 1, episodeIndex - 1\]\)/);
  assert.match(app, /lab\.episodes\[episodeIndex\]\?\.missions\.forEach/);
  const episodeSearchStart = app.indexOf("const episodeSearch =");
  const missionSearchStart = app.indexOf("const missionSearch =", episodeSearchStart);
  assert.ok(episodeSearchStart >= 0 && missionSearchStart > episodeSearchStart);
  assert.doesNotMatch(app.slice(episodeSearchStart, missionSearchStart), /briefing/);
  assert.match(app, /const bothKinds = episodeMatches\.length > 0 && missionMatches\.length > 0/);
  assert.match(app, /const episodeLimit = bothKinds \? Math\.min\(4, episodeMatches\.length\) : maxResults/);
  assert.match(app, /Math\.min\(maxResults - episodes\.length, missionMatches\.length\)/);
  assert.match(app, /heading\("エピソード"\)/);
  assert.match(app, /heading\("ミッション"\)/);
  assert.match(app, /node\.setAttribute\("role", "presentation"\)/);
  assert.match(app, /ep\.subtitle/);
  assert.match(app, /m\.command/);
  assert.match(app, /前のミッション完了後に解放/);
  assert.match(app, /if \(event\.key === "Enter"\) event\.preventDefault\(\);/);
  assert.match(app, /e\.paletteInput\.setAttribute\("aria-expanded", "true"\)/);
  assert.match(app, /e\.paletteInput\.setAttribute\("aria-expanded", "false"\)/);
  assert.match(app, /e\.paletteInput\.removeAttribute\("aria-activedescendant"\)/);
  assert.match(app, /aria-activedescendant/);
  assert.match(app, /setPaletteActive\(0\)/);
  assert.match(css, /font-family: var\(--font-code\)/);
  assert.doesNotMatch(css, /var\(--font-mono\)/);
  assert.match(css, /transition: transform var\(--dur-short\) var\(--ease-out\)/);
  assert.match(css, /\.palette-head button[\s\S]*?min-width: 44px/);
});

test("episode picker keeps the current item visible in its open vertical list", () => {
  const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
  const css = fs.readFileSync(new URL("../styles.css", import.meta.url), "utf8");
  assert.match(app, /if \(!currentButton \|\| !e\.picker\?\.open \|\| !e\.map\.clientHeight\) return/);
  assert.match(app, /currentButton\.offsetTop/);
  assert.match(app, /e\.map\.scrollTop = Math\.max\(0, Math\.min\(target, maximum\)\)/);
  assert.doesNotMatch(app.slice(app.indexOf("function scrollCurrentEpisodeIntoView"), app.indexOf("function renderEpisode")), /scrollLeft/);
  assert.match(app, /if \(e\.picker\.open\) requestAnimationFrame\(scrollCurrentEpisodeIntoView\)/);
  assert.match(css, /@media \(max-width: 35rem\)[\s\S]*?\.episode-picker-label \{[\s\S]*?display: none;/);
  assert.match(css, /@media \(max-width: 35rem\)[\s\S]*?\.episode-picker-summary \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\) auto auto;/);
});

test("locked mission controls expose their unlock reason", () => {
  const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
  assert.match(app, /b\.title = reason/);
  assert.match(app, /b\.setAttribute\("aria-label", `\$\{m\.order\}\. \$\{m\.title\}。\$\{reason\}`\)/);
  assert.match(app, /b\.setAttribute\("aria-label", `EP \$\{ep\.number\} · M\$\{m\.order\} · \$\{m\.title\}。\$\{reason\}`\)/);
});

test("index is the public home and lab remains the lesson page", () => {
  const index = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const lab = fs.readFileSync(new URL("../lab.html", import.meta.url), "utf8");
  const homeCss = fs.readFileSync(new URL("../home.css", import.meta.url), "utf8");
  assert.match(index, /<link rel="stylesheet" href="home\.css\?v=20260825-home2">/);
  assert.match(index, /<script type="module" src="home\.js\?v=20260825-home2"><\/script>/);
  assert.match(index, /<h1 id="homeTitle">TRACE \/ TYPE<\/h1>/);
  assert.match(index, /<p class="home-tagline">TYPE → UNDERSTAND\.<\/p>/);
  assert.doesNotMatch(index, /SECURITY LAB/);
  assert.match(index, /コマンドを一文字ずつ入力し、その意味と調査での役割を学びます。/);
  assert.match(index, /基礎からインシデント対応まで、続きもののエピソードで進みます。/);
  assert.match(index, /id="episodeList"[\s\S]*aria-label="エピソード一覧"/);
  assert.match(index, /id="homeStatus" role="status" aria-live="polite"/);
  assert.match(index, /name="description"/);
  assert.match(index, /name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"/);
  assert.match(lab, /<a class="wordmark" href="\.\/">/);
  assert.doesNotMatch(lab, /SECURITY LAB/);
  assert.match(lab, /styles\.css\?v=20260825-home1/);
  assert.match(lab, /app\.js\?v=20260825-home1/);
  assert.match(homeCss, /@import url\('\.\/tokens\.css\?v=20260825-home2'\)/);
  assert.match(homeCss, /Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V4/);
  assert.match(homeCss, /contrast: pass \(40–41\)[\s\S]*icons: pass \(30\)/);
  assert.match(homeCss, /@media \(min-width: 40rem\)/);
  assert.match(homeCss, /width: min\(calc\(100% - \(2 \* var\(--space-xs\)\)\), 72rem\)/);
  assert.match(homeCss, /width: min\(calc\(100% - \(2 \* var\(--space-sm\)\)\), 72rem\)/);
  assert.match(homeCss, /\.home-hero \{[\s\S]*?max-width: 65ch[\s\S]*?padding-bottom: calc\(var\(--space-xl\) \+ var\(--space-xs\)\)/);
  assert.match(homeCss, /\.home-hero p[\s\S]*?max-width: 65ch/);
  assert.match(homeCss, /\.home-hero h1[\s\S]*?min-width: 0/);
  assert.match(homeCss, /font: 700 var\(--text-home-title, clamp\(2\.75rem, 8vw, 5\.5rem\)\)\/1\.04 var\(--font-display\)/);
  assert.match(homeCss, /\.home-hero \.home-tagline[\s\S]*?var\(--text-lg\)/);
  assert.doesNotMatch(homeCss, /\.home-wordmark span/);
  assert.match(homeCss, /\.home-episode-title[\s\S]*?white-space: nowrap/);
  assert.match(homeCss, /\.home-episode-subtitle[\s\S]*?text-overflow: ellipsis[\s\S]*?white-space: nowrap/);
  assert.match(homeCss, /\.home-episode-progress[\s\S]*?font: var\(--text-xs\) var\(--font-body\)/);
  assert.match(homeCss, /\.home-episode-arrow[\s\S]*?var\(--font-display\)/);
  assert.doesNotMatch(homeCss, /\.home-episode-progress[\s\S]*?var\(--font-code\)/);
  assert.match(homeCss, /overflow-x: clip/);
  assert.match(homeCss, /\.home-episode-list[\s\S]*border-top: 1px solid var\(--color-rule\)/);
  assert.doesNotMatch(homeCss, /transition\s*:\s*all|gradient|box-shadow|#[0-9a-f]{3,8}\b|font-family:\s*(?!var\()/i);
  assert.doesNotMatch(homeCss, /(?:gap|margin(?:-[a-z]+)?)\s*:\s*2px/);
});

test("home builds the episode index from normalized progress", () => {
  const home = fs.readFileSync(new URL("../home.js", import.meta.url), "utf8");
  assert.match(home, /from "\.\/progression\.js\?v=20260825-home2"/);
  assert.match(home, /normalizeCompleted/);
  assert.match(home, /episodeProgress/);
  assert.match(home, /fetch\("\.\/data\/missions\.json",\s*\{\s*cache:\s*["']no-cache["']/);
  assert.match(home, /data\.episodes\.forEach/);
  assert.match(home, /lab\.html\?episode=/);
  assert.match(home, /trace-v2-completed/);
  assert.match(home, /trace-v2-current/);
  assert.match(home, /aria-current.*page/);
  assert.match(home, /link\.title = `EP \$\{String\(episode\.number\)\.padStart\(2, "0"\)\} · \$\{episode\.title\}`/);
});

test("lab query selects a requested episode while invalid values use existing fallback", () => {
  const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
  assert.match(app, /function requestedEpisodeMissionId\(data\)/);
  assert.match(app, /new URLSearchParams\(window\.location\.search\)\.get\("episode"\)/);
  assert.match(app, /data\.episodes\.findIndex\(\(episode\) => episode\.id === requestedId\)/);
  assert.match(app, /requestedEpisodeMissionId\(data\) \|\|[\s\S]*resolveInitialMissionId\(data, completed, saved\)/);
});

test("accessible quiz states remain explicit", () => {
  const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
  const css = fs.readFileSync(new URL("../styles.css", import.meta.url), "utf8");
  assert.match(app, /× 不正解/);
  assert.match(app, /✓ 正解/);
  assert.match(app, /dataset\.state/);
  assert.match(css, /quiz-status\[data-state="correct"\]/);
  assert.match(css, /quiz-status\[data-state="incorrect"\]/);
});
