/**
 * Keeps shell language, pycore backend (system_settings.lang), and tray i18n in sync.
 *
 * Tray menu  -> i18n.set_language -> ui.i18n.language_changed (+ persisted settings)
 *            -> HTTP event `ui.i18n.language_changed` / `system_settings_update`
 * Shell select -> debounced setSystemSettings({ lang }) -> backend i18n + tray menu
 */
import { useEffect, useRef } from 'react';
import { useShell } from '../../shell/ShellContext';
import { pycoreApi } from '../../core/api-libs/pycore';
import { pycoreEventBus } from '../../core/api-libs/pycore/PycoreEventBus';
import { PYCORE_EVENT_TOPICS } from '../../core/api-libs/pycore/PycoreEventTopics';

function pickLang(raw: unknown): string | null {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  return raw.trim();
}

export function PcLanguageSync() {
  const { lang, setLang } = useShell();

  const hydrated = useRef(false);
  const applyingFromBackend = useRef(false);
  const pushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const langRef = useRef(lang);
  langRef.current = lang;

  const applyBackendLang = (code: string | null) => {
    if (!code || code === langRef.current) return;
    applyingFromBackend.current = true;
    setLang(code);
  };

  // Backend wins on first load (tray / persisted user_data.json).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await pycoreApi.getSystemSettings();
        if (cancelled) return;
        applyBackendLang(pickLang((r?.settings as Record<string, unknown> | undefined)?.lang));
      } catch {
        /* offline — keep shell localStorage lang */
      } finally {
        if (!cancelled) hydrated.current = true;
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only hydrate
  }, []);

  // Live pushes from tray or other backend writers (subscribe directly — no PcLiveContext).
  useEffect(() => {
    const offSettings = pycoreEventBus.subscribe(PYCORE_EVENT_TOPICS.systemSettingsUpdate, (data: unknown) => {
      const payload = (data && typeof data === 'object') ? data as Record<string, unknown> : {};
      const settings = (payload.settings && typeof payload.settings === 'object')
        ? payload.settings as Record<string, unknown>
        : null;
      if (settings) applyBackendLang(pickLang(settings.lang));
    });
    const offI18n = pycoreEventBus.subscribe(PYCORE_EVENT_TOPICS.i18nLanguageChanged, (data: unknown) => {
      const payload = (data && typeof data === 'object') ? data as Record<string, unknown> : {};
      applyBackendLang(pickLang(payload.language));
    });
    return () => { offSettings(); offI18n(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- lang read via closure each event
  }, [setLang]);

  // Shell language changes -> persist to backend (tray + native UI follow via i18n).
  useEffect(() => {
    if (!hydrated.current) return;
    if (applyingFromBackend.current) {
      applyingFromBackend.current = false;
      return;
    }
    if (pushTimer.current) clearTimeout(pushTimer.current);
    pushTimer.current = setTimeout(() => {
      (async () => {
        try {
          const r = await pycoreApi.getSystemSettings();
          const current = (r?.settings && typeof r.settings === 'object')
            ? r.settings as Record<string, unknown>
            : {};
          if (pickLang(current.lang) === lang) return;
          await pycoreApi.setSystemSettings({ ...current, lang });
        } catch {
          /* offline — local shell lang still applies to the web UI */
        }
      })();
    }, 400);
    return () => {
      if (pushTimer.current) clearTimeout(pushTimer.current);
    };
  }, [lang]);

  return null;
}

export default PcLanguageSync;
