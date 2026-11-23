import { createServerFn } from "@tanstack/react-start";

import { requireAuth } from "@/lib/auth-middleware";

function validateCredentials(input: { email: string; password: string }) {
  if (!input?.email?.includes("@")) throw new Error("Enter a valid email address.");
  if (!input?.password || input.password.length < 8)
    throw new Error("Password must be at least 8 characters.");
  return { email: input.email.trim().toLowerCase(), password: input.password };
}

function validateNewPassword(password: unknown): string {
  if (typeof password !== "string" || password.length < 8)
    throw new Error("Password must be at least 8 characters.");
  return password;
}

export const getSession = createServerFn({ method: "GET" }).handler(async () => {
  const { getSessionUser } = await import("@/server/auth.server");
  return getSessionUser();
});

export const signIn = createServerFn({ method: "POST" })
  .inputValidator((input: { email: string; password: string }) => {
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
      .query<{ id: string; password_hash: string; is_active: boolean }>(
        `SELECT id, password_hash, is_active FROM dbo.users WHERE email = @email`,
      );
    const user = recordset[0];
    const ok = await verifyPassword(data.password, user?.password_hash ?? (await getDummyHash()));
    if (!user || !ok) throw new Error("Invalid login credentials");
    if (!user.is_active) throw new Error("This account is disabled. Contact an administrator.");

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
  .inputValidator(validateCredentials)
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

/**
 * Public "forgot password". Always answers the same way so it does not reveal which emails
 * have accounts; a link is emailed only to an existing, active account.
 */
export const requestPasswordReset = createServerFn({ method: "POST" })
  .inputValidator((input: { email: string }) => {
    if (!input?.email?.includes("@")) throw new Error("Enter a valid email address.");
    return { email: input.email.trim().toLowerCase() };
  })
  .handler(async ({ data }) => {
    const { request, sql } = await import("@/server/db.server");
    const { createResetLink, emailConfigured, sendResetEmail } =
      await import("@/server/password-reset.server");
    if (!emailConfigured()) {
      throw new Error(
        "Password reset emails are not set up on this server. Ask an administrator to send you a reset link.",
      );
    }
    const req = await request();
    const { recordset } = await req.input("email", sql.NVarChar(320), data.email).query<{
      id: string;
      recent: number;
    }>(
      `SELECT u.id,
              (SELECT COUNT(*) FROM dbo.password_resets r
                WHERE r.user_id = u.id AND r.created_at > DATEADD(SECOND, -60, SYSUTCDATETIME())) AS recent
         FROM dbo.users u WHERE u.email = @email AND u.is_active = 1`,
    );
    const user = recordset[0];
    // Skip silently when unknown, disabled, or a link was sent within the last minute.
    if (user && !user.recent) {
      try {
        await sendResetEmail(data.email, await createResetLink(user.id));
      } catch (error) {
        console.error("[mail] Could not send password reset email:", error);
        throw new Error("Could not send the reset email. Try again later.");
      }
    }
    return { ok: true };
  });

export const checkResetToken = createServerFn({ method: "POST" })
  .inputValidator((input: { token: string }) => ({ token: String(input?.token ?? "") }))
  .handler(async ({ data }) => {
    const { findResetUser } = await import("@/server/password-reset.server");
    return { valid: !!(await findResetUser(data.token)) };
  });

/** Recovery via emailed/admin link: no old password needed. Signs the user out everywhere. */
export const resetPassword = createServerFn({ method: "POST" })
  .inputValidator((input: { token: string; password: string }) => ({
    token: String(input?.token ?? ""),
    password: validateNewPassword(input?.password),
  }))
  .handler(async ({ data }) => {
    const { request, sql } = await import("@/server/db.server");
    const { hashPassword, sha256Hex } = await import("@/server/crypto.server");
    const { findResetUser } = await import("@/server/password-reset.server");
    const { destroyUserSessions } = await import("@/server/auth.server");

    const userId = await findResetUser(data.token);
    if (!userId) throw new Error("This reset link is invalid or has expired.");
    const req = await request();
    // Consuming the token in the same statement makes a link usable only once.
    const { rowsAffected } = await req
      .input("user_id", sql.UniqueIdentifier, userId)
      .input("token_hash", sql.Char(64), sha256Hex(data.token))
      .input("password_hash", sql.NVarChar(256), await hashPassword(data.password))
      .query(
        `DELETE FROM dbo.password_resets WHERE token_hash = @token_hash AND user_id = @user_id;
         IF @@ROWCOUNT = 1
         BEGIN
           UPDATE dbo.users SET password_hash = @password_hash WHERE id = @user_id;
           DELETE FROM dbo.password_resets WHERE user_id = @user_id;
         END`,
      );
    if (!rowsAffected[1]) throw new Error("This reset link is invalid or has expired.");
    await destroyUserSessions(userId);
    return { ok: true };
  });

/** Signed-in password change: requires the current password; other devices are signed out. */
export const changePassword = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: { currentPassword: string; password: string }) => {
    if (!input?.currentPassword) throw new Error("Enter your current password.");
    return {
      currentPassword: input.currentPassword,
      password: validateNewPassword(input.password),
    };
  })
  .handler(async ({ data, context }) => {
    const { request, sql } = await import("@/server/db.server");
    const { hashPassword, verifyPassword } = await import("@/server/crypto.server");
    const { destroyUserSessions } = await import("@/server/auth.server");

    const userId = context.user.userId;
    const req = await request();
    const { recordset } = await req
      .input("id", sql.UniqueIdentifier, userId)
      .query<{ password_hash: string }>(`SELECT password_hash FROM dbo.users WHERE id = @id`);
    const stored = recordset[0]?.password_hash;
    if (!stored || !(await verifyPassword(data.currentPassword, stored)))
      throw new Error("Current password is incorrect.");

    const update = await request();
    await update
      .input("id", sql.UniqueIdentifier, userId)
      .input("password_hash", sql.NVarChar(256), await hashPassword(data.password))
      .query(`UPDATE dbo.users SET password_hash = @password_hash WHERE id = @id`);
    await destroyUserSessions(userId, true);
    return { ok: true };
  });
