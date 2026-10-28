import { createFileRoute, Link } from "@tanstack/react-router";
import { Fragment, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, ChevronDown, Copy, Eye, EyeOff, Search } from "lucide-react";
import { toast } from "sonner";

import { listCredentials } from "@/lib/credentials.functions";
import { useEntities } from "@/lib/session";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard | Leads Credential Management System" },
      {
        name: "description",
        content: "Search login credentials by entity, client name, URL, user ID or purpose.",
      },
      { property: "og:title", content: "Dashboard | Leads Credential Management System" },
      {
        property: "og:description",
        content: "Search login credentials by entity, client name, URL, user ID or purpose.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [revealedId, setRevealedId] = useState<string | null>(null);
  const { data: entities } = useEntities();

  const { data: credentials } = useQuery({
    queryKey: ["credentials"],
    queryFn: () => listCredentials(),
  });

  const entityName = (id: string | null) => entities?.find((e) => e.id === id)?.name ?? "—";
  const visibleCredentials = useMemo(() => {
    const query = search.trim().toLowerCase();
    const matching = (credentials ?? []).filter((row) => {
      if (!query) return true;
      return [
        entityName(row.entity_id),
        row.client_name,
        row.site_url,
        row.login_user_id,
        row.purpose,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
    return query ? matching : matching.slice(0, 5);
  }, [credentials, entities, search]);

  return (
    <div className="space-y-7">
      <div className="overflow-hidden rounded-lg border border-border bg-navy text-navy-foreground shadow-sm">
        <div className="border-b border-navy-foreground/15 px-5 py-4">
          <h1 className="text-2xl font-semibold">Welcome To Leads</h1>
          <p className="text-sm text-navy-foreground/70">Credential Management System</p>
        </div>
        <div className="bg-card p-4 text-card-foreground sm:p-5">
          <label
            htmlFor="dashboard-search"
            className="mb-2 flex items-center gap-2 text-base font-semibold text-foreground"
          >
            <Search className="size-4 text-primary" />
            Search Login Credentials
          </label>
          <p className="mb-3 text-sm text-muted-foreground">
            Search By Entity, Client Name, URL, User ID Or Purpose
          </p>
          <div className="flex max-w-3xl gap-2">
            <Input
              id="dashboard-search"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setOpenId(null);
              }}
              className="h-11 flex-1"
              aria-label="Search Login Credentials"
            />
            {search && (
              <Button
                type="button"
                variant="outline"
                className="h-11"
                onClick={() => setSearch("")}
              >
                Clear
              </Button>
            )}
          </div>
        </div>
      </div>

      <section className="vault-surface overflow-hidden rounded-lg border border-border">
        <div className="flex items-center justify-between border-b border-primary/15 bg-gradient-to-r from-primary/8 via-violet-soft/40 to-success-soft/40 px-5 py-4">
          <h2 className="text-lg font-semibold">
            {search.trim() ? "Search Results" : "Recent Login Credentials"}
          </h2>
          <Link
            to="/vault"
            className="flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            View All <ArrowRight className="size-3.5" />
          </Link>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Entity</TableHead>
              <TableHead>Client Name</TableHead>
              <TableHead>URL</TableHead>
              <TableHead>User ID</TableHead>
              <TableHead>Departments</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleCredentials.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-muted-foreground">
                  {search.trim() ? "No credentials match your search." : "No credentials yet."}
                </TableCell>
              </TableRow>
            )}
            {visibleCredentials.map((row) => {
              const isOpen = openId === row.id;
              const isRevealed = revealedId === row.id;
              return (
                <Fragment key={row.id}>
                  <TableRow className={isOpen ? "bg-primary/5" : undefined}>
                    <TableCell className="font-medium text-primary">
                      {entityName(row.entity_id)}
                    </TableCell>
                    <TableCell className="font-medium">{row.client_name}</TableCell>
                    <TableCell className="max-w-56 truncate text-muted-foreground">
                      {row.site_url || "—"}
                    </TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        variant="link"
                        className="h-auto justify-start p-0 font-mono"
                        onClick={() => setOpenId((current) => (current === row.id ? null : row.id))}
                        aria-expanded={isOpen}
                      >
                        {row.login_user_id}
                        <ChevronDown
                          className={`size-3.5 transition-transform ${isOpen ? "rotate-180" : ""}`}
                        />
                      </Button>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {(row.departments ?? []).map((department, i) => (
                          <Badge
                            key={department}
                            variant="secondary"
                            className={
                              [
                                "bg-violet-soft text-violet",
                                "bg-success-soft text-success",
                                "bg-warning-soft text-warning",
                                "bg-coral-soft text-coral",
                              ][i % 4]
                            }
                          >
                            {department}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                  </TableRow>
                  {isOpen && (
                    <TableRow className="bg-primary/5 hover:bg-primary/5">
                      <TableCell colSpan={5} className="p-5">
                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                          <DashboardDetail label="Purpose" value={row.purpose} />
                          <DashboardDetail label="Registered Email" value={row.registered_email} />
                          <DashboardDetail
                            label="Registered Mobile"
                            value={row.registered_mobile}
                          />
                          <DashboardDetail label="Support Contact" value={row.contact_name} />
                          <DashboardDetail label="Support Email" value={row.contact_email} />
                          <DashboardDetail label="Support Tel" value={row.contact_tel} />
                        </div>
                        <div className="mt-4 flex max-w-2xl items-center gap-2 rounded-lg border border-coral/25 bg-coral-soft/60 px-3 py-2">
                          <span className="w-20 shrink-0 text-xs font-semibold uppercase text-coral">
                            Password
                          </span>
                          <span className="min-w-0 flex-1 truncate font-mono text-sm">
                            {isRevealed ? row.password : "••••••••••"}
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => setRevealedId(isRevealed ? null : row.id)}
                            aria-label={isRevealed ? "Hide Password" : "Show Password"}
                          >
                            {isRevealed ? <EyeOff /> : <Eye />}
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              navigator.clipboard.writeText(row.password);
                              toast.success("Password copied.");
                            }}
                            aria-label="Copy Password"
                          >
                            <Copy />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
      </section>
    </div>
  );
}

function DashboardDetail({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase text-primary/70">{label}</div>
      <div className="mt-1 break-words text-sm">{value || "—"}</div>
    </div>
  );
}
