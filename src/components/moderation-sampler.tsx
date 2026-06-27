import { useEffect, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { submitMediaSample } from "@/lib/moderation.functions";
import { toast } from "sonner";

interface ModerationSamplerProps {
  /** Local user's media stream (mic+camera). */
  stream: MediaStream | null;
  /** "voice" or "video" call. Voice calls only sample audio. */
  kind: "voice" | "video";
  /** Peer user id — strikes are attributed to whoever's media we sample (= self). */
  selfUserId: string;
  /** Active call log id; included as evidence context. */
  callLogId: string | null;
  /** Sample interval (default 45s). */
  intervalMs?: number;
  /** Only sample once the call is connected. */
  enabled: boolean;
}

/**
 * Periodically captures a small video frame (JPEG, 320×240) and/or short audio
 * clip from the local stream and submits it to the AI moderation pipeline.
 *
 * Privacy: samples are sent to the server, classified, and DROPPED — the only
 * thing persisted in the DB is the verdict (category, score, label) and a
 * fingerprint (had_image / had_audio / timestamp). No raw frames stored.
 *
 * Sender = self. If the AI flags YOUR mic/cam for abuse, you get the strike.
 * (Peer's stream isn't directly accessible without a server-side SFU.)
 */
export function ModerationSampler({
  stream,
  kind,
  selfUserId,
  callLogId,
  intervalMs = 45_000,
  enabled,
}: ModerationSamplerProps) {
  const submit = useServerFn(submitMediaSample);
  const busyRef = useRef(false);
  const tickRef = useRef(0);

  useEffect(() => {
    if (!enabled || !stream) return;

    async function captureFrame(): Promise<string | null> {
      try {
        const videoTrack = stream!.getVideoTracks()[0];
        if (!videoTrack || videoTrack.readyState !== "live") return null;
        // ImageCapture has the broadest support for one-shot frame grabs.
        // Fallback: draw a hidden <video> to canvas.
        // @ts-ignore - ImageCapture types
        const IC = (window as any).ImageCapture;
        let bitmap: ImageBitmap | null = null;
        if (IC) {
          try {
            const cap = new IC(videoTrack);
            bitmap = await cap.grabFrame();
          } catch { /* fall through */ }
        }
        const w = 320, h = 240;
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return null;
        if (bitmap) {
          ctx.drawImage(bitmap, 0, 0, w, h);
        } else {
          // Fallback path: attach to a temporary <video>
          const v = document.createElement("video");
          v.muted = true; v.playsInline = true;
          v.srcObject = new MediaStream([videoTrack]);
          await v.play().catch(() => {});
          await new Promise((r) => setTimeout(r, 200));
          ctx.drawImage(v, 0, 0, w, h);
          v.srcObject = null;
        }
        return canvas.toDataURL("image/jpeg", 0.6);
      } catch {
        return null;
      }
    }

    async function captureAudio(): Promise<string | null> {
      try {
        const audioTrack = stream!.getAudioTracks()[0];
        if (!audioTrack || audioTrack.readyState !== "live") return null;
        const audioStream = new MediaStream([audioTrack]);
        const rec = new MediaRecorder(audioStream, { mimeType: "audio/webm" });
        const chunks: Blob[] = [];
        rec.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
        const done = new Promise<Blob>((resolve) => { rec.onstop = () => resolve(new Blob(chunks, { type: "audio/webm" })); });
        rec.start();
        await new Promise((r) => setTimeout(r, 4000)); // 4s clip
        rec.stop();
        const blob = await done;
        if (blob.size === 0 || blob.size > 1_500_000) return null;
        return await new Promise<string>((resolve) => {
          const r = new FileReader();
          r.onloadend = () => resolve(String(r.result ?? ""));
          r.readAsDataURL(blob);
        });
      } catch {
        return null;
      }
    }

    async function tick() {
      if (busyRef.current) return;
      busyRef.current = true;
      try {
        tickRef.current += 1;
        // Alternate: odd ticks → video frame (if video call), even → audio.
        // Voice calls always sample audio.
        const wantVideo = kind === "video" && tickRef.current % 2 === 1;
        const [dataUrl, audioDataUrl] = await Promise.all([
          wantVideo ? captureFrame() : Promise.resolve(null),
          !wantVideo ? captureAudio() : Promise.resolve(null),
        ]);
        if (!dataUrl && !audioDataUrl) return;

        const res = await submit({
          data: {
            kind: wantVideo ? "video" : "voice",
            targetUserId: selfUserId,
            callLogId,
            dataUrl,
            audioDataUrl,
          },
        });
        // If WE got auto-flagged at severity 5, warn the user before the auto-ban hits.
        if ("event" in res && res.event && res.event.severity === 5) {
          toast.warning("Safety system detected a policy violation. Repeated incidents will suspend your account.", {
            duration: 8000,
          });
        }
      } catch { /* silent — never break the call */ }
      finally { busyRef.current = false; }
    }

    // First sample after 20s to avoid the connect spike, then every intervalMs.
    const first = window.setTimeout(tick, 20_000);
    const i = window.setInterval(tick, intervalMs);
    return () => { window.clearTimeout(first); window.clearInterval(i); };
  }, [enabled, stream, kind, selfUserId, callLogId, intervalMs, submit]);

  return null;
}
