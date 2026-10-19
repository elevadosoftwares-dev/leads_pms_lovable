import { createServerFn } from "@tanstack/react-start";

function validateCredentials(input: { email: string; password: string }) {
  if (!input?.email?.includes("@")) throw new Error("Enter a valid email address.");
  if (!input?.password || input.password.length < 8)
    throw new Error("Password must be at least 8 characters.");
  return { email: input.email.trim().toLowerCase(), password: input.password };
}

export const getSession = createServerFn({ method: "GET" }).handler(async () => {
  const { getSessionUser } = await import("@/server/auth.server");
  return getSessionUser();
});

export const signIn = createServerFn({ method: "POST" })
  .validator((input: { email: string; password: string }) => {
    if (!input?.email || !input?.password) throw new Error("Enter your email and password.");
    return { email: input.email.trim().toLowerCase(), password: input.password };
  })
  .handler(async ({ data }) => {
    const { request, sql } = await import("@/server/db.server");
    const { verifyPassword, getDummyHash } = await import("@/server/crypto.server");
    const { createSession } = await import("@/server/auth.server");

    const req = await request();
    const { recordset } = await req
      .input("email", sql.NVarChar(320), data.email)
      .query<{ id: string; password_hash: string }>(
        `SELECT id, password_hash FROM dbo.users WHERE email = @email`,
      );
    const user = recordset[0];
    const ok = await verifyPassword(data.password, user?.password_hash ?? (await getDummyHash()));
    if (!user || !ok) throw new Error("Invalid login credentials");

    await createSession(user.id);
    return { ok: true };
  });

export const signOut = createServerFn({ method: "POST" }).handler(async () => {
  const { destroySession } = await import("@/server/auth.server");
  await destroySession();
  return { ok: true };
});

export const adminExists = createServerFn({ method: "GET" }).handler(async () => {
  const { request } = await import("@/server/db.server");
  const req = await request();
  const { recordset } = await req.query<{ n: number }>(
    `SELECT COUNT(*) AS n FROM dbo.users WHERE is_admin = 1`,
  );
  return { exists: (recordset[0]?.n ?? 0) > 0 };
});

export const createFirstAdmin = createServerFn({ method: "POST" })
  .validator(validateCredentials)
  .handler(async ({ data }) => {
    const { request, sql } = await import("@/server/db.server");
    const { hashPassword } = await import("@/server/crypto.server");

    const req = await request();
    // The lock hints make the "no admin yet" check and the insert atomic.
    const { rowsAffected } = await req
      .input("email", sql.NVarChar(320), data.email)
      .input("password_hash", sql.NVarChar(256), await hashPassword(data.password))
      .query(
        `INSERT INTO dbo.users (email, password_hash, department, is_admin)
         SELECT @email, @password_hash, N'Admin', 1
          WHERE NOT EXISTS (SELECT 1 FROM dbo.users WITH (UPDLOCK, HOLDLOCK) WHERE is_admin = 1)`,
      );
    if (!rowsAffected[0]) throw new Error("An administrator already exists.");
    return { ok: true };
  });
