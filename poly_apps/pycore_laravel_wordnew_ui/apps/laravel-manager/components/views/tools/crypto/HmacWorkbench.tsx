/** Live HMAC signer: masked secret with utf-8 / hex / base64 key decoding, any digest, and an expected-MAC check. */
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, KeyRound, XCircle } from 'lucide-react';
import { ChipGroup } from '@/shared/ui/ChipGroup';
import type { ToolWorkbenchProps } from '../toolWorkbenchTypes';
import { DIGEST_ALGORITHMS, fromBase64, fromHex, hmac, toBase64, toHex, utf8Encode, type HmacAlgorithm } from './lib/cryptoCore';
import { FieldLabel, Hint, ModeTabs, Readout, SecretInput, VAULT_FIELD, VaultPage, VaultPanel, readSettings, useVaultRecorder } from './cryptoKit';

type KeyEncoding = 'utf8' | 'hex' | 'base64';
type MacFormat = 'hex' | 'base64';

interface HmacSettings {
  algorithm: HmacAlgorithm;
  keyEncoding: KeyEncoding;
  format: MacFormat;
}

const DEFAULT_SETTINGS: HmacSettings = { algorithm: 'SHA-256', keyEncoding: 'utf8', format: 'hex' };
const CHIP_CLASS = 'rounded-lg px-3 py-1.5 font-mono text-[11px]';
const CHIP_SELECTED = 'border-emerald-500 bg-emerald-500/15 text-emerald-600 dark:text-emerald-300';
const CHIP_IDLE = 'border-slate-200 bg-white text-slate-500 hover:bg-slate-100 dark:border-emerald-400/10 dark:bg-white/5 dark:text-slate-400 dark:hover:bg-white/10';

const decodeKey = (secret: string, encoding: KeyEncoding): Uint8Array | null => {
  if (encoding === 'hex') return fromHex(secret);
  if (encoding === 'base64') return fromBase64(secret);
  return utf8Encode(secret);
};

const HmacWorkbench: React.FC<ToolWorkbenchProps> = ({ tool, variant, lastRun }) => {
  const { t } = useTranslation();
  const initial = useMemo(() => readSettings(lastRun, DEFAULT_SETTINGS), [lastRun]);
  const record = useVaultRecorder(tool.id, variant);
  const [settings, setSettings] = useState<HmacSettings>(initial);
  const [message, setMessage] = useState('');
  const [secret, setSecret] = useState('');
  const [expected, setExpected] = useState('');
  const [mac, setMac] = useState<Uint8Array | null>(null);
  const key = useMemo(() => (secret ? decodeKey(secret, settings.keyEncoding) : null), [secret, settings.keyEncoding]);
  const keyInvalid = secret !== '' && key === null;
  const value = mac ? (settings.format === 'hex' ? toHex(mac) : toBase64(mac)) : '';
  const target = expected.trim().replace(/\s/g, '');
  const verified = mac !== null && target !== '' && (target.toLowerCase() === toHex(mac) || target === toBase64(mac));

  useEffect(() => {
    let cancelled = false;
    if (!key) {
      setMac(null);
      return undefined;
    }
    hmac(settings.algorithm, key, utf8Encode(message)).then((bytes) => { if (!cancelled) setMac(bytes); }).catch(() => { if (!cancelled) setMac(null); });
    return () => { cancelled = true; };
  }, [key, message, settings.algorithm]);

  const patch = (next: Partial<HmacSettings>): void => setSettings((prev) => ({ ...prev, ...next }));

  return (
    <VaultPage>
      <div className="grid gap-4 md:grid-cols-2">
        <VaultPanel title={t('toolsCrypto.hmacGenerator.message_title')}>
          <FieldLabel htmlFor="hmac-message">{t('toolsCrypto.hmacGenerator.message')}</FieldLabel>
          <textarea id="hmac-message" value={message} rows={8} onChange={(event) => setMessage(event.target.value)} spellCheck={false}
            placeholder={t('toolsCrypto.hmacGenerator.message_placeholder')} className={`${VAULT_FIELD} resize-y`} />
        </VaultPanel>

        <VaultPanel title={t('toolsCrypto.hmacGenerator.key_title')} icon={KeyRound} className="space-y-4">
          <SecretInput id="hmac-secret" value={secret} onChange={setSecret} label={t('toolsCrypto.hmacGenerator.secret')} placeholder={t('toolsCrypto.hmacGenerator.secret_placeholder')} />
          <div>
            <FieldLabel>{t('toolsCrypto.hmacGenerator.key_encoding')}</FieldLabel>
            <ModeTabs value={settings.keyEncoding} onChange={(keyEncoding) => patch({ keyEncoding })} label={t('toolsCrypto.hmacGenerator.key_encoding')} options={[
              { value: 'utf8', label: 'utf-8' },
              { value: 'hex', label: 'hex' },
              { value: 'base64', label: 'base64' },
            ]} />
            {keyInvalid && <div className="mt-2"><Hint tone="error">{t(`toolsCrypto.hmacGenerator.key_invalid_${settings.keyEncoding === 'hex' ? 'hex' : 'base64'}`)}</Hint></div>}
          </div>
          <div>
            <FieldLabel>{t('toolsCrypto.hmacGenerator.algorithm')}</FieldLabel>
            <ChipGroup value={settings.algorithm} onChange={(algorithm) => patch({ algorithm })} label={t('toolsCrypto.hmacGenerator.algorithm')}
              options={DIGEST_ALGORITHMS.map((algorithm) => ({ value: algorithm, label: `HMAC-${algorithm}` }))}
              chipClassName={CHIP_CLASS} selectedClassName={CHIP_SELECTED} idleClassName={CHIP_IDLE} />
            {settings.algorithm === 'MD5' && <div className="mt-2"><Hint tone="warn">{t('toolsCrypto.hmacGenerator.legacy_warning')}</Hint></div>}
          </div>
        </VaultPanel>
      </div>

      <VaultPanel title={t('toolsCrypto.hmacGenerator.result_title')} vault actions={
        <ModeTabs value={settings.format} onChange={(format) => patch({ format })} label={t('toolsCrypto.hmacGenerator.output_format')} options={[
          { value: 'hex', label: 'hex' },
          { value: 'base64', label: 'base64' },
        ]} />
      }>
        <Readout label={`HMAC-${settings.algorithm}`} value={value} emptyText={t('toolsCrypto.hmacGenerator.waiting_for_key')}
          onCopied={() => record({ ...settings }, { messageChars: message.length })} />
        <p className="mt-2 font-mono text-[10px] text-emerald-500/60">{mac ? t('toolsCrypto.hmacGenerator.mac_size', { bits: mac.length * 8 }) : t('toolsCrypto.hmacGenerator.key_required')}</p>
      </VaultPanel>

      <VaultPanel title={t('toolsCrypto.hmacGenerator.verify_title')}>
        <FieldLabel htmlFor="hmac-expected">{t('toolsCrypto.hmacGenerator.verify_label')}</FieldLabel>
        <input id="hmac-expected" value={expected} onChange={(event) => setExpected(event.target.value)} spellCheck={false} autoComplete="off"
          placeholder={t('toolsCrypto.hmacGenerator.verify_placeholder')} className={VAULT_FIELD} />
        {target && mac && (
          <p className={`mt-2 flex items-center gap-1.5 font-mono text-xs font-bold ${verified ? 'text-emerald-500' : 'text-rose-500'}`}>
            {verified ? <CheckCircle2 className="h-4 w-4" aria-hidden /> : <XCircle className="h-4 w-4" aria-hidden />}
            {t(verified ? 'toolsCrypto.hmacGenerator.verify_match' : 'toolsCrypto.hmacGenerator.verify_mismatch')}
          </p>
        )}
      </VaultPanel>
    </VaultPage>
  );
};

export default HmacWorkbench;
