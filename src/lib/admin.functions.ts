import { createServerFn } from "@tanstack/react-start";
import { requireAdmin } from "@/lib/auth-middleware";

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
      created_at: Date;
    }>(`SELECT id, email, department, is_admin, created_at FROM dbo.users ORDER BY created_at`);
    return recordset.map((u) => ({
      id: u.id.toLowerCase(),
      email: u.email,
      department: u.department,
      created_at: u.created_at.toISOString(),
      isAdmin: u.is_admin,
    }));
  });

export const createUser = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator(
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
      await req
        .input("email", sql.NVarChar(320), data.email)
        .input("password_hash", sql.NVarChar(256), await hashPassword(data.password))
        .input("department", sql.NVarChar(40), data.department)
        .input("is_admin", sql.Bit, data.isAdmin)
        .query(
          `INSERT INTO dbo.users (email, password_hash, department, is_admin)
           VALUES (@email, @password_hash, @department, @is_admin)`,
        );
    } catch (error) {
      if (isDuplicateKeyError(error))
        throw new Error("A user with this email address has already been registered");
      throw error;
    }
    return { ok: true };
  });

export const deleteUser = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator((input: { userId: string }) => {
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
