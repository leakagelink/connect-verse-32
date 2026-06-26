import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// If `resumeId` is supplied AND it matches an in-progress call between the
// same two users that was last touched within RESUME_WINDOW_SECONDS, we
// reuse it instead of creating a duplicate row. This is what lets a refresh
// / reconnect continue the same call_log without double-charging the user.
const RESUME_WINDOW_SECONDS = 5 * 60;

export const startCallLog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    calleeId: string;
    kind: "voice" | "video";
    resumeId?: string | null;
  }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    if (data.resumeId) {
      const { data: existing } = await supabase
        .from("call_logs")
        .select("id, caller_id, callee_id, kind, ended_at, last_flushed_at, started_at, duration_seconds, coins_spent, free_seconds_used")
        .eq("id", data.resumeId)
        .maybeSingle();
      const lastTouch = existing?.last_flushed_at ?? existing?.started_at;
      const fresh = lastTouch
        ? (Date.now() - new Date(lastTouch).getTime()) / 1000 < RESUME_WINDOW_SECONDS
        : false;
      if (
        existing &&
        existing.caller_id === userId &&
        existing.callee_id === data.calleeId &&
        existing.kind === data.kind &&
        !existing.ended_at &&
        fresh
      ) {
        return {
          id: existing.id as string,
          resumed: true,
          baselineDurationSeconds: Number(existing.duration_seconds ?? 0),
          baselineFreeSecondsUsed: Number(existing.free_seconds_used ?? 0),
          baselineCoinsSpent: Number(existing.coins_spent ?? 0),
        };
      }
    }

    const { data: row, error } = await supabase
      .from("call_logs")
      .insert({
        caller_id: userId,
        callee_id: data.calleeId,
        kind: data.kind,
        status: "completed",
      })
      .select("id")
      .single();
    if (error) throw error;
    return {
      id: row.id as string,
      resumed: false,
      baselineDurationSeconds: 0,
      baselineFreeSecondsUsed: 0,
      baselineCoinsSpent: 0,
    };
  });


export const endCallLog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    id: string;
    durationSeconds: number;
    coinsSpent: number;
    status?: "completed" | "cancelled";
  }) => input)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("call_logs")
      .update({
        ended_at: new Date().toISOString(),
        duration_seconds: data.durationSeconds,
        coins_spent: data.coinsSpent,
        status: data.status ?? "completed",
      })
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

// Periodic heartbeat from the active call screen: persist the seconds-of-free-time
// and coins consumed so far. Lets the "5:00 free" countdown / coin balance survive
// reconnects, refresh, accidental tab close, or app restart.
export const applyCallUsage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    callLogId?: string | null;
    deltaFreeSeconds: number;
    deltaCoins: number;
    elapsedSeconds?: number;
  }) => input)
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const deltaFree = Math.max(0, Math.floor(data.deltaFreeSeconds || 0));
    const deltaCoins = Math.max(0, Math.floor(data.deltaCoins || 0));
    if (deltaFree === 0 && deltaCoins === 0) {
      return { ok: true, freeSeconds: null, balance: null };
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let freeSeconds: number | null = null;
    if (deltaFree > 0) {
      const { data: prof } = await supabaseAdmin
        .from("profiles")
        .select("free_seconds_remaining")
        .eq("id", userId)
        .maybeSingle();
      const current = Number(prof?.free_seconds_remaining ?? 0);
      const next = Math.max(0, current - deltaFree);
      await supabaseAdmin
        .from("profiles")
        .update({ free_seconds_remaining: next })
        .eq("id", userId);
      freeSeconds = next;
    }

    let balance: number | null = null;
    if (deltaCoins > 0) {
      const { data: wallet } = await supabaseAdmin
        .from("wallets")
        .select("coin_balance")
        .eq("user_id", userId)
        .maybeSingle();
      const current = Number(wallet?.coin_balance ?? 0);
      const next = Math.max(0, current - deltaCoins);
      await supabaseAdmin
        .from("wallets")
        .update({ coin_balance: next, updated_at: new Date().toISOString() })
        .eq("user_id", userId);
      balance = next;

      await supabaseAdmin.from("transactions").insert({
        user_id: userId,
        type: "chat_spend",
        coins_delta: -deltaCoins,
        inr_amount: 0,
        metadata: {
          call_log_id: data.callLogId ?? null,
          seconds: data.elapsedSeconds ?? null,
        },
      });
    }

    if (data.callLogId) {
      // Best-effort: keep running totals on the call log row so /recents is accurate
      // even if the user never explicitly ends the call.
      const { data: log } = await supabaseAdmin
        .from("call_logs")
        .select("duration_seconds, coins_spent")
        .eq("id", data.callLogId)
        .maybeSingle();
      if (log) {
        await supabaseAdmin
          .from("call_logs")
          .update({
            duration_seconds: Math.max(
              Number(log.duration_seconds ?? 0),
              data.elapsedSeconds ?? 0,
            ),
            coins_spent: Number(log.coins_spent ?? 0) + deltaCoins,
          })
          .eq("id", data.callLogId);
      }
    }

    return { ok: true, freeSeconds, balance };
  });

export type RecentCall = {
  id: string;
  kind: "voice" | "video";
  direction: "outgoing" | "incoming";
  started_at: string;
  ended_at: string | null;
  duration_seconds: number;
  coins_spent: number;
  status: "completed" | "missed" | "cancelled";
  partner: {
    id: string;
    username: string | null;
    avatar_url: string | null;
    country: string | null;
    state: string | null;
  };
};

export const listRecentCalls = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<RecentCall[]> => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("call_logs")
      .select("id, kind, caller_id, callee_id, started_at, ended_at, duration_seconds, coins_spent, status")
      .or(`caller_id.eq.${userId},callee_id.eq.${userId}`)
      .order("started_at", { ascending: false })
      .limit(100);
    if (error) throw error;

    const partnerIds = Array.from(
      new Set((data ?? []).map((r) => (r.caller_id === userId ? r.callee_id : r.caller_id)))
    );
    let profilesById = new Map<string, any>();
    if (partnerIds.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, username, avatar_url, country, state")
        .in("id", partnerIds);
      profilesById = new Map((profs ?? []).map((p) => [p.id, p]));
    }

    return (data ?? []).map((r) => {
      const partnerId = r.caller_id === userId ? r.callee_id : r.caller_id;
      const p = profilesById.get(partnerId) ?? {};
      return {
        id: r.id,
        kind: r.kind as "voice" | "video",
        direction: r.caller_id === userId ? "outgoing" : "incoming",
        started_at: r.started_at,
        ended_at: r.ended_at,
        duration_seconds: r.duration_seconds,
        coins_spent: r.coins_spent,
        status: r.status as "completed" | "missed" | "cancelled",
        partner: {
          id: partnerId,
          username: p.username ?? null,
          avatar_url: p.avatar_url ?? null,
          country: p.country ?? null,
          state: p.state ?? null,
        },
      };
    });
  });
