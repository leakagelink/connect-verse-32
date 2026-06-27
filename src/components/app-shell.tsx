import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Home, MessageCircle, Wallet, User, Shield, Coins, Sparkles, Zap, History } from "lucide-react";
import { cn } from "@/lib/utils";
import { getMyProfile } from "@/lib/onboarding.functions";
import { APP_NAME } from "@/lib/constants";
import talkoraLogo from "@/assets/talkora-logo.png.asset.json";
import { SafetySignalsProbe } from "@/components/safety-signals-probe";
import { NotificationsBell } from "@/components/notifications-bell";
import { applyChromeForApp, registerPushNotifications, isNative } from "@/lib/native";
import { installDeepLinkHandler } from "@/lib/deep-links";
import { supabase } from "@/integrations/supabase/client";
import { registerDeviceToken } from "@/lib/push.functions";
import { useT, syncStoredLocale, type Locale } from "@/lib/i18n";



export function AppShell({ children, isAdmin }: { children: ReactNode; isAdmin?: boolean }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const router = useRouter();
  const profileFn = useServerFn(getMyProfile);
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: () => profileFn() });
  const balance = me?.walletBalance ?? 0;
  const unread = me?.unreadCount ?? 0;
  const admin = isAdmin ?? me?.isAdmin;
  const { t, setLocale, locale } = useT();

  // Phase 4 — Capacitor: status-bar colour, splash hide, push token registration.
  // Phase 10 — deep-link bridge (talkora:// → in-app route).
  useEffect(() => {
    let dispose: (() => void) | undefined;
    try {
      void applyChromeForApp().catch((e) => console.warn("[native] chrome failed", e));
      dispose = installDeepLinkHandler(router);
    } catch (e) {
      console.warn("[native] init failed", e);
    }
    if (!isNative()) return dispose;
    // Defer push registration so a missing Firebase config / plugin error
    // never blocks first render and never crashes the splash → home transition.
    const t = setTimeout(() => {
      void (async () => {
        try {
          const reg = await registerPushNotifications();
          if (!reg) return;
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) return;
          await registerDeviceToken({ data: { token: reg.token, platform: reg.platform } });
        } catch (e) {
          console.warn("[push] registration failed (non-fatal)", e);
        }
      })();
    }, 4000);
    return () => {
      clearTimeout(t);
      dispose?.();
    };
  }, [router]);


  // Phase 10 — sync stored locale from profile.app_language whenever it changes.
  useEffect(() => {
    const lang = me?.profile?.language as string | undefined;
    if (lang && lang !== locale) {
      syncStoredLocale(lang);
      setLocale(lang as Locale);
    }
  }, [me?.profile?.language, locale, setLocale]);

  const nav = [
    { to: "/home", label: t("nav.discover"), icon: Home },
    { to: "/chat", label: t("nav.chats"), icon: MessageCircle },
    { to: "/wallet", label: t("nav.wallet"), icon: Wallet },
    { to: "/settings", label: t("nav.profile"), icon: User },
  ] as const;


  return (
    <div className="min-h-screen pb-20">
      <header className="sticky top-0 z-40 glass border-b backdrop-blur-xl safe-top">
        <div className="mx-auto flex max-w-3xl items-center justify-center px-3 py-2 sm:px-4 sm:py-2.5">
          <Link to="/home" className="flex shrink-0 items-center" aria-label={`${APP_NAME} home`}>
            <img
              src={talkoraLogo.url}
              alt={`${APP_NAME} logo`}
              width={36}
              height={36}
              className="size-8 rounded-md sm:size-9"
            />
          </Link>
        </div>
      </header>



      <main className="mx-auto max-w-3xl px-4 pt-4">{children}</main>
      <SafetySignalsProbe />

      <nav className="fixed inset-x-0 bottom-0 z-50 glass border-t safe-bottom">
        <div className="mx-auto flex max-w-3xl items-stretch justify-around gap-0.5 px-1 relative">

          {nav.slice(0, 2).map((n) => {
            const active = pathname.startsWith(n.to);
            const Icon = n.icon;
            return (
              <Link key={n.to} to={n.to} className={cn(
                "flex flex-1 min-w-0 flex-col items-center gap-0.5 py-2 text-[10px] sm:text-xs transition-colors",
                active ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}>
                <Icon className="size-5 shrink-0" />
                <span className="truncate max-w-full">{n.label}</span>
              </Link>
            );
          })}

          {/* Highlighted Connect CTA */}
          <Link
            to="/connect"
            className="flex flex-1 min-w-0 flex-col items-center justify-end py-1 text-[10px] sm:text-xs"
          >
            <div className={cn(
              "-mt-5 size-12 sm:size-14 rounded-full brand-gradient shadow-lg shadow-primary/40 flex items-center justify-center ring-4 ring-background transition-transform shrink-0",
              pathname.startsWith("/connect") ? "scale-110" : "hover:scale-105 animate-pulse"
            )}>
              <Zap className="size-5 sm:size-6 text-primary-foreground" fill="currentColor" />
            </div>
            <span className={cn(
              "mt-0.5 font-semibold truncate max-w-full",
              pathname.startsWith("/connect") ? "text-primary" : "text-foreground"
            )}>Connect</span>
          </Link>

          {nav.slice(2).map((n) => {
            const active = pathname.startsWith(n.to);
            const Icon = n.icon;
            return (
              <Link key={n.to} to={n.to} className={cn(
                "flex flex-1 min-w-0 flex-col items-center gap-0.5 py-2 text-[10px] sm:text-xs transition-colors",
                active ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}>
                <Icon className="size-5 shrink-0" />
                <span className="truncate max-w-full">{n.label}</span>
              </Link>
            );
          })}
          {admin && (
            <Link to="/admin" className={cn(
              "flex flex-1 min-w-0 flex-col items-center gap-0.5 py-2 text-[10px] sm:text-xs transition-colors",
              pathname.startsWith("/admin") ? "text-accent" : "text-muted-foreground hover:text-foreground"
            )}>
              <Shield className="size-5 shrink-0" />
              <span className="truncate max-w-full">Admin</span>
            </Link>
          )}
        </div>
      </nav>
    </div>
  );
}
