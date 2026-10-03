/** Instant identifier generator: UUID v1/v3/v4/v5/v7, ULID and nil in batches, plus an identifier inspector. */
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshCw, ScanSearch } from 'lucide-react';
import { ChipGroup } from '@/shared/ui/ChipGroup';
import type { ToolWorkbenchProps } from '../toolWorkbenchTypes';
import { generateIdentifiers, inspectIdentifier, parseUuidBytes, UUID_NAMESPACES, type UuidVersion } from './lib/uuidLib';
import { BatchList, FieldLabel, Hint, ToggleRow, VAULT_BUTTON, VAULT_FIELD, VaultPage, VaultPanel, VaultRange, VaultSelect, readSettings, useVaultRecorder } from './cryptoKit';

type NamespaceChoice = keyof typeof UUID_NAMESPACES | 'custom';

interface UuidSettings {
  version: UuidVersion;
  count: number;
  uppercase: boolean;
  hyphens: boolean;
  braces: boolean;
}

const DEFAULT_SETTINGS: UuidSettings = { version: 'v4', count: 5, uppercase: false, hyphens: true, braces: false };
const VERSIONS: readonly UuidVersion[] = ['v4', 'v7', 'v1', 'v5', 'v3', 'ulid', 'nil'];
const NAMED_VERSIONS: readonly UuidVersion[] = ['v3', 'v5'];
const SINGLE_VERSIONS: readonly UuidVersion[] = ['v3', 'v5', 'nil'];
const MAX_COUNT = 100;
const CHIP_CLASS = 'rounded-lg px-3 py-1.5 font-mono text-[11px]';
const CHIP_SELECTED = 'border-emerald-500 bg-emerald-500/15 text-emerald-600 dark:text-emerald-300';
const CHIP_IDLE = 'border-slate-200 bg-white text-slate-500 hover:bg-slate-100 dark:border-emerald-400/10 dark:bg-white/5 dark:text-slate-400 dark:hover:bg-white/10';

const UuidGeneratorWorkbench: React.FC<ToolWorkbenchProps> = ({ tool, variant, lastRun }) => {
  const { t } = useTranslation();
  const initial = useMemo(() => {
    const saved = readSettings(lastRun, DEFAULT_SETTINGS);
    return variant === 'ulidGenerator' ? { ...saved, version: 'ulid' as UuidVersion } : saved;
  }, [lastRun, variant]);
  const record = useVaultRecorder(tool.id, variant);
  const [settings, setSettings] = useState<UuidSettings>(initial);
  const [namespace, setNamespace] = useState<NamespaceChoice>('dns');
  const [customNamespace, setCustomNamespace] = useState('');
  const [name, setName] = useState('example.com');
  const [items, setItems] = useState<string[]>([]);
  const [round, setRound] = useState(0);
  const [probe, setProbe] = useState('');
  const named = NAMED_VERSIONS.includes(settings.version);
  const namespaceBytes = useMemo(() => parseUuidBytes(namespace === 'custom' ? customNamespace : UUID_NAMESPACES[namespace]), [namespace, customNamespace]);
  const namespaceInvalid = named && namespace === 'custom' && customNamespace !== '' && !namespaceBytes;
  const inspection = useMemo(() => (probe.trim() ? inspectIdentifier(probe) : null), [probe]);

  const patch = (next: Partial<UuidSettings>): void => setSettings((prev) => ({ ...prev, ...next }));

  useEffect(() => {
    let cancelled = false;
    if (named && !namespaceBytes) {
      setItems([]);
      return undefined;
    }
    generateIdentifiers({
      version: settings.version, count: settings.count, format: settings, namespace: namespaceBytes ?? undefined, name,
    }).then((value) => { if (!cancelled) setItems(value); });
    return () => { cancelled = true; };
  }, [settings, namespaceBytes, name, named, round]);

  const recordUse = (): void => record({ ...settings }, { count: items.length });
  const versionLabel = (version: UuidVersion): string => (version === 'ulid' ? 'ULID' : version === 'nil' ? 'NIL' : version);

  return (
    <VaultPage>
      <VaultPanel title={t('toolsCrypto.uuidGenerator.kind_title')}>
        <ChipGroup value={settings.version} onChange={(version) => patch({ version })} label={t('toolsCrypto.uuidGenerator.kind_title')}
          options={VERSIONS.map((version) => ({ value: version, label: versionLabel(version) }))}
          chipClassName={CHIP_CLASS} selectedClassName={CHIP_SELECTED} idleClassName={CHIP_IDLE} />
        <div className="mt-3"><Hint>{t(`toolsCrypto.uuidGenerator.kind_hint.${settings.version}`)}</Hint></div>
      </VaultPanel>

      <div className="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <VaultPanel title={t('toolsCrypto.uuidGenerator.options_title')} className="space-y-3">
          {!SINGLE_VERSIONS.includes(settings.version) && (
            <VaultRange label={t('toolsCrypto.uuidGenerator.count')} value={settings.count} min={1} max={MAX_COUNT} onChange={(count) => patch({ count })} />
          )}
          {named && (
            <div className="space-y-3">
              <VaultSelect value={namespace} onChange={setNamespace} label={t('toolsCrypto.uuidGenerator.namespace')} options={[
                { value: 'dns', label: t('toolsCrypto.uuidGenerator.ns_dns') },
                { value: 'url', label: t('toolsCrypto.uuidGenerator.ns_url') },
                { value: 'oid', label: t('toolsCrypto.uuidGenerator.ns_oid') },
                { value: 'x500', label: t('toolsCrypto.uuidGenerator.ns_x500') },
                { value: 'custom', label: t('toolsCrypto.uuidGenerator.ns_custom') },
              ]} />
              {namespace === 'custom' && (
                <div>
                  <FieldLabel htmlFor="uuid-ns">{t('toolsCrypto.uuidGenerator.ns_value')}</FieldLabel>
                  <input id="uuid-ns" value={customNamespace} onChange={(event) => setCustomNamespace(event.target.value)} spellCheck={false}
                    placeholder="00000000-0000-0000-0000-000000000000" className={VAULT_FIELD} />
                  {namespaceInvalid && <Hint tone="error">{t('toolsCrypto.uuidGenerator.ns_invalid')}</Hint>}
                </div>
              )}
              <div>
                <FieldLabel htmlFor="uuid-name">{t('toolsCrypto.uuidGenerator.name')}</FieldLabel>
                <input id="uuid-name" value={name} onChange={(event) => setName(event.target.value)} spellCheck={false} className={VAULT_FIELD} />
              </div>
            </div>
          )}
          {settings.version !== 'ulid' && (
            <div className="divide-y divide-slate-100 dark:divide-white/5">
              <ToggleRow label={t('toolsCrypto.uuidGenerator.uppercase')} on={settings.uppercase} onChange={(uppercase) => patch({ uppercase })} />
              <ToggleRow label={t('toolsCrypto.uuidGenerator.hyphens')} on={settings.hyphens} onChange={(hyphens) => patch({ hyphens })} />
              <ToggleRow label={t('toolsCrypto.uuidGenerator.braces')} on={settings.braces} onChange={(braces) => patch({ braces })} />
            </div>
          )}
          <button type="button" onClick={() => setRound((prev) => prev + 1)} className={`${VAULT_BUTTON} w-full`} disabled={SINGLE_VERSIONS.includes(settings.version)}>
            <RefreshCw className="h-3.5 w-3.5" aria-hidden />{t('toolsCrypto.common.regenerate')}
          </button>
        </VaultPanel>

        <VaultPanel title={t('toolsCrypto.uuidGenerator.output_title')} vault>
          <BatchList items={items} filename={`${settings.version}-ids.txt`} onCopied={recordUse} onDownloaded={recordUse} />
        </VaultPanel>
      </div>

      <VaultPanel title={t('toolsCrypto.uuidGenerator.inspect_title')} icon={ScanSearch}>
        <FieldLabel htmlFor="uuid-probe">{t('toolsCrypto.uuidGenerator.inspect_label')}</FieldLabel>
        <input id="uuid-probe" value={probe} onChange={(event) => setProbe(event.target.value)} spellCheck={false} autoComplete="off"
          placeholder={t('toolsCrypto.uuidGenerator.inspect_placeholder')} className={VAULT_FIELD} />
        {probe.trim() && !inspection && <div className="mt-2"><Hint tone="error">{t('toolsCrypto.uuidGenerator.inspect_invalid')}</Hint></div>}
        {inspection && (
          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 rounded-xl border border-emerald-500/20 bg-slate-950 p-3 font-mono text-xs">
            <dt className="text-emerald-500/70">{t('toolsCrypto.uuidGenerator.inspect_kind')}</dt>
            <dd className="text-emerald-200">{inspection.kind === 'ulid' ? 'ULID' : 'UUID'}</dd>
            {inspection.kind === 'uuid' && (
              <>
                <dt className="text-emerald-500/70">{t('toolsCrypto.uuidGenerator.inspect_version')}</dt>
                <dd className="text-emerald-200">{inspection.version === 0 ? 'NIL' : `v${inspection.version}`}</dd>
                <dt className="text-emerald-500/70">{t('toolsCrypto.uuidGenerator.inspect_variant')}</dt>
                <dd className="text-emerald-200">{inspection.variant}</dd>
              </>
            )}
            <dt className="text-emerald-500/70">{t('toolsCrypto.uuidGenerator.inspect_canonical')}</dt>
            <dd className="break-all text-emerald-200">{inspection.normalized}</dd>
            {inspection.timestamp && (
              <>
                <dt className="text-emerald-500/70">{t('toolsCrypto.uuidGenerator.inspect_time')}</dt>
                <dd className="break-all text-emerald-200">{inspection.timestamp.toISOString()}<span className="block text-emerald-500/60">{inspection.timestamp.toLocaleString()}</span></dd>
              </>
            )}
          </dl>
        )}
      </VaultPanel>
    </VaultPage>
  );
};

export default UuidGeneratorWorkbench;
