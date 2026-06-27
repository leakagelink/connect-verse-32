import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Radio, MoonStar, Circle, X, Globe2, MapPinned } from "lucide-react";
import { toast } from "sonner";
import { updateAvailability, updateLocationBlocks } from "@/lib/safety.functions";
import { getMyProfile } from "@/lib/onboarding.functions";
import { COUNTRIES, STATES_BY_COUNTRY } from "@/lib/locations";

const OPTIONS = [
  { value: "online" as const, label: "Online — receive calls", icon: Radio, color: "text-emerald-500" },
  { value: "busy" as const,   label: "Busy — pause incoming calls", icon: Circle, color: "text-amber-500" },
  { value: "dnd" as const,    label: "Do Not Disturb — hide from Discover", icon: MoonStar, color: "text-rose-500" },
];

/** Female-creator safety controls: availability toggle + geographic blocklist. */
export function CreatorSafetyCard() {
  const qc = useQueryClient();
  const profileFn = useServerFn(getMyProfile);
  const availFn = useServerFn(updateAvailability);
  const blocksFn = useServerFn(updateLocationBlocks);
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: () => profileFn() });
  const p = me?.profile;

  const [country, setCountry] = useState<string>("");
  const [state, setState] = useState<string>("");
  const [blockedCountries, setBlockedCountries] = useState<string[]>([]);
  const [blockedStates, setBlockedStates] = useState<string[]>([]);

  useEffect(() => {
    if (p) {
      setBlockedCountries(((p as any).blocked_countries as string[]) ?? []);
      setBlockedStates(((p as any).blocked_states as string[]) ?? []);
    }
  }, [p]);

  const availMut = useMutation({
    mutationFn: (v: "online" | "busy" | "dnd") => availFn({ data: { availability: v } }),
    onSuccess: (_, v) => {
      toast.success(`Status updated: ${v.toUpperCase()}`);
      qc.invalidateQueries({ queryKey: ["me"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const blocksMut = useMutation({
    mutationFn: () => blocksFn({ data: { blocked_countries: blockedCountries, blocked_states: blockedStates } }),
    onSuccess: () => {
      toast.success("Blocklist saved");
      qc.invalidateQueries({ queryKey: ["me"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const statesForSelected = useMemo(
    () => (country ? STATES_BY_COUNTRY[country] ?? [] : []),
    [country],
  );

  function addCountry() {
    if (!country) return;
    if (blockedCountries.includes(country)) return toast.info("Already on the list");
    setBlockedCountries([...blockedCountries, country]);
    setCountry("");
  }
  function addState() {
    if (!state) return;
    if (blockedStates.includes(state)) return toast.info("Already on the list");
    setBlockedStates([...blockedStates, state]);
    setState("");
  }

  if (!p?.is_creator) return null;
  const current = ((p as any).availability as "online" | "busy" | "dnd") ?? "online";

  return (
    <Card className="glass mt-4 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Radio className="size-4 text-primary" />
        <p className="text-sm font-semibold">Creator availability & safety</p>
        <Badge variant="secondary" className="ml-auto capitalize">{current}</Badge>
      </div>

      <p className="text-xs text-muted-foreground mb-3">
        Control who can see and call you. Changes apply instantly across Discover and Connect.
      </p>

      <div className="space-y-2">
        {OPTIONS.map((o) => {
          const Icon = o.icon;
          const active = current === o.value;
          return (
            <button
              key={o.value}
              onClick={() => availMut.mutate(o.value)}
              disabled={availMut.isPending || active}
              className={`w-full flex items-center gap-3 rounded-lg border p-3 text-left text-sm transition ${
                active ? "border-primary bg-primary/10" : "hover:border-primary/40"
              }`}
            >
              <Icon className={`size-4 ${o.color}`} />
              <span className="flex-1">{o.label}</span>
              {active && <Badge variant="default">Active</Badge>}
            </button>
          );
        })}
      </div>

      {/* Country blocks */}
      <div className="mt-5">
        <div className="flex items-center gap-2 mb-2">
          <Globe2 className="size-4 text-primary" />
          <p className="text-sm font-semibold">Block countries</p>
        </div>
        <p className="text-xs text-muted-foreground mb-2">
          Users from these countries cannot see or call you.
        </p>
        <div className="flex gap-2">
          <Select value={country} onValueChange={setCountry}>
            <SelectTrigger className="flex-1"><SelectValue placeholder="Select country" /></SelectTrigger>
            <SelectContent>
              {COUNTRIES.map((c: string) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={addCountry} disabled={!country}>Add</Button>
        </div>
        <ChipList items={blockedCountries} onRemove={(v) => setBlockedCountries(blockedCountries.filter((x) => x !== v))} empty="No countries blocked" />
      </div>

      {/* State blocks */}
      <div className="mt-5">
        <div className="flex items-center gap-2 mb-2">
          <MapPinned className="size-4 text-primary" />
          <p className="text-sm font-semibold">Block states / regions</p>
        </div>
        <div className="flex gap-2">
          <Select value={state} onValueChange={setState} disabled={!country || statesForSelected.length === 0}>
            <SelectTrigger className="flex-1">
              <SelectValue placeholder={country ? "Select state" : "Pick a country first"} />
            </SelectTrigger>
            <SelectContent>
              {statesForSelected.map((s: string) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={addState} disabled={!state}>Add</Button>
        </div>
        <ChipList items={blockedStates} onRemove={(v) => setBlockedStates(blockedStates.filter((x) => x !== v))} empty="No states blocked" />
      </div>

      <Button onClick={() => blocksMut.mutate()} disabled={blocksMut.isPending} className="mt-4 w-full">
        {blocksMut.isPending ? "Saving…" : "Save blocklist"}
      </Button>
    </Card>
  );
}

function ChipList({ items, onRemove, empty }: { items: string[]; onRemove: (v: string) => void; empty: string }) {
  if (items.length === 0) {
    return <p className="mt-2 text-[11px] text-muted-foreground">{empty}</p>;
  }
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {items.map((it) => (
        <span key={it} className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-[11px]">
          {it}
          <button onClick={() => onRemove(it)} aria-label={`Remove ${it}`} className="hover:text-destructive">
            <X className="size-3" />
          </button>
        </span>
      ))}
    </div>
  );
}
