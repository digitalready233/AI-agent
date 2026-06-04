import { createClient, type SupabaseClientOptions } from "@supabase/supabase-js";
import WebSocket from "ws";

/** Service role — server-only. Never import in client components. */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url?.trim() || !key?.trim()) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL required.");
  }

  const options: SupabaseClientOptions = {
    auth: { autoRefreshToken: false, persistSession: false },
  };

  // Node 20 on VPS has no native WebSocket; realtime-js requires `ws` as transport.
  if (typeof globalThis.WebSocket === "undefined") {
    options.realtime = { transport: WebSocket };
  }

  return createClient(url, key, options);
}
