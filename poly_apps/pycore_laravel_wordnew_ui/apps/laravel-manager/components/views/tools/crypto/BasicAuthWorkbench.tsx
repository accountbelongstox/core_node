/** HTTP Basic credentials: live Authorization header with copy-ready curl / fetch snippets, and a header decoder. */
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { fromBase64, toBase64, utf8Decode, utf8Encode } from './lib/cryptoCore';
import type { ToolWorkbenchProps } from '../toolWorkbenchTypes';
import { FieldLabel, Hint, ModeTabs, Readout, SecretInput, VAULT_FIELD, VaultPage, VaultPanel, readSettings, useVaultRecorder } from './cryptoKit';

type AuthMode = 'encode' | 'decode';

interface BasicAuthSettings {
  mode: AuthMode;
}

const DEFAULT_SETTINGS: BasicAuthSettings = { mode: 'encode' };
const SCHEME = /^(?:authorization:\s*)?basic\s+/i;

const decodeCredentials = (input: string): { username: string; password: string } | null => {
  const raw = input.trim().replace(SCHEME, '');
  const bytes = raw ? fromBase64(raw) : null;
  if (!bytes) return null;
  const text = utf8Decode(bytes);
  const split = text.indexOf(':');
  return split < 0 ? null : { username: text.slice(0, split), password: text.slice(split + 1) };
};

const shellQuote = (value: string): string => `'${value.replace(/'/g, `'\\''`)}'`;

const BasicAuthWorkbench: React.FC<ToolWorkbenchProps> = ({ tool, variant, lastRun }) => {
  const { t } = useTranslation();
  const initial = useMemo(() => readSettings(lastRun, DEFAULT_SETTINGS), [lastRun]);
  const record = useVaultRecorder(tool.id, variant);
  const [mode, setMode] = useState<AuthMode>(initial.mode);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [header, setHeader] = useState('');
  const [url, setUrl] = useState('https://api.example.com/v1/resource');
  const encoded = useMemo(() => (username || password ? toBase64(utf8Encode(`${username}:${password}`)) : ''), [username, password]);
  const decoded = useMemo(() => (header.trim() ? decodeCredentials(header) : null), [header]);
  const recordUse = (): void => record({ mode });
  const snippets = useMemo(() => ({
    header: encoded ? `Authorization: Basic ${encoded}` : '',
    curl: encoded ? `curl -H ${shellQuote(`Authorization: Basic ${encoded}`)} ${shellQuote(url)}` : '',
    fetch: encoded ? `fetch(${JSON.stringify(url)}, {\n  headers: { Authorization: 'Basic ${encoded}' },\n})` : '',
  }), [encoded, url]);

  return (
    <VaultPage>
      <ModeTabs value={mode} onChange={setMode} label={t('toolsCrypto.basicAuthGenerator.mode')} options={[
        { value: 'encode', label: t('toolsCrypto.basicAuthGenerator.mode_encode') },
        { value: 'decode', label: t('toolsCrypto.basicAuthGenerator.mode_decode') },
      ]} />

      {mode === 'encode' ? (
        <div className="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <VaultPanel title={t('toolsCrypto.basicAuthGenerator.credentials_title')} className="space-y-4">
            <div>
              <FieldLabel htmlFor="basic-user">{t('toolsCrypto.basicAuthGenerator.username')}</FieldLabel>
              <input id="basic-user" value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="off" spellCheck={false} className={VAULT_FIELD} />
              {username.includes(':') && <div className="mt-1.5"><Hint tone="warn">{t('toolsCrypto.basicAuthGenerator.colon_warning')}</Hint></div>}
            </div>
            <SecretInput id="basic-pass" value={password} onChange={setPassword} label={t('toolsCrypto.basicAuthGenerator.password')} />
            <div>
              <FieldLabel htmlFor="basic-url">{t('toolsCrypto.basicAuthGenerator.url')}</FieldLabel>
              <input id="basic-url" value={url} onChange={(event) => setUrl(event.target.value)} autoComplete="off" spellCheck={false} className={VAULT_FIELD} />
            </div>
            <Hint>{t('toolsCrypto.basicAuthGenerator.security_note')}</Hint>
          </VaultPanel>

          <VaultPanel title={t('toolsCrypto.basicAuthGenerator.output_title')} vault className="space-y-3">
            <Readout label={t('toolsCrypto.basicAuthGenerator.header')} value={snippets.header} masked onCopied={recordUse} emptyText={t('toolsCrypto.basicAuthGenerator.waiting')} valueClassName="text-xs" />
            <Readout label={t('toolsCrypto.basicAuthGenerator.value_only')} value={encoded} masked onCopied={recordUse} valueClassName="text-xs" />
            <Readout label="curl" value={snippets.curl} masked onCopied={recordUse} valueClassName="text-xs" />
            <Readout label="fetch" value={snippets.fetch} masked onCopied={recordUse} valueClassName="whitespace-pre-wrap text-xs" />
          </VaultPanel>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <VaultPanel title={t('toolsCrypto.basicAuthGenerator.decode_title')}>
            <FieldLabel htmlFor="basic-header">{t('toolsCrypto.basicAuthGenerator.header')}</FieldLabel>
            <textarea id="basic-header" rows={5} value={header} onChange={(event) => setHeader(event.target.value)} spellCheck={false}
              placeholder={t('toolsCrypto.basicAuthGenerator.decode_placeholder')} className={`${VAULT_FIELD} resize-y`} />
            {header.trim() && !decoded && <div className="mt-2"><Hint tone="error">{t('toolsCrypto.basicAuthGenerator.decode_invalid')}</Hint></div>}
          </VaultPanel>
          <VaultPanel title={t('toolsCrypto.basicAuthGenerator.decoded_title')} vault className="space-y-3">
            <Readout label={t('toolsCrypto.basicAuthGenerator.username')} value={decoded?.username ?? ''} onCopied={recordUse} />
            <Readout label={t('toolsCrypto.basicAuthGenerator.password')} value={decoded?.password ?? ''} masked onCopied={recordUse} />
          </VaultPanel>
        </div>
      )}
    </VaultPage>
  );
};

export default BasicAuthWorkbench;
