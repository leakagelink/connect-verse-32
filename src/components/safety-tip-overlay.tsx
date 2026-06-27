import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ShieldAlert } from "lucide-react";

const STORAGE_KEY = "talkora:safety_tip_seen_v1";

/**
 * First-call safety tip overlay. Shows once per device (localStorage flag).
 * Required for Play UGC compliance: warn users before their first interaction
 * about OTP/phone/off-platform handoff scams.
 */
export function SafetyTipOverlay() {
  const [open, setOpen] = useState(false);
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) setOpen(true);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (!open) return;
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [open, countdown]);

  function accept() {
    try { localStorage.setItem(STORAGE_KEY, new Date().toISOString()); } catch { /* ignore */ }
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={() => { /* must accept */ }}>
      <DialogContent className="max-w-md [&>button]:hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlert className="size-5 text-primary" />
            Stay safe on this call
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <p className="font-medium">Please read before you continue:</p>
          <ul className="space-y-2 list-disc pl-5 text-foreground/90">
            <li><strong>Never share OTPs</strong>, bank details, UPI PINs or passwords.</li>
            <li><strong>Don't share your phone number</strong>, address or workplace.</li>
            <li><strong>Don't move to WhatsApp / Telegram / Instagram.</strong> Off-platform contact is the #1 scam pattern.</li>
            <li>If anything feels wrong, tap the red <strong>SOS</strong> button — we end the call & file a report instantly.</li>
            <li>Calls may be sampled by automated safety systems for abuse detection.</li>
          </ul>
          <p className="text-xs text-muted-foreground">
            By tapping the button below you confirm you have read these tips and agree to our Community Guidelines.
          </p>
        </div>
        <DialogFooter>
          <Button onClick={accept} disabled={countdown > 0} className="w-full">
            {countdown > 0 ? `I understand (${countdown})` : "I understand — continue"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
