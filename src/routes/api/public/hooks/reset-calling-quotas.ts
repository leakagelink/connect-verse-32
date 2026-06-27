import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

/**
 * Monthly cron — resets the `minutes_used_current_month` counter on every
 * credential and flips `status` from `exhausted` back to `healthy` so the
 * pool starts fresh each month. Schedule via pg_cron at `0 0 1 * *`.
 */
export const Route = createFileRoute("/api/public/hooks/reset-calling-quotas")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Anon-key auth pattern (matches other public hooks in this project).
        const authHeader = request.headers.get("authorization");
        const apikey = request.headers.get("apikey");
        const token = (authHeader?.replace("Bearer ", "") ?? apikey ?? "").trim();
        if (!token) {
          return new Response(JSON.stringify({ error: "missing apikey" }), {
            status: 401, headers: { "Content-Type": "application/json" },
          });
        }
        // Use service role for the maintenance write (we trust the cron caller).
        const supabaseAdmin = createClient(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!,
          { auth: { persistSession: false, autoRefreshToken: false } },
        );
        const nextReset = new Date();
        nextReset.setUTCMonth(nextReset.getUTCMonth() + 1, 1);
        nextReset.setUTCHours(0, 0, 0, 0);

        const { error } = await supabaseAdmin
          .from("calling_credentials")
          .update({
            minutes_used_current_month: 0,
            quota_reset_at: nextReset.toISOString(),
            status: "healthy", // exhausted -> healthy; degraded/disabled untouched? See note.
            consecutive_failures: 0,
          })
          .eq("status", "exhausted");
        // Above only resets exhausted ones. Reset counters on everyone else without
        // touching their status:
        const { error: e2 } = await supabaseAdmin
          .from("calling_credentials")
          .update({
            minutes_used_current_month: 0,
            quota_reset_at: nextReset.toISOString(),
          })
          .neq("status", "exhausted");

        if (error || e2) {
          return new Response(JSON.stringify({ ok: false, error: (error ?? e2)?.message }), {
            status: 500, headers: { "Content-Type": "application/json" },
          });
        }
        return new Response(JSON.stringify({ ok: true, nextReset: nextReset.toISOString() }), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
