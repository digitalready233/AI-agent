import type { VisitorConversationEntry } from "@/lib/live-chat/visitor-conversation-store";
import { formatConversationTime } from "@/lib/live-chat/visitor-conversation-store";
import styles from "./live-agent-conversation-sidebar.module.css";

export function LiveAgentConversationSidebar({
  conversations,
  activeSessionId,
  open,
  embed,
  disabled,
  onNewChat,
  onSelect,
  onClose,
}: {
  conversations: VisitorConversationEntry[];
  activeSessionId: string;
  open: boolean;
  embed?: boolean;
  disabled?: boolean;
  onNewChat: () => void;
  onSelect: (sessionId: string) => void;
  onClose?: () => void;
}) {
  const sidebarClass = [
    styles.sidebar,
    embed ? styles.sidebarEmbed : "",
    open ? styles.sidebarOpen : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <>
      {open && onClose ? (
        <button
          type="button"
          className={styles.backdrop}
          aria-label="Close conversation history"
          onClick={onClose}
        />
      ) : null}
      <aside className={sidebarClass} aria-label="Conversation history">
        <div className={styles.header}>
          <button
            type="button"
            className={styles.newChatBtn}
            disabled={disabled}
            onClick={onNewChat}
          >
            <span aria-hidden>+</span>
            New conversation
          </button>
          <p className={styles.sectionLabel}>Recent</p>
        </div>
        <div className={styles.list} role="list">
          {conversations.length === 0 ? (
            <p className={styles.empty}>
              Past chats appear here. Start a new conversation anytime.
            </p>
          ) : (
            conversations.map((c) => {
              const active = c.sessionId === activeSessionId;
              return (
                <button
                  key={c.sessionId}
                  type="button"
                  role="listitem"
                  className={
                    active ? `${styles.item} ${styles.itemActive}` : styles.item
                  }
                  disabled={disabled || active}
                  onClick={() => onSelect(c.sessionId)}
                >
                  <span className={styles.itemTitle}>{c.title}</span>
                  <span className={styles.itemMeta}>
                    {formatConversationTime(c.updatedAt)}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </aside>
    </>
  );
}

export function SidebarToggleButton({
  onClick,
  label = "Show conversation history",
}: {
  onClick: () => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      className={styles.toggleBtn}
      onClick={onClick}
      aria-label={label}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M4 6h16M4 12h16M4 18h10"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    </button>
  );
}
