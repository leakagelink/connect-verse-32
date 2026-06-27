import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyProfile, updateMyLanguage } from "@/lib/onboarding.functions";
import { listBlockedUsers } from "@/lib/account.functions";
import { unblockUser } from "@/lib/reports.functions";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LogOut, Shield, Languages, MapPin, Globe, UserCircle, Coins, ShieldAlert, FileText, HeartHandshake, BadgeIndianRupee, ChevronRight, UserX, Trash2 } from "lucide-react";
import { APP_LANGUAGES } from "@/lib/constants";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings")({
  component: Settings,
});

function Settings() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const profileFn = useServerFn(getMyProfile);
  const langFn = useServerFn(updateMyLanguage);
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: () => profileFn() });

  const langMut = useMutation({
    mutationFn: (language: string) => langFn({ data: { language } }),
    onSuccess: () => {
      toast.success("Language updated");
      qc.invalidateQueries({ queryKey: ["me"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const p = me?.profile;

  return (
    <AppShell isAdmin={me?.isAdmin}>
      <h1 className="text-2xl font-bold mb-4">Profile</h1>

      <Card className="glass p-6">
        <div className="flex items-center gap-4">
          <Avatar className="size-20">
            {p?.avatar_url && <AvatarImage src={p.avatar_url} />}
            <AvatarFallback className="brand-gradient text-primary-foreground font-bold text-2xl">
              {(p?.username ?? "?").slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-lg font-semibold truncate">{p?.username ?? "—"}</p>
              {p?.is_creator && <Badge variant="secondary">Creator</Badge>}
              {me?.isAdmin && (
                <Badge className="bg-accent text-accent-foreground">
                  <Shield className="size-3 mr-1" />Admin
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground capitalize mt-0.5">
              {[p?.gender].filter(Boolean).join(" · ") || "—"}
            </p>
          </div>
        </div>

        {/* Followers / Following / Coins */}
        <div className="mt-5 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg bg-muted/40 py-3">
            <p className="text-lg font-bold">{me?.followerCount ?? 0}</p>
            <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Followers</p>
          </div>
          <div className="rounded-lg bg-muted/40 py-3">
            <p className="text-lg font-bold">{me?.followingCount ?? 0}</p>
            <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Following</p>
          </div>
          <div className="rounded-lg bg-coin/10 py-3">
            <p className="text-lg font-bold text-coin flex items-center justify-center gap-1">
              <Coins className="size-4" />
              {(me?.walletBalance ?? 0).toLocaleString("en-IN")}
            </p>
            <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Coins</p>
          </div>
        </div>
      </Card>

      {/* Profile details */}
      <Card className="glass mt-4 p-4 space-y-3 text-sm">
        <p className="text-xs text-muted-foreground uppercase tracking-wide">Profile details</p>
        <Row icon={<UserCircle className="size-4" />} label="Username" value={p?.username ?? "—"} />
        <Row icon={<Globe className="size-4" />} label="Country" value={p?.country ?? "—"} />
        <Row icon={<MapPin className="size-4" />} label="State" value={p?.state ?? "—"} />
        <Row icon={<Languages className="size-4" />} label="Language" value={labelForLang(p?.language)} />
      </Card>

      {/* App language */}
      <Card className="glass mt-4 p-4">
        <div className="flex items-center gap-2 mb-2">
          <Languages className="size-4 text-primary" />
          <p className="text-sm font-semibold">App language</p>
        </div>
        <p className="text-xs text-muted-foreground mb-3">Choose the language you want to see across the app.</p>
        <Select
          value={p?.language ?? "en"}
          onValueChange={(v) => langMut.mutate(v)}
          disabled={langMut.isPending}
        >
          <SelectTrigger><SelectValue placeholder="Select language" /></SelectTrigger>
          <SelectContent>
            {APP_LANGUAGES.map((l) => (
              <SelectItem key={l.code} value={l.code}>{l.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Card>

      <Card className="glass mt-4 p-4 space-y-1 text-sm">
        <p className="text-xs text-muted-foreground">Community guidelines</p>
        <p>No harassment, nudity, scams, hate or illegal activity. Violations result in immediate ban.</p>
      </Card>

      <Button onClick={signOut} variant="outline" className="mt-6 w-full">
        <LogOut className="size-4 mr-2" /> Sign out
      </Button>
    </AppShell>
  );
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex items-center gap-2 text-muted-foreground">{icon}{label}</span>
      <span className="font-medium truncate max-w-[60%] text-right">{value}</span>
    </div>
  );
}

function labelForLang(code?: string | null) {
  if (!code) return "—";
  return APP_LANGUAGES.find((l) => l.code === code)?.name ?? code;
}
