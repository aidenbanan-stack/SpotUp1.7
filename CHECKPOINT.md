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

## Not deployed at this checkpoint

The Supabase cutover and Edge Functions have NOT been deployed. The live database remains the old version, including its existing security gaps. The new frontend requires the cutover before live app workflows can work. GitHub/Vercel publication must be verified separately; a local commit is not a deployment.

## Resume order

1. Confirm GitHub write access and Vercel linkage/production branch for `spotup.vercel.app`.
2. Review and apply the tested cutover to project `qzssyfzfrghvmgggzplc` (only once). It archives the old public schema behind revoked client permissions, creates a new public schema, preserves Auth accounts/profile identity, and starts with no games/squads/XP.
3. Verify all account IDs are preserved, the new RLS controls work, and legacy RPCs are inaccessible.
4. Deploy `places`, `delete-account`, and `dispatch-push` from `mobile/supabase/functions`. Configure Google Places and push-worker secrets where needed.
5. Confirm Auth redirect URLs include `https://spotup.vercel.app/auth/callback`, the localhost callback, and `spotup://auth/callback`.
6. Publish the prepared commit to the Vercel production branch, verify the deployment, then test sign-in, game creation/joining, the map, and privacy controls in the browser.

The old app data was authorized for removal, but the cutover retains it in a private recovery archive. Registered accounts are not deleted. Native device tests and browser visual QA remain outstanding.
