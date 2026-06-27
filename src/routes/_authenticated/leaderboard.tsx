import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Trophy, Sparkles } from "lucide-react";

export const Route = createFileRoute("/_authenticated/leaderboard")({
  component: LeaderboardPage,
});

function LeaderboardPage() {
  return (
    <AppShell>
      <div className="mb-4 flex items-center gap-2">
        <Trophy className="size-6 text-coin" />
        <div>
          <h1 className="text-2xl font-bold">Top Creators</h1>
          <p className="text-sm text-muted-foreground">Most gifted creators leaderboard</p>
        </div>
      </div>

      <Card className="glass p-10 text-center">
        <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-coin/15">
          <Sparkles className="size-8 text-coin" />
        </div>
        <h2 className="text-xl font-bold">Coming Soon</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Weekly creator leaderboard launching soon. Stay tuned!
        </p>
      </Card>
    </AppShell>
  );
}
