import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const EventSchema = z.object({
  event_type: z.enum(["route_load", "api_call", "error"]),
  route: z.string().max(200).optional().nullable(),
  label: z.string().max(200).optional().nullable(),
  duration_ms: z.number().int().min(0).max(600000).optional().nullable(),
  status: z.number().int().optional().nullable(),
  ok: z.boolean().optional().nullable(),
  meta: z.record(z.any()).optional().nullable(),
});

export const logPerfBatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ events: z.array(EventSchema).max(50) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    if (!data.events.length) return { inserted: 0 };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const rows = data.events.map((e) => ({ ...e, user_id: context.userId }));
    const { error } = await supabaseAdmin.from("perf_events").insert(rows);
    if (error) throw new Error(error.message);
    return { inserted: rows.length };
  });

async function assertAdmin(supabase: any, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!data) throw new Error("Forbidden");
}

function percentile(sorted: number[], p: number) {
  if (!sorted.length) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

export const adminPerfSummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ windowMinutes: z.number().int().min(1).max(1440).default(15) }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const since = new Date(Date.now() - data.windowMinutes * 60_000).toISOString();
    const { data: rows, error } = await supabaseAdmin
      .from("perf_events")
      .select("event_type, route, label, duration_ms, status, ok, created_at")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(5000);
    if (error) throw new Error(error.message);

    const routeAgg = new Map<string, number[]>();
    const apiAgg = new Map<string, number[]>();
    const apiErrors = new Map<string, number>();
    const errorAgg = new Map<string, { count: number; lastAt: string; lastRoute: string | null }>();
    let totalEvents = 0, totalErrors = 0;

    for (const r of rows ?? []) {
      totalEvents++;
      if (r.event_type === "route_load" && r.route && typeof r.duration_ms === "number") {
        const arr = routeAgg.get(r.route) ?? [];
        arr.push(r.duration_ms);
        routeAgg.set(r.route, arr);
      } else if (r.event_type === "api_call" && r.label) {
        if (typeof r.duration_ms === "number") {
          const arr = apiAgg.get(r.label) ?? [];
          arr.push(r.duration_ms);
          apiAgg.set(r.label, arr);
        }
        if (r.ok === false) apiErrors.set(r.label, (apiErrors.get(r.label) ?? 0) + 1);
      } else if (r.event_type === "error") {
        totalErrors++;
        const key = r.label ?? "unknown";
        const e = errorAgg.get(key) ?? { count: 0, lastAt: r.created_at as string, lastRoute: r.route ?? null };
        e.count++;
        errorAgg.set(key, e);
      }
    }

    const routes = [...routeAgg.entries()].map(([route, arr]) => {
      const sorted = [...arr].sort((a, b) => a - b);
      const avg = Math.round(arr.reduce((s, v) => s + v, 0) / arr.length);
      return { route, count: arr.length, avg, p95: Math.round(percentile(sorted, 95)) };
    }).sort((a, b) => b.count - a.count);

    const apis = [...apiAgg.entries()].map(([label, arr]) => {
      const sorted = [...arr].sort((a, b) => a - b);
      const avg = Math.round(arr.reduce((s, v) => s + v, 0) / arr.length);
      return {
        label, count: arr.length, avg,
        p95: Math.round(percentile(sorted, 95)),
        errors: apiErrors.get(label) ?? 0,
      };
    }).sort((a, b) => b.p95 - a.p95);

    const errors = [...errorAgg.entries()].map(([label, v]) => ({ label, ...v }))
      .sort((a, b) => b.count - a.count);

    return {
      windowMinutes: data.windowMinutes,
      totalEvents,
      totalErrors,
      routes,
      apis,
      errors,
      generatedAt: new Date().toISOString(),
    };
  });
