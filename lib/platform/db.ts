import { AsyncLocalStorage } from "node:async_hooks";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const adminContext = new AsyncLocalStorage<boolean>();

/** Run platform data writes as service role (public embed chat). */
export function withPlatformAdmin<T>(fn: () => Promise<T>): Promise<T> {
  return adminContext.run(true, fn);
}

export function isPlatformAdminContext(): boolean {
  return adminContext.getStore() === true;
}

export function hasServiceRoleKey(): boolean {
  return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim());
}

export async function platformDb() {
  if (adminContext.getStore() && hasServiceRoleKey()) {
    return createAdminClient();
  }
  return await createClient();
}
