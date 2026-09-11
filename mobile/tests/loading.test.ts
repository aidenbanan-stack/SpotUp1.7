import { test } from "node:test";
import assert from "node:assert/strict";
import { QueryObserver } from "@tanstack/react-query";
import { createAccountCache } from "../src/lib/accountCache";
import { createBoundedFetch } from "../src/lib/network";
test("repeated sign-in and refresh events preserve in-flight queries", async () => {
  const cache = createAccountCache();
  const client = cache("player-a");
  let complete!: (v: string) => void;
  const observer = new QueryObserver(client, {
    queryKey: ["games"],
    queryFn: () => new Promise<string>((resolve) => (complete = resolve)),
  });
  const stop = observer.subscribe(() => {});
  assert.equal(cache("player-a"), client);
  complete("loaded");
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(observer.getCurrentResult().status, "success");
  assert.equal(observer.getCurrentResult().data, "loaded");
  stop();
  client.clear();
});
test("switching accounts isolates cached private data", () => {
  const cache = createAccountCache();
  const a = cache("a");
  a.setQueryData(["messages"], ["private"]);
  assert.equal(cache("b").getQueryData(["messages"]), undefined);
  assert.equal(cache(null).getQueryData(["messages"]), undefined);
  a.clear();
});
test("stalled requests end with a useful timeout error", async () => {
  const stalled: typeof fetch = (_input, init) =>
    new Promise((_resolve, reject) =>
      init?.signal?.addEventListener("abort", () => reject(Error("aborted"))),
    );
  await assert.rejects(
    createBoundedFetch(stalled, 5)("https://example.com/rest/v1/games"),
    /too long to respond/,
  );
});

import { tournamentBudget } from "../src/lib/tournamentBudget";
test("tournament estimates conserve cents and reject invalid commissions", () => {
  const result = tournamentBudget(1999, 7, 333, 777);
  assert.equal(result.gross, result.platform + result.host + result.remainder);
  assert.throws(() => tournamentBudget(1000, 8, 7000, 4000));
  assert.throws(() => tournamentBudget(-1, 8, 500, 500));
});
