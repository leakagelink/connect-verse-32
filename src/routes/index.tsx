import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MessageCircle, Shield, Coins, Sparkles, Users, Heart } from "lucide-react";
import { APP_NAME } from "@/lib/constants";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: `${APP_NAME} — Meet, chat, connect safely` },
      { name: "description", content: "Join a premium, verified community for real conversations. 5 free minutes on signup. Strict safety. Built for everyone." },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2 font-bold text-lg">
          <div className="size-8 rounded-lg brand-gradient grid place-items-center">
            <Sparkles className="size-4 text-primary-foreground" />
          </div>
          {APP_NAME}
        </div>
        <Link to="/auth"><Button variant="ghost">Sign in</Button></Link>
      </header>

      <section className="mx-auto max-w-4xl px-6 pt-12 pb-20 text-center">
        <span className="inline-flex items-center gap-1 rounded-full glass px-3 py-1 text-xs text-muted-foreground">
          <Heart className="size-3 text-primary" /> Safe · Verified · 18+
        </span>
        <h1 className="mt-6 text-5xl md:text-7xl font-bold tracking-tight">
          Real <span className="text-gradient">conversations</span>,<br />real people.
        </h1>
        <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto">
          A premium social community where verified members chat, connect and earn — without the noise. Get <strong className="text-foreground">5 free minutes</strong> on signup.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link to="/auth"><Button size="lg" className="brand-gradient text-primary-foreground">Get started — free</Button></Link>
          <a href="#how" className="text-sm text-muted-foreground hover:text-foreground">How it works ↓</a>
        </div>
      </section>

      <section id="how" className="mx-auto max-w-6xl px-6 pb-24 grid gap-4 md:grid-cols-3">
        {[
          { icon: MessageCircle, t: "Realtime chat", d: "1-on-1 messaging with verified members across the world." },
          { icon: Coins, t: "Coin economy", d: "Recharge once and chat freely. Up to 50% bonus on your first deposit." },
          { icon: Shield, t: "Strong safety", d: "18+ only. One-tap block & report. Active human moderation." },
          { icon: Users, t: "Creator program", d: "Eligible members can earn coins from chats. KYC required to withdraw." },
          { icon: Sparkles, t: "Coming soon", d: "HD voice & video calls, live rooms and mini games." },
          { icon: Heart, t: "Made for everyone", d: "Free signup for all. Girls always join free." },
        ].map((f) => (
          <Card key={f.t} className="glass p-6">
            <f.icon className="size-6 text-primary" />
            <h3 className="mt-3 font-semibold">{f.t}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{f.d}</p>
          </Card>
        ))}
      </section>

      <footer className="border-t border-border/50 py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} {APP_NAME}. 18+ only. Be kind. Be safe.
      </footer>
    </div>
  );
}
