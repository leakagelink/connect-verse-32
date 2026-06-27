import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** List users the current user has blocked (for management in Settings). */
export const listBlockedUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: rows, error } = await supabase
      .from("blocks")
      .select("blocked_id, created_at")
      .eq("blocker_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const ids = (rows ?? []).map((r: any) => r.blocked_id);
    let profilesById = new Map<string, { username: string | null; avatar_url: string | null }>();
    if (ids.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, username, avatar_url, ai_avatar_style, gender")
        .in("id", ids);
      profilesById = new Map((profs ?? []).map((p: any) => [p.id, p]));
    }
    return (rows ?? []).map((r: any) => ({
      userId: r.blocked_id,
      username: profilesById.get(r.blocked_id)?.username ?? "—",
      avatarUrl: profilesById.get(r.blocked_id)?.avatar_url ?? null,
      blockedAt: r.created_at,
    }));
  });

/**
 * Permanently delete the signed-in user's account.
 * Required by Google Play User Data policy: users must be able to request
 * account & data deletion from within the app.
 * Confirmation phrase ("DELETE") must be typed by the user.
 */
export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ confirm: z.literal("DELETE") }).parse(d),
  )
  .handler(async ({ context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Mark profile as deleted (audit trail; FK cascades will clean owned rows on auth user delete)
    await supabaseAdmin
      .from("profiles")
      .update({
        username: `deleted_${userId.slice(0, 8)}`,
        avatar_url: null,
        bio: null,
        deleted_at: new Date().toISOString(),
      })
      .eq("id", userId);

    // Hard-delete the auth user — cascades to dependent rows via FKs.
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (error) throw new Error(error.message);

    return { ok: true };
  });
