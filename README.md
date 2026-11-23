# Leads Credential Management System (v2)

A department-based credential vault. Administrators store website logins, share each one with
one or more departments, and manage users. Each user sees only the credentials shared with
their own department.

v2 is self-hosted exactly like v1 (one Node.js process on Microsoft SQL Server) and adds:

- **Account controls:** edit a user's department, administrator role and active state; disabled
  accounts are signed out immediately; you cannot remove your own admin access, and at least
  one active administrator always remains.
- **Passwords:** forgot-password at `/forgot-password`, one-time reset links at
  `/reset-password` (no old password needed), and signed-in password change at `/account`.
- **Credentials:** "Digital/Physical Token Or Keys" and "Holding By" fields, clickable site
  links, and **Backup All** (CSV export) in the vault.
- **AI features (optional):** assistant chat with one saved conversation per user, smart
  search, credential health check, admin insights, and a form-fill helper. Passwords, tokens
  and keys are never sent to the AI.

## Stack

| Layer      | Technology                                                                    |
| ---------- | ----------------------------------------------------------------------------- |
| Framework  | TanStack Start — React 19 with server-side rendering and **server functions** |
| UI         | TypeScript, Tailwind CSS v4, shadcn/ui (Radix), lucide icons, sonner (toasts) |
| Data (UI)  | TanStack Query (caching), TanStack Router (file-based routes)                 |
| Database   | Microsoft SQL Server via the `mssql` driver                                   |
| Auth       | Own login: scrypt-hashed passwords + HTTP-only session cookie                 |
| Encryption | Stored credential passwords encrypted with AES-256-GCM                        |
| Email      | Optional SMTP via `nodemailer` (password reset links)                         |
| AI         | Vercel AI SDK against any OpenAI-compatible Responses API (optional)          |
| Build      | Vite 8; Nitro packages the production build as a standalone Node.js server    |

## How it works

Frontend and backend live in **one project and run as one Node.js process**:

```
Browser (React pages)                         Node.js server
─────────────────────                         ──────────────────────────────────────────
src/routes/*.tsx  ── calls ──►  src/lib/*.functions.ts  ──►  src/server/*.server.ts ──► SQL Server
src/components/*                (server functions)             (DB pool, crypto, sessions,
                                                                credentials, reset links)
```

- **Access rules:** every protected server function uses `requireAuth` or `requireAdmin`
  (`src/lib/auth-middleware.ts`). A session only counts while the account is active, so
  disabling a user ends their access on their next request. Non-admins only ever receive
  credentials tagged with their department (`src/server/credentials.server.ts`).
- **Account changes** go through the `dbo.manage_vault_user` stored procedure, which takes an
  exclusive lock so concurrent edits cannot leave the system without an active administrator.
- **Database setup and upgrades are automatic:** on the first request the server creates the
  database if needed and applies `database/schema.sql`. The script is idempotent and only adds
  what is missing, so an existing v1 database keeps all its data and gains the v2 columns
  (`users.is_active`, `credentials.token_type`, `credentials.token_holder`) and tables
  (`password_resets`, `ai_chat_conversations`).

## Upgrading from v1

1. Back up the database (e.g. `BACKUP DATABASE new_leads_pms TO DISK = N'before_v2.bak'`).
2. Copy the v1 `.env` into this folder — **the same `ENCRYPTION_KEY` is required** to read the
   saved passwords.
3. `npm install`, `npm run build`, stop v1, `npm start`. The first request upgrades the schema.

## Configuration (`.env`)

| Variable                | Purpose                                                                                                                              |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `DATABASE_URL`          | `sqlserver://HOST[\INSTANCE][:PORT];database=NAME;user=...;password=...;encrypt=true;trustServerCertificate=true`                    |
| `ENCRYPTION_KEY`        | 32-byte base64 key for credential passwords. Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` |
| `SESSION_COOKIE_SECURE` | `true` when the site is served over HTTPS                                                                                            |
| `PORT` (optional)       | Port to listen on (default 3000)                                                                                                     |
| `APP_URL` (optional)    | Public site address used in reset links, e.g. `https://credentials.example.com`                                                      |
| `SMTP_*` (optional)     | `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` — emails reset links                              |
| `AI_*` (optional)       | `AI_API_KEY`, `AI_BASE_URL` (default OpenAI), `AI_MODEL` — enables the AI features. `LOVABLE_API_KEY` also works                     |

Without SMTP, "Forgot Password" tells the user to ask an administrator, and the administrator's
reset button in User Management shows a one-time link (valid 60 minutes) to pass on. Without an
AI key, the AI panels show "AI is not configured" and everything else works.

> **Back up `ENCRYPTION_KEY`.** If it is lost or changed, saved credential passwords cannot be
> decrypted.

## Run locally

Requires Node.js 22 or newer and a reachable SQL Server.

```sh
npm install        # once, or after package.json changes
npm run dev        # http://localhost:3000, reloads on code changes
```

## Build and host

```sh
npm run build      # creates .output/ (the complete server)
npm start          # runs .output/server/index.mjs with .env, on PORT (default 3000)
```

To deploy, copy **`.output/`, `.env` and `package.json`** to the server (it needs Node.js but
not `node_modules` or the source) and run `npm start` there — or directly
`node --env-file=.env .output/server/index.mjs`.

Keep it running with pm2 (`pm2 start npm --name leads-pms -- start`) or as a Windows service
(e.g. NSSM), and put IIS (URL Rewrite + ARR) or nginx in front for HTTPS; then set
`SESSION_COOKIE_SECURE=true` and `APP_URL`.

## Scripts

| Command          | What it does                       |
| ---------------- | ---------------------------------- |
| `npm run dev`    | Development server                 |
| `npm run build`  | Production build into `.output/`   |
| `npm start`      | Run the production build           |
| `npm test`       | Unit tests (account rules)         |
| `npm run lint`   | Check code with ESLint             |
| `npm run format` | Auto-format all code with Prettier |
