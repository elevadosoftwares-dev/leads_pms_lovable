import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { checkResetToken } from "@/lib/auth.functions";
import { PasswordForm } from "@/components/PasswordForm";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Reset Password | Leads Credential Manager" },
      {
        name: "description",
        content: "Set a new password using your secure Leads account recovery link.",
      },
      { property: "og:title", content: "Reset Password | Leads Credential Manager" },
      {
        property: "og:description",
        content: "Set a new password using your secure Leads account recovery link.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPassword,
});

const TOKEN_KEY = "leads-password-reset-token";

function ResetPassword() {
  const [state, setState] = useState<"checking" | "ready" | "invalid" | "done">("checking");
  const [token, setToken] = useState("");
  const queryClient = useQueryClient();
  useEffect(() => {
    let live = true;
    // Move the token out of the address bar (and history) as soon as the page opens.
    const fromUrl = new URLSearchParams(window.location.search).get("token");
    if (fromUrl) {
      sessionStorage.setItem(TOKEN_KEY, fromUrl);
      window.history.replaceState(null, "", "/reset-password");
    }
    const value = fromUrl ?? sessionStorage.getItem(TOKEN_KEY) ?? "";
    if (!value) {
      setState("invalid");
      return;
    }
    checkResetToken({ data: { token: value } })
      .then(({ valid }) => {
        if (!live) return;
        setToken(value);
        setState(valid ? "ready" : "invalid");
      })
      .catch(() => {
        if (live) setState("invalid");
      });
    return () => {
      live = false;
    };
  }, []);
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-12">
      <div className="w-full max-w-sm space-y-6">
        <p className="font-display text-xl font-semibold text-primary">Leads Credential Manager</p>
        <h1 className="text-2xl font-semibold">Reset Password</h1>
        {state === "checking" && (
          <p role="status" className="text-sm text-muted-foreground">
            Checking Reset Link…
          </p>
        )}
        {state === "invalid" && (
          <>
            <p role="alert" className="text-sm text-destructive">
              This reset link is invalid or has expired.
            </p>
            <Button asChild>
              <Link to="/forgot-password">Request New Link</Link>
            </Button>
          </>
        )}
        {state === "ready" && (
          <PasswordForm
            recovery
            token={token}
            onSuccess={async () => {
              await queryClient.cancelQueries();
              queryClient.clear();
              sessionStorage.removeItem(TOKEN_KEY);
              setState("done");
            }}
          />
        )}
        {state === "done" && (
          <>
            <p role="status" className="text-sm">
              Your password has been updated. Sign in with your new password.
            </p>
            <Button asChild>
              <Link to="/">Back To Login</Link>
            </Button>
          </>
        )}
      </div>
    </main>
  );
}
