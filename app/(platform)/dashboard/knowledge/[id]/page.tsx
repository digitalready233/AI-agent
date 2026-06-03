import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/platform/auth";
import {
  getKnowledgeBase,
  listKnowledgeEntries,
} from "@/lib/platform/data";
import { KnowledgeBaseEditor } from "@/components/platform/knowledge-base-editor";
import { PageHeader } from "@/components/platform/page-header";
import { Button } from "@/components/ui/button";

export default async function KnowledgeBaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { organization } = await requireSession();
  const kb = await getKnowledgeBase(id, organization.id);

  if (!kb) {
    notFound();
  }

  const entries = await listKnowledgeEntries(organization.id, kb.id);

  return (
    <div className="platform-page">
      <PageHeader
        title={kb.title}
        description="Edit this knowledge base and its articles."
        backHref="/dashboard/knowledge"
        backLabel="Knowledge"
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard/knowledge">All bases</Link>
          </Button>
        }
      />
      <KnowledgeBaseEditor knowledgeBase={kb} entries={entries} />
    </div>
  );
}
