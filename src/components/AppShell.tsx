import type { ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { LayoutDashboard, LogOut, Users, KeyRound, Building2, ChevronDown } from "lucide-react";

import { signOut as signOutFn } from "@/lib/auth.functions";
import { useSession } from "@/lib/session";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const navItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "View Login Credentials", url: "/vault", icon: KeyRound },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { data: session } = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const currentPath = useRouterState({ select: (r) => r.location.pathname });

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await signOutFn();
    navigate({ to: "/", replace: true });
  }

  const isActive = (path: string) => currentPath.startsWith(path);

  return (
    <div className="flex min-h-screen bg-background">
      {/* Dark navy sidebar */}
      <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col border-r border-gold/20 bg-navy text-navy-foreground">
        <Link to="/dashboard" className="border-b border-sidebar-border px-5 py-5">
          <span className="block font-display text-[17px] font-semibold leading-snug text-gold">
            Leads Credential Manager
          </span>
        </Link>

        <nav className="mt-2 flex-1 space-y-1 px-3">
          {navItems.map((item) => (
            <Link
              key={item.url}
              to={item.url}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive(item.url)
                  ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-[inset_3px_0_0_0_var(--gold)]"
                  : "text-navy-muted hover:bg-sidebar-accent hover:text-navy-foreground"
              }`}
            >
              <item.icon className={`size-4 ${isActive(item.url) ? "text-gold" : ""}`} />
              {item.title}
            </Link>
          ))}
          {session?.isAdmin && (
            <>
              <Link
                to="/users"
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive("/users")
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "text-navy-muted hover:bg-sidebar-accent hover:text-navy-foreground"
                }`}
              >
                <Users className="size-4" />
                User Management
              </Link>
              <Link
                to="/masters"
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive("/masters")
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "text-navy-muted hover:bg-sidebar-accent hover:text-navy-foreground"
                }`}
              >
                <Building2 className="size-4" />
                Masters
              </Link>
            </>
          )}
        </nav>

        <div className="border-t border-sidebar-border p-3">
          <Button
            type="button"
            variant="ghost"
            onClick={signOut}
            className="h-auto w-full justify-start px-3 py-2.5 text-navy-muted hover:bg-sidebar-accent hover:text-navy-foreground"
          >
            <LogOut className="size-4" />
            Sign Out
          </Button>
        </div>
      </aside>

      {/* Main area */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center justify-end gap-3 border-b border-primary/15 bg-gradient-to-r from-card via-primary/5 to-violet-soft/60 px-6 py-3 backdrop-blur">
          {session && (
            <div className="flex items-center gap-2">
              <span className="flex size-8 items-center justify-center rounded-full bg-gradient-to-br from-primary to-violet text-xs font-semibold text-primary-foreground">
                {session.email.slice(0, 2).toUpperCase()}
              </span>
              <div className="hidden text-right sm:block">
                <div className="text-xs font-medium">{session.email}</div>
                <div className="text-[11px] text-muted-foreground">{session.department}</div>
              </div>
              {session.isAdmin && <Badge variant="secondary">Admin</Badge>}
              <ChevronDown className="size-4 text-muted-foreground" />
            </div>
          )}
        </header>
        <main className="flex-1 px-6 py-8">{children}</main>
      </div>
    </div>
  );
}
