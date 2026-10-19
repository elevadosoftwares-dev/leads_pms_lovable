import { createServerFn } from "@tanstack/react-start";
import { requireAdmin, requireAuth } from "@/lib/auth-middleware";

export type MasterTable = "entities" | "departments";

export const listDepartments = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async () => {
    const { request } = await import("@/server/db.server");
    const req = await request();
    const { recordset } = await req.query<{ name: string }>(
      `SELECT name FROM dbo.departments ORDER BY name`,
    );
    return recordset.map((d) => d.name);
  });

export const listEntities = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async () => {
    const { request } = await import("@/server/db.server");
    const req = await request();
    const { recordset } = await req.query<{ id: string; name: string }>(
      `SELECT id, name FROM dbo.entities ORDER BY name`,
    );
    return recordset.map((e) => ({ id: e.id.toLowerCase(), name: e.name }));
  });

function validateTable(table: unknown): MasterTable {
  if (table !== "entities" && table !== "departments") throw new Error("Unknown master list.");
  return table;
}

export const addMaster = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator((input: { table: MasterTable; name: string }) => {
    const table = validateTable(input?.table);
    const name = input?.name?.trim() ?? "";
    const max = table === "entities" ? 100 : 40;
    if (!name) throw new Error("Enter a name.");
    if (name.length > max) throw new Error(`Name must be ${max} characters or less.`);
    return { table, name };
  })
  .handler(async ({ data }) => {
    const { request, sql, isDuplicateKeyError } = await import("@/server/db.server");
    const req = await request();
    try {
      await req
        .input("name", sql.NVarChar(100), data.name)
        .query(
          data.table === "entities"
            ? `INSERT INTO dbo.entities (name) VALUES (@name)`
            : `INSERT INTO dbo.departments (name) VALUES (@name)`,
        );
    } catch (error) {
      if (isDuplicateKeyError(error)) throw new Error(`"${data.name}" already exists.`);
      throw error;
    }
    return { ok: true };
  });

export const deleteMaster = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator((input: { table: MasterTable; key: string }) => {
    const table = validateTable(input?.table);
    if (!input?.key) throw new Error("Missing item.");
    return { table, key: input.key };
  })
  .handler(async ({ data }) => {
    const { request, sql } = await import("@/server/db.server");
    const req = await request();
    if (data.table === "entities") {
      // Credentials under this entity are removed by ON DELETE CASCADE.
      await req
        .input("id", sql.UniqueIdentifier, data.key)
        .query(`DELETE FROM dbo.entities WHERE id = @id`);
    } else {
      await req
        .input("name", sql.NVarChar(40), data.key)
        .query(`DELETE FROM dbo.departments WHERE name = @name`);
    }
    return { ok: true };
  });
