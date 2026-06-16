/**
 * AiKeysPanel — set / list / delete AI provider API keys from the UI.
 *
 * One card per provider over GET /api/local/ai/keys. Each card lists the
 * provider's secret slots (indexed _1.._5, the bare base, dedicated image
 * _IMAGE_1.._5, plus the extra secret like CLOUDFLARE_ACCOUNT_ID). Every slot
 * shows whether a value is stored (first4…last4 mask — the raw key is NEVER
 * returned) and offers an input to set/replace it plus a delete button.
 *
 * Multiple keys (KEY_1, KEY_2, …) feed the gateway's automatic failover: when
 * KEY_1 hits a rate limit / quota error the gateway rotates to KEY_2. The keys
 * live in the shared secret store, so they apply to BOTH laravel_main and
 * pycore. Keyless providers (e.g. pollinations) show "no key required".
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  KeyRound, RefreshCcw, AlertTriangle, Save, Trash2, Eye, EyeOff,
  ShieldCheck, Image as ImageIcon, Link2, CheckCircle2, CircleDashed,
} from 'lucide-react';
import { api } from '../../core/api';
import { useToast } from '../admin';
import { appendLog } from '../../core/logstore/logStore';
import type { AiKeysProvider, AiKeySlot } from '../../core/api/modules/AiManagementAPI';
import ToolWrapper from '../universal/ToolWrapper';
import { commonClasses } from '../../styles/theme';
import { AiBentoCard, AiToolAlert } from './ui';

/** Classify a slot name for its icon/label hint. */
function slotKind(name: string): 'image' | 'baseurl' | 'extra' | 'key' {
  if (name.includes('_IMAGE')) return 'image';
  if (name.includes('_BASE_URL')) return 'baseurl';
  return 'key';
}

const SlotRow: React.FC<{
  slot: AiKeySlot;
  extraName: string | null;
  busy: boolean;
  onSave: (name: string, value: string) => void;
  onDelete: (name: string) => void;
}> = ({ slot, extraName, busy, onSave, onDelete }) => {
  const [value, setValue] = useState('');
  const [reveal, setReveal] = useState(false);

  const isExtra = extraName != null && slot.name === extraName;
  const kind = isExtra ? 'extra' : slotKind(slot.name);
  const KindIcon = kind === 'image' ? ImageIcon : kind === 'baseurl' ? Link2 : kind === 'extra' ? ShieldCheck : KeyRound;
  // Non-secret config (endpoint / deployment / region / base-url): shown in full,
  // edited as plain text so the user can read/verify what they enter.
  const isConfig = slot.secret === false;

  const save = () => {
    const v = value.trim();
    if (!v || busy) return;
    onSave(slot.name, v);
    setValue('');
    setReveal(false);
  };

  return (
    <div className="rounded-xl px-3 py-2.5 border bg-white/40 dark:bg-white/5 border-slate-300/35 dark:border-white/5 flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2 min-w-0">
        <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-bold text-slate-600 dark:text-slate-300 truncate" title={slot.name}>
          <KindIcon className="w-3.5 h-3.5 shrink-0 text-indigo-400/80" />
          {slot.name}
        </span>
        {slot.set ? (
          <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-bold uppercase bg-emerald-500/15 text-emerald-500" title={`stored · ${slot.masked ?? ''}`}>
            <CheckCircle2 className="w-3 h-3" /> set
          </span>
        ) : (
          <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-bold uppercase bg-slate-500/10 text-slate-400">
            <CircleDashed className="w-3 h-3" /> empty
          </span>
        )}
      </div>

      {slot.set && (
        <span
          className="font-mono text-[10px] text-slate-400 truncate"
          title={isConfig ? 'Stored config value' : 'Stored value (masked — raw key is never shown)'}
        >
          {slot.masked ?? '••••'}
        </span>
      )}

      <div className="flex items-center gap-1.5">
        <div className="relative flex-1 min-w-0">
          <input
            type={isConfig || reveal ? 'text' : 'password'}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); save(); } }}
            placeholder={isConfig ? (slot.set ? 'Replace config…' : 'Enter config value…') : (slot.set ? 'Replace value…' : 'Enter value…')}
            autoComplete="off"
            spellCheck={false}
            disabled={busy}
            className="w-full pr-8 pl-2.5 py-1.5 rounded-lg text-[11px] font-mono border bg-white/60 dark:bg-white/5 border-slate-300/40 dark:border-white/10 text-slate-700 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 disabled:opacity-50"
          />
          {!isConfig && (
            <button
              type="button"
              onClick={() => setReveal((r) => !r)}
              tabIndex={-1}
              title={reveal ? 'Hide' : 'Show'}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              {reveal ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>
        <button
          onClick={save}
          disabled={busy || !value.trim()}
          title="Save this key"
          className="shrink-0 px-2 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1 bg-indigo-600 hover:bg-indigo-700 text-white transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {busy ? <RefreshCcw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
        </button>
        <button
          onClick={() => onDelete(slot.name)}
          disabled={busy || !slot.set}
          title={slot.set ? 'Delete this key' : 'Nothing to delete'}
          className="shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

const AiKeysPanel: React.FC = () => {
  const toast = useToast();

  const [providers, setProviders] = useState<AiKeysProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.aiManagement.listKeys();
      if (res.success && res.data && Array.isArray(res.data.providers)) {
        setProviders(res.data.providers);
      } else {
        setError(res.error || res.data?.error || 'AI key inventory unavailable.');
      }
    } catch (e: any) {
      setError(e?.message || 'AI key backend unreachable.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const markBusy = (name: string, on: boolean) =>
    setBusy((s) => { const n = new Set(s); if (on) n.add(name); else n.delete(name); return n; });

  const saveKey = useCallback(async (name: string, value: string) => {
    markBusy(name, true);
    appendLog('info', 'ai', `AI key: setting ${name}`);
    try {
      const res = await api.aiManagement.setKey(name, value);
      if (res.success && res.data?.success) {
        toast.success(`${name} saved (${res.data.masked ?? 'set'})`, 'AI keys');
        appendLog('success', 'ai', `AI key set: ${name} → ${res.data.masked ?? 'set'}`);
        await load();
      } else {
        const msg = res.data?.error || res.error || 'Save failed';
        toast.error(msg, 'AI keys');
        appendLog('error', 'ai', `AI key set failed (${name}): ${msg}`);
      }
    } catch (e: any) {
      toast.error(e?.message || 'Save failed', 'AI keys');
    } finally {
      markBusy(name, false);
    }
  }, [load, toast]);

  const deleteKey = useCallback(async (name: string) => {
    markBusy(name, true);
    appendLog('info', 'ai', `AI key: deleting ${name}`);
    try {
      const res = await api.aiManagement.deleteKey(name);
      if (res.success && res.data?.success) {
        toast.success(`${name} deleted`, 'AI keys');
        appendLog('success', 'ai', `AI key deleted: ${name}`);
        await load();
      } else {
        const msg = res.data?.error || res.error || 'Delete failed';
        toast.error(msg, 'AI keys');
        appendLog('error', 'ai', `AI key delete failed (${name}): ${msg}`);
      }
    } catch (e: any) {
      toast.error(e?.message || 'Delete failed', 'AI keys');
    } finally {
      markBusy(name, false);
    }
  }, [load, toast]);

  return (
    <ToolWrapper
      title="Provider API Keys"
      icon={KeyRound}
      gradient="indigo"
      description="Set / list / delete AI provider keys — shared with pycore, with multi-key failover"
      actions={
        <button
          onClick={() => void load()}
          disabled={loading}
          className={`${commonClasses.button} ${commonClasses.buttonPrimary} text-xs flex items-center gap-1.5 disabled:opacity-50`}
        >
          <RefreshCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      }
    >
      <div className="space-y-4 sm:space-y-5">
        <AiToolAlert variant="info">
          <span className="flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="break-words leading-relaxed">
              Keys are stored in the shared secret store, so they apply to both laravel_main and pycore.
              Storing more than one key per provider (KEY_1, KEY_2, …) enables automatic failover —
              when one key is rate limited or out of quota, the gateway rotates to the next. Stored values
              are shown masked only; the raw key is never returned to the browser.
            </span>
          </span>
        </AiToolAlert>

        {error && (
          <AiToolAlert variant="warning">
            <span className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="break-words">{error}</span>
            </span>
          </AiToolAlert>
        )}

        {loading && providers.length === 0 ? (
          <div className="text-xs text-slate-500 py-10 text-center flex flex-col items-center gap-2">
            <RefreshCcw className="w-5 h-5 animate-spin text-slate-400" /> Loading keys…
          </div>
        ) : providers.length === 0 ? (
          <AiBentoCard>
            <div className="text-center py-12">
              <KeyRound className="w-12 h-12 mx-auto mb-3 text-slate-300 dark:text-slate-600" />
              <p className="text-slate-500 dark:text-slate-400">No providers reported.</p>
            </div>
          </AiBentoCard>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {providers.map((prov) => {
              const setCount = prov.slots.filter((s) => s.set).length;
              return (
                <div
                  key={prov.provider}
                  className="rounded-2xl p-4 border bg-white/40 dark:bg-white/5 border-slate-300/35 dark:border-white/5 flex flex-col gap-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate">{prov.provider}</span>
                      {prov.key_base && (
                        <span className="font-mono text-[10px] text-slate-400 truncate" title="Registry key base">{prov.key_base}</span>
                      )}
                    </div>
                    {!prov.keyless && (
                      <span
                        className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-bold uppercase ${
                          setCount > 0 ? 'bg-emerald-500/15 text-emerald-500' : 'bg-slate-500/10 text-slate-400'
                        }`}
                        title="Number of stored keys for this provider"
                      >
                        <KeyRound className="w-3 h-3" /> {setCount} set
                      </span>
                    )}
                  </div>

                  {prov.keyless ? (
                    <div className="rounded-xl px-3 py-3 border border-dashed border-emerald-400/30 bg-emerald-500/5 text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 shrink-0" />
                      No key required — this provider is free with no API key.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {prov.slots.map((slot) => (
                        <SlotRow
                          key={slot.name}
                          slot={slot}
                          extraName={prov.extra_secret_name}
                          busy={busy.has(slot.name)}
                          onSave={saveKey}
                          onDelete={deleteKey}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </ToolWrapper>
  );
};

export default AiKeysPanel;
