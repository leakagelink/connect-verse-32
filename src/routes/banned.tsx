import { createFileRoute, Link } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Ban } from "lucide-react";

export const Route = createFileRoute("/banned")({
  component: Banned,
});

function Banned() {
  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }
  return (
    <div className="min-h-screen grid place-items-center px-4">
      <Card className="glass max-w-md p-8 text-center">
        <Ban className="mx-auto size-12 text-destructive" />
        <h1 className="mt-4 text-2xl font-semibold">Account suspended</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your account has been suspended for violating our community guidelines.
          If you believe this is a mistake, contact support.
        </p>
        <div className="mt-6 flex gap-2 justify-center">
          <Button onClick={signOut} variant="outline">Sign out</Button>
          <Link to="/"><Button variant="ghost">Home</Button></Link>
        </div>
      </Card>
    </div>
  );
}
