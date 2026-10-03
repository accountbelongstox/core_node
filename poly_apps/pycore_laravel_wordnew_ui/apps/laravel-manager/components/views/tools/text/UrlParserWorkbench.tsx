/** URL parser: color-coded anatomy plus an editable component table whose rows rebuild the URL live. */
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2 } from 'lucide-react';
import type { ToolWorkbenchProps } from '../toolWorkbenchTypes';
import { CopyButton, Desk, FieldLabel, Notice, Paper, PaperInput, SoftButton, ToggleChip, prefillString, useToolRecord } from './textKit';
import { COMMON_PROTOCOLS, buildUrl, nextParamId, parseUrlParts, urlSegments, type QueryParam, type UrlParts, type UrlSegmentKind } from './logic/urlLogic';

const SAMPLE_URL = 'https://user:secret@example.com:8080/docs/getting-started?lang=en&q=hello%20world#install';
const SEGMENT_TONE: Record<UrlSegmentKind, string> = {
  protocol: 'text-violet-600 dark:text-violet-300',
  auth: 'text-amber-600 dark:text-amber-300',
  host: 'text-sky-600 dark:text-sky-300',
  port: 'text-teal-600 dark:text-teal-300',
  path: 'text-emerald-600 dark:text-emerald-300',
  query: 'text-fuchsia-600 dark:text-fuchsia-300',
  hash: 'text-rose-600 dark:text-rose-300',
};
const SEGMENT_DOT: Record<UrlSegmentKind, string> = {
  protocol: 'bg-violet-500', auth: 'bg-amber-500', host: 'bg-sky-500', port: 'bg-teal-500', path: 'bg-emerald-500', query: 'bg-fuchsia-500', hash: 'bg-rose-500',
};
const SEGMENT_KINDS = Object.keys(SEGMENT_TONE) as UrlSegmentKind[];

const UrlParserWorkbench: React.FC<ToolWorkbenchProps> = ({ tool, variant, lastRun }) => {
  const { t } = useTranslation();
  const record = useToolRecord(tool.id, variant);
  const [urlText, setUrlText] = useState(() => prefillString(lastRun, 'url', SAMPLE_URL));
  const [parts, setParts] = useState<UrlParts | null>(() => parseUrlParts(urlText));
  const [invalid, setInvalid] = useState(false);

  const segments = useMemo(() => urlSegments(urlText), [urlText]);
  const resolved = useMemo(() => {
    try {
      return new URL(urlText.trim());
    } catch {
      return null;
    }
  }, [urlText]);

  const onUrlInput = (value: string): void => {
    setUrlText(value);
    const next = parseUrlParts(value);
    if (next) setParts(next);
    setInvalid(!next);
  };
  const update = (patch: Partial<UrlParts>): void => {
    if (!parts) return;
    const next = { ...parts, ...patch };
    setParts(next);
    setUrlText(buildUrl(next));
    setInvalid(false);
  };
  const updateParam = (id: number, patch: Partial<QueryParam>): void => {
    if (parts) update({ params: parts.params.map((param) => (param.id === id ? { ...param, ...patch } : param)) });
  };
  const copied = (): void => record({ url: urlText }, parts);

  const protocols = parts && !(COMMON_PROTOCOLS as readonly string[]).includes(parts.protocol) ? [...COMMON_PROTOCOLS, parts.protocol] : COMMON_PROTOCOLS;
  const pathSegments = parts ? parts.pathname.split('/').filter(Boolean) : [];

  return (
    <Desk wide>
      <Paper title={t('toolsText.url.address')} actions={<CopyButton text={urlText} onCopied={copied} />}>
        <PaperInput value={urlText} onChange={onUrlInput} invalid={invalid} ariaLabel={t('toolsText.url.address')} placeholder="https://example.com/path?x=1" inputMode="url" className="py-3 text-base" />
        {invalid ? (
          <Notice tone="error" className="mt-3">{t('toolsText.url.invalid')}</Notice>
        ) : (
          <>
            <p className="mt-4 break-all rounded-xl bg-stone-50 px-3 py-3 font-mono text-sm leading-7 dark:bg-slate-950/40" aria-label={t('toolsText.url.anatomy')}>
              {segments.map((segment, index) => (
                <span key={index} title={t(`toolsText.url.kind_${segment.kind}`)} className={`border-b-2 border-current ${SEGMENT_TONE[segment.kind]}`}>{segment.text}</span>
              ))}
            </p>
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
              {SEGMENT_KINDS.filter((kind) => segments.some((segment) => segment.kind === kind)).map((kind) => (
                <span key={kind} className="inline-flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                  <span className={`h-2 w-2 rounded-full ${SEGMENT_DOT[kind]}`} />{t(`toolsText.url.kind_${kind}`)}
                </span>
              ))}
            </div>
          </>
        )}
      </Paper>

      {parts && (
        <div className="grid gap-4 lg:grid-cols-5">
          <Paper title={t('toolsText.url.components')} className="lg:col-span-3">
            <div className="space-y-3">
              <div>
                <FieldLabel>{t('toolsText.url.protocol')}</FieldLabel>
                <div className="flex flex-wrap gap-1.5">
                  {protocols.map((protocol) => <ToggleChip key={protocol} mono active={parts.protocol === protocol} onClick={() => update({ protocol })}>{protocol}</ToggleChip>)}
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <FieldLabel>{t('toolsText.url.username')}</FieldLabel>
                  <PaperInput value={parts.username} onChange={(username) => update({ username })} ariaLabel={t('toolsText.url.username')} />
                </div>
                <div>
                  <FieldLabel>{t('toolsText.url.password')}</FieldLabel>
                  <PaperInput value={parts.password} onChange={(password) => update({ password })} ariaLabel={t('toolsText.url.password')} />
                </div>
                <div>
                  <FieldLabel>{t('toolsText.url.hostname')}</FieldLabel>
                  <PaperInput value={parts.hostname} onChange={(hostname) => update({ hostname })} ariaLabel={t('toolsText.url.hostname')} />
                </div>
                <div>
                  <FieldLabel hint={resolved?.port === '' ? t('toolsText.url.port_default') : undefined}>{t('toolsText.url.port')}</FieldLabel>
                  <PaperInput value={parts.port} onChange={(port) => update({ port: port.replace(/\D/g, '').slice(0, 5) })} inputMode="numeric" ariaLabel={t('toolsText.url.port')} />
                </div>
              </div>
              <div>
                <FieldLabel>{t('toolsText.url.pathname')}</FieldLabel>
                <PaperInput value={parts.pathname} onChange={(pathname) => update({ pathname })} ariaLabel={t('toolsText.url.pathname')} />
                {pathSegments.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {pathSegments.map((segment, index) => <span key={index} className="rounded-md bg-emerald-50 px-1.5 py-0.5 font-mono text-[11px] text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">/{segment}</span>)}
                  </div>
                )}
              </div>
              <div>
                <FieldLabel>{t('toolsText.url.hash')}</FieldLabel>
                <PaperInput value={parts.hash} onChange={(hash) => update({ hash })} ariaLabel={t('toolsText.url.hash')} placeholder="section" />
              </div>
            </div>
          </Paper>

          <div className="space-y-4 lg:col-span-2">
            <Paper
              title={t('toolsText.url.query')}
              actions={<SoftButton icon={<Plus className="h-3.5 w-3.5" />} onClick={() => update({ params: [...parts.params, { id: nextParamId(), key: '', value: '' }] })}>{t('toolsText.url.add_param')}</SoftButton>}
            >
              {parts.params.length === 0 ? (
                <p className="py-4 text-center text-sm text-slate-400">{t('toolsText.url.no_params')}</p>
              ) : (
                <ul className="space-y-2">
                  {parts.params.map((param) => (
                    <li key={param.id} className="flex items-center gap-1.5">
                      <PaperInput value={param.key} onChange={(key) => updateParam(param.id, { key })} ariaLabel={t('toolsText.url.param_key')} placeholder={t('toolsText.url.param_key')} className="basis-2/5" />
                      <PaperInput value={param.value} onChange={(value) => updateParam(param.id, { value })} ariaLabel={t('toolsText.url.param_value')} placeholder={t('toolsText.url.param_value')} />
                      <button
                        type="button"
                        aria-label={t('toolsText.url.remove_param')}
                        title={t('toolsText.url.remove_param')}
                        onClick={() => update({ params: parts.params.filter((entry) => entry.id !== param.id) })}
                        className="shrink-0 cursor-pointer rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Paper>

            {resolved && (
              <Paper title={t('toolsText.url.derived')}>
                <dl className="space-y-2 text-xs">
                  {([['origin', resolved.origin], ['host', resolved.host], ['search', resolved.search], ['href', resolved.href]] as const).map(([key, value]) => (
                    <div key={key} className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{t(`toolsText.url.derived_${key}`)}</dt>
                        <dd className="break-all font-mono text-slate-700 dark:text-slate-200">{value || '-'}</dd>
                      </div>
                      <CopyButton text={value} iconOnly />
                    </div>
                  ))}
                </dl>
              </Paper>
            )}
          </div>
        </div>
      )}
    </Desk>
  );
};

export default UrlParserWorkbench;
