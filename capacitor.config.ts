import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Talkora — Capacitor (Android) configuration.
 *
 * Production wrap target:
 *   - appId: in.talkora.app   (final id will be reserved on Play Console)
 *   - appName: Talkora
 *
 * The Android shell ships the bundled web build from `.output/public`.
 * Keep `server.url` disabled so the APK cannot accidentally load an old
 * or unrelated hosted site. Re-run `bun run build` + `npx cap sync android`
 * after web changes before building the APK/AAB.
 */
const config: CapacitorConfig = {
  appId: 'in.talkora.app',
  appName: 'Talkora',
  webDir: '.output/public',
  server: {
    cleartext: false,
    androidScheme: 'https',
    allowNavigation: ['*.lovable.app', 'talkora.app', '*.talkora.app'],
  },
  android: {
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
    // Phase 10 — custom URL scheme: talkora://chat/<id>, talkora://recharge, …
    // Register the intent-filter in android/app/src/main/AndroidManifest.xml
    // with <data android:scheme="talkora" />.
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
