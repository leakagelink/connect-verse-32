import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listLiveMatchmakerRooms } from "@/lib/matchmaker.functions";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Crown, Users, Plus } from "lucide-react";

export function MatchmakerRoomsSection({ canHost }: { canHost: boolean }) {
  const list = useServerFn(listLiveMatchmakerRooms);
  const { data: rooms, isLoading } = useQuery({
    queryKey: ["mm-rooms"],
    queryFn: () => list(),
    refetchInterval: 15_000,
  });

  return (
    <div className="mb-5">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Crown className="size-4 text-amber-400" />
          <h2 className="text-sm font-semibold uppercase tracking-wider">Matchmaker Rooms</h2>
          <span className="size-1.5 rounded-full bg-rose-500 animate-pulse" />
        </div>
        {canHost && (
          <Link
            to="/matchmaker/new"
            className="text-xs text-primary font-medium flex items-center gap-1"
          >
            <Plus className="size-3.5" /> Host
          </Link>
        )}
      </div>

      {isLoading ? (
        <Card className="glass p-6 text-center text-sm text-muted-foreground">Loading…</Card>
      ) : !rooms?.length ? (
        <Card className="glass p-6 text-center text-sm text-muted-foreground">
          No live matchmaker rooms right now.
          {canHost && " Be the first to host!"}
        </Card>
      ) : (
        <div
          className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 snap-x snap-mandatory"
          style={{ scrollbarWidth: "none" }}
        >
          {rooms.map((r: any) => (
            <Link
              key={r.id}
              to="/matchmaker/$id"
              params={{ id: r.id }}
              className="snap-start"
            >
              <Card className="glass relative min-w-[240px] max-w-[240px] overflow-hidden border-rose-500/20 hover:border-rose-500/60 transition">
                <div className="relative h-[110px] bg-gradient-to-br from-rose-500/30 via-fuchsia-500/20 to-amber-500/20">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Avatar className="size-16 ring-4 ring-rose-500/40">
                      {r.host?.avatar_url && <AvatarImage src={r.host.avatar_url} />}
                      <AvatarFallback className="brand-gradient text-primary-foreground font-bold">
                        {(r.host?.username ?? "?").slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                  <Badge className="absolute top-2 left-2 bg-rose-500 text-white border-0 text-[9px]">
                    LIVE
                  </Badge>
                  <Badge className="absolute top-2 right-2 bg-black/60 text-white border-0 text-[10px] gap-0.5">
                    <Users className="size-2.5" /> {r.listener_count}
                  </Badge>
                </div>
                <div className="p-3">
                  <p className="text-sm font-semibold truncate">{r.title}</p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    @{r.host?.username ?? "anon"} ·{" "}
                    {r.candidate_count}/2 candidates
                  </p>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
