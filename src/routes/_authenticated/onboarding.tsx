import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyProfile, completeOnboarding } from "@/lib/onboarding.functions";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { COUNTRIES, STATES_BY_COUNTRY } from "@/lib/locations";

export const Route = createFileRoute("/_authenticated/onboarding")({
  component: Onboarding,
});

function Onboarding() {
  const navigate = useNavigate();
  const getProfile = useServerFn(getMyProfile);
  const onboard = useServerFn(completeOnboarding);
  const { data, isLoading } = useQuery({ queryKey: ["me"], queryFn: () => getProfile() });

  const [username, setU] = useState("");
  const [gender, setG] = useState<"male"|"female"|"other"|"">("");
  const [dob, setD] = useState("");
  const [country, setC] = useState("India");
  const [state, setSt] = useState("");
  const [language, setL] = useState("English");
  const [accept, setA] = useState(false);
  const [creator, setCr] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (data?.profile?.is_banned) navigate({ to: "/banned", replace: true });
    if (data?.profile?.onboarded) navigate({ to: "/home", replace: true });
  }, [data, navigate]);

  async function submit() {
    if (!gender || !dob) return toast.error("Fill all fields");
    setBusy(true);
    try {
      await onboard({ data: { username, gender, dob, country, state: state || undefined, language, acceptGuidelines: true as const, asCreator: creator } });
      toast.success("Welcome to ConnectVerse! You got 5 free minutes 🎉");
      navigate({ to: "/home", replace: true });
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  }

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Loading…</div>;

  return (
    <div className="min-h-screen grid place-items-center px-4 py-8">
      <Card className="glass w-full max-w-lg p-6 space-y-4">
        <div>
          <h1 className="text-2xl font-bold">Set up your profile</h1>
          <p className="text-sm text-muted-foreground">A few quick details to get started. You'll get 5 free chat minutes.</p>
        </div>
        <div><Label>Username</Label><Input value={username} onChange={(e) => setU(e.target.value)} placeholder="myname" /></div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Gender</Label>
            <Select value={gender} onValueChange={(v) => setG(v as any)}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="female">Female</SelectItem>
                <SelectItem value="male">Male</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label>Date of birth</Label><Input type="date" value={dob} onChange={(e) => setD(e.target.value)} max={new Date().toISOString().slice(0,10)} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Country</Label><Input value={country} onChange={(e) => setC(e.target.value)} placeholder="India" /></div>
          <div><Label>Language</Label><Input value={language} onChange={(e) => setL(e.target.value)} /></div>
        </div>

        {gender === "female" && (
          <div className="flex items-center justify-between rounded-lg border border-accent/30 bg-accent/10 p-3">
            <div>
              <p className="text-sm font-medium">Join as creator?</p>
              <p className="text-xs text-muted-foreground">Earn coins from chats. KYC required to withdraw.</p>
            </div>
            <Switch checked={creator} onCheckedChange={setCr} />
          </div>
        )}

        <label className="flex items-start gap-2 text-sm cursor-pointer">
          <Checkbox checked={accept} onCheckedChange={(v) => setA(!!v)} className="mt-0.5" />
          <span className="text-muted-foreground">I am <strong className="text-foreground">18 years or older</strong>, and I accept the Community Guidelines: no harassment, nudity, scams, hate, or illegal activity. Violators are banned.</span>
        </label>

        <Button onClick={submit} disabled={busy || !accept} className="w-full brand-gradient text-primary-foreground">
          Create my profile
        </Button>
      </Card>
    </div>
  );
}
