// Server-only helpers for engagement features.
// Imported lazily from server functions (never from the client).

const REFERRAL_RECHARGE_BONUS_PCT = 0.10;
const REFERRAL_RECHARGE_BONUS_CAP = 1000;

/**
 * Credit the referrer when their referee makes their first recharge.
 * - Award = 10% of base coins (no compounding on deposit bonus), capped at 1,000.
 * - Marks `referrals.first_recharge_at` so we never pay twice.
 * - Failures are caller-handled (we log & swallow inside the recharge flow).
 */
export async function creditFirstRechargeReferralBonus(
  refereeId: string,
  baseCoinsPurchased: number,
) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: ref } = await supabaseAdmin
    .from("referrals")
    .select("id, referrer_id, first_recharge_at")
    .eq("referee_id", refereeId)
    .maybeSingle();
  if (!ref || ref.first_recharge_at) return null;

  const bonus = Math.min(
    REFERRAL_RECHARGE_BONUS_CAP,
    Math.floor(baseCoinsPurchased * REFERRAL_RECHARGE_BONUS_PCT),
  );
  if (bonus <= 0) return null;

  // Mark referral as converted (race-safe: only update if still null)
  const { data: updated } = await supabaseAdmin
    .from("referrals")
    .update({
      first_recharge_at: new Date().toISOString(),
      recharge_bonus_coins: bonus,
    })
    .eq("id", ref.id)
    .is("first_recharge_at", null)
    .select("id")
    .maybeSingle();
  if (!updated) return null; // someone else already paid out

  // Credit referrer's wallet
  const { data: wallet } = await supabaseAdmin
    .from("wallets")
    .select("coin_balance")
    .eq("user_id", ref.referrer_id)
    .maybeSingle();
  const newBalance = Number(wallet?.coin_balance ?? 0) + bonus;
  await supabaseAdmin
    .from("wallets")
    .update({ coin_balance: newBalance, updated_at: new Date().toISOString() })
    .eq("user_id", ref.referrer_id);

  await supabaseAdmin.from("transactions").insert({
    user_id: ref.referrer_id,
    type: "referral_bonus",
    coins_delta: bonus,
    inr_amount: 0,
    metadata: { kind: "first_recharge", referee_id: refereeId, base_coins: baseCoinsPurchased },
  });

  return { referrerId: ref.referrer_id, bonus };
}
