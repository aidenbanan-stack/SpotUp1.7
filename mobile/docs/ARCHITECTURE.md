# Architecture and decisions

## Trust boundaries

The Expo client receives only the public Supabase URL/key and user session. SecureStore holds native session chunks; web sessions use local storage. Service keys exist only in trusted Supabase functions. `public` tables have RLS, authenticated grants are allowlisted, and user-controlled profile updates cannot write XP, roles, account status, or attendance.

Core mutations run in PostgreSQL transactions. A user advisory lock serializes per-user quotas/awards; a game row lock serializes membership and capacity; a tournament row lock serializes registration and bracket advancement. Avoid adding client-side writes to these tables as new screens are introduced.

## Participation accounting

`game_players` tracks joined, checked-in, host-confirmed, and checked-out timestamps. The server sets all attendance times. Completion writes one reliability event per participant and finalizes bounded time XP. The XP ledger enforces `(user_id, reason, source)` uniqueness.

Voting is one vote per other confirmed participant. The requested 15 XP / 40 XP cap is implemented as 15, 15, 10, then 0. The cap is **per player per game**, an explicit interpretation of the brief. Voting recognition does not overwrite reliability, which remains attendance-based.

Daily bonus dates derive from `America/Los_Angeles`, subtracting three local hours before taking the date. New players have no reliability percentage and cannot claim the bonus until participation evidence exists. A 90% score does not qualify; the requirement is strictly greater than 90%.

Levels use 250 XP per level as a configurable initial product choice, because no level curve was specified. Time awards appear on game completion, not as insecure client-side increments while a timer runs. Host attestation remains vulnerable to collusion; it is not location proof.

## Two content domains

`media_assets` owns private upload state and verified metadata. `posts` owns social context and engagement. `showcases` owns profile skill evidence. The same storage infrastructure serves both, but a showcase is never implicitly a social post.

Authors submit media to a moderation queue. Only admins/service workers can transition pending media to ready/rejected. Reports are private to the reporter/admin and moderation decisions append an audit record. Removed content disappears from reads; deletion uses soft removal so moderation can remain auditable. A production retention/physical cleanup policy is still required.

Privacy is evaluated at read and mutation time, not just by hiding buttons. Blocks apply in both directions. Followers-only comments/tags refer to the actor following the creator or tag target. Saved posts remain private to the saver. Two-minute signed URLs bound, but do not eliminate, the delay between permission changes and already-authorized media playback.

## Discovery

The feed selects a chronological cursor page before reranking it. Its cursor is based on the original page tail, preventing score changes from duplicating/skipping entries through an unstable score cursor. Reranking uses relevance, limited engagement, recency, and creator variety. It makes no claim to be a trained recommender or a global trending service.

Maps initially fetch a bounded candidate set, then apply client distance/venue/sport filtering. This is suitable for validating a new local community, not a global-scale geo index. Move distance, viewport and pagination filters to a geospatial RPC before launching in a high-density market.

## Operations

Google Places requests pass through an authenticated, rate-limited Edge Function. Push delivery claims leased database records and submits to Expo; it is bounded at-least-once transport. Successful tickets do not prove device receipt.

Account deletion first checks event/ownership responsibilities, then disables the profile, removes authored content/media and finally deletes sign-in access. Restrictive active-session policies prevent stale JWTs from continuing to read database rows. De-identified participation relationships remain to preserve other players' histories.

## Extending the project

Keep schemas and authorization changes in migrations. Add tests that attempt the denied path, not only the happy path. Generated Supabase database typings should replace the current explicit domain DTOs after deployment (`supabase gen types typescript`). Edge Functions are excluded from the Expo TypeScript configuration because they run in Deno; check them separately with Deno/Supabase tooling before deployment.
