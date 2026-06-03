import { redirect } from "next/navigation";
import { AgentLoginView } from "./agent-login-view";

function safeNextPath(raw: string | string[] | undefined): string {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (
    typeof v !== "string" ||
    !v.startsWith("/") ||
    v.startsWith("//") ||
    v.includes("\0")
  ) {
    return "/agent";
  }
  return v;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const sp = await searchParams;
  const nextPath = safeNextPath(sp.next);

  const agentGate = Boolean(process.env.DIGISALES_ACCESS_PASSWORD?.trim());
  if (agentGate && nextPath.startsWith("/agent")) {
    return <AgentLoginView nextPath={nextPath} />;
  }

  const qs = nextPath && nextPath !== "/agent" ? `?next=${encodeURIComponent(nextPath)}` : "";
  redirect(`/auth/login${qs}`);
}
