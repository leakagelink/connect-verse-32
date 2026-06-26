import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyProfile } from "@/lib/onboarding.functions";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { LogOut, Shield } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings")({
  component: Settings,
});

function Settings() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const profileFn = useServerFn(getMyProfile);
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: () => profileFn() });

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
      <Card className="glass p-6 flex items-center gap-4">
        <Avatar className="size-16">
          <AvatarFallback className="brand-gradient text-primary-foreground font-bold text-xl">
            {(p?.username ?? "?").slice(0,2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <p className="text-lg font-semibold">{p?.username ?? "—"}</p>
            {p?.is_creator && <Badge variant="secondary">Creator</Badge>}
            {me?.isAdmin && <Badge className="bg-accent text-accent-foreground"><Shield className="size-3 mr-1" />Admin</Badge>}
          </div>
          <p className="text-xs text-muted-foreground">{[p?.gender, p?.country, p?.language].filter(Boolean).join(" · ")}</p>
        </div>
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
