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
export type PermState = 'granted' | 'denied' | 'prompt' | 'unknown';

/**
 * Read current mic/camera permission status WITHOUT prompting. Used by the
 * pre-call gate so we can show the user accurate badges and tailor the
 * next CTA (Allow vs. Open Settings).
 */
export async function checkCallPermissions(): Promise<{ mic: PermState; camera: PermState }> {
  if (isNative()) {
    let mic: PermState = 'unknown';
    let camera: PermState = 'unknown';
    try {
      const { VoiceRecorder } = await import('capacitor-voice-recorder');
      const has = await VoiceRecorder.hasAudioRecordingPermission();
      mic = has.value ? 'granted' : 'prompt';
    } catch { mic = 'unknown'; }
    try {
      const { Camera } = await import('@capacitor/camera');
      const status = await Camera.checkPermissions();
      const v = status.camera;
      camera = v === 'granted' ? 'granted'
        : v === 'denied' ? 'denied'
        : v === 'prompt' || v === 'prompt-with-rationale' ? 'prompt'
        : 'unknown';
    } catch { camera = 'unknown'; }
    return { mic, camera };
  }
  // Web: Permissions API (best-effort; Safari may not support 'camera').
  const read = async (name: PermissionName): Promise<PermState> => {
    try {
      // @ts-ignore — name strings beyond the lib's union
      const r = await navigator.permissions?.query?.({ name });
      if (!r) return 'unknown';
      return (r.state as PermState) ?? 'unknown';
    } catch { return 'unknown'; }
  };
  const [mic, camera] = await Promise.all([
    read('microphone' as PermissionName),
    read('camera' as PermissionName),
  ]);
  return { mic, camera };
}

/** Open the OS app-settings screen so the user can flip a denied permission. */
export async function openAppSettings(): Promise<boolean> {
  if (!isNative()) return false;
  try {
    // Use a runtime-computed specifier so Vite doesn't try to pre-resolve
    // this optional plugin (it's only installed in the native Android build).
    const pkg = ['@capacitor-community', 'app-settings'].join('/');
    const mod: any = await import(/* @vite-ignore */ pkg).catch(() => null);
    if (mod?.NativeSettings?.open) {
      await mod.NativeSettings.open({ optionAndroid: 'application_details', optionIOS: 'app' });
      return true;
    }
  } catch { /* ignore */ }
  try {
    const { App } = await import('@capacitor/app');
    // Fallback: at least surface a hint; can't deep-link without the plugin.
    void App;
  } catch { /* ignore */ }
  return false;
}

/* ---- Last denial reason (for the debug panel) ---- */
const LAST_PERM_KEY = 'talkora.lastPermDenial';
const PERM_FAIL_COUNT_KEY = 'talkora.permFailCount';
export interface LastPermDenial {
  kind: 'voice' | 'video';
  reason: string;
  at: number;
}
export function getLastPermDenial(): LastPermDenial | null {
  try {
    const raw = localStorage.getItem(LAST_PERM_KEY);
    return raw ? (JSON.parse(raw) as LastPermDenial) : null;
  } catch { return null; }
}
export function clearLastPermDenial(): void {
  try { localStorage.removeItem(LAST_PERM_KEY); } catch { /* ignore */ }
}
function recordPermDenial(kind: 'voice' | 'video', reason: string): void {
  try {
    localStorage.setItem(LAST_PERM_KEY, JSON.stringify({ kind, reason, at: Date.now() }));
  } catch { /* ignore */ }
}

/* ---- Consecutive failure counter (drives auto-open of debug panel) ---- */
export function getPermFailCount(): number {
  try {
    const n = parseInt(localStorage.getItem(PERM_FAIL_COUNT_KEY) ?? '0', 10);
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch { return 0; }
}
export function resetPermFailCount(): void {
  try { localStorage.removeItem(PERM_FAIL_COUNT_KEY); } catch { /* ignore */ }
}
function bumpPermFailCount(): number {
  const next = getPermFailCount() + 1;
  try { localStorage.setItem(PERM_FAIL_COUNT_KEY, String(next)); } catch { /* ignore */ }
  return next;
}

async function _requestCallPermissionsImpl(kind: 'voice' | 'video'): Promise<{
  granted: boolean;
  reason?: 'mic-denied' | 'camera-denied' | 'media-denied' | 'media-unavailable' | 'plugin-missing';
}> {
  const verifyWebRtcCapture = async (): Promise<{
    granted: boolean;
    reason?: 'mic-denied' | 'camera-denied' | 'media-denied' | 'media-unavailable';
  }> => {
    if (!navigator.mediaDevices?.getUserMedia) {
      return { granted: false, reason: 'media-unavailable' };
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: kind === 'video' ? { width: 640, height: 480, facingMode: 'user' } : false,
      });
      stream.getTracks().forEach((track) => track.stop());
      return { granted: true };
    } catch (error: unknown) {
      const name = error instanceof DOMException ? error.name : '';
      if (name === 'NotFoundError' || name === 'OverconstrainedError') {
        return { granted: false, reason: 'media-unavailable' };
      }
      if (name === 'NotAllowedError' || name === 'SecurityError' || name === 'PermissionDeniedError') {
        return { granted: false, reason: kind === 'video' ? 'media-denied' : 'mic-denied' };
      }
      return { granted: false, reason: 'media-denied' };
    }
  };

  if (!isNative()) return verifyWebRtcCapture();
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

    // Final and most important check: WebRTC itself must be allowed in the
    // Android WebView. Calling getUserMedia from the user's button tap triggers
    // Capacitor's native WebView permission dialog for RECORD_AUDIO/CAMERA.
    return await verifyWebRtcCapture();
  } catch (e) {
    console.warn('[perm] requestCallPermissions failed', e);
    return { granted: false, reason: 'plugin-missing' };
  }
}

export async function requestCallPermissions(kind: 'voice' | 'video') {
  const res = await _requestCallPermissionsImpl(kind);
  if (!res.granted && res.reason) {
    recordPermDenial(kind, res.reason);
    bumpPermFailCount();
  } else if (res.granted) {
    clearLastPermDenial();
    resetPermFailCount();
  }
  return res;
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
