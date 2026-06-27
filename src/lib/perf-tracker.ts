// Lightweight client-side perf tracker.
// - Times route loads via TanStack Router subscriptions
// - Wraps window.fetch to record API latency + errors
// - Captures window error / unhandledrejection
// - Batches events and flushes every 10s to the server
import { logPerfBatch } from "./perf.functions";

type PerfEvent = {
  event_type: "route_load" | "api_call" | "error";
  route?: string | null;
  label?: string | null;
  duration_ms?: number | null;
  status?: number | null;
  ok?: boolean | null;
  meta?: Record<string, any> | null;
};

const MAX_BUFFER = 100;
const FLUSH_MS = 10_000;
const SAMPLE_RATE = 1; // 1 = log everything; lower (e.g. 0.5) to sample
const buffer: PerfEvent[] = [];
let installed = false;
let flushTimer: ReturnType<typeof setInterval> | null = null;

function push(ev: PerfEvent) {
  if (Math.random() > SAMPLE_RATE) return;
  buffer.push(ev);
  if (buffer.length >= MAX_BUFFER) flush();
}

async function flush() {
  if (!buffer.length) return;
  const batch = buffer.splice(0, buffer.length);
  try {
    await logPerfBatch({ data: { events: batch as any } });
  } catch {
    // drop on failure to avoid feedback loops
  }
}

function shortenUrl(u: string): string {
  try {
    const url = new URL(u, window.location.origin);
    // Trim long ids in path
    return (url.origin === window.location.origin ? "" : url.host) +
      url.pathname.replace(/\/[0-9a-f-]{16,}/gi, "/:id");
  } catch {
    return u.slice(0, 120);
  }
}

export function installPerfTracker(router: any) {
  if (installed || typeof window === "undefined") return;
  installed = true;

  // Route load timing
  let navStart = performance.now();
  let pendingRoute: string | null = null;
  try {
    router.subscribe?.("onBeforeLoad", (e: any) => {
      navStart = performance.now();
      pendingRoute = e?.toLocation?.pathname ?? null;
    });
    router.subscribe?.("onLoad", (e: any) => {
      const route = e?.toLocation?.pathname ?? pendingRoute;
      if (!route) return;
      push({
        event_type: "route_load",
        route,
        duration_ms: Math.round(performance.now() - navStart),
      });
    });
  } catch {
    // router may not expose these — that's fine
  }

  // Wrap fetch
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (...args: Parameters<typeof fetch>) => {
    const started = performance.now();
    const input = args[0];
    const url = typeof input === "string" ? input : (input as any)?.url ?? "";
    const label = shortenUrl(url);
    try {
      const res = await originalFetch(...args);
      push({
        event_type: "api_call",
        route: window.location.pathname,
        label,
        duration_ms: Math.round(performance.now() - started),
        status: res.status,
        ok: res.ok,
      });
      return res;
    } catch (err: any) {
      push({
        event_type: "api_call",
        route: window.location.pathname,
        label,
        duration_ms: Math.round(performance.now() - started),
        ok: false,
        meta: { error: String(err?.message ?? err).slice(0, 200) },
      });
      throw err;
    }
  };

  // Global error capture
  window.addEventListener("error", (e) => {
    push({
      event_type: "error",
      route: window.location.pathname,
      label: (e.message || "error").slice(0, 180),
      meta: { source: e.filename, line: e.lineno },
    });
  });
  window.addEventListener("unhandledrejection", (e) => {
    const msg = (e.reason?.message ?? String(e.reason ?? "rejection")).slice(0, 180);
    push({
      event_type: "error",
      route: window.location.pathname,
      label: msg,
      meta: { kind: "unhandledrejection" },
    });
  });

  // Periodic flush + on page hide
  flushTimer = setInterval(flush, FLUSH_MS);
  window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush();
  });
  window.addEventListener("pagehide", () => { flush(); });
}
