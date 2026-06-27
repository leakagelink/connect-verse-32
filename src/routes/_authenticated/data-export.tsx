import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, FileJson, ShieldCheck, ArrowLeft } from "lucide-react";
import { exportMyData } from "@/lib/data-export.functions";
import { getMyProfile } from "@/lib/onboarding.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/data-export")({
  component: DataExport,
});

function DataExport() {
  const navigate = useNavigate();
  const profileFn = useServerFn(getMyProfile);
  const exportFn = useServerFn(exportMyData);
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: () => profileFn() });
  const [busy, setBusy] = useState(false);

  async function download() {
    setBusy(true);
    try {
      const payload = await exportFn();
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      a.href = url;
      a.download = `talkora-data-${stamp}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Your data has been downloaded.");
    } catch (e: any) {
      toast.error(e?.message ?? "Could not prepare your data");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell isAdmin={me?.isAdmin}>
      <button onClick={() => navigate({ to: "/settings" })} className="text-sm text-muted-foreground mb-3 inline-flex items-center gap-1">
        <ArrowLeft className="size-4" /> Back to Settings
      </button>
      <h1 className="text-2xl font-bold mb-1">Download my data</h1>
      <p className="text-sm text-muted-foreground mb-4">
        Get a copy of the personal data Talkora holds about your account, in a portable JSON file.
      </p>

      <Card className="glass p-5">
        <div className="flex items-start gap-3">
          <ShieldCheck className="size-5 text-primary shrink-0 mt-0.5" />
          <div className="text-sm space-y-2">
            <p className="font-semibold">What's included</p>
            <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
              <li>Profile (username, gender, country, state, language, DOB)</li>
              <li>Wallet balance and full transaction history</li>
              <li>Call history (audio &amp; video, incoming and outgoing)</li>
              <li>Messages you have sent (last 5,000)</li>
              <li>People you follow and your followers</li>
              <li>Reports you have filed</li>
              <li>Gifts sent and received</li>
              <li>KYC request status (without document files)</li>
              <li>Withdrawal requests</li>
              <li>Users you have blocked</li>
            </ul>
            <p className="font-semibold pt-2">What's not included</p>
            <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
              <li>Other users' private messages or personal data</li>
              <li>Uploaded KYC documents (subject to our retention policy)</li>
              <li>Internal moderation notes against your account</li>
            </ul>
          </div>
        </div>

        <Button onClick={download} disabled={busy} className="mt-6 w-full">
          {busy ? (
            <><FileJson className="size-4 mr-2 animate-pulse" /> Preparing your data…</>
          ) : (
            <><Download className="size-4 mr-2" /> Download as JSON</>
          )}
        </Button>

        <p className="mt-4 text-xs text-muted-foreground">
          The file is generated on demand and is not stored on our servers. Keep it safe — it contains personal information.
          For other privacy requests, email <a className="underline" href="mailto:support@talkora.app">support@talkora.app</a>.
        </p>
      </Card>
    </AppShell>
  );
}
