import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Export all data the signed-in user has in Talkora.
 * Required by Google Play User Data policy: users must be able to
 * request and download their personal data from within the app.
 *
 * Returns a JSON-serializable object covering profile, wallet, transactions,
 * call history, messages, follows, reports filed, gifts and KYC metadata.
 * Sensitive cross-user identifiers and other users' private content are
 * omitted; only the signed-in user's data is returned.
 */
export const exportMyData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const safe = async <T,>(p: Promise<{ data: T | null; error: any }>) => {
      const { data, error } = await p;
      if (error) return [] as unknown as T;
      return (data ?? ([] as unknown as T));
    };

    const [
      profile,
      wallet,
      transactions,
      callsAsCaller,
      callsAsCallee,
      messagesSent,
      following,
      followers,
      reportsFiled,
      giftsSent,
      giftsReceived,
      kyc,
      withdrawals,
      blocks,
    ] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase.from("wallets").select("*").eq("user_id", userId).maybeSingle(),
      safe(supabase.from("transactions").select("*").eq("user_id", userId).order("created_at", { ascending: false })),
      safe(supabase.from("call_logs").select("*").eq("caller_id", userId)),
      safe(supabase.from("call_logs").select("*").eq("callee_id", userId)),
      safe(supabase.from("messages").select("id, conversation_id, content, created_at").eq("sender_id", userId).order("created_at", { ascending: false }).limit(5000)),
      safe(supabase.from("follows").select("followee_id, created_at").eq("follower_id", userId)),
      safe(supabase.from("follows").select("follower_id, created_at").eq("followee_id", userId)),
      safe(supabase.from("reports").select("id, reported_user_id, reason, details, status, created_at").eq("reporter_id", userId)),
      safe(supabase.from("gift_sends").select("*").eq("sender_id", userId)),
      safe(supabase.from("gift_sends").select("*").eq("receiver_id", userId)),
      safe(supabase.from("kyc_requests").select("id, status, created_at, reviewed_at, docs_retention_until, docs_deleted_at").eq("user_id", userId)),
      safe(supabase.from("withdrawals").select("*").eq("user_id", userId)),
      safe(supabase.from("blocks").select("blocked_id, created_at").eq("blocker_id", userId)),
    ]);

    return {
      meta: {
        app: "Talkora",
        exportedAt: new Date().toISOString(),
        userId,
        notice:
          "This export contains personal data associated with your Talkora account. Other users' private data is not included. KYC documents are not embedded here; they live in encrypted storage subject to our retention policy.",
      },
      profile: profile.data ?? null,
      wallet: wallet.data ?? null,
      transactions,
      calls: {
        outgoing: callsAsCaller,
        incoming: callsAsCallee,
      },
      messagesSent,
      follows: { following, followers },
      reportsFiled,
      gifts: { sent: giftsSent, received: giftsReceived },
      kycRequests: kyc,
      withdrawals,
      blockedUsers: blocks,
    };
  });
