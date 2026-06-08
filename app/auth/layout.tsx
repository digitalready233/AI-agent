import { Toaster } from "sonner";
import { AuthBrandPanel } from "@/components/platform/auth/auth-brand-panel";

export const dynamic = "force-dynamic";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="platform-auth-shell flex min-h-screen flex-col lg:flex-row">
      <AuthBrandPanel />
      <div className="platform-auth-form-panel w-full">{children}</div>
      <Toaster theme="dark" position="top-right" richColors />
    </div>
  );
}
