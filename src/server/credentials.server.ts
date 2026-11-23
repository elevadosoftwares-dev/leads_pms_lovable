// Reads credentials with the department access rule applied. Shared by the vault pages and the
// AI features so every caller sees exactly what the signed-in user is allowed to see.
import { request, sql } from "./db.server";
import { decryptSecret } from "./crypto.server";
import type { SessionUser } from "./auth.server";

export type StoredCredential = {
  id: string;
  entity_id: string | null;
  site_url: string;
  login_user_id: string;
  registered_email: string | null;
  registered_mobile: string | null;
  client_name: string;
  purpose: string | null;
  departments: string[];
  contact_name: string | null;
  contact_email: string | null;
  contact_tel: string | null;
  token_type: string | null;
  token_holder: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * Admins get every credential; everyone else only those shared with their department.
 * Passwords are decrypted only when `withPasswords` is true.
 */
export async function loadCredentials(
  user: SessionUser,
  withPasswords: true,
): Promise<(StoredCredential & { password: string })[]>;
export async function loadCredentials(
  user: SessionUser,
  withPasswords?: false,
): Promise<StoredCredential[]>;
export async function loadCredentials(user: SessionUser, withPasswords = false) {
  const scope = user.isAdmin
    ? ""
    : `WHERE EXISTS (SELECT 1 FROM dbo.credential_departments d
                      WHERE d.credential_id = c.id AND d.department = @department)`;
  const req = await request();
  const { recordsets } = await req.input("department", sql.NVarChar(40), user.department).query(
    `SELECT c.id, c.entity_id, c.site_url, c.login_user_id,
            ${withPasswords ? "c.password_enc," : ""}
            c.registered_email, c.registered_mobile, c.client_name, c.purpose, c.contact_name,
            c.contact_email, c.contact_tel, c.token_type, c.token_holder, c.created_at, c.updated_at
       FROM dbo.credentials c ${scope}
      ORDER BY c.client_name;
     SELECT d.credential_id, d.department
       FROM dbo.credential_departments d
       JOIN dbo.credentials c ON c.id = d.credential_id ${scope}
      ORDER BY d.department;`,
  );
  type Row = Omit<StoredCredential, "departments" | "created_at" | "updated_at"> & {
    password_enc?: string;
    created_at: Date;
    updated_at: Date;
  };
  const [rows, departmentRows] = recordsets as unknown as [
    Row[],
    { credential_id: string; department: string }[],
  ];

  const departmentsById = new Map<string, string[]>();
  for (const d of departmentRows) {
    const id = d.credential_id.toLowerCase();
    departmentsById.set(id, [...(departmentsById.get(id) ?? []), d.department]);
  }

  return rows.map(({ password_enc, ...row }) => {
    const id = row.id.toLowerCase();
    const result = {
      ...row,
      id,
      entity_id: row.entity_id?.toLowerCase() ?? null,
      departments: departmentsById.get(id) ?? [],
      created_at: row.created_at.toISOString(),
      updated_at: row.updated_at.toISOString(),
    };
    return withPasswords ? { ...result, password: decryptSecret(password_enc ?? "") } : result;
  });
}

/** Entity id -> name lookup. */
export async function loadEntityNames(): Promise<Map<string, string>> {
  const req = await request();
  const { recordset } = await req.query<{ id: string; name: string }>(
    `SELECT id, name FROM dbo.entities`,
  );
  return new Map(recordset.map((e) => [e.id.toLowerCase(), e.name]));
}
