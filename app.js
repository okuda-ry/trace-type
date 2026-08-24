import { analyze, mistakeKeysAdded, tokenAt, wpm } from "./typing-engine.js";
import {
  flattenMissions,
  isMissionUnlocked,
  nextMissionPosition,
  episodeProgress,
  normalizeCompleted,
  normalizeMisses,
  resolveInitialMissionId,
} from "./progression.js";
const $ = (s) => document.querySelector(s);
const read = (k, d) => {
  try {
    const v = JSON.parse(localStorage.getItem(k));
    return Array.isArray(d)
      ? Array.isArray(v)
        ? v
        : d
      : v && typeof v === "object" && !Array.isArray(v)
        ? v
        : d;
  } catch {
    return d;
  }
};
let lab,
  missions = [],
  current = 0,
  previous = "",
  started = 0,
  completed = read("trace-v2-completed", []),
  misses = read("trace-v2-misses", {}),
  episodeIndex = 0;
const e = {
  map: $("#episodeMap"),
  sequence: $("#missionSequence"),
  title: $("#episodeTitle"),
  subtitle: $("#episodeSubtitle"),
  briefing: $("#episodeBriefing"),
  epProgress: $("#episodeProgress"),
  meta: $("#missionMeta"),
  mission: $("#missionTitle"),
  goal: $("#missionGoal"),
  lessonCount: $("#lessonCount"),
  input: $("#commandInput"),
  terminal: document.querySelector(".terminal"),
  output: $("#typingOutput"),
  accuracy: $("#accuracy"),
  wpm: $("#wpm"),
  chars: $("#chars"),
  error: $("#errorMeta"),
  misses: $("#missCount"),
  feedback: $("#typingFeedback"),
  execute: $("#executeBtn"),
  mock: $("#mockOutput"),
  quiz: $("#quiz"),
  question: $("#quizQuestion"),
  choices: $("#choices"),
  status: $("#quizStatus"),
  next: $("#nextBtn"),
  sponsor: $("#sponsor"),
  token: $("#tokenCard"),
  meaning: $("#meaning"),
  why: $("#why"),
  safety: $("#safety"),
  handoff: $("#handoff"),
  global: $("#globalProgress"),
  palette: $("#commandPalette"),
  paletteInput: $("#paletteInput"),
  results: $("#paletteResults"),
  trigger: $("#paletteTrigger"),
  resetAll: $("#resetAll"),
};
function renderText(parent, text, tag = "span", className = "") {
  const n = document.createElement(tag);
  n.textContent = text;
  if (className) n.className = className;
  parent.append(n);
  return n;
}
function renderEpisodes() {
  e.map.replaceChildren();
  lab.episodes.forEach((ep, i) => {
    const b = document.createElement("button");
    b.className = "episode-button";
    b.type = "button";
    b.setAttribute("aria-current", i === episodeIndex);
    renderText(b, `EP ${ep.number} · ${ep.title}`);
    b.onclick = () => {
      episodeIndex = i;
      renderEpisode();
    };
    e.map.append(b);
  });
  syncEpisodeMap();
}
function syncEpisodeMap() {
  if (!lab) return;
  [...e.map.querySelectorAll(".episode-button")].forEach((button, i) => {
    const ep = lab.episodes[i];
    if (!ep) return;
    const unlocked = isMissionUnlocked(lab, ep.missions[0]?.id, completed);
    button.disabled = !unlocked;
    button.setAttribute("aria-disabled", String(!unlocked));
    button.setAttribute("aria-current", String(i === episodeIndex));
    const p = episodeProgress(lab, ep.id, completed);
    const progress = button.querySelector("small");
    if (progress) {
      progress.textContent = p.done + "/" + p.total + " 完了";
    } else {
      renderText(button, p.done + "/" + p.total + " 完了", "small");
    }
  });
  scrollCurrentEpisodeIntoView();
}
function scrollCurrentEpisodeIntoView() {
  const currentButton = e.map.querySelector('[aria-current="true"]');
  const mobile = window.matchMedia("(max-width: 39.99rem)").matches;
  if (!currentButton || !mobile) {
    e.map.scrollLeft = 0;
    return;
  }
  const target =
    currentButton.offsetLeft -
    (e.map.clientWidth - currentButton.offsetWidth) / 2;
  const maximum = e.map.scrollWidth - e.map.clientWidth;
  e.map.scrollLeft = Math.max(0, Math.min(target, maximum));
}
function renderEpisode() {
  const ep = lab.episodes[episodeIndex];
  e.title.textContent = ep.title;
  e.subtitle.textContent = ep.subtitle;
  e.briefing.textContent = ep.briefing;
  const p = episodeProgress(lab, ep.id, completed);
  e.epProgress.textContent = `進捗 ${p.done} / ${p.total}`;
  e.sequence.replaceChildren();
  ep.missions.forEach((m) => {
    const b = document.createElement("button");
    b.className = "mission-step";
    b.type = "button";
    const unlocked = isMissionUnlocked(lab, m.id, completed);
    b.disabled = !unlocked;
    b.setAttribute("aria-current", missions[current]?.id === m.id);
    renderText(b, `${m.order}. ${m.title}`);
    renderText(b, unlocked ? "" : "前のミッション完了後", "small");
    b.onclick = () => select(m.id);
    e.sequence.append(b);
  });
  syncEpisodeMap();
}
function renderCharacters(target, typed) {
  e.output.replaceChildren();
  [...target].forEach((c, i) => {
    const n = document.createElement("span");
    const t = [...typed][i];
    n.className =
      t === undefined ? "pending" : t === c ? "correct" : "incorrect";
    n.textContent = c === " " ? "·" : c;
    e.output.append(n);
  });
  [...typed]
    .slice(target.length)
    .forEach((c) => renderText(e.output, c, "span", "extra"));
}
function renderToken(token) {
  e.token.replaceChildren();
  const c = document.createElement("code");
  c.textContent = token?.text || "—";
  const k = document.createElement("span");
  k.className = "token-kind";
  k.textContent = token?.kind || "待機中";
  e.token.append(c, k);
  e.meaning.textContent =
    token?.meaning || "入力中のトークンの意味を表示します。";
  e.why.textContent = token?.why || "調査上の役割を確認します。";
  e.safety.textContent = token?.safety || "実コマンドは実行しません。";
}
function select(id) {
  const pos = missions.findIndex((m) => m.id === id);
  if (pos < 0 || !isMissionUnlocked(lab, id, completed)) return;
  current = pos;
  const m = missions[current];
  episodeIndex = m.episodeIndex;
  previous = "";
  started = 0;
  e.input.value = "";
  e.input.disabled = false;
  e.mission.textContent = m.title;
  e.goal.textContent = m.goal;
  e.meta.textContent = `MISSION ${m.order} · ${m.category}`;
  e.lessonCount.textContent =
    m.order + " / " + (lab.episodes[m.episodeIndex]?.missions.length || 0);
  e.accuracy.textContent = "100%";
  e.wpm.textContent = "0";
  e.chars.textContent = "0";
  e.error.textContent = "最初の誤り: —";
  e.misses.textContent = `累積ミス: ${misses[m.id] || 0}`;
  e.feedback.textContent = "入力を開始してください。";
  e.execute.disabled = true;
  e.execute.setAttribute("aria-disabled", "true");
  e.mock.textContent = "コマンドを入力すると、ここに結果が表示されます。";
  e.quiz.hidden = true;
  e.sponsor.hidden = true;
  e.next.hidden = true;
  e.status.textContent = "";
  delete e.status.dataset.state;
  e.choices.replaceChildren();
  e.handoff.textContent = m.context;
  renderCharacters(m.command, "");
  renderToken(null);
  renderEpisode();
  e.global.textContent = `${completed.length} / ${missions.length}`;
  e.input.focus();
  localStorage.setItem("trace-v2-current", JSON.stringify(m.id));
}
function update() {
  const m = missions[current],
    t = e.input.value,
    r = analyze(m.command, t);
  renderCharacters(m.command, t);
  e.accuracy.textContent = `${r.accuracy}%`;
  e.chars.textContent = r.characters;
  e.wpm.textContent = wpm(m.command, t, started ? Date.now() - started : 0);
  e.error.textContent = `最初の誤り: ${r.firstError < 0 ? "—" : `${r.firstError + 1}文字目`}`;
  e.misses.textContent = `累積ミス: ${misses[m.id] || 0}`;
  e.execute.disabled = t !== m.command;
  e.execute.setAttribute("aria-disabled", String(t !== m.command));
  e.feedback.textContent =
    t === m.command
      ? "入力できました。「結果を見る」へ進んでください。"
      : r.firstError >= 0
        ? `最初の誤りは${r.firstError + 1}文字目です。`
        : `${t.length + 1}文字目以降が未入力です。`;
  const tok = tokenAt(m.command, Math.max(0, t.length - 1), m.tokens);
  renderToken(tok);
}
function execute() {
  const m = missions[current];
  if (e.input.value !== m.command) return;
  e.input.disabled = true;
  e.execute.disabled = true;
  e.mock.textContent = m.output;
  e.quiz.hidden = false;
  e.status.textContent = "";
  delete e.status.dataset.state;
  e.question.textContent = m.quiz.question;
  e.choices.replaceChildren();
  m.quiz.choices.forEach((choice, i) => {
    const b = document.createElement("button");
    b.className = "choice";
    b.type = "button";
    b.dataset.choiceLetter = String.fromCharCode(65 + i);
    b.dataset.choiceText = choice;
    b.textContent = `${b.dataset.choiceLetter} ${choice}`;
    b.onclick = () => answer(i, b);
    e.choices.append(b);
  });
  e.feedback.textContent =
    "結果を表示しました。確認クイズへ進んでください。";
}
function answer(i, b) {
  const m = missions[current];
  [...e.choices.children].forEach((choice) => {
    choice.classList.remove("correct", "wrong");
    choice.textContent = `${choice.dataset.choiceLetter} ${choice.dataset.choiceText}`;
  });
  const correct = i === m.quiz.answer;
  b.classList.add(correct ? "correct" : "wrong");
  b.textContent = `${correct ? "✓" : "×"} ${b.dataset.choiceLetter} ${b.dataset.choiceText}`;
  e.status.dataset.state = correct ? "correct" : "incorrect";
  if (i !== m.quiz.answer) {
    e.status.textContent = "× 不正解\n解説を確認して、もう一度選んでください。";
    return;
  }
  completed = [...new Set([...completed, m.id])];
  localStorage.setItem("trace-v2-completed", JSON.stringify(completed));
  e.global.textContent = `${completed.length} / ${missions.length}`;
  [...e.choices.children].forEach((x) => (x.disabled = true));
  e.status.textContent = `✓ 正解\n${m.quiz.explain} ${m.handoff}`;
  e.handoff.textContent = m.evidence;
  const next = nextMissionPosition(lab, m.id);
  if (next) {
    e.next.textContent =
      next.episodeId === m.episodeId ? "次のミッションへ" : "次のエピソードへ";
    e.next.disabled = false;
    e.next.hidden = false;
  } else {
    e.next.hidden = true;
    e.status.textContent += " 全エピソード完了。";
  }
  e.sponsor.hidden = false;
  renderEpisode();
}
function renderPalette() {
  const q = e.paletteInput.value.toLowerCase();
  e.results.replaceChildren();
  let matchCount = 0;
  lab.episodes.forEach((ep) => {
    const matching = ep.missions.filter((m) =>
      !q || `${m.title} ${m.command}`.toLowerCase().includes(q),
    );
    if (!matching.length) return;
    const head = document.createElement("div");
    head.className = "section-label";
    head.textContent = ep.title;
    e.results.append(head);
    matching.forEach((m) => {
      matchCount += 1;
      const b = document.createElement("button");
      b.className = "palette-result";
      b.type = "button";
      b.setAttribute("aria-selected", "false");
      b.disabled = !isMissionUnlocked(lab, m.id, completed);
      renderText(b, m.title);
      renderText(b, b.disabled ? "前のミッション完了後" : m.command, "small");
      b.onclick = () => {
        select(m.id);
        e.palette.close();
      };
      e.results.append(b);
    });
  });
  if (!matchCount) {
    const empty = document.createElement("p");
    empty.className = "palette-empty";
    empty.textContent = "該当するミッションはありません。";
    e.results.append(empty);
  }
}
e.input.addEventListener("input", () => {
  const m = missions[current],
    delta = mistakeKeysAdded(m.command, previous, e.input.value);
  if (delta) {
    misses[m.id] = (misses[m.id] || 0) + delta;
    localStorage.setItem("trace-v2-misses", JSON.stringify(misses));
  }
  if (!started && e.input.value) started = Date.now();
  update();
  previous = e.input.value;
});
e.input.addEventListener("keydown", (x) => {
  if (x.key === "Enter") {
    x.preventDefault();
    execute();
  }
});
e.terminal.addEventListener("pointerdown", (event) => {
  if (!event.target.closest("button")) e.input.focus();
});
$("#hintBtn").onclick = () => {
  const m = missions[current];
  const index = e.input.value.length;
  const expected = m.command[index];
  const display = expected === " " ? "空白" : expected ?? "入力完了";
  const token = tokenAt(m.command, Math.max(0, index - 1), m.tokens);
  e.feedback.textContent = `ヒント: 次は「${display}」。現在のトークン: ${token?.text || "—"}`;
};
$("#resetBtn").onclick = () => select(missions[current].id);
e.execute.onclick = execute;
e.next.onclick = () => {
  const n = nextMissionPosition(lab, missions[current].id);
  if (n) select(n.id);
};
$("#resetAll").onclick = () => {
  if (confirm("全進捗をリセットしますか？")) {
    completed = [];
    misses = {};
    localStorage.removeItem("trace-v2-completed");
    localStorage.removeItem("trace-v2-misses");
    localStorage.removeItem("trace-v2-current");
    select(missions[0].id);
  }
};
$("#paletteTrigger").onclick = openPalette;
e.paletteInput.addEventListener("input", renderPalette);
let activePaletteIndex = -1;
function closePalette() {
  if (e.palette.open) e.palette.close();
  e.trigger.focus();
}
function openPalette() {
  if (e.palette.open) return;
  activePaletteIndex = -1;
  renderPalette();
  e.palette.showModal();
  e.paletteInput.focus();
}
function setPaletteActive(index) {
  const items = [...e.results.querySelectorAll(".palette-result:not(:disabled)")];
  activePaletteIndex = items.length ? (index + items.length) % items.length : -1;
  items.forEach((item, i) => {
    item.classList.toggle("active", i === activePaletteIndex);
    item.setAttribute("aria-selected", String(i === activePaletteIndex));
  });
  if (items[activePaletteIndex]) {
    items[activePaletteIndex].scrollIntoView({ block: "nearest" });
  }
}
e.palette.addEventListener("click", (event) => {
  if (event.target === e.palette) closePalette();
});
e.paletteInput.addEventListener("keydown", (event) => {
  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    event.preventDefault();
    setPaletteActive(activePaletteIndex + (event.key === "ArrowDown" ? 1 : -1));
  }
  if (event.key === "Escape") closePalette();
  if (event.key === "Enter") {
    const item =
      [...e.results.querySelectorAll(".palette-result:not(:disabled)")][
        activePaletteIndex
      ];
    if (item) {
      item.click();
    }
  }
});
document.addEventListener("keydown", (x) => {
  if ((x.ctrlKey || x.metaKey) && x.key.toLowerCase() === "k") {
    x.preventDefault();
    if (e.palette.open) {
      closePalette();
      return;
    }
    openPalette();
  }
});
fetch("./data/missions.json", { cache: "no-cache" })
  .then((r) => {
    if (!r.ok) throw Error("教材取得失敗");
    return r.json();
  })
  .then((data) => {
    if (data.version !== 2 || !Array.isArray(data.episodes))
      throw Error("教材形式不正");
    lab = data;
    missions = flattenMissions(data);
    completed = normalizeCompleted(data, completed);
    misses = normalizeMisses(data, misses);
    localStorage.setItem("trace-v2-completed", JSON.stringify(completed));
    localStorage.setItem("trace-v2-misses", JSON.stringify(misses));
    let saved = null;
    try {
      saved = JSON.parse(localStorage.getItem("trace-v2-current") || "null");
    } catch {}
    renderEpisodes();
    select(resolveInitialMissionId(data, completed, saved) || missions[0]?.id);
    e.global.textContent = `${completed.length} / ${missions.length}`;
  })
  .catch((error) => {
    console.error(error);
    e.title.textContent = "教材データを読み込めませんでした。";
  });
