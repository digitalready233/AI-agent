import { avatar } from "@/lib/config";

type Props = { className?: string };

/**
 * Optional HeyGen / Tavus / D-ID / LiveAvatar embed.
 * Set `NEXT_PUBLIC_AVATAR_EMBED_URL` to your provider's session iframe URL.
 */
export function SessionAvatar({ className }: Props) {
  if (!avatar.embedUrl) {
    return (
      <div
        className={className}
        style={{
          display: "grid",
          placeItems: "center",
          minHeight: 200,
          padding: "1.5rem",
          textAlign: "center",
          fontSize: "0.88rem",
          opacity: 0.7,
        }}
      >
        <p style={{ margin: 0, maxWidth: 320 }}>
          Video avatar: set{" "}
          <code style={{ fontSize: "0.8em" }}>NEXT_PUBLIC_AVATAR_EMBED_URL</code>{" "}
          to your provider session URL to show a talking avatar here.
        </p>
      </div>
    );
  }

  return (
    <iframe
      title="AI avatar session"
      src={avatar.embedUrl}
      className={className}
      allow="camera; microphone; autoplay; fullscreen"
      style={{
        width: "100%",
        height: 360,
        border: "none",
        display: "block",
      }}
    />
  );
}
