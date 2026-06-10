import { isProductionRuntime } from "@/lib/security/production";

export function checkAdminApiAuth(req: Request): boolean {
  const secret = process.env.ADMIN_API_SECRET?.trim();
  if (!secret) {
    return !isProductionRuntime();
  }
  return req.headers.get("authorization") === `Bearer ${secret}`;
}
