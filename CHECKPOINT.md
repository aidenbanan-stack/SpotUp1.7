# SpotUp production checkpoint — 2026-09-09

The replacement Expo/React Native app is in `mobile/`. Root `vercel.json` builds its web export. The older Vite source is retained for reference.

## Live
- Production: https://spotup.vercel.app
- Vercel project: spot-up-app, team aidens-projects-3cd194a0.
- Application commit: 86e3ec5a0fcfdb3c7c20b588f711770b3bee7fb0, published to main.
- Production deployment: dpl_DJe4Pz5onWzEVKJgLG8BzkN8t374, READY; production domain assignment verified.
- Supabase project: qzssyfzfrghvmgggzplc.
- Account-preserving migration applied successfully. All 18 Auth account IDs are unchanged; all 18 have new profiles. Games and squads start empty. Previous app tables remain in a private recovery schema.
- All public tables have RLS; authenticated users cannot access the legacy schema. Anonymous profile requests are denied and the old grant_xp_once RPC is absent.

## Verified
- TypeScript, 5 domain tests, and 25 database integration checks passed before publishing.
- Full migration plus 26 database integration checks passed locally.
- Web production build succeeded.
- Browser preview rendered the new sign-in screen; visual inspection completed.
- Live database authenticated-role player_summary smoke check passed inside a rolled-back transaction.
- No existing user's password or session was changed.

## Included
Dark multisport UI, animations and reduced-motion support; browser/native maps; games, profiles, squads, tournaments, chat, short sports videos, separate Skill Showcase, and moderation workflows.

## Remaining verification and configuration
- Authenticated browser and native-device end-to-end tests remain outstanding.
- Confirm Auth redirect allowlist for https://spotup.vercel.app/auth/callback and spotup://auth/callback.
- Google Places secret is not configured; manual venue entry remains available.
- Push-worker secret and scheduler are not configured. Places, delete-account, and dispatch-push Edge Functions are deployed; unauthenticated requests return 401.
- Security advisor notes legacy functions in the inaccessible archive, intentional authenticated API/GraphQL visibility protected by policies and function checks, and disabled leaked-password protection.
- See mobile/FEATURE-STATUS.md for implementation scope and limitations.

Do not reapply the account-preserving migration or run the empty-project bootstrap on this live project.
