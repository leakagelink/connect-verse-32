import { useEffect } from 'react';
import { enablePrivacyScreen, disablePrivacyScreen } from '@/lib/native';

/**
 * Mount this hook on screens that show sensitive content (active calls,
 * KYC document uploads, withdrawal/bank info). It sets Android
 * FLAG_SECURE via the privacy-screen plugin so screenshots and screen
 * recordings are blocked, and the app preview in the recents switcher
 * shows a blank splash instead of the page.
 *
 * Safe no-op on web.
 */
export function useScreenPrivacy(active: boolean = true): void {
  useEffect(() => {
    if (!active) return;
    void enablePrivacyScreen();
    return () => {
      void disablePrivacyScreen();
    };
  }, [active]);
}
