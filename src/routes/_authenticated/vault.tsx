import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronDown, Copy, Eye, EyeOff, Pencil, Plus, Search, Trash2 } from "lucide-react";

import { deleteCredential, listCredentials } from "@/lib/credentials.functions";
import { useDepartments, useEntities, useSession, type Department } from "@/lib/session";
import { CredentialDialog, type CredentialRow } from "@/components/CredentialDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/vault")({
  head: () => ({
    meta: [
      { title: "Credentials | Leads Credential Vault" },
      {
        name: "description",
        content: "Search and retrieve the login credentials shared with your department.",
      },
      { property: "og:title", content: "Credentials | Leads Credential Vault" },
      {
        property: "og:description",
        content: "Search and retrieve the login credentials shared with your department.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: VaultPage,
});

function VaultPage() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const [term, setTerm] = useState("");
  const [dept, setDept] = useState<string>("all");
  const [entity, setEntity] = useState<string>("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const { data: allDepartments } = useDepartments();
  const { data: entities } = useEntities();
  const entityName = (id: string | null) => entities?.find((e) => e.id === id)?.name ?? "—";
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CredentialRow | null>(null);

  const { data: rows, isLoading } = useQuery({
    queryKey: ["credentials"],
    queryFn: () => listCredentials(),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteCredential({ data: { id } }),
    onSuccess: () => {
      toast.success("Credential deleted.");
      queryClient.invalidateQueries({ queryKey: ["credentials"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const visibleDepartments = session?.isAdmin
    ? (allDepartments ?? [])
    : ((session ? [session.department] : []) as readonly Department[]);

  const results = useMemo(() => {
    const q = term.trim().toLowerCase();
    return (rows ?? []).filter((row) => {
      if (entity !== "all" && row.entity_id !== entity) return false;
      const matchesDept = dept === "all" || row.departments?.includes(dept as Department);
      const haystack = [
        entityName(row.entity_id),
        row.client_name,
        row.site_url,
        row.purpose,
        row.login_user_id,
      ]
        .join(" ")
        .toLowerCase();
      return matchesDept && (q === "" || haystack.includes(q));
    });
  }, [rows, term, dept, entity, entities]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">View Login Credentials</h1>
          <p className="text-sm text-muted-foreground">
            {session?.isAdmin
              ? "You can see and manage every entry."
              : `Showing entries shared with the ${session?.department} department.`}
          </p>
        </div>
        {session?.isAdmin && (
          <Button
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="size-4" /> New Credential
          </Button>
        )}
      </div>

      <div className="vault-surface grid gap-4 rounded-2xl border border-border p-4 sm:grid-cols-[1fr_200px_200px]">
        <div className="space-y-2">
          <Label htmlFor="search">Search For Login Credentials</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="search"
              className="pl-9"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Entity</Label>
          <Select value={entity} onValueChange={setEntity}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Entities</SelectItem>
              {(entities ?? []).map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Department</Label>
          <Select value={dept} onValueChange={setDept}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Departments</SelectItem>
              {visibleDepartments.map((d) => (
                <SelectItem key={d} value={d}>
                  {d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading credentials…</p>
      ) : results.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          No credentials match your search.
        </div>
      ) : (
        <div className="vault-surface overflow-hidden rounded-2xl border border-border">
          <div className="hidden items-center gap-4 border-b border-border bg-muted/60 px-5 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:flex">
            <span className="w-32 shrink-0">Entity</span>
            <span className="w-28 shrink-0">Client Name</span>
            <span className="min-w-0 flex-1">Purpose / URL</span>
            <span className="w-8" />
          </div>
          <div className="divide-y divide-border">
            {results.map((row) => (
              <CredentialCard
                key={row.id}
                row={row}
                entityName={entityName(row.entity_id)}
                open={openId === row.id}
                onToggle={() => setOpenId((cur) => (cur === row.id ? null : row.id))}
                isAdmin={!!session?.isAdmin}
                onEdit={() => {
                  setEditing(row);
                  setDialogOpen(true);
                }}
                onDelete={() => remove.mutate(row.id)}
              />
            ))}
          </div>
        </div>
      )}

      <CredentialDialog open={dialogOpen} onOpenChange={setDialogOpen} editing={editing} />
    </div>
  );
}

function CredentialCard({
  row,
  entityName,
  open,
  onToggle,
  isAdmin,
  onEdit,
  onDelete,
}: {
  row: CredentialRow;
  entityName: string;
  open: boolean;
  onToggle: () => void;
  isAdmin: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [reveal, setReveal] = useState(false);

  return (
    <article>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-4 px-5 py-3 text-left transition-colors hover:bg-muted/50"
      >
        <span className="w-32 shrink-0 truncate text-sm font-medium text-primary">
          {entityName}
        </span>
        <span className="w-28 shrink-0 truncate font-semibold">{row.client_name}</span>
        <span className="hidden min-w-0 flex-1 truncate text-sm text-muted-foreground sm:block">
          {row.purpose || row.site_url}
        </span>
        <ChevronDown
          className={`ml-auto size-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="border-t border-border px-5 pb-5 pt-4">
          <div className="mb-3 flex flex-wrap gap-1">
            {(row.departments ?? []).map((d) => (
              <Badge key={d} variant="secondary">
                {d}
              </Badge>
            ))}
          </div>
          <div className="space-y-2">
            <CopyRow label="Site" value={row.site_url} />
            <CopyRow label="User ID" value={row.login_user_id} />
            <CopyRow
              label="Password"
              value={row.password}
              display={reveal ? row.password : "••••••••••"}
              extra={
                <Button variant="ghost" size="icon" onClick={() => setReveal((v) => !v)}>
                  {reveal ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </Button>
              }
            />
          </div>

          <dl className="mt-4 grid gap-x-4 gap-y-2 border-t border-border pt-4 text-sm sm:grid-cols-3">
            <Detail label="Purpose" value={row.purpose} />
            <Detail label="Registered Email" value={row.registered_email} />
            <Detail label="Registered Mobile" value={row.registered_mobile} />
            <Detail label="Support Contact" value={row.contact_name} />
            <Detail label="Support Email" value={row.contact_email} />
            <Detail label="Support Tel" value={row.contact_tel} />
          </dl>

          {isAdmin && (
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={onEdit}>
                <Pencil className="size-4" /> Edit
              </Button>
              <Button variant="outline" size="sm" onClick={onDelete}>
                <Trash2 className="size-4" /> Delete
              </Button>
            </div>
          )}
        </div>
      )}
    </article>
  );
}

function CopyRow({
  label,
  value,
  display,
  extra,
}: {
  label: string;
  value: string;
  display?: string;
  extra?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-secondary/60 px-3 py-2">
      <span className="w-20 shrink-0 text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="min-w-0 flex-1 truncate font-mono text-sm">{display ?? value}</span>
      {extra}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => {
          navigator.clipboard.writeText(value);
          toast.success(`${label} copied.`);
        }}
      >
        <Copy className="size-4" />
      </Button>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="break-words">{value || "—"}</dd>
    </div>
  );
}
