// Razorpay Checkout loader + opener
declare global {
  interface Window {
    Razorpay?: any;
  }
}

const SCRIPT_SRC = "https://checkout.razorpay.com/v1/checkout.js";
let loadPromise: Promise<void> | null = null;

export function loadRazorpay(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("SSR"));
  if (window.Razorpay) return Promise.resolve();
  if (loadPromise) return loadPromise;
  loadPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Failed to load Razorpay")));
      return;
    }
    const s = document.createElement("script");
    s.src = SCRIPT_SRC;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      loadPromise = null;
      reject(new Error("Failed to load Razorpay"));
    };
    document.body.appendChild(s);
  });
  return loadPromise;
}

export interface RazorpayOpenArgs {
  keyId: string;
  orderId: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  prefillName?: string;
  prefillEmail?: string;
  prefillContact?: string;
  themeColor?: string;
  onSuccess: (resp: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }) => void;
  onDismiss?: () => void;
}

export async function openRazorpay(args: RazorpayOpenArgs): Promise<void> {
  await loadRazorpay();
  const rzp = new window.Razorpay({
    key: args.keyId,
    order_id: args.orderId,
    amount: args.amount,
    currency: args.currency,
    name: args.name,
    description: args.description,
    prefill: {
      name: args.prefillName,
      email: args.prefillEmail,
      contact: args.prefillContact,
    },
    theme: { color: args.themeColor ?? "#9333ea" },
    modal: { ondismiss: () => args.onDismiss?.() },
    handler: (resp: any) => args.onSuccess(resp),
  });
  rzp.on("payment.failed", (resp: any) => {
    console.error("Razorpay payment failed", resp?.error);
  });
  rzp.open();
}
