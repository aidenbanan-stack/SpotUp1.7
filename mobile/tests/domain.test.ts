import { test } from "node:test";
import assert from "node:assert/strict";
import {
  achievements,
  distanceKm,
  gameLabel,
  rankClips,
  validateVideo,
} from "../src/lib/domain";
test("distance uses spherical geometry and supports same-point location", () => {
  assert.equal(distanceKm(0, 0, 0, 0), 0);
  assert.ok(Math.abs(distanceKm(0, 0, 0, 1) - 111.195) < 0.01);
});
test("game status prioritizes cancellation and capacity", () => {
  assert.equal(
    gameLabel("cancelled", 10, 10, new Date().toISOString()),
    "cancelled",
  );
  assert.equal(gameLabel("upcoming", 10, 10, new Date().toISOString()), "Full");
});
test("video limits reject oversized and long videos", () => {
  assert.throws(() => validateVideo(104857601, 1000));
  assert.throws(() => validateVideo(500, 90001));
  assert.doesNotThrow(() => validateVideo(104857600, 90000));
});
test("feed diversification does not duplicate or drop posts", () => {
  const clips = [
    { id: "1", creator_id: "a" },
    { id: "2", creator_id: "a" },
    { id: "3", creator_id: "b" },
    { id: "4", creator_id: "c" },
  ];
  const ranked = rankClips(clips, { "1": 10, "2": 9, "3": 8, "4": 7 });
  assert.equal(ranked[0].id, "1");
  assert.equal(ranked[1].id, "3");
  assert.equal(new Set(ranked.map((c) => c.id)).size, 4);
  assert.equal(clips[1].id, "2");
});
test("reliability achievement requires evidence, not a new account", () => {
  assert.equal(achievements(0, null, 0).filter((a) => a.earned).length, 0);
  assert.equal(
    achievements(10, 90, 1000).find((a) => a.name === "Count on me")?.earned,
    false,
  );
  assert.equal(
    achievements(10, 90.1, 1000).find((a) => a.name === "Count on me")?.earned,
    true,
  );
});
