// Lightweight client-side perf tracker with per-navigation tracing.
// - Each route nav opens a new trace; all api_call / component / error
//   events during that nav are tagged with the same trace_id.
// - Wraps window.fetch for API latency, captures component mount times
//   via useComponentTrace(), and logs window errors.
// - Batches and flushes every 10s to the server.
import { useEffect } from "react";
import { logPerfBatch } from "./perf.functions";

type PerfEvent = {
  event_type: "route_load" | "api_call" | "error" | "component";
  route?: string | null;
  label?: string | null;
  duration_ms?: number | null;
  status?: number | null;
  ok?: boolean | null;
  trace_id?: string | null;
  meta?: Record<string, any> | null;
};

const MAX_BUFFER = 100;
const FLUSH_MS = 10_000;
const SAMPLE_RATE = 1;
const buffer: PerfEvent[] = [];
let installed = false;

// Current navigation context — shared with useComponentTrace
let currentTraceId: string | null = null;
let currentRoute: string | null = null;
let navStart = 0;

function newTraceId() {
  return (
    (typeof crypto !== "undefined" && (crypto as any).randomUUID?.()) ||
    Math.random().toString(36).slice(2) + Date.now().toString(36)
  );
}

export function getCurrentTraceContext() {
  return { trace_id: currentTraceId, route: currentRoute };
}

function push(ev: PerfEvent) {
  if (Math.random() > SAMPLE_RATE) return;
  if (!ev.trace_id) ev.trace_id = currentTraceId;
  if (!ev.route) ev.route = currentRoute ?? (typeof window !== "undefined" ? window.location.pathname : null);
  buffer.push(ev);
  if (buffer.length >= MAX_BUFFER) flush();
}

async function flush() {
  if (!buffer.length) return;
  const all = buffer.splice(0, buffer.length);
  // Server caps batch at 50 events — chunk before sending.
  for (let i = 0; i < all.length; i += 50) {
    const batch = all.slice(i, i + 50);
    try {
      await logPerfBatch({ data: { events: batch as any } });
    } catch {
      /* swallow to avoid feedback loops */
    }
  }
}

function shortenUrl(u: string): string {
  try {
    const url = new URL(u, window.location.origin);
    return (url.origin === window.location.origin ? "" : url.host) +
      url.pathname.replace(/\/[0-9a-f-]{16,}/gi, "/:id");
  } catch {
    return u.slice(0, 120);
  }
}

export function installPerfTracker(router: any) {
  if (installed || typeof window === "undefined") return;
  installed = true;

  // Seed with an initial trace for the first paint
  currentTraceId = newTraceId();
  currentRoute = window.location.pathname;
  navStart = performance.now();

  try {
    router.subscribe?.("onBeforeLoad", (e: any) => {
      currentTraceId = newTraceId();
      currentRoute = e?.toLocation?.pathname ?? window.location.pathname;
      navStart = performance.now();
    });
    router.subscribe?.("onLoad", (e: any) => {
      const route = e?.toLocation?.pathname ?? currentRoute;
      if (!route) return;
      push({
        event_type: "route_load",
        route,
        duration_ms: Math.round(performance.now() - navStart),
        trace_id: currentTraceId,
      });
    });
  } catch {
    /* router may not expose subscribe — ok */
  }

  // Wrap fetch
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (...args: Parameters<typeof fetch>) => {
    const started = performance.now();
    const input = args[0];
    const url = typeof input === "string" ? input : (input as any)?.url ?? "";
    const label = shortenUrl(url);
    const trace_id = currentTraceId;
    try {
      const res = await originalFetch(...args);
      push({
        event_type: "api_call",
        label,
        duration_ms: Math.round(performance.now() - started),
        status: res.status,
        ok: res.ok,
        trace_id,
      });
      return res;
    } catch (err: any) {
      push({
        event_type: "api_call",
        label,
        duration_ms: Math.round(performance.now() - started),
        ok: false,
        trace_id,
        meta: { error: String(err?.message ?? err).slice(0, 200) },
      });
      throw err;
    }
  };

  window.addEventListener("error", (e) => {
    push({
      event_type: "error",
      label: (e.message || "error").slice(0, 180),
      meta: { source: e.filename, line: e.lineno },
    });
  });
  window.addEventListener("unhandledrejection", (e) => {
    const msg = (e.reason?.message ?? String(e.reason ?? "rejection")).slice(0, 180);
    push({
      event_type: "error",
      label: msg,
      meta: { kind: "unhandledrejection" },
    });
  });

  setInterval(flush, FLUSH_MS);
  window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush();
  });
  window.addEventListener("pagehide", () => { flush(); });
}

/**
 * Measure a component's mount-to-ready time and attach it to the current
 * navigation trace. Call at the top of a component:
 *   useComponentTrace("HomeFeed");
 * For async readiness, pass `ready=false` until data is loaded, then `true`.
 */
export function useComponentTrace(name: string, ready: boolean = true) {
  const start = typeof performance !== "undefined" ? performance.now() : 0;
  useEffect(() => {
    if (!ready) return;
    const trace_id = currentTraceId;
    const route = currentRoute;
    push({
      event_type: "component",
      label: name,
      duration_ms: Math.round(performance.now() - start),
      trace_id,
      route,
    });
    // We intentionally fire once per (name, ready=true) transition.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, ready]);
}
