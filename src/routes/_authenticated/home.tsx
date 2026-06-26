import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyProfile, discoverUsers } from "@/lib/onboarding.functions";
import { getOrCreateConversation } from "@/lib/chat.functions";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MessageCircle, Sparkles } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/home")({
  component: Home,
});

function Home() {
  const navigate = useNavigate();
  const getProfile = useServerFn(getMyProfile);
  const discover = useServerFn(discoverUsers);
  const startChat = useServerFn(getOrCreateConversation);

  const { data: me } = useQuery({ queryKey: ["me"], queryFn: () => getProfile() });
  const { data: users, isLoading } = useQuery({ queryKey: ["discover"], queryFn: () => discover() });

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
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Discover</h1>
        <p className="text-sm text-muted-foreground">Verified members from around the world</p>
      </div>

      {me?.profile?.free_seconds_remaining && me.profile.free_seconds_remaining > 0 && (
        <Card className="glass mb-4 p-4 flex items-center gap-3 border-primary/30">
          <Sparkles className="size-5 text-primary" />
          <div className="flex-1">
            <p className="text-sm font-medium">You have {Math.floor(me.profile.free_seconds_remaining/60)} free min left</p>
            <p className="text-xs text-muted-foreground">Use them on chat. After that, coins are used.</p>
          </div>
          <Link to="/recharge"><Button size="sm" variant="outline">Recharge</Button></Link>
        </Card>
      )}

      {isLoading ? (
        <div className="text-center text-muted-foreground py-12">Loading…</div>
      ) : !users?.length ? (
        <Card className="glass p-8 text-center text-muted-foreground">No other members yet. Invite friends!</Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {users.map((u) => (
            <Card key={u.id} className="glass p-4 flex items-center gap-3">
              <Avatar className="size-12">
                <AvatarFallback className="brand-gradient text-primary-foreground font-semibold">
                  {(u.username ?? "?").slice(0,2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium truncate">{u.username ?? "anon"}</p>
                  {u.is_creator && <Badge variant="secondary" className="text-xs">Creator</Badge>}
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {[u.gender, u.country, u.language].filter(Boolean).join(" · ")}
                </p>
              </div>
              <Button size="sm" onClick={() => openChat(u.id)}>
                <MessageCircle className="size-4" />
              </Button>
            </Card>
          ))}
        </div>
      )}
    </AppShell>
  );
}
