import type { Metadata } from "next";
import { Suspense } from "react";
import { DemoRoomClient } from "@/components/demo/demo-room-client";

type PageProps = {
  params: Promise<{ sessionId: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { sessionId } = await params;
  return {
    title: "Live product demo",
    description: `Join demo session ${sessionId}`,
  };
}

export default async function DemoRoomPage({ params }: PageProps) {
  const { sessionId } = await params;
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-400">
          Loading demo room…
        </div>
      }
    >
      <DemoRoomClient sessionId={sessionId} />
    </Suspense>
  );
}
