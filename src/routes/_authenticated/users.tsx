import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Trash2, UserPlus, Pencil, Mail } from "lucide-react";

import {
  createUser,
  deleteUser,
  listUsers,
  updateUserAccess,
  sendUserPasswordReset,
} from "@/lib/admin.functions";
import { AdminInsightsPanel } from "@/components/ai/AdminInsightsPanel";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useDepartments, useSession, type Department } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/users")({
  head: () => ({
    meta: [
      { title: "Users | Leads Credential Vault" },
      {
        name: "description",
        content: "Create and remove vault accounts and assign each person to a department.",
      },
      { property: "og:title", content: "Users | Leads Credential Vault" },
      {
        property: "og:description",
        content: "Create and remove vault accounts and assign each person to a department.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: UsersPage,
});

function UsersPage() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const fetchUsers = useServerFn(listUsers);
  const addUser = useServerFn(createUser);
  const removeUser = useServerFn(deleteUser);
  const editUser = useServerFn(updateUserAccess);
  const sendReset = useServerFn(sendUserPasswordReset);
  const [editing, setEditing] = useState<{
    userId: string;
    email: string;
    department: string;
    isAdmin: boolean;
    isActive: boolean;
  } | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [department, setDepartment] = useState<Department>("");
  const [isAdmin, setIsAdmin] = useState(false);

  const { data: departments } = useDepartments();
  const { data: users, isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: () => fetchUsers(),
    enabled: !!session?.isAdmin,
  });

  const create = useMutation({
    mutationFn: () => {
      if (!department) throw new Error("Select a department.");
      return addUser({ data: { email, password, department, isAdmin } });
    },
    onSuccess: () => {
      toast.success("User created.");
      setEmail("");
      setPassword("");
      setIsAdmin(false);
      setDepartment("");
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const destroy = useMutation({
    mutationFn: (userId: string) => removeUser({ data: { userId } }),
    onSuccess: () => {
      toast.success("User deleted.");
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const save = useMutation({
    mutationFn: () => {
      if (!editing) throw new Error("Select a user.");
      return editUser({ data: editing });
    },
    onSuccess: () => {
      toast.success("Account updated.");
      setEditing(null);
      queryClient.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const reset = useMutation({
    mutationFn: (userId: string) => sendReset({ data: { userId } }),
    onSuccess: ({ emailed, link }) => {
      if (emailed) {
        toast.success("Password reset email sent.");
        return;
      }
      // No SMTP on this server: hand the one-time link to the administrator to pass on.
      void navigator.clipboard?.writeText(link).catch(() => {});
      window.prompt(
        "Email is not set up on this server. Send this one-time reset link (valid 60 minutes) to the user. It has been copied to your clipboard:",
        link,
      );
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!session?.isAdmin) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
        Only administrators can manage users.
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">
          <span className="text-violet">User</span> Management
        </h1>
        <p className="text-sm text-muted-foreground">
          Create accounts and decide which department's credentials each person can see.
        </p>
      </div>

      <AdminInsightsPanel />

      <form
        className="vault-surface grid gap-4 rounded-2xl border border-violet/20 bg-gradient-to-r from-violet-soft/50 via-card to-card p-5 sm:grid-cols-2 lg:grid-cols-4"
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate();
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="new-email">Email</Label>
          <Input
            id="new-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="new-password">Password</Label>
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
          <Label>Department</Label>
          <Select value={department} onValueChange={(v) => setDepartment(v as Department)}>
            <SelectTrigger>
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent>
              {(departments ?? []).map((d) => (
                <SelectItem key={d} value={d}>
                  {d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end justify-between gap-3">
          <label className="flex items-center gap-2 pb-2 text-sm">
            <Checkbox checked={isAdmin} onCheckedChange={(c) => setIsAdmin(!!c)} />
            Administrator
          </label>
          <Button type="submit" disabled={create.isPending}>
            <UserPlus className="size-4" /> Create
          </Button>
        </div>
      </form>

      <div className="overflow-hidden rounded-2xl border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={5} className="text-muted-foreground">
                  Loading users…
                </TableCell>
              </TableRow>
            )}
            {(users ?? []).map((u) => (
              <TableRow key={u.id}>
                <TableCell className="font-medium">{u.email}</TableCell>
                <TableCell>{u.department}</TableCell>
                <TableCell>
                  <Badge
                    variant="secondary"
                    className={
                      u.isAdmin
                        ? "bg-primary text-primary-foreground"
                        : "bg-success-soft text-success"
                    }
                  >
                    {u.isAdmin ? "Admin" : "User"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={u.isActive ? "secondary" : "destructive"}>
                    {u.isActive ? "Active" : "Disabled"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      title="Edit Account"
                      aria-label={`Edit ${u.email}`}
                      onClick={() =>
                        setEditing({
                          userId: u.id,
                          email: u.email,
                          department: u.department,
                          isAdmin: u.isAdmin,
                          isActive: u.isActive,
                        })
                      }
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      title="Send Password Reset"
                      aria-label={`Send Password Reset To ${u.email}`}
                      disabled={reset.isPending || !u.isActive}
                      onClick={() => {
                        if (window.confirm(`Create a password reset link for ${u.email}?`))
                          reset.mutate(u.id);
                      }}
                    >
                      <Mail className="size-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={u.id === session?.userId || destroy.isPending}
                      onClick={() => {
                        if (window.confirm(`Permanently delete ${u.email}?`)) destroy.mutate(u.id);
                      }}
                    >
                      <Trash2 className="size-4" /> Delete
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {editing && (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open && !save.isPending) setEditing(null);
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Account</DialogTitle>
            </DialogHeader>
            <p className="break-all text-sm text-muted-foreground">{editing.email}</p>
            <form
              className="space-y-5"
              onSubmit={(e) => {
                e.preventDefault();
                save.mutate();
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="edit-department">Department</Label>
                <Select
                  value={editing.department}
                  onValueChange={(department) => setEditing({ ...editing, department })}
                >
                  <SelectTrigger id="edit-department">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(departments ?? []).map((d) => (
                      <SelectItem key={d} value={d}>
                        {d}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={editing.isAdmin}
                  disabled={editing.userId === session?.userId}
                  onCheckedChange={(value) => setEditing({ ...editing, isAdmin: value === true })}
                />
                Administrator
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={editing.isActive}
                  disabled={editing.userId === session?.userId}
                  onCheckedChange={(value) => setEditing({ ...editing, isActive: value === true })}
                />
                Account Active
              </label>
              {save.isError && (
                <p role="alert" className="text-sm text-destructive">
                  {save.error.message}
                </p>
              )}
              <Button type="submit" disabled={save.isPending}>
                Save Changes
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
