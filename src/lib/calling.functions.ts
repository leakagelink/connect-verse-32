import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Provider = "mock" | "agora";

async function loadSettings(): Promise<{
  provider: Provider;
  app_id: string;
  app_certificate: string;
}> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("app_settings")
    .select("key, value")
    .in("key", ["calling_provider", "agora_app_id", "agora_app_certificate"]);
  const map: Record<string, unknown> = {};
  for (const r of data ?? []) map[r.key] = r.value;
  const unwrap = (v: unknown) => (typeof v === "string" ? v : "");
  let provider = unwrap(map.calling_provider) as Provider;
  if (provider !== "agora") provider = "mock";
  return {
    provider,
    app_id: unwrap(map.agora_app_id),
    app_certificate: unwrap(map.agora_app_certificate),
  };
}

/** Public-to-user: which calling provider should the client use, and (if agora) the app id. */
export const getCallingConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const s = await loadSettings();
    const agoraReady = s.provider === "agora" && !!s.app_id && !!s.app_certificate;
    return {
      provider: agoraReady ? ("agora" as const) : ("mock" as const),
      appId: agoraReady ? s.app_id : "",
    };
  });

const TokenInput = z.object({
  channel: z.string().min(3).max(64).regex(/^[a-zA-Z0-9_-]+$/),
  role: z.enum(["publisher", "subscriber"]).default("publisher"),
});

/** Issue a short-lived Agora RTC token for the signed-in user joining a specific channel. */
export const issueAgoraToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => TokenInput.parse(d))
  .handler(async ({ data, context }) => {
    const s = await loadSettings();
    if (s.provider !== "agora" || !s.app_id || !s.app_certificate) {
      throw new Error("Agora calling is not configured");
    }
    // Reject banned users early
    const { data: prof } = await context.supabase
      .from("profiles")
      .select("is_banned")
      .eq("id", context.userId)
      .maybeSingle();
    if (prof?.is_banned) throw new Error("Account suspended");

    const { RtcTokenBuilder, RtcRole } = await import("agora-token");
    // Deterministic numeric UID derived from user UUID (Agora needs uint32 or string uid).
    // We'll use string-account tokens so the supabase user id maps 1:1.
    const account = context.userId;
    const role = data.role === "publisher" ? RtcRole.PUBLISHER : RtcRole.SUBSCRIBER;
    const expireSeconds = 60 * 60; // 1 hour
    const privilegeExpire = Math.floor(Date.now() / 1000) + expireSeconds;
    const token = RtcTokenBuilder.buildTokenWithUserAccount(
      s.app_id,
      s.app_certificate,
      data.channel,
      account,
      role,
      privilegeExpire,
      privilegeExpire,
    );
    return {
      appId: s.app_id,
      channel: data.channel,
      account,
      token,
      expiresAt: privilegeExpire,
    };
  });

async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data: isAdmin } = await ctx.supabase.rpc("has_role", {
    _user_id: ctx.userId,
    _role: "admin",
  });
  if (!isAdmin) throw new Error("Forbidden");
}

function mask(v: string): string {
  if (!v) return "";
  if (v.length <= 8) return "•".repeat(v.length);
  return v.slice(0, 4) + "•".repeat(Math.max(4, v.length - 8)) + v.slice(-4);
}

export const adminGetCallingConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const s = await loadSettings();
    return {
      provider: s.provider,
      app_id_masked: mask(s.app_id),
      app_certificate_masked: mask(s.app_certificate),
      has_app_id: !!s.app_id,
      has_app_certificate: !!s.app_certificate,
    };
  });

const SaveInput = z.object({
  provider: z.enum(["mock", "agora"]).optional(),
  app_id: z.string().max(120).optional(),
  app_certificate: z.string().max(200).optional(),
});

export const adminSaveCallingConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SaveInput.parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const rows: { key: string; value: unknown }[] = [];
    if (data.provider !== undefined) rows.push({ key: "calling_provider", value: data.provider });
    if (data.app_id !== undefined) rows.push({ key: "agora_app_id", value: data.app_id.trim() });
    if (data.app_certificate !== undefined)
      rows.push({ key: "agora_app_certificate", value: data.app_certificate.trim() });
    if (rows.length === 0) return { ok: true };

    for (const r of rows) {
      const { error } = await supabaseAdmin
        .from("app_settings")
        .upsert(
          {
            key: r.key,
            value: r.value as never,
            updated_by: context.userId,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "key" },
        );
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

/** Persist call quality metrics (called from client at call end). */
const MetricsInput = z.object({
  callLogId: z.string().uuid(),
  provider: z.enum(["mock", "agora"]),
  channelName: z.string().max(128).optional(),
  qualityAvg: z.number().min(0).max(6).optional(),
  disconnects: z.number().int().min(0).max(500).optional(),
});

export const recordCallMetrics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => MetricsInput.parse(d))
  .handler(async ({ data, context }) => {
    const patch: {
      provider: string;
      channel_name?: string;
      quality_avg?: number;
      disconnects?: number;
    } = { provider: data.provider };
    if (data.channelName) patch.channel_name = data.channelName;
    if (typeof data.qualityAvg === "number") patch.quality_avg = data.qualityAvg;
    if (typeof data.disconnects === "number") patch.disconnects = data.disconnects;
    const { error } = await context.supabase
      .from("call_logs")
      .update(patch)
      .eq("id", data.callLogId)
      .or(`caller_id.eq.${context.userId},callee_id.eq.${context.userId}`);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
