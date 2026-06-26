import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyProfile } from "@/lib/onboarding.functions";
import { getOrCreateConversation } from "@/lib/chat.functions";
import { heartbeat, listOnlineUsers } from "@/lib/presence.functions";
import { listRooms } from "@/lib/rooms.functions";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageCircle, Phone, Video, Sparkles, Users, Plus, Radio, Gamepad2, Mic } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/home")({
  component: Home,
});

function Home() {
  const navigate = useNavigate();
  const getProfile = useServerFn(getMyProfile);
  const online = useServerFn(listOnlineUsers);
  const beat = useServerFn(heartbeat);
  const rooms = useServerFn(listRooms);
  const startChat = useServerFn(getOrCreateConversation);

  const { data: me } = useQuery({ queryKey: ["me"], queryFn: () => getProfile() });
  const { data: onlineUsers, isLoading: loadingOnline, refetch: refetchOnline } = useQuery({
    queryKey: ["online"], queryFn: () => online(), refetchInterval: 20_000,
  });
  const { data: roomList, isLoading: loadingRooms } = useQuery({
    queryKey: ["rooms"], queryFn: () => rooms(), refetchInterval: 20_000,
  });

  // heartbeat every 30s
  useEffect(() => {
    beat().catch(() => {});
    const i = setInterval(() => beat().catch(() => {}), 30_000);
    return () => clearInterval(i);
  }, [beat]);

  useEffect(() => {
    if (me?.profile?.is_banned) navigate({ to: "/banned", replace: true });
    else if (me?.profile && !me.profile.onboarded) navigate({ to: "/onboarding", replace: true });
  }, [me, navigate]);

  async function openChat(otherId: string) {
    try {
      const { id } = await startChat({ data: { otherUserId: otherId } });
      navigate({ to: "/chat/$conversationId", params: { conversationId: id } });
    } catch (e: any) { toast.error(e.message); }
  }

  return (
    <AppShell isAdmin={me?.isAdmin}>
      <div className="mb-4 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold">Discover</h1>
          <p className="text-sm text-muted-foreground">Live members, calls & rooms</p>
        </div>
        <Button size="sm" variant="outline" onClick={() => refetchOnline()}>Refresh</Button>
      </div>

      {me?.profile?.free_seconds_remaining && me.profile.free_seconds_remaining > 0 && (
        <Card className="glass mb-4 p-4 flex items-center gap-3 border-primary/30">
          <Sparkles className="size-5 text-primary" />
          <div className="flex-1">
            <p className="text-sm font-medium">{Math.floor(me.profile.free_seconds_remaining/60)} free min left</p>
            <p className="text-xs text-muted-foreground">Use them on chat or calls.</p>
          </div>
          <Link to="/recharge"><Button size="sm" variant="outline">Recharge</Button></Link>
        </Card>
      )}

      <Tabs defaultValue="online" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="online"><Users className="size-4 mr-1" />Online</TabsTrigger>
          <TabsTrigger value="voice"><Phone className="size-4 mr-1" />Voice</TabsTrigger>
          <TabsTrigger value="video"><Video className="size-4 mr-1" />Video</TabsTrigger>
          <TabsTrigger value="rooms"><Radio className="size-4 mr-1" />Rooms</TabsTrigger>
        </TabsList>

        <TabsContent value="online" className="mt-4">
          <OnlineList
            users={onlineUsers ?? []}
            loading={loadingOnline}
            renderActions={(u) => (
              <Button size="sm" onClick={() => openChat(u.id)}>
                <MessageCircle className="size-4" />
              </Button>
            )}
          />
        </TabsContent>

        <TabsContent value="voice" className="mt-4">
          <p className="text-xs text-muted-foreground mb-3">Tap to start a voice call. Coins are deducted per minute.</p>
          <OnlineList
            users={onlineUsers ?? []}
            loading={loadingOnline}
            renderActions={(u) => (
              <Button size="sm" className="brand-gradient" onClick={() => navigate({ to: "/call/$kind/$userId", params: { kind: "voice", userId: u.id } })}>
                <Phone className="size-4 mr-1" /> Call
              </Button>
            )}
          />
        </TabsContent>

        <TabsContent value="video" className="mt-4">
          <p className="text-xs text-muted-foreground mb-3">HD video calls. Make sure your camera & mic permissions are allowed.</p>
          <OnlineList
            users={onlineUsers ?? []}
            loading={loadingOnline}
            renderActions={(u) => (
              <Button size="sm" className="brand-gradient" onClick={() => navigate({ to: "/call/$kind/$userId", params: { kind: "video", userId: u.id } })}>
                <Video className="size-4 mr-1" /> Video
              </Button>
            )}
          />
        </TabsContent>

        <TabsContent value="rooms" className="mt-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Live rooms — voice, video, games & live shows.</p>
            <Link to="/rooms/new">
              <Button size="sm" variant="outline"><Plus className="size-4 mr-1" />Host</Button>
            </Link>
          </div>
          {loadingRooms ? (
            <div className="text-center text-muted-foreground py-8">Loading rooms…</div>
          ) : !roomList?.length ? (
            <Card className="glass p-8 text-center text-muted-foreground">No live rooms. Be the first to host!</Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {roomList.map((r: any) => (
                <Link key={r.id} to="/rooms/$id" params={{ id: r.id }}>
                  <Card className="glass p-4 hover:border-primary/40 transition-colors h-full">
                    <div className="flex items-start gap-3">
                      <div className="size-10 rounded-lg brand-gradient flex items-center justify-center">
                        <KindIcon kind={r.kind} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold truncate">{r.title}</p>
                          <Badge variant="secondary" className="text-[10px] uppercase">{r.kind}</Badge>
                        </div>
                        {r.topic && <p className="text-xs text-muted-foreground truncate">{r.topic}</p>}
                        <p className="text-xs text-muted-foreground mt-1">
                          Host: @{r.host?.username ?? "anon"} · {r.participants}/{r.max_seats} seats
                        </p>
                      </div>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}

function KindIcon({ kind }: { kind: string }) {
  if (kind === "video") return <Video className="size-5 text-primary-foreground" />;
  if (kind === "game") return <Gamepad2 className="size-5 text-primary-foreground" />;
  if (kind === "live") return <Radio className="size-5 text-primary-foreground" />;
  return <Mic className="size-5 text-primary-foreground" />;
}

function OnlineList({
  users, loading, renderActions,
}: { users: any[]; loading: boolean; renderActions: (u: any) => React.ReactNode }) {
  if (loading) return <div className="text-center text-muted-foreground py-8">Loading…</div>;
  if (!users.length) return <Card className="glass p-8 text-center text-muted-foreground">No one is online right now. Check back soon.</Card>;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {users.map((u) => (
        <Card key={u.id} className="glass p-4 flex items-center gap-3">
          <div className="relative">
            <Avatar className="size-12">
              {u.avatar_url && <AvatarImage src={u.avatar_url} />}
              <AvatarFallback className="brand-gradient text-primary-foreground font-semibold">
                {(u.username ?? "?").slice(0,2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="absolute -bottom-0.5 -right-0.5 size-3.5 rounded-full bg-emerald-500 border-2 border-background" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-medium truncate">{u.username ?? "anon"}</p>
              {u.is_creator && <Badge variant="secondary" className="text-xs">Creator</Badge>}
            </div>
            <p className="text-xs text-muted-foreground truncate">
              {[u.gender, u.country, u.language].filter(Boolean).join(" · ") || "Online now"}
            </p>
          </div>
          {renderActions(u)}
        </Card>
      ))}
    </div>
  );
}
