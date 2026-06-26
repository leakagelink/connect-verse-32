import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Wifi, CreditCard, RefreshCw, LogIn, PackageX, CheckCircle2, LifeBuoy } from "lucide-react";
import type { ParsedRechargeError, RechargeErrorCode } from "@/lib/recharge-errors";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  error: ParsedRechargeError | null;
  /** Plan the user was trying to buy. Used for "Retry". */
  planId?: string | null;
  onRetry?: (planId: string) => void;
  onRefreshBalance?: () => void;
  onPickAnotherPlan?: () => void;
  onReauth?: () => void;
};

const ICONS: Record<RechargeErrorCode, React.ComponentType<{ className?: string }>> = {
  NETWORK: Wifi,
  BILLING_DECLINED: CreditCard,
  PLAN_NOT_FOUND: PackageX,
  PLAN_INACTIVE: PackageX,
  ALREADY_PURCHASED: CheckCircle2,
  WALLET_MISSING: AlertTriangle,
  UNAUTHORIZED: LogIn,
  DB_UPDATE_FAILED: RefreshCw,
  UNKNOWN: AlertTriangle,
};

const STEPS: Record<RechargeErrorCode, string[]> = {
  NETWORK: [
    "Check your Wi-Fi or mobile data signal.",
    "Disable any VPN or proxy and try once more.",
    "Stay on this screen — your call is still connected.",
    "Tap Retry to attempt the same plan again.",
  ],
  BILLING_DECLINED: [
    "Your bank declined the transaction.",
    "Try a smaller plan or a different amount.",
    "Switch to another payment method (UPI / card / netbanking) when available.",
    "If declines repeat, contact your bank or our support.",
  ],
  PLAN_NOT_FOUND: [
    "This plan was removed from the catalog.",
    "Go back to the plan list and pick any other active plan.",
    "Your call stays connected while you choose.",
  ],
  PLAN_INACTIVE: [
    "This plan is temporarily disabled.",
    "Choose another active plan from the list below the toast.",
    "Bonuses still apply on your eligible deposit number.",
  ],
  ALREADY_PURCHASED: [
    "We detected a recent successful charge for this same plan.",
    "Your coins may already be credited — tap Refresh balance.",
    "If coins didn't arrive within a minute, contact support with the time of purchase.",
  ],
  WALLET_MISSING: [
    "Your wallet record couldn't be loaded.",
    "Sign out and sign back in to recreate the wallet.",
    "Your call will end on sign-out — finish the call first if possible.",
  ],
  UNAUTHORIZED: [
    "Your session expired during the call.",
    "Sign in again to continue recharging.",
    "After sign-in, return to Connect and resume the call.",
  ],
  DB_UPDATE_FAILED: [
    "A temporary server issue prevented the wallet update.",
    "Wait a few seconds and tap Retry.",
    "If it keeps failing, switch to another plan or contact support.",
  ],
  UNKNOWN: [
    "Something unexpected happened.",
    "Tap Retry to try again, or pick a different plan.",
    "If the issue persists, share the error code with support.",
  ],
};

export function RechargeHelpDialog({
  open,
  onOpenChange,
  error,
  planId,
  onRetry,
  onRefreshBalance,
  onPickAnotherPlan,
  onReauth,
}: Props) {
  if (!error) return null;
  const Icon = ICONS[error.code] ?? AlertTriangle;
  const steps = STEPS[error.code] ?? STEPS.UNKNOWN;

  const close = () => onOpenChange(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="inline-flex size-9 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <Icon className="size-5" />
            </span>
            <span>
              {error.title}
              <span className="ml-2 rounded bg-muted px-1.5 py-0.5 align-middle font-mono text-[10px] uppercase text-muted-foreground">
                {error.code}
              </span>
            </span>
          </DialogTitle>
          <DialogDescription>{error.description}</DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border bg-muted/30 p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Next steps
          </p>
          <ol className="space-y-1.5 text-sm">
            {steps.map((s, i) => (
              <li key={i} className="flex gap-2">
                <span className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
                  {i + 1}
                </span>
                <span>{s}</span>
              </li>
            ))}
          </ol>
        </div>

        <p className="flex items-center gap-1 text-xs text-emerald-500">
          <CheckCircle2 className="size-3.5" /> Your call is still connected.
        </p>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button variant="ghost" onClick={close} className="sm:mr-auto">
            <LifeBuoy className="mr-1 size-4" /> Close
          </Button>

          {error.nextStep === "retry" && planId && (
            <Button
              className="brand-gradient text-primary-foreground"
              onClick={() => {
                onRetry?.(planId);
                close();
              }}
            >
              <RefreshCw className="mr-1 size-4" /> Retry plan
            </Button>
          )}
          {error.nextStep === "wait" && (
            <Button
              className="brand-gradient text-primary-foreground"
              onClick={() => {
                onRefreshBalance?.();
                close();
              }}
            >
              <RefreshCw className="mr-1 size-4" /> Refresh balance
            </Button>
          )}
          {error.nextStep === "pick_other" && (
            <Button
              className="brand-gradient text-primary-foreground"
              onClick={() => {
                onPickAnotherPlan?.();
                close();
              }}
            >
              Pick another plan
            </Button>
          )}
          {error.nextStep === "reauth" && (
            <Button
              className="brand-gradient text-primary-foreground"
              onClick={() => {
                onReauth?.();
                close();
              }}
            >
              <LogIn className="mr-1 size-4" /> Sign in
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
