# Leads Credential Management System

A department-based credential vault. Administrators store website logins, share each one with
one or more departments, and manage users. Each user sees only the credentials shared with
their own department.

## Stack

| Layer       | Technology                                                                     |
| ----------- | ------------------------------------------------------------------------------ |
| Framework   | TanStack Start — React 19 with server-side rendering and **server functions**  |
| UI          | TypeScript, Tailwind CSS v4, shadcn/ui (Radix), lucide icons, sonner (toasts)  |
| Data (UI)   | TanStack Query (caching), TanStack Router (file-based routes)                  |
| Database    | Microsoft SQL Server via the `mssql` driver                                    |
| Auth        | Own login: scrypt-hashed passwords + HTTP-only session cookie                  |
| Encryption  | Stored credential passwords encrypted with AES-256-GCM                         |
| Build       | Vite 8; Nitro packages the production build as a standalone Node.js server     |

## How it works

Frontend and backend live in **one project and run as one Node.js process** — there is no
separate API server. TanStack Start splits the code at build time:

```
Browser (React pages)                         Node.js server
─────────────────────                         ──────────────────────────────────────────
src/routes/*.tsx  ── calls ──►  src/lib/*.functions.ts  ──►  src/server/*.server.ts ──► SQL Server
src/components/*                (server functions: run on      (DB pool, crypto,
                                 the server; the browser gets   sessions — never sent
                                 only a tiny fetch stub)        to the browser)
```

- A **server function** (`createServerFn`) is written next to the UI code but executes only on
  the server. When a page calls `listCredentials()`, the browser actually sends an HTTP request
  to `/_serverFn/...`; the server runs the function and returns the result.
- **Login:** `signIn` checks the password hash, stores a random token's SHA-256 in
  `dbo.sessions`, and sets it in an HTTP-only cookie (`kk_session`, 30 days, renewed on use).
- **Access rules:** every protected server function uses `requireAuth` or `requireAdmin`
  (`src/lib/auth-middleware.ts`). Non-admins only ever receive credentials tagged with their
  department; only admins can create, edit or delete anything.
- **Database setup is automatic:** on the first request, the server connects to the database in
  `DATABASE_URL`, creates the database if it does not exist, and applies `database/schema.sql`
  (tables + default departments). The script is idempotent, so it is safe on every start.
  Then open the site and the login page asks you to create the first administrator.

## Files

### Root

| File                               | Purpose                                                                         |
| ---------------------------------- | ------------------------------------------------------------------------------- |
| `.env`                             | Your secrets/config (DB connection, encryption key). Never commit it.            |
| `.env.example`                     | Template for `.env`                                                              |
| `package.json` / `package-lock.json` | Dependencies and npm scripts                                                   |
| `vite.config.ts`                   | Build/dev config: Tailwind, TanStack Start, React, Nitro (Node server output)    |
| `tsconfig.json`                    | TypeScript settings and the `@/` → `src/` import alias                          |
| `eslint.config.js`, `.prettierrc`, `.prettierignore` | Lint and code-format rules (`npm run lint`, `npm run format`) |
| `components.json`                  | shadcn/ui settings, used if you add more UI components with the shadcn CLI       |
| `.gitignore`                       | Keeps `node_modules`, `.output`, `.env` out of git                               |
| `database/schema.sql`              | SQL Server tables; applied automatically at startup                              |
| `public/`                          | Static files served as-is (`favicon.png`, `robots.txt`)                          |
| `.output/`                         | **Generated** by `npm run build` — the deployable server. Not source code.       |
| `node_modules/`                    | **Generated** by `npm install`                                                   |

### Backend (runs only on the server)

| File                                | Purpose                                                                         |
| ----------------------------------- | ------------------------------------------------------------------------------- |
| `src/server/db.server.ts`           | Parses `DATABASE_URL`, connection pool, auto-creates the DB and applies schema   |
| `src/server/crypto.server.ts`       | Password hashing (scrypt), AES-256-GCM encrypt/decrypt, session tokens           |
| `src/server/auth.server.ts`         | Create / read / destroy login sessions (cookie + `dbo.sessions`)                 |
| `src/lib/auth-middleware.ts`        | `requireAuth` / `requireAdmin` guards for server functions                       |
| `src/lib/auth.functions.ts`         | `signIn`, `signOut`, `getSession`, `adminExists`, `createFirstAdmin`             |
| `src/lib/admin.functions.ts`        | Users: `listUsers`, `createUser`, `deleteUser` (admin only)                      |
| `src/lib/masters.functions.ts`      | Departments & entities: list, add, delete                                        |
| `src/lib/credentials.functions.ts`  | Credentials: list (filtered by department), save (create/edit), delete           |
| `src/server.ts`                     | Server entry: wraps every request and shows a friendly page on crashes           |
| `src/start.ts`                      | Global middleware: error handling and CSRF protection for server functions       |
| `src/lib/error-capture.ts`, `src/lib/error-page.ts` | Helpers for the crash page and error logging                     |

### Frontend (React, runs in the browser)

| File                                     | Purpose                                                              |
| ---------------------------------------- | -------------------------------------------------------------------- |
| `src/routes/__root.tsx`                  | HTML shell, fonts, toasts, 404 and error pages                       |
| `src/routes/index.tsx`                   | `/` — login page (and first-administrator setup)                     |
| `src/routes/_authenticated/route.tsx`    | Guard for all pages below: redirects to login if not signed in       |
| `src/routes/_authenticated/dashboard.tsx`| `/dashboard` — welcome + quick credential search                     |
| `src/routes/_authenticated/vault.tsx`    | `/vault` — browse, filter, reveal/copy, edit, delete credentials     |
| `src/routes/_authenticated/users.tsx`    | `/users` — create/delete users (admin)                               |
| `src/routes/_authenticated/masters.tsx`  | `/masters` — manage entities and departments (admin)                 |
| `src/components/AppShell.tsx`            | Sidebar, header and sign-out button around every signed-in page      |
| `src/components/CredentialDialog.tsx`    | Create/edit credential form                                          |
| `src/components/ui/*.tsx`                | Reusable UI pieces (button, input, select, dialog, table, …)         |
| `src/lib/session.ts`                     | React hooks: current user, departments, entities                     |
| `src/lib/utils.ts`                       | `cn()` helper for combining CSS classes                              |
| `src/router.tsx`                         | Creates the router and the shared query cache                        |
| `src/routeTree.gen.ts`                   | **Generated** route list — do not edit                               |
| `src/styles.css`                         | Tailwind setup and the colour theme                                  |
| `src/assets/login-hero.jpg`              | Login page image                                                     |

## Configuration (`.env`)

| Variable                | Purpose                                                                                                         |
| ----------------------- | --------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`          | `sqlserver://HOST[\INSTANCE][:PORT];database=NAME;user=...;password=...;encrypt=true;trustServerCertificate=true` |
| `ENCRYPTION_KEY`        | 32-byte base64 key for credential passwords. Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` |
| `SESSION_COOKIE_SECURE` | `true` when the site is served over HTTPS                                                                        |
| `PORT` (optional)       | Port to listen on (default 3000)                                                                                 |

**Switching database:** change `DATABASE_URL` and restart. If the database does not exist it
is created (the SQL login needs `CREATE DATABASE` permission for that; `sa` has it), tables are
created, and the first visit asks for a new administrator. Data is not copied between databases.

> **Back up `ENCRYPTION_KEY`.** If it is lost or changed, saved credential passwords cannot be
> decrypted. Keep the same key when moving to another server or database with existing data.

## Run locally

Requires Node.js 20.12 or newer.

```sh
npm install        # once, or after package.json changes
npm run dev        # http://localhost:3000, reloads on code changes
```

## Build and host

```sh
npm run build      # creates .output/ (the complete server, ~5 MB)
npm start          # runs .output/server/index.mjs with .env, on PORT (default 3000)
```

To deploy, copy **`.output/`, `.env` and `package.json`** to the server (it needs Node.js but
not `node_modules` or the source) and run `npm start` there — or directly
`node --env-file=.env .output/server/index.mjs`.

Keep it running with pm2 (`pm2 start npm --name keychain -- start`) or as a Windows service
(e.g. NSSM), and put IIS (URL Rewrite + ARR) or nginx in front for HTTPS; then set
`SESSION_COOKIE_SECURE=true`.

## Other scripts

| Command          | What it does                       |
| ---------------- | ---------------------------------- |
| `npm run lint`   | Check code with ESLint             |
| `npm run format` | Auto-format all code with Prettier |
