import { useCallback, useEffect, useState } from "react";
import { Mic, Video as VideoIcon, CheckCircle2, XCircle, AlertCircle, Loader2, Settings as SettingsIcon, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  checkCallPermissions,
  requestCallPermissions,
  openAppSettings,
  getLastPermDenial,
  clearLastPermDenial,
  isNative,
  platform,
  type PermState,
  type LastPermDenial,
} from "@/lib/native";
import { toast } from "sonner";

const REASON_LABEL: Record<string, string> = {
  "mic-denied": "Microphone access denied",
  "camera-denied": "Camera access denied",
  "media-denied": "Mic/Camera access denied",
  "media-unavailable": "No mic/camera hardware available",
  "plugin-missing": "Native permission module unavailable — reinstall app",
};

function fmtAgo(ts: number) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(ts).toLocaleString();
}

/**
 * Diagnostics card: live mic/camera status, last denial reason, platform info,
 * and one-tap re-request / open-settings.
 */
export function PermissionDebugPanel() {
  const [mic, setMic] = useState<PermState>("unknown");
  const [camera, setCamera] = useState<PermState>("unknown");
  const [checking, setChecking] = useState(true);
  const [requesting, setRequesting] = useState<"voice" | "video" | null>(null);
  const [last, setLast] = useState<LastPermDenial | null>(null);

  const refresh = useCallback(async () => {
    setChecking(true);
    const s = await checkCallPermissions();
    setMic(s.mic);
    setCamera(s.camera);
    setLast(getLastPermDenial());
    setChecking(false);
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  async function handleRequest(kind: "voice" | "video") {
    setRequesting(kind);
    try {
      const res = await requestCallPermissions(kind);
      await refresh();
      if (res.granted) toast.success(kind === "video" ? "Camera & mic ready" : "Microphone ready");
      else toast.error(REASON_LABEL[res.reason ?? ""] ?? "Permission not granted");
    } finally {
      setRequesting(null);
    }
  }

  async function handleSettings() {
    const ok = await openAppSettings();
    if (!ok) toast.info("Open Settings → Apps → Talkora → Permissions");
  }

  function handleClear() {
    clearLastPermDenial();
    setLast(null);
    toast.success("Cleared last denial record");
  }

  return (
    <Card className="p-5 space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold">Permission diagnostics</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Live status of mic & camera access for calls.
          </p>
        </div>
        <Button size="sm" variant="ghost" onClick={refresh} disabled={checking} className="gap-1">
          {checking ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
          Refresh
        </Button>
      </div>

      <div className="space-y-2">
        <Row icon={<Mic className="size-4" />} label="Microphone" state={mic} checking={checking} />
        <Row icon={<VideoIcon className="size-4" />} label="Camera" state={camera} checking={checking} />
      </div>

      <div className="rounded-md border bg-muted/30 p-3 text-xs space-y-1">
        <div className="flex justify-between"><span className="text-muted-foreground">Platform</span><span className="font-mono">{platform()}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Native wrapper</span><span className="font-mono">{isNative() ? "yes" : "no (web)"}</span></div>
      </div>

      <div className="space-y-2">
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Last denial</div>
        {last ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs space-y-2">
            <div className="flex items-start gap-2">
              <AlertCircle className="size-4 shrink-0 mt-0.5 text-destructive" />
              <div className="flex-1">
                <div className="font-medium text-destructive">
                  {REASON_LABEL[last.reason] ?? last.reason}
                </div>
                <div className="text-muted-foreground mt-0.5">
                  During {last.kind} call · {fmtAgo(last.at)}
                </div>
              </div>
            </div>
            <Button size="sm" variant="ghost" onClick={handleClear} className="h-7 gap-1 text-xs">
              <Trash2 className="size-3" /> Clear record
            </Button>
          </div>
        ) : (
          <div className="rounded-md border bg-card p-3 text-xs text-muted-foreground">
            No denials recorded.
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Button
          onClick={() => handleRequest("voice")}
          disabled={!!requesting}
          className="w-full gap-2"
        >
          {requesting === "voice" ? <Loader2 className="size-4 animate-spin" /> : <Mic className="size-4" />}
          Request microphone access
        </Button>
        <Button
          onClick={() => handleRequest("video")}
          disabled={!!requesting}
          variant="secondary"
          className="w-full gap-2"
        >
          {requesting === "video" ? <Loader2 className="size-4 animate-spin" /> : <VideoIcon className="size-4" />}
          Request camera + mic access
        </Button>
        {isNative() && (
          <Button onClick={handleSettings} variant="outline" className="w-full gap-2">
            <SettingsIcon className="size-4" /> Open app settings
          </Button>
        )}
      </div>
    </Card>
  );
}

function Row({ icon, label, state, checking }: { icon: React.ReactNode; label: string; state: PermState; checking: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-md border bg-card px-3 py-2">
      <div className="flex items-center gap-2 text-sm">{icon}<span>{label}</span></div>
      {checking ? <Loader2 className="size-4 animate-spin text-muted-foreground" /> : <StateBadge state={state} />}
    </div>
  );
}

function StateBadge({ state }: { state: PermState }) {
  if (state === "granted") return <Badge variant="secondary" className="gap-1 text-emerald-600 bg-emerald-500/10 border-emerald-500/20"><CheckCircle2 className="size-3" /> Granted</Badge>;
  if (state === "denied") return <Badge variant="destructive" className="gap-1"><XCircle className="size-3" /> Denied</Badge>;
  if (state === "prompt") return <Badge variant="outline" className="gap-1"><AlertCircle className="size-3" /> Not granted</Badge>;
  return <Badge variant="outline">Unknown</Badge>;
}
