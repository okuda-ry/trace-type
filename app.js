import { analyze, mistakeKeysAdded, tokenAt, wpm } from "./typing-engine.js?v=20260906-ads1";
import {
  flattenMissions,
  isMissionUnlocked,
  nextMissionPosition,
  episodeProgress,
  normalizeCompleted,
  normalizeMisses,
  resolveInitialMissionId,
} from "./progression.js?v=20260906-ads1";
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
  lastKeydownAt = 0,
  manualInput = false,
  completed = read("trace-v2-completed", []),
  misses = read("trace-v2-misses", {}),
  episodeIndex = 0;
const missionPanelStorageKey = "trace-v2-mission-panel-collapsed";
let missionPanelCollapsed = (() => {
  try {
    return localStorage.getItem(missionPanelStorageKey) === "true";
  } catch {
    return false;
  }
})();
const e = {
  layout: $(".lab-layout"),
  storyToggle: $("#storyToggle"),
  storyToggleLabel: $("#storyToggleLabel"),
  storyToggleGlyph: $(".story-toggle-glyph"),
  storyContent: $("#storyContent"),
  map: $("#episodeMap"),
  picker: $("#episodePicker"),
  pickerSummary: $(".episode-picker-summary"),
  currentSummary: $("#currentEpisodeSummary"),
  currentProgress: $("#currentEpisodeProgress"),
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
  books: $("#affiliateBooks"),
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
function isDesktopMissionPanel() {
  return window.matchMedia("(min-width: 60rem)").matches;
}
function syncMissionPanel() {
  const collapsed = isDesktopMissionPanel() && missionPanelCollapsed;
  e.storyContent.hidden = collapsed;
  e.layout.classList.toggle("story-panel-collapsed", collapsed);
  e.storyToggle.setAttribute("aria-expanded", String(!collapsed));
  const label = collapsed ? "左欄を開く" : "左欄を閉じる";
  e.storyToggle.setAttribute("aria-label", label);
  e.storyToggle.title = label;
  e.storyToggleLabel.textContent = label;
  e.storyToggleGlyph.textContent = collapsed ? "→" : "←";
}
e.storyToggle.onclick = () => {
  if (!isDesktopMissionPanel()) return;
  missionPanelCollapsed = !missionPanelCollapsed;
  try {
    localStorage.setItem(missionPanelStorageKey, String(missionPanelCollapsed));
  } catch {}
  syncMissionPanel();
};
const missionPanelMedia = window.matchMedia("(min-width: 60rem)");
if (missionPanelMedia.addEventListener) {
  missionPanelMedia.addEventListener("change", syncMissionPanel);
} else {
  missionPanelMedia.addListener(syncMissionPanel);
}
syncMissionPanel();
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
      selectEpisode(i);
    };
    e.map.append(b);
  });
  syncEpisodeMap();
}
function episodeMissionId(index) {
  const ep = lab?.episodes[index];
  if (!ep) return null;
  return (
    ep.missions.find(
      (m) => !completed.includes(m.id) && isMissionUnlocked(lab, m.id, completed),
    )?.id ||
    ep.missions.at(-1)?.id ||
    null
  );
}
function requestedEpisodeMissionId(data) {
  const requestedId = new URLSearchParams(window.location.search).get("episode");
  const index = data.episodes.findIndex((episode) => episode.id === requestedId);
  return index < 0 ? null : episodeMissionId(index);
}
function closeEpisodePicker() {
  if (e.picker) {
    e.picker.open = false;
    syncEpisodePickerState();
  }
}
function syncEpisodePickerState() {
  if (e.picker && e.pickerSummary) {
    e.pickerSummary.setAttribute("aria-expanded", String(e.picker.open));
  }
}
function selectEpisode(index) {
  const id = episodeMissionId(index);
  if (!id) return;
  episodeIndex = index;
  select(id);
  closeEpisodePicker();
}
function syncEpisodeMap() {
  if (!lab) return;
  [...e.map.querySelectorAll(".episode-button")].forEach((button, i) => {
    const ep = lab.episodes[i];
    if (!ep) return;
    button.disabled = false;
    button.setAttribute("aria-disabled", "false");
    button.setAttribute("aria-current", String(i === episodeIndex));
    const p = episodeProgress(lab, ep.id, completed);
    const progress = button.querySelector("small");
    if (progress) {
      progress.textContent = p.done + "/" + p.total + " 完了";
    } else {
      renderText(button, p.done + "/" + p.total + " 完了", "small");
    }
  });
  const ep = lab.episodes[episodeIndex];
  if (ep) {
    const p = episodeProgress(lab, ep.id, completed);
    e.currentSummary.textContent = "EP " + ep.number + " · " + ep.title;
    e.currentProgress.textContent = p.done + " / " + p.total + " 完了";
  }
  scrollCurrentEpisodeIntoView();
}
function scrollCurrentEpisodeIntoView() {
  const currentButton = e.map.querySelector('[aria-current="true"]');
  if (!currentButton || !e.picker?.open || !e.map.clientHeight) return;
  const target =
    currentButton.offsetTop -
    (e.map.clientHeight - currentButton.offsetHeight) / 2;
  const maximum = Math.max(0, e.map.scrollHeight - e.map.clientHeight);
  e.map.scrollTop = Math.max(0, Math.min(target, maximum));
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
    if (!unlocked) {
      const reason = "前のミッション完了後に解放";
      b.title = reason;
      b.setAttribute("aria-label", `${m.order}. ${m.title}。${reason}`);
    }
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
function renderSponsor() {
  const books = e.books ? [...e.books.children] : [];
  books.forEach((book) => {
    book.hidden = true;
  });
  if (books.length) {
    books[Math.floor(Math.random() * books.length)].hidden = false;
  }
}
function select(id) {
  const pos = missions.findIndex((m) => m.id === id);
  if (pos < 0 || !isMissionUnlocked(lab, id, completed)) return;
  current = pos;
  const m = missions[current];
  episodeIndex = m.episodeIndex;
  previous = "";
  started = 0;
  lastKeydownAt = 0;
  manualInput = false;
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
  closeEpisodePicker();
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
  e.wpm.textContent = manualInput
    ? "—"
    : wpm(m.command, t, started ? Date.now() - started : 0);
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
    b.textContent = `${b.dataset.choiceLetter}. ${choice}`;
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
    choice.textContent = `${choice.dataset.choiceLetter}. ${choice.dataset.choiceText}`;
  });
  const correct = i === m.quiz.answer;
  b.classList.add(correct ? "correct" : "wrong");
  b.textContent = `${correct ? "✓" : "×"} ${b.dataset.choiceLetter}. ${b.dataset.choiceText}`;
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
  renderSponsor();
  e.sponsor.hidden = false;
  renderEpisode();
}
function renderPalette() {
  const q = e.paletteInput.value.trim().toLowerCase();
  e.results.replaceChildren();
  const episodeMatches = [];
  const missionMatches = [];
  const episodeSearch = (ep) =>
    (ep.id +
      " ep" +
      String(ep.number).padStart(2, "0") +
      " ep " +
      String(ep.number).padStart(2, "0") +
      " ep" +
      ep.number +
      " ep " +
      ep.number +
      " " +
      ep.title +
      " " +
      (ep.subtitle || "")).toLowerCase();
  const missionSearch = (ep, m) =>
    (ep.id +
      " ep" +
      String(ep.number).padStart(2, "0") +
      " ep " +
      String(ep.number).padStart(2, "0") +
      " ep" +
      ep.number +
      " ep " +
      ep.number +
      " " +
      ep.title +
      " " +
      (ep.subtitle || "") +
      " " +
      m.title +
      " " +
      m.command +
      " " +
      m.category).toLowerCase();
  if (!q) {
    const nearby = [...new Set([episodeIndex, episodeIndex + 1, episodeIndex - 1])]
      .filter((i) => i >= 0 && i < lab.episodes.length);
    nearby.forEach((i) => episodeMatches.push({ ep: lab.episodes[i], index: i }));
    lab.episodes[episodeIndex]?.missions.forEach((m) =>
      missionMatches.push({ ep: lab.episodes[episodeIndex], m }),
    );
  } else {
    lab.episodes.forEach((ep, index) => {
      if (episodeSearch(ep).includes(q)) episodeMatches.push({ ep, index });
      ep.missions.forEach((m) => {
        if (missionSearch(ep, m).includes(q)) missionMatches.push({ ep, m });
      });
    });
  }
  const maxResults = 8;
  const bothKinds = episodeMatches.length > 0 && missionMatches.length > 0;
  const episodeLimit = bothKinds ? Math.min(4, episodeMatches.length) : maxResults;
  const episodes = episodeMatches.slice(0, episodeLimit);
  const missionLimit = bothKinds
    ? Math.min(maxResults - episodes.length, missionMatches.length)
    : maxResults;
  const missionsToShow = missionMatches.slice(0, missionLimit);
  let optionIndex = 0;
  const heading = (text) => {
    const node = document.createElement("div");
    node.className = "section-label palette-section";
    node.setAttribute("role", "presentation");
    node.textContent = text;
    e.results.append(node);
  };
  if (episodes.length) {
    heading("エピソード");
    episodes.forEach(({ ep, index }) => {
      const b = document.createElement("button");
      b.className = "palette-result palette-episode-result";
      b.type = "button";
      b.id = "palette-option-" + optionIndex++;
      b.setAttribute("role", "option");
      b.setAttribute("aria-selected", "false");
      renderText(b, "EP " + ep.number + " · " + ep.title);
      const p = episodeProgress(lab, ep.id, completed);
      renderText(
        b,
        p.done + "/" + p.total + " 完了" + (ep.subtitle ? " · " + ep.subtitle : ""),
        "small",
      );
      b.onclick = () => {
        selectEpisode(index);
        closePalette();
      };
      e.results.append(b);
    });
  }
  if (missionsToShow.length) {
    heading("ミッション");
    missionsToShow.forEach(({ ep, m }) => {
      const b = document.createElement("button");
      b.className = "palette-result palette-mission-result";
      b.type = "button";
      b.id = "palette-option-" + optionIndex++;
      b.setAttribute("role", "option");
      b.setAttribute("aria-selected", "false");
      const unlocked = isMissionUnlocked(lab, m.id, completed);
      b.disabled = !unlocked;
      b.setAttribute("aria-disabled", String(!unlocked));
      if (!unlocked) {
        const reason = "前のミッション完了後に解放";
        b.title = reason;
        b.setAttribute("aria-label", `EP ${ep.number} · M${m.order} · ${m.title}。${reason}`);
      }
      renderText(b, "EP " + ep.number + " · M" + m.order + " · " + m.title);
      renderText(
        b,
        unlocked ? m.command : "前のミッション完了後に解放",
        "small",
        "palette-command",
      );
      b.onclick = () => {
        if (b.disabled) return;
        select(m.id);
        closePalette();
      };
      e.results.append(b);
    });
  }
  if (!episodes.length && !missionsToShow.length) {
    const empty = document.createElement("p");
    empty.className = "palette-empty";
    empty.textContent = "該当するエピソード／ミッションはありません。";
    e.results.append(empty);
  }
  activePaletteIndex = -1;
  setPaletteActive(0);
}
e.input.addEventListener("input", (event) => {
  const m = missions[current],
    delta = mistakeKeysAdded(m.command, previous, e.input.value);
  const inputType = event.inputType || "";
  const keyboardInput = Date.now() - lastKeydownAt <= 500;
  if (
    inputType.startsWith("insertFrom") ||
    inputType === "insertReplacementText" ||
    (inputType.startsWith("insert") && !keyboardInput)
  ) {
    manualInput = true;
  }
  if (delta) {
    misses[m.id] = (misses[m.id] || 0) + delta;
    localStorage.setItem("trace-v2-misses", JSON.stringify(misses));
  }
  if (!started && e.input.value) {
    if (manualInput || !keyboardInput) {
      manualInput = true;
    } else {
      started = Date.now();
    }
  }
  update();
  previous = e.input.value;
});
e.input.addEventListener("keydown", (x) => {
  lastKeydownAt = Date.now();
  if (x.key === "Enter") {
    x.preventDefault();
    execute();
  }
});
e.terminal.addEventListener("pointerdown", (event) => {
  if (!event.target.closest("button")) e.input.focus();
});
document.addEventListener("keydown", (event) => {
  const active = document.activeElement;
  const guarded = active && active !== document.body && active !== document.documentElement;
  const tag = active?.tagName?.toLowerCase();
  if (guarded || ["button", "a", "dialog", "input", "textarea"].includes(tag) || active?.isContentEditable) return;
  if (e.palette.open || e.input.disabled || event.isComposing || event.ctrlKey || event.metaKey || event.altKey) return;
  if (event.key !== "Backspace" && event.key.length !== 1) return;
  event.preventDefault();
  if (event.key === "Backspace") e.input.value = e.input.value.slice(0, -1);
  else e.input.value += event.key;
  lastKeydownAt = Date.now();
  e.input.focus();
  e.input.dispatchEvent(new Event("input", { bubbles: true }));
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
  e.paletteInput.setAttribute("aria-expanded", "false");
  e.paletteInput.removeAttribute("aria-activedescendant");
  e.trigger.focus();
}
function openPalette() {
  if (e.palette.open) return;
  activePaletteIndex = -1;
  renderPalette();
  e.palette.showModal();
  e.paletteInput.setAttribute("aria-expanded", "true");
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
    e.paletteInput.setAttribute(
      "aria-activedescendant",
      items[activePaletteIndex].id,
    );
    items[activePaletteIndex].scrollIntoView({ block: "nearest" });
  } else {
    e.paletteInput.removeAttribute("aria-activedescendant");
  }
}
e.palette.addEventListener("close", () => {
  e.paletteInput.setAttribute("aria-expanded", "false");
  e.paletteInput.removeAttribute("aria-activedescendant");
  e.trigger.focus();
});
e.picker?.addEventListener("toggle", () => {
  syncEpisodePickerState();
  if (e.picker.open) requestAnimationFrame(scrollCurrentEpisodeIntoView);
});
e.palette.addEventListener("click", (event) => {
  if (event.target === e.palette) closePalette();
});
e.paletteInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") event.preventDefault();
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
    select(
      requestedEpisodeMissionId(data) ||
        resolveInitialMissionId(data, completed, saved) ||
        missions[0]?.id,
    );
    e.global.textContent = `${completed.length} / ${missions.length}`;
  })
  .catch((error) => {
    console.error(error);
    e.title.textContent = "教材データを読み込めませんでした。";
  });
