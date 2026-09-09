import { createInterface } from "node:readline/promises";
import { readFile, writeFile } from "node:fs/promises";
const input = createInterface({ input: process.stdin, output: process.stdout });
try {
  console.log(
    "SpotUp Supabase setup — find these public values in your project’s Connect dialog.",
  );
  const url = (await input.question("Project URL: ")).trim();
  const parsed = new URL(url);
  if (
    parsed.protocol !== "https:" ||
    parsed.username ||
    parsed.password ||
    parsed.pathname !== "/" ||
    parsed.search ||
    parsed.hash
  )
    throw Error("Enter only the HTTPS project URL.");
  const key = (
    await input.question("Publishable key (sb_publishable_...): ")
  ).trim();
  if (!/^sb_publishable_[A-Za-z0-9_-]+$/.test(key))
    throw Error("Use a publishable key, never a secret or service-role key.");
  const response = await fetch(`${parsed.origin}/auth/v1/settings`, {
    headers: { apikey: key },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok)
    throw Error(
      `Project connection failed (${response.status}). Check the URL and publishable key.`,
    );
  let env;
  try {
    env = await readFile(".env", "utf8");
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
    env = await readFile(".env.example", "utf8");
  }
  for (const [name, value] of Object.entries({
    EXPO_PUBLIC_SUPABASE_URL: parsed.origin,
    EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: key,
  })) {
    const pattern = new RegExp(`^${name}=.*$`, "m");
    env = pattern.test(env)
      ? env.replace(pattern, `${name}=${value}`)
      : `${env}\n${name}=${value}\n`;
  }
  await writeFile(".env", env, { mode: 0o600 });
  console.log("Project connection checked and client configured.");
  console.log(
    "For a NEW EMPTY project: run supabase/bootstrap.sql in its SQL editor.",
  );
  console.log(
    "Then follow README.md for Auth redirects and Edge Function deployment.",
  );
  console.log("Restart the app with: npm run web -- --clear");
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
} finally {
  input.close();
}
