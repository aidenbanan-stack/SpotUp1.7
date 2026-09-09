# SpotUp rebuild checkpoint — 2026-09-09

The replacement Expo/React Native app is in `mobile/`. The older Vite application is retained at the repository root for recovery and comparison. Root `vercel.json` builds `mobile/` for the existing Vercel project.

## Prepared

- Dark, multisport UI with lime accents, animated cards, reduced-motion support, press feedback, and native route transitions.
- Browser map with pan/zoom and game markers; native map implementation.
- Games, profiles, squads, tournaments, chat, short sports videos, separate Skill Showcase, and moderation workflows.
- Public Supabase client configuration for the existing SpotUp1.7 project.
- Account-preserving database cutover in `mobile/deployment/supabase/migrations/20260909045448_preserve_accounts_rebuild.sql`.

## Verified

- TypeScript passed.
- 5 domain tests and 25 database integration checks passed.
- The complete cutover plus 26 database integration checks passed locally, including registered-account preservation and denying access to the legacy schema.
- Web production export passed.

## Deployment progress

The code is published on GitHub branch `codex/spotup-rebuild` (initial published commit `8a4aa7d9338429c248a2f43d6ae51d399ec5e1d7`). Vercel's `spot-up-app` preview build succeeded. Two additional linked projects have separate build statuses; the production-domain mapping still needs verification through Vercel.

Supabase Edge Functions `places`, `delete-account`, and `dispatch-push` are deployed (version 1). Google Places/push secrets and scheduler are not configured by this work. Unauthenticated requests must be rejected.

The database cutover has NOT been applied: all 18 registered accounts and the original application database remain intact. The replacement frontend requires that cutover. Production `main` has not been advanced, and `spotup.vercel.app` still serves the original Vite app.

The cloud browser cannot reach the local preview (`ERR_BLOCKED_BY_CLIENT`), so no browser interaction/visual QA is claimed.

## Resume order

1. Confirm GitHub write access and Vercel linkage/production branch for `spotup.vercel.app`.
2. Review and apply the tested cutover to project `qzssyfzfrghvmgggzplc` (only once). It archives the old public schema behind revoked client permissions, creates a new public schema, preserves Auth accounts/profile identity, and starts with no games/squads/XP.
3. Verify all account IDs are preserved, the new RLS controls work, and legacy RPCs are inaccessible.
4. The three Edge Functions are deployed. Configure Google Places and push-worker secrets where needed, then verify them with the new schema.
5. Confirm Auth redirect URLs include `https://spotup.vercel.app/auth/callback`, the localhost callback, and `spotup://auth/callback`.
6. Publish the prepared commit to the Vercel production branch, verify the deployment, then test sign-in, game creation/joining, the map, and privacy controls in the browser.

The old app data was authorized for removal, but the cutover retains it in a private recovery archive. Registered accounts are not deleted. Native device tests and browser visual QA remain outstanding.
