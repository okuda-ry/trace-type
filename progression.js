export function flattenMissions(data) {
  return (data.episodes || []).flatMap((episode, episodeIndex) =>
    episode.missions.map((mission, missionIndex) => ({
      ...mission,
      episodeId: episode.id,
      episodeIndex,
      missionIndex,
    })),
  );
}
export function findMissionPosition(data, id) {
  const missions = flattenMissions(data);
  const index = missions.findIndex((mission) => mission.id === id);
  return index < 0 ? null : { index, mission: missions[index] };
}
export function normalizeCompleted(data, value) {
  const known = new Set(flattenMissions(data).map((mission) => mission.id));
  return Array.isArray(value)
    ? [...new Set(value.filter((id) => known.has(id)))]
    : [];
}
export function normalizeMisses(data, value) {
  const known = new Set(flattenMissions(data).map((mission) => mission.id));
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter(
      ([id, count]) =>
        known.has(id) && Number.isFinite(count) && count >= 0,
    ).map(([id, count]) => [id, Math.floor(count)]),
  );
}
export function isMissionUnlocked(data, id, completed = []) {
  const position = findMissionPosition(data, id);
  if (!position) return false;
  const mission = position.mission;
  if (mission.missionIndex === 0) return true;
  const episode = data.episodes?.[mission.episodeIndex];
  const previous = episode?.missions?.[mission.missionIndex - 1];
  return Boolean(previous && completed.includes(previous.id));
}
export function resolveInitialMissionId(data, completed, saved) {
  const all = flattenMissions(data);
  const normalized = normalizeCompleted(data, completed);
  if (saved && isMissionUnlocked(data, saved, normalized)) return saved;
  return (
    all.find(
      (mission) =>
        !normalized.includes(mission.id) &&
        isMissionUnlocked(data, mission.id, normalized),
    )?.id ||
    all.at(-1)?.id ||
    null
  );
}
export function nextMissionPosition(data, id) {
  const position = findMissionPosition(data, id);
  if (!position) return null;
  return flattenMissions(data)[position.index + 1] || null;
}
export function episodeProgress(data, episodeId, completed = []) {
  const episode = (data.episodes || []).find((item) => item.id === episodeId);
  if (!episode) return { done: 0, total: 0 };
  return {
    done: episode.missions.filter((mission) => completed.includes(mission.id))
      .length,
    total: episode.missions.length,
  };
}
