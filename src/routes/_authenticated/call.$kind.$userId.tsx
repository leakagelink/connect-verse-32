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
import { startCallLog, endCallLog, applyCallUsage } from "@/lib/calls.functions";
import { generateMysteryCase, CASE_GENERATION_COIN_COST } from "@/lib/mystery.functions";
import { getMyProfile } from "@/lib/onboarding.functions";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MysteryPanel } from "@/components/mystery-panel";
import { InCallRecharge } from "@/components/in-call-recharge";
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
  const [rechargeOpen, setRechargeOpen] = useState(false);
  // Snapshots of free seconds + coin balance captured when the call connects.
  // Used to live-display remaining free time / coin time during the call.
  const [freeStart, setFreeStart] = useState<number | null>(null);
  const [coinStart, setCoinStart] = useState<number | null>(null);
  const outOfFundsTriggeredRef = useRef(false);
  // Single-active-session enforcement: every mount mints a unique token and
  // writes it into the active_call localStorage slot. A newer tab claiming
  // ownership overwrites the token; older tabs notice via the `storage` event
  // and pause (no usage flushes, no elapsed counter, no recharge prompts).
  const sessionTokenRef = useRef<string>(
    (typeof globalThis !== "undefined" && globalThis.crypto?.randomUUID?.()) ||
      `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  const pausedRef = useRef(false);
  const [paused, setPaused] = useState(false);



  const perMin = kind === "video" ? VIDEO_CALL_COINS_PER_MINUTE : VOICE_CALL_COINS_PER_MINUTE;
  const startLogFn = useServerFn(startCallLog);
  const endLogFn = useServerFn(endCallLog);
  const applyUsageFn = useServerFn(applyCallUsage);
  // Tracks how much we've already persisted to the server (server is the
  // source of truth across refresh / reconnect).
  const syncedFreeRef = useRef(0);
  const syncedCoinsRef = useRef(0);
  // Baseline elapsed seconds already recorded on the call_log from prior
  // sessions of the same call (after a reconnect / refresh). The wall-clock
  // total we report to the server is this baseline + the current session's
  // elapsed counter.
  const sessionStartElapsedRef = useRef(0);
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
          // Snapshot the free seconds + coin balance at connect time so the
          // live counter shows exactly what the user has to spend.
          setFreeStart(me?.profile?.free_seconds_remaining ?? 0);
          setCoinStart(me?.walletBalance ?? 0);
          try {
            const resumeKey = `active_call:${userId}:${kind}`;
            let resumeId: string | null = null;
            try {
              const raw = localStorage.getItem(resumeKey);
              if (raw) {
                const parsed = JSON.parse(raw);
                if (
                  parsed?.id &&
                  parsed?.lastFlushedAt &&
                  Date.now() - new Date(parsed.lastFlushedAt).getTime() < 5 * 60 * 1000
                ) {
                  resumeId = parsed.id as string;
                }
              }
            } catch { /* ignore */ }

            const res = await startLogFn({
              data: { calleeId: userId, kind: kind as "voice" | "video", resumeId },
            });
            callLogIdRef.current = res.id;
            syncedFreeRef.current = res.baselineFreeSecondsUsed ?? 0;
            syncedCoinsRef.current = res.baselineCoinsSpent ?? 0;
            sessionStartElapsedRef.current = res.baselineDurationSeconds ?? 0;
            try {
              localStorage.setItem(
                resumeKey,
                JSON.stringify({ id: res.id, lastFlushedAt: new Date().toISOString() }),
              );
            } catch { /* ignore */ }
            // Authoritative re-sync: pull the latest profile so the free
            // countdown + "Free minutes used" label reflect what the server
            // actually has (after any prior session's flushes).
            try {
              const fresh = await profileFn();
              if (mounted && fresh?.profile) {
                qc.setQueryData(["me"], fresh);
                setFreeStart(fresh.profile.free_seconds_remaining ?? 0);
                setCoinStart(fresh.walletBalance ?? 0);
                // This session's elapsed restarts at 0; baseline already
                // accounts for whatever the previous session burned.
                elapsedRef.current = 0;
                setElapsed(0);
                freeExhaustedRef.current =
                  (fresh.profile.free_seconds_remaining ?? 0) === 0;
              }
            } catch { /* ignore profile refresh failure */ }
            if (res.resumed) {
              toast.info("Reconnected to your previous call — no duplicate charges.");
            }
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

  // ---- Live billing ledger (free seconds first, then coins) ----
  const freeAvail = freeStart ?? 0;
  const coinsAvail = coinStart ?? 0;
  const freeUsed = Math.min(freeAvail, elapsed);
  const freeLeftSec = Math.max(0, freeAvail - freeUsed);
  const coinSecondsUsed = Math.max(0, elapsed - freeAvail);
  const coinsConsumed = Math.ceil((coinSecondsUsed * perMin) / 60);
  const coinsLeft = Math.max(0, coinsAvail - coinsConsumed);
  // Seconds the remaining coin balance can still buy after free time ends.
  const coinSecondsLeft = Math.floor((coinsLeft * 60) / perMin);
  const totalSecondsLeft = freeLeftSec + coinSecondsLeft;
  const usingFree = freeLeftSec > 0;
  const outOfFunds = connected && totalSecondsLeft <= 0;

  // Seed live ledger snapshots the moment the profile is available — so the
  // "5:00 free" countdown is visible from the very start of the call screen.
  useEffect(() => {
    if (freeStart === null && me?.profile) {
      setFreeStart(me.profile.free_seconds_remaining ?? 0);
      setCoinStart(me.walletBalance ?? 0);
    }
  }, [me, freeStart]);

  // Notify the user exactly when free minutes finish and coin billing kicks in.
  const freeExhaustedRef = useRef(false);
  useEffect(() => {
    if (!connected || freeStart === null) return;
    if (freeAvail > 0 && freeLeftSec === 0 && !freeExhaustedRef.current) {
      freeExhaustedRef.current = true;
      toast.info("Free minutes finished — coins are now being used.");
    }
  }, [connected, freeStart, freeAvail, freeLeftSec]);


  // When the user runs out of free time AND can't afford the next minute,
  // auto-open the recharge sheet with all offers. Call stays connected.
  useEffect(() => {
    if (!connected) return;
    if (outOfFunds && !outOfFundsTriggeredRef.current && !rechargeOpen) {
      outOfFundsTriggeredRef.current = true;
      toast.error("You're out of free minutes & coins — recharge to keep talking.", {
        duration: 8000,
      });
      setRechargeOpen(true);
    }
  }, [connected, outOfFunds, rechargeOpen]);

  // ---- Persistence: keep server-side free_seconds_remaining and coin balance
  // in sync so the countdown / "Free minutes used" state survives refresh,
  // reconnect, accidental tab close, or app restart. -----------------------
  // Idempotency key for the in-flight flush. Reused across retries so the
  // server can dedupe duplicate attempts; cleared after a successful flush.
  const pendingFlushKeyRef = useRef<string | null>(null);
  const flushInFlightRef = useRef(false);
  const flushUsage = useRef<(opts?: { keepalive?: boolean }) => void>(() => {});
  flushUsage.current = () => {
    const callLogId = callLogIdRef.current;
    if (!callLogId) return;
    if (flushInFlightRef.current) return;
    // This-session usage so far (live counters).
    const sessionFreeUsed = Math.min(freeAvail, elapsedRef.current);
    const sessionCoinsUsed = Math.ceil(
      (Math.max(0, elapsedRef.current - freeAvail) * perMin) / 60,
    );
    const cappedSessionCoinsUsed = Math.min(coinsAvail, sessionCoinsUsed);
    const totalFree = syncedFreeRef.current + sessionFreeUsed;
    const totalCoins = syncedCoinsRef.current + cappedSessionCoinsUsed;
    const totalElapsed = sessionStartElapsedRef.current + elapsedRef.current;
    if (
      sessionFreeUsed === 0 &&
      cappedSessionCoinsUsed === 0 &&
      totalElapsed === sessionStartElapsedRef.current
    ) {
      return;
    }
    // Mint a stable idempotency key for this attempt; keep it until the
    // server confirms so any retry sends the same key and gets deduped.
    if (!pendingFlushKeyRef.current) {
      pendingFlushKeyRef.current =
        (globalThis.crypto?.randomUUID?.() ??
          `${Date.now()}-${Math.random().toString(36).slice(2)}`);
    }
    const idemKey = pendingFlushKeyRef.current;
    flushInFlightRef.current = true;
    applyUsageFn({
      data: {
        callLogId,
        idempotencyKey: idemKey,
        totalFreeSeconds: totalFree,
        totalCoins: totalCoins,
        elapsedSeconds: totalElapsed,
      },
    })
      .then(() => {
        syncedFreeRef.current = totalFree;
        syncedCoinsRef.current = totalCoins;
        sessionStartElapsedRef.current = totalElapsed;
        elapsedRef.current = 0;
        pendingFlushKeyRef.current = null;
        try {
          localStorage.setItem(
            `active_call:${userId}:${kind}`,
            JSON.stringify({ id: callLogId, lastFlushedAt: new Date().toISOString() }),
          );
        } catch { /* ignore */ }
      })
      .catch(() => { /* keep pendingFlushKeyRef so retry reuses same key */ })
      .finally(() => {
        flushInFlightRef.current = false;
      });
  };



  // Periodic flush every 10s while connected.
  useEffect(() => {
    if (!connected) return;
    const i = setInterval(() => flushUsage.current(), 10000);
    return () => clearInterval(i);
  }, [connected]);

  // Flush when the tab is hidden / about to unload so a refresh keeps state.
  useEffect(() => {
    const onHide = () => flushUsage.current();
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onHide);
    };
  }, []);

  // After mount, re-fetch the profile so any usage persisted by a previous
  // call session (before refresh) is reflected in the countdown immediately.
  useEffect(() => {
    qc.invalidateQueries({ queryKey: ["me"] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);






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
    // Flush any unsynced free seconds / coins so the final state is persisted
    // even if endCallLog races or the network blips.
    flushUsage.current();
    const id = callLogIdRef.current;
    const totalSeconds = sessionStartElapsedRef.current + elapsedRef.current;
    const totalCoins = syncedCoinsRef.current;
    if (id) {
      endLogFn({
        data: {
          id,
          durationSeconds: totalSeconds,
          coinsSpent: totalCoins,
          status: totalSeconds > 0 ? "completed" : "cancelled",
        },
      }).catch(() => {});
    }
    try { localStorage.removeItem(`active_call:${userId}:${kind}`); } catch { /* ignore */ }
    navigate({ to: "/recents" });
  }


  const totalElapsed = sessionStartElapsedRef.current + elapsed;
  const mm = String(Math.floor(totalElapsed / 60)).padStart(2, "0");
  const ss = String(totalElapsed % 60).padStart(2, "0");


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
          {/* Live free-time / coin-balance HUD — visible from call start */}
          {freeStart !== null && (
            <div className="absolute bottom-12 left-3 right-3 flex items-center justify-between gap-2 text-white">
              <div
                className={`px-2.5 py-1 rounded-full text-[11px] font-semibold backdrop-blur transition-colors ${
                  usingFree ? "bg-emerald-500/80" : "bg-black/50"
                }`}
              >
                {usingFree
                  ? `Free ${String(Math.floor(freeLeftSec / 60)).padStart(2, "0")}:${String(freeLeftSec % 60).padStart(2, "0")} left`
                  : "Free minutes used"}
              </div>
              <div
                className={`px-2.5 py-1 rounded-full text-[11px] font-semibold backdrop-blur ${
                  !usingFree && coinsLeft < perMin ? "bg-destructive/80" : "bg-black/50"
                }`}
              >
                <Coins className="inline size-3 -mt-0.5 mr-1" />
                {coinsLeft} coins · ≈{Math.floor(coinSecondsLeft / 60)}:
                {String(coinSecondsLeft % 60).padStart(2, "0")}
              </div>
            </div>
          )}

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
                  Recharge right here — your call stays connected and the Host button
                  refreshes automatically when payment completes.
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep playing</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setLowBalanceOpen(false);
                setRechargeOpen(true);
              }}
            >
              Recharge now
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <InCallRecharge
        open={rechargeOpen}
        onOpenChange={setRechargeOpen}
        // Highlight plans that at minimum cover the next minute of this call
        // (or the mystery case cost, whichever is larger).
        requiredCoins={Math.max(perMin, CASE_GENERATION_COIN_COST)}
        onRecharged={(newBalance) => {
          // Re-baseline the live ledger so the user keeps talking with the
          // newly added coins (without resetting elapsed time).
          setCoinStart(newBalance + coinsConsumed);
          outOfFundsTriggeredRef.current = false;
          qc.invalidateQueries({ queryKey: ["me"] });
          if (newBalance >= CASE_GENERATION_COIN_COST) {
            toast.success("Coins added — call continues. Tap Host Mystery Case anytime.");
          } else {
            toast.success("Coins added — call continues.");
          }
        }}
      />
    </AppShell>



  );
}
