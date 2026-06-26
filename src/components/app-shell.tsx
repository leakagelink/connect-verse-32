import { Link, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Home, MessageCircle, Wallet, User, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

export function AppShell({ children, isAdmin }: { children: ReactNode; isAdmin?: boolean }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const nav = [
    { to: "/home", label: "Discover", icon: Home },
    { to: "/chat", label: "Chats", icon: MessageCircle },
    { to: "/wallet", label: "Wallet", icon: Wallet },
    { to: "/settings", label: "Profile", icon: User },
  ] as const;
  return (
    <div className="min-h-screen pb-20">
      <main className="mx-auto max-w-3xl px-4 pt-4">{children}</main>
      <nav className="fixed inset-x-0 bottom-0 z-50 glass border-t">
        <div className="mx-auto flex max-w-3xl items-stretch justify-around px-2">
          {nav.map((n) => {
            const active = pathname.startsWith(n.to);
            const Icon = n.icon;
            return (
              <Link key={n.to} to={n.to} className={cn(
                "flex flex-1 flex-col items-center gap-1 py-3 text-xs transition-colors",
                active ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}>
                <Icon className="size-5" />
                <span>{n.label}</span>
              </Link>
            );
          })}
          {isAdmin && (
            <Link to="/admin" className={cn(
              "flex flex-1 flex-col items-center gap-1 py-3 text-xs transition-colors",
              pathname.startsWith("/admin") ? "text-accent" : "text-muted-foreground hover:text-foreground"
            )}>
              <Shield className="size-5" />
              <span>Admin</span>
            </Link>
          )}
        </div>
      </nav>
    </div>
  );
}
