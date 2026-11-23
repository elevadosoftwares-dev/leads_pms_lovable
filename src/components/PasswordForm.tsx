import { useState } from "react";
import { KeyRound, Loader2 } from "lucide-react";
import { changePassword, resetPassword } from "@/lib/auth.functions";
import { validatePassword } from "@/lib/account-rules";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Recovery mode (with the reset link's token) sets a new password without the old one.
 * Otherwise the signed-in user must enter their current password.
 */
export function PasswordForm({
  recovery,
  token,
  onSuccess,
}: {
  recovery: boolean;
  token?: string;
  onSuccess: () => void | Promise<void>;
}) {
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <form
      className="space-y-5"
      onSubmit={async (e) => {
        e.preventDefault();
        setError("");
        setBusy(true);
        try {
          validatePassword(password, confirmation);
          if (recovery) await resetPassword({ data: { token: token ?? "", password } });
          else await changePassword({ data: { currentPassword: current, password } });
          setPassword("");
          setCurrent("");
          setConfirmation("");
          await onSuccess();
        } catch (err) {
          setError(err instanceof Error ? err.message : "Could not update password.");
        } finally {
          setBusy(false);
        }
      }}
    >
      {!recovery && (
        <div className="space-y-2">
          <Label htmlFor="current-password">Current Password</Label>
          <Input
            id="current-password"
            type="password"
            autoComplete="current-password"
            required
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
          />
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor="new-password">New Password</Label>
        <Input
          id="new-password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirm-password">Confirm New Password</Label>
        <Input
          id="confirm-password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={confirmation}
          onChange={(e) => setConfirmation(e.target.value)}
        />
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" disabled={busy}>
        {busy ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}Update
        Password
      </Button>
    </form>
  );
}
