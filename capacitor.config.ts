import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Talkora — Capacitor (Android) configuration.
 *
 * Production wrap target:
 *   - appId: in.talkora.app   (final id will be reserved on Play Console)
 *   - appName: Talkora
 *
 * The Android shell loads the published web build. Update `server.url`
 * to your published Lovable URL (e.g. https://talkora.lovable.app) before
 * `npx cap sync android`. For full offline-capable APKs, run
 * `bun run build` and remove the `server.url` block so the bundled
 * `dist/` ships inside the APK.
 */
const config: CapacitorConfig = {
  appId: 'in.talkora.app',
  appName: 'Talkora',
  webDir: 'dist',
  server: {
    // Comment out the next line to ship a fully self-contained APK.
    url: 'https://talkora.lovable.app',
    cleartext: false,
    androidScheme: 'https',
  },
  android: {
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      backgroundColor: '#0B0B12',
      androidSplashResourceName: 'splash',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0B0B12',
      overlaysWebView: false,
    },
    PrivacyScreen: {
      // Hides app preview in the recents switcher + blocks screenshots on
      // sensitive screens (KYC, calls, withdrawals). We toggle this at
      // runtime via the privacy-screen plugin.
      enable: true,
      imageName: 'splash',
      preventScreenshots: true,
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
