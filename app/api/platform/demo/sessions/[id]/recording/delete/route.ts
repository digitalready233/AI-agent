import {
  platformRecordingDelete,
  withPlatformRecordingHandler,
} from "@/lib/demo/demo-recording-routes";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return withPlatformRecordingHandler((ctx) => platformRecordingDelete(ctx, id));
}
