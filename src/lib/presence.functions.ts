import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const ONLINE_WINDOW_SECONDS = 60;

export const heartbeat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await supabase
      .from("profiles")
      .update({ last_seen_at: new Date().toISOString() })
      .eq("id", userId);
    return { ok: true };
  });

export const listOnlineUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const cutoff = new Date(Date.now() - ONLINE_WINDOW_SECONDS * 1000).toISOString();
    const { data } = await supabase
      .from("profiles")
      .select("id, username, gender, country, language, avatar_url, is_creator, last_seen_at")
      .eq("is_banned", false)
      .eq("onboarded", true)
      .neq("id", userId)
      .gte("last_seen_at", cutoff)
      .order("last_seen_at", { ascending: false })
      .limit(60);
    return data ?? [];
  });
