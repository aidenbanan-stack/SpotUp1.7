export function distanceKm(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): number {
  const rad = (n: number) => (n * Math.PI) / 180;
  const dLat = rad(bLat - aLat),
    dLng = rad(bLng - aLng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
export function formatDate(value: string) {
  return new Date(value).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
export function gameLabel(
  status: string,
  count: number,
  capacity: number,
  startsAt: string,
  now = Date.now(),
) {
  if (status !== "upcoming") return status;
  if (count >= capacity) return "Full";
  if (new Date(startsAt).getTime() - now < 3600000) return "Starting soon";
  if (count / capacity >= 0.75) return "Filling up";
  return "Open spots";
}
export function validateVideo(
  bytes: number | undefined,
  durationMs: number | undefined | null,
) {
  if (bytes && bytes > 100 * 1024 * 1024)
    throw Error("Choose a video under 100 MB.");
  if (durationMs && durationMs > 90000)
    throw Error("Choose a video up to 90 seconds.");
}
export function rankClips<T extends { creator_id: string; id: string }>(
  clips: T[],
  scores: Record<string, number>,
): T[] {
  const pool = [...clips].sort(
    (a, b) => (scores[b.id] ?? 0) - (scores[a.id] ?? 0),
  );
  const out: T[] = [];
  while (pool.length) {
    let i = pool.findIndex((c) =>
      out.slice(-2).every((p) => p.creator_id !== c.creator_id),
    );
    if (i < 0) i = 0;
    out.push(pool.splice(i, 1)[0]);
  }
  return out;
}
export function achievements(
  games: number,
  reliability: number | null,
  xp: number,
) {
  return [
    {
      name: "First whistle",
      detail: "Attend your first game",
      earned: games >= 1,
    },
    { name: "Regular", detail: "Attend 10 games", earned: games >= 10 },
    { name: "Local legend", detail: "Attend 50 games", earned: games >= 50 },
    {
      name: "Count on me",
      detail: "10+ games and reliability above 90%",
      earned: games >= 10 && (reliability ?? 0) > 90,
    },
    {
      name: "Squad ready",
      detail: "Earn 500 participation XP",
      earned: xp >= 500,
    },
  ];
}
