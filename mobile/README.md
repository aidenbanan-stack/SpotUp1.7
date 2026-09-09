# SpotUp

A native pickup-sports application built with Expo, Expo Router, React Native, TypeScript, and Supabase.

**Release: 0.1.0 — working source implementation, not an app-store release.** This package contains real UI, database operations, security policies, and integration tests. It has no fabricated players, games, XP, authentication, or video activity. Without backend configuration it opens a clearly identified setup/sign-in screen.

## Start here on Windows

1. Extract this archive into a new folder, such as `C:\Users\YOUR_NAME\Projects\spotup`. This is a separate project from NBA Lineage.
2. Open that folder in VS Code.
3. In the VS Code PowerShell terminal:

```powershell
npm ci
npm run setup
```

4. Create a Supabase project, then put its project URL and publishable/anonymous client key into `.env`. **Never put a service-role key in the mobile app or an `EXPO_PUBLIC_` variable.** The Supabase integration can also be connected to let the assistant configure the backend with you.
5. Apply the database schema using ONE of the two routes below.
6. Start the app:

```powershell
npm start
```

Press `w` for the browser build. The browser now has an interactive Leaflet/OpenStreetMap map with game markers; native builds use react-native-maps. Native recording interfaces require a device.

For all native capabilities, create an Expo development build as described below. Expo Go support depends on the SDK version installed on your device; push notifications require a development build.

The setup command checks your project URL and publishable key and writes `.env`. It does not deploy the database.

## Database setup

### Option A: Supabase dashboard

For a **new, empty project**, run `supabase/bootstrap.sql` in the Supabase SQL editor. It contains the ordered migrations in one transaction. Do not run it over an unrelated or already initialized database.

### Option B: Supabase CLI

```powershell
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

Do not use both setup routes on the same project without reconciling migration history. Commit subsequent schema changes as new migrations.

In Supabase Auth settings, enable email/password authentication and confirmation. Configure a real email sender before inviting external users. Set the minimum password length to 12. Add these allowed redirect URLs:

- `spotup://auth/callback`
- `http://localhost:8081/auth/callback` for local browser development

If using Expo Go, add its exact development redirect URL as well. Production universal links require an owned domain and Apple/Android association files; the package currently uses the native `spotup://` scheme.

## Maps and place search

The browser map needs no Google API key. It uses online OpenStreetMap tiles; configure an appropriate tile provider as traffic grows.

The app supports current-location discovery, sport/venue filters, radius filtering, native sports markers, Google Places search, and Google Maps directions.

Set platform-restricted Maps SDK keys in the build environment:

```text
GOOGLE_MAPS_ANDROID_KEY=...
GOOGLE_MAPS_IOS_KEY=...
```

The iOS map can use the system provider. The server-side Google Places key is a separate secret and must not be shipped with the client:

```powershell
npx supabase secrets set GOOGLE_PLACES_API_KEY=YOUR_SERVER_KEY
npx supabase functions deploy places
```

Enable Places API (New), apply service restrictions and quotas, and configure billing in your Google project. If place search is not configured, hosts can enter a venue name, address, and coordinates or use their current position **when at the venue**. The UI explains this fallback.

## Video publishing and moderation

There are two separate content records and entry points:

- **SpotUp Moments:** short sports posts, reactions, comments, saves, follows, discovery, and links into games/squads/tournaments/venues.
- **Skill Showcase:** profile portfolio videos with sport/category/caption/upload date and a separate visibility policy. Showcase videos are not automatically inserted into SpotUp Moments and never determine a skill rating.

Videos use a private bucket and follow `uploading → pending → ready/rejected`. Uploading users cannot mark their own media ready. The current release uses manual moderator inspection; a transcoding/scanning provider is not configured or represented as implemented. Videos are limited to 90 seconds and 100 MB, with server verification required before approval.

To authorize your first moderator, sign up, copy their user UUID from Supabase Auth, and run this in the trusted SQL editor:

```sql
insert into public.admins(user_id) values ('YOUR_ADMIN_USER_UUID');
```

The moderator can then open Settings → Community moderation. Inspect the full video and independently verify its duration/file size before approving it. Moderation actions are audited. Account suspensions currently use trusted Supabase Auth administration rather than a mobile suspension button.

Privacy is enforced through RLS and server-side RPC checks. Signed playback URLs last two minutes. Already issued URLs and buffered media cannot be retroactively recalled; new reads and URL requests follow current visibility and block rules.

## Push notifications and deletion

```powershell
npx supabase functions deploy delete-account
npx supabase secrets set DISPATCH_SECRET=YOUR_RANDOM_WORKER_SECRET
npx supabase functions deploy dispatch-push --no-verify-jwt
```

Call `dispatch-push` from a trusted scheduler once a minute with `Authorization: Bearer YOUR_RANDOM_WORKER_SECRET`. Do not expose that secret to the client. Delivery uses short leases and bounded retries, respects preferences/quiet hours, and removes invalid device tokens. This release records Expo ticket acceptance; receipt polling and full delivery observability remain a release task. Transport delivery is at least once, not guaranteed exactly once.

Set `EXPO_PUBLIC_EAS_PROJECT_ID` and enable notifications from the app on a physical development build. Quiet hours currently use Pacific Time. In-app notifications are available independently of push delivery.

Account deletion checks active event ownership, hides authored content, disables database access immediately, removes media, and deletes the ability to sign in. De-identified historical game relationships are retained so other players' game and tournament records remain valid. The operation can be retried if media cleanup fails before auth deletion. Operator retention policies and privacy/terms pages must be finalized before public release.

## Build Android / iOS

Choose an application identifier you control in `app.config.ts` before store distribution.

```powershell
npx eas-cli login
npx eas-cli init
npx eas-cli build --profile development --platform android
```

After installing the development build:

```powershell
npx expo start --dev-client
```

For an installable internal Android APK:

```powershell
npx eas-cli build --profile preview --platform android
```

For iOS, use `--platform ios`; Apple signing credentials are required. This archive does not contain an APK/IPA or claim app-store approval.

## Validate

```powershell
npm run typecheck
npm test
npm run export
```

Tests run locally against PostgreSQL via PGlite with explicit Supabase Auth/Storage test stubs. They exercise real SQL functions and RLS, not mocked domain logic. They do not replace validation against a deployed Supabase project or native devices.

See `docs/VALIDATION.md` for the recorded checks and `docs/FEATURE-STATUS.md` for remaining release work.

## Structure

```text
app/                 Expo Router routes and native navigation
src/components/      Shared UI, media, date and location controls
src/screens/         Sports, profile, content, and account workflows
src/lib/             Session, API, types, query state, domain helpers
supabase/migrations/ PostgreSQL schema, RLS, transactional domain functions
supabase/functions/  Places, account deletion, and push delivery
tests/               Domain and PostgreSQL security/integration tests
docs/                Product brief, coverage, architecture, release checks
```

The server owns attendance timestamps, capacity, XP awards, reliability events, squad eligibility, tournament advancement, and moderation status. UI totals are display-only. No engagement XP is granted for watching, liking, posting, or uploading showcases.

## Reference documentation

- [Expo with Supabase](https://docs.expo.dev/guides/using-supabase/)
- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Expo Video](https://docs.expo.dev/versions/latest/sdk/video/)
- [Expo ImagePicker](https://docs.expo.dev/versions/latest/sdk/imagepicker/)
- [Google Places Autocomplete](https://developers.google.com/maps/documentation/places/web-service/place-autocomplete)

## Multisport catalog

25 choices ship with this package, including Other sports. All sport selectors read the Supabase sports catalog. Add a catalog row to support another sport across profiles, games, squads, tournaments, and videos. Basketball imagery is confined to basketball-specific content.
