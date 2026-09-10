# SpotUp update — 2026-09-10

Production project: `spot-up-app`, team `aidens-projects-3cd194a0`, domain https://spotup.vercel.app. The Expo application is in `mobile/`; the root Vercel configuration exports that app for web.

## This update
- Restored Google OAuth sign-in with account selection, using the same web origin return address as the legacy app. Supabase's public Auth settings confirm Google is enabled. Existing account identities remain intact.
- Blue accent theme, compact welcome screen, simplified Home with Find/Host and participation progress.
- Five bottom tabs: Home, Map, Moments, Play, Profile. Play groups My Games, Squads and Tournaments. Moments retains vertical video navigation independently of profile showcases.
- Friends screen, mutual friend requests, player search and friend-to-friend messages. Direct messages reuse reporting, deletion and moderation. Friendship consent, blocking, session status and rate limits are enforced in PostgreSQL.
- Progress page explains XP sources, level thresholds and achievement milestones.
- Browser video picker validates actual file metadata and previews locally; browser video player uses inline native controls and handles autoplay rejection. MP4/MOV/WebM MIME types are retained. Signed playback URLs refresh, and owner-visible moderation status is explicit.
- Fixed avatar storage policy's ambiguous object-name reference.

## Database
`friends_and_video_repairs` applied successfully as version `20260910053825`; saved in mobile/supabase/migrations. The CLI migration command was unavailable in this session, so the filename uses the version returned by Supabase migration history. All 18 accounts remain present. The additive update does not reset games or squads.

The account-preserving migration was applied on 2026-09-09. Never reapply that cutover or run the empty-project bootstrap against production. Old data is in the inaccessible `spotup_legacy` recovery schema.

## Verification
TypeScript, 5 domain tests and 26 database integration checks pass. The new consent and direct-message tests verify outsider denial, recipient-only acceptance, blocks and disabled sessions. Web production export passes. Authenticated browser/device end-to-end testing still requires a signed-in session; do not claim a completed Google login or real video upload based solely on a build.

## Remaining operations
Videos require moderator review before other players see them. No automatic video inspection service has been configured. Google Places and push worker secrets/scheduling remain unconfigured. Native OAuth redirect allowlisting and native device QA remain outstanding.

## Loading recovery fix
Removed query-cache clearing from authentication events. Cache instances now persist across token refreshes and are isolated by account. Session initialization and API requests have bounded waits with readable retry errors. Three regression tests cover pending queries, account isolation and request timeouts. Supabase reported ACTIVE_HEALTHY but database SQL checks and the public REST endpoint timed out during this investigation; infrastructure availability remains a separate issue from the repaired client bug.
