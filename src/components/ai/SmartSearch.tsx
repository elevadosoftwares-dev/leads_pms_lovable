import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bot, X } from "lucide-react";
import { toast } from "sonner";

import { smartCredentialSearch, type SmartSearchResult } from "@/lib/ai.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function SmartSearch({ onMatches }: { onMatches: (ids: string[] | null) => void }) {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<SmartSearchResult | null>(null);
  const search = useServerFn(smartCredentialSearch);
  const ask = useMutation({
    mutationFn: () => search({ data: { query } }),
    onSuccess: (data) => {
      setResult(data);
      onMatches(data.credentialIds);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  function clear() {
    setQuery("");
    setResult(null);
    onMatches(null);
  }

  return (
    <div className="space-y-3 rounded-xl border border-violet/20 bg-violet-soft/40 p-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-violet">
        <Bot className="size-4" />
        AI Smart Search
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              ask.mutate();
            }
          }}
          aria-label="AI Smart Search"
        />
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => ask.mutate()}
            disabled={ask.isPending}
          >
            {ask.isPending ? "Searching…" : "Ask AI"}
          </Button>
          {result && (
            <Button type="button" variant="ghost" onClick={clear} aria-label="Clear AI Search">
              <X className="size-4" />
            </Button>
          )}
        </div>
      </div>
      {result && <p className="text-sm text-muted-foreground">{result.answer}</p>}
    </div>
  );
}
