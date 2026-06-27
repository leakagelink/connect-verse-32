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

/* ---------------- Call permissions (mic / camera) ---------------- */

/**
 * Request RECORD_AUDIO (and CAMERA for video) at the OS level BEFORE the
 * call screen calls `navigator.mediaDevices.getUserMedia()`. Two reasons:
 *
 *  1. Capacitor's WebView only auto-grants `getUserMedia` requests for
 *     resources owned by a registered native plugin. Without the Camera
 *     plugin + voice-recorder plugin installed and synced, the WebView
 *     silently denies the request and the call fails with no prompt.
 *  2. Calling the plugin's `requestPermissions()` triggers the standard
 *     Android runtime permission dialog inside a user gesture chain.
 *
 * Safe on web — returns `granted: true` without prompting (the browser
 * will handle its own mic/camera prompt on the actual getUserMedia call).
 */
export async function requestCallPermissions(kind: 'voice' | 'video'): Promise<{
  granted: boolean;
  reason?: 'mic-denied' | 'camera-denied' | 'plugin-missing';
}> {
  if (!isNative()) return { granted: true };
  try {
    // Microphone — required for both voice and video.
    try {
      const { VoiceRecorder } = await import('capacitor-voice-recorder');
      const has = await VoiceRecorder.hasAudioRecordingPermission();
      if (!has.value) {
        const req = await VoiceRecorder.requestAudioRecordingPermission();
        if (!req.value) return { granted: false, reason: 'mic-denied' };
      }
    } catch (e) {
      console.warn('[perm] mic plugin missing', e);
      return { granted: false, reason: 'plugin-missing' };
    }
    if (kind === 'video') {
      try {
        const { Camera } = await import('@capacitor/camera');
        const status = await Camera.checkPermissions();
        if (status.camera !== 'granted') {
          const req = await Camera.requestPermissions({ permissions: ['camera'] });
          if (req.camera !== 'granted') return { granted: false, reason: 'camera-denied' };
        }
      } catch (e) {
        console.warn('[perm] camera plugin missing', e);
        return { granted: false, reason: 'plugin-missing' };
      }
    }
    return { granted: true };
  } catch (e) {
    console.warn('[perm] requestCallPermissions failed', e);
    return { granted: false, reason: 'plugin-missing' };
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
