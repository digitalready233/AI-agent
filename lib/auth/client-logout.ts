import { clearSessionActivity } from "@/lib/auth/session-inactivity";
import { LOGIN_PATH } from "@/lib/auth/login-url";

type ClientRouter = {
  push: (href: string) => void;
  replace: (href: string) => void;
  refresh: () => void;
};

export type SignOutOptions = {
  /** Where to land after cookies are cleared. Defaults to login. */
  redirectTo?: string;
  /**
   * Full page navigation avoids Next.js soft-cache / bfcache loops when the user
   * presses Back from login toward the marketing site.
   */
  hardNavigation?: boolean;
};

/**
 * Clears session cookies server-side, then replaces history (no dashboard back-stack).
 */
export async function signOutClient(
  _router?: ClientRouter,
  options?: SignOutOptions
): Promise<void> {
  clearSessionActivity();
  const redirectTo = options?.redirectTo ?? LOGIN_PATH;
  const hardNavigation = options?.hardNavigation ?? true;

  try {
    await fetch("/api/auth/signout", {
      method: "POST",
      credentials: "include",
      cache: "no-store",
    });
  } catch {
    /* still redirect */
  }

  if (hardNavigation && typeof window !== "undefined") {
    window.location.replace(redirectTo);
    return;
  }

  _router?.replace(redirectTo);
  _router?.refresh();
}
