import React, { useEffect, useRef, useState } from 'react';

/**
 * OfflineBanner – slim, non-blocking top banner that reflects browser
 * connectivity. Shows a warning while offline, then a brief "Back online"
 * confirmation that fades out automatically.
 *
 * Design matches the app shell: glass/blur surface, rounded pill, indigo/
 * slate palette, dark-mode aware, high z-index, fixed at top-center so it
 * never covers the sidebar/nav.
 */

/** How long the "Back online" confirmation stays before fading out (ms). */
const BACK_ONLINE_VISIBLE_MS = 3000;

type BannerState = 'hidden' | 'offline' | 'back-online';

const OfflineBanner: React.FC = () => {
  // Start from the current connectivity status. navigator.onLine may be
  // undefined in non-browser/SSR contexts, so default to "online" (hidden).
  const initialOnline =
    typeof navigator === 'undefined' || navigator.onLine !== false;

  const [state, setState] = useState<BannerState>(
    initialOnline ? 'hidden' : 'offline'
  );
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const clearHideTimer = () => {
      if (hideTimerRef.current !== null) {
        clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
    };

    const handleOffline = () => {
      clearHideTimer();
      setState('offline');
    };

    const handleOnline = () => {
      clearHideTimer();
      // Briefly confirm recovery, then auto-hide.
      setState('back-online');
      hideTimerRef.current = setTimeout(() => {
        setState('hidden');
        hideTimerRef.current = null;
      }, BACK_ONLINE_VISIBLE_MS);
    };

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);

    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
      clearHideTimer();
    };
  }, []);

  if (state === 'hidden') {
    return null;
  }

  const isOffline = state === 'offline';

  // Palette mirrors the app: amber-tinted glass for the warning, emerald
  // glass for the recovery confirmation. Both use blur + ring like the shell.
  const toneClasses = isOffline
    ? 'bg-amber-50/90 text-amber-800 ring-amber-300/60 dark:bg-amber-500/10 dark:text-amber-200 dark:ring-amber-400/30'
    : 'bg-emerald-50/90 text-emerald-800 ring-emerald-300/60 dark:bg-emerald-500/10 dark:text-emerald-200 dark:ring-emerald-400/30';

  return (
    <div
      role="status"
      aria-live="polite"
      // pointer-events-none on the wrapper keeps the banner non-blocking;
      // the pill itself re-enables pointer events.
      className="fixed top-0 inset-x-0 z-[100] flex justify-center px-4 pt-3 pointer-events-none"
    >
      <div
        className={`
          pointer-events-auto flex items-center gap-2.5
          rounded-full px-4 py-2 text-xs sm:text-sm font-medium
          backdrop-blur-md ring-1 shadow-lg shadow-slate-900/5
          transition-all duration-500 ease-out
          ${toneClasses}
          ${isOffline ? 'opacity-100 translate-y-0' : 'opacity-100 translate-y-0 animate-pulse'}
        `}
      >
        <span
          className={`
            inline-flex h-2 w-2 rounded-full
            ${isOffline
              ? 'bg-amber-500 dark:bg-amber-400 animate-pulse'
              : 'bg-emerald-500 dark:bg-emerald-400'}
          `}
          aria-hidden="true"
        />
        {isOffline ? (
          <span>
            You&apos;re offline — the backend is unreachable. Changes may not be
            saved.
          </span>
        ) : (
          <span>Back online</span>
        )}
      </div>
    </div>
  );
};

export default OfflineBanner;
