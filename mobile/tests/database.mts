import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import assert from "node:assert/strict";
const db = new PGlite();
let passed = 0;
async function check(name: string, fn: () => Promise<void>) {
  await fn();
  passed++;
  console.log("PASS", name);
}
async function query(sql: string, params: unknown[] = []) {
  return db.query<any>(sql, params);
}
async function reject(sql: string, params: unknown[] = [], message?: RegExp) {
  await assert.rejects(() => query(sql, params), message);
}
const host = "10000000-0000-4000-8000-000000000001",
  p2 = "10000000-0000-4000-8000-000000000002",
  p3 = "10000000-0000-4000-8000-000000000003",
  p4 = "10000000-0000-4000-8000-000000000004",
  p5 = "10000000-0000-4000-8000-000000000005";
async function as(uid: string, role = "authenticated") {
  await db.exec("reset role");
  await query(
    "select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claim.role',$2,false)",
    [uid, role],
  );
  await db.exec("set role " + role);
}
async function owner() {
  await db.exec("reset role");
}
await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create schema storage;
create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}',created_at timestamptz default now());
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
create function auth.role() returns text language sql stable as $$select current_setting('request.jwt.claim.role',true)$$;
grant usage on schema public,auth,storage to anon,authenticated,service_role;grant execute on all functions in schema auth to anon,authenticated,service_role;
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
alter table storage.objects enable row level security;grant select,insert on storage.objects to authenticated;
create publication supabase_realtime;`);
if (process.env.TEST_UPGRADE) {
  await db.exec(`
    create table public.profiles(id uuid primary key,username text,bio text,city text,primary_sport text,secondary_sports text[],profile_photo_url text,created_at timestamptz);
    create function public.is_admin(id uuid) returns boolean language sql as $$select false$$;
    create table public.games(id uuid);
    create table public.squads(id uuid);
    insert into auth.users(id) values ('11111111-1111-4111-8111-111111111111');
    insert into public.profiles values ('11111111-1111-4111-8111-111111111111','Existing player','Bio','City','frisbee','{}',null,now());
  `);
}
const files = process.env.TEST_UPGRADE
  ? ["../../deployment/supabase/migrations/20260909045448_preserve_accounts_rebuild.sql"]
  : readdirSync("supabase/migrations").filter(f => f.endsWith(".sql")).sort();
for (const file of files) {
  const sql = readFileSync("supabase/migrations/" + file, "utf8").replace(
    "create extension if not exists pgcrypto;",
    "",
  );
  try {
    await db.exec(sql);
  } catch (e: any) {
    console.error(file, e.message, "position", e.position, "where", e.where);
    if (e.position)
      console.error(
        sql.slice(Number(e.position) - 250, Number(e.position) + 250),
      );
    process.exit(1);
  }
  console.log("Applied", file);
}
for (const [i, id] of [host, p2, p3, p4, p5].entries())
  await query("insert into auth.users(id,raw_user_meta_data) values($1,$2)", [
    id,
    { name: "Player " + (i + 1) },
  ]);
const payload = {
  title: "Integration test hoops",
  sport_id: "basketball",
  starts_at: new Date(Date.now() + 86400000).toISOString(),
  capacity: 3,
  skill: "All levels",
  venue: "Test Court",
  address: "Test City",
  latitude: 35,
  longitude: -120,
};
await as(host);
const gid = (await query("select create_game($1) id", [payload])).rows[0].id;
await check("host is automatically on the roster", async () => {
  assert.equal(
    (
      await query("select count(*)::int n from game_players where game_id=$1", [
        gid,
      ])
    ).rows[0].n,
    1,
  );
});
await check("clients cannot award XP or mutate attendance", async () => {
  await reject(
    "select award_xp($1,1000,'fake','fake')",
    [host],
    /permission denied/,
  );
  await reject(
    "update game_players set confirmed_at=now() where game_id=$1",
    [gid],
    /permission denied/,
  );
  await reject(
    "insert into xp_transactions(user_id,amount,reason,source) values($1,99,'fake','fake')",
    [host],
    /permission denied/,
  );
});
await as(p2);
await query("select game_action($1,'join')", [gid]);
await query("select game_action($1,'join')", [gid]);
await as(p3);
await query("select game_action($1,'join')", [gid]);
await check("join is idempotent and capacity is enforced", async () => {
  assert.equal(
    (
      await query("select count(*)::int n from game_players where game_id=$1", [
        gid,
      ])
    ).rows[0].n,
    3,
  );
  await as(p4);
  await reject("select game_action($1,'join')", [gid], /full/);
});
await check("players cannot confirm attendance or start games", async () => {
  await as(p2);
  await reject("select game_action($1,'confirm',$2)", [gid, p2], /host/);
  await reject("select game_action($1,'start')", [gid], /host/);
  await reject("select game_action($1,'checkin')", [gid], /near game time/);
});
await owner();
await query(
  "update games set starts_at=now()-interval '100 minutes',duration_minutes=120 where id=$1",
  [gid],
);
for (const id of [host, p2, p3]) {
  await as(id);
  await query("select game_action($1,'checkin')", [gid]);
}
await as(host);
await query("select game_action($1,'start')", [gid]);
for (const id of [host, p2, p3])
  await query("select game_action($1,'confirm',$2)", [gid, id]);
await query("select game_action($1,'confirm',$2)", [gid, p2]);
await check("host confirmation awards exactly 20 XP once", async () => {
  await as(p2);
  assert.equal(
    (await query("select sum(amount)::int n from xp_transactions")).rows[0].n,
    20,
  );
});
await owner();
await query(
  "update game_players set checked_in_at=now()-interval '180 minutes' where game_id=$1",
  [gid],
);
await as(host);
await query("select game_action($1,'complete')", [gid]);
await check(
  "time XP only counts the game window and completion cannot repeat",
  async () => {
    await as(p2);
    assert.equal(
      (await query("select amount from xp_transactions where reason='time'"))
        .rows[0].amount,
      15,
    );
    await as(host);
    await reject("select game_action($1,'complete')", [gid], /Start the game/);
  },
);
await check(
  "post-game votes are idempotent and cannot target yourself",
  async () => {
    await as(p2);
    await query("select vote_player($1,$2,'Sportsmanship')", [gid, host]);
    await query("select vote_player($1,$2,'Sportsmanship')", [gid, host]);
    assert.equal(
      (
        await query(
          "select sum(amount)::int n from xp_transactions where reason='vote'",
        )
      ).rows[0].n,
      15,
    );
    await reject(
      "select vote_player($1,$2,'Sportsmanship')",
      [gid, p2],
      /check constraint/,
    );
  },
);
await check(
  "daily bonus requires evidence and is awarded once per Pacific day",
  async () => {
    await as(p4);
    await reject("select claim_daily()", [], /90%/);
    await as(p2);
    await query("select claim_daily()");
    await query("select claim_daily()");
    assert.equal(
      (
        await query(
          "select count(*)::int n from xp_transactions where reason='daily'",
        )
      ).rows[0].n,
      1,
    );
  },
);
await check("private games deny uninvited reads and joins", async () => {
  await as(host);
  const privateId = (
    await query("select create_game($1) id", [
      { ...payload, title: "Private game", visibility: "private" },
    ])
  ).rows[0].id;
  await as(p4);
  assert.equal(
    (await query("select * from games where id=$1", [privateId])).rows.length,
    0,
  );
  await reject("select game_action($1,'join')", [privateId], /unavailable/);
  await as(host);
  await query("select game_action($1,'invite',$2)", [privateId, p4]);
  await as(p4);
  await query("select game_action($1,'join')", [privateId]);
});
await check("squad XP requirements cannot be bypassed", async () => {
  await as(p4);
  await reject(
    "select squad_action('create',null,$1)",
    [{ name: "Test squad", sport_id: "basketball" }],
    /XP/,
  );
  await reject(
    "insert into squads(owner_id,name) values($1,'Bypass')",
    [p4],
    /permission denied/,
  );
});
await as(host);
const mid = (await query("select begin_upload() data")).rows[0].data;
await query("insert into storage.objects(bucket_id,name) values('videos',$1)", [
  mid.object_path,
]);
const pid = (
  await query("select publish_video($1,'post',$2) id", [
    mid.id,
    { sport_id: "basketball", caption: "Test", visibility: "members" },
  ])
).rows[0].id;
await check(
  "pending media is hidden and users cannot self-approve",
  async () => {
    await as(p2);
    assert.equal(
      (await query("select * from posts where id=$1", [pid])).rows.length,
      0,
    );
    assert.equal(
      (
        await query("select * from storage.objects where name=$1", [
          mid.object_path,
        ])
      ).rows.length,
      0,
    );
    await as(host);
    await reject("select review_media($1,true,30,1024)", [mid.id], /Moderator/);
    await reject(
      "update media_assets set state='ready' where id=$1",
      [mid.id],
      /permission denied/,
    );
  },
);
await owner();
await query("insert into admins values($1)", [host]);
await as(host);
await query("select review_media($1,true,30,1024)", [mid.id]);
await check(
  "approved post is visible and comment policy enforced",
  async () => {
    await as(p2);
    assert.equal(
      (await query("select * from posts where id=$1", [pid])).rows.length,
      1,
    );
    await query("select social_action('comment',$1,'Great game')", [pid]);
    await as(host);
    await query("update profiles set comments_policy='off' where id=$1", [
      host,
    ]);
    await as(p2);
    await reject(
      "select social_action('comment',$1,'Again')",
      [pid],
      /restricted/,
    );
  },
);
await check(
  "bidirectional blocks hide videos, profiles, and signed-media source rows",
  async () => {
    await as(p2);
    await query("select social_action('block',$1)", [host]);
    assert.equal(
      (await query("select * from posts where id=$1", [pid])).rows.length,
      0,
    );
    assert.equal(
      (await query("select * from profiles where id=$1", [host])).rows.length,
      0,
    );
    assert.equal(
      (
        await query("select * from storage.objects where name=$1", [
          mid.object_path,
        ])
      ).rows.length,
      0,
    );
    await reject("select social_action('react',$1)", [pid], /restricted/);
    await query("select social_action('unblock',$1)", [host]);
  },
);
await check("report moderation requires an admin and is audited", async () => {
  await as(p2);
  await query("select report_content('post',$1,'Spam content')", [pid]);
  const report = (await query("select id from reports")).rows[0].id;
  await reject(
    "select moderate_report($1,'removed','Spam confirmed')",
    [report],
    /Moderator/,
  );
  await as(host);
  await query("select moderate_report($1,'removed','Spam confirmed')", [
    report,
  ]);
  assert.equal(
    (await query("select * from moderation_log where report_id=$1", [report]))
      .rows.length,
    1,
  );
  await as(p2);
  assert.equal(
    (await query("select * from posts where id=$1", [pid])).rows.length,
    0,
  );
});
await check(
  "anonymous users cannot read private tables or call domain RPCs",
  async () => {
    await as("", "anon");
    await reject("select * from profiles", [], /permission denied/);
    await reject("select create_game($1)", [payload], /permission denied/);
  },
);
await check("voting caps at 40 XP using 15 + 15 + 10", async () => {
  await owner();
  for (const id of [p4, p5])
    await query(
      "insert into game_players(game_id,user_id,confirmed_at) values($1,$2,now())",
      [gid, id],
    );
  await as(p2);
  for (const id of [p3, p4, p5])
    await query("select vote_player($1,$2,'Teamwork')", [gid, id]);
  assert.equal(
    (
      await query(
        "select sum(amount)::int n from xp_transactions where reason='vote'",
      )
    ).rows[0].n,
    40,
  );
});
await check(
  "time awards cannot exceed 20 XP even after a four-hour check-in",
  async () => {
    await as(host);
    const longGame = (
      await query("select create_game($1) id", [
        { ...payload, title: "Long game", duration_minutes: 240 },
      ])
    ).rows[0].id;
    await owner();
    await query(
      "update games set starts_at=now()-interval '240 minutes',status='live' where id=$1",
      [longGame],
    );
    await query(
      "update game_players set checked_in_at=now()-interval '240 minutes',confirmed_at=now()-interval '240 minutes' where game_id=$1",
      [longGame],
    );
    await as(host);
    await query("select game_action($1,'complete')", [longGame]);
    assert.equal(
      (
        await query(
          "select amount from xp_transactions where source=$1 and reason='time'",
          [longGame],
        )
      ).rows[0].amount,
      20,
    );
  },
);
await check(
  "private showcases never leak into the social feed or storage reads",
  async () => {
    await as(host);
    const m = (await query("select begin_upload() data")).rows[0].data;
    await query(
      "insert into storage.objects(bucket_id,name) values('videos',$1)",
      [m.object_path],
    );
    const sid = (
      await query("select publish_video($1,'showcase',$2) id", [
        m.id,
        { sport_id: "basketball", category: "Shooting" },
      ])
    ).rows[0].id;
    await query("select review_media($1,true,20,1024)", [m.id]);
    await query(
      "update profiles set showcase_visibility='private' where id=$1",
      [host],
    );
    await as(p3);
    assert.equal(
      (await query("select * from showcases where id=$1", [sid])).rows.length,
      0,
    );
    assert.equal(
      (
        await query("select * from storage.objects where name=$1", [
          m.object_path,
        ])
      ).rows.length,
      0,
    );
    assert.equal((await query("select * from content_feed()")).rows.length, 0);
    await as(host);
    await query(
      "update profiles set showcase_visibility='followers' where id=$1",
      [host],
    );
    await as(p3);
    await query("select social_action('follow',$1)", [host]);
    assert.equal(
      (await query("select * from showcases where id=$1", [sid])).rows.length,
      1,
    );
  },
);
await check(
  "tag controls cannot be bypassed by posting IDs directly",
  async () => {
    await as(p4);
    await query("update profiles set tags_policy='off' where id=$1", [p4]);
    await as(host);
    const m = (await query("select begin_upload() data")).rows[0].data;
    await query(
      "insert into storage.objects(bucket_id,name) values('videos',$1)",
      [m.object_path],
    );
    await reject(
      "select publish_video($1,'post',$2)",
      [m.id, { sport_id: "basketball", tags: [p4] }],
      /does not allow/,
    );
  },
);
await check(
  "chat membership and message spam limits are enforced",
  async () => {
    await as(p5);
    const other = (await query("select id from games where title='Long game'"))
      .rows[0].id;
    await reject("select send_message('Hi',$1)", [other], /Join this group/);
    await as(p2);
    for (let i = 0; i < 10; i++)
      await query("select send_message('Test message',$1)", [gid]);
    await reject("select send_message('Too many',$1)", [gid], /slow down/);
  },
);
await check(
  "single-elimination winners advance server-side and cannot be resubmitted",
  async () => {
    await owner();
    const squads: string[] = [];
    for (const id of [host, p2, p3, p4]) {
      await query("select award_xp($1,1000,'fixture','test-only')", [id]);
      await as(id);
      const sid = (
        await query("select squad_action('create',null,$1) id", [
          { name: "Squad " + id.slice(-1), sport_id: "basketball" },
        ])
      ).rows[0].id;
      squads.push(sid);
      await owner();
    }
    await as(host);
    const tid = (
      await query("select create_tournament($1) id", [
        {
          ...payload,
          name: "Test cup",
          registration_deadline: new Date(Date.now() + 3600000).toISOString(),
          max_teams: 4,
        },
      ])
    ).rows[0].id;
    for (const [i, id] of [host, p2, p3, p4].entries()) {
      await as(id);
      await query("select tournament_action($1,'register',$2)", [
        tid,
        squads[i],
      ]);
    }
    await owner();
    await query(
      "update tournaments set registration_deadline=now()-interval '1 minute' where id=$1",
      [tid],
    );
    await as(host);
    await query("select tournament_action($1,'start')", [tid]);
    const ms = (
      await query(
        "select * from tournament_matches where tournament_id=$1 order by round,slot",
        [tid],
      )
    ).rows;
    assert.equal(ms.length, 3);
    await as(p2);
    await reject(
      "select tournament_action($1,'score',null,$2,10,9)",
      [tid, ms[0].id],
      /organizer/,
    );
    await as(host);
    await query("select tournament_action($1,'score',null,$2,10,9)", [
      tid,
      ms[0].id,
    ]);
    await reject(
      "select tournament_action($1,'score',null,$2,10,9)",
      [tid, ms[0].id],
      /unplayed match/,
    );
    await query("select tournament_action($1,'score',null,$2,8,9)", [
      tid,
      ms[1].id,
    ]);
    const final = (
      await query("select * from tournament_matches where id=$1", [ms[2].id])
    ).rows[0];
    assert.equal(final.team_a, ms[0].team_a);
    assert.equal(final.team_b, ms[1].team_b);
    await query("select tournament_action($1,'score',null,$2,10,9)", [
      tid,
      ms[2].id,
    ]);
    assert.equal(
      (await query("select status from tournaments where id=$1", [tid])).rows[0]
        .status,
      "completed",
    );
  },
);
await check("the free plan cannot join or create a second squad", async () => {
  await as(p2);
  await reject(
    "select squad_action('create',null,$1)",
    [{ name: "Another squad", sport_id: "soccer" }],
    /one squad/,
  );
});
await check("every public application table has RLS enabled", async () => {
  await owner();
  assert.equal(
    (
      await query(
        "select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and not c.relrowsecurity",
      )
    ).rows.length,
    0,
  );
});
await check(
  "disabled sessions cannot read tables, query feeds, or mutate data",
  async () => {
    await owner();
    await query("update profiles set disabled=true where id=$1", [p5]);
    await as(p5);
    assert.equal((await query("select * from profiles")).rows.length, 0);
    assert.equal((await query("select * from content_feed()")).rows.length, 0);
    assert.equal((await query("select * from leaderboard()")).rows.length, 0);
    await reject("select claim_daily()", [], /active account/);
    await reject("select social_action('follow',$1)", [host], /active account/);
  },
);
await check(
  "multisport catalog supports new sports and rejects unknown profile sports",
  async () => {
    await owner();
    assert.equal((await query("select * from sports")).rows.length, 25);
    await query(
      "update profiles set sports=array['pickleball','cricket','ultimate'] where id=$1",
      [host],
    );
    await reject(
      "update profiles set sports=array['unknown-sport'] where id=$1",
      [host],
      /sports catalog/,
    );
    await query(
      "insert into sports values ('test-sport','Test sport','fitness-outline')",
    );
    await query("update profiles set sports=array['test-sport'] where id=$1", [
      host,
    ]);
  },
);
if (process.env.TEST_UPGRADE) await check("upgrade preserves registered identity and locks the old API", async () => {
  await owner();
  assert.equal((await query("select name from profiles where id='11111111-1111-4111-8111-111111111111'")).rows[0].name, "Existing player");
  assert.equal((await query("select count(*)::int as n from auth.users where id='11111111-1111-4111-8111-111111111111'")).rows[0].n,1);
  await as(host);
  await reject("select * from spotup_legacy.profiles", [], /permission denied/);
  await reject("select spotup_legacy.is_admin($1)", [host], /permission denied/);
});
console.log(
  `\n${passed} database integration checks passed against PostgreSQL (PGlite).`,
);
await db.close();
