import { createServerFn } from "@tanstack/react-start";

import { requireAdmin, requireAuth } from "@/lib/auth-middleware";
import type { CredentialRow } from "@/components/CredentialDialog";

export type CredentialInput = Omit<CredentialRow, "id"> & { id?: string | undefined };

export const TOKEN_TYPES = ["Digital Token", "Physical Token", "Keys"] as const;

const optionalFields = [
  "registered_email",
  "registered_mobile",
  "purpose",
  "contact_name",
  "contact_email",
  "contact_tel",
  "token_type",
  "token_holder",
] as const;

/** Admins see every credential; everyone else only those shared with their department. */
export const listCredentials = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }): Promise<CredentialRow[]> => {
    const { loadCredentials } = await import("@/server/credentials.server");
    const rows = await loadCredentials(context.user, true);
    return rows.map(({ created_at: _c, updated_at: _u, ...row }) => row);
  });

export const saveCredential = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((input: CredentialInput) => {
    if (!input?.entity_id) throw new Error("Select an entity.");
    if (!input.login_user_id?.trim() || !input.password?.trim())
      throw new Error("User ID and Password are required.");
    if (!input.client_name?.trim()) throw new Error("Client name is required.");
    if (input.client_name.length > 15)
      throw new Error("Client name must be 15 characters or less.");
    const departments = [
      ...new Set((input.departments ?? []).map((d) => d.trim()).filter(Boolean)),
    ];
    if (departments.length === 0) throw new Error("Select at least one department.");
    if (input.token_type && !(TOKEN_TYPES as readonly string[]).includes(input.token_type))
      throw new Error("Select a valid token or keys type.");

    const clean = { ...input, site_url: input.site_url ?? "", departments };
    for (const key of optionalFields) clean[key] = input[key]?.trim() ? input[key] : null;
    return clean;
  })
  .handler(async ({ data, context }) => {
    const { getPool, sql } = await import("@/server/db.server");
    const { encryptSecret } = await import("@/server/crypto.server");

    const pool = await getPool();
    const tx = new sql.Transaction(pool);
    await tx.begin();
    try {
      const req = new sql.Request(tx)
        .input("entity_id", sql.UniqueIdentifier, data.entity_id)
        .input("site_url", sql.NVarChar(2000), data.site_url)
        .input("login_user_id", sql.NVarChar(500), data.login_user_id)
        .input("password_enc", sql.NVarChar(sql.MAX), encryptSecret(data.password))
        .input("registered_email", sql.NVarChar(320), data.registered_email)
        .input("registered_mobile", sql.NVarChar(50), data.registered_mobile)
        .input("client_name", sql.NVarChar(15), data.client_name)
        .input("purpose", sql.NVarChar(1000), data.purpose)
        .input("contact_name", sql.NVarChar(200), data.contact_name)
        .input("contact_email", sql.NVarChar(320), data.contact_email)
        .input("contact_tel", sql.NVarChar(50), data.contact_tel)
        .input("token_type", sql.NVarChar(40), data.token_type)
        .input("token_holder", sql.NVarChar(200), data.token_holder);

      let id = data.id;
      if (id) {
        const { rowsAffected } = await req.input("id", sql.UniqueIdentifier, id).query(
          `UPDATE dbo.credentials
              SET entity_id = @entity_id, site_url = @site_url, login_user_id = @login_user_id,
                  password_enc = @password_enc, registered_email = @registered_email,
                  registered_mobile = @registered_mobile, client_name = @client_name,
                  purpose = @purpose, contact_name = @contact_name, contact_email = @contact_email,
                  contact_tel = @contact_tel, token_type = @token_type,
                  token_holder = @token_holder, updated_at = SYSUTCDATETIME()
            WHERE id = @id;
           DELETE FROM dbo.credential_departments WHERE credential_id = @id;`,
        );
        if (!rowsAffected[0]) throw new Error("This credential no longer exists.");
      } else {
        const { recordset } = await req
          .input("created_by", sql.UniqueIdentifier, context.user.userId)
          .query<{ id: string }>(
            `INSERT INTO dbo.credentials
               (entity_id, site_url, login_user_id, password_enc, registered_email, registered_mobile,
                client_name, purpose, contact_name, contact_email, contact_tel, token_type,
                token_holder, created_by)
             OUTPUT INSERTED.id
             VALUES (@entity_id, @site_url, @login_user_id, @password_enc, @registered_email,
                     @registered_mobile, @client_name, @purpose, @contact_name, @contact_email,
                     @contact_tel, @token_type, @token_holder, @created_by)`,
          );
        id = recordset[0]?.id;
      }

      for (const department of data.departments) {
        await new sql.Request(tx)
          .input("credential_id", sql.UniqueIdentifier, id)
          .input("department", sql.NVarChar(40), department)
          .query(
            `INSERT INTO dbo.credential_departments (credential_id, department)
             VALUES (@credential_id, @department)`,
          );
      }
      await tx.commit();
    } catch (error) {
      await tx.rollback().catch(() => {});
      throw error;
    }
    return { ok: true };
  });

export const deleteCredential = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((input: { id: string }) => {
    if (!input?.id) throw new Error("Missing credential.");
    return input;
  })
  .handler(async ({ data }) => {
    const { request, sql } = await import("@/server/db.server");
    const req = await request();
    await req
      .input("id", sql.UniqueIdentifier, data.id)
      .query(`DELETE FROM dbo.credentials WHERE id = @id`);
    return { ok: true };
  });
