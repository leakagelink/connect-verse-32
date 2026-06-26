import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const checkUserOnline = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const cutoff = new Date(Date.now() - 60 * 1000).toISOString();
    const { data: row } = await supabase
      .from("profiles")
      .select("id, last_seen_at, is_banned, onboarded")
      .eq("id", data.userId)
      .maybeSingle();
    const online =
      !!row &&
      !row.is_banned &&
      row.onboarded &&
      !!row.last_seen_at &&
      row.last_seen_at >= cutoff;
    return { online, last_seen_at: row?.last_seen_at ?? null };
  });

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

export const listOnlineCreators = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const cutoff = new Date(Date.now() - ONLINE_WINDOW_SECONDS * 1000).toISOString();
    const [{ data: creators }, { data: me }] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, username, gender, country, state, language, avatar_url, is_creator, last_seen_at")
        .eq("is_banned", false)
        .eq("onboarded", true)
        .eq("is_creator", true)
        .neq("id", userId)
        .gte("last_seen_at", cutoff)
        .order("last_seen_at", { ascending: false })
        .limit(120),
      supabase
        .from("profiles")
        .select("language, country, state")
        .eq("id", userId)
        .maybeSingle(),
    ]);
    return {
      creators: creators ?? [],
      me: { language: me?.language ?? null, country: me?.country ?? null, state: me?.state ?? null },
    };
  });
