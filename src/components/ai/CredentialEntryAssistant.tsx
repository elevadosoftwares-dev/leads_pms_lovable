import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Wand2 } from "lucide-react";
import { toast } from "sonner";

import { suggestCredentialEntry, type CredentialSuggestion } from "@/lib/ai.functions";
import { useDepartments, useEntities } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export type CredentialFormPatch = {
  entity_id?: string;
  site_url?: string;
  login_user_id?: string;
  registered_email?: string;
  registered_mobile?: string;
  client_name?: string;
  purpose?: string;
  departments?: string[];
  contact_name?: string;
  contact_email?: string;
  contact_tel?: string;
  token_type?: string;
  token_holder?: string;
};

export function CredentialEntryAssistant({
  onApply,
}: {
  onApply: (patch: CredentialFormPatch) => void;
}) {
  const [notes, setNotes] = useState("");
  const [suggestion, setSuggestion] = useState<CredentialSuggestion | null>(null);
  const suggest = useServerFn(suggestCredentialEntry);
  const { data: entities } = useEntities();
  const { data: departments } = useDepartments();

  const extract = useMutation({
    mutationFn: () => suggest({ data: { notes } }),
    onSuccess: setSuggestion,
    onError: (error: Error) => toast.error(error.message),
  });

  function apply() {
    if (!suggestion) return;
    const entity = (entities ?? []).find(
      (item) => item.name.toLowerCase() === suggestion.entityName?.trim().toLowerCase(),
    );
    const validDepartments = suggestion.departments.filter((department) =>
      (departments ?? []).includes(department),
    );
    const patch: CredentialFormPatch = {};
    if (entity) patch.entity_id = entity.id;
    if (suggestion.siteUrl) patch.site_url = suggestion.siteUrl;
    if (suggestion.loginUserId) patch.login_user_id = suggestion.loginUserId;
    if (suggestion.registeredEmail) patch.registered_email = suggestion.registeredEmail;
    if (suggestion.registeredMobile) patch.registered_mobile = suggestion.registeredMobile;
    if (suggestion.clientName) patch.client_name = suggestion.clientName.slice(0, 15);
    if (suggestion.purpose) patch.purpose = suggestion.purpose;
    if (validDepartments.length > 0) patch.departments = validDepartments;
    if (suggestion.contactName) patch.contact_name = suggestion.contactName;
    if (suggestion.contactEmail) patch.contact_email = suggestion.contactEmail;
    if (suggestion.contactTel) patch.contact_tel = suggestion.contactTel;
    if (suggestion.tokenType) patch.token_type = suggestion.tokenType;
    if (suggestion.tokenHolder) patch.token_holder = suggestion.tokenHolder;
    onApply(patch);
    toast.success("AI suggestion applied. Review it before saving.");
  }

  return (
    <section className="space-y-3 rounded-xl border border-primary/20 bg-primary/5 p-4 sm:col-span-2">
      <div className="flex items-center gap-2">
        <Wand2 className="size-4 text-primary" />
        <h3 className="text-sm font-semibold text-primary">AI Entry Assistant</h3>
      </div>
      <p className="text-xs text-muted-foreground">
        Paste non-secret notes and AI will suggest form fields. Never paste passwords, tokens, or
        keys.
      </p>
      <div className="space-y-2">
        <Label htmlFor="ai-credential-notes">Notes</Label>
        <Textarea
          id="ai-credential-notes"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          rows={3}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => extract.mutate()}
          disabled={extract.isPending}
        >
          {extract.isPending ? "Reading Notes…" : "Extract With AI"}
        </Button>
        {suggestion && (
          <Button type="button" onClick={apply}>
            Apply Suggestion
          </Button>
        )}
      </div>
      {suggestion && (
        <div className="rounded-lg border border-border bg-card p-3 text-sm">
          <p>
            <span className="font-medium">Confidence:</span> {suggestion.confidence}
          </p>
          <p className="mt-1 text-muted-foreground">{suggestion.notes}</p>
        </div>
      )}
    </section>
  );
}
