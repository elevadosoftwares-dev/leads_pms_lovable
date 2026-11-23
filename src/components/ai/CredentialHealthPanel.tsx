import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { analyzeCredentialHealth, type CredentialHealth } from "@/lib/ai.functions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const severityClass = {
  info: "bg-primary/10 text-primary",
  low: "bg-success-soft text-success",
  medium: "bg-warning-soft text-warning",
  high: "bg-coral-soft text-coral",
} as const;

export function CredentialHealthPanel() {
  const [result, setResult] = useState<CredentialHealth | null>(null);
  const runHealth = useServerFn(analyzeCredentialHealth);
  const analyze = useMutation({
    mutationFn: () => runHealth(),
    onSuccess: setResult,
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <section className="vault-surface space-y-4 rounded-2xl border border-success/20 bg-gradient-to-r from-success-soft/50 via-card to-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-5 text-success" />
          <div>
            <h2 className="text-lg font-semibold">AI Security Health Check</h2>
            <p className="text-sm text-muted-foreground">
              Reviews metadata and password strength signals without sending secrets to AI.
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => analyze.mutate()}
          disabled={analyze.isPending}
        >
          {analyze.isPending ? "Checking…" : "Run Health Check"}
        </Button>
      </div>

      {result && (
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="text-sm font-semibold">
              Overall Score: {Math.round(result.overallScore)}/100
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{result.summary}</p>
          </div>
          <div className="grid gap-3">
            {result.findings.map((finding) => (
              <article
                key={`${finding.severity}-${finding.title}`}
                className="rounded-xl border border-border bg-card p-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary" className={severityClass[finding.severity]}>
                    {finding.severity}
                  </Badge>
                  <h3 className="font-medium">{finding.title}</h3>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{finding.recommendation}</p>
                {finding.credentialIds.length > 0 && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Affected entries: {finding.credentialIds.length}
                  </p>
                )}
              </article>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
