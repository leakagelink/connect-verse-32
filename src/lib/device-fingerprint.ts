/**
 * Lightweight device fingerprint computed in the browser.
 * Combines user agent + screen + timezone + a tiny canvas hash + language.
 * Cached in localStorage so subsequent visits send the same value.
 *
 * NOT a tracking identifier — used only to match the ban-evasion shadow list.
 */

const STORAGE_KEY = "talkora:device_fp_v1";

function canvasFingerprint(): string {
  try {
    const c = document.createElement("canvas");
    c.width = 200; c.height = 50;
    const ctx = c.getContext("2d");
    if (!ctx) return "no-canvas";
    ctx.textBaseline = "top";
    ctx.font = "14px 'Arial'";
    ctx.fillStyle = "#f60";
    ctx.fillRect(0, 0, 200, 50);
    ctx.fillStyle = "#069";
    ctx.fillText("talkora-safety-fp", 2, 2);
    ctx.strokeStyle = "rgba(102,204,0,0.8)";
    ctx.strokeRect(40, 8, 80, 25);
    const data = c.toDataURL();
    let h = 0;
    for (let i = 0; i < data.length; i++) {
      h = (h * 31 + data.charCodeAt(i)) | 0;
    }
    return Math.abs(h).toString(36);
  } catch {
    return "canvas-error";
  }
}

async function sha256Hex(input: string): Promise<string> {
  try {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    // Fallback hash if subtle.crypto unavailable
    let h = 0;
    for (let i = 0; i < input.length; i++) h = (h * 31 + input.charCodeAt(i)) | 0;
    return Math.abs(h).toString(36).padStart(16, "0");
  }
}

export async function getDeviceFingerprint(): Promise<string> {
  if (typeof window === "undefined") return "ssr";
  try {
    const cached = localStorage.getItem(STORAGE_KEY);
    if (cached && cached.length >= 16) return cached;
  } catch { /* ignore */ }

  const parts = [
    navigator.userAgent || "",
    navigator.language || "",
    String(screen.width) + "x" + String(screen.height) + "@" + String(window.devicePixelRatio || 1),
    Intl.DateTimeFormat().resolvedOptions().timeZone || "",
    String((navigator as any).hardwareConcurrency || 0),
    canvasFingerprint(),
  ];
  const fp = await sha256Hex(parts.join("|"));
  try { localStorage.setItem(STORAGE_KEY, fp); } catch { /* ignore */ }
  return fp;
}
