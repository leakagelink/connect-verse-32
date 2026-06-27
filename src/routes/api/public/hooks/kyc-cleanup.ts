import { createFileRoute } from "@tanstack/react-router";

// Daily cron: removes KYC documents from storage once retention window expires.
// Approved -> 7 days; Rejected -> 30 days (set via BEFORE UPDATE trigger).
// Writes a per-file audit entry to kyc_doc_purge_log for compliance.
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
        const cronRunId = crypto.randomUUID();

        const { data: rows, error } = await supabaseAdmin
          .from("kyc_requests")
          .select("id, user_id, status, pan_doc_path, aadhaar_front_path, aadhaar_back_path, selfie_path")
          .in("status", ["approved", "rejected"])
          .is("docs_deleted_at", null)
          .lte("docs_retention_until", new Date().toISOString())
          .limit(200);

        if (error) {
          return new Response(JSON.stringify({ error: error.message, cronRunId }), {
            status: 500, headers: { "Content-Type": "application/json" },
          });
        }

        let filesRemoved = 0;
        let recordsUpdated = 0;
        const failures: Array<{ id: string; reason: string }> = [];

        for (const r of rows ?? []) {
          const docs: Array<{ kind: string; path: string }> = [
            { kind: "pan", path: r.pan_doc_path },
            { kind: "aadhaar_front", path: r.aadhaar_front_path },
            { kind: "aadhaar_back", path: r.aadhaar_back_path },
            { kind: "selfie", path: r.selfie_path },
          ].filter(d => !!d.path);

          if (docs.length === 0) {
            await supabaseAdmin.from("kyc_requests")
              .update({ docs_deleted_at: new Date().toISOString() })
              .eq("id", r.id);
            recordsUpdated++;
            continue;
          }

          const paths = docs.map(d => d.path);
          const { data: removed, error: rmErr } = await supabaseAdmin.storage
            .from("kyc-docs").remove(paths);

          const removedSet = new Set((removed ?? []).map((o: any) => o.name));
          const auditRows = docs.map(d => ({
            kyc_request_id: r.id,
            user_id: r.user_id,
            kyc_status: r.status,
            storage_path: d.path,
            doc_kind: d.kind,
            cron_run_id: cronRunId,
            success: !rmErr && (removedSet.size === 0 || removedSet.has(d.path)),
            error_message: rmErr ? rmErr.message : null,
          }));
          await supabaseAdmin.from("kyc_doc_purge_log").insert(auditRows);

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
          cronRunId,
          scanned: rows?.length ?? 0,
          filesRemoved,
          recordsUpdated,
          failures,
        }), { headers: { "Content-Type": "application/json" } });
      },
    },
  },
});
