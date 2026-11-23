// One-time password reset links (dbo.password_resets) and the optional SMTP email that delivers them.
import { getRequest } from "@tanstack/react-start/server";

import { request, sql } from "./db.server";
import { newSessionToken, sha256Hex } from "./crypto.server";

const RESET_MINUTES = 60;

/** Public address of the site, for links in emails. Set APP_URL in production. */
function appOrigin(): string {
  const configured = process.env["APP_URL"]?.trim();
  if (configured) return configured.replace(/\/+$/, "");
  return new URL(getRequest().url).origin;
}

/** Creates a reset link for the user, replacing any earlier unused links. */
export async function createResetLink(userId: string): Promise<string> {
  const token = newSessionToken();
  const req = await request();
  await req
    .input("token_hash", sql.Char(64), sha256Hex(token))
    .input("user_id", sql.UniqueIdentifier, userId)
    .input("expires_at", sql.DateTime2(3), new Date(Date.now() + RESET_MINUTES * 60_000))
    .query(
      `DELETE FROM dbo.password_resets WHERE user_id = @user_id OR expires_at < SYSUTCDATETIME();
       INSERT INTO dbo.password_resets (token_hash, user_id, expires_at)
       VALUES (@token_hash, @user_id, @expires_at);`,
    );
  return `${appOrigin()}/reset-password?token=${encodeURIComponent(token)}`;
}

/** Returns the active user a reset token belongs to, or null when invalid or expired. */
export async function findResetUser(token: string): Promise<string | null> {
  if (!token) return null;
  const req = await request();
  const { recordset } = await req.input("token_hash", sql.Char(64), sha256Hex(token)).query<{
    user_id: string;
  }>(
    `SELECT r.user_id FROM dbo.password_resets r JOIN dbo.users u ON u.id = r.user_id
      WHERE r.token_hash = @token_hash AND r.expires_at > SYSUTCDATETIME() AND u.is_active = 1`,
  );
  return recordset[0]?.user_id.toLowerCase() ?? null;
}

/** True when SMTP_HOST is set, i.e. reset links can be emailed. */
export function emailConfigured(): boolean {
  return !!process.env["SMTP_HOST"]?.trim();
}

/** Emails a reset link. Returns false (without sending) when SMTP is not configured. */
export async function sendResetEmail(to: string, link: string): Promise<boolean> {
  if (!emailConfigured()) return false;
  const nodemailer = await import("nodemailer");
  const port = Number(process.env["SMTP_PORT"] ?? 587);
  const transport = nodemailer.createTransport({
    host: process.env["SMTP_HOST"],
    port,
    secure: process.env["SMTP_SECURE"] ? process.env["SMTP_SECURE"] === "true" : port === 465,
    ...(process.env["SMTP_USER"]
      ? { auth: { user: process.env["SMTP_USER"], pass: process.env["SMTP_PASSWORD"] ?? "" } }
      : {}),
  });
  await transport.sendMail({
    from: process.env["SMTP_FROM"] || process.env["SMTP_USER"],
    to,
    subject: "Reset your Leads Credential Manager password",
    text: [
      "A password reset was requested for your Leads Credential Manager account.",
      "",
      `Open this link within ${RESET_MINUTES} minutes to choose a new password:`,
      link,
      "",
      "If you did not request this, you can ignore this email.",
    ].join("\n"),
  });
  return true;
}
