> [!IMPORTANT]
> Avoid rewriting published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed. Keep the pushed branch in a working state.

This app is self-hosted: one Node.js process (TanStack Start + Nitro `node-server`) on
Microsoft SQL Server. There is no Supabase; see README.md for setup and hosting.

- Keep all database access in server-only code (`src/server/*.server.ts`, or dynamic imports
  inside server function handlers). Browser code never imports from `src/server/`.
- Keep administrator mutations in `requireAdmin` server functions and the atomic
  `dbo.manage_vault_user` procedure; it enforces role checks and prevents self-lockout and
  concurrent removal of the last active administrator.
- Enforce disabled accounts in `getSessionUser` (sessions only count for `users.is_active = 1`);
  access must stop even for an already issued session cookie.
- Non-admins only receive credentials shared with their department; read credentials through
  `loadCredentials` in `src/server/credentials.server.ts`.
- Keep recovery at public `/reset-password` (one-time token, no old password) and signed-in
  password changes at protected `/account` (requires the current password).
- `database/schema.sql` must stay idempotent and additive: existing databases are upgraded in
  place on startup, so never drop or rewrite existing tables or data there.
- Keep AI calls in server-only `src/lib/ai` modules; browser features call authenticated server
  functions or `/api/chat`, and prompts must exclude passwords, tokens and other secrets.
