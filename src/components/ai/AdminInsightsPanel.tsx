import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { LineChart } from "lucide-react";
import { toast } from "sonner";

import { getAdminInsights, type AdminInsights } from "@/lib/ai.functions";
import { Button } from "@/components/ui/button";

export function AdminInsightsPanel() {
  const [insights, setInsights] = useState<AdminInsights | null>(null);
  const runInsights = useServerFn(getAdminInsights);
  const generate = useMutation({
    mutationFn: () => runInsights(),
    onSuccess: setInsights,
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <section className="vault-surface space-y-4 rounded-2xl border border-warning/20 bg-gradient-to-r from-warning-soft/50 via-card to-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <LineChart className="size-5 text-warning" />
          <div>
            <h2 className="text-lg font-semibold">AI Admin Insights</h2>
            <p className="text-sm text-muted-foreground">
              Summarizes account and credential coverage using aggregate counts only.
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => generate.mutate()}
          disabled={generate.isPending}
        >
          {generate.isPending ? "Generating…" : "Generate Insights"}
        </Button>
      </div>

      {insights && (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-xl border border-border bg-card p-4 lg:col-span-1">
            <h3 className="font-semibold">Summary</h3>
            <p className="mt-2 text-sm text-muted-foreground">{insights.summary}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="font-semibold">Highlights</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              {insights.highlights.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="font-semibold">Suggested Actions</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              {insights.recommendations.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </section>
  );
}
