import { useEffect, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { recordDeviceSignals } from "@/lib/safety.functions";
import { getDeviceFingerprint } from "@/lib/device-fingerprint";

/**
 * Mounted once per session inside AppShell. Computes a device fingerprint,
 * sends it (+ IP-hash captured server-side) to record_device_signals which
 * also auto-suspends the account if it matches the ban_signals shadow list.
 *
 * Fire-and-forget — never blocks the UI.
 */
export function SafetySignalsProbe() {
  const fired = useRef(false);
  const record = useServerFn(recordDeviceSignals);
  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    (async () => {
      try {
        const deviceFp = await getDeviceFingerprint();
        await record({ data: { deviceFp } });
      } catch {
        // Silent — safety signals failing must not break the app for the user.
      }
    })();
  }, [record]);
  return null;
}
