import { clearSessionActivity } from "@/lib/auth/session-inactivity";

type ClientRouter = {
  push: (href: string) => void;
  refresh: () => void;
};

export async function signOutClient(router: ClientRouter): Promise<void> {
  clearSessionActivity();
  try {
    await fetch("/api/auth/signout", { method: "POST", credentials: "include" });
  } catch {
    /* still redirect */
  }
  router.push("/auth/login");
  router.refresh();
}
