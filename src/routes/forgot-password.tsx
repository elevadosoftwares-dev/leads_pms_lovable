import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Mail, Loader2, ArrowLeft } from "lucide-react";
import { requestPasswordReset } from "@/lib/auth.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: "Forgot Password | Leads Credential Manager" },
      {
        name: "description",
        content: "Request a secure password recovery email for your Leads account.",
      },
      { property: "og:title", content: "Forgot Password | Leads Credential Manager" },
      {
        property: "og:description",
        content: "Request a secure password recovery email for your Leads account.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ForgotPassword,
});

function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-12">
      <div className="w-full max-w-sm space-y-6">
        <div>
          <p className="mb-5 font-display text-xl font-semibold text-primary">
            Leads Credential Manager
          </p>
          <h1 className="text-2xl font-semibold">Forgot Password</h1>
        </div>
        {sent ? (
          <p role="status" className="text-sm text-foreground">
            If an account exists for this email, a password reset link has been sent. Check your
            inbox and spam folder.
          </p>
        ) : (
          <form
            className="space-y-5"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError("");
              try {
                await requestPasswordReset({ data: { email: email.trim() } });
                setSent(true);
              } catch (err) {
                setError(err instanceof Error ? err.message : "Could not send the reset email.");
              } finally {
                setBusy(false);
              }
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="recovery-email">Email</Label>
              <Input
                id="recovery-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Mail className="size-4" />}Send
              Reset Link
            </Button>
          </form>
        )}
        <Button asChild variant="ghost">
          <Link to="/">
            <ArrowLeft className="size-4" />
            Back To Login
          </Link>
        </Button>
      </div>
    </main>
  );
}
