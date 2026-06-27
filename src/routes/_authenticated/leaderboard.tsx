import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getCreatorLeaderboard } from "@/lib/engagement.functions";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Trophy, Crown, Medal, Gift } from "lucide-react";

export const Route = createFileRoute("/_authenticated/leaderboard")({
  component: LeaderboardPage,
});

function LeaderboardPage() {
  const fn = useServerFn(getCreatorLeaderboard);
  const { data, isLoading } = useQuery({
    queryKey: ["creator-leaderboard"],
    queryFn: () => fn(),
    refetchInterval: 60_000,
  });

  return (
    <AppShell>
      <div className="mb-4 flex items-center gap-2">
        <Trophy className="size-6 text-coin" />
        <div>
          <h1 className="text-2xl font-bold">Top Creators</h1>
          <p className="text-sm text-muted-foreground">Most gifted creators · last 7 days</p>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center text-muted-foreground py-12">Loading…</div>
      ) : !data?.length ? (
        <Card className="glass p-8 text-center text-muted-foreground">
          No gifts sent yet this week. Be the first to support a creator!
        </Card>
      ) : (
        <div className="space-y-2">
          {data.map((u, i) => (
            <Card
              key={u.user_id}
              className={`p-3 flex items-center gap-3 ${
                i === 0 ? "border-coin/50 bg-coin/5" : "glass"
              }`}
            >
              <RankBadge rank={i + 1} />
              <Avatar className="size-11">
                {u.avatar_url && <AvatarImage src={u.avatar_url} />}
                <AvatarFallback className="brand-gradient text-primary-foreground font-semibold">
                  {(u.username ?? "?").slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold truncate">{u.username ?? "anon"}</p>
                  {u.is_creator && (
                    <Badge variant="secondary" className="text-[10px]">Creator</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {[u.country, u.language].filter(Boolean).join(" · ") || "—"}
                </p>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-1 justify-end text-coin font-bold">
                  <Gift className="size-3.5" />
                  {(u.coins_received ?? 0).toLocaleString("en-IN")}
                </div>
                <p className="text-[10px] text-muted-foreground">
                  {u.gifts_count ?? 0} gift{(u.gifts_count ?? 0) === 1 ? "" : "s"}
                </p>
              </div>
            </Card>
          ))}
        </div>
      )}
    </AppShell>
  );
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1)
    return (
      <div className="size-9 rounded-full bg-coin/20 flex items-center justify-center">
        <Crown className="size-5 text-coin" />
      </div>
    );
  if (rank === 2)
    return (
      <div className="size-9 rounded-full bg-muted flex items-center justify-center">
        <Medal className="size-5 text-muted-foreground" />
      </div>
    );
  if (rank === 3)
    return (
      <div className="size-9 rounded-full bg-amber-500/15 flex items-center justify-center">
        <Medal className="size-5 text-amber-600" />
      </div>
    );
  return (
    <div className="size-9 rounded-full bg-muted/50 flex items-center justify-center font-bold text-sm text-muted-foreground">
      {rank}
    </div>
  );
}
