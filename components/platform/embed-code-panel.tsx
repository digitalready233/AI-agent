"use client";

import { useMemo, useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

export function EmbedCodePanel({
  agentId,
  siteOrigin,
}: {
  agentId: string;
  siteOrigin?: string;
}) {
  const [copied, setCopied] = useState<string | null>(null);

  const origin =
    siteOrigin?.replace(/\/$/, "") ||
    (typeof window !== "undefined" ? window.location.origin : "https://your-domain.com");

  const snippets = useMemo(() => {
    const script = `<!-- DigiSales.ai chat widget -->
<script
  src="${origin}/embed.js"
  data-base="${origin}"
  data-agent-id="${agentId}"
  data-label="Chat with us"
  defer
></script>`;

    const iframe = `<!-- Full-page embed (iframe) -->
<iframe
  src="${origin}/live-agent/${encodeURIComponent(agentId)}?embed=1"
  title="Chat"
  style="width:100%;max-width:520px;height:min(720px,90vh);border:0;border-radius:16px;"
  allow="microphone"
></iframe>`;

    const link = `${origin}/live-agent/${encodeURIComponent(agentId)}`;
    const legacyLink = `${origin}/chat?agentId=${encodeURIComponent(agentId)}`;

    return { script, iframe, link, legacyLink };
  }, [agentId, origin]);

  async function copy(key: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopied(null), 2000);
    } catch {
      toast.error("Could not copy");
    }
  }

  return (
    <Card className="border-cyan-500/20">
      <CardHeader>
        <CardTitle className="text-base">Embed on your website</CardTitle>
        <p className="text-xs text-slate-500 mt-1">
          Paste the script before <code className="text-cyan-400/90">&lt;/body&gt;</code> on any
          page. Visitors get a floating chat that uses this agent and your knowledge base.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-slate-200">Floating widget (recommended)</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 rounded-lg shrink-0"
              onClick={() => void copy("script", snippets.script)}
            >
              {copied === "script" ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              Copy
            </Button>
          </div>
          <pre className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/80 p-4 text-xs text-slate-300 leading-relaxed">
            {snippets.script}
          </pre>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-slate-200">Direct chat link</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 rounded-lg shrink-0"
              onClick={() => void copy("link", snippets.link)}
            >
              {copied === "link" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              Copy
            </Button>
          </div>
          <p className="text-xs text-slate-500 break-all">{snippets.link}</p>
          <p className="text-xs text-slate-600 mt-1">
            Legacy URL still works:{" "}
            <span className="text-slate-500 break-all">{snippets.legacyLink}</span>
          </p>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-slate-200">Iframe only</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 rounded-lg shrink-0"
              onClick={() => void copy("iframe", snippets.iframe)}
            >
              {copied === "iframe" ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              Copy
            </Button>
          </div>
          <pre className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/80 p-4 text-xs text-slate-300 leading-relaxed">
            {snippets.iframe}
          </pre>
        </div>
      </CardContent>
    </Card>
  );
}
