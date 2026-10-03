/** BIP-39 seed-phrase bench: numbered word grid hidden until revealed, checksum validator and PBKDF2 seed derivation, all offline. */
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, Eye, EyeOff, RefreshCw, TriangleAlert, XCircle } from 'lucide-react';
import { ChipGroup } from '@/shared/ui/ChipGroup';
import type { ToolWorkbenchProps } from '../toolWorkbenchTypes';
import { BIP39_STRENGTHS, BIP39_WORD_COUNTS, checkMnemonic, generateMnemonic, mnemonicToSeedHex, type MnemonicCheck } from './lib/bip39Lib';
import { BIP39_WORDLIST } from './lib/bip39Words';
import { CopyButton, FieldLabel, Hint, ModeTabs, Readout, SecretInput, VAULT_BUTTON, VAULT_FIELD, VaultPage, VaultPanel, readSettings, useVaultRecorder } from './cryptoKit';

type Bip39Tab = 'generate' | 'validate';

interface Bip39Settings {
  strength: number;
}

const DEFAULT_SETTINGS: Bip39Settings = { strength: 128 };
const SEED_DEBOUNCE_MS = 250;
const NO_WORDS: string[] = [];
const WORD_SET = new Set(BIP39_WORDLIST);
const CHIP_CLASS = 'rounded-lg px-3 py-1.5 font-mono text-[11px]';
const CHIP_SELECTED = 'border-emerald-500 bg-emerald-500/15 text-emerald-600 dark:text-emerald-300';
const CHIP_IDLE = 'border-slate-200 bg-white text-slate-500 hover:bg-slate-100 dark:border-emerald-400/10 dark:bg-white/5 dark:text-slate-400 dark:hover:bg-white/10';

const Bip39Workbench: React.FC<ToolWorkbenchProps> = ({ tool, variant, lastRun }) => {
  const { t } = useTranslation();
  const initial = useMemo(() => {
    const saved = readSettings(lastRun, DEFAULT_SETTINGS);
    return BIP39_STRENGTHS.includes(saved.strength) ? saved : DEFAULT_SETTINGS;
  }, [lastRun]);
  const record = useVaultRecorder(tool.id, variant);
  const [tab, setTab] = useState<Bip39Tab>('generate');
  const [strength, setStrength] = useState(initial.strength);
  const [words, setWords] = useState<string[]>([]);
  const [revealed, setRevealed] = useState(false);
  const [round, setRound] = useState(0);
  const [passphrase, setPassphrase] = useState('');
  const [phrase, setPhrase] = useState('');
  const [check, setCheck] = useState<MnemonicCheck | null>(null);
  const [seed, setSeed] = useState('');
  const activeWords = useMemo(() => (tab === 'generate' ? words : check?.valid ? check.words : NO_WORDS), [tab, words, check]);
  const phraseWords = useMemo(() => phrase.trim().toLowerCase().split(/\s+/).filter(Boolean), [phrase]);

  useEffect(() => {
    let cancelled = false;
    generateMnemonic(strength).then((value) => { if (!cancelled) { setWords(value); setRevealed(false); } });
    return () => { cancelled = true; };
  }, [strength, round]);

  useEffect(() => {
    let cancelled = false;
    if (!phrase.trim()) {
      setCheck(null);
      return undefined;
    }
    checkMnemonic(phrase).then((value) => { if (!cancelled) setCheck(value); });
    return () => { cancelled = true; };
  }, [phrase]);

  useEffect(() => {
    let cancelled = false;
    if (activeWords.length === 0) {
      setSeed('');
      return undefined;
    }
    const timer = window.setTimeout(() => {
      mnemonicToSeedHex(activeWords, passphrase).then((value) => { if (!cancelled) setSeed(value); });
    }, SEED_DEBOUNCE_MS);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [activeWords, passphrase]);

  const recordUse = (): void => record({ strength }, { words: activeWords.length, tab });
  const toggle = t(revealed ? 'toolsCrypto.common.hide' : 'toolsCrypto.common.reveal');

  return (
    <VaultPage>
      <ModeTabs value={tab} onChange={setTab} label={t('toolsCrypto.bip39Generator.tab')} options={[
        { value: 'generate', label: t('toolsCrypto.bip39Generator.tab_generate') },
        { value: 'validate', label: t('toolsCrypto.bip39Generator.tab_validate') },
      ]} />

      {tab === 'generate' ? (
        <VaultPanel title={t('toolsCrypto.bip39Generator.phrase_title')} vault className="space-y-4" actions={
          <>
            <button type="button" onClick={() => setRevealed((prev) => !prev)} title={toggle} aria-pressed={revealed}
              className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-emerald-400/20 bg-emerald-400/10 px-2 py-1.5 font-mono text-[11px] font-bold text-emerald-300 hover:bg-emerald-400/20">
              {revealed ? <EyeOff className="h-3.5 w-3.5" aria-hidden /> : <Eye className="h-3.5 w-3.5" aria-hidden />}{toggle}
            </button>
            <CopyButton value={words.join(' ')} caption dark onCopied={recordUse} />
          </>
        }>
          <ol className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {words.map((word, index) => (
              <li key={`${index}:${word}`} className="flex items-center gap-2 rounded-xl border border-emerald-500/15 bg-black/30 px-2.5 py-2 font-mono">
                <span className="w-5 shrink-0 text-right text-[10px] text-emerald-500/50">{index + 1}</span>
                <span className={`min-w-0 flex-1 truncate text-sm font-bold text-emerald-200 transition-all ${revealed ? '' : 'select-none blur-sm'}`}>{word}</span>
              </li>
            ))}
          </ol>
          <div className="flex flex-wrap items-center gap-3">
            <ChipGroup value={strength} onChange={(bits) => setStrength(bits)} label={t('toolsCrypto.bip39Generator.words')}
              options={BIP39_STRENGTHS.map((bits, index) => ({ value: bits, label: t('toolsCrypto.bip39Generator.word_count', { count: BIP39_WORD_COUNTS[index] }) }))}
              chipClassName={CHIP_CLASS} selectedClassName="border-emerald-400 bg-emerald-400/20 text-emerald-200" idleClassName="border-emerald-500/20 bg-black/20 text-emerald-500/70 hover:bg-emerald-400/10" />
            <button type="button" onClick={() => setRound((prev) => prev + 1)} className={`${VAULT_BUTTON} ml-auto`}>
              <RefreshCw className="h-3.5 w-3.5" aria-hidden />{t('toolsCrypto.common.regenerate')}
            </button>
          </div>
          <p className="font-mono text-[10px] text-emerald-500/60">{t('toolsCrypto.bip39Generator.entropy_note', { entropy: strength, checksum: strength / 32 })}</p>
        </VaultPanel>
      ) : (
        <VaultPanel title={t('toolsCrypto.bip39Generator.validate_title')} className="space-y-3">
          <div>
            <FieldLabel htmlFor="bip39-phrase">{t('toolsCrypto.bip39Generator.validate_label')}</FieldLabel>
            <textarea id="bip39-phrase" rows={4} value={phrase} onChange={(event) => setPhrase(event.target.value)} spellCheck={false} autoComplete="off" autoCapitalize="off"
              placeholder={t('toolsCrypto.bip39Generator.validate_placeholder')} className={`${VAULT_FIELD} resize-y`} />
          </div>
          {phraseWords.length > 0 && (
            <ul className="flex flex-wrap gap-1.5">
              {phraseWords.map((word, index) => (
                <li key={`${index}:${word}`} className={`rounded-lg border px-2 py-1 font-mono text-xs font-bold ${WORD_SET.has(word) ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300' : 'border-rose-500/40 bg-rose-500/10 text-rose-500'}`}>
                  <span className="mr-1 text-[9px] opacity-60">{index + 1}</span>{word}
                </li>
              ))}
            </ul>
          )}
          {check && (
            <p className={`flex items-center gap-2 font-mono text-sm font-bold ${check.valid ? 'text-emerald-500' : 'text-rose-500'}`}>
              {check.valid ? <CheckCircle2 className="h-5 w-5" aria-hidden /> : <XCircle className="h-5 w-5" aria-hidden />}
              {check.valid ? t('toolsCrypto.bip39Generator.valid', { count: check.words.length })
                : t(`toolsCrypto.bip39Generator.issue_${check.issue ?? 'checksum'}`, { word: check.badWord ?? '', counts: BIP39_WORD_COUNTS.join(', ') })}
            </p>
          )}
        </VaultPanel>
      )}

      <VaultPanel title={t('toolsCrypto.bip39Generator.seed_title')} className="space-y-3">
        <SecretInput id="bip39-passphrase" value={passphrase} onChange={setPassphrase} label={t('toolsCrypto.bip39Generator.passphrase')} placeholder={t('toolsCrypto.bip39Generator.passphrase_placeholder')} />
        <Readout label={t('toolsCrypto.bip39Generator.seed_label')} value={seed} masked onCopied={recordUse} valueClassName="text-xs" emptyText={t('toolsCrypto.bip39Generator.seed_waiting')} />
        <Hint>{t('toolsCrypto.bip39Generator.seed_note')}</Hint>
        <p className="flex items-start gap-1.5 font-mono text-[11px] text-amber-600 dark:text-amber-400"><TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />{t('toolsCrypto.bip39Generator.warning')}</p>
      </VaultPanel>
    </VaultPage>
  );
};

export default Bip39Workbench;
