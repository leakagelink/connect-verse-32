import { useEffect, useState } from "react";
import { Mic, Video as VideoIcon, CheckCircle2, XCircle, AlertCircle, Loader2, Settings as SettingsIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  checkCallPermissions,
  requestCallPermissions,
  openAppSettings,
  isNative,
  type PermState,
} from "@/lib/native";
import { toast } from "sonner";

interface Props {
  kind: "voice" | "video";
  onReady: () => void;
  onCancel: () => void;
}

/**
 * Pre-call permission screen. Reads current mic/camera status (without
 * prompting), then either auto-advances when everything is granted, or
 * shows tailored CTAs: "Allow access" on first run, "Open Settings" if a
 * prior denial means the OS won't prompt again.
 */
export function CallPermissionGate({ kind, onReady, onCancel }: Props) {
  const needsCamera = kind === "video";
  const [mic, setMic] = useState<PermState>("unknown");
  const [camera, setCamera] = useState<PermState>("unknown");
  const [checking, setChecking] = useState(true);
  const [requesting, setRequesting] = useState(false);
  const [askedOnce, setAskedOnce] = useState(false);

  async function refresh(): Promise<{ mic: PermState; camera: PermState }> {
    const s = await checkCallPermissions();
    setMic(s.mic);
    setCamera(s.camera);
    return s;
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const s = await refresh();
      if (cancelled) return;
      setChecking(false);
      const micOk = s.mic === "granted";
      const camOk = !needsCamera || s.camera === "granted";
      // Auto-advance if already fully granted.
      if (micOk && camOk) onReady();
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleAllow() {
    setRequesting(true);
    try {
      const res = await requestCallPermissions(kind);
      setAskedOnce(true);
      const s = await refresh();
      if (res.granted) {
        onReady();
        return;
      }
      if (res.reason === "mic-denied") toast.error("Microphone access denied.");
      else if (res.reason === "camera-denied") toast.error("Camera access denied.");
      else if (res.reason === "media-denied") toast.error("Camera or microphone access denied.");
      else if (res.reason === "media-unavailable") toast.error("Camera or microphone not available on this device.");
      else if (res.reason === "plugin-missing") toast.error("Permission module unavailable. Reinstall the latest app.");
      // If denied and we're native, the next CTA flips to "Open Settings".
      void s;
    } finally {
      setRequesting(false);
    }
  }

  async function handleOpenSettings() {
    const ok = await openAppSettings();
    if (!ok) {
      toast.info("Open Settings → Apps → Talkora → Permissions to enable mic/camera.");
    }
  }

  const micOk = mic === "granted";
  const camOk = !needsCamera || camera === "granted";
  const allGranted = micOk && camOk;
  const anyDenied =
    mic === "denied" || (needsCamera && camera === "denied");
  // After a denial, native OS often won't prompt again — guide to Settings.
  const useSettingsCta = isNative() && askedOnce && anyDenied;

  return (
    <div className="min-h-[60vh] grid place-items-center px-4">
      <Card className="w-full max-w-md p-6 space-y-5">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold">
            {kind === "video" ? "Camera & Microphone needed" : "Microphone needed"}
          </h2>
          <p className="text-sm text-muted-foreground">
            Talkora needs access to start your {kind === "video" ? "video call" : "voice call"}.
            We never record or store your media — it streams directly between you and your partner.
          </p>
        </div>

        <div className="space-y-2">
          <PermRow
            icon={<Mic className="size-4" />}
            label="Microphone"
            state={mic}
            checking={checking}
          />
          {needsCamera && (
            <PermRow
              icon={<VideoIcon className="size-4" />}
              label="Camera"
              state={camera}
              checking={checking}
            />
          )}
        </div>

        {anyDenied && (
          <div className="flex gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
            <AlertCircle className="size-4 shrink-0 mt-0.5" />
            <p>
              {askedOnce
                ? "Permission was denied. Open Settings → Apps → Talkora → Permissions and enable Microphone"
                : "We previously couldn't get permission. Tap Allow access to try again"}
              {needsCamera ? " and Camera." : "."}
            </p>
          </div>
        )}

        <div className="flex flex-col gap-2">
          {allGranted ? (
            <Button onClick={onReady} className="w-full">Continue</Button>
          ) : useSettingsCta ? (
            <Button onClick={handleOpenSettings} className="w-full gap-2">
              <SettingsIcon className="size-4" /> Open app settings
            </Button>
          ) : (
            <Button onClick={handleAllow} disabled={requesting || checking} className="w-full gap-2">
              {requesting ? <Loader2 className="size-4 animate-spin" /> : null}
              {askedOnce ? "Try again" : "Allow access"}
            </Button>
          )}
          <Button variant="ghost" onClick={onCancel} className="w-full">Cancel</Button>
        </div>
      </Card>
    </div>
  );
}

function PermRow({
  icon,
  label,
  state,
  checking,
}: { icon: React.ReactNode; label: string; state: PermState; checking: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-md border bg-card px-3 py-2">
      <div className="flex items-center gap-2 text-sm">
        {icon}
        <span>{label}</span>
      </div>
      {checking ? (
        <Loader2 className="size-4 animate-spin text-muted-foreground" />
      ) : (
        <StateBadge state={state} />
      )}
    </div>
  );
}

function StateBadge({ state }: { state: PermState }) {
  if (state === "granted") {
    return (
      <Badge variant="secondary" className="gap-1 text-emerald-600 bg-emerald-500/10 border-emerald-500/20">
        <CheckCircle2 className="size-3" /> Granted
      </Badge>
    );
  }
  if (state === "denied") {
    return (
      <Badge variant="destructive" className="gap-1">
        <XCircle className="size-3" /> Denied
      </Badge>
    );
  }
  if (state === "prompt") {
    return (
      <Badge variant="outline" className="gap-1">
        <AlertCircle className="size-3" /> Not granted
      </Badge>
    );
  }
  return <Badge variant="outline">Unknown</Badge>;
}
