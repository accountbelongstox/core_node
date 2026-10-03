/** Instant random-token forge: alphabet toggles or raw-byte encodings, presets, entropy meter and batch output. */
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dices, RefreshCw } from 'lucide-react';
import { ChipGroup } from '@/shared/ui/ChipGroup';
import type { ToolWorkbenchProps } from '../toolWorkbenchTypes';
import { buildAlphabet, DEFAULT_TOKEN_OPTIONS, generateTokens, tokenEntropyBits, tokenLengthLimits, type TokenKind, type TokenOptions } from './lib/tokenLib';
import { BatchList, EntropyMeter, FieldLabel, Hint, ModeTabs, Readout, ToggleRow, VAULT_BUTTON, VAULT_FIELD, VaultPage, VaultPanel, VaultRange, readSettings, useVaultRecorder } from './cryptoKit';

type PresetId = 'pin' | 'password' | 'apiKey' | 'hex' | 'urlSafe';

const PRESETS: Record<PresetId, Partial<TokenOptions>> = {
  pin: { kind: 'charset', length: 6, lower: false, upper: false, digits: true, symbols: false, custom: '', excludeAmbiguous: false, prefix: '' },
  password: { kind: 'charset', length: 20, lower: true, upper: true, digits: true, symbols: true, custom: '', excludeAmbiguous: true, prefix: '' },
  apiKey: { kind: 'charset', length: 40, lower: true, upper: true, digits: true, symbols: false, custom: '', excludeAmbiguous: false, prefix: 'sk_' },
  hex: { kind: 'hex', length: 32, prefix: '' },
  urlSafe: { kind: 'base64url', length: 32, prefix: '' },
};
const PRESET_ORDER: readonly PresetId[] = ['pin', 'password', 'apiKey', 'hex', 'urlSafe'];
const MAX_COUNT = 50;
const CHIP_CLASS = 'rounded-lg px-3 py-1.5 font-mono text-[11px]';
const CHIP_SELECTED = 'border-emerald-500 bg-emerald-500/15 text-emerald-600 dark:text-emerald-300';
const CHIP_IDLE = 'border-slate-200 bg-white text-slate-500 hover:bg-slate-100 dark:border-emerald-400/10 dark:bg-white/5 dark:text-slate-400 dark:hover:bg-white/10';

const TokenGeneratorWorkbench: React.FC<ToolWorkbenchProps> = ({ tool, variant, lastRun }) => {
  const { t } = useTranslation();
  const initial = useMemo(() => readSettings(lastRun, DEFAULT_TOKEN_OPTIONS), [lastRun]);
  const record = useVaultRecorder(tool.id, variant);
  const [options, setOptions] = useState<TokenOptions>(initial);
  const [round, setRound] = useState(0);
  const limits = tokenLengthLimits(options.kind);
  const length = Math.min(limits.max, Math.max(limits.min, options.length));
  const effective = useMemo(() => ({ ...options, length }), [options, length]);
  const alphabetSize = useMemo(() => buildAlphabet(effective).length, [effective]);
  const tokens = useMemo(() => generateTokens(effective), [effective, round]);
  const bits = tokenEntropyBits(effective);
  const charset = options.kind === 'charset';

  const patch = (next: Partial<TokenOptions>): void => setOptions((prev) => ({ ...prev, ...next }));
  const recordUse = (): void => record({ ...effective }, { count: tokens.length, entropyBits: Math.round(bits) });
  const changeKind = (kind: TokenKind): void => {
    const next = tokenLengthLimits(kind);
    patch({ kind, length: kind === 'charset' ? DEFAULT_TOKEN_OPTIONS.length : Math.min(next.max, Math.max(next.min, 32)) });
  };

  return (
    <VaultPage>
      <VaultPanel title={t('toolsCrypto.tokenGenerator.presets_title')} icon={Dices}>
        <ChipGroup value={'' as PresetId | ''} onChange={(id) => { if (id) setOptions((prev) => ({ ...prev, ...PRESETS[id] })); }} label={t('toolsCrypto.tokenGenerator.presets_title')}
          options={PRESET_ORDER.map((id) => ({ value: id, label: t(`toolsCrypto.tokenGenerator.preset_${id}`) }))}
          chipClassName={CHIP_CLASS} selectedClassName={CHIP_SELECTED} idleClassName={CHIP_IDLE} />
      </VaultPanel>

      <div className="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <VaultPanel title={t('toolsCrypto.tokenGenerator.options_title')} className="space-y-4">
          <ModeTabs value={options.kind} onChange={changeKind} label={t('toolsCrypto.tokenGenerator.kind')} options={[
            { value: 'charset', label: t('toolsCrypto.tokenGenerator.kind_charset') },
            { value: 'hex', label: 'hex' },
            { value: 'base64url', label: 'base64url' },
          ]} />
          <VaultRange label={t(charset ? 'toolsCrypto.tokenGenerator.length_chars' : 'toolsCrypto.tokenGenerator.length_bytes')} value={length}
            min={limits.min} max={limits.max} onChange={(next) => patch({ length: next })} />
          <VaultRange label={t('toolsCrypto.tokenGenerator.count')} value={options.count} min={1} max={MAX_COUNT} onChange={(count) => patch({ count })} />
          {charset && (
            <div>
              <FieldLabel>{t('toolsCrypto.tokenGenerator.alphabet')}</FieldLabel>
              <div className="grid grid-cols-2 gap-2">
                {(['lower', 'upper', 'digits', 'symbols'] as const).map((key) => (
                  <button key={key} type="button" aria-pressed={options[key]} onClick={() => patch({ [key]: !options[key] })}
                    className={`cursor-pointer rounded-lg border px-2 py-2 font-mono text-xs font-bold transition-colors ${options[key] ? CHIP_SELECTED : CHIP_IDLE}`}>
                    {t(`toolsCrypto.tokenGenerator.set_${key}`)}
                  </button>
                ))}
              </div>
              <div className="mt-2"><ToggleRow label={t('toolsCrypto.tokenGenerator.exclude_ambiguous')} hint="0 O 1 l I | ` ' &quot;" on={options.excludeAmbiguous} onChange={(excludeAmbiguous) => patch({ excludeAmbiguous })} /></div>
              <div className="mt-2">
                <FieldLabel htmlFor="token-custom">{t('toolsCrypto.tokenGenerator.custom_chars')}</FieldLabel>
                <input id="token-custom" value={options.custom} onChange={(event) => patch({ custom: event.target.value })} spellCheck={false} autoComplete="off" className={VAULT_FIELD} />
              </div>
            </div>
          )}
          <div>
            <FieldLabel htmlFor="token-prefix">{t('toolsCrypto.tokenGenerator.prefix')}</FieldLabel>
            <input id="token-prefix" value={options.prefix} onChange={(event) => patch({ prefix: event.target.value })} spellCheck={false} autoComplete="off" placeholder="sk_live_" className={VAULT_FIELD} />
          </div>
        </VaultPanel>

        <VaultPanel title={t('toolsCrypto.tokenGenerator.output_title')} vault className="space-y-4">
          {tokens.length === 0 ? (
            <Hint tone="warn">{t('toolsCrypto.tokenGenerator.empty_alphabet')}</Hint>
          ) : (
            <>
              {tokens.length > 1
                ? <BatchList items={tokens} filename="tokens.txt" onCopied={recordUse} onDownloaded={recordUse} itemClassName="text-sm" />
                : <Readout label={t('toolsCrypto.tokenGenerator.primary')} value={tokens[0]} onCopied={recordUse} valueClassName="text-base" />}
              <EntropyMeter bits={bits} />
              <p className="font-mono text-[10px] text-emerald-500/60">
                {charset ? t('toolsCrypto.tokenGenerator.alphabet_size', { size: alphabetSize }) : t('toolsCrypto.tokenGenerator.byte_source', { bytes: length })}
              </p>
            </>
          )}
          <button type="button" onClick={() => setRound((prev) => prev + 1)} className={`${VAULT_BUTTON} w-full`}>
            <RefreshCw className="h-3.5 w-3.5" aria-hidden />{t('toolsCrypto.common.regenerate')}
          </button>
        </VaultPanel>
      </div>
    </VaultPage>
  );
};

export default TokenGeneratorWorkbench;
