/** AES-256-GCM text vault: passphrase-sealed messages with a self-describing packed format and one-click round trips. */
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowDownUp, LockKeyhole, LockKeyholeOpen, Loader2, TriangleAlert } from 'lucide-react';
import { ChipGroup } from '@/shared/ui/ChipGroup';
import type { ToolWorkbenchProps } from '../toolWorkbenchTypes';
import { AesToolError, decryptText, DEFAULT_PBKDF2_ITERATIONS, encryptText, PBKDF2_ITERATION_OPTIONS } from './lib/aesLib';
import { fromBase64 } from './lib/cryptoCore';
import { analyzePassword } from './lib/passwordLib';
import { EntropyMeter, FieldLabel, Hint, ModeTabs, Readout, SecretInput, VAULT_BUTTON, VAULT_FIELD, VAULT_GHOST_BUTTON, VaultPage, VaultPanel, readSettings, useVaultRecorder } from './cryptoKit';

type CipherMode = 'encrypt' | 'decrypt';

interface EncryptionSettings {
  mode: CipherMode;
  iterations: number;
}

const DEFAULT_SETTINGS: EncryptionSettings = { mode: 'encrypt', iterations: DEFAULT_PBKDF2_ITERATIONS };
const WEAK_PASSPHRASE_BITS = 40;
const LAYOUT = [
  { id: 'version', bytes: 1 },
  { id: 'iterations', bytes: 4 },
  { id: 'salt', bytes: 16 },
  { id: 'iv', bytes: 12 },
] as const;
const CHIP_CLASS = 'rounded-lg px-3 py-1.5 font-mono text-[11px]';
const CHIP_SELECTED = 'border-emerald-500 bg-emerald-500/15 text-emerald-600 dark:text-emerald-300';
const CHIP_IDLE = 'border-slate-200 bg-white text-slate-500 hover:bg-slate-100 dark:border-emerald-400/10 dark:bg-white/5 dark:text-slate-400 dark:hover:bg-white/10';
const HEADER_BYTES = LAYOUT.reduce((sum, part) => sum + part.bytes, 0);

const TextEncryptionWorkbench: React.FC<ToolWorkbenchProps> = ({ tool, variant, lastRun }) => {
  const { t } = useTranslation();
  const initial = useMemo(() => {
    const saved = readSettings(lastRun, DEFAULT_SETTINGS);
    return variant === 'textDecryption' ? { ...saved, mode: 'decrypt' as CipherMode } : saved;
  }, [lastRun, variant]);
  const record = useVaultRecorder(tool.id, variant);
  const [mode, setMode] = useState<CipherMode>(initial.mode);
  const [iterations, setIterations] = useState(initial.iterations);
  const [input, setInput] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [output, setOutput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const strength = useMemo(() => analyzePassword(passphrase), [passphrase]);
  const encrypting = mode === 'encrypt';
  const packedSize = useMemo(() => (encrypting && output ? fromBase64(output)?.length ?? 0 : 0), [encrypting, output]);

  const switchMode = (next: CipherMode): void => {
    setMode(next);
    setOutput('');
    setError(null);
  };

  const run = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      const value = encrypting ? await encryptText(input, passphrase, iterations) : await decryptText(input.trim(), passphrase);
      setOutput(value);
      record({ mode, iterations }, { outputChars: value.length });
    } catch (err) {
      setOutput('');
      setError(err instanceof AesToolError ? t(`toolsCrypto.textEncryption.errors.${err.code}`) : t('toolsCrypto.textEncryption.errors.failed'));
    } finally {
      setBusy(false);
    }
  };

  const roundTrip = (): void => {
    setInput(output);
    switchMode(encrypting ? 'decrypt' : 'encrypt');
  };

  return (
    <VaultPage>
      <ModeTabs value={mode} onChange={switchMode} label={t('toolsCrypto.textEncryption.mode')} options={[
        { value: 'encrypt', label: t('toolsCrypto.textEncryption.mode_encrypt') },
        { value: 'decrypt', label: t('toolsCrypto.textEncryption.mode_decrypt') },
      ]} />

      <div className="grid gap-4 md:grid-cols-2">
        <VaultPanel title={t(encrypting ? 'toolsCrypto.textEncryption.plain_title' : 'toolsCrypto.textEncryption.cipher_title')} className="space-y-4">
          <div>
            <FieldLabel htmlFor="aes-input">{t(encrypting ? 'toolsCrypto.textEncryption.plain_label' : 'toolsCrypto.textEncryption.cipher_label')}</FieldLabel>
            <textarea id="aes-input" rows={7} value={input} onChange={(event) => setInput(event.target.value)} spellCheck={false}
              placeholder={t(encrypting ? 'toolsCrypto.textEncryption.plain_placeholder' : 'toolsCrypto.textEncryption.cipher_placeholder')} className={`${VAULT_FIELD} resize-y`} />
          </div>
          <SecretInput id="aes-pass" value={passphrase} onChange={setPassphrase} label={t('toolsCrypto.textEncryption.passphrase')} />
          {encrypting && passphrase !== '' && (
            <div className="space-y-2">
              <EntropyMeter bits={strength.entropyBits} caption={t('toolsCrypto.textEncryption.passphrase_strength')} />
              {strength.entropyBits < WEAK_PASSPHRASE_BITS && (
                <p className="flex items-center gap-1.5 font-mono text-[11px] text-amber-600 dark:text-amber-400"><TriangleAlert className="h-3.5 w-3.5 shrink-0" aria-hidden />{t('toolsCrypto.textEncryption.weak_passphrase')}</p>
              )}
            </div>
          )}
          {encrypting && (
            <div>
              <FieldLabel>{t('toolsCrypto.textEncryption.iterations')}</FieldLabel>
              <ChipGroup value={iterations} onChange={(count) => setIterations(count)} label={t('toolsCrypto.textEncryption.iterations')} options={PBKDF2_ITERATION_OPTIONS.map((count) => ({ value: count, label: count.toLocaleString() }))}
                chipClassName={CHIP_CLASS} selectedClassName={CHIP_SELECTED} idleClassName={CHIP_IDLE} />
            </div>
          )}
          <button type="button" onClick={run} disabled={busy || !input || !passphrase} className={`${VAULT_BUTTON} w-full`}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : encrypting ? <LockKeyhole className="h-4 w-4" aria-hidden /> : <LockKeyholeOpen className="h-4 w-4" aria-hidden />}
            {t(encrypting ? 'toolsCrypto.textEncryption.run_encrypt' : 'toolsCrypto.textEncryption.run_decrypt')}
          </button>
        </VaultPanel>

        <VaultPanel title={t(encrypting ? 'toolsCrypto.textEncryption.cipher_title' : 'toolsCrypto.textEncryption.plain_title')} vault className="space-y-3"
          actions={output ? (
            <button type="button" onClick={roundTrip} className={`${VAULT_GHOST_BUTTON} !border-emerald-400/20 !bg-emerald-400/10 !px-2 !py-1 !text-[10px] !text-emerald-300`}>
              <ArrowDownUp className="h-3 w-3" aria-hidden />{t('toolsCrypto.textEncryption.round_trip')}
            </button>
          ) : undefined}>
          {error && <p role="alert" className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 font-mono text-xs text-rose-300">{error}</p>}
          <Readout label={t(encrypting ? 'toolsCrypto.textEncryption.cipher_label' : 'toolsCrypto.textEncryption.plain_label')} value={output} masked={!encrypting}
            valueClassName={encrypting ? 'text-xs' : 'whitespace-pre-wrap text-sm'} emptyText={t('toolsCrypto.textEncryption.output_empty')} />
          {packedSize > 0 && (
            <div className="space-y-1.5">
              <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-emerald-500/80">{t('toolsCrypto.textEncryption.anatomy')}</p>
              <ul className="flex flex-wrap gap-1.5 font-mono text-[10px]">
                {LAYOUT.map((part) => (
                  <li key={part.id} className="rounded-lg border border-emerald-500/20 bg-black/30 px-2 py-1 text-emerald-200">{t(`toolsCrypto.textEncryption.part_${part.id}`)} <span className="text-emerald-500/60">{part.bytes}B</span></li>
                ))}
                <li className="rounded-lg border border-emerald-400/40 bg-emerald-400/10 px-2 py-1 text-emerald-200">{t('toolsCrypto.textEncryption.part_ciphertext')} <span className="text-emerald-500/60">{packedSize - HEADER_BYTES}B</span></li>
              </ul>
            </div>
          )}
        </VaultPanel>
      </div>

      <VaultPanel title={t('toolsCrypto.textEncryption.format_title')}>
        <div className="space-y-2">
          <Hint>{t('toolsCrypto.textEncryption.format_pack')}</Hint>
          <Hint>{t('toolsCrypto.textEncryption.format_key')}</Hint>
          <Hint>{t('toolsCrypto.textEncryption.format_note')}</Hint>
        </div>
      </VaultPanel>
    </VaultPage>
  );
};

export default TextEncryptionWorkbench;
