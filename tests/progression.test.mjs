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

test("first mission only is unlocked", () => {
  assert.equal(isMissionUnlocked(data, all[0].id, []), true);
  assert.equal(isMissionUnlocked(data, all[1].id, []), false);
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
  assert.equal(resolveInitialMissionId(data, [], "ep04-m4"), "ep01-m1");
  assert.equal(resolveInitialMissionId(data, ["ep01-m1"], "ep01-m1"), "ep01-m1");
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
  const visible = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8") + fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
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
  assert.match(app, /b\.onclick = \(\) => \{\s*episodeIndex = i;\s*renderEpisode\(\);/);
  assert.match(app, /b\.onclick = \(\) => select\(m\.id\)/);
  assert.match(app, /function answer\([\s\S]*?completed = \[\.\.\.new Set/);
  assert.match(app, /completed = \[\];[\s\S]*?select\(missions\[0\]\.id\)/);
});

test("app revalidates教材 data on load", () => {
  const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
  assert.match(app, /fetch\("\.\/data\/missions\.json",\s*\{\s*cache:\s*["']no-cache["']\s*\}\)/);
  assert.doesNotMatch(app, /fetch\("\.\/data\/missions\.json",\s*\{\s*cache:\s*["']no-store["']/);
});

test("index busts app and stylesheet caches for the current教材 release", () => {
  const index = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
  assert.match(index, /<script\s+type="module"\s+src="app\.js\?v=20260824-20ep"><\/script>/);
  assert.match(index, /<link\s+rel="stylesheet"\s+href="styles\.css\?v=20260824-20ep">/);
});

test("episode map stays readable in desktop grids and scrolls on mobile", () => {
  const css = fs.readFileSync(new URL("../styles.css", import.meta.url), "utf8");
  assert.match(css, /@media \(min-width: 40rem\)[\s\S]*?\.episode-button \{[\s\S]*?flex-direction: column;[\s\S]*?min-height: 52px;[\s\S]*?height: auto;/);
  assert.match(css, /\.episode-button span \{[\s\S]*?overflow: visible;[\s\S]*?text-overflow: clip;[\s\S]*?white-space: normal;/);
  assert.match(css, /@media \(min-width: 60rem\) and \(max-width: 71\.99rem\)[\s\S]*?grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(css, /@media \(max-width: 35rem\)[\s\S]*?\.episode-map \{[\s\S]*?scroll-snap-type: x mandatory;/);
});

test("locked episodes remain visible but cannot desynchronize the lesson view", () => {
  const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
  const css = fs.readFileSync(new URL("../styles.css", import.meta.url), "utf8");
  assert.match(app, /const unlocked = isMissionUnlocked\(lab, ep\.missions\[0\]\?\.id, completed\)/);
  assert.match(app, /button\.disabled = !unlocked/);
  assert.match(app, /button\.setAttribute\("aria-disabled", String\(!unlocked\)\)/);
  assert.match(app, /renderText\(button, p\.done \+ "\/" \+ p\.total \+ " 完了", "small"\)/);
  assert.match(css, /\.episode-button:disabled \{[\s\S]*?opacity: 1;[\s\S]*?cursor: not-allowed;[\s\S]*?background: var\(--color-surface-2\);/);
  assert.match(css, /\.episode-button:disabled span,[\s\S]*?\.episode-button:disabled small \{[\s\S]*?color: var\(--color-muted\);/);
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
