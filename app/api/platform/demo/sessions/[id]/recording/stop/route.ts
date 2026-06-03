import {
  platformRecordingStop,
  withPlatformRecordingHandler,
} from "@/lib/demo/demo-recording-routes";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  return withPlatformRecordingHandler((ctx) => platformRecordingStop(ctx, id, body));
}
