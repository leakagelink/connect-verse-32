import { useEffect, useState } from "react";
import { APP_NAME } from "@/lib/constants";
import talkoraLogo from "@/assets/talkora-logo.png.asset.json";

const SEEN_KEY = "talkora.splash.seen";
const HOLD_MS = 1600;
const FADE_MS = 450;

/**
 * Modern animated splash overlay.
 * - Shows once per browser session (sessionStorage) so SPA navigation feels instant.
 * - Pure CSS animations (no extra deps). Respects prefers-reduced-motion.
 */
export function SplashScreen() {
  const [stage, setStage] = useState<"show" | "fade" | "gone">(() => {
    if (typeof window === "undefined") return "gone";
    return sessionStorage.getItem(SEEN_KEY) ? "gone" : "show";
  });

  useEffect(() => {
    if (stage !== "show") return;
    const t1 = setTimeout(() => setStage("fade"), HOLD_MS);
    const t2 = setTimeout(() => {
      setStage("gone");
      try { sessionStorage.setItem(SEEN_KEY, "1"); } catch {}
    }, HOLD_MS + FADE_MS);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [stage]);

  if (stage === "gone") return null;

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden"
      style={{
        background:
          "radial-gradient(ellipse 80% 60% at 50% 30%, oklch(0.7 0.19 22 / 0.35), transparent 60%), radial-gradient(ellipse 70% 50% at 50% 100%, oklch(0.65 0.18 340 / 0.30), transparent 60%), oklch(0.12 0.025 280)",
        opacity: stage === "fade" ? 0 : 1,
        transition: `opacity ${FADE_MS}ms ease-out`,
        pointerEvents: stage === "fade" ? "none" : "auto",
      }}
    >
      {/* floating orbs */}
      <div className="splash-orb splash-orb-1" />
      <div className="splash-orb splash-orb-2" />
      <div className="splash-orb splash-orb-3" />

      <div className="relative flex flex-col items-center gap-5">
        {/* logo with ring pulse */}
        <div className="relative">
          <span className="splash-ring" />
          <span className="splash-ring splash-ring-delay" />
          <div className="relative size-28 rounded-3xl brand-gradient shadow-2xl shadow-primary/50 flex items-center justify-center splash-logo-pop">
            <img
              src={talkoraLogo.url}
              alt={`${APP_NAME} logo`}
              width={88}
              height={88}
              className="size-20 rounded-2xl"
            />
          </div>
        </div>

        <div className="text-center splash-text-rise">
          <h1 className="text-4xl font-bold tracking-tight text-gradient">
            {APP_NAME}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Voice rooms. Real conversations.
          </p>
        </div>

        {/* loader dots */}
        <div className="flex gap-1.5 mt-2">
          <span className="splash-dot" />
          <span className="splash-dot splash-dot-2" />
          <span className="splash-dot splash-dot-3" />
        </div>
      </div>

      <style>{`
        @keyframes splash-logo-pop {
          0% { transform: scale(0.6); opacity: 0; }
          60% { transform: scale(1.08); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes splash-text-rise {
          0% { transform: translateY(12px); opacity: 0; }
          100% { transform: translateY(0); opacity: 1; }
        }
        @keyframes splash-ring {
          0% { transform: scale(0.8); opacity: 0.6; }
          100% { transform: scale(1.8); opacity: 0; }
        }
        @keyframes splash-dot {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
          40% { transform: scale(1); opacity: 1; }
        }
        @keyframes splash-orb-float {
          0%, 100% { transform: translate(0,0); }
          50% { transform: translate(20px, -30px); }
        }
        .splash-logo-pop { animation: splash-logo-pop 700ms cubic-bezier(0.34, 1.56, 0.64, 1) both; }
        .splash-text-rise { animation: splash-text-rise 600ms ease-out 250ms both; }
        .splash-ring {
          position: absolute; inset: 0; border-radius: 1.5rem;
          border: 2px solid oklch(0.7 0.19 22 / 0.6);
          animation: splash-ring 1.8s ease-out infinite;
        }
        .splash-ring-delay { animation-delay: 0.9s; }
        .splash-dot {
          width: 8px; height: 8px; border-radius: 9999px;
          background: linear-gradient(135deg, oklch(0.7 0.19 22), oklch(0.65 0.18 340));
          animation: splash-dot 1.2s ease-in-out infinite;
        }
        .splash-dot-2 { animation-delay: 0.15s; }
        .splash-dot-3 { animation-delay: 0.3s; }
        .splash-orb {
          position: absolute; border-radius: 9999px; filter: blur(60px);
          animation: splash-orb-float 6s ease-in-out infinite;
        }
        .splash-orb-1 {
          width: 260px; height: 260px; top: 10%; left: -60px;
          background: oklch(0.7 0.19 22 / 0.35);
        }
        .splash-orb-2 {
          width: 220px; height: 220px; bottom: 8%; right: -40px;
          background: oklch(0.65 0.18 340 / 0.35);
          animation-delay: 1.5s;
        }
        .splash-orb-3 {
          width: 180px; height: 180px; top: 50%; left: 50%;
          transform: translate(-50%, -50%);
          background: oklch(0.82 0.16 85 / 0.18);
          animation-delay: 3s;
        }
        @media (prefers-reduced-motion: reduce) {
          .splash-logo-pop, .splash-text-rise, .splash-ring, .splash-dot, .splash-orb {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}
