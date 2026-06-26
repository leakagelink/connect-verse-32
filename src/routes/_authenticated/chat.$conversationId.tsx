import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  loadMessages, sendMessage, startChatSession, tickChatBilling, endChatSession,
} from "@/lib/chat.functions";
import { getMyProfile } from "@/lib/onboarding.functions";
import { getWallet } from "@/lib/wallet.functions";
import {
  getPartnerProfile, sendFollowRequest, respondFollowRequest, unfollowUser,
} from "@/lib/follows.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { CoinBadge } from "@/components/coin-badge";
import { ReportDialog } from "@/components/report-dialog";
import { ArrowLeft, Send, Sparkles, UserPlus, UserCheck, UserX, Check, X } from "lucide-react";
import { toast } from "sonner";
import { CHAT_COINS_PER_MINUTE, MESSAGE_COIN_COST_MALE } from "@/lib/constants";

export const Route = createFileRoute("/_authenticated/chat/$conversationId")({
  component: ChatRoom,
});

type Msg = { id: string; sender_id: string; body: string; created_at: string; is_deleted: boolean };

function ChatRoom() {
  const { conversationId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const loadFn = useServerFn(loadMessages);
  const sendFn = useServerFn(sendMessage);
  const startFn = useServerFn(startChatSession);
  const tickFn = useServerFn(tickChatBilling);
  const endFn = useServerFn(endChatSession);
  const profileFn = useServerFn(getMyProfile);
  const walletFn = useServerFn(getWallet);
  const partnerFn = useServerFn(getPartnerProfile);
  const followFn = useServerFn(sendFollowRequest);
  const respondFn = useServerFn(respondFollowRequest);
  const unfollowFn = useServerFn(unfollowUser);

  const { data: me } = useQuery({ queryKey: ["me"], queryFn: () => profileFn() });
  const { data: wallet, refetch: refetchWallet } = useQuery({ queryKey: ["wallet"], queryFn: () => walletFn() });

  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [otherUserId, setOtherUserId] = useState<string | null>(null);
  const [sessionEnded, setSessionEnded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // initial load + figure out the other user from messages or fetch
  useEffect(() => {
    loadFn({ data: { conversationId } }).then((m) => setMessages(m as Msg[]));
    supabase.from("conversations").select("user_a, user_b").eq("id", conversationId).maybeSingle().then(({ data }) => {
      if (!data || !me?.profile) return;
      setOtherUserId(data.user_a === me.profile.id ? data.user_b : data.user_a);
    });
  }, [conversationId, loadFn, me?.profile]);

  // Realtime subscription
  useEffect(() => {
    const ch = supabase.channel(`msg:${conversationId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        (payload) => setMessages((prev) => [...prev, payload.new as Msg]))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [conversationId]);

  // start session on mount, tick every 30s, end on unmount
  useEffect(() => {
    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | null = null;
    startFn({ data: { conversationId } }).then((r) => {
      if (cancelled) return;
      setSessionId(r.sessionId);
      interval = setInterval(async () => {
        try {
          const result = await tickFn({ data: { sessionId: r.sessionId, elapsedSeconds: 30 } });
          refetchWallet();
          qc.invalidateQueries({ queryKey: ["me"] });
          if (result.ended) {
            setSessionEnded(true);
            if (interval) clearInterval(interval);
            toast.error(result.reason === "insufficient_coins" ? "Out of coins. Please recharge." : "Chat session ended.");
          }
        } catch {}
      }, 30_000);
    }).catch((e: any) => toast.error(e.message ?? "Cannot start chat"));
    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
      // best-effort end
      supabase.auth.getSession().then(() => {
        // session id may be unset if start failed; ignore
      });
    };
  }, [conversationId, startFn, tickFn, refetchWallet, qc]);

  useEffect(() => {
    if (!sessionId) return;
    return () => { endFn({ data: { sessionId } }).catch(() => {}); };
  }, [sessionId, endFn]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function send() {
    const body = text.trim();
    if (!body || sessionEnded) return;
    setText("");
    try { await sendFn({ data: { conversationId, body } }); }
    catch (e: any) { toast.error(e.message); }
  }

  const myId = me?.profile?.id;
  const freeSec = me?.profile?.free_seconds_remaining ?? 0;
  const coinBal = wallet?.balance ?? 0;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="glass border-b sticky top-0 z-30">
        <div className="mx-auto max-w-3xl flex items-center gap-3 px-3 py-2">
          <Button variant="ghost" size="icon" onClick={() => navigate({ to: "/chat" })}>
            <ArrowLeft className="size-5" />
          </Button>
          <div className="flex-1">
            <p className="text-sm font-medium">Chat</p>
            <p className="text-xs text-muted-foreground">
              {freeSec > 0 ? `${Math.floor(freeSec/60)}m free left · ` : ""}
              {CHAT_COINS_PER_MINUTE} coins/min
            </p>
          </div>
          <CoinBadge value={coinBal} />
          {otherUserId && <ReportDialog targetUserId={otherUserId} conversationId={conversationId} />}
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-4 mx-auto w-full max-w-3xl space-y-2">
        {messages.map((m) => {
          const mine = m.sender_id === myId;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm ${mine ? "bg-primary text-primary-foreground" : "glass"}`}>
                {m.is_deleted ? <em className="opacity-60">message deleted</em> : m.body}
              </div>
            </div>
          );
        })}
        {sessionEnded && (
          <div className="glass mx-auto max-w-xs rounded-xl p-4 text-center mt-4">
            <Sparkles className="mx-auto size-5 text-primary" />
            <p className="mt-2 text-sm">Chat session ended.</p>
            <Link to="/recharge"><Button size="sm" className="mt-2 brand-gradient text-primary-foreground">Recharge coins</Button></Link>
          </div>
        )}
      </div>

      <div className="glass border-t p-3 sticky bottom-0">
        <div className="mx-auto max-w-3xl flex gap-2">
          <Input value={text} onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder={sessionEnded ? "Recharge to continue" : "Type a message…"}
            disabled={sessionEnded} />
          <Button onClick={send} disabled={sessionEnded || !text.trim()}><Send className="size-4" /></Button>
        </div>
      </div>
    </div>
  );
}
