import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getPartnerProfile } from "@/lib/follows.functions";
import { checkUserOnline } from "@/lib/presence.functions";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ShieldCheck, BadgeCheck, Camera, Sparkles, Phone, Video, Lock, AlertTriangle, Loader2, RefreshCw, Radio } from "lucide-react";

type Props = {
  userId: string | null;
  kind: "voice" | "video";
  onOpenChange: (v: boolean) => void;
  onConfirm: (userId: string) => void;
  onFindAnother?: () => void;
};

export function CreatorPreviewDialog({ userId, kind, onOpenChange, onConfirm, onFindAnother }: Props) {
  const fetchProfile = useServerFn(getPartnerProfile);
  const checkOnline = useServerFn(checkUserOnline);
  const { data, isLoading } = useQuery({
    queryKey: ["partner-preview", userId],
    queryFn: () => fetchProfile({ data: { userId: userId! } }),
    enabled: !!userId,
    staleTime: 30_000,
  });

  const [checking, setChecking] = useState(false);
  const [offline, setOffline] = useState(false);

  // Live availability polling while dialog is open
  const presenceQuery = useQuery({
    queryKey: ["partner-presence", userId],
    queryFn: () => checkOnline({ data: { userId: userId! } }),
    enabled: !!userId,
    refetchInterval: 4000,
    refetchIntervalInBackground: false,
    staleTime: 0,
  });

  useEffect(() => {
    if (!userId) return;
    if (presenceQuery.data && !presenceQuery.data.online) setOffline(true);
    else if (presenceQuery.data?.online) setOffline(false);
  }, [presenceQuery.data, userId]);

  useEffect(() => {
    // reset on creator change
    setOffline(false);
  }, [userId]);

  const p = data?.profile;
  const liveOnline = presenceQuery.data?.online ?? null;
  const onlineRecent =
    !offline && (liveOnline === true ||
      (liveOnline === null && !!p?.last_seen_at && Date.now() - new Date(p.last_seen_at).getTime() < 90_000));

  async function handleConfirm() {
    if (!p) return;
    setChecking(true);
    try {
      const res = await checkOnline({ data: { userId: p.id } });
      if (!res.online) {
        setOffline(true);
        return;
      }
      onConfirm(p.id);
    } catch {
      setOffline(true);
    } finally {
      setChecking(false);
    }
  }

  return (
    <Dialog open={!!userId} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Creator preview</DialogTitle>
        </DialogHeader>

        {isLoading || !p ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Loading…</div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="relative">
                <Avatar className="size-14">
                  {p.avatar_url && <AvatarImage src={p.avatar_url} />}
                  <AvatarFallback className="brand-gradient text-primary-foreground font-semibold">
                    {(p.username ?? "?").slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                {onlineRecent && (
                  <span className="absolute -bottom-0.5 -right-0.5 size-3.5 rounded-full bg-emerald-500 border-2 border-background" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="font-semibold truncate">{p.username ?? "anon"}</p>
                  {p.is_creator && <BadgeCheck className="size-4 text-primary" />}
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {[p.gender, p.state, p.country].filter(Boolean).join(" · ") || "Profile"}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  <span className="font-medium text-foreground">{data!.followers}</span> followers ·{" "}
                  <span className="font-medium text-foreground">{data!.following}</span> following
                </p>
              </div>
            </div>

            {p.bio && (
              <p className="text-sm text-muted-foreground line-clamp-3 border-l-2 border-primary/40 pl-3">
                {p.bio}
              </p>
            )}

            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Safety & verification</p>
              <div className="flex flex-wrap gap-1.5">
                <Badge variant="secondary" className="gap-1"><ShieldCheck className="size-3" />18+ Verified</Badge>
                {p.is_creator && (
                  <Badge variant="secondary" className="gap-1"><BadgeCheck className="size-3" />Verified Creator</Badge>
                )}
                {p.avatar_url && (
                  <Badge variant="secondary" className="gap-1"><Camera className="size-3" />Photo on file</Badge>
                )}
                {onlineRecent && (
                  <Badge variant="secondary" className="gap-1"><Sparkles className="size-3" />Active now</Badge>
                )}
                <Badge variant="secondary" className="gap-1"><Lock className="size-3" />Private &amp; metered</Badge>
              </div>
              <p className="text-[11px] text-muted-foreground mt-2 leading-relaxed">
                Calls are coin-metered. Sharing personal contact, abuse or harassment is strictly prohibited — report inside the call to ban instantly.
              </p>
            </div>

            {offline && (
              <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs flex items-start gap-2">
                <AlertTriangle className="size-4 text-amber-500 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <p className="font-medium text-amber-700 dark:text-amber-300">Creator just went offline</p>
                  <p className="text-muted-foreground mt-0.5">Pick another available creator to start your call.</p>
                </div>
              </div>
            )}

            <DialogFooter className="gap-2 sm:gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={checking}>Cancel</Button>
              {offline ? (
                <Button
                  className="brand-gradient"
                  onClick={() => { setOffline(false); onFindAnother?.(); }}
                  disabled={!onFindAnother}
                >
                  <RefreshCw className="size-4 mr-1" />Find another
                </Button>
              ) : (
                <Button className="brand-gradient" onClick={handleConfirm} disabled={checking}>
                  {checking ? (
                    <><Loader2 className="size-4 mr-1 animate-spin" />Checking…</>
                  ) : kind === "video" ? (
                    <><Video className="size-4 mr-1" />Start video call</>
                  ) : (
                    <><Phone className="size-4 mr-1" />Start voice call</>
                  )}
                </Button>
              )}
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
