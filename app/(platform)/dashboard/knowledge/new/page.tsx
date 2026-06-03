import { requireSession } from "@/lib/platform/auth";
import { PageHeader } from "@/components/platform/page-header";
import { KnowledgeForm } from "@/components/platform/knowledge-form";

export default async function NewKnowledgePage() {
  await requireSession();

  return (
    <div className="platform-page">
      <PageHeader
        title="Add knowledge"
        description="Create a knowledge base and add entries your agents can reference."
      />
      <KnowledgeForm />
    </div>
  );
}
