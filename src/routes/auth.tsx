import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import { APP_NAME } from "@/lib/constants";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: `Sign in — ${APP_NAME}` }] }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/home", replace: true });
    });
  }, [navigate]);

  async function signIn() {
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) toast.error(error.message); else navigate({ to: "/home", replace: true });
  }

  async function signUp() {
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { emailRedirectTo: window.location.origin + "/home" },
    });
    setBusy(false);
    if (error) toast.error(error.message);
    else { toast.success("Account created! Continue to set up your profile."); navigate({ to: "/home", replace: true }); }
  }

  async function google() {
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (r.error) toast.error("Google sign-in failed");
    if (!r.redirected && !r.error) navigate({ to: "/home", replace: true });
  }

  return (
    <div className="min-h-screen grid place-items-center px-4">
      <Card className="glass w-full max-w-md p-8">
        <div className="flex items-center gap-2 font-bold text-lg justify-center">
          <div className="size-8 rounded-lg brand-gradient grid place-items-center">
            <Sparkles className="size-4 text-primary-foreground" />
          </div>
          {APP_NAME}
        </div>
        <p className="mt-2 text-center text-sm text-muted-foreground">18+ verified community</p>

        <Button onClick={google} variant="outline" className="mt-6 w-full">Continue with Google</Button>
        <div className="my-4 flex items-center gap-2 text-xs text-muted-foreground">
          <div className="h-px flex-1 bg-border" /> or <div className="h-px flex-1 bg-border" />
        </div>

        <Tabs defaultValue="signin">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="signin">Sign in</TabsTrigger>
            <TabsTrigger value="signup">Sign up</TabsTrigger>
          </TabsList>
          <TabsContent value="signin" className="space-y-3">
            <div><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            <div><Label>Password</Label><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
            <Button onClick={signIn} disabled={busy} className="w-full brand-gradient text-primary-foreground">Sign in</Button>
          </TabsContent>
          <TabsContent value="signup" className="space-y-3">
            <div><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            <div><Label>Password</Label><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min 6 characters" /></div>
            <Button onClick={signUp} disabled={busy} className="w-full brand-gradient text-primary-foreground">Create account</Button>
            <p className="text-xs text-muted-foreground text-center">By signing up you agree to our community guidelines. 18+ only.</p>
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
}
