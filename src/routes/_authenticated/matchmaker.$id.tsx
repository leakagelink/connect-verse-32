import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getMatchmakerRoom,
  joinAsCandidate,
  leaveCandidate,
  castVote,
  endMatchmakerRoom,
  matchmakerHeartbeat,
} from "@/lib/matchmaker.functions";
import { issueAgoraToken } from "@/lib/calling.functions";
import { getMyProfile } from "@/lib/onboarding.functions";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Crown, Mic, MicOff, Users, Heart, LogOut, Trophy } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/matchmaker/$id")({
  component: MatchmakerRoomPage,
});

function MatchmakerRoomPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const getRoom = useServerFn(getMatchmakerRoom);
  const join = useServerFn(joinAsCandidate);
  const leave = useServerFn(leaveCandidate);
  const vote = useServerFn(castVote);
  const endRoom = useServerFn(endMatchmakerRoom);
  const heartbeat = useServerFn(matchmakerHeartbeat);
  const tokenFn = useServerFn(issueAgoraToken);
  const profileFn = useServerFn(getMyProfile);

  const { data: me } = useQuery({ queryKey: ["me"], queryFn: () => profileFn() });
  const { data, refetch } = useQuery({
    queryKey: ["mm-room", id],
    queryFn: () => getRoom({ data: { roomId: id } }),
    refetchInterval: 5_000,
  });

  const [agoraJoined, setAgoraJoined] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const sessionRef = useRef<any>(null);

  // Audio Agora session — host & candidates publish; listeners subscribe only.
  useEffect(() => {
    if (!data || agoraJoined) return;
    const room = data.room;
    if (room.status !== "live") return;
    const isPublisher = data.isHost || !!data.iAmCandidate;
    let cancelled = false;

    (async () => {
      try {
        const t = await tokenFn({
          data: { channel: room.agora_channel, role: isPublisher ? "publisher" : "subscriber" },
        });
        const AgoraRTC = (await import("agora-rtc-sdk-ng")).default;
        AgoraRTC.setLogLevel(3);
        const client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
        client.on("user-published", async (user, mediaType) => {
          if (mediaType !== "audio") return;
          await client.subscribe(user, mediaType);
          user.audioTrack?.play();
        });
        await client.join(t.appId, t.channel, t.token, t.account);

        let micTrack: any = null;
        if (isPublisher) {
          micTrack = await AgoraRTC.createMicrophoneAudioTrack();
          await client.publish(micTrack);
        }
        if (cancelled) {
          micTrack?.stop(); micTrack?.close();
          await client.leave();
          return;
        }
        sessionRef.current = { client, micTrack };
        setAgoraJoined(true);
      } catch (e: any) {
        toast.error("Audio join failed: " + e.message);
      }
    })();

    return () => {
      cancelled = true;
      const s = sessionRef.current;
      if (s) {
        try { s.micTrack?.stop(); s.micTrack?.close(); s.client.leave(); } catch {}
        sessionRef.current = null;
      }
      setAgoraJoined(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.room.id, data?.room.status, data?.isHost, !!data?.iAmCandidate]);

  // Listener heartbeat
  useEffect(() => {
    if (!data || data.room.status !== "live") return;
    const tick = () => heartbeat({ data: { roomId: id, listenerCount: (data.room.listener_count ?? 0) } }).catch(() => {});
    const i = setInterval(tick, 20_000);
    return () => clearInterval(i);
  }, [data?.room.status, id, heartbeat, data]);

  async function toggleMic() {
    const s = sessionRef.current;
    if (!s?.micTrack) return;
    await s.micTrack.setEnabled(!micOn);
    setMicOn(!micOn);
  }

  async function takeSeat(seat: 1 | 2) {
    try {
      await join({ data: { roomId: id, seat } });
      toast.success("You're on stage! Good luck 💪");
      qc.invalidateQueries({ queryKey: ["mm-room", id] });
    } catch (e: any) { toast.error(e.message); }
  }

  async function leaveSeat() {
    try {
      await leave({ data: { roomId: id } });
      qc.invalidateQueries({ queryKey: ["mm-room", id] });
    } catch (e: any) { toast.error(e.message); }
  }

  async function doVote(candidateId: string) {
    try {
      const r = await vote({ data: { roomId: id, candidateId } });
      if (r.action === "noop") toast.info("Already your pick");
      else if (r.action === "changed") toast.success("Vote changed");
      else toast.success("Vote cast 💖");
      qc.invalidateQueries({ queryKey: ["mm-room", id] });
    } catch (e: any) { toast.error(e.message); }
  }

  async function doEnd() {
    try {
      const r = await endRoom({ data: { roomId: id } });
      toast.success(r.winnerId ? "Room ended — winner announced!" : "Room ended");
      refetch();
    } catch (e: any) { toast.error(e.message); }
  }

  if (!data) {
    return <AppShell><p className="text-center text-muted-foreground py-12">Loading room…</p></AppShell>;
  }

  const room = data.room;
  const host = data.host;
  const seat1 = data.candidates.find((c: any) => c.seat === 1);
  const seat2 = data.candidates.find((c: any) => c.seat === 2);
  const isFemale = me?.profile?.gender === "female";
  const isMale = me?.profile?.gender === "male";
  const canBeCandidate = isMale && !data.isHost && !data.iAmCandidate && room.status === "live";

  return (
    <AppShell>
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Crown className="size-5 text-amber-400" />
            <h1 className="text-lg font-bold">Matchmaker</h1>
            {room.status === "live" ? (
              <Badge className="bg-rose-500 text-white border-0">LIVE</Badge>
            ) : (
              <Badge variant="secondary">ENDED</Badge>
            )}
          </div>
          <Badge variant="secondary" className="gap-1"><Users className="size-3" />{room.listener_count}</Badge>
        </div>

        <Card className="glass p-4 mb-4">
          <p className="text-sm font-semibold">{room.title}</p>
          {room.topic && <p className="text-xs text-muted-foreground">{room.topic}</p>}
        </Card>

        {/* Host */}
        <div className="flex flex-col items-center mb-4">
          <div className="relative">
            <Avatar className="size-24 ring-4 ring-rose-500/50">
              {host?.avatar_url && <AvatarImage src={host.avatar_url} />}
              <AvatarFallback className="brand-gradient text-primary-foreground text-2xl font-bold">
                {(host?.username ?? "?").slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <Badge className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-amber-500 text-black border-0 text-[10px] gap-0.5">
              <Crown className="size-2.5" /> HOST
            </Badge>
          </div>
          <p className="text-sm font-semibold mt-3">@{host?.username ?? "anon"}</p>
        </div>

        {/* Candidate seats */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          {[seat1, seat2].map((c, idx) => {
            const seatNum = (idx + 1) as 1 | 2;
            const voted = data.myVote?.candidate_id === c?.id;
            return (
              <Card key={seatNum} className={`glass p-3 text-center ${voted ? "border-rose-500" : ""}`}>
                {c ? (
                  <>
                    <Avatar className="size-16 mx-auto ring-2 ring-primary/40">
                      {c.profile?.avatar_url && <AvatarImage src={c.profile.avatar_url} />}
                      <AvatarFallback className="brand-gradient text-primary-foreground font-bold">
                        {(c.profile?.username ?? "?").slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <p className="text-xs font-semibold truncate mt-2">@{c.profile?.username ?? "anon"}</p>
                    <div className="flex items-center justify-center gap-1 mt-1">
                      <Heart className="size-3 text-rose-400" fill="currentColor" />
                      <span className="text-xs font-bold tabular-nums">{c.vote_score + c.gift_score}</span>
                    </div>
                    {room.status === "live" && !data.isHost && !data.iAmCandidate && (
                      <Button
                        size="sm"
                        variant={voted ? "default" : "outline"}
                        className={`mt-2 w-full h-7 text-[11px] ${voted ? "bg-rose-500 hover:bg-rose-600" : ""}`}
                        onClick={() => doVote(c.id)}
                      >
                        {voted ? "Your Pick" : "Vote"}
                      </Button>
                    )}
                    {data.iAmCandidate?.id === c.id && (
                      <Button size="sm" variant="outline" className="mt-2 w-full h-7 text-[11px]" onClick={leaveSeat}>
                        Leave Seat
                      </Button>
                    )}
                  </>
                ) : (
                  <>
                    <div className="size-16 mx-auto rounded-full border-2 border-dashed border-muted flex items-center justify-center">
                      <span className="text-2xl font-bold text-muted-foreground">{seatNum}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">Empty Seat</p>
                    {canBeCandidate && (
                      <Button size="sm" className="mt-2 w-full h-7 text-[11px] brand-gradient" onClick={() => takeSeat(seatNum)}>
                        Take Seat
                      </Button>
                    )}
                  </>
                )}
              </Card>
            );
          })}
        </div>

        {isFemale && !data.isHost && room.status === "live" && (
          <Card className="glass p-3 mb-3 text-center text-xs text-muted-foreground">
            Female users can listen & host — only male users compete as candidates.
          </Card>
        )}

        {/* Controls */}
        <div className="flex gap-2">
          {(data.isHost || data.iAmCandidate) && agoraJoined && (
            <Button variant={micOn ? "default" : "destructive"} size="sm" onClick={toggleMic} className="flex-1">
              {micOn ? <Mic className="size-4 mr-1" /> : <MicOff className="size-4 mr-1" />}
              {micOn ? "Mic On" : "Muted"}
            </Button>
          )}
          {data.isHost && room.status === "live" && (
            <Button variant="destructive" size="sm" onClick={() => setShowEndConfirm(true)} className="flex-1">
              <Trophy className="size-4 mr-1" /> End & Crown Winner
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => navigate({ to: "/home" })}>
            <LogOut className="size-4" />
          </Button>
        </div>

        {room.status === "ended" && room.winner_user_id && (
          <Card className="glass mt-4 p-4 text-center border-amber-500/40">
            <Trophy className="size-8 mx-auto text-amber-400" />
            <p className="text-sm font-semibold mt-2">Winner crowned!</p>
            <p className="text-xs text-muted-foreground">@{
              data.candidates.find((c: any) => c.user_id === room.winner_user_id)?.profile?.username ?? "—"
            } wins a private call with the host.</p>
          </Card>
        )}
      </div>

      <AlertDialog open={showEndConfirm} onOpenChange={setShowEndConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>End the room?</AlertDialogTitle>
            <AlertDialogDescription>
              The candidate with the most votes + gifts wins. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={doEnd}>End Room</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
