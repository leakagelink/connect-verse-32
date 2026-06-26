import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { heartbeat, listOnlineCreators } from "@/lib/presence.functions";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Phone, Video, Coins, Sparkles, Languages, MapPin, Zap } from "lucide-react";
import { VOICE_CALL_COINS_PER_MINUTE, VIDEO_CALL_COINS_PER_MINUTE } from "@/lib/constants";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/connect")({
  component: ConnectScreen,
});

function ConnectScreen() {
  const navigate = useNavigate();
  const beat = useServerFn(heartbeat);
  const creatorsFn = useServerFn(listOnlineCreators);
  const { data: creators } = useQuery({
    queryKey: ["online-creators"],
    queryFn: () => creatorsFn(),
    refetchInterval: 15_000,
  });

  useEffect(() => {
    beat().catch(() => {});
    const i = setInterval(() => beat().catch(() => {}), 30_000);
    return () => clearInterval(i);
  }, [beat]);

  const list = creators ?? [];

  function autoConnect(kind: "voice" | "video") {
    if (!list.length) {
      toast.error("No creators online right now. Try again in a moment.");
      return;
    }
    const pick = list[Math.floor(Math.random() * Math.min(list.length, 5))];
    navigate({ to: "/call/$kind/$userId", params: { kind, userId: pick.id } });
  }

  return (
    <AppShell>
      <div className="mb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="size-5 text-primary" />
          <h1 className="text-2xl font-bold">Connect</h1>
        </div>
        <p className="text-sm text-muted-foreground">Talk live with our verified creators</p>
      </div>

      {/* Quick auto-match buttons */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <button
          onClick={() => autoConnect("voice")}
          className="group relative overflow-hidden rounded-2xl p-4 text-left border border-primary/30 bg-gradient-to-br from-primary/20 via-primary/10 to-transparent hover:from-primary/30 transition"
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="size-10 rounded-xl brand-gradient flex items-center justify-center">
              <Phone className="size-5 text-primary-foreground" />
            </div>
            <div>
              <p className="font-bold">Audio Call</p>
              <p className="text-[11px] text-muted-foreground">Auto-match instantly</p>
            </div>
          </div>
          <div className="inline-flex items-center gap-1 rounded-full bg-coin/20 px-2 py-0.5 text-[11px] font-semibold text-coin">
            <Coins className="size-3" /> {VOICE_CALL_COINS_PER_MINUTE} / min
          </div>
        </button>

        <button
          onClick={() => autoConnect("video")}
          className="group relative overflow-hidden rounded-2xl p-4 text-left border border-accent/40 bg-gradient-to-br from-accent/20 via-accent/10 to-transparent hover:from-accent/30 transition"
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="size-10 rounded-xl brand-gradient flex items-center justify-center">
              <Video className="size-5 text-primary-foreground" />
            </div>
            <div>
              <p className="font-bold">Video Call</p>
              <p className="text-[11px] text-muted-foreground">Auto-match instantly</p>
            </div>
          </div>
          <div className="inline-flex items-center gap-1 rounded-full bg-coin/20 px-2 py-0.5 text-[11px] font-semibold text-coin">
            <Coins className="size-3" /> {VIDEO_CALL_COINS_PER_MINUTE} / min
          </div>
        </button>
      </div>

      {/* Sliding featured creators */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <Zap className="size-4 text-primary" />
            <h2 className="font-semibold">Featured Live</h2>
          </div>
          <span className="text-xs text-muted-foreground">{list.length} online</span>
        </div>
        <CreatorMarquee creators={list.slice(0, 12)} />
      </div>

      {/* All online creators grid */}
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-semibold">All online creators</h2>
      </div>
      {!list.length ? (
        <Card className="glass p-8 text-center text-muted-foreground">
          No creators online right now. Pull down to refresh in a few seconds.
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {list.map((u: any) => (
            <Card key={u.id} className="glass p-3 flex items-center gap-3">
              <div className="relative">
                <Avatar className="size-12">
                  {u.avatar_url && <AvatarImage src={u.avatar_url} />}
                  <AvatarFallback className="brand-gradient text-primary-foreground font-semibold">
                    {(u.username ?? "?").slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="absolute -bottom-0.5 -right-0.5 size-3.5 rounded-full bg-emerald-500 border-2 border-background" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="font-medium truncate">{u.username ?? "anon"}</p>
                  <Badge variant="secondary" className="text-[10px]">Creator</Badge>
                </div>
                <p className="text-[11px] text-muted-foreground flex items-center gap-2 truncate">
                  {u.language && <span className="inline-flex items-center gap-0.5"><Languages className="size-3" />{u.language}</span>}
                  {u.country && <span className="inline-flex items-center gap-0.5"><MapPin className="size-3" />{u.country}</span>}
                </p>
              </div>
              <div className="flex flex-col gap-1.5">
                <Link to="/call/$kind/$userId" params={{ kind: "voice", userId: u.id }}>
                  <Button size="sm" variant="secondary" className="h-7 px-2">
                    <Phone className="size-3.5" />
                  </Button>
                </Link>
                <Link to="/call/$kind/$userId" params={{ kind: "video", userId: u.id }}>
                  <Button size="sm" className="h-7 px-2 brand-gradient">
                    <Video className="size-3.5" />
                  </Button>
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}
    </AppShell>
  );
}

function CreatorMarquee({ creators }: { creators: any[] }) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const items = useMemo(() => (creators.length ? [...creators, ...creators] : []), [creators]);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (!creators.length) return;
    const el = trackRef.current;
    if (!el) return;
    let raf = 0;
    let last = performance.now();
    const speed = 28; // px / sec
    const step = (t: number) => {
      const dt = (t - last) / 1000;
      last = t;
      if (!paused) {
        el.scrollLeft += speed * dt;
        const half = el.scrollWidth / 2;
        if (el.scrollLeft >= half) el.scrollLeft -= half;
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [creators.length, paused]);

  if (!creators.length) {
    return (
      <Card className="glass p-6 text-center text-sm text-muted-foreground">
        Featured creators will appear here as soon as they come online.
      </Card>
    );
  }

  return (
    <div
      ref={trackRef}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={() => setPaused(true)}
      onTouchEnd={() => setPaused(false)}
      className="flex gap-3 overflow-x-hidden scrollbar-none"
      style={{ scrollBehavior: "auto" }}
    >
      {items.map((u, idx) => (
        <Link
          key={`${u.id}-${idx}`}
          to="/call/$kind/$userId"
          params={{ kind: "video", userId: u.id }}
          className="shrink-0 w-[140px]"
        >
          <Card className="glass p-3 text-center hover:border-primary/40 transition">
            <div className="relative mx-auto w-fit">
              <Avatar className="size-16 mx-auto ring-2 ring-primary/40">
                {u.avatar_url && <AvatarImage src={u.avatar_url} />}
                <AvatarFallback className="brand-gradient text-primary-foreground font-semibold">
                  {(u.username ?? "?").slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="absolute bottom-0 right-1 size-3 rounded-full bg-emerald-500 border-2 border-background" />
            </div>
            <p className="mt-2 text-sm font-medium truncate">{u.username ?? "anon"}</p>
            <p className="text-[10px] text-muted-foreground truncate">{u.language ?? "—"}</p>
            <div className="mt-1.5 inline-flex items-center gap-0.5 rounded-full bg-coin/15 px-1.5 py-0.5 text-[10px] font-semibold text-coin">
              <Coins className="size-2.5" /> {VIDEO_CALL_COINS_PER_MINUTE}/m
            </div>
          </Card>
        </Link>
      ))}
    </div>
  );
}
