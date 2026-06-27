import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { adminPerfSummary, adminPerfTraces } from "@/lib/perf.functions";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Activity, AlertTriangle, ChevronDown, ChevronRight, Gauge, Route as RouteIcon, Timer } from "lucide-react";
import { format } from "date-fns";

function msColor(ms: number) {
  if (ms < 400) return "text-success";
  if (ms < 1200) return "text-accent";
  return "text-destructive";
}

export function PerformanceTab() {
  const fn = useServerFn(adminPerfSummary);
  const [windowMinutes, setWindowMinutes] = useState(15);
  const [now, setNow] = useState(Date.now());

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin", "perf", windowMinutes],
    queryFn: () => fn({ data: { windowMinutes } }),
    refetchInterval: 10_000,
  });

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const lastUpdated = data?.generatedAt
    ? Math.max(0, Math.round((now - new Date(data.generatedAt).getTime()) / 1000))
    : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Activity className="size-5 text-accent" />
          <h2 className="font-semibold">Performance — live</h2>
          {lastUpdated !== null && (
            <span className="text-xs text-muted-foreground">updated {lastUpdated}s ago</span>
          )}
        </div>
        <Select value={String(windowMinutes)} onValueChange={(v) => { setWindowMinutes(Number(v)); refetch(); }}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="5">Last 5 min</SelectItem>
            <SelectItem value="15">Last 15 min</SelectItem>
            <SelectItem value="60">Last 1 hour</SelectItem>
            <SelectItem value="360">Last 6 hours</SelectItem>
            <SelectItem value="1440">Last 24 hours</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="glass p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><Gauge className="size-4" />Events</div>
          <div className="mt-1 text-2xl font-bold">{data?.totalEvents ?? "—"}</div>
        </Card>
        <Card className="glass p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><AlertTriangle className="size-4 text-destructive" />Errors</div>
          <div className="mt-1 text-2xl font-bold text-destructive">{data?.totalErrors ?? "—"}</div>
        </Card>
        <Card className="glass p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><Timer className="size-4" />Routes tracked</div>
          <div className="mt-1 text-2xl font-bold">{data?.routes.length ?? "—"}</div>
        </Card>
        <Card className="glass p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><Activity className="size-4" />APIs tracked</div>
          <div className="mt-1 text-2xl font-bold">{data?.apis.length ?? "—"}</div>
        </Card>
      </div>

      <Card className="glass p-4">
        <h3 className="font-semibold mb-3 text-sm">Screen load times</h3>
        {isLoading && <p className="text-xs text-muted-foreground">Loading…</p>}
        {!isLoading && !data?.routes.length && (
          <p className="text-xs text-muted-foreground">No data yet — browse the app to collect metrics.</p>
        )}
        <div className="space-y-1">
          {data?.routes.map((r) => (
            <div key={r.route} className="grid grid-cols-12 gap-2 items-center text-sm py-1.5 border-b border-border/30 last:border-0">
              <div className="col-span-6 truncate font-mono text-xs">{r.route}</div>
              <div className="col-span-2 text-right text-xs text-muted-foreground">{r.count}×</div>
              <div className={`col-span-2 text-right font-medium ${msColor(r.avg)}`}>{r.avg}ms<span className="text-[10px] text-muted-foreground ml-1">avg</span></div>
              <div className={`col-span-2 text-right font-medium ${msColor(r.p95)}`}>{r.p95}ms<span className="text-[10px] text-muted-foreground ml-1">p95</span></div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="glass p-4">
        <h3 className="font-semibold mb-3 text-sm">API latency</h3>
        {!data?.apis.length && <p className="text-xs text-muted-foreground">No API calls captured yet.</p>}
        <div className="space-y-1">
          {data?.apis.slice(0, 30).map((a) => (
            <div key={a.label} className="grid grid-cols-12 gap-2 items-center text-sm py-1.5 border-b border-border/30 last:border-0">
              <div className="col-span-6 truncate font-mono text-xs">{a.label}</div>
              <div className="col-span-1 text-right text-xs text-muted-foreground">{a.count}</div>
              <div className="col-span-2 text-right">
                {a.errors > 0 ? <Badge variant="destructive" className="text-[10px]">{a.errors} err</Badge> : <span className="text-[10px] text-success">ok</span>}
              </div>
              <div className={`col-span-1 text-right text-xs ${msColor(a.avg)}`}>{a.avg}ms</div>
              <div className={`col-span-2 text-right font-medium ${msColor(a.p95)}`}>{a.p95}ms<span className="text-[10px] text-muted-foreground ml-1">p95</span></div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="glass p-4">
        <h3 className="font-semibold mb-3 text-sm flex items-center gap-2"><AlertTriangle className="size-4 text-destructive" />Recent errors</h3>
        {!data?.errors.length && <p className="text-xs text-muted-foreground">No errors in this window 🎉</p>}
        <div className="space-y-2">
          {data?.errors.slice(0, 25).map((e) => (
            <div key={e.label} className="text-sm border-b border-border/30 last:border-0 pb-2">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-mono text-xs">{e.label}</span>
                <Badge variant="destructive" className="text-[10px]">{e.count}×</Badge>
              </div>
              {e.lastRoute && <p className="text-[10px] text-muted-foreground mt-0.5">on {e.lastRoute}</p>}
            </div>
          ))}
        </div>
      </Card>

      <TracesSection windowMinutes={windowMinutes} />
    </div>
  );
}

function TracesSection({ windowMinutes }: { windowMinutes: number }) {
  const fn = useServerFn(adminPerfTraces);
  const [minDurationMs, setMinDurationMs] = useState(0);
  const [openTrace, setOpenTrace] = useState<string | null>(null);
  const { data } = useQuery({
    queryKey: ["admin", "perf", "traces", windowMinutes, minDurationMs],
    queryFn: () => fn({ data: { windowMinutes, minDurationMs, limit: 25 } }),
    refetchInterval: 15_000,
  });

  return (
    <Card className="glass p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-sm flex items-center gap-2">
          <RouteIcon className="size-4 text-accent" />
          Per-navigation traces
        </h3>
        <Select value={String(minDurationMs)} onValueChange={(v) => setMinDurationMs(Number(v))}>
          <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="0">All navs</SelectItem>
            <SelectItem value="500">≥ 500ms</SelectItem>
            <SelectItem value="1000">≥ 1s</SelectItem>
            <SelectItem value="2000">≥ 2s</SelectItem>
            <SelectItem value="5000">≥ 5s</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <p className="text-[11px] text-muted-foreground mb-2">
        Each row = one screen navigation. Expand to see the API calls and components that ran during it.
      </p>
      {!data?.traces.length && (
        <p className="text-xs text-muted-foreground">No traces in this window.</p>
      )}
      <div className="space-y-1">
        {data?.traces.map((t) => {
          const isOpen = openTrace === t.trace_id;
          return (
            <div key={t.trace_id} className="border-b border-border/30 last:border-0">
              <button
                type="button"
                onClick={() => setOpenTrace(isOpen ? null : t.trace_id)}
                className="w-full grid grid-cols-12 gap-2 items-center text-sm py-2 text-left hover:bg-muted/30 rounded px-1"
              >
                <div className="col-span-1">
                  {isOpen ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
                </div>
                <div className="col-span-5 truncate font-mono text-xs">{t.route}</div>
                <div className="col-span-2 text-right text-[10px] text-muted-foreground">
                  {t.startedAt ? format(new Date(t.startedAt), "HH:mm:ss") : "—"}
                </div>
                <div className="col-span-1 text-right text-[10px] text-muted-foreground">{t.apiCount} API</div>
                <div className="col-span-1 text-right">
                  {t.apiErrors > 0 && <Badge variant="destructive" className="text-[10px]">{t.apiErrors}</Badge>}
                </div>
                <div className={`col-span-2 text-right font-medium ${msColor(t.totalMs)}`}>
                  {t.totalMs}ms<span className="text-[10px] text-muted-foreground ml-1">total</span>
                </div>
              </button>
              {isOpen && (
                <div className="pl-6 pb-3 pr-1 text-xs space-y-2">
                  {t.routeLoadMs !== null && (
                    <div className="text-[11px] text-muted-foreground">
                      Route load: <span className={msColor(t.routeLoadMs)}>{t.routeLoadMs}ms</span>
                    </div>
                  )}
                  {t.slowApis.length > 0 && (
                    <div>
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Slowest APIs</div>
                      {t.slowApis.map((a, i) => (
                        <div key={i} className="grid grid-cols-12 gap-2 items-center py-0.5">
                          <div className="col-span-9 truncate font-mono text-[11px]">{a.label}</div>
                          <div className="col-span-1 text-right">
                            {a.ok === false && <Badge variant="destructive" className="text-[9px]">err</Badge>}
                          </div>
                          <div className={`col-span-2 text-right ${msColor(a.duration_ms ?? 0)}`}>
                            {a.duration_ms}ms
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {t.slowComponents.length > 0 && (
                    <div>
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Slowest components</div>
                      {t.slowComponents.map((c, i) => (
                        <div key={i} className="grid grid-cols-12 gap-2 items-center py-0.5">
                          <div className="col-span-10 truncate font-mono text-[11px]">{c.label}</div>
                          <div className={`col-span-2 text-right ${msColor(c.duration_ms ?? 0)}`}>
                            {c.duration_ms}ms
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {t.errors.length > 0 && (
                    <div>
                      <div className="text-[10px] uppercase tracking-wide text-destructive mb-1">Errors</div>
                      {t.errors.map((e, i) => (
                        <div key={i} className="font-mono text-[11px] text-destructive truncate">{e.label}</div>
                      ))}
                    </div>
                  )}
                  {t.slowApis.length === 0 && t.slowComponents.length === 0 && t.errors.length === 0 && (
                    <p className="text-[11px] text-muted-foreground">No child events recorded.</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
