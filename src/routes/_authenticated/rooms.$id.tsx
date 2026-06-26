import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getRoom, joinRoom, leaveRoom } from "@/lib/rooms.functions";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { LogOut, Mic, Video, Gamepad2, Radio } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/rooms/$id")({
  component: RoomDetail,
});

function RoomDetail() {
  const { id } = useParams({ from: "/_authenticated/rooms/$id" });
  const navigate = useNavigate();
  const fetchRoom = useServerFn(getRoom);
  const join = useServerFn(joinRoom);
  const leave = useServerFn(leaveRoom);

  const { data, refetch, isLoading } = useQuery({
    queryKey: ["room", id],
    queryFn: () => fetchRoom({ data: { roomId: id } }),
    refetchInterval: 10_000,
  });

  useEffect(() => {
    join({ data: { roomId: id } }).then(() => refetch()).catch((e) => toast.error(e.message));
  }, [id, join, refetch]);

  async function exit() {
    await leave({ data: { roomId: id } }).catch(() => {});
    navigate({ to: "/home" });
  }

  if (isLoading || !data) {
    return <AppShell><div className="text-center text-muted-foreground py-12">Joining room…</div></AppShell>;
  }
  const { room, participants } = data;
  const Icon = room.kind === "video" ? Video : room.kind === "game" ? Gamepad2 : room.kind === "live" ? Radio : Mic;

  return (
    <AppShell>
      <Card className="glass p-5 mb-4">
        <div className="flex items-start gap-3">
          <div className="size-12 rounded-xl brand-gradient flex items-center justify-center">
            <Icon className="size-6 text-primary-foreground" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold">{room.title}</h1>
              <Badge variant="secondary" className="text-[10px] uppercase">{room.kind}</Badge>
            </div>
            {room.topic && <p className="text-sm text-muted-foreground mt-1">{room.topic}</p>}
            <p className="text-xs text-muted-foreground mt-2">{participants.length}/{room.max_seats} seats</p>
          </div>
          <Button size="sm" variant="destructive" onClick={exit}>
            <LogOut className="size-4 mr-1" /> Leave
          </Button>
        </div>
      </Card>

      <h2 className="text-sm font-semibold text-muted-foreground mb-2">In the room</h2>
      <div className="grid gap-3 grid-cols-3 sm:grid-cols-4">
        {participants.map((p: any) => (
          <div key={p.id} className="flex flex-col items-center gap-1">
            <Avatar className="size-16">
              <AvatarFallback className="brand-gradient text-primary-foreground font-semibold">
                {(p.username ?? "?").slice(0,2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <p className="text-xs truncate max-w-full">@{p.username ?? "anon"}</p>
          </div>
        ))}
      </div>

      <p className="mt-6 text-center text-[11px] text-muted-foreground">
        Live audio/video streaming requires a media SDK (Agora / LiveKit) — UI & presence are wired; plug the SDK to enable mics & cams.
      </p>
    </AppShell>
  );
}
