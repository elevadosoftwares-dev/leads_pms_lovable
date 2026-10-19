import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { saveCredential } from "@/lib/credentials.functions";
import { useDepartments, useEntities, type Department } from "@/lib/session";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

export type CredentialRow = {
  id: string;
  entity_id: string | null;
  site_url: string;
  login_user_id: string;
  password: string;
  registered_email: string | null;
  registered_mobile: string | null;
  client_name: string;
  purpose: string | null;
  departments: Department[];
  contact_name: string | null;
  contact_email: string | null;
  contact_tel: string | null;
};

const empty = {
  entity_id: "",
  site_url: "",
  login_user_id: "",
  password: "",
  registered_email: "",
  registered_mobile: "",
  client_name: "",
  purpose: "",
  departments: [] as Department[],
  contact_name: "",
  contact_email: "",
  contact_tel: "",
};

export function CredentialDialog({
  open,
  onOpenChange,
  editing,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: CredentialRow | null;
}) {
  const [form, setForm] = useState(empty);
  const queryClient = useQueryClient();
  const { data: departments } = useDepartments();
  const { data: entities } = useEntities();

  useEffect(() => {
    if (!open) return;
    setForm(
      editing
        ? {
            entity_id: editing.entity_id ?? "",
            site_url: editing.site_url,
            login_user_id: editing.login_user_id,
            password: editing.password,
            registered_email: editing.registered_email ?? "",
            registered_mobile: editing.registered_mobile ?? "",
            client_name: editing.client_name,
            purpose: editing.purpose ?? "",
            departments: editing.departments ?? [],
            contact_name: editing.contact_name ?? "",
            contact_email: editing.contact_email ?? "",
            contact_tel: editing.contact_tel ?? "",
          }
        : empty,
    );
  }, [open, editing]);

  const save = useMutation({
    mutationFn: async () => {
      if (!form.entity_id) throw new Error("Select an entity.");
      if (!form.login_user_id.trim() || !form.password.trim())
        throw new Error("User ID and Password are required.");
      if (form.client_name.length > 15)
        throw new Error("Client name must be 15 characters or less.");
      if (form.departments.length === 0) throw new Error("Select at least one department.");
      const payload = {
        ...form,
        registered_email: form.registered_email || null,
        registered_mobile: form.registered_mobile || null,
        purpose: form.purpose || null,
        contact_name: form.contact_name || null,
        contact_email: form.contact_email || null,
        contact_tel: form.contact_tel || null,
      };
      await saveCredential({ data: { ...payload, id: editing?.id } });
    },
    onSuccess: () => {
      toast.success(editing ? "Credential updated." : "Credential saved.");
      queryClient.invalidateQueries({ queryKey: ["credentials"] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function set<K extends keyof typeof empty>(key: K, value: (typeof empty)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit Credential" : "Create Credential"}</DialogTitle>
          <DialogDescription>
            Only the departments you tick below will be able to see this entry.
          </DialogDescription>
        </DialogHeader>

        <form
          id="credential-form"
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <Field label="Entity *" className="sm:col-span-2">
            <Select value={form.entity_id} onValueChange={(v) => set("entity_id", v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select entity" />
              </SelectTrigger>
              <SelectContent>
                {(entities ?? []).map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {(entities ?? []).length === 0 && (
              <p className="text-xs text-muted-foreground">Add entities first under Masters.</p>
            )}
          </Field>
          <Field label="URL Of Site" className="sm:col-span-2">
            <Input value={form.site_url} onChange={(e) => set("site_url", e.target.value)} />
          </Field>
          <Field label="User ID *">
            <Input
              required
              value={form.login_user_id}
              onChange={(e) => set("login_user_id", e.target.value)}
            />
          </Field>
          <Field label="Password *">
            <Input
              required
              value={form.password}
              onChange={(e) => set("password", e.target.value)}
            />
          </Field>
          <Field label="Registered Email Address">
            <Input
              type="email"
              value={form.registered_email}
              onChange={(e) => set("registered_email", e.target.value)}
            />
          </Field>
          <Field label="Registered Mobile No.">
            <Input
              value={form.registered_mobile}
              onChange={(e) => set("registered_mobile", e.target.value)}
            />
          </Field>
          <Field label="Client Name (Max 15 Characters) *">
            <Input
              required
              maxLength={15}
              value={form.client_name}
              onChange={(e) => set("client_name", e.target.value)}
            />
          </Field>
          <Field label="Purpose Of System">
            <Input value={form.purpose} onChange={(e) => set("purpose", e.target.value)} />
          </Field>

          <div className="sm:col-span-2">
            <Label className="mb-2 block">Departments In Leads *</Label>
            <div className="flex flex-wrap gap-4 rounded-lg border border-border p-3">
              {(departments ?? []).map((dept) => (
                <label key={dept} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={form.departments.includes(dept)}
                    onCheckedChange={(checked) =>
                      set(
                        "departments",
                        checked
                          ? [...form.departments, dept]
                          : form.departments.filter((d) => d !== dept),
                      )
                    }
                  />
                  {dept}
                </label>
              ))}
            </div>
          </div>

          <div className="sm:col-span-2 pt-1 text-sm font-medium text-muted-foreground">
            Client Contact Person For Support
          </div>
          <Field label="Name">
            <Input
              value={form.contact_name}
              onChange={(e) => set("contact_name", e.target.value)}
            />
          </Field>
          <Field label="Email">
            <Input
              type="email"
              value={form.contact_email}
              onChange={(e) => set("contact_email", e.target.value)}
            />
          </Field>
          <Field label="Telephone" className="sm:col-span-2">
            <Input value={form.contact_tel} onChange={(e) => set("contact_tel", e.target.value)} />
          </Field>
        </form>

        <DialogFooter>
          <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="credential-form" disabled={save.isPending}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`space-y-2 ${className ?? ""}`}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}
