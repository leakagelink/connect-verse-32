/**
 * Capacitor deep-link bridge.
 *
 * Listens for `appUrlOpen` events fired when the OS launches the app
 * via a registered URL scheme (talkora://) or App Link
 * (https://talkora.app/...). The path portion is forwarded to the
 * TanStack router so we land on the right in-app screen.
 *
 * Examples handled:
 *   talkora://chat/abc-123       → /chat/abc-123
 *   talkora://recharge           → /recharge
 *   https://talkora.app/rooms/42 → /rooms/42
 *   https://talkora.app/n        → /notifications
 */
import type { Router } from "@tanstack/react-router";
import { isNative } from "@/lib/native";

export function installDeepLinkHandler(router: Router<any, any>): () => void {
  if (!isNative()) return () => {};
  let cleanup: (() => void) | undefined;
  (async () => {
    try {
      const { App } = await import("@capacitor/app");
      const sub = await App.addListener("appUrlOpen", (event) => {
        try {
          const url = new URL(event.url);
          // strip scheme + host, keep path + query + hash
          const path = (url.pathname || "/") + (url.search || "") + (url.hash || "");
          if (!path || path === "/") return;
          router.navigate({ to: path });
        } catch {
          /* malformed url — ignore */
        }
      });
      cleanup = () => sub.remove();
    } catch {
      /* @capacitor/app missing — ignore */
    }
  })();
  return () => cleanup?.();
}
