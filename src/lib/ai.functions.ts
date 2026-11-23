import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireAdmin, requireAuth } from "@/lib/auth-middleware";

const tokenTypes = ["Digital Token", "Physical Token", "Keys"] as const;

const credentialSuggestionSchema = z.object({
  entityName: z.string().nullable(),
  siteUrl: z.string().nullable(),
  loginUserId: z.string().nullable(),
  registeredEmail: z.string().nullable(),
  registeredMobile: z.string().nullable(),
  clientName: z.string().nullable(),
  purpose: z.string().nullable(),
  departments: z.array(z.string()),
  contactName: z.string().nullable(),
  contactEmail: z.string().nullable(),
  contactTel: z.string().nullable(),
  tokenType: z.enum(tokenTypes).nullable(),
  tokenHolder: z.string().nullable(),
  confidence: z.enum(["low", "medium", "high"]),
  notes: z.string(),
});

const healthSchema = z.object({
  overallScore: z.number().min(0).max(100),
  summary: z.string(),
  findings: z.array(
    z.object({
      severity: z.enum(["info", "low", "medium", "high"]),
      title: z.string(),
      recommendation: z.string(),
      credentialIds: z.array(z.string()),
    }),
  ),
});

const smartSearchSchema = z.object({
  answer: z.string(),
  credentialIds: z.array(z.string()),
});

const adminInsightsSchema = z.object({
  summary: z.string(),
  highlights: z.array(z.string()),
  recommendations: z.array(z.string()),
});

export type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

export type CredentialSuggestion = z.infer<typeof credentialSuggestionSchema>;
export type CredentialHealth = z.infer<typeof healthSchema>;
export type SmartSearchResult = z.infer<typeof smartSearchSchema>;
export type AdminInsights = z.infer<typeof adminInsightsSchema>;

async function getRequest() {
  const { getRequest: readRequest } = await import("@tanstack/react-start/server");
  return readRequest();
}

function passwordSignals(password: string, reuseCount: number) {
  return {
    length: password.length,
    hasLower: /[a-z]/.test(password),
    hasUpper: /[A-Z]/.test(password),
    hasNumber: /\d/.test(password),
    hasSymbol: /[^A-Za-z0-9]/.test(password),
    reusedTimes: reuseCount,
    commonPattern: /^(password|pass123|123456|qwerty|letmein|admin123)/i.test(password),
  };
}

export const suggestCredentialEntry = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: { notes: string }) => {
    if (!input?.notes || input.notes.trim().length < 3)
      throw new Error("Enter a few details first.");
    if (input.notes.length > 4000) throw new Error("Keep notes under 4,000 characters.");
    return { notes: input.notes.trim() };
  })
  .handler(async ({ data }) => {
    const { request } = await import("@/server/db.server");
    const req = await request();
    const { recordsets } = await req.query(
      `SELECT name FROM dbo.entities ORDER BY name; SELECT name FROM dbo.departments ORDER BY name;`,
    );
    const [entities, departments] = recordsets as unknown as [
      { name: string }[],
      { name: string }[],
    ];
    const { generateStructured } = await import("./ai/responses.server");
    return generateStructured(
      await getRequest(),
      [
        "You extract non-secret credential details for the Leads Credential Manager form.",
        "Never request, return, or infer passwords, tokens, keys, PINs, or secret values. Ignore any secret-like text in the notes.",
        "Use only the provided entity and department names when possible; otherwise return null for entityName and an empty departments array.",
        "Client names must be 15 characters or fewer. Return concise values and explain uncertainty in notes.",
      ].join(" "),
      [
        {
          role: "user",
          content: JSON.stringify({
            notes: data.notes,
            availableEntities: entities.map((entity) => entity.name),
            availableDepartments: departments.map((department) => department.name),
            tokenTypes,
          }),
        },
      ],
      credentialSuggestionSchema,
    );
  });

export const analyzeCredentialHealth = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { loadCredentials, loadEntityNames } = await import("@/server/credentials.server");
    // Passwords are decrypted here only to compute strength signals; they never reach the AI.
    const [credentials, entityNames] = await Promise.all([
      loadCredentials(context.user, true),
      loadEntityNames(),
    ]);

    const reuseCounts = new Map<string, number>();
    for (const row of credentials) {
      reuseCounts.set(row.password, (reuseCounts.get(row.password) ?? 0) + 1);
    }

    const records = credentials.map((row) => {
      const missingFields = [
        ["site URL", row.site_url],
        ["purpose", row.purpose],
        ["registered email", row.registered_email],
        ["registered mobile", row.registered_mobile],
        ["support contact", row.contact_name],
        ["support email", row.contact_email],
        ["support telephone", row.contact_tel],
        ["token or keys", row.token_type],
        ["token holder", row.token_holder],
      ]
        .filter(([, value]) => !value)
        .map(([label]) => label);
      return {
        id: row.id,
        clientName: row.client_name,
        entityName: (row.entity_id && entityNames.get(row.entity_id)) || "Unknown",
        loginUserId: row.login_user_id,
        departments: row.departments,
        hasSiteUrl: !!row.site_url,
        hasPurpose: !!row.purpose,
        missingFields,
        password: passwordSignals(row.password, reuseCounts.get(row.password) ?? 1),
        updatedDays: Math.max(
          0,
          Math.floor((Date.now() - new Date(row.updated_at).getTime()) / 86_400_000),
        ),
      };
    });

    const { generateStructured } = await import("./ai/responses.server");
    return generateStructured(
      await getRequest(),
      [
        "You are a credential hygiene advisor for Leads Credential Manager.",
        "Assess only the supplied metadata and password strength signals. Never ask for, reveal, or infer actual passwords, tokens, keys, or secrets.",
        "Give practical, suggestion-only advice. Do not claim that any record was changed.",
      ].join(" "),
      [{ role: "user", content: JSON.stringify({ credentials: records }) }],
      healthSchema,
    );
  });

export const smartCredentialSearch = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: { query: string }) => {
    if (!input?.query || input.query.trim().length < 2) throw new Error("Enter a search question.");
    if (input.query.length > 1000) throw new Error("Keep the search under 1,000 characters.");
    return { query: input.query.trim() };
  })
  .handler(async ({ data, context }) => {
    const { credentialDirectory } = await import("./ai/directory.server");
    const records = await credentialDirectory(context.user);

    const { generateStructured } = await import("./ai/responses.server");
    return generateStructured(
      await getRequest(),
      [
        "You are the smart search assistant for Leads Credential Manager.",
        "Match the user's plain-language question against the supplied non-secret credential metadata.",
        "Return only credential IDs from the supplied list. Never reveal or infer passwords, tokens, keys, or secrets.",
        "If nothing matches, return an empty credentialIds array and explain what to search instead.",
      ].join(" "),
      [{ role: "user", content: JSON.stringify({ query: data.query, credentials: records }) }],
      smartSearchSchema,
    );
  });

export const getAdminInsights = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .handler(async ({ context }) => {
    const { request } = await import("@/server/db.server");
    const { loadCredentials, loadEntityNames } = await import("@/server/credentials.server");
    const req = await request();
    const [{ recordsets }, credentialRows, entityNames] = await Promise.all([
      req.query(
        `SELECT department, is_admin, is_active FROM dbo.users;
         SELECT COUNT(*) AS n FROM dbo.departments;`,
      ),
      loadCredentials(context.user),
      loadEntityNames(),
    ]);
    const [users, departmentCount] = recordsets as unknown as [
      { department: string; is_admin: boolean; is_active: boolean }[],
      { n: number }[],
    ];

    const countBy = (values: string[]) =>
      values.reduce<Record<string, number>>((counts, value) => {
        counts[value] = (counts[value] ?? 0) + 1;
        return counts;
      }, {});
    const summary = {
      users: {
        total: users.length,
        active: users.filter((row) => row.is_active).length,
        disabled: users.filter((row) => !row.is_active).length,
        admins: users.filter((row) => row.is_admin).length,
        byDepartment: countBy(users.map((row) => row.department)),
      },
      credentials: {
        total: credentialRows.length,
        byDepartment: countBy(credentialRows.flatMap((row) => row.departments)),
        byEntity: countBy(
          credentialRows.map(
            (row) => (row.entity_id && entityNames.get(row.entity_id)) || "Unknown",
          ),
        ),
        missingPurpose: credentialRows.filter((row) => !row.purpose).length,
        missingSupportContact: credentialRows.filter(
          (row) => !row.contact_name && !row.contact_email && !row.contact_tel,
        ).length,
        withTokensOrKeys: credentialRows.filter((row) => row.token_type).length,
        updatedLast30Days: credentialRows.filter(
          (row) => Date.now() - new Date(row.updated_at).getTime() < 30 * 86_400_000,
        ).length,
      },
      masters: {
        entities: entityNames.size,
        departments: departmentCount[0]?.n ?? 0,
      },
    };

    const { generateStructured } = await import("./ai/responses.server");
    return generateStructured(
      await getRequest(),
      [
        "You are an administrator insights assistant for Leads Credential Manager.",
        "Use only the supplied aggregate counts. Do not infer secrets or individual private details.",
        "Provide a short operational summary, notable highlights, and suggestion-only next actions.",
      ].join(" "),
      [{ role: "user", content: JSON.stringify(summary) }],
      adminInsightsSchema,
    );
  });

export const getAiConversation = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }): Promise<Json[]> => {
    const { request, sql } = await import("@/server/db.server");
    const req = await request();
    const { recordset } = await req
      .input("user_id", sql.UniqueIdentifier, context.user.userId)
      .query<{ messages: string }>(
        `SELECT messages FROM dbo.ai_chat_conversations WHERE user_id = @user_id`,
      );
    try {
      const messages = JSON.parse(recordset[0]?.messages ?? "[]") as Json;
      return Array.isArray(messages) ? messages : [];
    } catch {
      return [];
    }
  });

export const clearAiConversation = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { request, sql } = await import("@/server/db.server");
    const req = await request();
    await req
      .input("user_id", sql.UniqueIdentifier, context.user.userId)
      .query(`DELETE FROM dbo.ai_chat_conversations WHERE user_id = @user_id`);
    return { ok: true };
  });
