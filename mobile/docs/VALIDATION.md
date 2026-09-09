# Validation record

Validated on September 7, 2026 with Node 24 and the dependency lockfile in this package.

| Check | Result |
|---|---|
| Expo/React Native TypeScript (`npm run typecheck`) | Passed |
| Pure domain tests | 5 passed |
| PostgreSQL/PGlite integration checks | 25 passed |
| iOS JavaScript/Hermes export | Passed |
| Android JavaScript/Hermes export | Passed |
| Web JavaScript export | Passed |
| Cloud-browser visual inspection | Not completed: the browser could not reach the local preview (`ERR_BLOCKED_BY_CLIENT`) |
| Deno Edge Function check | Attempted but blocked by dependency-registry connection failure; not counted as passed |
| Deployed Supabase API / email / realtime / Storage | Not exercised; Supabase connection is confirmed, but project-management actions were not exposed to this session |
| APK/IPA installation, camera, maps, push on devices | Not exercised; native build credentials and physical devices are required |
| App-store review | Not submitted |

The native exports are JavaScript/Hermes bundles, **not signed installable APK/IPA files**.

## Database coverage

The suite creates a clean PostgreSQL instance, installs minimal Auth/Storage platform test fixtures, applies every migration, then switches database roles and user IDs for actual authorization tests.

1. Host is automatically on the roster.
2. Clients cannot award XP or mutate attendance directly.
3. Joining is idempotent and full-game capacity is enforced.
4. Players cannot confirm attendance/start games or check in too early.
5. Host confirmation awards 20 XP exactly once.
6. Time awards only count the game window; completion cannot repeat.
7. Post-game voting is idempotent and cannot target oneself.
8. Daily bonus requires reliability evidence and is awarded once per current Pacific day.
9. Private games deny uninvited reads and joins.
10. Squad XP eligibility cannot be bypassed by direct writes.
11. Pending media is hidden and normal users cannot self-approve.
12. Approved posts become visible and comment policy is enforced.
13. Bilateral blocks hide posts, profiles, and media-access rows.
14. Report moderation requires an admin and creates audit evidence.
15. Anonymous access to private tables/domain RPCs is denied.
16. Voting awards cap at 40 via 15+15+10.
17. Time awards cap at 20 XP even after a four-hour check-in.
18. Private showcases do not leak into feeds or media reads; followers-only access works.
19. Tag privacy is enforced when sending IDs directly.
20. Chat membership and message spam limits are enforced.
21. Tournament scores require the organizer; winners advance correctly; duplicate results are rejected.
22. Free accounts cannot create a second squad.
23. Every application table has RLS enabled.
24. Disabled sessions cannot read tables/feeds/leaderboards or mutate data.

These checks do not prove concurrency behavior across a production cluster, push delivery, native UI quality, security against all collusion, or Storage/CDN invalidation. The suite tests the PostgreSQL logic directly; a deployed Supabase API pass remains required.

## Device release pass

Use two ordinary accounts and a separate moderator in a nonproduction Supabase project. Follow the product brief's QA checklist: signup/recovery, discover/create/join/leave/edit/cancel, check-in/confirmation/completion/XP, realtime chat, squad eligibility/ownership, tournament registration/results, recording/upload/review, privacy/report/block/delete, and deep links from a signed-out state. Repeat key flows with network loss, denied permissions, large text, VoiceOver/TalkBack, and app backgrounding.

Do not open public video posting until the moderation operation is staffed and the verification/transcoding path is ready. The current code deliberately keeps unreviewed media pending.

25. Profile sports validate against the catalog, including newly added sports; unknown sports are rejected.

Browser map runtime interaction and tile loading still require manual browser validation. Guided setup validates public credentials against the Auth settings endpoint; a real project connection has not yet been tested.
