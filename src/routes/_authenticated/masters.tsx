import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

import { addMaster, deleteMaster } from "@/lib/masters.functions";
import { useDepartments, useEntities, useSession } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/masters")({
  head: () => ({
    meta: [
      { title: "Masters | Leads Credential Vault" },
      { name: "description", content: "Manage entities and departments used across the vault." },
      { property: "og:title", content: "Masters | Leads Credential Vault" },
      {
        property: "og:description",
        content: "Manage entities and departments used across the vault.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MastersPage,
});

function MastersPage() {
  const { data: session } = useSession();
  const { data: entities } = useEntities();
  const { data: departments } = useDepartments();

  if (session && !session.isAdmin) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
        Only administrators can manage masters.
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">
          <span className="text-warning">Masters</span>
        </h1>
        <p className="text-sm text-muted-foreground">
          Add the entities and departments used by credentials.
        </p>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <MasterList
          title="Entities"
          table="entities"
          queryKey="entities"
          items={(entities ?? []).map((e) => ({ key: e.id, label: e.name }))}
          note="Deleting an entity also deletes its credentials."
        />
        <MasterList
          title="Departments"
          table="departments"
          queryKey="departments"
          items={(departments ?? []).map((d) => ({ key: d, label: d }))}
        />
      </div>
    </div>
  );
}

function MasterList({
  title,
  table,
  queryKey,
  items,
  note,
}: {
  title: string;
  table: "entities" | "departments";
  queryKey: string;
  items: { key: string; label: string }[];
  note?: string;
}) {
  const [name, setName] = useState("");
  const qc = useQueryClient();

  const add = useMutation({
    mutationFn: async () => {
      const value = name.trim();
      if (!value) throw new Error("Enter a name.");
      await addMaster({ data: { table, name: value } });
    },
    onSuccess: () => {
      setName("");
      toast.success(`${title.slice(0, -1).replace(/ie$/, "y")} added.`);
      qc.invalidateQueries({ queryKey: [queryKey] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (key: string) => deleteMaster({ data: { table, key } }),
    onSuccess: () => {
      toast.success("Deleted.");
      qc.invalidateQueries({ queryKey: [queryKey] });
      qc.invalidateQueries({ queryKey: ["credentials"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const accent =
    table === "entities"
      ? "border-primary/20 bg-primary/5"
      : "border-warning/25 bg-warning-soft/50";
  const accentText = table === "entities" ? "text-primary" : "text-warning";
  return (
    <section className={`vault-surface space-y-4 rounded-2xl border p-5 ${accent}`}>
      <h2 className={`text-lg font-semibold ${accentText}`}>{title}</h2>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          add.mutate();
        }}
      >
        <Input value={name} onChange={(e) => setName(e.target.value)} aria-label={`New ${title}`} />
        <Button type="submit" disabled={add.isPending}>
          <Plus className="size-4" /> Add
        </Button>
      </form>
      {note && <p className="text-xs text-muted-foreground">{note}</p>}
      <ul className="divide-y divide-border rounded-lg border border-border">
        {items.length === 0 && <li className="p-3 text-sm text-muted-foreground">None yet.</li>}
        {items.map((it) => (
          <li key={it.key} className="flex items-center justify-between p-3 text-sm">
            {it.label}
            <Button
              variant="ghost"
              size="icon"
              aria-label="Delete"
              onClick={() => {
                if (confirm(`Delete "${it.label}"?`)) remove.mutate(it.key);
              }}
            >
              <Trash2 className="size-4" />
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
