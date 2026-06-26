import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { bonusForDeposit } from "./constants";

const RechargeInput = z.object({ planId: z.string().uuid() });

export const mockRecharge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => RechargeInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: plan, error: planErr } = await supabase
      .from("coin_plans")
      .select("id, price_inr, coins")
      .eq("id", data.planId)
      .eq("is_active", true)
      .maybeSingle();
    if (planErr || !plan) throw new Error("Plan not found");

    const { data: wallet, error: walletErr } = await supabase
      .from("wallets")
      .select("coin_balance, deposit_count, total_recharged_inr")
      .eq("user_id", userId)
      .maybeSingle();
    if (walletErr || !wallet) throw new Error("Wallet missing");

    const baseCoins = Number(plan.coins);
    const bonusPct = bonusForDeposit(wallet.deposit_count);
    const bonusCoins = Math.floor(baseCoins * bonusPct);

    // Use admin client to mutate wallet atomically (bypass RLS, server already auth'd user)
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const newBalance = Number(wallet.coin_balance) + baseCoins + bonusCoins;
    const newTotal = Number(wallet.total_recharged_inr) + Number(plan.price_inr);
    const newCount = wallet.deposit_count + 1;

    const { error: upErr } = await supabaseAdmin
      .from("wallets")
      .update({
        coin_balance: newBalance,
        total_recharged_inr: newTotal,
        deposit_count: newCount,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);
    if (upErr) throw new Error(upErr.message);

    // log transactions
    await supabaseAdmin.from("transactions").insert({
      user_id: userId,
      type: "recharge",
      coins_delta: baseCoins,
      inr_amount: plan.price_inr,
      plan_id: plan.id,
      metadata: { mock: true },
    });
    if (bonusCoins > 0) {
      await supabaseAdmin.from("transactions").insert({
        user_id: userId,
        type: "bonus",
        coins_delta: bonusCoins,
        inr_amount: 0,
        plan_id: plan.id,
        metadata: { bonus_pct: bonusPct, deposit_no: newCount },
      });
    }

    return {
      ok: true,
      added: baseCoins,
      bonus: bonusCoins,
      bonusPct,
      balance: newBalance,
    };
  });

export const getWallet = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [{ data: wallet }, { data: profile }, { data: txns }] = await Promise.all([
      supabase.from("wallets").select("*").eq("user_id", userId).maybeSingle(),
      supabase.from("profiles").select("free_seconds_remaining").eq("id", userId).maybeSingle(),
      supabase.from("transactions").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(50),
    ]);
    return {
      balance: Number(wallet?.coin_balance ?? 0),
      depositCount: wallet?.deposit_count ?? 0,
      totalRecharged: Number(wallet?.total_recharged_inr ?? 0),
      freeSeconds: profile?.free_seconds_remaining ?? 0,
      transactions: txns ?? [],
    };
  });

export const listPlans = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("coin_plans")
      .select("*")
      .eq("is_active", true)
      .order("sort_order");
    return data ?? [];
  });
