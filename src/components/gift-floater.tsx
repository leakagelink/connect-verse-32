import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type Floater = { id: string; emoji: string; name: string; from: "me" | "them"; coins: number };

type Props = {
  callLogId: string | null;
  myUserId: string | null;
};

export function GiftFloater({ callLogId, myUserId }: Props) {
  const [items, setItems] = useState<Floater[]>([]);

  useEffect(() => {
    if (!callLogId) return;
    const channel = supabase
      .channel(`gift-sends-${callLogId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "gift_sends", filter: `call_log_id=eq.${callLogId}` },
        async (payload) => {
          const row = payload.new as { id: string; gift_id: string; sender_id: string; coins_spent: number };
          const { data: g } = await supabase
            .from("gifts").select("emoji, name").eq("id", row.gift_id).maybeSingle();
          if (!g) return;
          const item: Floater = {
            id: row.id,
            emoji: g.emoji,
            name: g.name,
            from: row.sender_id === myUserId ? "me" : "them",
            coins: row.coins_spent,
          };
          setItems((cur) => [...cur, item]);
          setTimeout(() => setItems((cur) => cur.filter((x) => x.id !== item.id)), 3200);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [callLogId, myUserId]);

  if (items.length === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden z-30">
      {items.map((it, idx) => (
        <div
          key={it.id}
          className="absolute left-1/2 bottom-24 -translate-x-1/2 animate-[gift-float_3s_ease-out_forwards] text-center"
          style={{ left: `${30 + ((idx * 17) % 40)}%` }}
        >
          <div className="text-5xl drop-shadow-lg">{it.emoji}</div>
          <div className="mt-1 inline-block rounded-full bg-background/80 backdrop-blur px-2 py-0.5 text-[11px] font-medium">
            {it.from === "me" ? "You sent" : "Received"} {it.name} · {it.coins}c
          </div>
        </div>
      ))}
      <style>{`
        @keyframes gift-float {
          0% { transform: translate(-50%, 40px) scale(0.6); opacity: 0; }
          15% { transform: translate(-50%, 0) scale(1.1); opacity: 1; }
          80% { transform: translate(-50%, -180px) scale(1); opacity: 1; }
          100% { transform: translate(-50%, -260px) scale(0.9); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
