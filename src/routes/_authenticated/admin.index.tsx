import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  adminStats, adminListUsers, adminListReports, adminBanUser, adminUnbanUser,
  adminUpdateReport, adminListTransactions,
} from "@/lib/admin.functions";
import { getAppSettings, setAppSetting } from "@/lib/settings.functions";
import { adminGetPaymentConfig, adminSavePaymentConfig } from "@/lib/payments.functions";
import { adminGetCallingConfig, adminSaveCallingConfig } from "@/lib/calling.functions";
import { adminBroadcast, adminListBroadcasts, adminGetFcmConfig, adminSaveFcmConfig, adminClearFcmConfig, adminSendTestPush } from "@/lib/push.functions";
import { getMyProfile } from "@/lib/onboarding.functions";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, Flag, Ban, IndianRupee, Radio, ShieldAlert, Settings as SettingsIcon, ShieldCheck, Wallet as WalletIcon, Bot, Siren, Phone } from "lucide-react";
import { adminListKyc, adminReviewKyc, adminListWithdrawals, adminProcessWithdrawal, getKycDocUrl, adminListKycPurgeLog } from "@/lib/kyc.functions";
import {
  adminListModerationQueue, adminReviewModerationEvent,
  adminListCsamReports, adminFlagCsam, adminUpdateCsamReport,
} from "@/lib/moderation.functions";
import { toast } from "sonner";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: AdminPanel,
});

function StatCard({ icon: Icon, label, value, accent }: any) {
  return (
    <Card className="glass p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground"><Icon className={`size-4 ${accent}`} />{label}</div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
    </Card>
  );
}

function AdminPanel() {
  const profileFn = useServerFn(getMyProfile);
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: () => profileFn() });

  const statsFn = useServerFn(adminStats);
  const usersFn = useServerFn(adminListUsers);
  const reportsFn = useServerFn(adminListReports);
  const txnsFn = useServerFn(adminListTransactions);
  const banFn = useServerFn(adminBanUser);
  const unbanFn = useServerFn(adminUnbanUser);
  const updateReportFn = useServerFn(adminUpdateReport);
  const qc = useQueryClient();

  const { data: stats } = useQuery({ queryKey: ["admin","stats"], queryFn: () => statsFn() });
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all"|"banned"|"creators">("all");
  const { data: users } = useQuery({ queryKey: ["admin","users", q, filter], queryFn: () => usersFn({ data: { q, filter } }) });
  const { data: reports } = useQuery({ queryKey: ["admin","reports"], queryFn: () => reportsFn() });
  const { data: txns } = useQuery({ queryKey: ["admin","txns"], queryFn: () => txnsFn() });

  if (me && !me.isAdmin) {
    return <AppShell><Card className="glass p-8 text-center">Admin access required.</Card></AppShell>;
  }

  return (
    <AppShell isAdmin>
      <div className="flex items-center gap-2 mb-4">
        <ShieldAlert className="size-6 text-accent" />
        <h1 className="text-2xl font-bold">Admin Panel</h1>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <StatCard icon={Users} label="Users" value={stats?.users ?? "—"} accent="text-primary" />
        <StatCard icon={Flag} label="Open reports" value={stats?.openReports ?? "—"} accent="text-destructive" />
        <StatCard icon={Ban} label="Active bans" value={stats?.activeBans ?? "—"} accent="text-destructive" />
        <StatCard icon={IndianRupee} label="Today recharges" value={stats?.todayRecharges ?? "—"} accent="text-success" />
        <StatCard icon={Radio} label="Live chats" value={stats?.activeSessions ?? "—"} accent="text-accent" />
      </div>

      <Tabs defaultValue="users">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
          <TabsTrigger value="moderation">AI Moderation</TabsTrigger>
          <TabsTrigger value="csam">CSAM</TabsTrigger>
          <TabsTrigger value="kyc">KYC</TabsTrigger>
          <TabsTrigger value="withdrawals">Withdrawals</TabsTrigger>
          <TabsTrigger value="purge-log">Purge Log</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="calling">Calling</TabsTrigger>
          <TabsTrigger value="broadcast">Broadcast</TabsTrigger>
          <TabsTrigger value="fcm">Push (FCM)</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-3">
          <div className="flex gap-2">
            <Input placeholder="Search username…" value={q} onChange={(e) => setQ(e.target.value)} />
            <Select value={filter} onValueChange={(v) => setFilter(v as any)}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="creators">Creators</SelectItem>
                <SelectItem value="banned">Banned</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {(users ?? []).map((u: any) => (
            <Card key={u.id} className="glass p-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium truncate">{u.username ?? "—"}</p>
                  {u.is_creator && <Badge variant="secondary" className="text-xs">Creator</Badge>}
                  {u.is_banned && <Badge variant="destructive" className="text-xs">Banned</Badge>}
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {[u.gender, u.country].filter(Boolean).join(" · ")}
                  {u.ban_reason ? ` · Reason: ${u.ban_reason}` : ""}
                </p>
              </div>
              {u.is_banned ? (
                <Button size="sm" variant="outline" onClick={async () => {
                  await unbanFn({ data: { userId: u.id } });
                  toast.success("Unbanned");
                  qc.invalidateQueries({ queryKey: ["admin"] });
                }}>Unban</Button>
              ) : (
                <BanDialog onBan={async (reason, type, days) => {
                  await banFn({ data: { userId: u.id, reason, type, days } });
                  toast.success("User banned");
                  qc.invalidateQueries({ queryKey: ["admin"] });
                }} />
              )}
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="reports" className="space-y-3">
          {(reports ?? []).map((r: any) => (
            <Card key={r.id} className="glass p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm"><strong>{r.reporter_username}</strong> → <strong>{r.target_username}</strong></p>
                  <p className="text-xs text-muted-foreground">{r.reason} · {format(new Date(r.created_at), "dd MMM HH:mm")}</p>
                </div>
                <Badge variant={r.status === "open" ? "destructive" : "secondary"}>{r.status}</Badge>
              </div>
              {r.message_excerpt && <p className="text-xs glass rounded p-2">"{r.message_excerpt}"</p>}
              {r.context && <p className="text-xs text-muted-foreground">{r.context}</p>}
              {r.status === "open" && (
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={async () => {
                    await updateReportFn({ data: { reportId: r.id, status: "dismissed" } });
                    qc.invalidateQueries({ queryKey: ["admin"] });
                  }}>Dismiss</Button>
                  <Button size="sm" variant="outline" onClick={async () => {
                    await updateReportFn({ data: { reportId: r.id, status: "reviewed" } });
                    qc.invalidateQueries({ queryKey: ["admin"] });
                  }}>Mark reviewed</Button>
                  <BanDialog
                    label="Ban target & action"
                    onBan={async (reason, type, days) => {
                      await banFn({ data: { userId: r.target_user_id, reason, type, days } });
                      await updateReportFn({ data: { reportId: r.id, status: "actioned", notes: reason } });
                      toast.success("Banned & report actioned");
                      qc.invalidateQueries({ queryKey: ["admin"] });
                    }}
                  />
                </div>
              )}
            </Card>
          ))}
          {!reports?.length && <Card className="glass p-6 text-center text-muted-foreground text-sm">No reports.</Card>}
        </TabsContent>

        <TabsContent value="moderation" className="space-y-3">
          <ModerationTab />
        </TabsContent>

        <TabsContent value="csam" className="space-y-3">
          <CsamTab />
        </TabsContent>

        <TabsContent value="kyc" className="space-y-3">
          <KycTab />
        </TabsContent>

        <TabsContent value="withdrawals" className="space-y-3">
          <WithdrawalsTab />
        </TabsContent>

        <TabsContent value="purge-log" className="space-y-3">
          <PurgeLogTab />
        </TabsContent>

        <TabsContent value="transactions" className="space-y-2">
          {(txns ?? []).map((t: any) => (
            <Card key={t.id} className="glass p-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">{t.username} · <span className="capitalize">{t.type.replace("_"," ")}</span></p>
                <p className="text-xs text-muted-foreground">{format(new Date(t.created_at), "dd MMM HH:mm")}</p>
              </div>
              <div className={`font-mono text-sm ${t.coins_delta > 0 ? "text-success" : "text-destructive"}`}>
                {t.coins_delta > 0 ? "+" : ""}{t.coins_delta}
                {Number(t.inr_amount) > 0 && <span className="text-muted-foreground"> · ₹{t.inr_amount}</span>}
              </div>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="payments" className="space-y-3">
          <PaymentsTab />
        </TabsContent>

        <TabsContent value="calling" className="space-y-3">
          <CallingTab />
        </TabsContent>

        <TabsContent value="broadcast" className="space-y-3">
          <BroadcastTab />
        </TabsContent>



        <TabsContent value="settings" className="space-y-3">
          <SettingsTab />
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}

function SettingsTab() {
  const settingsFn = useServerFn(getAppSettings);
  const setFn = useServerFn(setAppSetting);
  const qc = useQueryClient();
  const { data: settings, isLoading } = useQuery({
    queryKey: ["app-settings"],
    queryFn: () => settingsFn(),
  });

  async function toggle(key: "connect_filters_visible", value: boolean) {
    try {
      await setFn({ data: { key, value } });
      toast.success("Setting updated");
      qc.invalidateQueries({ queryKey: ["app-settings"] });
    } catch (e: any) {
      toast.error(e.message ?? "Failed to update");
    }
  }

  return (
    <Card className="glass p-4">
      <div className="flex items-center gap-2 mb-3">
        <SettingsIcon className="size-4 text-primary" />
        <h2 className="font-semibold">Feature visibility</h2>
      </div>
      <div className="flex items-center justify-between gap-3 py-2">
        <div className="min-w-0">
          <p className="font-medium text-sm">Connect screen filters</p>
          <p className="text-xs text-muted-foreground">
            Show language / country / state filter section on the Connect screen.
          </p>
        </div>
        <Switch
          checked={settings?.connect_filters_visible ?? true}
          disabled={isLoading}
          onCheckedChange={(v) => toggle("connect_filters_visible", v)}
        />
      </div>
    </Card>
  );
}

function PaymentsTab() {
  const qc = useQueryClient();
  const getCfg = useServerFn(adminGetPaymentConfig);
  const saveCfg = useServerFn(adminSavePaymentConfig);
  const { data: cfg, isLoading } = useQuery({
    queryKey: ["admin-payment-config"],
    queryFn: () => getCfg(),
  });
  const [keyId, setKeyId] = useState("");
  const [keySecret, setKeySecret] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [busy, setBusy] = useState(false);

  async function save(patch: { mode?: "test" | "live"; key_id?: string; key_secret?: string; webhook_secret?: string }) {
    setBusy(true);
    try {
      await saveCfg({ data: patch });
      toast.success("Saved");
      qc.invalidateQueries({ queryKey: ["admin-payment-config"] });
      qc.invalidateQueries({ queryKey: ["payment-config"] });
      setKeyId(""); setKeySecret(""); setWebhookSecret("");
    } catch (e: any) {
      toast.error(e.message ?? "Save failed");
    } finally {
      setBusy(false);
    }
  }

  const isLive = cfg?.mode === "live";
  const ready = cfg?.has_key_id && cfg?.has_key_secret && cfg?.has_webhook_secret;

  return (
    <Card className="glass p-4 space-y-4">
      <div className="flex items-center gap-2">
        <WalletIcon className="size-4 text-primary" />
        <h2 className="font-semibold">Razorpay payments</h2>
      </div>

      <div className="flex items-center justify-between gap-3 rounded-md border border-border/60 p-3">
        <div className="min-w-0">
          <p className="text-sm font-medium">Mode: <span className={isLive ? "text-success" : "text-warning"}>{isLive ? "LIVE" : "TEST"}</span></p>
          <p className="text-xs text-muted-foreground">
            {isLive
              ? "Real payments are being processed."
              : "Test mode — coins credit instantly without real money."}
          </p>
        </div>
        <Switch
          checked={isLive}
          disabled={isLoading || busy || (!isLive && !ready)}
          onCheckedChange={(v) => save({ mode: v ? "live" : "test" })}
        />
      </div>
      {!ready && (
        <p className="text-xs text-warning">
          Add all 3 values below before switching to LIVE.
        </p>
      )}

      <div className="space-y-2">
        <label className="text-xs font-medium">Razorpay Key ID {cfg?.has_key_id && <span className="text-muted-foreground">· current: {cfg.key_id_masked}</span>}</label>
        <div className="flex gap-2">
          <Input placeholder="rzp_live_… or rzp_test_…" value={keyId} onChange={(e) => setKeyId(e.target.value)} />
          <Button disabled={busy || !keyId} onClick={() => save({ key_id: keyId })}>Save</Button>
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-medium">Razorpay Key Secret {cfg?.has_key_secret && <span className="text-muted-foreground">· current: {cfg.key_secret_masked}</span>}</label>
        <div className="flex gap-2">
          <Input type="password" placeholder="••••••••" value={keySecret} onChange={(e) => setKeySecret(e.target.value)} />
          <Button disabled={busy || !keySecret} onClick={() => save({ key_secret: keySecret })}>Save</Button>
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-medium">Webhook Secret {cfg?.has_webhook_secret && <span className="text-muted-foreground">· current: {cfg.webhook_secret_masked}</span>}</label>
        <div className="flex gap-2">
          <Input type="password" placeholder="••••••••" value={webhookSecret} onChange={(e) => setWebhookSecret(e.target.value)} />
          <Button disabled={busy || !webhookSecret} onClick={() => save({ webhook_secret: webhookSecret })}>Save</Button>
        </div>
      </div>

      <div className="rounded-md border border-border/60 p-3 text-xs space-y-1">
        <p className="font-semibold">Webhook URL (paste in Razorpay Dashboard → Settings → Webhooks):</p>
        <code className="block break-all bg-muted/40 p-2 rounded text-[11px]">
          {typeof window !== "undefined" ? window.location.origin : ""}/api/public/razorpay-webhook
        </code>
        <p className="text-muted-foreground mt-1">Enable events: <b>payment.captured</b>, <b>payment.failed</b>, <b>order.paid</b>.</p>
      </div>
    </Card>
  );
}

function CallingTab() {
  const qc = useQueryClient();
  const getCfg = useServerFn(adminGetCallingConfig);
  const saveCfg = useServerFn(adminSaveCallingConfig);
  const { data: cfg, isLoading } = useQuery({
    queryKey: ["admin-calling-config"],
    queryFn: () => getCfg(),
  });
  const [appId, setAppId] = useState("");
  const [appCert, setAppCert] = useState("");
  const [busy, setBusy] = useState(false);

  async function save(patch: { provider?: "mock" | "agora"; app_id?: string; app_certificate?: string }) {
    setBusy(true);
    try {
      await saveCfg({ data: patch });
      toast.success("Saved");
      qc.invalidateQueries({ queryKey: ["admin-calling-config"] });
      qc.invalidateQueries({ queryKey: ["calling-config"] });
      setAppId(""); setAppCert("");
    } catch (e: any) {
      toast.error(e.message ?? "Save failed");
    } finally {
      setBusy(false);
    }
  }

  const isAgora = cfg?.provider === "agora";
  const ready = cfg?.has_app_id && cfg?.has_app_certificate;

  return (
    <Card className="glass p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Phone className="size-4 text-primary" />
        <h2 className="font-semibold">Calling infrastructure (Agora)</h2>
      </div>

      <div className="flex items-center justify-between gap-3 rounded-md border border-border/60 p-3">
        <div className="min-w-0">
          <p className="text-sm font-medium">
            Provider: <span className={isAgora ? "text-success" : "text-warning"}>{isAgora ? "AGORA" : "MOCK (P2P sim)"}</span>
          </p>
          <p className="text-xs text-muted-foreground">
            {isAgora
              ? "Real Agora channels — low-latency audio/video with auto-reconnect."
              : "Pre-production WebRTC simulation. Switch to Agora before production launch."}
          </p>
        </div>
        <Switch
          checked={isAgora}
          disabled={isLoading || busy || (!isAgora && !ready)}
          onCheckedChange={(v) => save({ provider: v ? "agora" : "mock" })}
        />
      </div>
      {!ready && (
        <p className="text-xs text-warning">
          Add both App ID and App Certificate below before switching to AGORA.
        </p>
      )}

      <div className="space-y-2">
        <label className="text-xs font-medium">
          Agora App ID {cfg?.has_app_id && <span className="text-muted-foreground">· current: {cfg.app_id_masked}</span>}
        </label>
        <div className="flex gap-2">
          <Input placeholder="e.g. a1b2c3d4e5f6..." value={appId} onChange={(e) => setAppId(e.target.value)} />
          <Button disabled={busy || !appId} onClick={() => save({ app_id: appId })}>Save</Button>
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-medium">
          Agora App Certificate {cfg?.has_app_certificate && <span className="text-muted-foreground">· current: {cfg.app_certificate_masked}</span>}
        </label>
        <div className="flex gap-2">
          <Input type="password" placeholder="••••••••" value={appCert} onChange={(e) => setAppCert(e.target.value)} />
          <Button disabled={busy || !appCert} onClick={() => save({ app_certificate: appCert })}>Save</Button>
        </div>
      </div>

      <div className="rounded-md border border-border/60 p-3 text-xs space-y-1">
        <p className="font-semibold">Setup steps:</p>
        <ol className="list-decimal pl-4 space-y-0.5 text-muted-foreground">
          <li>Create an account at <code className="bg-muted/40 px-1 rounded">console.agora.io</code></li>
          <li>Create a project with <b>"Secured mode: APP ID + Token"</b> (never use App ID-only mode)</li>
          <li>Copy the <b>App ID</b> and generate the <b>Primary App Certificate</b></li>
          <li>Paste both above and toggle Provider to AGORA</li>
        </ol>
        <p className="text-muted-foreground mt-1">Tokens are short-lived (1 hr) and scoped per-user per-channel.</p>
      </div>
    </Card>
  );
}







function BanDialog({ onBan, label = "Ban" }: { onBan: (reason: string, type: "temp"|"perm", days?: number) => Promise<void>; label?: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [type, setType] = useState<"temp"|"perm">("perm");
  const [days, setDays] = useState(7);
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="destructive">{label}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Ban user</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Select value={type} onValueChange={(v) => setType(v as any)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="perm">Permanent</SelectItem>
              <SelectItem value="temp">Temporary</SelectItem>
            </SelectContent>
          </Select>
          {type === "temp" && (
            <Input type="number" min={1} max={365} value={days} onChange={(e) => setDays(parseInt(e.target.value) || 1)} placeholder="Days" />
          )}
          <Textarea placeholder="Reason (visible internally)" value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
        <DialogFooter>
          <Button onClick={async () => {
            if (reason.trim().length < 2) return toast.error("Reason required");
            setBusy(true);
            try { await onBan(reason.trim(), type, type === "temp" ? days : undefined); setOpen(false); }
            catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
          }} disabled={busy} variant="destructive">Confirm ban</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function KycDocLink({ path, label }: { path: string; label: string }) {
  const urlFn = useServerFn(getKycDocUrl);
  async function open() {
    try {
      const { url } = await urlFn({ data: { path } });
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e: any) { toast.error(e.message); }
  }
  return <Button size="sm" variant="outline" type="button" onClick={open}>{label}</Button>;
}

function KycTab() {
  const listFn = useServerFn(adminListKyc);
  const reviewFn = useServerFn(adminReviewKyc);
  const qc = useQueryClient();
  const [status, setStatus] = useState<"pending"|"approved"|"rejected"|"all">("pending");
  const { data } = useQuery({ queryKey: ["admin","kyc", status], queryFn: () => listFn({ data: { status } }) });
  const [notes, setNotes] = useState<Record<string,string>>({});

  async function decide(id: string, decision: "approved"|"rejected") {
    if (decision === "rejected" && !(notes[id] ?? "").trim()) return toast.error("Add rejection reason");
    try {
      await reviewFn({ data: { id, decision, notes: notes[id] } });
      toast.success(`KYC ${decision}`);
      qc.invalidateQueries({ queryKey: ["admin","kyc"] });
    } catch (e: any) { toast.error(e.message); }
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <ShieldCheck className="size-4 text-primary" />
        <Select value={status} onValueChange={(v) => setStatus(v as any)}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="all">All</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {!data?.length && <Card className="glass p-6 text-center text-muted-foreground text-sm">No KYC requests.</Card>}
      {(data ?? []).map((k: any) => (
        <Card key={k.id} className="glass p-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-medium">{k.full_name} <span className="text-xs text-muted-foreground">@{k.profile?.username ?? "—"} · {k.profile?.gender ?? "—"}</span></p>
              <p className="text-xs text-muted-foreground">DOB: {k.dob} · PAN: {k.pan_number} · Aadhaar: ****{k.aadhaar_last4}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Payout: {k.payout_method === "bank"
                  ? `Bank • ${k.bank_account_name} • ${k.bank_account_number} • ${k.bank_ifsc}`
                  : `UPI • ${k.upi_id}`}
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">{format(new Date(k.created_at), "dd MMM yyyy, HH:mm")}</p>
              {k.docs_deleted_at ? (
                <p className="text-[11px] text-amber-500 mt-1">Documents purged (retention policy) on {format(new Date(k.docs_deleted_at), "dd MMM yyyy")}</p>
              ) : k.docs_retention_until ? (
                <p className="text-[11px] text-muted-foreground mt-1">Docs auto-delete on {format(new Date(k.docs_retention_until), "dd MMM yyyy")}</p>
              ) : null}
            </div>
            <Badge variant={k.status === "pending" ? "secondary" : k.status === "approved" ? "default" : "destructive"}>{k.status}</Badge>
          </div>
          {!k.docs_deleted_at && (
            <div className="flex flex-wrap gap-2">
              <KycDocLink path={k.pan_doc_path} label="PAN doc" />
              <KycDocLink path={k.aadhaar_front_path} label="Aadhaar front" />
              <KycDocLink path={k.aadhaar_back_path} label="Aadhaar back" />
              <KycDocLink path={k.selfie_path} label="Selfie" />
            </div>
          )}
          {k.status === "pending" && (
            <div className="space-y-2">
              <Textarea placeholder="Notes (required for rejection)" value={notes[k.id] ?? ""} onChange={(e) => setNotes(s => ({ ...s, [k.id]: e.target.value }))} />
              <div className="flex gap-2">
                <Button size="sm" onClick={() => decide(k.id, "approved")}>Approve</Button>
                <Button size="sm" variant="destructive" onClick={() => decide(k.id, "rejected")}>Reject</Button>
              </div>
            </div>
          )}
          {k.status !== "pending" && k.review_notes && <p className="text-xs text-muted-foreground">Notes: {k.review_notes}</p>}
        </Card>
      ))}
    </>
  );
}

function WithdrawalsTab() {
  const listFn = useServerFn(adminListWithdrawals);
  const processFn = useServerFn(adminProcessWithdrawal);
  const qc = useQueryClient();
  const [status, setStatus] = useState<"pending"|"processing"|"paid"|"rejected"|"all">("pending");
  const { data } = useQuery({ queryKey: ["admin","wd", status], queryFn: () => listFn({ data: { status } }) });
  const [utr, setUtr] = useState<Record<string,string>>({});
  const [notes, setNotes] = useState<Record<string,string>>({});

  async function act(id: string, decision: "processing"|"paid"|"rejected") {
    if (decision === "rejected" && !(notes[id] ?? "").trim()) return toast.error("Add rejection reason");
    if (decision === "paid" && !(utr[id] ?? "").trim()) return toast.error("UTR reference required");
    try {
      await processFn({ data: { id, decision, utr_reference: utr[id], notes: notes[id] } });
      toast.success(`Marked ${decision}`);
      qc.invalidateQueries({ queryKey: ["admin","wd"] });
    } catch (e: any) { toast.error(e.message); }
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <WalletIcon className="size-4 text-primary" />
        <Select value={status} onValueChange={(v) => setStatus(v as any)}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="processing">Processing</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="all">All</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {!data?.length && <Card className="glass p-6 text-center text-muted-foreground text-sm">No withdrawals.</Card>}
      {(data ?? []).map((w: any) => {
        const snap = w.payout_snapshot || {};
        return (
          <Card key={w.id} className="glass p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium">@{w.profile?.username ?? "—"} · ₹{Number(w.inr_amount).toFixed(2)} <span className="text-xs text-muted-foreground">({w.coins} coins)</span></p>
                <p className="text-xs text-muted-foreground">
                  {snap.method === "bank"
                    ? `Bank • ${snap.account_name} • ${snap.account_number} • ${snap.ifsc}`
                    : `UPI • ${snap.upi_id}`}
                </p>
                <p className="text-[11px] text-muted-foreground">{format(new Date(w.created_at), "dd MMM yyyy, HH:mm")}</p>
              </div>
              <Badge variant={w.status === "pending" ? "secondary" : w.status === "paid" ? "default" : w.status === "rejected" ? "destructive" : "outline"}>{w.status}</Badge>
            </div>
            {(w.status === "pending" || w.status === "processing") && (
              <div className="space-y-2">
                <Input placeholder="UTR / Transaction reference" value={utr[w.id] ?? ""} onChange={(e) => setUtr(s => ({ ...s, [w.id]: e.target.value }))} />
                <Textarea placeholder="Notes (required for rejection)" value={notes[w.id] ?? ""} onChange={(e) => setNotes(s => ({ ...s, [w.id]: e.target.value }))} />
                <div className="flex flex-wrap gap-2">
                  {w.status === "pending" && <Button size="sm" variant="outline" onClick={() => act(w.id, "processing")}>Mark processing</Button>}
                  <Button size="sm" onClick={() => act(w.id, "paid")}>Mark paid</Button>
                  <Button size="sm" variant="destructive" onClick={() => act(w.id, "rejected")}>Reject & refund</Button>
                </div>
              </div>
            )}
            {w.utr_reference && <p className="text-xs text-muted-foreground">UTR: {w.utr_reference}</p>}
            {w.admin_notes && <p className="text-xs text-muted-foreground">Notes: {w.admin_notes}</p>}
          </Card>
        );
      })}
    </>
  );
}

function PurgeLogTab() {
  const listFn = useServerFn(adminListKycPurgeLog);
  const [runId, setRunId] = useState("");
  const [kycId, setKycId] = useState("");
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin", "purge-log", runId, kycId],
    queryFn: () => listFn({ data: {
      cron_run_id: runId.trim() || undefined,
      kyc_request_id: kycId.trim() || undefined,
      limit: 200,
    } }),
  });

  const grouped = new Map<string, any[]>();
  for (const row of data ?? []) {
    const arr = grouped.get(row.cron_run_id) ?? [];
    arr.push(row);
    grouped.set(row.cron_run_id, arr);
  }

  function exportCsv() {
    const rows = data ?? [];
    const header = ["deleted_at","cron_run_id","kyc_request_id","user_id","username","kyc_status","doc_kind","storage_path","success","error_message"];
    const csv = [header.join(",")].concat(
      rows.map((r: any) => [
        r.deleted_at, r.cron_run_id, r.kyc_request_id, r.user_id,
        r.profile?.username ?? "", r.kyc_status, r.doc_kind,
        r.storage_path, r.success, (r.error_message ?? "").replaceAll(",", " "),
      ].map(v => `"${String(v ?? "").replaceAll('"','""')}"`).join(","))
    ).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `kyc-purge-log-${new Date().toISOString().slice(0,10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  }

  return (
    <>
      <div className="flex flex-wrap gap-2 items-center">
        <ShieldCheck className="size-4 text-primary" />
        <Input placeholder="Filter by cron run ID" value={runId} onChange={(e) => setRunId(e.target.value)} className="w-72" />
        <Input placeholder="Filter by KYC request ID" value={kycId} onChange={(e) => setKycId(e.target.value)} className="w-72" />
        <Button size="sm" variant="outline" onClick={() => refetch()}>Refresh</Button>
        <Button size="sm" variant="outline" onClick={exportCsv} disabled={!data?.length}>Export CSV</Button>
      </div>

      {isLoading && <Card className="glass p-4 text-sm text-muted-foreground">Loading…</Card>}
      {!isLoading && !data?.length && (
        <Card className="glass p-6 text-center text-muted-foreground text-sm">
          No purge events yet. The daily retention job will populate this log.
        </Card>
      )}

      {Array.from(grouped.entries()).map(([rid, rows]) => (
        <Card key={rid} className="glass p-3 space-y-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="text-xs">
              <span className="text-muted-foreground">Cron run:</span>{" "}
              <span className="font-mono">{rid}</span>
            </div>
            <div className="text-xs text-muted-foreground">
              {rows.length} file{rows.length === 1 ? "" : "s"} · {format(new Date(rows[0].deleted_at), "dd MMM yyyy, HH:mm")}
            </div>
          </div>
          <div className="divide-y divide-border/40">
            {rows.map((r: any) => (
              <div key={r.id} className="py-2 flex flex-wrap items-center gap-2 text-xs">
                <Badge variant={r.success ? "default" : "destructive"} className="capitalize">
                  {r.success ? "deleted" : "failed"}
                </Badge>
                <Badge variant={r.kyc_status === "approved" ? "default" : "secondary"} className="capitalize">{r.kyc_status}</Badge>
                <span className="capitalize">{r.doc_kind.replace("_"," ")}</span>
                <span className="text-muted-foreground">@{r.profile?.username ?? "—"}</span>
                <span className="font-mono text-muted-foreground truncate max-w-full">{r.storage_path}</span>
                <span className="text-muted-foreground">KYC: <span className="font-mono">{r.kyc_request_id.slice(0,8)}</span></span>
                {r.error_message && <span className="text-destructive">· {r.error_message}</span>}
              </div>
            ))}
          </div>
        </Card>
      ))}
    </>
  );
}

// ====================== Phase 3 — AI Moderation tab ======================
function ModerationTab() {
  const listFn = useServerFn(adminListModerationQueue);
  const reviewFn = useServerFn(adminReviewModerationEvent);
  const qc = useQueryClient();
  const { data: rows } = useQuery({ queryKey: ["admin", "moderation"], queryFn: () => listFn() });

  async function review(id: string, status: "confirmed" | "dismissed") {
    try {
      await reviewFn({ data: { id, status } });
      toast.success(status === "confirmed" ? "Strike confirmed" : "Dismissed");
      qc.invalidateQueries({ queryKey: ["admin", "moderation"] });
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  const pending = (rows ?? []).filter((r: any) => r.status === "pending_review");
  const recent = (rows ?? []).filter((r: any) => r.status !== "pending_review").slice(0, 50);

  return (
    <>
      <Card className="glass p-3">
        <div className="flex items-center gap-2 mb-2">
          <Bot className="size-4 text-primary" />
          <p className="text-sm font-semibold">Pending review ({pending.length})</p>
        </div>
        <p className="text-[11px] text-muted-foreground mb-3">
          AI score 0.65–0.84. Confirm to register a strike (3 confirmed in 30 days = auto-ban).
        </p>
        {pending.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4">Queue empty.</p>
        )}
        <div className="space-y-2">
          {pending.map((r: any) => (
            <div key={r.id} className="rounded-md border p-2 text-xs">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="destructive" className="capitalize">{r.category}</Badge>
                <Badge variant="secondary" className="capitalize">{r.kind}</Badge>
                <span className="font-mono">sev {r.severity} · score {Number(r.ai_score ?? 0).toFixed(2)}</span>
                <span className="text-muted-foreground ml-auto">{format(new Date(r.created_at), "dd MMM HH:mm")}</span>
              </div>
              <p className="mt-1">
                Target: <strong>@{r.target?.username ?? "—"}</strong>
                {r.target?.strike_count != null && <span className="text-muted-foreground"> · strikes: {r.target.strike_count}</span>}
              </p>
              {r.ai_label && <p className="text-muted-foreground italic">"{r.ai_label}"</p>}
              {r.evidence?.snippet && (
                <p className="mt-1 rounded bg-muted/40 p-1.5 font-mono text-[11px]">{r.evidence.snippet}</p>
              )}
              <div className="mt-2 flex gap-2">
                <Button size="sm" variant="destructive" onClick={() => review(r.id, "confirmed")}>Confirm strike</Button>
                <Button size="sm" variant="outline" onClick={() => review(r.id, "dismissed")}>Dismiss</Button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="glass p-3">
        <p className="text-sm font-semibold mb-2">Recent decisions</p>
        <div className="divide-y divide-border/40">
          {recent.map((r: any) => (
            <div key={r.id} className="py-1.5 flex flex-wrap items-center gap-2 text-xs">
              <Badge variant={r.status === "confirmed" ? "destructive" : "secondary"} className="capitalize">{r.status}</Badge>
              <Badge variant="outline" className="capitalize">{r.category}</Badge>
              <span className="text-muted-foreground">sev {r.severity}</span>
              <span className="truncate">@{r.target?.username ?? "—"}</span>
              <span className="ml-auto text-muted-foreground">{format(new Date(r.created_at), "dd MMM HH:mm")}</span>
            </div>
          ))}
          {recent.length === 0 && <p className="text-xs text-muted-foreground text-center py-3">Nothing yet.</p>}
        </div>
      </Card>
    </>
  );
}

// ====================== Phase 3 — CSAM escalation tab ======================
function CsamTab() {
  const listFn = useServerFn(adminListCsamReports);
  const updateFn = useServerFn(adminUpdateCsamReport);
  const flagFn = useServerFn(adminFlagCsam);
  const qc = useQueryClient();
  const { data: rows } = useQuery({ queryKey: ["admin", "csam"], queryFn: () => listFn() });

  const [open, setOpen] = useState(false);
  const [targetUserId, setTargetUserId] = useState("");
  const [narrative, setNarrative] = useState("");
  const [evidenceHash, setEvidenceHash] = useState("");
  const [busy, setBusy] = useState(false);

  async function submitFlag() {
    if (narrative.trim().length < 20) return toast.error("Narrative must be at least 20 characters");
    setBusy(true);
    try {
      await flagFn({ data: { targetUserId, narrative, evidenceHash: evidenceHash || undefined } });
      toast.success("Escalation queued · user permanently banned");
      setOpen(false); setTargetUserId(""); setNarrative(""); setEvidenceHash("");
      qc.invalidateQueries({ queryKey: ["admin", "csam"] });
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
    } catch (e: any) {
      toast.error(e.message);
    } finally { setBusy(false); }
  }

  async function setStatus(id: string, status: "queued" | "escalated" | "closed", caseRef?: string) {
    try {
      await updateFn({ data: { id, status, caseRef } });
      qc.invalidateQueries({ queryKey: ["admin", "csam"] });
    } catch (e: any) { toast.error(e.message); }
  }

  return (
    <>
      <Card className="glass p-3 border-destructive/40">
        <div className="flex items-center gap-2 mb-2">
          <Siren className="size-4 text-destructive" />
          <p className="text-sm font-semibold">CSAM escalation queue</p>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="destructive" className="ml-auto">New escalation</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Flag for law-enforcement escalation</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <p className="text-xs mb-1 text-muted-foreground">Target user ID (UUID)</p>
                  <Input value={targetUserId} onChange={(e) => setTargetUserId(e.target.value)} placeholder="00000000-0000-…" />
                </div>
                <div>
                  <p className="text-xs mb-1 text-muted-foreground">Narrative (what was observed, when, witnesses)</p>
                  <Textarea rows={5} value={narrative} onChange={(e) => setNarrative(e.target.value)} />
                </div>
                <div>
                  <p className="text-xs mb-1 text-muted-foreground">Evidence hash (SHA-256 of preserved file, optional)</p>
                  <Input value={evidenceHash} onChange={(e) => setEvidenceHash(e.target.value)} placeholder="sha256:..." />
                </div>
                <p className="text-[11px] text-destructive">
                  Submitting this immediately and permanently bans the target. Preserve evidence offline before submitting.
                </p>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button variant="destructive" onClick={submitFlag} disabled={busy}>
                  {busy ? "Submitting…" : "Ban & escalate"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
        <p className="text-[11px] text-muted-foreground mb-3">
          Sealed records. Update status as you coordinate with NCMEC / local law enforcement (India: cybercrime.gov.in).
        </p>
        {(rows ?? []).length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4">No escalations on record.</p>
        )}
        <div className="space-y-2">
          {(rows ?? []).map((r: any) => (
            <div key={r.id} className="rounded-md border p-2 text-xs space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant={r.status === "escalated" ? "destructive" : r.status === "closed" ? "secondary" : "default"} className="capitalize">{r.status}</Badge>
                <span className="font-mono text-[10px]">{r.id.slice(0,8)}</span>
                <span className="text-muted-foreground ml-auto">{format(new Date(r.created_at), "dd MMM HH:mm")}</span>
              </div>
              <p>Target: <span className="font-mono">{r.target_user_id.slice(0, 8)}…</span></p>
              <p className="whitespace-pre-wrap">{r.narrative}</p>
              {r.evidence_hash && <p className="font-mono text-[10px]">evidence: {r.evidence_hash}</p>}
              {r.case_ref && <p className="text-muted-foreground">case ref: {r.case_ref}</p>}
              <div className="flex gap-2 pt-1">
                {r.status === "queued" && (
                  <Button size="sm" variant="destructive" onClick={() => {
                    const ref = prompt("Case reference (e.g. NCMEC ticket, FIR no.)") ?? undefined;
                    setStatus(r.id, "escalated", ref);
                  }}>Mark escalated</Button>
                )}
                {r.status !== "closed" && (
                  <Button size="sm" variant="outline" onClick={() => setStatus(r.id, "closed")}>Close</Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}

function BroadcastTab() {
  const sendFn = useServerFn(adminBroadcast);
  const listFn = useServerFn(adminListBroadcasts);
  const qc = useQueryClient();
  const { data: history } = useQuery({ queryKey: ["admin","broadcasts"], queryFn: () => listFn() });
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [deepLink, setDeepLink] = useState("");
  const [audience, setAudience] = useState<"all"|"creators"|"users">("all");
  const [sending, setSending] = useState(false);

  async function send() {
    if (!title.trim()) { toast.error("Title required"); return; }
    if (!confirm(`Send "${title}" to ${audience}?`)) return;
    setSending(true);
    try {
      const res = await sendFn({ data: { title, body: body || null, deepLink: deepLink || null, audience } });
      toast.success(`Delivered: ${res.pushed} push / ${res.recipients} recipients`);
      setTitle(""); setBody(""); setDeepLink("");
      qc.invalidateQueries({ queryKey: ["admin","broadcasts"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Send failed");
    } finally { setSending(false); }
  }

  return (
    <>
      <Card className="glass p-4 space-y-3">
        <h3 className="font-semibold flex items-center gap-2"><Radio className="size-4" /> System broadcast</h3>
        <p className="text-xs text-muted-foreground">
          Sends an in-app notification to every selected user, and a system push to those with FCM tokens registered.
          Configure <code>FCM_SERVICE_ACCOUNT_JSON</code> secret to enable native push delivery.
        </p>
        <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
        <Textarea placeholder="Body (optional)" value={body} onChange={(e) => setBody(e.target.value)} maxLength={500} rows={3} />
        <Input placeholder="Deep link (optional, e.g. /recharge)" value={deepLink} onChange={(e) => setDeepLink(e.target.value)} />
        <div className="flex items-center gap-2">
          <Select value={audience} onValueChange={(v) => setAudience(v as any)}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Everyone</SelectItem>
              <SelectItem value="creators">Creators (female)</SelectItem>
              <SelectItem value="users">Non-creators</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={send} disabled={sending}>{sending ? "Sending…" : "Send broadcast"}</Button>
        </div>
      </Card>

      <Card className="glass p-4">
        <h3 className="font-semibold mb-2">History</h3>
        <div className="space-y-2">
          {(history ?? []).map((b: any) => (
            <div key={b.id} className="rounded-md border p-2 text-xs">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="capitalize">{b.audience}</Badge>
                <span className="font-medium">{b.title}</span>
                <span className="ml-auto text-muted-foreground">{format(new Date(b.created_at), "dd MMM HH:mm")}</span>
              </div>
              {b.body && <p className="mt-1 text-muted-foreground">{b.body}</p>}
              <p className="mt-1 text-[10px] text-muted-foreground">push {b.push_sent_count} / {b.recipients_count}</p>
            </div>
          ))}
          {(!history || history.length === 0) && <p className="text-xs text-muted-foreground">No broadcasts yet.</p>}
        </div>
      </Card>
    </>
  );
}

