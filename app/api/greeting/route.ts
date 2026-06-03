import { getFirstMessage, type GreetingVariant } from "@/lib/greetings";
import type { Channel } from "@/lib/config";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const channel = (searchParams.get("channel") as Channel) ?? "website";
  const variant =
    (searchParams.get("variant") as GreetingVariant) ?? "sales";

  return Response.json({
    message: getFirstMessage(channel, variant),
    channel,
    variant,
  });
}
