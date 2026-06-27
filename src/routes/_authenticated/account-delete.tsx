import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertTriangle, Trash2 } from "lucide-react";
import { deleteMyAccount } from "@/lib/account.functions";
import { getMyProfile } from "@/lib/onboarding.functions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/account-delete")({
  component: AccountDelete,
});

function AccountDelete() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const profileFn = useServerFn(getMyProfile);
  const deleteFn = useServerFn(deleteMyAccount);
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: () => profileFn() });
  const [confirm, setConfirm] = useState("");

  const mut = useMutation({
    mutationFn: () => deleteFn({ data: { confirm: "DELETE" } }),
    onSuccess: async () => {
      toast.success("Your account has been deleted.");
      await qc.cancelQueries();
      qc.clear();
      await supabase.auth.signOut();
      navigate({ to: "/auth", replace: true });
    },
    onError: (e: any) => toast.error(e.message ?? "Could not delete account"),
  });

  return (
    <AppShell isAdmin={me?.isAdmin}>
      <h1 className="text-2xl font-bold mb-4">Delete account</h1>

      <Card className="glass p-5 border-destructive/40">
        <div className="flex items-start gap-3">
          <AlertTriangle className="size-5 text-destructive shrink-0 mt-0.5" />
          <div className="text-sm space-y-2">
            <p className="font-semibold text-destructive">This action is permanent.</p>
            <p>Deleting your account will permanently remove:</p>
            <ul className="list-disc pl-5 space-y-0.5 text-foreground/90">
              <li>Your profile, username, avatar and bio</li>
              <li>Your chats, call history and follow connections</li>
              <li>Your wallet balance and any unused coins (no refund)</li>
              <li>Pending creator earnings that have not been withdrawn</li>
              <li>KYC documents (per our retention policy)</li>
            </ul>
            <p className="text-muted-foreground">Reports filed against your account are retained for safety and legal compliance, in anonymised form.</p>
          </div>
        </div>

        <div className="mt-6 space-y-2">
          <Label>Type <span className="font-mono font-bold">DELETE</span> to confirm</Label>
          <Input
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="DELETE"
            autoComplete="off"
          />
        </div>

        <div className="mt-6 flex gap-2">
          <Button
            variant="destructive"
            disabled={confirm !== "DELETE" || mut.isPending}
            onClick={() => mut.mutate()}
            className="flex-1"
          >
            <Trash2 className="size-4 mr-2" />
            {mut.isPending ? "Deleting…" : "Permanently delete my account"}
          </Button>
          <Button variant="outline" onClick={() => navigate({ to: "/settings" })}>Cancel</Button>
        </div>

        <p className="mt-4 text-xs text-muted-foreground">
          Prefer to take a break? You can sign out from Settings and return any time. If you have a billing dispute, email{" "}
          <a className="underline" href="mailto:support@talkora.app">support@talkora.app</a> first — deletion cannot be undone.
        </p>
      </Card>
    </AppShell>
  );
}
