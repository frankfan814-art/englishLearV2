import { useEffect, useRef } from 'react';

/**
 * Keep screen awake while enabled (e.g., during audio playback)
 * Uses Screen Wake Lock API with graceful fallback for unsupported browsers
 */
export function useWakeLock(enabled: boolean) {
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const enabledRef = useRef(enabled);

  // Keep enabledRef in sync
  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      // Release Wake Lock when disabled
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {});
        wakeLockRef.current = null;
      }
      return;
    }

    // Check browser support
    if (!('wakeLock' in navigator)) {
      console.warn('[WakeLock] API not supported in this browser');
      return;
    }

    // Request Wake Lock
    const requestWakeLock = async () => {
      try {
        const wakeLock = await navigator.wakeLock.request('screen');
        wakeLockRef.current = wakeLock;

        // Listen for automatic release (tab switch, minimize, etc.)
        wakeLock.addEventListener('release', () => {
          wakeLockRef.current = null;
          // Re-acquire if still enabled and page is visible
          if (enabledRef.current && !document.hidden) {
            requestWakeLock();
          }
        });
      } catch (err) {
        console.warn('[WakeLock] Request failed:', err);
      }
    };

    requestWakeLock();

    // Cleanup
    return () => {
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {});
        wakeLockRef.current = null;
      }
    };
  }, [enabled]);

  // Re-acquire wake lock when page becomes visible again
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && enabledRef.current && !wakeLockRef.current) {
        if ('wakeLock' in navigator) {
          navigator.wakeLock.request('screen')
            .then(wakeLock => {
              wakeLockRef.current = wakeLock;
              wakeLock.addEventListener('release', () => {
                wakeLockRef.current = null;
              });
            })
            .catch(() => {});
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);
}