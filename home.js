import {
  episodeProgress,
  normalizeCompleted,
} from "./progression.js?v=20260825-home1";

const $ = (selector) => document.querySelector(selector);
const list = $("#episodeList");
const status = $("#homeStatus");

function readJSON(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "null");
    return value === null ? fallback : value;
  } catch {
    return fallback;
  }
}

function setStatus(message, state = "") {
  status.textContent = message;
  if (state) status.dataset.state = state;
  else delete status.dataset.state;
}

function renderEpisode(episode, completed, currentEpisodeId) {
  const progress = episodeProgress({ episodes: [episode] }, episode.id, completed);
  const link = document.createElement("a");
  link.className = "home-episode-row";
  link.href = `lab.html?episode=${encodeURIComponent(episode.id)}`;
  link.title = `EP ${String(episode.number).padStart(2, "0")} · ${episode.title}`;
  if (episode.id === currentEpisodeId) link.setAttribute("aria-current", "page");

  const number = document.createElement("span");
  number.className = "home-episode-number";
  number.textContent = `EP ${String(episode.number).padStart(2, "0")}`;

  const body = document.createElement("span");
  body.className = "home-episode-body";
  const title = document.createElement("span");
  title.className = "home-episode-title";
  title.textContent = episode.title;
  const subtitle = document.createElement("span");
  subtitle.className = "home-episode-subtitle";
  subtitle.textContent = episode.subtitle || "";
  const done = document.createElement("span");
  done.className = "home-episode-progress";
  done.textContent = `${progress.done} / ${progress.total} 完了`;
  body.append(title, subtitle, done);

  const arrow = document.createElement("span");
  arrow.className = "home-episode-arrow";
  arrow.setAttribute("aria-hidden", "true");
  arrow.textContent = "→";
  link.append(number, body, arrow);
  list.append(link);
}

setStatus("エピソードを読み込んでいます。");
fetch("./data/missions.json", { cache: "no-cache" })
  .then((response) => {
    if (!response.ok) throw Error("教材データを取得できませんでした。");
    return response.json();
  })
  .then((data) => {
    if (data.version !== 2 || !Array.isArray(data.episodes)) {
      throw Error("教材データの形式を確認できませんでした。");
    }
    const completed = normalizeCompleted(data, readJSON("trace-v2-completed", []));
    const currentMission = readJSON("trace-v2-current", null);
    const currentEpisodeId =
      typeof currentMission === "string"
        ? data.episodes.find((episode) =>
            episode.missions.some((mission) => mission.id === currentMission),
          )?.id
        : null;
    list.replaceChildren();
    data.episodes.forEach((episode) =>
      renderEpisode(episode, completed, currentEpisodeId),
    );
    setStatus(`${data.episodes.length}エピソード`);
  })
  .catch((error) => {
    console.error(error);
    setStatus(
      "教材データを読み込めませんでした。時間をおいて再度お試しください。",
      "error",
    );
  });
