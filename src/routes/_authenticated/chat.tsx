import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listConversations } from "@/lib/chat.functions";
import { getMyProfile } from "@/lib/onboarding.functions";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { formatDistanceToNowStrict } from "date-fns";

export const Route = createFileRoute("/_authenticated/chat")({
  component: ChatLayout,
});

function ChatLayout() {
  const navigate = useNavigate();
  const list = useServerFn(listConversations);
  const getProfile = useServerFn(getMyProfile);
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: () => getProfile() });
  const { data: convs, isLoading } = useQuery({ queryKey: ["conversations"], queryFn: () => list() });

  return (
    <AppShell isAdmin={me?.isAdmin}>
      <Outlet />
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Chats</h1>
      </div>
      {isLoading ? (
        <div className="text-center text-muted-foreground py-12">Loading…</div>
      ) : !convs?.length ? (
        <Card className="glass p-8 text-center text-muted-foreground">
          No chats yet. <Link to="/home" className="text-primary underline">Discover people</Link>.
        </Card>
      ) : (
        <div className="space-y-2">
          {convs.map((c) => (
            <button
              key={c.id}
              onClick={() => navigate({ to: "/chat/$conversationId", params: { conversationId: c.id } })}
              className="w-full text-left"
            >
              <Card className="glass p-4 flex items-center gap-3 hover:bg-glass/80 transition-colors">
                <Avatar className="size-12">
                  <AvatarFallback className="brand-gradient text-primary-foreground font-semibold">
                    {(c.other?.username ?? "?").slice(0,2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{c.other?.username ?? "anon"}</p>
                  <p className="text-xs text-muted-foreground">
                    {c.lastMessageAt ? formatDistanceToNowStrict(new Date(c.lastMessageAt), { addSuffix: true }) : "New chat"}
                  </p>
                </div>
              </Card>
            </button>
          ))}
        </div>
      )}
    </AppShell>
  );
}
