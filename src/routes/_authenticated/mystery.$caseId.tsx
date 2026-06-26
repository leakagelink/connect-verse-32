import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { MysteryPanel } from "@/components/mystery-panel";
import { Search } from "lucide-react";

export const Route = createFileRoute("/_authenticated/mystery/$caseId")({
  component: MysteryPage,
});

function MysteryPage() {
  const { caseId } = Route.useParams();
  const [open, setOpen] = useState(true);
  return (
    <AppShell>
      <div className="text-center space-y-3 py-10">
        <Search className="size-10 mx-auto text-primary" />
        <h1 className="text-xl font-bold">Mystery Case</h1>
        <p className="text-xs text-muted-foreground">Tap below to re-open the case file.</p>
        <Button onClick={() => setOpen(true)}>Open Case File</Button>
      </div>
      <MysteryPanel caseId={caseId} open={open} onOpenChange={setOpen} />
    </AppShell>
  );
}
