import { Bot, MessageSquare, Sparkles, TrendingUp } from "lucide-react";

const highlights = [
  { icon: Bot, text: "AI sales agents with qualification, objections, and booking rules" },
  { icon: MessageSquare, text: "Website & WhatsApp conversations with CRM sync" },
  { icon: TrendingUp, text: "Hot leads, campaigns, and revenue pipeline dashboard" },
];

export function AuthBrandPanel() {
  return (
    <aside className="platform-auth-brand">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(34,211,238,0.15),transparent_50%)]" />
      <div className="relative z-10 flex flex-col gap-10">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400 to-cyan-600 shadow-lg shadow-cyan-500/30">
            <Sparkles className="h-6 w-6 text-slate-950" strokeWidth={2} />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400/90">
              DigiSales.ai
            </p>
            <p className="text-lg font-semibold text-white">Sales operations platform</p>
          </div>
        </div>

        <div className="space-y-5 max-w-md">
          <h1 className="font-display text-3xl font-bold leading-tight tracking-tight text-white xl:text-4xl">
            AI sales agent operations
          </h1>
          <p className="text-base leading-relaxed text-slate-400">
            Create sales agents, qualify leads, book meetings, run outreach campaigns, and hand off
            to humans — with support conversations when needed.
          </p>
        </div>

        <ul className="space-y-4">
          {highlights.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-start gap-3 text-sm text-slate-300">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-cyan-500/10 ring-1 ring-cyan-500/20">
                <Icon className="h-4 w-4 text-cyan-400" />
              </span>
              <span className="leading-relaxed pt-1">{text}</span>
            </li>
          ))}
        </ul>
      </div>

      <p className="relative z-10 text-xs text-slate-600">
        Enterprise-grade experience · Secure by design
      </p>
    </aside>
  );
}
