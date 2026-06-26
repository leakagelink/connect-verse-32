// Shared recharge error taxonomy. Server throws `${CODE}::${message}`,
// client parses and shows reason + a concrete next step.

export type RechargeErrorCode =
  | "NETWORK"
  | "PLAN_NOT_FOUND"
  | "PLAN_INACTIVE"
  | "WALLET_MISSING"
  | "ALREADY_PURCHASED"
  | "BILLING_DECLINED"
  | "DB_UPDATE_FAILED"
  | "UNAUTHORIZED"
  | "UNKNOWN";

export type ParsedRechargeError = {
  code: RechargeErrorCode;
  title: string;
  description: string;
  /** Short label for the primary CTA. */
  nextStepLabel: string;
  /** What the primary CTA should do. */
  nextStep: "retry" | "pick_other" | "contact_support" | "reauth" | "wait";
};

export function makeRechargeError(code: RechargeErrorCode, message: string): Error {
  return new Error(`${code}::${message}`);
}

export function parseRechargeError(err: unknown): ParsedRechargeError {
  const raw = (err as any)?.message ?? String(err ?? "");
  // Network / fetch failure shapes (TypeError: Failed to fetch, AbortError, offline)
  const offline = typeof navigator !== "undefined" && navigator.onLine === false;
  if (
    offline ||
    /Failed to fetch|NetworkError|ERR_NETWORK|ECONNREFUSED|TypeError: fetch/i.test(raw)
  ) {
    return {
      code: "NETWORK",
      title: "No internet connection",
      description:
        "Recharge request couldn't reach our servers. Your call is still connected. Check your network and retry the same plan.",
      nextStepLabel: "Retry",
      nextStep: "retry",
    };
  }

  const [maybeCode, ...rest] = raw.split("::");
  const detail = rest.join("::").trim();
  const code = (maybeCode || "").trim() as RechargeErrorCode;

  switch (code) {
    case "PLAN_NOT_FOUND":
      return {
        code,
        title: "Plan unavailable",
        description: "This plan no longer exists. Pick another plan from the list below.",
        nextStepLabel: "Pick another plan",
        nextStep: "pick_other",
      };
    case "PLAN_INACTIVE":
      return {
        code,
        title: "Plan no longer active",
        description: "This plan was disabled. Choose any active plan to continue.",
        nextStepLabel: "Pick another plan",
        nextStep: "pick_other",
      };
    case "ALREADY_PURCHASED":
      return {
        code,
        title: "Already purchased",
        description:
          "This plan was just credited to your wallet. Refresh balance — if coins are missing, contact support.",
        nextStepLabel: "Refresh balance",
        nextStep: "wait",
      };
    case "BILLING_DECLINED":
      return {
        code,
        title: "Payment declined",
        description:
          detail ||
          "Your bank declined the charge. Try a different plan/amount or use another payment method.",
        nextStepLabel: "Try another plan",
        nextStep: "pick_other",
      };
    case "WALLET_MISSING":
      return {
        code,
        title: "Wallet not found",
        description: "Your wallet record is missing. Please sign out and sign in again.",
        nextStepLabel: "Re-login",
        nextStep: "reauth",
      };
    case "UNAUTHORIZED":
      return {
        code,
        title: "Session expired",
        description: "Please sign in again to recharge. Your call will end on sign-out.",
        nextStepLabel: "Sign in",
        nextStep: "reauth",
      };
    case "DB_UPDATE_FAILED":
      return {
        code,
        title: "Server hiccup",
        description: detail || "We couldn't update your wallet. Please retry in a moment.",
        nextStepLabel: "Retry",
        nextStep: "retry",
      };
    default:
      return {
        code: "UNKNOWN",
        title: "Recharge failed",
        description: raw || "Something went wrong. Please retry.",
        nextStepLabel: "Retry",
        nextStep: "retry",
      };
  }
}
