import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Phone, Video, History } from "lucide-react";
import { listRecentPartners } from "@/lib/discovery.functions";

export function RecentlyPlayedSection({
  onCall,
}: {
  onCall: (uid: string, kind: "voice" | "video") => void;
}) {
  const fn = useServerFn(listRecentPartners);
  const navigate = useNavigate();
  const { data } = useQuery({
    queryKey: ["recent-partners"],
    queryFn: () => fn(),
    refetchInterval: 60_000,
  });

  if (!data?.length) return null;

  return (
    <div className="mb-5">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <History className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold uppercase tracking-wider">Recently Played With</h2>
        </div>
        <button
          onClick={() => navigate({ to: "/recents" })}
          className="text-xs text-primary font-medium"
        >
          See all →
        </button>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1 snap-x">
        {data.map((u: any) => (
          <Card
            key={u.id}
            className="glass shrink-0 w-[170px] p-3 snap-start hover:border-primary/40 transition"
          >
            <div className="relative mx-auto w-fit mb-2">
              <Avatar className="size-14">
                {u.avatar_url && <AvatarImage src={u.avatar_url} />}
                <AvatarFallback className="brand-gradient text-primary-foreground">
                  {(u.username ?? "?").slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              {u.online && (
                <span className="absolute bottom-0 right-0 size-3.5 rounded-full bg-emerald-500 border-2 border-background" />
              )}
            </div>
            <p className="text-sm font-semibold truncate text-center">
              @{u.username ?? "anon"}
            </p>
            <p className="text-[10px] text-muted-foreground text-center truncate mb-2">
              {u.country ?? ""} {u.language ? `· ${u.language}` : ""}
            </p>
            <div className="flex gap-1.5">
              <Button
                size="sm"
                variant="secondary"
                className="flex-1 h-8 px-2"
                onClick={() => onCall(u.id, "voice")}
              >
                <Phone className="size-3.5" />
              </Button>
              <Button
                size="sm"
                className="flex-1 h-8 px-2 brand-gradient"
                onClick={() => onCall(u.id, "video")}
              >
                <Video className="size-3.5" />
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
