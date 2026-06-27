/**
 * Native bridge helpers (Capacitor).
 *
 * Every function here is **safe to call from the web** — if the app is
 * running in a regular browser the call no-ops. Inside the Android wrap
 * (Capacitor) the corresponding plugin is invoked.
 *
 * Used by:
 *   - Call screen (enable screenshot block while video/audio is live)
 *   - KYC screen (block screen capture of Aadhaar/PAN previews)
 *   - Withdrawal screen (block screen capture of bank details)
 *   - AppShell (status-bar colour, splash hide, push registration)
 */

import { Capacitor } from '@capacitor/core';

export const isNative = (): boolean => Capacitor.isNativePlatform();
export const platform = (): string => Capacitor.getPlatform();

/* ---------------- Privacy screen (FLAG_SECURE wrapper) ---------------- */

let privacyDepth = 0;

export async function enablePrivacyScreen(): Promise<void> {
  privacyDepth += 1;
  if (!isNative()) return;
  try {
    const { PrivacyScreen } = await import('@capacitor-community/privacy-screen');
    await PrivacyScreen.enable();
  } catch {
    /* plugin unavailable — ignore */
  }
}

export async function disablePrivacyScreen(): Promise<void> {
  privacyDepth = Math.max(0, privacyDepth - 1);
  if (privacyDepth > 0 || !isNative()) return;
  try {
    const { PrivacyScreen } = await import('@capacitor-community/privacy-screen');
    await PrivacyScreen.disable();
  } catch {
    /* ignore */
  }
}

/* ---------------- Status bar / splash ---------------- */

export async function applyChromeForApp(): Promise<void> {
  if (!isNative()) return;
  try {
    const [{ StatusBar, Style }, { SplashScreen }] = await Promise.all([
      import('@capacitor/status-bar'),
      import('@capacitor/splash-screen'),
    ]);
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setBackgroundColor({ color: '#0B0B12' });
    await SplashScreen.hide();
  } catch {
    /* ignore */
  }
}

/* ---------------- Hardware back button ---------------- */

/**
 * Subscribe to the Android hardware back-button. The call screen uses this
 * to intercept back and trigger the "End call?" confirmation instead of
 * navigating away mid-call.
 *
 * Returns an unsubscribe function.
 */
export function onHardwareBack(handler: () => boolean | void): () => void {
  if (!isNative()) return () => {};
  let cleanup: (() => void) | undefined;
  (async () => {
    const { App } = await import('@capacitor/app');
    const sub = await App.addListener('backButton', () => {
      const handled = handler();
      if (!handled) App.exitApp();
    });
    cleanup = () => sub.remove();
  })();
  return () => cleanup?.();
}

/* ---------------- Push notifications ---------------- */

export interface PushRegistration {
  token: string;
  platform: 'android' | 'ios' | 'web';
}

export async function registerPushNotifications(): Promise<PushRegistration | null> {
  if (!isNative()) return null;
  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');
    const perm = await PushNotifications.requestPermissions();
    if (perm.receive !== 'granted') return null;
    return await new Promise<PushRegistration | null>((resolve) => {
      const timeout = setTimeout(() => resolve(null), 8000);
      PushNotifications.addListener('registration', (t) => {
        clearTimeout(timeout);
        resolve({ token: t.value, platform: platform() as 'android' });
      });
      PushNotifications.addListener('registrationError', () => {
        clearTimeout(timeout);
        resolve(null);
      });
      void PushNotifications.register();
    });
  } catch {
    return null;
  }
}

/* ---------------- Device fingerprint (for ban_signals) ---------------- */

export async function getNativeDeviceId(): Promise<string | null> {
  if (!isNative()) return null;
  try {
    const { Device } = await import('@capacitor/device');
    const id = await Device.getId();
    return id.identifier ?? null;
  } catch {
    return null;
  }
}
