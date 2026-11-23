import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { PasswordForm } from "@/components/PasswordForm";
import { useSession } from "@/lib/session";

export const Route = createFileRoute("/_authenticated/account")({
  head: () => ({
    meta: [
      { title: "My Account | Leads Credential Manager" },
      {
        name: "description",
        content: "View your Leads account details and securely change your password.",
      },
      { property: "og:title", content: "My Account | Leads Credential Manager" },
      {
        property: "og:description",
        content: "View your Leads account details and securely change your password.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AccountPage,
});
function AccountPage() {
  const { data: session } = useSession();
  return (
    <div className="max-w-lg space-y-8">
      <h1 className="text-2xl font-semibold">My Account</h1>
      <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 text-sm">
        <dt className="text-muted-foreground">Email</dt>
        <dd className="break-all">{session?.email}</dd>
        <dt className="text-muted-foreground">Department</dt>
        <dd>{session?.department}</dd>
        <dt className="text-muted-foreground">Role</dt>
        <dd>{session?.isAdmin ? "Admin" : "User"}</dd>
      </dl>
      <section className="space-y-5 border-t border-border pt-6">
        <h2 className="text-lg font-semibold">Change Password</h2>
        <PasswordForm
          recovery={false}
          onSuccess={() => {
            toast.success("Password updated.");
          }}
        />
      </section>
    </div>
  );
}
