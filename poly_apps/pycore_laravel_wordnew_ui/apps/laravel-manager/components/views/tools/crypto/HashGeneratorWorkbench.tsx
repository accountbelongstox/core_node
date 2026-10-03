/** Live multi-digest workbench: text or file in, MD5 / SHA-1 / SHA-2 digests out with an expected-hash comparison. */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, FileUp, Trash2, XCircle } from 'lucide-react';
import type { ToolWorkbenchProps } from '../toolWorkbenchTypes';
import { DIGEST_ALGORITHMS, digest, toBase64, toHex, utf8Encode, type DigestAlgorithm } from './lib/cryptoCore';
import { CopyButton, FieldLabel, Hint, ModeTabs, VAULT_FIELD, VAULT_GHOST_BUTTON, VaultPage, VaultPanel, readSettings, useVaultRecorder } from './cryptoKit';

type InputMode = 'text' | 'file';
type DigestFormat = 'hex' | 'HEX' | 'base64';
type Digests = Partial<Record<DigestAlgorithm, Uint8Array>>;

interface HashSettings {
  mode: InputMode;
  format: DigestFormat;
}

const DEFAULT_SETTINGS: HashSettings = { mode: 'text', format: 'hex' };
const DIGEST_BITS: Record<DigestAlgorithm, number> = { MD5: 128, 'SHA-1': 160, 'SHA-256': 256, 'SHA-384': 384, 'SHA-512': 512 };
const WEAK_ALGORITHMS: readonly DigestAlgorithm[] = ['MD5', 'SHA-1'];
const FILE_LIMIT_BYTES = 128 * 1024 * 1024;
const TEXT_ROWS = 6;

const formatDigest = (bytes: Uint8Array, format: DigestFormat): string => {
  if (format === 'base64') return toBase64(bytes);
  const hex = toHex(bytes);
  return format === 'HEX' ? hex.toUpperCase() : hex;
};

const normalizeExpected = (value: string): string => value.trim().replace(/[\s:]/g, '');

const matchesExpected = (bytes: Uint8Array | undefined, expected: string): boolean => {
  if (!bytes || !expected) return false;
  return expected.toLowerCase() === toHex(bytes) || expected === toBase64(bytes) || expected === toBase64(bytes).replace(/=+$/, '');
};

const computeDigests = async (data: Uint8Array): Promise<Digests> => {
  const out: Digests = {};
  for (const algorithm of DIGEST_ALGORITHMS) {
    out[algorithm] = await digest(algorithm, data);
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  return out;
};

const HashGeneratorWorkbench: React.FC<ToolWorkbenchProps> = ({ tool, variant, lastRun }) => {
  const { t } = useTranslation();
  const initial = useMemo(() => readSettings(lastRun, DEFAULT_SETTINGS), [lastRun]);
  const record = useVaultRecorder(tool.id, variant);
  const [mode, setMode] = useState<InputMode>(initial.mode);
  const [format, setFormat] = useState<DigestFormat>(initial.format);
  const [text, setText] = useState('');
  const [expected, setExpected] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [digests, setDigests] = useState<Digests>({});
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [fileError, setFileError] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const normalizedExpected = normalizeExpected(expected);
  const byteLength = useMemo(() => utf8Encode(text).length, [text]);
  const matched = DIGEST_ALGORITHMS.find((algorithm) => matchesExpected(digests[algorithm], normalizedExpected));
  const ready = mode === 'text' || (file !== null && !fileError);

  useEffect(() => {
    let cancelled = false;
    setFileError(false);
    const source = mode === 'text' ? Promise.resolve(utf8Encode(text)) : file
      ? (file.size > FILE_LIMIT_BYTES ? Promise.reject(new Error('too_large')) : file.arrayBuffer().then((buffer) => new Uint8Array(buffer)))
      : null;
    if (!source) {
      setDigests({});
      return undefined;
    }
    setBusy(true);
    source.then(computeDigests).then((value) => { if (!cancelled) setDigests(value); })
      .catch(() => { if (!cancelled) { setDigests({}); setFileError(true); } })
      .finally(() => { if (!cancelled) setBusy(false); });
    return () => { cancelled = true; };
  }, [mode, text, file]);

  const pickFile = (picked: File | undefined): void => {
    if (picked) setFile(picked);
  };

  const recordCopy = (algorithm: DigestAlgorithm) => () => record({ mode, format }, { algorithm, inputBytes: mode === 'text' ? byteLength : file?.size ?? 0 });

  return (
    <VaultPage>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ModeTabs value={mode} onChange={setMode} label={t('toolsCrypto.hashGenerator.input_mode')} options={[
          { value: 'text', label: t('toolsCrypto.hashGenerator.mode_text') },
          { value: 'file', label: t('toolsCrypto.hashGenerator.mode_file') },
        ]} />
        <ModeTabs value={format} onChange={setFormat} label={t('toolsCrypto.hashGenerator.output_format')} options={[
          { value: 'hex', label: 'hex' },
          { value: 'HEX', label: 'HEX' },
          { value: 'base64', label: 'base64' },
        ]} />
      </div>

      {mode === 'text' ? (
        <VaultPanel title={t('toolsCrypto.hashGenerator.text_title')} actions={
          <button type="button" className={VAULT_GHOST_BUTTON} disabled={!text} onClick={() => setText('')}>
            <Trash2 className="h-3.5 w-3.5" aria-hidden />{t('uiTools.common.clear')}
          </button>
        }>
          <textarea value={text} rows={TEXT_ROWS} onChange={(event) => setText(event.target.value)} spellCheck={false}
            placeholder={t('toolsCrypto.hashGenerator.text_placeholder')} className={`${VAULT_FIELD} resize-y`} />
          <p className="mt-2 font-mono text-[10px] text-slate-400">{t('toolsCrypto.hashGenerator.counter', { chars: Array.from(text).length, bytes: byteLength })}</p>
        </VaultPanel>
      ) : (
        <VaultPanel title={t('toolsCrypto.hashGenerator.file_title')}>
          <button type="button" onClick={() => fileInput.current?.click()}
            onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => { event.preventDefault(); setDragging(false); pickFile(event.dataTransfer.files[0]); }}
            className={`flex w-full cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 font-mono text-xs transition-colors ${dragging ? 'border-emerald-500 bg-emerald-500/10' : 'border-slate-300 hover:border-emerald-500/60 dark:border-emerald-400/20'}`}>
            <FileUp className="h-6 w-6 text-emerald-500" aria-hidden />
            <span className="break-all text-slate-700 dark:text-slate-200">{file ? file.name : t('toolsCrypto.hashGenerator.file_drop')}</span>
            {file && <span className="text-[10px] text-slate-400">{t('toolsCrypto.hashGenerator.file_size', { bytes: file.size.toLocaleString() })}</span>}
          </button>
          <input ref={fileInput} type="file" className="hidden" onChange={(event) => { pickFile(event.target.files?.[0]); event.target.value = ''; }} />
          {fileError && <div className="mt-2"><Hint tone="error">{t('toolsCrypto.hashGenerator.file_too_large', { mb: FILE_LIMIT_BYTES / 1024 / 1024 })}</Hint></div>}
        </VaultPanel>
      )}

      <VaultPanel title={t('toolsCrypto.hashGenerator.digests_title')} vault actions={busy ? <span className="font-mono text-[10px] text-emerald-400/70">{t('toolsCrypto.hashGenerator.computing')}</span> : undefined}>
        <ul className="space-y-2">
          {DIGEST_ALGORITHMS.map((algorithm) => {
            const bytes = digests[algorithm];
            const value = ready && bytes ? formatDigest(bytes, format) : '';
            const isMatch = matched === algorithm;
            return (
              <li key={algorithm} className={`rounded-xl border px-3 py-2.5 transition-colors ${isMatch ? 'border-emerald-400/70 bg-emerald-400/10' : 'border-emerald-500/15 bg-black/20'}`}>
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 font-mono text-[11px] font-black text-emerald-300">
                    {algorithm}
                    <span className="text-[9px] font-bold text-emerald-500/60">{DIGEST_BITS[algorithm]}-bit</span>
                    {WEAK_ALGORITHMS.includes(algorithm) && <span className="rounded-full bg-amber-400/15 px-1.5 py-0.5 text-[9px] font-bold uppercase text-amber-300">{t('toolsCrypto.hashGenerator.legacy')}</span>}
                    {isMatch && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" aria-label={t('toolsCrypto.hashGenerator.match')} />}
                  </span>
                  <CopyButton value={value} dark onCopied={recordCopy(algorithm)} />
                </div>
                <p className="break-all font-mono text-xs leading-relaxed text-emerald-100">{value || <span className="text-emerald-500/40">{'—'}</span>}</p>
              </li>
            );
          })}
        </ul>
      </VaultPanel>

      <VaultPanel title={t('toolsCrypto.hashGenerator.compare_title')}>
        <FieldLabel htmlFor="hash-expected">{t('toolsCrypto.hashGenerator.compare_label')}</FieldLabel>
        <input id="hash-expected" value={expected} onChange={(event) => setExpected(event.target.value)} spellCheck={false} autoComplete="off"
          placeholder={t('toolsCrypto.hashGenerator.compare_placeholder')} className={VAULT_FIELD} />
        {normalizedExpected && (
          <p className={`mt-2 flex items-center gap-1.5 font-mono text-xs font-bold ${matched ? 'text-emerald-500' : 'text-rose-500'}`}>
            {matched ? <CheckCircle2 className="h-4 w-4" aria-hidden /> : <XCircle className="h-4 w-4" aria-hidden />}
            {matched ? t('toolsCrypto.hashGenerator.compare_match', { algorithm: matched }) : t('toolsCrypto.hashGenerator.compare_mismatch')}
          </p>
        )}
      </VaultPanel>
    </VaultPage>
  );
};

export default HashGeneratorWorkbench;
