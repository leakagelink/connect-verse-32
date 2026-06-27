import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Home, MessageCircle, Wallet, User, Shield, Coins, Sparkles, Zap, History } from "lucide-react";
import { cn } from "@/lib/utils";
import { getMyProfile } from "@/lib/onboarding.functions";
import { APP_NAME } from "@/lib/constants";
import { SafetySignalsProbe } from "@/components/safety-signals-probe";
import { NotificationsBell } from "@/components/notifications-bell";
import { applyChromeForApp, registerPushNotifications, isNative } from "@/lib/native";
import { installDeepLinkHandler } from "@/lib/deep-links";
import { supabase } from "@/integrations/supabase/client";
import { useT, syncStoredLocale, type Locale } from "@/lib/i18n";



export function AppShell({ children, isAdmin }: { children: ReactNode; isAdmin?: boolean }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const profileFn = useServerFn(getMyProfile);
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: () => profileFn() });
  const balance = me?.walletBalance ?? 0;
  const unread = me?.unreadCount ?? 0;
  const admin = isAdmin ?? me?.isAdmin;

  // Phase 4 — Capacitor: status-bar colour, splash hide, push token registration.
  useEffect(() => {
    void applyChromeForApp();
    if (!isNative()) return;
    void (async () => {
      const reg = await registerPushNotifications();
      if (!reg) return;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from("profiles").update({ push_token: reg.token, push_platform: reg.platform }).eq("id", user.id);
    })();
  }, []);


  const nav = [
    { to: "/home", label: "Discover", icon: Home },
    { to: "/chat", label: "Chats", icon: MessageCircle },
    { to: "/wallet", label: "Wallet", icon: Wallet },
    { to: "/settings", label: "Profile", icon: User },
  ] as const;

  return (
    <div className="min-h-screen pb-20">
      <header className="sticky top-0 z-40 glass border-b backdrop-blur-xl">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-2 px-4 py-2.5">
          <Link to="/home" className="flex items-center gap-1.5 font-bold">
            <Sparkles className="size-4 text-primary" />
            <span className="text-sm">{APP_NAME}</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link
              to="/recharge"
              className="inline-flex items-center gap-1 rounded-full bg-coin/15 px-2.5 py-1 text-xs font-semibold text-coin hover:bg-coin/25 transition"
              title="Available coins"
            >
              <Coins className="size-3.5" />
              {balance.toLocaleString("en-IN")}
              <span className="ml-1 rounded-full bg-coin/30 px-1.5 text-[10px]">+</span>
            </Link>
            <Link
              to="/chat"
              className={cn(
                "relative inline-flex size-9 items-center justify-center rounded-full transition",
                pathname.startsWith("/chat") ? "bg-primary/15 text-primary" : "hover:bg-muted text-foreground/80"
              )}
              title="Inbox"
            >
              <Inbox className="size-4.5" />
              {unread > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
                  {unread > 99 ? "99+" : unread}
                </span>
              )}
            </Link>
            <Link
              to="/recents"
              className={cn(
                "inline-flex size-9 items-center justify-center rounded-full transition",
                pathname.startsWith("/recents") ? "bg-primary/15 text-primary" : "hover:bg-muted text-foreground/80"
              )}
              title="Recents · call history"
            >
              <History className="size-4.5" />
            </Link>

            <Link
              to="/settings"
              className={cn(
                "inline-flex size-9 items-center justify-center rounded-full transition",
                pathname.startsWith("/settings") ? "bg-primary/15 text-primary" : "hover:bg-muted text-foreground/80"
              )}
              title="Profile"
            >
              <User className="size-4.5" />
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 pt-4">{children}</main>
      <SafetySignalsProbe />

      <nav className="fixed inset-x-0 bottom-0 z-50 glass border-t">
        <div className="mx-auto flex max-w-3xl items-stretch justify-around px-2 relative">
          {nav.slice(0, 2).map((n) => {
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

          {/* Highlighted Connect CTA */}
          <Link
            to="/connect"
            className="flex flex-1 flex-col items-center justify-end py-1 text-xs"
          >
            <div className={cn(
              "-mt-6 size-14 rounded-full brand-gradient shadow-lg shadow-primary/40 flex items-center justify-center ring-4 ring-background transition-transform",
              pathname.startsWith("/connect") ? "scale-110" : "hover:scale-105 animate-pulse"
            )}>
              <Zap className="size-6 text-primary-foreground" fill="currentColor" />
            </div>
            <span className={cn(
              "mt-1 font-semibold",
              pathname.startsWith("/connect") ? "text-primary" : "text-foreground"
            )}>Connect</span>
          </Link>

          {nav.slice(2).map((n) => {
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
          {admin && (
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
