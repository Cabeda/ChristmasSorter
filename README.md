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

- `pnpm install` or `npm install` — install dependencies
- `pnpm dev` / `npm run dev` — start Vite development server (opens app at `http://localhost:5173` by default)
- `pnpm build` / `npm run build` — build production assets
- `pnpm preview` / `npm run preview` — preview production build locally
- `pnpm test` / `npm test` — run unit tests with Vitest (if any)
- `pnpm format` / `npm run format` — run Prettier on source files

How it works

1. Open the app and fill the registration form (event name, date, price, participants).
2. Click the `Sortear` / `Shuffle` button to run the assignment and trigger the `/api/email` endpoint.
3. The serverless function will compute recipients and send an email to each participant with the assigned person.

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
