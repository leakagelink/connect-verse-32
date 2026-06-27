/**
 * Push notifications — server functions.
 *
 * Responsibilities:
 *   - `registerDeviceToken` / `unregisterDeviceToken` — multi-device token CRUD
 *     called from the Capacitor app shell on launch / logout.
 *   - `notifyUser` — internal helper (also exported) that inserts an
 *     `app_notifications` row AND fans the same payload out to all of
 *     the user's FCM tokens, respecting their `notification_prefs`.
 *   - `adminBroadcast` — admin-only system announcement to all (or a
 *     filtered subset of) users. Logged to `push_broadcasts` for audit.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const TokenSchema = z.object({
  token: z.string().min(10).max(4096),
  platform: z.enum(["android", "ios", "web"]),
});

export const registerDeviceToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof TokenSchema>) => TokenSchema.parse(d))
  .handler(async ({ context, data }) => {
    const now = new Date().toISOString();
    // upsert by unique token; reassign owner if token rotated between accounts on the device.
    const { error } = await context.supabase
      .from("device_tokens")
      .upsert(
        { user_id: context.userId, token: data.token, platform: data.platform, last_seen_at: now },
        { onConflict: "token" },
      );
    if (error) throw new Error(error.message);
    // also mirror onto profiles for backwards-compat with phase-10 column.
    await context.supabase
      .from("profiles")
      .update({ push_token: data.token, push_platform: data.platform })
      .eq("id", context.userId);
    return { ok: true };
  });

export const unregisterDeviceToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { token: string }) => z.object({ token: z.string() }).parse(d))
  .handler(async ({ context, data }) => {
    await context.supabase.from("device_tokens").delete().eq("token", data.token).eq("user_id", context.userId);
    return { ok: true };
  });

/* ------------------------------------------------------------------ */
/* Internal helper — call this from other server functions.           */
/* ------------------------------------------------------------------ */

type NotifyKind = "chat" | "calls" | "gifts" | "follows" | "system" | "marketing";

const PREF_DEFAULTS: Record<NotifyKind, boolean> = {
  chat: true, calls: true, gifts: true, follows: true, system: true, marketing: false,
};

/**
 * Insert an in-app notification row AND attempt an FCM push to every
 * device the user has registered. Honours the user's `notification_prefs`
 * for the given kind. Uses the admin client so it can be called from
 * any signed-in server function regardless of who is acting.
 */
export async function notifyUser(opts: {
  userId: string;
  kind: NotifyKind;
  title: string;
  body?: string | null;
  deepLink?: string | null;
}): Promise<{ pushed: number }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // 1) prefs gate
  const { data: prefs } = await supabaseAdmin
    .from("notification_prefs")
    .select("chat, calls, gifts, follows, system, marketing")
    .eq("user_id", opts.userId)
    .maybeSingle();
  const allow = (prefs as Record<NotifyKind, boolean> | null)?.[opts.kind] ?? PREF_DEFAULTS[opts.kind];

  // 2) always create the in-app row (visible in the bell), even if push is muted
  await supabaseAdmin.from("app_notifications").insert({
    user_id: opts.userId,
    kind: opts.kind,
    title: opts.title,
    body: opts.body ?? null,
    deep_link: opts.deepLink ?? null,
  });

  if (!allow) return { pushed: 0 };

  // 3) FCM fanout
  const { data: tokens } = await supabaseAdmin
    .from("device_tokens")
    .select("token")
    .eq("user_id", opts.userId);
  const tokenList = (tokens ?? []).map((r: { token: string }) => r.token);
  if (tokenList.length === 0) return { pushed: 0 };

  const { sendFcmToTokens } = await import("./push.server");
  const result = await sendFcmToTokens(tokenList, {
    title: opts.title, body: opts.body ?? null, deepLink: opts.deepLink ?? null,
    data: { kind: opts.kind },
  });
  if (result.invalidTokens.length > 0) {
    await supabaseAdmin.from("device_tokens").delete().in("token", result.invalidTokens);
  }
  return { pushed: result.sent };
}

/* ------------------------------------------------------------------ */
/* Admin broadcast                                                     */
/* ------------------------------------------------------------------ */

const BroadcastSchema = z.object({
  title: z.string().min(1).max(120),
  body: z.string().max(500).optional().nullable(),
  deepLink: z.string().max(200).optional().nullable(),
  audience: z.enum(["all", "creators", "users"]).default("all"),
});

export const adminBroadcast = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof BroadcastSchema>) => BroadcastSchema.parse(d))
  .handler(async ({ context, data }) => {
    // admin check
    const { data: roleRow } = await context.supabase
      .from("user_roles").select("role").eq("user_id", context.userId).eq("role", "admin").maybeSingle();
    if (!roleRow) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // resolve audience
    let query = supabaseAdmin.from("profiles").select("id, gender, is_banned");
    const { data: profiles, error } = await query;
    if (error) throw new Error(error.message);
    const recipients = (profiles ?? []).filter((p: { id: string; gender: string | null; is_banned: boolean | null }) => {
      if (p.is_banned) return false;
      if (data.audience === "creators") return p.gender === "female";
      if (data.audience === "users") return p.gender !== "female";
      return true;
    });

    let pushed = 0;
    // sequential to avoid hammering FCM with thousands of parallel fetches.
    for (const r of recipients) {
      const out = await notifyUser({
        userId: r.id,
        kind: "system",
        title: data.title,
        body: data.body ?? null,
        deepLink: data.deepLink ?? null,
      });
      pushed += out.pushed;
    }

    await supabaseAdmin.from("push_broadcasts").insert({
      sender_id: context.userId,
      title: data.title,
      body: data.body ?? null,
      deep_link: data.deepLink ?? null,
      audience: data.audience,
      recipients_count: recipients.length,
      push_sent_count: pushed,
    });

    return { recipients: recipients.length, pushed };
  });

export const adminListBroadcasts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: roleRow } = await context.supabase
      .from("user_roles").select("role").eq("user_id", context.userId).eq("role", "admin").maybeSingle();
    if (!roleRow) throw new Error("Forbidden");
    const { data } = await context.supabase
      .from("push_broadcasts")
      .select("id, title, body, audience, recipients_count, push_sent_count, created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    return data ?? [];
  });
