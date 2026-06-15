/**
 * PcAiKeysView — the "Keys" sub-view of the unified AI page.
 *
 * The former PcAiKeysPage body, reorganized into the merged page (its sticky
 * page chrome + "Open status" link are dropped — PcAiPage owns the header and
 * the sub-tab navigation). Same write-only key console:
 *   - Add / update a key (provider or custom base · slot 1..5 · text/image
 *     budget · password value).
 *   - Per-slot rotation status with a per-slot Delete, plus a raw-key-file
 *     targeted delete list.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  KeyRound, RefreshCcw, AlertTriangle, CheckCircle2, MinusCircle, Snowflake,
  Plus, Trash2, ShieldCheck, Image as ImageIcon, Layers, Lock,
} from 'lucide-react';
import { pycoreApi } from '../../../core/api-libs/pycore';
import type { AiKeyProvider, AiKeySlot } from '../../../core/api-libs/pycore';
import { logInfo, logSuccess, logError } from '../../../core/logstore/logStore';

const LOG_SRC = 'pc-ai-keys';
/** Rotation slots a single key base supports (BASE_1 … BASE_5). */
const SLOT_INDICES = [1, 2, 3, 4, 5] as const;

const KeySlots: React.FC<{
  slots: AiKeySlot[];
  label: string;
  resolveName: (slot: AiKeySlot) => string | null;
  onDelete: (keyName: string) => void;
  deleting: Set<string>;
}> = ({ slots, label, resolveName, onDelete, deleting }) => {
  if (!slots || slots.length === 0) return null;
  const activeIdx = slots.findIndex((s) => s.cooldown_s <= 0);
  const fmtCooldown = (s: number) =>
    s < 90 ? `${s}s` : s < 5400 ? `${Math.ceil(s / 60)}m` : `${Math.ceil(s / 3600)}h`;
  return (
    <div className="mt-1">
      <div className="flex items-center gap-1 mb-1">
        <KeyRound className="w-3 h-3 text-indigo-400/70" />
        <span className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">{label}</span>
        <span className="text-[9px] font-mono text-slate-400">×{slots.length}</span>
      </div>
      <div className="flex flex-wrap gap-1">
        {slots.map((s) => {
          const cooling = s.cooldown_s > 0;
          const active = !cooling && s.index === activeIdx;
          const keyName = resolveName(s);
          const busy = keyName ? deleting.has(keyName) : false;
          return (
            <span
              key={`${label}-${s.index}`}
              title={[
                `${s.label} · ${s.masked || 'no key'}`,
                cooling ? `Cooling down ${fmtCooldown(s.cooldown_s)} (rotates to the next key)` : 'Ready',
                `ok ${s.ok} · failed ${s.failed}`,
                s.last_error ? `Last error: ${s.last_error}` : '',
                keyName ? `Env: ${keyName}` : '',
              ].filter(Boolean).join('\n')}
              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-mono border ${
                cooling
                  ? 'bg-amber-500/10 border-amber-400/30 text-amber-600 dark:text-amber-400'
                  : active
                    ? 'bg-emerald-500/15 border-emerald-400/30 text-emerald-600 dark:text-emerald-400'
                    : 'bg-slate-500/8 border-slate-400/20 text-slate-500 dark:text-slate-400'
              }`}>
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cooling ? 'bg-amber-500' : 'bg-emerald-500'}`} />
              <span className="font-bold normal-case">{s.label}</span>
              <span className="opacity-80">{s.masked || '—'}</span>
              {cooling
                ? <span className="inline-flex items-center gap-0.5"><Snowflake className="w-2.5 h-2.5" />{fmtCooldown(s.cooldown_s)}</span>
                : (s.ok + s.failed > 0 && <span className="opacity-70">{s.ok}/{s.ok + s.failed}</span>)}
              {(!!s.minute_used || !!s.day_used) && (
                <span className="opacity-60 border-l border-current/20 pl-1">
                  {s.minute_used ?? 0}/min · {s.day_used ?? 0} today
                </span>
              )}
              {keyName && (
                <button
                  type="button"
                  onClick={() => onDelete(keyName)}
                  disabled={busy}
                  title={`Delete ${keyName}`}
                  className="ml-0.5 -mr-0.5 p-0.5 rounded text-rose-500 hover:bg-rose-500/15 transition disabled:opacity-40">
                  {busy ? <RefreshCcw className="w-2.5 h-2.5 animate-spin" /> : <Trash2 className="w-2.5 h-2.5" />}
                </button>
              )}
            </span>
          );
        })}
      </div>
    </div>
  );
};

const PcAiKeysView: React.FC<{ refreshSignal?: number }> = ({ refreshSignal }) => {
  const { t } = useTranslation('pc');

  const [providers, setProviders] = useState<AiKeyProvider[] | null>(null);
  const [rawKeyFiles, setRawKeyFiles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unreachable, setUnreachable] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Set<string>>(new Set());

  // --- add / update form --------------------------------------------------- #
  const [formProvider, setFormProvider] = useState<string>(''); // '' = custom base
  const [formBase, setFormBase] = useState<string>('');
  const [formIndex, setFormIndex] = useState<number>(1);
  const [formImage, setFormImage] = useState<boolean>(false);
  const [formValue, setFormValue] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await pycoreApi.getAiKeys();
      setProviders(Array.isArray(r?.providers) ? r.providers : []);
      setRawKeyFiles(Array.isArray(r?.raw_key_files) ? r.raw_key_files : []);
      setError(r?.success === false ? (r?.error ?? 'Failed to load keys') : null);
      setUnreachable(false);
    } catch (e: any) {
      setUnreachable(true);
      setError(e?.message || 'pycore unreachable');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  // External refresh signal from the page header (PcAiPage Refresh button).
  useEffect(() => {
    if (refreshSignal === undefined) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshSignal]);

  const selectedProvider = useMemo(
    () => (providers ?? []).find((p) => p.name === formProvider) ?? null,
    [providers, formProvider],
  );

  const effectiveBase = useMemo(
    () => (selectedProvider ? selectedProvider.key_base : formBase.trim()),
    [selectedProvider, formBase],
  );

  const keylessSelected = selectedProvider?.keyless ?? false;

  const makeResolveName = useCallback(
    (base: string, image: boolean) => (slot: AiKeySlot): string | null => {
      if (!base) return null;
      const name = image ? `${base}_IMAGE_${slot.index + 1}` : `${base}_${slot.index + 1}`;
      return rawKeyFiles.includes(name) ? name : null;
    },
    [rawKeyFiles],
  );

  const handleDelete = useCallback(async (keyName: string) => {
    if (!window.confirm(t('aiKeys.confirmDelete', { name: keyName }))) return;
    setDeleting((s) => { const n = new Set(s); n.add(keyName); return n; });
    setNotice(null);
    logInfo(LOG_SRC, `Deleting key ${keyName}…`);
    try {
      const r = await pycoreApi.deleteAiKey(keyName);
      if (r?.success) {
        setNotice(t('aiKeys.deleted', { name: keyName }));
        logSuccess(LOG_SRC, `Deleted key ${keyName}.`);
        await load();
      } else {
        const msg = r?.error || t('aiKeys.deleteFailed', { name: keyName });
        setNotice(msg);
        logError(LOG_SRC, msg);
      }
    } catch (e: any) {
      const msg = e?.message || t('aiKeys.deleteFailed', { name: keyName });
      setNotice(msg);
      logError(LOG_SRC, msg);
    } finally {
      setDeleting((s) => { const n = new Set(s); n.delete(keyName); return n; });
    }
  }, [t, load]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const value = formValue.trim();
    if (!value) { setNotice(t('aiKeys.emptyValue')); return; }
    if (!formProvider && !formBase.trim()) { setNotice(t('aiKeys.needProvider')); return; }
    setSubmitting(true);
    setNotice(null);
    logInfo(LOG_SRC, `Writing ${formImage ? 'image ' : ''}key slot ${formIndex} for ${formProvider || formBase.trim()}…`);
    try {
      const r = await pycoreApi.setAiKey({
        ...(formProvider ? { provider: formProvider } : { base_name: formBase.trim() }),
        index: formIndex,
        value,
        ...(formImage ? { image: true } : {}),
      });
      if (r?.success) {
        const name = r.key_name || `${effectiveBase}${formImage ? '_IMAGE' : ''}_${formIndex}`;
        setNotice(t('aiKeys.saved', { name }));
        logSuccess(LOG_SRC, `Saved key ${name}.`);
        setFormValue(''); // never retain the secret in component state
        await load();
      } else {
        const msg = r?.error || t('aiKeys.saveFailed');
        setNotice(msg);
        logError(LOG_SRC, msg);
      }
    } catch (err: any) {
      const msg = err?.message || t('aiKeys.saveFailed');
      setNotice(msg);
      logError(LOG_SRC, msg);
    } finally {
      setSubmitting(false);
    }
  }, [formValue, formProvider, formBase, formIndex, formImage, effectiveBase, t, load]);

  const providerStatusBadge = (p: AiKeyProvider) => {
    if (p.keyless) {
      return (
        <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide bg-sky-500/15 text-sky-500"
              title={t('aiKeys.keylessHint')}>
          <ShieldCheck className="w-3 h-3" /> {t('aiKeys.keyless')}
        </span>
      );
    }
    const ok = p.image_only ? p.image_ready : p.configured;
    return ok ? (
      <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide bg-emerald-500/15 text-emerald-500">
        <CheckCircle2 className="w-3 h-3" /> {t('aiKeys.configured')}
      </span>
    ) : (
      <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide bg-slate-500/15 text-slate-400">
        <MinusCircle className="w-3 h-3" /> {t('aiKeys.noKey')}
      </span>
    );
  };

  return (
    <div className="space-y-5 min-w-0 max-w-full">
      {(unreachable || error) && (
        <div className="flex items-start gap-2 text-xs rounded-2xl p-3 border bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span className="break-words">
            {unreachable ? t('aiKeys.unreachable') : t('aiKeys.loadError')}
            {error ? ` (${error})` : ''}
          </span>
        </div>
      )}

      {/* ===================== Conventions note ===================== */}
      <div className="flex items-start gap-2 text-[11px] rounded-2xl p-3 border bg-indigo-500/8 border-indigo-400/20 text-slate-500 dark:text-slate-400">
        <Layers className="w-4 h-4 shrink-0 mt-0.5 text-indigo-400" />
        <div className="min-w-0 space-y-0.5">
          <p className="font-semibold text-slate-600 dark:text-slate-300">{t('aiKeys.conventions.title')}</p>
          <p className="leading-snug">{t('aiKeys.conventions.rotation')}</p>
          <p className="leading-snug">{t('aiKeys.conventions.image')}</p>
          <p className="leading-snug flex items-start gap-1">
            <Lock className="w-3 h-3 shrink-0 mt-0.5" />
            {t('aiKeys.conventions.writeOnly')}
          </p>
        </div>
      </div>

      {/* ===================== Add / update a key ===================== */}
      <section className="pc-glass p-5">
        <h2 className="text-sm font-bold flex items-center gap-2 text-slate-700 dark:text-slate-200 mb-1">
          <Plus className="w-4 h-4 text-indigo-500" /> {t('aiKeys.addSection')}
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">{t('aiKeys.addHint')}</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                {t('aiKeys.provider')}
              </label>
              <select
                value={formProvider}
                onChange={(e) => { setFormProvider(e.target.value); }}
                className="w-full rounded-xl border bg-white/60 dark:bg-white/5 border-slate-300/50 dark:border-white/10 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/40">
                <option value="">{t('aiKeys.customBase')}</option>
                {(providers ?? []).map((p) => (
                  <option key={p.name} value={p.name}>{p.name}{p.keyless ? ` (${t('aiKeys.keyless')})` : ''}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                {t('aiKeys.baseName')}
              </label>
              {selectedProvider ? (
                <input
                  type="text"
                  value={selectedProvider.key_base}
                  readOnly
                  className="w-full rounded-xl border bg-slate-100/60 dark:bg-white/5 border-slate-300/50 dark:border-white/10 px-3 py-2 text-sm font-mono text-slate-500 dark:text-slate-400 cursor-not-allowed"
                />
              ) : (
                <input
                  type="text"
                  value={formBase}
                  onChange={(e) => setFormBase(e.target.value.toUpperCase())}
                  placeholder="GOOGLE_API_KEY"
                  className="w-full rounded-xl border bg-white/60 dark:bg-white/5 border-slate-300/50 dark:border-white/10 px-3 py-2 text-sm font-mono text-slate-700 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                />
              )}
            </div>

            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                {t('aiKeys.slot')}
              </label>
              <select
                value={formIndex}
                onChange={(e) => setFormIndex(Number(e.target.value))}
                className="w-full rounded-xl border bg-white/60 dark:bg-white/5 border-slate-300/50 dark:border-white/10 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/40">
                {SLOT_INDICES.map((i) => (
                  <option key={i} value={i}>{(formImage ? 'IMAGE_' : '') + `KEY${i}`} · {effectiveBase ? `${effectiveBase}${formImage ? '_IMAGE' : ''}_${i}` : `_${i}`}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col">
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                {t('aiKeys.budget')}
              </label>
              <button
                type="button"
                onClick={() => setFormImage((v) => !v)}
                title={t('aiKeys.imageToggleHint')}
                className={`w-full rounded-xl border px-3 py-2 text-sm font-bold flex items-center justify-center gap-1.5 transition ${
                  formImage
                    ? 'bg-pink-500/15 border-pink-400/40 text-pink-500'
                    : 'bg-white/60 dark:bg-white/5 border-slate-300/50 dark:border-white/10 text-slate-500 dark:text-slate-400 hover:bg-indigo-500/10'
                }`}>
                <ImageIcon className="w-3.5 h-3.5" />
                {formImage ? t('aiKeys.imageKey') : t('aiKeys.textKey')}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
              {t('aiKeys.value')}
              {keylessSelected && (
                <span className="ml-2 normal-case font-normal text-sky-500">{t('aiKeys.keylessNoValue')}</span>
              )}
            </label>
            <input
              type="password"
              value={formValue}
              onChange={(e) => setFormValue(e.target.value)}
              autoComplete="new-password"
              disabled={keylessSelected}
              placeholder={keylessSelected ? t('aiKeys.keylessNoValue') : t('aiKeys.valuePlaceholder')}
              className="w-full rounded-xl border bg-white/60 dark:bg-white/5 border-slate-300/50 dark:border-white/10 px-3 py-2 text-sm font-mono text-slate-700 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={submitting || keylessSelected || !formValue.trim() || (!formProvider && !formBase.trim())}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition disabled:opacity-50 disabled:cursor-not-allowed">
              {submitting ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {submitting ? t('aiKeys.saving') : t('aiKeys.saveKey')}
            </button>
            {effectiveBase && !keylessSelected && (
              <span className="text-[11px] font-mono text-slate-400">
                {t('aiKeys.willWrite')}{' '}
                <span className="text-indigo-500">{effectiveBase}{formImage ? '_IMAGE' : ''}_{formIndex}</span>
              </span>
            )}
          </div>
        </form>

        {notice && (
          <p className="mt-3 text-[11px] text-indigo-500 break-words">{notice}</p>
        )}
      </section>

      {/* ===================== Providers + key slots ===================== */}
      <section className="pc-glass p-5">
        <h2 className="text-sm font-bold flex items-center gap-2 text-slate-700 dark:text-slate-200 mb-1">
          <KeyRound className="w-4 h-4 text-indigo-500" /> {t('aiKeys.providersSection')}
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">{t('aiKeys.providersHint')}</p>

        {loading && !providers ? (
          <div className="text-xs text-slate-500 py-8 text-center flex flex-col items-center gap-2">
            <RefreshCcw className="w-5 h-5 animate-spin text-slate-400" /> {t('aiKeys.loading')}
          </div>
        ) : !providers || providers.length === 0 ? (
          <div className="text-xs text-slate-500 py-6 text-center border border-dashed border-slate-300 dark:border-white/10 rounded-2xl">
            {t('aiKeys.noProviders')}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {providers.map((p) => (
              <div key={p.name}
                   className="rounded-2xl p-4 border bg-white/40 dark:bg-white/5 border-slate-300/35 dark:border-white/5 flex flex-col gap-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex items-center gap-1.5 flex-wrap">
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate">{p.name}</span>
                    {p.image_only && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-bold uppercase bg-pink-500/15 text-pink-500">
                        <ImageIcon className="w-3 h-3" /> {t('aiKeys.imageOnly')}
                      </span>
                    )}
                  </div>
                  {providerStatusBadge(p)}
                </div>

                <div className="flex flex-col gap-1 text-[11px] text-slate-500">
                  <span className="inline-flex items-center gap-1 font-mono truncate" title={t('aiKeys.keyBaseTitle')}>
                    <KeyRound className="w-3 h-3 shrink-0" />{p.key_base || '—'}
                  </span>
                  {!p.keyless && (
                    <span className="font-mono text-slate-400">
                      {t('aiKeys.keyCount', { count: p.key_count })}
                    </span>
                  )}
                </div>

                {p.keyless ? (
                  <p className="text-[11px] text-sky-500 flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 shrink-0" /> {t('aiKeys.keylessHint')}
                  </p>
                ) : (
                  <>
                    <KeySlots
                      slots={p.keys}
                      label={t('aiKeys.textKeys')}
                      resolveName={makeResolveName(p.key_base, false)}
                      onDelete={handleDelete}
                      deleting={deleting}
                    />
                    <KeySlots
                      slots={p.image_keys}
                      label={t('aiKeys.imageKeys')}
                      resolveName={makeResolveName(p.key_base, true)}
                      onDelete={handleDelete}
                      deleting={deleting}
                    />
                    {p.keys.length === 0 && p.image_keys.length === 0 && (
                      <p className="text-[11px] italic text-slate-400">{t('aiKeys.noKeysYet')}</p>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ===================== Raw key files (targeted delete) ===================== */}
      {rawKeyFiles.length > 0 && (
        <section className="pc-glass p-5">
          <h2 className="text-sm font-bold flex items-center gap-2 text-slate-700 dark:text-slate-200 mb-1">
            <Trash2 className="w-4 h-4 text-indigo-500" /> {t('aiKeys.rawFilesSection')}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">{t('aiKeys.rawFilesHint')}</p>
          <div className="flex flex-wrap gap-2">
            {rawKeyFiles.map((name) => {
              const busy = deleting.has(name);
              return (
                <span key={name}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-mono border bg-white/40 dark:bg-white/5 border-slate-300/35 dark:border-white/5 text-slate-600 dark:text-slate-300">
                  {name}
                  <button
                    type="button"
                    onClick={() => handleDelete(name)}
                    disabled={busy}
                    title={`Delete ${name}`}
                    className="p-0.5 rounded text-rose-500 hover:bg-rose-500/15 transition disabled:opacity-40">
                    {busy ? <RefreshCcw className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                  </button>
                </span>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
};

export default PcAiKeysView;
