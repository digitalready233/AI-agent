import { DemoProviderSettingsPanel } from "@/components/platform/demo-provider-settings";

export default function DemoRoomSettingsPage() {
  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Demo room settings</h1>
        <p className="text-sm text-slate-400 mt-1">
          Voice, LiveKit, transcripts, and branding for real-time AI demo calls.
        </p>
      </div>
      <p className="text-sm text-slate-400">
        <a
          href="/dashboard/settings/avatar-providers"
          className="text-cyan-400 hover:underline"
        >
          Avatar providers hub
        </a>{" "}
        — compare Tavus, D-ID, routing rules, and performance.
      </p>
      <DemoProviderSettingsPanel />
    </div>
  );
}
