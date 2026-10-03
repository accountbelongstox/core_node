/** RSA keyring: keys are minted in the browser on every size change, shown in PKCS#8 / PKCS#1 / JWK with fingerprints and downloads. */
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, KeyRound, Loader2, RefreshCw, TriangleAlert } from 'lucide-react';
import { ChipGroup } from '@/shared/ui/ChipGroup';
import { downloadAsFile } from '@/apps/laravel-manager/utils/exportResult';
import type { ToolWorkbenchProps } from '../toolWorkbenchTypes';
import { generateRsaKeyPair, RSA_KEY_SIZES, RSA_WEAK_SIZE, type RsaKeyFormat, type RsaKeyMaterial } from './lib/keyLib';
import { FieldLabel, FingerprintChip, Hint, ModeTabs, Readout, VAULT_BUTTON, VaultPage, VaultPanel, readSettings, useVaultRecorder } from './cryptoKit';

interface RsaSettings {
  bits: number;
  format: RsaKeyFormat;
}

const DEFAULT_SETTINGS: RsaSettings = { bits: 2048, format: 'pkcs8' };
const CHIP_CLASS = 'rounded-lg px-3 py-1.5 font-mono text-[11px]';
const CHIP_SELECTED = 'border-emerald-500 bg-emerald-500/15 text-emerald-600 dark:text-emerald-300';
const CHIP_IDLE = 'border-slate-200 bg-white text-slate-500 hover:bg-slate-100 dark:border-emerald-400/10 dark:bg-white/5 dark:text-slate-400 dark:hover:bg-white/10';
const EXTENSIONS: Record<RsaKeyFormat, string> = { pkcs8: 'pem', pkcs1: 'pem', jwk: 'json' };
const MIME: Record<RsaKeyFormat, string> = { pkcs8: 'application/x-pem-file', pkcs1: 'application/x-pem-file', jwk: 'application/json' };

const RsaKeyWorkbench: React.FC<ToolWorkbenchProps> = ({ tool, variant, lastRun }) => {
  const { t } = useTranslation();
  const initial = useMemo(() => {
    const saved = readSettings(lastRun, DEFAULT_SETTINGS);
    return RSA_KEY_SIZES.includes(saved.bits) ? saved : { ...saved, bits: DEFAULT_SETTINGS.bits };
  }, [lastRun]);
  const record = useVaultRecorder(tool.id, variant);
  const [settings, setSettings] = useState<RsaSettings>(initial);
  const [material, setMaterial] = useState<RsaKeyMaterial | null>(null);
  const [busy, setBusy] = useState(true);
  const [failed, setFailed] = useState(false);
  const [round, setRound] = useState(0);
  const encoding = material?.encodings[settings.format];

  useEffect(() => {
    let cancelled = false;
    setBusy(true);
    setFailed(false);
    generateRsaKeyPair(settings.bits)
      .then((value) => { if (!cancelled) setMaterial(value); })
      .catch(() => { if (!cancelled) setFailed(true); })
      .finally(() => { if (!cancelled) setBusy(false); });
    return () => { cancelled = true; };
  }, [settings.bits, round]);

  const recordUse = (): void => record({ ...settings }, { fingerprint: material?.fingerprintSsh ?? '' });

  const save = (kind: 'private' | 'public'): void => {
    if (!encoding) return;
    recordUse();
    const extension = EXTENSIONS[settings.format];
    downloadAsFile(kind === 'private' ? encoding.privateKey : encoding.publicKey, `rsa-${settings.bits}-${kind}.${extension}`, MIME[settings.format]);
  };

  const downloadButton = (kind: 'private' | 'public'): React.ReactNode => (
    <button type="button" disabled={!encoding} onClick={() => save(kind)}
      className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-emerald-400/20 bg-emerald-400/10 px-2 py-1.5 font-mono text-[11px] font-bold text-emerald-300 hover:bg-emerald-400/20 disabled:opacity-40">
      <Download className="h-3.5 w-3.5" aria-hidden />{t('uiTools.common.download')}
    </button>
  );

  return (
    <VaultPage>
      <div className="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <VaultPanel title={t('toolsCrypto.rsaKeyGenerator.options_title')} icon={KeyRound} className="space-y-4">
          <div>
            <FieldLabel>{t('toolsCrypto.rsaKeyGenerator.key_size')}</FieldLabel>
            <ChipGroup value={settings.bits} onChange={(bits) => setSettings((prev) => ({ ...prev, bits }))} label={t('toolsCrypto.rsaKeyGenerator.key_size')}
              options={RSA_KEY_SIZES.map((bits) => ({ value: bits, label: String(bits) }))}
              chipClassName={CHIP_CLASS} selectedClassName={CHIP_SELECTED} idleClassName={CHIP_IDLE} />
            {settings.bits < RSA_WEAK_SIZE && (
              <p className="mt-2 flex items-start gap-1.5 font-mono text-[11px] text-amber-600 dark:text-amber-400"><TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />{t('toolsCrypto.rsaKeyGenerator.weak_size')}</p>
            )}
          </div>
          <div>
            <FieldLabel>{t('toolsCrypto.rsaKeyGenerator.format')}</FieldLabel>
            <ModeTabs value={settings.format} onChange={(format) => setSettings((prev) => ({ ...prev, format }))} label={t('toolsCrypto.rsaKeyGenerator.format')} options={[
              { value: 'pkcs8', label: 'PKCS#8' },
              { value: 'pkcs1', label: 'PKCS#1' },
              { value: 'jwk', label: 'JWK' },
            ]} />
            <div className="mt-2"><Hint>{t(`toolsCrypto.rsaKeyGenerator.format_hint_${settings.format}`)}</Hint></div>
          </div>
          <button type="button" onClick={() => setRound((prev) => prev + 1)} disabled={busy} className={`${VAULT_BUTTON} w-full`}>
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <RefreshCw className="h-3.5 w-3.5" aria-hidden />}
            {t(busy ? 'toolsCrypto.rsaKeyGenerator.generating' : 'toolsCrypto.common.regenerate')}
          </button>
          <Hint>{t('toolsCrypto.rsaKeyGenerator.local_note')}</Hint>
          {failed && <Hint tone="error">{t('toolsCrypto.rsaKeyGenerator.failed')}</Hint>}
        </VaultPanel>

        <VaultPanel title={t('toolsCrypto.rsaKeyGenerator.fingerprints_title')} vault className="space-y-3">
          {material ? (
            <div className={`flex flex-col gap-2 transition-opacity ${busy ? 'opacity-40' : ''}`}>
              <FingerprintChip hex={material.fingerprintHex} label={t('toolsCrypto.rsaKeyGenerator.fingerprint_spki')} />
              <Readout label={t('toolsCrypto.rsaKeyGenerator.fingerprint_ssh')} value={material.fingerprintSsh} valueClassName="text-xs" />
            </div>
          ) : (
            <p className="flex items-center gap-2 font-mono text-xs text-emerald-500/60"><Loader2 className="h-4 w-4 animate-spin" aria-hidden />{t('toolsCrypto.rsaKeyGenerator.generating')}</p>
          )}
        </VaultPanel>
      </div>

      <div className={`grid gap-4 transition-opacity md:grid-cols-2 ${busy && material ? 'opacity-50' : ''}`}>
        <VaultPanel title={t('toolsCrypto.rsaKeyGenerator.private_title')} vault actions={downloadButton('private')}>
          <Readout label={t('toolsCrypto.rsaKeyGenerator.private_label')} value={encoding?.privateKey ?? ''} masked onCopied={recordUse} valueClassName="whitespace-pre-wrap text-[11px]" emptyText={t('toolsCrypto.rsaKeyGenerator.generating')} />
          <p className="mt-2 flex items-center gap-1.5 font-mono text-[10px] text-amber-400/80"><TriangleAlert className="h-3 w-3 shrink-0" aria-hidden />{t('toolsCrypto.rsaKeyGenerator.private_warning')}</p>
        </VaultPanel>
        <VaultPanel title={t('toolsCrypto.rsaKeyGenerator.public_title')} vault actions={downloadButton('public')} className="space-y-3">
          <Readout label={t('toolsCrypto.rsaKeyGenerator.public_label')} value={encoding?.publicKey ?? ''} onCopied={recordUse} valueClassName="whitespace-pre-wrap text-[11px]" emptyText={t('toolsCrypto.rsaKeyGenerator.generating')} />
          <Readout label="OpenSSH" value={material?.openssh ?? ''} valueClassName="text-[11px]" emptyText={t('toolsCrypto.rsaKeyGenerator.generating')} />
        </VaultPanel>
      </div>
    </VaultPage>
  );
};

export default RsaKeyWorkbench;
