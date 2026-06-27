import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { listMyNotifications } from "@/lib/notifications.functions";

/** Sticky-header bell with unread badge. */
export function NotificationsBell({ active }: { active?: boolean }) {
  const fn = useServerFn(listMyNotifications);
  const { data } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => fn(),
    refetchInterval: 30_000,
    staleTime: 15_000,
  });
  const unread = data?.unread ?? 0;
  return (
    <Link
      to="/notifications"
      className={cn(
        "relative inline-flex size-9 items-center justify-center rounded-full transition",
        active ? "bg-primary/15 text-primary" : "hover:bg-muted text-foreground/80",
      )}
      title="Notifications"
    >
      <Bell className="size-4.5" />
      {unread > 0 && (
        <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </Link>
  );
}
