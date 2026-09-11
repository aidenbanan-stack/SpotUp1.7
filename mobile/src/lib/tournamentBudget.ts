export function tournamentBudget(
  entryCents: number,
  entries: number,
  platformBps: number,
  hostBps: number,
) {
  if (
    ![entryCents, entries, platformBps, hostBps].every(Number.isSafeInteger) ||
    entryCents < 0 ||
    entryCents > 1000000 ||
    entries < 1 ||
    entries > 1000 ||
    platformBps < 0 ||
    hostBps < 0 ||
    platformBps + hostBps > 10000
  )
    throw Error(
      "Enter a valid budget with total commissions no higher than 100%.",
    );
  const gross = entryCents * entries;
  const platform = Math.floor((gross * platformBps) / 10000);
  const host = Math.floor((gross * hostBps) / 10000);
  return { gross, platform, host, remainder: gross - platform - host };
}
