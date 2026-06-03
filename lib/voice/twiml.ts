export function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .slice(0, 1200);
}

export function twimlConnectStream(params: {
  streamUrl: string;
  callId: string;
  organizationId: string;
  statusCallbackUrl?: string;
}): string {
  const url = escapeXml(params.streamUrl);
  const statusAttr = params.statusCallbackUrl
    ? ` statusCallback="${escapeXml(params.statusCallbackUrl)}" statusCallbackEvent="initiated ringing answered completed"`
    : "";
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response${statusAttr}>
  <Connect>
    <Stream url="${url}">
      <Parameter name="callId" value="${escapeXml(params.callId)}" />
      <Parameter name="organizationId" value="${escapeXml(params.organizationId)}" />
    </Stream>
  </Connect>
</Response>`;
}

export function twimlSayAndGather(params: {
  say: string;
  actionUrl: string;
  voice?: string;
  statusCallbackUrl?: string;
  recordCall?: boolean;
}): string {
  const voice = params.voice ?? "Polly.Joanna";
  const statusAttr = params.statusCallbackUrl
    ? ` statusCallback="${escapeXml(params.statusCallbackUrl)}" statusCallbackEvent="initiated ringing answered completed"`
    : "";
  const recordBlock =
    params.recordCall && params.statusCallbackUrl
      ? `\n  <Record recordingStatusCallback="${escapeXml(params.statusCallbackUrl)}" recordingStatusCallbackMethod="POST" />`
      : "";
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response${statusAttr}>${recordBlock}
  <Gather input="speech" speechTimeout="auto" action="${escapeXml(params.actionUrl)}" method="POST">
    <Say voice="${escapeXml(voice)}">${escapeXml(params.say)}</Say>
  </Gather>
</Response>`;
}

export function twimlTransferDial(number: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial>${escapeXml(number)}</Dial>
</Response>`;
}

export function twimlHangup(message?: string): string {
  if (message?.trim()) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>${escapeXml(message)}</Say>
  <Hangup/>
</Response>`;
  }
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Hangup/></Response>`;
}
