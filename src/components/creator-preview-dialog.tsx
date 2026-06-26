import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getPartnerProfile } from "@/lib/follows.functions";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ShieldCheck, BadgeCheck, Camera, Sparkles, Phone, Video, Lock } from "lucide-react";

type Props = {
  userId: string | null;
  kind: "voice" | "video";
  onOpenChange: (v: boolean) => void;
  onConfirm: (userId: string) => void;
};

export function CreatorPreviewDialog({ userId, kind, onOpenChange, onConfirm }: Props) {
  const fetchProfile = useServerFn(getPartnerProfile);
  const { data, isLoading } = useQuery({
    queryKey: ["partner-preview", userId],
    queryFn: () => fetchProfile({ data: { userId: userId! } }),
    enabled: !!userId,
    staleTime: 30_000,
  });

  const p = data?.profile;
  const onlineRecent =
    !!p?.last_seen_at && Date.now() - new Date(p.last_seen_at).getTime() < 90_000;

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

            <DialogFooter className="gap-2 sm:gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button className="brand-gradient" onClick={() => onConfirm(p.id)}>
                {kind === "video" ? <><Video className="size-4 mr-1" />Start video call</> : <><Phone className="size-4 mr-1" />Start voice call</>}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
