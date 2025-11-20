# Christmas Sorter

Web app to run a Secret Santa / Amigo Secreto event and send invitation emails to participants.

This repository contains a small React frontend (Vite) and a serverless API endpoint (`/api/email`) that sends emails to the participants after performing the random assignment.

Quick overview

- Frontend: `src/` — main UI is `src/Components/RegistrationForm.tsx`.
- Serverless email endpoint: `api/email.ts` — sends emails using SMTP (nodemailer).
- Business logic: `Shared/business/Sorter.ts` — performs the assignment.

Requirements

- Node.js (>=16) and a package manager (`pnpm`, `npm` or `yarn`).
- SMTP credentials (environment variables) to send emails in `api/email.ts`:
  - `MAIL_ADDRESS` — sender email
  - `MAIL_PASSWORD` — SMTP password (or app password)

Scripts

- `pnpm install` — install dependencies
- `pnpm dev` — start Vite development server (opens app at `http://localhost:5173` by default)
- `pnpm build` — build production assets
- `pnpm preview` — preview production build locally
- `pnpm test` — run unit tests with Vitest (if any)
- `pnpm format` — run Prettier on source files

How it works

1. Open the app and fill the registration form (event name, date, price, participants).
2. Click the `Sortear` / `Shuffle` button to run the assignment and trigger the `/api/email` endpoint.
3. The serverless function will compute recipients and send an email to each participant with the assigned person.

More about how assignments and emails work

- When you submit the form the backend performs a random assignment: each participant is assigned another participant to give a gift to. The algorithm ensures that participants are assigned fairly and (depending on the rule set) avoids assigning someone to themselves.
- After the assignment is computed, the serverless function (`/api/email`) sends an individual email to each participant with the name and contact of the person they should give a gift to. Each participant receives only their own assignment — results are private and not shared with others.
- Make sure all participant emails are correct before submitting; once the function sends emails the action cannot be undone by the UI. For testing, use a disposable SMTP (or your own inbox) to verify formatting and delivery.

Notes

- The UI supports a festive theme and includes an easter-egg "Santa mode" (click the header several times).
- The email text and many UI strings were translated to Portuguese; you can revert or adapt the texts in `src/Components/RegistrationForm.tsx` and `api/email.ts`.
- For deployment, this repo works well on Vercel — the `api/` folder maps to serverless functions automatically when deployed to Vercel.

Security

- Do not commit SMTP credentials or other secrets to the repository. Use environment variables in your deployment platform.

Contributing

- Fixes, improvements and translations are welcome. Open a PR against the `master` branch (or `feat/*` branches as used during development).

License

- This project does not include a license file. Add one if you plan to open-source it.
