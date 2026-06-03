import { Badge } from "@/components/ui/badge";
import type { Conversation } from "@/lib/platform/types";

export function ConversationChannelBadge({
  channel,
}: {
  channel: Conversation["channel"];
}) {
  if (channel === "whatsapp") {
    return (
      <Badge className="bg-emerald-500/15 text-emerald-200 border-emerald-500/30 text-[10px]">
        WhatsApp
      </Badge>
    );
  }
  if (channel === "website" || channel === "live_agent") {
    return (
      <Badge variant="outline" className="text-[10px] capitalize">
        {channel === "live_agent" ? "Live chat" : "Website"}
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-[10px] capitalize">
      {channel.replace(/_/g, " ")}
    </Badge>
  );
}
