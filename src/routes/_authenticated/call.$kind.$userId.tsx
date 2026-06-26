import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Mic, MicOff, Video as VideoIcon, VideoOff, PhoneOff } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/call/$kind/$userId")({
  component: CallScreen,
});

function CallScreen() {
  const { kind, userId } = useParams({ from: "/_authenticated/call/$kind/$userId" });
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [muted, setMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: kind === "video" ? { width: 640, height: 480, facingMode: "user" } : false,
        });
        if (!mounted) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current && kind === "video") {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        setTimeout(() => setConnected(true), 1200);
      } catch (e: any) {
        toast.error("Could not access camera / mic: " + e.message);
        navigate({ to: "/home" });
      }
    }
    start();
    return () => {
      mounted = false;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [kind, navigate]);

  useEffect(() => {
    if (!connected) return;
    const i = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(i);
  }, [connected]);

  function toggleMic() {
    const t = streamRef.current?.getAudioTracks()[0];
    if (t) { t.enabled = !t.enabled; setMuted(!t.enabled); }
  }
  function toggleCam() {
    const t = streamRef.current?.getVideoTracks()[0];
    if (t) { t.enabled = !t.enabled; setCamOff(!t.enabled); }
  }
  function end() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    navigate({ to: "/home" });
  }

  const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");

  return (
    <AppShell>
      <Card className="glass overflow-hidden p-0">
        <div className="relative aspect-[3/4] sm:aspect-video bg-black flex items-center justify-center">
          {kind === "video" ? (
            <video ref={videoRef} className="absolute inset-0 size-full object-cover" muted playsInline />
          ) : (
            <div className="text-center">
              <div className="mx-auto size-28 rounded-full brand-gradient flex items-center justify-center mb-4 animate-pulse">
                <Mic className="size-12 text-primary-foreground" />
              </div>
              <p className="text-lg font-semibold text-white">Voice call</p>
            </div>
          )}
          <div className="absolute top-3 left-3 right-3 flex items-center justify-between text-white">
            <div className="px-2.5 py-1 rounded-full bg-black/50 text-xs">
              {connected ? `Connected · ${mm}:${ss}` : "Connecting…"}
            </div>
            <div className="px-2.5 py-1 rounded-full bg-black/50 text-xs">
              to {userId.slice(0, 8)}
            </div>
          </div>
        </div>
        <div className="p-4 flex items-center justify-center gap-3">
          <Button size="icon" variant={muted ? "destructive" : "secondary"} onClick={toggleMic}>
            {muted ? <MicOff className="size-5" /> : <Mic className="size-5" />}
          </Button>
          {kind === "video" && (
            <Button size="icon" variant={camOff ? "destructive" : "secondary"} onClick={toggleCam}>
              {camOff ? <VideoOff className="size-5" /> : <VideoIcon className="size-5" />}
            </Button>
          )}
          <Button size="icon" variant="destructive" onClick={end}>
            <PhoneOff className="size-5" />
          </Button>
        </div>
        <p className="px-4 pb-4 text-center text-[11px] text-muted-foreground">
          Realtime peer connection requires a media SDK (Agora / LiveKit). This screen captures your local media and shows the call UI — wire your SDK in next.
        </p>
      </Card>
    </AppShell>
  );
}
