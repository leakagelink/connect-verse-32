import { createFileRoute } from "@tanstack/react-router";

// Daily cron: removes KYC documents from storage once retention window expires.
// Approved -> 7 days; Rejected -> 30 days (set via BEFORE UPDATE trigger).
export const Route = createFileRoute("/api/public/hooks/kyc-cleanup")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apikey = request.headers.get("apikey");
        const expected = process.env.SUPABASE_PUBLISHABLE_KEY;
        if (!apikey || !expected || apikey !== expected) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401, headers: { "Content-Type": "application/json" },
          });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: rows, error } = await supabaseAdmin
          .from("kyc_requests")
          .select("id, pan_doc_path, aadhaar_front_path, aadhaar_back_path, selfie_path")
          .in("status", ["approved", "rejected"])
          .is("docs_deleted_at", null)
          .lte("docs_retention_until", new Date().toISOString())
          .limit(200);

        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500, headers: { "Content-Type": "application/json" },
          });
        }

        let filesRemoved = 0;
        let recordsUpdated = 0;
        const failures: Array<{ id: string; reason: string }> = [];

        for (const r of rows ?? []) {
          const paths = [r.pan_doc_path, r.aadhaar_front_path, r.aadhaar_back_path, r.selfie_path]
            .filter((p): p is string => !!p);
          if (paths.length === 0) {
            await supabaseAdmin.from("kyc_requests")
              .update({ docs_deleted_at: new Date().toISOString() })
              .eq("id", r.id);
            recordsUpdated++;
            continue;
          }
          const { error: rmErr } = await supabaseAdmin.storage.from("kyc-docs").remove(paths);
          if (rmErr) {
            failures.push({ id: r.id, reason: rmErr.message });
            continue;
          }
          filesRemoved += paths.length;
          const { error: updErr } = await supabaseAdmin.from("kyc_requests")
            .update({ docs_deleted_at: new Date().toISOString() })
            .eq("id", r.id);
          if (updErr) failures.push({ id: r.id, reason: updErr.message });
          else recordsUpdated++;
        }

        return new Response(JSON.stringify({
          ok: true,
          scanned: rows?.length ?? 0,
          filesRemoved,
          recordsUpdated,
          failures,
        }), { headers: { "Content-Type": "application/json" } });
      },
    },
  },
});
