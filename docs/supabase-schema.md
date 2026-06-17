# Supabase Schema

## Project

- URL: `https://uhbbhhlzfjnlqguzvlzw.supabase.co`
- Project ref: `uhbbhhlzfjnlqguzvlzw`
- Client app uses only `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` or anon fallback.
- `service_role` and Management API tokens are server/admin only and must never be committed or bundled into the app.

## OAuth Configuration

- Expo app scheme: `whenbollae`
- Android package: `com.lim.whenbollae`
- Supabase Auth > URL Configuration > Redirect URLs:
  - `whenbollae://auth/callback`
  - `whenbollae://**`
- Google Cloud OAuth client and Kakao Developers redirect URI:
  - `https://uhbbhhlzfjnlqguzvlzw.supabase.co/auth/v1/callback`
- Google/Kakao client id and client secret are provider-console values. Keep them in the Supabase dashboard or Management API request only; do not put them in the Expo app, `.env`, or committed files.

## Migration Workflow

- Local Supabase CLI configuration lives at `supabase/config.toml` and uses `project_id = "whenbollae"` for local development.
- Remote project link metadata is local-only under `supabase/.temp/`; do not commit `.temp` files.
- Apply migrations from `E:\LimProjects\Promise\mobile`:

```powershell
$env:SUPABASE_ACCESS_TOKEN = "<personal access token with project privileges>"
$env:SUPABASE_DB_PASSWORD = "<database password or pooler password>"
npx supabase db push --linked
```

- If the command returns `unexpected login role status 403`, the access token does not have enough project privileges for the Supabase Platform endpoint. Use an owner/admin token or set `SUPABASE_DB_PASSWORD` so the CLI can connect directly to Postgres.
- Never commit `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, provider client secrets, `service_role`, or Management API tokens.

## Tables

- `profiles`: public profile for authenticated app users.
- `friend_requests`: pending/accepted/declined/cancelled friend request state.
- `friendships`: accepted friend pairs.
- `appointment_cards`: created cards, mode/status, share token, selected candidate.
- `appointment_candidates`: candidate date/time options per card.
- `appointment_respondents`: respondent identity per card.
- `appointment_candidate_responses`: candidate-level yes/maybe/no/unanswered votes.
- `appointments`: confirmed or manually added calendar items. Manual items use `card_id = null` and keep their UI color in `color_key`.
- `todos`: user-owned checklist items.
- `card_recipients`: app-friend delivery records for a card.
- `notification_tokens`: Expo/FCM push tokens.

## Access Matrix

| Table | Anonymous | Authenticated owner | Authenticated friend/recipient | Service role |
|---|---|---|---|---|
| `profiles` | none | read public profiles, insert/update own | read public profiles | full |
| `friend_requests` | none | send/read/update related requests | read/update related requests | full |
| `friendships` | none | read/delete own relationships | read/delete own relationships | full |
| `appointment_cards` | none | CRUD own cards | read received cards | full |
| `appointment_candidates` | none | CRUD own card candidates | read received card candidates | full |
| `appointment_respondents` | none | read respondents on own cards | create/read/update own respondent row | full |
| `appointment_candidate_responses` | none | read responses on own cards | create/read/update own responses | full |
| `appointments` | none | CRUD own appointments | none | full |
| `todos` | none | CRUD own todos | none | full |
| `card_recipients` | none | manage recipients for own cards | read/update own delivery status | full |
| `notification_tokens` | none | CRUD own tokens | none | full |

## Public Web Response Boundary

The public invitee web flow should not open broad anon table policies. Use Edge Functions with `service_role` for:

- resolving `public_token`
- validating response payloads
- rate limiting public submissions
- hashing `response_token`
- inserting public respondents and candidate responses
- sending push notifications

This keeps unauthenticated access token-based and server-validated instead of exposing writable public tables.

## Friend Acceptance Flow

Friend requests are created by authenticated users against existing `profiles.handle` values. When a pending request is updated to `ACCEPTED`, `handle_friend_request_status_change()` inserts the normalized pair into `friendships`; updates are restricted to pending rows so accepted, declined, and cancelled requests cannot be reopened by the client.

## Card Recipient Boundary

App-friend card delivery writes `card_recipients` only after the owner creates an `appointment_cards` row. The insert policy requires both ownership of `card_id` and an accepted `friendships` row between `auth.uid()` and `recipient_profile_id`; arbitrary authenticated users cannot add non-friends as in-app recipients from a modified client.
