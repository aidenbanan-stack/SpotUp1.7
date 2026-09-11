# SpotUp feature restoration — September 11, 2026

This is an implementation checkpoint, not a claim that every legacy feature has been restored.

## Implemented in this checkpoint

| Feature | Current behavior |
|---|---|
| Venue autocomplete | Debounced place-name/address suggestions, exact selected name and address, request-race protection; no visible latitude/longitude fields or coordinate instructions. Web reuses VITE_GOOGLE_MAPS_API_KEY via Expo config, or EXPO_PUBLIC_GOOGLE_MAPS_API_KEY. Native uses the authenticated places Edge Function. |
| Pro account benefits | Existing active entitlement migrated from spotup_legacy; server-owned expiry and admin controls. No client-writable paid flag. |
| Private games | Pro-only creation enforced in database triggers, invited-player visibility enforced by existing RLS. |
| Recurring games | Pro can create one, four, or eight weekly sessions with separate rosters; local start time maintained across DST by generating each date independently. |
| Host filters | Minimum XP and Pro-only admission validated on server, including invitations. |
| Game invitations | Name search replaces profile-ID entry. |
| Moments | Full-height paged vertical video, compact Following/For you header, filters in a sheet, side-rail like/comment/save/share controls, more menu for related sports entities and reporting. Only active clip plays. Successful like/save updates preserve scroll order. |
| Squads | Pro limit expanded to five; free remains one. Membership modes, applications, invitations, captain/officer roles, removal/bans, announcements, events and RSVP. |
| Fantasy | Free opt-in player pool; three-player drafts for next Monday 00:00 UTC, server-enforced lock, weekly board. 10 points per confirmed completed game, max three per player/week; own hosted games excluded. Opt-out stops contribution. No cash/prizes. |
| Tournament budget | Organizer-only creation-flow calculator for example platform/host commissions and remaining event budget, integer-cent arithmetic. No payment collection or payout. |

## Legacy audit: still to restore or extend

Sources inspected: legacy src/pages, src/lib, phase2_pro_gating.sql, phase6–14 squad patches, phase16 host filters, phase22–25 tournament patches; compared with mobile screens and current public schema.

- Age-range host filters need a private age/eligibility model; do not expose dates of birth in public profiles.
- Private-game application/approval workflow beyond explicit invitations.
- Custom squad channels and channel privacy; existing squad chat remains functional.
- Squad application questionnaires, tags, expanded squad branding, pinned update management, and visible leadership audit history.
- Squad rivalry challenges, opponent-confirmed results, competitive ladders, and competition-board workflows.
- Bulk squad-to-game invitation UI (server action invite_to_game exists).
- Tournament match access codes, expanded seeds/placement formats, and richer match reporting from legacy tournament workflow.
- Richer XP road and player-award categories. Existing XP, reliability, achievements, daily bonus, and leaderboards remain.
- Subscription Checkout, customer portal, verified webhooks, refunds, cancellation/renewal behavior, and native-store subscription handling. New Pro purchases remain unavailable.

## Required external setup and verification

1. Web autocomplete needs the existing browser-restricted Google Maps key with Maps JavaScript API and Places API (New) enabled. New Expo build reads the previous VITE_GOOGLE_MAPS_API_KEY without copying credentials into source. Native requires GOOGLE_PLACES_API_KEY in Supabase Edge secrets. Neither secret administration nor authenticated Google suggestions can be verified through the current connectors. Do not claim live autocomplete verified until a signed-in browser selects a result successfully.
2. Real-user walkthrough still required: host a game, select a venue, select a private game with the preserved Pro account, scroll approved videos, draft opted-in players, and approve a squad application. Database integration tests use isolated PGlite, not fabricated production activity.
3. Uploaded videos still require moderation; no moderation bypass or fake approved content was added.
4. Paid entry/prize tournaments require an eligible payment processor and jurisdiction-specific rules, host verification/onboarding, fee policy, cancellation/refund policy, dispute handling, and payout reconciliation. Stripe's published restrictions cover entry-fee/prize competitions; do not activate this through an ordinary Stripe integration without resolving eligibility. Budget rates are editable examples only.
5. Pro subscriptions can use a separate eligible subscription billing flow. Only signed, verified, idempotent server-side events may change source=stripe entitlements; never trust a checkout-return URL or user metadata as proof of payment.

## Validation

- TypeScript and Expo web export pass.
- 30 PostgreSQL/PGlite integration checks, including entitlement bypass attempts, private access, repeat rosters, fantasy consent/roster lock, squad approvals and bans.
- 9 domain/network/cache/budget tests pass.
- Supabase migration 20260911060721_restore_pro_squads_and_fantasy applied successfully. Production still has 18 accounts and one active migrated Pro entitlement.
- New tables have RLS and explicit authenticated grants; mutation RPCs validate current account/role. Security advisor findings include intentional authenticated schema/RPC exposure, locked legacy objects, and the pre-existing leaked-password protection setting. See https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection .
- Original games/squads archive was not restored or reset again.
