export async function parseTwilioForm(
  req: Request
): Promise<Record<string, string>> {
  const form = await req.formData();
  const params: Record<string, string> = {};
  form.forEach((value, key) => {
    if (typeof value === "string") params[key] = value;
  });
  return params;
}

export function twimlResponse(twiml: string): Response {
  return new Response(twiml, {
    headers: { "Content-Type": "text/xml" },
  });
}

export function appOriginFromRequest(req: Request): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    new URL(req.url).origin
  ).replace(/\/$/, "");
}
