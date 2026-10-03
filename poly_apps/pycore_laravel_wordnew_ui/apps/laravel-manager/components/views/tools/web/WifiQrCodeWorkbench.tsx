/** WiFi QR code: network form, scannable join code with a printable-style card and PNG / SVG export. */
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Eye, EyeOff, Wand2, Wifi } from 'lucide-react';
import type { ToolWorkbenchProps } from '../toolWorkbenchTypes';
import { Btn, CopyBtn, Field, Notice, Pane, Seg, Toggle, WEB_INPUT_CLASS, WebPage, lastInput, pickBool, pickOption, pickString, useDebounced, useToolRecord } from './kit/webKit';
import { QrStudio, restoreQrSettings, type QrSettings } from './kit/QrStudio';
import { buildWifiPayload, type WifiEncryption } from './logic/wifi';

type Encryption = WifiEncryption;

const ENCRYPTIONS: readonly Encryption[] = ['WPA', 'WEP', 'nopass'];
const DEBOUNCE_MS = 150;
const WPA_MIN = 8;
const WPA_MAX = 63;
const SSID_MAX = 32;

const WifiQrCodeWorkbench: React.FC<ToolWorkbenchProps> = ({ tool, variant, lastRun }) => {
  const { t } = useTranslation();
  const record = useToolRecord(tool.id, variant);
  const prefill = lastInput(lastRun);
  const [ssid, setSsid] = useState(pickString(prefill, 'ssid', ''));
  const [password, setPassword] = useState('');
  const [reveal, setReveal] = useState(false);
  const [encryption, setEncryption] = useState<Encryption>(pickOption<Encryption>(prefill, 'encryption', ENCRYPTIONS, 'WPA'));
  const [hidden, setHidden] = useState(pickBool(prefill, 'hidden', false));
  const [showOnCard, setShowOnCard] = useState(false);
  const [settings, setSettings] = useState<QrSettings>(() => restoreQrSettings(prefill));
  const payload = useDebounced(useMemo(() => buildWifiPayload(ssid, password, encryption, hidden), [ssid, password, encryption, hidden]), DEBOUNCE_MS);
  const passwordWarning = encryption === 'WPA' && password.length > 0 && (password.length < WPA_MIN || password.length > WPA_MAX);

  const card = ssid ? (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-center dark:border-slate-700 dark:bg-slate-800/60">
      <div className="flex items-center justify-center gap-2 text-cyan-600 dark:text-cyan-300"><Wifi className="h-4 w-4" aria-hidden /><span className="font-mono text-[10px] font-bold uppercase tracking-wider">{t('toolsWeb.wifi.scan_to_join')}</span></div>
      <div className="mt-1 break-all text-base font-bold text-slate-900 dark:text-slate-100">{ssid}</div>
      {showOnCard && encryption !== 'nopass' && password && <div className="mt-0.5 break-all font-mono text-xs text-slate-600 dark:text-slate-300">{password}</div>}
    </div>
  ) : null;

  return (
    <WebPage>
      <div className="grid gap-3 xl:grid-cols-[minmax(0,24rem)_1fr]">
        <Pane
          title={t('toolsWeb.wifi.network')}
          icon={Wifi}
          bodyClassName="space-y-3 p-3"
          actions={<Btn icon={Wand2} onClick={() => { setSsid('Guest Network'); setPassword('welcome-2026'); setEncryption('WPA'); }}>{t('toolsWeb.common.sample')}</Btn>}
        >
          <Field label={t('toolsWeb.wifi.ssid')}>
            <input value={ssid} onChange={(event) => setSsid(event.target.value)} placeholder={t('toolsWeb.wifi.ssid_placeholder')} spellCheck={false} autoComplete="off" className={WEB_INPUT_CLASS} />
          </Field>
          {ssid.length > SSID_MAX && <Notice tone="warn" icon={AlertTriangle}>{t('toolsWeb.wifi.ssid_long', { max: SSID_MAX })}</Notice>}
          <div>
            <span className="mb-1 block font-mono text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{t('toolsWeb.wifi.security')}</span>
            <Seg value={encryption} onChange={setEncryption} options={ENCRYPTIONS.map((value) => ({ value, label: t(`toolsWeb.wifi.security_${value}`) }))} />
          </div>
          {encryption !== 'nopass' && (
            <Field label={t('toolsWeb.wifi.password')}>
              <div className="relative">
                <input type={reveal ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} spellCheck={false} autoComplete="off" className={`${WEB_INPUT_CLASS} pr-10 font-mono`} />
                <button type="button" onClick={() => setReveal(!reveal)} className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer text-slate-400 hover:text-cyan-500" aria-label={t(reveal ? 'toolsWeb.wifi.hide_password' : 'toolsWeb.wifi.show_password')}>
                  {reveal ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </Field>
          )}
          {passwordWarning && <Notice tone="warn" icon={AlertTriangle}>{t('toolsWeb.wifi.wpa_length', { min: WPA_MIN, max: WPA_MAX })}</Notice>}
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            <Toggle on={hidden} onChange={setHidden} label={t('toolsWeb.wifi.hidden')} />
            {encryption !== 'nopass' && <Toggle on={showOnCard} onChange={setShowOnCard} label={t('toolsWeb.wifi.password_on_card')} />}
          </div>
          {payload && (
            <div className="rounded-lg border border-slate-200 p-2 dark:border-slate-700">
              <div className="mb-1 flex items-center justify-between"><span className="font-mono text-[10px] uppercase tracking-wider text-slate-500">{t('toolsWeb.wifi.payload')}</span><CopyBtn getText={() => payload} /></div>
              <code className="block break-all font-mono text-[11px] text-slate-700 dark:text-slate-300">{reveal ? payload : payload.replace(/(P:)[^;]*/, '$1••••••')}</code>
            </div>
          )}
        </Pane>

        <QrStudio
          payload={payload}
          settings={settings}
          onChange={setSettings}
          filename="wifi-qr"
          caption={card}
          onExport={(symbol) => record({ ssid, encryption, hidden, ...settings }, { version: symbol.version, modules: symbol.size })}
        />
      </div>
    </WebPage>
  );
};

export default WifiQrCodeWorkbench;
