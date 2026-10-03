/** QR code generator: typed content forms, live browser-side encoding, styling and PNG / SVG export. */
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AtSign, Link2, MessageSquare, Phone, Type, Wand2 } from 'lucide-react';
import type { ToolWorkbenchProps } from '../toolWorkbenchTypes';
import { Btn, Field, Pane, WEB_INPUT_CLASS, WebPage, lastInput, pickOption, pickString, useDebounced, useToolRecord, utf8Length } from './kit/webKit';
import { QrStudio, restoreQrSettings, type QrSettings } from './kit/QrStudio';

type ContentType = 'text' | 'url' | 'email' | 'phone' | 'sms';

const TYPES: Array<{ value: ContentType; icon: typeof Type }> = [
  { value: 'text', icon: Type },
  { value: 'url', icon: Link2 },
  { value: 'email', icon: AtSign },
  { value: 'phone', icon: Phone },
  { value: 'sms', icon: MessageSquare },
];
const TYPE_VALUES: readonly ContentType[] = TYPES.map((entry) => entry.value);
const DEBOUNCE_MS = 150;
const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:/i;

interface Fields {
  text: string;
  url: string;
  address: string;
  subject: string;
  body: string;
  phone: string;
  smsNumber: string;
  smsBody: string;
}

const buildPayload = (type: ContentType, f: Fields): string => {
  switch (type) {
    case 'url': return f.url.trim();
    case 'email': {
      if (!f.address.trim()) return '';
      const params = [f.subject.trim() && `subject=${encodeURIComponent(f.subject.trim())}`, f.body.trim() && `body=${encodeURIComponent(f.body.trim())}`].filter(Boolean).join('&');
      return `mailto:${f.address.trim()}${params ? `?${params}` : ''}`;
    }
    case 'phone': return f.phone.trim() ? `tel:${f.phone.trim().replace(/\s+/g, '')}` : '';
    case 'sms': return f.smsNumber.trim() ? `SMSTO:${f.smsNumber.trim().replace(/\s+/g, '')}:${f.smsBody}` : '';
    default: return f.text;
  }
};

const QrCodeGeneratorWorkbench: React.FC<ToolWorkbenchProps> = ({ tool, variant, lastRun }) => {
  const { t } = useTranslation();
  const record = useToolRecord(tool.id, variant);
  const prefill = lastInput(lastRun);
  const [type, setType] = useState<ContentType>(pickOption<ContentType>(prefill, 'type', TYPE_VALUES, 'text'));
  const [fields, setFields] = useState<Fields>({
    text: pickString(prefill, 'text', ''), url: pickString(prefill, 'url', ''), address: pickString(prefill, 'address', ''), subject: pickString(prefill, 'subject', ''),
    body: pickString(prefill, 'body', ''), phone: pickString(prefill, 'phone', ''), smsNumber: pickString(prefill, 'smsNumber', ''), smsBody: pickString(prefill, 'smsBody', ''),
  });
  const [settings, setSettings] = useState<QrSettings>(() => restoreQrSettings(prefill));
  const set = (key: keyof Fields, value: string) => setFields((prev) => ({ ...prev, [key]: value }));
  const payload = useDebounced(useMemo(() => buildPayload(type, fields), [type, fields]), DEBOUNCE_MS);
  const urlNeedsScheme = type === 'url' && !!fields.url.trim() && !HAS_SCHEME.test(fields.url.trim());

  const input = (key: keyof Fields, label: string, placeholder: string, inputType = 'text') => (
    <Field label={label}><input type={inputType} value={fields[key]} onChange={(event) => set(key, event.target.value)} placeholder={placeholder} spellCheck={false} className={WEB_INPUT_CLASS} /></Field>
  );

  return (
    <WebPage>
      <div className="grid gap-3 xl:grid-cols-[minmax(0,24rem)_1fr]">
        <Pane
          title={t('toolsWeb.qr.content')}
          bodyClassName="space-y-3 p-3"
          actions={<Btn icon={Wand2} onClick={() => { setType('url'); set('url', 'https://example.com'); }}>{t('toolsWeb.common.sample')}</Btn>}
          footer={payload ? t('toolsWeb.qr.payload_bytes', { count: utf8Length(payload) }) : undefined}
        >
          <div className="grid grid-cols-5 gap-1" role="tablist" aria-label={t('toolsWeb.qr.content_type')}>
            {TYPES.map(({ value, icon: Icon }) => (
              <button key={value} type="button" role="tab" aria-selected={type === value} onClick={() => setType(value)} className={`flex cursor-pointer flex-col items-center gap-1 rounded-lg border px-1 py-2 text-[10px] font-bold transition-colors ${type === value ? 'border-cyan-500 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300' : 'border-slate-200 text-slate-500 hover:border-cyan-400 dark:border-slate-700'}`}>
                <Icon className="h-4 w-4" aria-hidden />{t(`toolsWeb.qr.type_${value}`)}
              </button>
            ))}
          </div>
          {type === 'text' && (
            <Field label={t('toolsWeb.qr.type_text')}><textarea rows={5} value={fields.text} onChange={(event) => set('text', event.target.value)} placeholder={t('toolsWeb.qr.placeholder_text')} className={`${WEB_INPUT_CLASS} resize-y`} /></Field>
          )}
          {type === 'url' && (
            <>
              {input('url', t('toolsWeb.qr.type_url'), 'https://example.com', 'url')}
              {urlNeedsScheme && (
                <p className="text-[11px] text-amber-600 dark:text-amber-400">{t('toolsWeb.qr.url_scheme_hint')} <button type="button" className="cursor-pointer font-semibold underline" onClick={() => set('url', `https://${fields.url.trim()}`)}>{t('toolsWeb.qr.add_https')}</button></p>
              )}
            </>
          )}
          {type === 'email' && (
            <>
              {input('address', t('toolsWeb.qr.email_address'), 'name@example.com', 'email')}
              {input('subject', t('toolsWeb.qr.email_subject'), '')}
              <Field label={t('toolsWeb.qr.email_body')}><textarea rows={3} value={fields.body} onChange={(event) => set('body', event.target.value)} className={`${WEB_INPUT_CLASS} resize-y`} /></Field>
            </>
          )}
          {type === 'phone' && input('phone', t('toolsWeb.qr.phone_number'), '+1 555 0100', 'tel')}
          {type === 'sms' && (
            <>
              {input('smsNumber', t('toolsWeb.qr.phone_number'), '+1 555 0100', 'tel')}
              <Field label={t('toolsWeb.qr.sms_message')}><textarea rows={3} value={fields.smsBody} onChange={(event) => set('smsBody', event.target.value)} className={`${WEB_INPUT_CLASS} resize-y`} /></Field>
            </>
          )}
          {payload && type !== 'text' && type !== 'url' && <code className="block break-all rounded-lg bg-slate-100 px-3 py-2 font-mono text-[11px] text-slate-600 dark:bg-slate-800 dark:text-slate-300">{payload}</code>}
        </Pane>

        <QrStudio
          payload={payload}
          settings={settings}
          onChange={setSettings}
          filename="qrcode"
          onExport={(symbol) => record({ type, ...fields, ...settings }, { version: symbol.version, modules: symbol.size })}
        />
      </div>
    </WebPage>
  );
};

export default QrCodeGeneratorWorkbench;
