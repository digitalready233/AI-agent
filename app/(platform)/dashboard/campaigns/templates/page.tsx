import Link from "next/link";
import { requireSession } from "@/lib/platform/auth";
import { requirePermission } from "@/lib/platform/rbac";
import { PageHeader } from "@/components/platform/page-header";
import { MessageTemplatesManager } from "@/components/platform/message-templates-manager";
import { Button } from "@/components/ui/button";

export default async function MessageTemplatesPage() {
  const session = await requireSession();
  requirePermission(session, "campaigns.manage");

  return (
    <div className="platform-page">
      <PageHeader
        title="Message templates"
        description="Reusable outbound copy for campaigns — WhatsApp, email, and future channels."
        actions={
          <Button variant="outline" size="sm" className="rounded-xl" asChild>
            <Link href="/dashboard/campaigns">Back to campaigns</Link>
          </Button>
        }
      />
      <MessageTemplatesManager />
    </div>
  );
}
