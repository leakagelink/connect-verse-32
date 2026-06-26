import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Mic, MicOff, Video as VideoIcon, VideoOff, PhoneOff, Coins, Search } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { toast } from "sonner";
import { VOICE_CALL_COINS_PER_MINUTE, VIDEO_CALL_COINS_PER_MINUTE } from "@/lib/constants";
import { startCallLog, endCallLog } from "@/lib/calls.functions";
import { generateMysteryCase, CASE_GENERATION_COIN_COST } from "@/lib/mystery.functions";
import { getMyProfile } from "@/lib/onboarding.functions";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MysteryPanel } from "@/components/mystery-panel";
import { supabase } from "@/integrations/supabase/client";



export const Route = createFileRoute("/_authenticated/call/$kind/$userId")({
  component: CallScreen,
});

function CallScreen() {
  const { kind, userId } = useParams({ from: "/_authenticated/call/$kind/$userId" });
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const endedRef = useRef(false);
  const callLogIdRef = useRef<string | null>(null);
  const elapsedRef = useRef(0);
  const [muted, setMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [connected, setConnected] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [lowBalanceOpen, setLowBalanceOpen] = useState(false);


  const perMin = kind === "video" ? VIDEO_CALL_COINS_PER_MINUTE : VOICE_CALL_COINS_PER_MINUTE;
  const startLogFn = useServerFn(startCallLog);
  const endLogFn = useServerFn(endCallLog);
  const generateCaseFn = useServerFn(generateMysteryCase);
  const profileFn = useServerFn(getMyProfile);
  const qc = useQueryClient();
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: () => profileFn() });
  const isMale = me?.profile?.gender === "male";
  const myId = me?.profile?.id ?? "";
  const [caseId, setCaseId] = useState<string | null>(null);
  const [casePanelOpen, setCasePanelOpen] = useState(false);
  const [generating, setGenerating] = useState(false);

  // Realtime: share generated case_id between caller & callee using a deterministic channel
  useEffect(() => {
    if (!myId) return;
    const pair = [myId, userId].sort().join(":");
    const channel = supabase.channel(`mystery:${pair}`, { config: { broadcast: { self: false } } });
    channel
      .on("broadcast", { event: "new_case" }, (payload) => {
        const id = (payload.payload as any)?.caseId as string | undefined;
        if (id) {
          setCaseId(id);
          setCasePanelOpen(true);
          toast.info("Your partner started a mystery case!");
        }
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [myId, userId]);

  const myBalance = me?.walletBalance ?? 0;
  const canAfford = myBalance >= CASE_GENERATION_COIN_COST;

  async function hostMysteryCase() {
    if (!isMale) {
      toast.error("Only male players can host a mystery case.");
      return;
    }
    if (!canAfford) {
      setLowBalanceOpen(true);
      return;
    }
    setGenerating(true);
    try {
      const res = await generateCaseFn({
        data: { partnerId: userId, callLogId: callLogIdRef.current ?? undefined },
      });
      setCaseId(res.id);
      setCasePanelOpen(true);
      qc.invalidateQueries({ queryKey: ["me"] });
      qc.invalidateQueries({ queryKey: ["wallet"] });
      const pair = [myId, userId].sort().join(":");
      await supabase.channel(`mystery:${pair}`).send({
        type: "broadcast",
        event: "new_case",
        payload: { caseId: res.id },
      });
      toast.success(`Case generated! -${CASE_GENERATION_COIN_COST} coins`);
    } catch (e: any) {
      const msg = String(e?.message ?? "");
      if (/insufficient|not enough|balance/i.test(msg)) {
        setLowBalanceOpen(true);
      } else {
        toast.error(msg || "Could not generate case");
      }
    } finally {
      setGenerating(false);
    }
  }


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
        setTimeout(async () => {
          if (!mounted) return;
          setConnected(true);
          try {
            const res = await startLogFn({ data: { calleeId: userId, kind: kind as "voice" | "video" } });
            callLogIdRef.current = res.id;
          } catch { /* ignore log start failure */ }
        }, 1200);

      } catch (e: any) {
        toast.error("Could not access camera / mic: " + e.message);
        navigate({ to: "/connect" });
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
    const i = setInterval(() => {
      setElapsed((e) => {
        const next = e + 1;
        elapsedRef.current = next;
        return next;
      });
    }, 1000);
    return () => clearInterval(i);
  }, [connected]);


  // Block back navigation while on the call screen — show confirm dialog instead.
  useEffect(() => {
    window.history.pushState({ inCall: true }, "");
    const onPop = () => {
      if (endedRef.current) return;
      // re-push so we stay on this screen
      window.history.pushState({ inCall: true }, "");
      setConfirmEnd(true);
    };
    window.addEventListener("popstate", onPop);
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (endedRef.current) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("popstate", onPop);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, []);

  function toggleMic() {
    const t = streamRef.current?.getAudioTracks()[0];
    if (t) { t.enabled = !t.enabled; setMuted(!t.enabled); }
  }
  function toggleCam() {
    const t = streamRef.current?.getVideoTracks()[0];
    if (t) { t.enabled = !t.enabled; setCamOff(!t.enabled); }
  }
  function confirmEndCall() {
    endedRef.current = true;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    setConfirmEnd(false);
    const id = callLogIdRef.current;
    const seconds = elapsedRef.current;
    const minutes = Math.max(1, Math.ceil(seconds / 60));
    const coins = seconds > 0 ? minutes * perMin : 0;
    if (id) {
      endLogFn({
        data: {
          id,
          durationSeconds: seconds,
          coinsSpent: coins,
          status: seconds > 0 ? "completed" : "cancelled",
        },
      }).catch(() => {});
    }
    navigate({ to: "/recents" });
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
            <div className="px-2.5 py-1 rounded-full bg-coin/80 text-xs font-semibold flex items-center gap-1">
              <Coins className="size-3" /> {perMin} / min
            </div>
          </div>
          <div className="absolute bottom-3 left-3 px-2.5 py-1 rounded-full bg-black/50 text-[11px] text-white">
            to {userId.slice(0, 8)}
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
          <Button size="icon" variant="destructive" onClick={() => setConfirmEnd(true)}>
            <PhoneOff className="size-5" />
          </Button>
        </div>

        {/* Mystery game controls */}
        <div className="px-4 pb-3">
          {isMale ? (
            <>
              <Button
                variant="secondary"
                className="w-full gap-2"
                disabled={generating || !connected}
                onClick={hostMysteryCase}
              >
                <Search className="size-4" />
                {generating
                  ? "Generating case…"
                  : caseId
                  ? "Open mystery case"
                  : canAfford
                  ? `Host Mystery Case · ${CASE_GENERATION_COIN_COST} coins`
                  : `Low balance · need ${CASE_GENERATION_COIN_COST} coins`}
              </Button>
              {!caseId && (
                <p
                  className={`mt-1 text-center text-[11px] ${
                    canAfford ? "text-muted-foreground" : "text-destructive"
                  }`}
                >
                  <Coins className="inline size-3 -mt-0.5 mr-1" />
                  Your balance: {myBalance} coins
                  {!canAfford && (
                    <>
                      {" · "}
                      <button
                        type="button"
                        className="underline font-medium"
                        onClick={() => setLowBalanceOpen(true)}
                      >
                        Recharge
                      </button>
                    </>
                  )}
                </p>
              )}
            </>
          ) : caseId ? (
            <Button variant="secondary" className="w-full gap-2" onClick={() => setCasePanelOpen(true)}>
              <Search className="size-4" /> Open mystery case
            </Button>
          ) : (
            <p className="text-[11px] text-center text-muted-foreground">
              Your partner can host a Mystery Case · free for you to play 🕵️
            </p>
          )}
          {caseId && isMale && !casePanelOpen && (
            <button
              className="mt-1 w-full text-[11px] text-primary hover:underline"
              onClick={() => setCasePanelOpen(true)}
            >
              Re-open current case
            </button>
          )}
        </div>


        <p className="px-4 pb-4 text-center text-[11px] text-muted-foreground">
          Coins are deducted per minute. The back button is disabled during a call — tap the red button to end.
        </p>
      </Card>

      <MysteryPanel caseId={caseId} open={casePanelOpen} onOpenChange={setCasePanelOpen} />


      <AlertDialog open={confirmEnd} onOpenChange={setConfirmEnd}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>End this call?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to disconnect? You will be charged for {Math.max(1, Math.ceil(elapsed / 60))} minute(s)
              at {perMin} coins/min.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Stay on call</AlertDialogCancel>
            <AlertDialogAction onClick={confirmEndCall} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Yes, end call
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={lowBalanceOpen} onOpenChange={setLowBalanceOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Coins className="size-5 text-coin" />
              Not enough coins
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  Hosting a Mystery Case costs{" "}
                  <span className="font-semibold text-foreground">{CASE_GENERATION_COIN_COST} coins</span>,
                  but your wallet has only{" "}
                  <span className="font-semibold text-foreground">{myBalance} coins</span>.
                </p>
                <div className="rounded-lg border bg-muted/40 p-3 text-xs">
                  You need <span className="font-semibold">{Math.max(0, CASE_GENERATION_COIN_COST - myBalance)} more coins</span>.
                  To recharge, please end the call first — the back button is locked during an active call to protect both players.
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep playing</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setLowBalanceOpen(false);
                setConfirmEnd(true);
              }}
            >
              End call & recharge
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>

  );
}
