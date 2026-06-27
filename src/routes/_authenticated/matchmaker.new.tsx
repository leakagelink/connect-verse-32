import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { createMatchmakerRoom } from "@/lib/matchmaker.functions";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Crown } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/matchmaker/new")({
  component: NewMatchmakerRoom,
});

function NewMatchmakerRoom() {
  const navigate = useNavigate();
  const create = useServerFn(createMatchmakerRoom);
  const [title, setTitle] = useState("");
  const [topic, setTopic] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (title.trim().length < 3) {
      toast.error("Title must be at least 3 characters");
      return;
    }
    setBusy(true);
    try {
      const { room } = await create({ data: { title: title.trim(), topic: topic.trim() || undefined } });
      navigate({ to: "/matchmaker/$id", params: { id: room.id } });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell>
      <div className="max-w-md mx-auto">
        <div className="flex items-center gap-2 mb-4">
          <Crown className="size-6 text-amber-400" />
          <h1 className="text-2xl font-bold">Host a Matchmaker Room</h1>
        </div>
        <p className="text-sm text-muted-foreground mb-5">
          You host. Two male candidates compete. Listeners vote & gift. Winner gets a private call with you.
        </p>
        <Card className="glass p-4 space-y-4">
          <div>
            <Label htmlFor="title">Room title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Who can sweep me off my feet?"
              maxLength={60}
            />
          </div>
          <div>
            <Label htmlFor="topic">Topic (optional)</Label>
            <Input
              id="topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Flirty Friday · Hindi only"
              maxLength={120}
            />
          </div>
          <Button onClick={submit} disabled={busy} className="w-full brand-gradient">
            {busy ? "Starting…" : "Go Live"}
          </Button>
        </Card>
      </div>
    </AppShell>
  );
}
