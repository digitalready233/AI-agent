export default function ConversationsLoading() {
  return (
    <div className="platform-page space-y-6 animate-pulse">
      <div className="h-10 w-64 rounded-lg bg-slate-800/75" />
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-8 w-24 rounded-lg bg-slate-800/50" />
        ))}
      </div>
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-16 rounded-xl bg-slate-800/40" />
        ))}
      </div>
    </div>
  );
}
