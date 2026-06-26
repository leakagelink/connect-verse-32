import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const startCallLog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { calleeId: string; kind: "voice" | "video" }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
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
    return { id: row.id as string };
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
