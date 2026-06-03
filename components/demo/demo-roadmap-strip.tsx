/** Product roadmap — internal demo room today; LiveKit and beyond later. */
export function DemoRoadmapStrip() {
  return (
    <div className="rounded-lg border border-slate-800/60 bg-slate-950/40 px-3 py-2.5 text-center space-y-1">
      <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
        Roadmap
      </p>
      <p className="text-[11px] text-slate-600 leading-relaxed">
        Today: browser demo + AI chat · Next:{" "}
        <span className="text-cyan-600/90">LiveKit</span> voice/video · Then: human join,
        screen share, recording, avatar
      </p>
    </div>
  );
}
