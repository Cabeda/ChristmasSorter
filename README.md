# Christmas Sorter

Web app to run a Secret Santa / Amigo Secreto event and send each participant
their own assignment by email.

This repository contains a small React frontend (Vite) and two serverless
endpoints: `/api/email` draws and sends, and `/api/retry` resends only the
recipients that failed. The draw is **blind**: the browser only receives an
opaque, encrypted token, never the list of pairs, so the organizer (who is also
a participant) cannot peek at who got whom.

## Requirements

- Node.js (>=16) and pnpm (the lockfile is pnpm).
- SMTP credentials and a token secret.
- `SORTER_SECRET` — required. It encrypts the token used by retries.
  Generate one with `openssl rand -base64 48`.

## Setup

```sh
cp .env.example .env.local   # fill in the values
pnpm install
pnpm dev                     # http://localhost:3000
```

Environment variables (see `.env.example`):

| Variable | Purpose |
|---|---|
| `MAIL_ADDRESS`, `MAIL_PASSWORD` | SMTP sender and password/app password |
| `SORTER_SECRET` | Encrypts the draw token; required for retries |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE` | Optional, default to Gmail:587 STARTTLS |
| `ALLOWED_ORIGINS` | Optional comma-separated browser origins |
| `RATE_LIMIT_MAX`, `RATE_LIMIT_WINDOW_MS` | Optional per-IP limits (default 8 / 10 min) |

Never commit real credentials. `.env*` is ignored; `.env.example` is safe.

## How it works

1. The organizer fills in the event and participants (with unique emails).
2. `/api/email` validates the payload, draws a derangement on the server, seals
   the draw into an `AES-256-GCM` token, sends one email per participant, and
   replies with counts plus the token. The pairs are never returned or logged.
3. If some emails fail, the UI offers “Reenviar N falha(s)”. `/api/retry`
   decrypts the same token and resends **only** those recipients, so a failure
   never changes the draw.

Couples or other “must not draw each other” pairs can be passed as
`exclusions: [["a@example.com", "b@example.com"]]`; the sorter honors them and
returns `422` when no valid draw exists. The UI picker for exclusions is not
built yet, but the API and tests support them.

### Secrecy boundary

“Blind” means blind through the app and API. Whoever holds `SORTER_SECRET` (the
server operator) can decrypt a token. Do not store the secret client-side.

## Scripts

```sh
pnpm dev             # Vite dev server
pnpm build           # production bundle
pnpm preview         # preview the build
pnpm test            # run the suite once
pnpm test:watch      # watch mode
pnpm test:coverage   # enforce 100% statements/branches/functions/lines
pnpm type-check      # tsc --noEmit
pnpm format          # Prettier on src
```

## Structure

- `src/` — React UI (`Components/RegistrationForm.tsx` is the whole form).
- `Shared/business/Sorter.ts` — seeded, exclusion-aware derangement plus an
  exact backtracking fallback; `Sorter.test.ts` property-tests the invariants.
- `api/email.ts`, `api/retry.ts` — serverless handlers.
- `api/_lib/` — validation, HTML-safe email rendering, AES-GCM tokens, and the
  origin + sliding-window rate-limit guard.

## Security notes

- Emails are rendered with all user input HTML-escaped.
- The API validates every field server-side (participant cap, unique emails,
  price bounds, exclusion feasibility) and rejects non-POST requests.
- `/api/email` and `/api/retry` check the browser origin and rate-limit per IP.
  The limiter is in-memory per serverless instance; set `ALLOWED_ORIGINS` in
  production.
- Sends are sequential to stay under SMTP rate limits.

## License

This project does not include a license file. Add one if you plan to
open-source it.
