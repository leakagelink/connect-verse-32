import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { getTrendingNow } from "@/lib/discovery.functions";
import { Flame, Gift, Radio, Sparkles } from "lucide-react";

export function TrendingNowSection() {
  const fn = useServerFn(getTrendingNow);
  const { data } = useQuery({
    queryKey: ["trending-now"],
    queryFn: () => fn(),
    refetchInterval: 3 * 60_000,
    staleTime: 2 * 60_000,
  });

  if (!data) return null;
  const { topGifted, hotRoom, newJoinersLastHour } = data;
  if (!topGifted && !hotRoom && !newJoinersLastHour) return null;

  return (
    <div className="mb-5">
      <div className="flex items-center gap-2 mb-2">
        <Flame className="size-4 text-orange-400" />
        <h2 className="text-sm font-semibold uppercase tracking-wider">Trending Now</h2>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {topGifted && (
          <Card className="glass p-3 flex items-center gap-3 border-coin/30">
            <Avatar className="size-10">
              {topGifted.avatar_url && <AvatarImage src={topGifted.avatar_url} />}
              <AvatarFallback className="brand-gradient text-primary-foreground text-xs">
                {(topGifted.username ?? "?").slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1 text-[10px] text-coin uppercase font-bold tracking-wider">
                <Gift className="size-3" /> Top Gifted 24h
              </div>
              <p className="text-sm font-semibold truncate">@{topGifted.username ?? "anon"}</p>
              <p className="text-[11px] text-muted-foreground">{topGifted.coins_received} coins</p>
            </div>
          </Card>
        )}
        {hotRoom && (
          <Link to="/matchmaker/$id" params={{ id: hotRoom.id }}>
            <Card className="glass p-3 flex items-center gap-3 border-primary/30 hover:border-primary transition h-full">
              <div className="size-10 rounded-xl bg-primary/15 flex items-center justify-center">
                <Radio className="size-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[10px] uppercase font-bold tracking-wider text-primary">
                  Hottest Room
                </div>
                <p className="text-sm font-semibold truncate">{hotRoom.title}</p>
                <p className="text-[11px] text-muted-foreground">
                  {hotRoom.listener_count ?? 0} listening · @{hotRoom.host?.username ?? "host"}
                </p>
              </div>
            </Card>
          </Link>
        )}
        {newJoinersLastHour > 0 && (
          <Link to="/new-joiners">
            <Card className="glass p-3 flex items-center gap-3 border-emerald-500/30 hover:border-emerald-500 transition h-full">
              <div className="size-10 rounded-xl bg-emerald-500/15 flex items-center justify-center">
                <Sparkles className="size-5 text-emerald-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[10px] uppercase font-bold tracking-wider text-emerald-400">
                  Joined This Hour
                </div>
                <p className="text-sm font-semibold">{newJoinersLastHour} new users</p>
                <p className="text-[11px] text-muted-foreground">Tap to say hi →</p>
              </div>
            </Card>
          </Link>
        )}
      </div>
    </div>
  );
}
