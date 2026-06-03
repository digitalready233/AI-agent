import {
  platformRecordingStatus,
  withPlatformRecordingHandler,
} from "@/lib/demo/demo-recording-routes";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return withPlatformRecordingHandler((ctx) => platformRecordingStatus(ctx, id));
}
