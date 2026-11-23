// Non-secret credential metadata handed to the AI. Never includes passwords.
import type { SessionUser } from "@/server/auth.server";

export async function credentialDirectory(user: SessionUser) {
  const { loadCredentials, loadEntityNames } = await import("@/server/credentials.server");
  const [credentials, entityNames] = await Promise.all([loadCredentials(user), loadEntityNames()]);
  return credentials.map((row) => ({
    id: row.id,
    entityName: (row.entity_id && entityNames.get(row.entity_id)) || "Unknown",
    clientName: row.client_name,
    siteUrl: row.site_url,
    loginUserId: row.login_user_id,
    purpose: row.purpose,
    departments: row.departments,
    tokenType: row.token_type,
    tokenHolder: row.token_holder,
    updatedAt: row.updated_at,
  }));
}
