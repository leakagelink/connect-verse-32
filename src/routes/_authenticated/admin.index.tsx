import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  adminStats, adminListUsers, adminListReports, adminBanUser, adminUnbanUser,
  adminUpdateReport, adminListTransactions,
} from "@/lib/admin.functions";
import { getAppSettings, setAppSetting } from "@/lib/settings.functions";
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
import { Users, Flag, Ban, IndianRupee, Radio, ShieldAlert, Settings as SettingsIcon, ShieldCheck, Wallet as WalletIcon } from "lucide-react";
import { adminListKyc, adminReviewKyc, adminListWithdrawals, adminProcessWithdrawal, getKycDocUrl, adminListKycPurgeLog } from "@/lib/kyc.functions";
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
          <TabsTrigger value="kyc">KYC</TabsTrigger>
          <TabsTrigger value="withdrawals">Withdrawals</TabsTrigger>
          <TabsTrigger value="purge-log">Purge Log</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
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
