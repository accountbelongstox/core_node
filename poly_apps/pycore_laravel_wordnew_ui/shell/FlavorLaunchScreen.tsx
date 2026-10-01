/**
 * FlavorLaunchScreen — the configurable web launch transition of a standalone
 * flavor (flavor.json `launch.web`). It starts pixel-identical to the native
 * splash (same background + centered brand icon from `brand.icon`), so the
 * native → WebView hand-off is seamless, then plays:
 *   - `logo`:   the icon breathes in with the localized name + tagline, then
 *               zooms out into the app;
 *   - `slides`: full-screen images with a Ken Burns drift toward each slide's
 *               focus point, captions, progress dots and swipe/tap to advance;
 *   - `none`:   nothing.
 * `show` limits how often it plays (always / session / daily / version).
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { StorageManager } from '../core/persistence';
import { useTranslation } from '../core/i18n/UiI18n';
import { ShellStorageKeys } from './ShellStorageKeys';
import {
  flavorAssetUrl, flavorDisplayName, flavorIconUrl, flavorLocalized,
  type FlavorConfig, type FlavorLaunchShow,
} from './flavor';

const DEFAULT_DURATION_MS = 1400;
const DEFAULT_SLIDE_MS = 2600;
const EXIT_MS = 450;
const SWIPE_PX = 40;

function seenStamp(show: FlavorLaunchShow, version: string): string {
  if (show === 'daily') return new Date().toISOString().slice(0, 10);
  if (show === 'version') return version;
  return 'seen';
}

function shouldShow(flavor: FlavorConfig, show: FlavorLaunchShow): boolean {
  if (show === 'always') return true;
  const key = `${ShellStorageKeys.LAUNCH_SEEN_PREFIX}${flavor.id}`;
  const stamp = seenStamp(show, flavor.version || '');
  try {
    const previous = show === 'session' ? StorageManager.getSessionRaw(key) : StorageManager.getRaw(key);
    if (previous === stamp) return false;
    if (show === 'session') StorageManager.setSessionRaw(key, stamp);
    else StorageManager.setRaw(key, stamp);
  } catch {
    return true;
  }
  return true;
}

export const FlavorLaunchScreen: React.FC<{ flavor: FlavorConfig; lang: string }> = ({ flavor, lang }) => {
  const { t } = useTranslation();
  const web = flavor.launch?.web;
  const native = flavor.launch?.native;
  const mode = web?.mode ?? 'none';
  const slides = useMemo(
    () => (web?.slides ?? []).map((slide) => ({ ...slide, url: flavorAssetUrl(slide.image) })).filter((slide) => slide.url),
    [web?.slides],
  );
  const [visible, setVisible] = useState(() => mode !== 'none' && (mode !== 'slides' || slides.length > 0)
    && shouldShow(flavor, web?.show ?? 'always'));
  const [index, setIndex] = useState(0);
  const touchX = useRef<number | null>(null);

  const background = native?.background || flavor.backgroundColor || '#0f172a';
  const iconUrl = flavorIconUrl(flavor);
  const title = flavorDisplayName(flavor, lang);
  const tagline = flavorLocalized(web?.tagline, lang);
  const close = useCallback(() => setVisible(false), []);

  useEffect(() => {
    if (!visible) return;
    const delay = mode === 'slides' ? web?.slideMs ?? DEFAULT_SLIDE_MS : web?.durationMs ?? DEFAULT_DURATION_MS;
    const timer = window.setTimeout(() => {
      if (mode === 'slides' && index < slides.length - 1) setIndex(index + 1);
      else close();
    }, delay);
    return () => window.clearTimeout(timer);
  }, [visible, mode, index, slides.length, web?.slideMs, web?.durationMs, close]);

  const advance = (step: number) => {
    if (mode !== 'slides') return close();
    const next = index + step;
    if (next >= slides.length) close();
    else setIndex(Math.max(0, next));
  };

  const slide = slides[index];

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="flavor-launch"
          className="fixed inset-0 z-[2000] overflow-hidden select-none"
          style={{ background }}
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.04 }}
          transition={{ duration: EXIT_MS / 1000, ease: 'easeInOut' }}
          onClick={() => advance(1)}
          onTouchStart={(e) => { touchX.current = e.touches[0]?.clientX ?? null; }}
          onTouchEnd={(e) => {
            const start = touchX.current;
            const end = e.changedTouches[0]?.clientX;
            touchX.current = null;
            if (start == null || end == null || Math.abs(end - start) < SWIPE_PX) return;
            e.preventDefault();
            advance(end < start ? 1 : -1);
          }}
          role="presentation"
        >
          {mode === 'slides' && slide && (
            <AnimatePresence mode="sync">
              <motion.img
                key={slide.url}
                src={slide.url}
                alt=""
                draggable={false}
                className="absolute inset-0 w-full h-full object-cover"
                style={{ objectPosition: slide.focus || '50% 50%', transformOrigin: slide.focus || '50% 50%' }}
                initial={{ opacity: 0, scale: 1.02 }}
                animate={{ opacity: 1, scale: 1.12 }}
                exit={{ opacity: 0 }}
                transition={{ opacity: { duration: 0.6 }, scale: { duration: (web?.slideMs ?? DEFAULT_SLIDE_MS) / 1000 + 0.6, ease: 'linear' } }}
              />
            </AnimatePresence>
          )}
          {mode === 'slides' && <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-black/30" />}

          <div className="absolute inset-0 flex flex-col items-center justify-center px-8 text-center"
            style={{ paddingTop: 'var(--wf-safe-top, 0px)', paddingBottom: 'var(--wf-safe-bottom, 0px)' }}>
            {mode === 'logo' && iconUrl && (
              <motion.img
                src={iconUrl}
                alt=""
                draggable={false}
                className="w-[28vmin] h-[28vmin] max-w-40 max-h-40 rounded-[22%] shadow-2xl"
                initial={{ scale: 1, opacity: 1 }}
                animate={{ scale: [1, 1.06, 1] }}
                transition={{ duration: 1.2, ease: 'easeInOut' }}
              />
            )}
            {mode === 'logo' && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25, duration: 0.5 }} className="mt-6 space-y-1.5">
                <p className="text-2xl font-black tracking-tight text-white">{title}</p>
                {tagline && <p className="text-sm text-white/70">{tagline}</p>}
              </motion.div>
            )}
            {mode === 'slides' && slide && (
              <motion.p
                key={`caption-${index}`}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="absolute bottom-[calc(var(--wf-safe-bottom,0px)+5.5rem)] inset-x-8 text-xl font-black text-white drop-shadow-lg"
              >
                {flavorLocalized(slide.caption, lang) || title}
              </motion.p>
            )}
          </div>

          {mode === 'slides' && slides.length > 1 && (
            <div className="absolute inset-x-0 bottom-[calc(var(--wf-safe-bottom,0px)+3rem)] flex justify-center gap-1.5">
              {slides.map((item, i) => (
                <button
                  key={item.url}
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setIndex(i); }}
                  aria-label={t('common.launch_slide', { n: i + 1 })}
                  className={`h-1.5 rounded-full transition-all ${i === index ? 'w-6 bg-white' : 'w-1.5 bg-white/40'}`}
                />
              ))}
            </div>
          )}

          {web?.skippable !== false && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); close(); }}
              className="absolute right-4 top-[calc(var(--wf-safe-top,0px)+1rem)] px-3.5 py-1.5 rounded-full bg-black/30 text-white/90 text-xs font-bold backdrop-blur-md border border-white/15"
            >
              {t('common.launch_skip')}
            </button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default FlavorLaunchScreen;
