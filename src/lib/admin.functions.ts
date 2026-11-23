import { createServerFn } from "@tanstack/react-start";

import { requireAdmin } from "@/lib/auth-middleware";
import { validateAccountEdit } from "./account-rules";

export type Department = string;

export const listUsers = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .handler(async () => {
    const { request } = await import("@/server/db.server");
    const req = await request();
    const { recordset } = await req.query<{
      id: string;
      email: string;
      department: string;
      is_admin: boolean;
      is_active: boolean;
      created_at: Date;
    }>(
      `SELECT id, email, department, is_admin, is_active, created_at
         FROM dbo.users ORDER BY created_at`,
    );
    return recordset.map((u) => ({
      id: u.id.toLowerCase(),
      email: u.email,
      department: u.department,
      created_at: u.created_at.toISOString(),
      isAdmin: u.is_admin,
      isActive: u.is_active,
    }));
  });

/** Runs dbo.manage_vault_user, turning its THROW messages into plain errors. */
async function manageUser(
  actorId: string,
  settings: { userId: string; department: string; isAdmin: boolean; isActive: boolean },
) {
  const { request, sql } = await import("@/server/db.server");
  const req = await request();
  await req
    .input("actor_id", sql.UniqueIdentifier, actorId)
    .input("user_id", sql.UniqueIdentifier, settings.userId)
    .input("department", sql.NVarChar(40), settings.department)
    .input("is_admin", sql.Bit, settings.isAdmin)
    .input("is_active", sql.Bit, settings.isActive)
    .execute("dbo.manage_vault_user");
}

export const createUser = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator(
    (input: { email: string; password: string; department: Department; isAdmin: boolean }) => {
      if (!input?.email?.includes("@")) throw new Error("Enter a valid email address.");
      if (!input?.password || input.password.length < 8)
        throw new Error("Password must be at least 8 characters.");
      if (!input.department?.trim()) throw new Error("Select a department.");
      return {
        email: input.email.trim().toLowerCase(),
        password: input.password,
        department: input.department.trim(),
        isAdmin: !!input.isAdmin,
      };
    },
  )
  .handler(async ({ data }) => {
    const { request, sql, isDuplicateKeyError } = await import("@/server/db.server");
    const { hashPassword } = await import("@/server/crypto.server");
    const req = await request();
    try {
      const { rowsAffected } = await req
        .input("email", sql.NVarChar(320), data.email)
        .input("password_hash", sql.NVarChar(256), await hashPassword(data.password))
        .input("department", sql.NVarChar(40), data.department)
        .input("is_admin", sql.Bit, data.isAdmin)
        .query(
          `INSERT INTO dbo.users (email, password_hash, department, is_admin, is_active)
           SELECT @email, @password_hash, @department, @is_admin, 1
            WHERE EXISTS (SELECT 1 FROM dbo.departments WHERE name = @department)`,
        );
      if (!rowsAffected[0]) throw new Error("Select a valid department.");
    } catch (error) {
      if (isDuplicateKeyError(error))
        throw new Error("A user with this email address has already been registered");
      throw error;
    }
    return { ok: true };
  });

export const updateUserAccess = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator(
    (input: { userId: string; department: string; isAdmin: boolean; isActive: boolean }) => {
      if (
        !input?.userId ||
        !input.department ||
        typeof input.isAdmin !== "boolean" ||
        typeof input.isActive !== "boolean"
      )
        throw new Error("Missing account settings.");
      return {
        userId: input.userId.toLowerCase(),
        department: input.department,
        isAdmin: input.isAdmin,
        isActive: input.isActive,
      };
    },
  )
  .handler(async ({ data, context }) => {
    validateAccountEdit(context.user.userId, data.userId, data.isAdmin, data.isActive);
    await manageUser(context.user.userId, data);
    return { ok: true };
  });

/**
 * Creates a one-time reset link for a user. It is emailed when SMTP is configured; the link is
 * also returned so the administrator can pass it on directly when email is not available.
 */
export const sendUserPasswordReset = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((input: { userId: string }) => {
    if (!input?.userId) throw new Error("Missing user.");
    return input;
  })
  .handler(async ({ data }) => {
    const { request, sql } = await import("@/server/db.server");
    const { createResetLink, sendResetEmail } = await import("@/server/password-reset.server");
    const req = await request();
    const { recordset } = await req
      .input("id", sql.UniqueIdentifier, data.userId)
      .query<{ id: string; email: string; is_active: boolean }>(
        `SELECT id, email, is_active FROM dbo.users WHERE id = @id`,
      );
    const user = recordset[0];
    if (!user) throw new Error("User not found.");
    if (!user.is_active) throw new Error("Enable this account before resetting its password.");

    const link = await createResetLink(user.id);
    let emailed = false;
    try {
      emailed = await sendResetEmail(user.email, link);
    } catch (error) {
      console.error("[mail] Could not send password reset email:", error);
    }
    return { emailed, link };
  });

export const deleteUser = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((input: { userId: string }) => {
    if (!input?.userId) throw new Error("Missing user.");
    return input;
  })
  .handler(async ({ data, context }) => {
    if (data.userId.toLowerCase() === context.user.userId)
      throw new Error("You cannot delete your own account.");
    const { request, sql } = await import("@/server/db.server");
    const req = await request();
    await req
      .input("id", sql.UniqueIdentifier, data.userId)
      .query(`DELETE FROM dbo.users WHERE id = @id`);
    return { ok: true };
  });
