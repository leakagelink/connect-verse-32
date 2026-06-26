import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Coins, Gift as GiftIcon, Loader2 } from "lucide-react";
import { listGifts, sendGift } from "@/lib/gifts.functions";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  receiverId: string;
  callLogId: string | null;
  balance: number;
  onSent?: (newBalance: number) => void;
  onLowBalance?: () => void;
};

export function GiftPanel({ open, onOpenChange, receiverId, callLogId, balance, onSent, onLowBalance }: Props) {
  const listFn = useServerFn(listGifts);
  const sendFn = useServerFn(sendGift);
  const qc = useQueryClient();
  const [sendingId, setSendingId] = useState<string | null>(null);

  const { data: gifts, isLoading } = useQuery({
    queryKey: ["gift-catalog"],
    queryFn: () => listFn(),
    enabled: open,
    staleTime: 5 * 60_000,
  });

  async function handleSend(giftId: string, cost: number) {
    if (balance < cost) {
      toast.error(`Need ${cost} coins · you have ${balance}`);
      onLowBalance?.();
      return;
    }
    setSendingId(giftId);
    try {
      const res = await sendFn({ data: { giftId, receiverId, callLogId } });
      toast.success(`Sent ${res.gift.emoji} ${res.gift.name} · -${res.gift.coin_cost} coins`);
      onSent?.(res.newBalance);
      qc.invalidateQueries({ queryKey: ["wallet"] });
      qc.invalidateQueries({ queryKey: ["me"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not send gift");
    } finally {
      setSendingId(null);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[70vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <GiftIcon className="size-4 text-primary" /> Send a gift
          </SheetTitle>
        </SheetHeader>
        <div className="flex items-center justify-between mt-2 mb-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><Coins className="size-3" /> Your balance: <span className="font-medium text-foreground">{balance}</span> coins</span>
          <span>Coins are deducted instantly</span>
        </div>

        {isLoading ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin inline mr-1" /> Loading gifts…
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-2 pb-4">
            {(gifts ?? []).map((g) => {
              const afford = balance >= g.coin_cost;
              const sending = sendingId === g.id;
              return (
                <Button
                  key={g.id}
                  variant="outline"
                  disabled={sending || !!sendingId}
                  onClick={() => handleSend(g.id, g.coin_cost)}
                  className={`flex flex-col h-auto py-3 gap-0.5 ${!afford ? "opacity-60" : ""}`}
                >
                  <span className="text-2xl leading-none">{g.emoji}</span>
                  <span className="text-[11px] font-medium truncate w-full">{g.name}</span>
                  <span className={`text-[10px] flex items-center gap-0.5 ${afford ? "text-muted-foreground" : "text-destructive"}`}>
                    <Coins className="size-2.5" /> {g.coin_cost}
                  </span>
                  {sending && <Loader2 className="size-3 animate-spin mt-0.5" />}
                </Button>
              );
            })}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
