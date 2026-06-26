import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listPlans, mockRecharge, getWallet } from "@/lib/wallet.functions";
import { getMyProfile } from "@/lib/onboarding.functions";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Coins, Sparkles, Gift } from "lucide-react";
import { toast } from "sonner";
import { bonusForDeposit } from "@/lib/constants";

export const Route = createFileRoute("/_authenticated/recharge")({
  component: Recharge,
});

function Recharge() {
  const qc = useQueryClient();
  const plansFn = useServerFn(listPlans);
  const walletFn = useServerFn(getWallet);
  const profileFn = useServerFn(getMyProfile);
  const rechargeFn = useServerFn(mockRecharge);

  const { data: me } = useQuery({ queryKey: ["me"], queryFn: () => profileFn() });
  const { data: plans } = useQuery({ queryKey: ["plans"], queryFn: () => plansFn() });
  const { data: wallet } = useQuery({ queryKey: ["wallet"], queryFn: () => walletFn() });
  const [busy, setBusy] = useState<string | null>(null);

  const bonusPct = bonusForDeposit(wallet?.depositCount ?? 0);

  async function buy(planId: string) {
    setBusy(planId);
    try {
      const r = await rechargeFn({ data: { planId } });
      toast.success(`+${r.added.toLocaleString("en-IN")} coins${r.bonus > 0 ? ` (+${r.bonus} bonus)` : ""}`);
      qc.invalidateQueries({ queryKey: ["wallet"] });
    } catch (e: any) { toast.error(e.message); } finally { setBusy(null); }
  }

  return (
    <AppShell isAdmin={me?.isAdmin}>
      <h1 className="text-2xl font-bold">Recharge coins</h1>
      <p className="text-sm text-muted-foreground">Mock recharge — payment integration in Phase 3.</p>

      {bonusPct > 0 && (
        <Card className="glass mt-4 p-4 flex items-center gap-3 border-accent/40">
          <Gift className="size-5 text-accent" />
          <div className="flex-1">
            <p className="text-sm font-medium">{Math.round(bonusPct * 100)}% BONUS on this deposit!</p>
            <p className="text-xs text-muted-foreground">Limited bonus on your first 3 deposits.</p>
          </div>
          <Badge className="bg-accent text-accent-foreground">Deposit #{(wallet?.depositCount ?? 0) + 1}</Badge>
        </Card>
      )}

      <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 gap-3">
        {(plans ?? []).map((p) => {
          const bonus = Math.floor(Number(p.coins) * bonusPct);
          return (
            <Card key={p.id} className="glass p-4 text-center hover:border-primary/50 transition-colors">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">{p.label}</div>
              <div className="mt-1 flex items-baseline justify-center gap-1">
                <span className="text-2xl font-bold">₹{Number(p.price_inr).toLocaleString("en-IN")}</span>
              </div>
              <div className="mt-2 flex items-center justify-center gap-1 text-coin font-semibold">
                <Coins className="size-4" /> {Number(p.coins).toLocaleString("en-IN")}
              </div>
              {bonus > 0 && <p className="mt-1 text-xs text-accent">+ {bonus.toLocaleString("en-IN")} bonus</p>}
              <Button size="sm" disabled={busy === p.id} onClick={() => buy(p.id)} className="mt-3 w-full brand-gradient text-primary-foreground">
                {busy === p.id ? "…" : "Buy"}
              </Button>
            </Card>
          );
        })}
      </div>

      <Card className="glass mt-6 p-4">
        <div className="flex items-center gap-2 text-sm font-semibold"><Sparkles className="size-4 text-primary" /> Bonus tiers</div>
        <ul className="mt-2 text-xs text-muted-foreground space-y-1">
          <li>1st deposit — 50% bonus coins</li>
          <li>2nd deposit — 40% bonus coins</li>
          <li>3rd deposit — 30% bonus coins</li>
          <li>After that — no bonus</li>
        </ul>
      </Card>
    </AppShell>
  );
}
