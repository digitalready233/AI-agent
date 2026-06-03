export function OAuthDivider() {
  return (
    <div className="relative flex items-center gap-3 py-1">
      <div className="h-px flex-1 bg-slate-800" aria-hidden />
      <span className="text-xs font-medium uppercase tracking-wider text-slate-500">
        or continue with email
      </span>
      <div className="h-px flex-1 bg-slate-800" aria-hidden />
    </div>
  );
}
