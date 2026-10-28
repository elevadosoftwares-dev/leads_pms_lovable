import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { KeyRound, Loader2, Lock, Users, ShieldCheck, Mail, Eye, EyeOff } from "lucide-react";

import { adminExists, createFirstAdmin, getSession, signIn } from "@/lib/auth.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import loginHero from "@/assets/login-hero.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sign In | Leads Credential Management System" },
      {
        name: "description",
        content:
          "Sign in to the Leads Credential Management System to retrieve the login credentials shared with your department.",
      },
      { property: "og:title", content: "Sign In | Leads Credential Management System" },
      {
        property: "og:description",
        content:
          "Sign in to the Leads Credential Management System to retrieve the login credentials shared with your department.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);

  const { data: bootstrap } = useQuery({
    queryKey: ["admin-exists"],
    queryFn: () => adminExists(),
  });
  const needsFirstAdmin = bootstrap?.exists === false;

  const queryClient = useQueryClient();

  useEffect(() => {
    getSession()
      .then((user) => {
        if (user) navigate({ to: "/dashboard", replace: true });
      })
      .catch(() => {});
  }, [navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (needsFirstAdmin) {
        await createFirstAdmin({ data: { email, password } });
        toast.success("Administrator account created.");
      }
      await signIn({ data: { email, password } });
      queryClient.clear();
      navigate({ to: "/dashboard", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not sign in.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen bg-card">
      {/* Hero panel */}
      <div className="relative hidden w-1/2 overflow-hidden lg:block">
        <img
          src={loginHero}
          alt="Container port at dusk"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-navy/90 via-navy/30 to-navy/20" />
        <div className="absolute inset-x-10 bottom-12 text-white">
          <h1 className="font-display text-4xl font-semibold leading-tight">
            Leads Credential Manager
          </h1>
          <p className="mt-3 text-sm tracking-wide text-white/80">Secure . Simple . Centralised</p>
          <div className="mt-8 flex gap-8">
            <Feature icon={Lock} title="Secure" sub="Access" />
            <Feature icon={Users} title="Manage" sub="Users" />
            <Feature icon={ShieldCheck} title="Support" sub="Operations" />
          </div>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <span className="font-display text-2xl font-semibold">Leads Credential Manager</span>
          </div>
          <h2 className="text-3xl font-semibold">Welcome Back</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {needsFirstAdmin
              ? "Set up the first administrator account."
              : "Sign in to access the system."}
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  className="pl-9"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete={needsFirstAdmin ? "new-password" : "current-password"}
                  required
                  className="pl-9 pr-10"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
              {needsFirstAdmin ? "Create Administrator" : "Login"}
            </Button>
            {!needsFirstAdmin && (
              <p className="text-center text-xs text-muted-foreground">
                Accounts are created by an administrator.
              </p>
            )}
          </form>
        </div>
      </div>
    </main>
  );
}

function Feature({ icon: Icon, title, sub }: { icon: typeof Lock; title: string; sub: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5 text-center">
      <span className="flex size-10 items-center justify-center rounded-full border border-gold/50 bg-gold/15">
        <Icon className="size-4 text-gold" />
      </span>
      <span className="text-xs font-semibold">{title}</span>
      <span className="text-[11px] text-white/70">{sub}</span>
    </div>
  );
}
