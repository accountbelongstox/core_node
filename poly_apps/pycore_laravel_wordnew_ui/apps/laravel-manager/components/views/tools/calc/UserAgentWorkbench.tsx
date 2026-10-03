/** User-agent parser: browser, engine, OS, device and CPU cards plus a token breakdown, all computed in the browser. */
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Bot, Cog, Cpu, Globe, Laptop, MonitorSmartphone, Smartphone, Tablet, Tv, Gamepad2, UserRound } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ToolWorkbenchProps } from '../toolWorkbenchTypes';
import { Bench, Btn, Card, Chips, CopyButton, FIELD_CLASS, FieldLabel, MUTED_TEXT, prefillInput, useAccent, useAutoRecord, useRecordUse } from './calcKit';
import { parseUserAgent, type UaInfo } from './netLogic';

const SAMPLES: ReadonlyArray<{ label: string; ua: string }> = [
  { label: 'Chrome · Windows', ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36' },
  { label: 'Edge · Windows', ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.2478.67' },
  { label: 'Safari · iPhone', ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1' },
  { label: 'Chrome · Android', ua: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.6367.82 Mobile Safari/537.36' },
  { label: 'Firefox · Linux', ua: 'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:125.0) Gecko/20100101 Firefox/125.0' },
  { label: 'Safari · macOS', ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15' },
  { label: 'Googlebot', ua: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' },
  { label: 'curl', ua: 'curl/8.4.0' },
];

const DEVICE_ICON: Record<UaInfo['device']['type'], LucideIcon> = {
  desktop: Laptop, mobile: Smartphone, tablet: Tablet, tv: Tv, console: Gamepad2, bot: Bot, unknown: MonitorSmartphone,
};

const joinVersion = (name: string, version: string): string => (name ? `${name}${version ? ` ${version}` : ''}` : '');

const UserAgentWorkbench: React.FC<ToolWorkbenchProps> = ({ tool, variant, lastRun }) => {
  const { t } = useTranslation();
  const a = useAccent();
  const record = useRecordUse(tool, variant);
  const initial = useMemo(() => prefillInput(lastRun, { ua: typeof navigator !== 'undefined' ? navigator.userAgent : '' }), [lastRun]);
  const [ua, setUa] = useState(initial.ua);
  const info = useMemo(() => (ua.trim() ? parseUserAgent(ua) : null), [ua]);

  useAutoRecord(record, { ua }, { browser: info?.browser.name ?? '', os: info?.os.name ?? '' }, info !== null);

  const unknown = t('toolsCalc.ua.unknown');
  const DeviceIcon = info ? DEVICE_ICON[info.device.type] : MonitorSmartphone;
  const cards: Array<{ key: string; icon: LucideIcon; label: string; main: string; sub: string }> = info ? [
    { key: 'browser', icon: Globe, label: t('toolsCalc.ua.browser'), main: info.browser.name || unknown, sub: info.browser.version },
    { key: 'engine', icon: Cog, label: t('toolsCalc.ua.engine'), main: info.engine.name || unknown, sub: info.engine.version },
    { key: 'os', icon: UserRound, label: t('toolsCalc.ua.os'), main: info.os.name || unknown, sub: info.os.version },
    { key: 'device', icon: DeviceIcon, label: t('toolsCalc.ua.device'), main: t(`toolsCalc.ua.device_${info.device.type}`), sub: [info.device.vendor, info.device.model].filter(Boolean).join(' ') },
    { key: 'cpu', icon: Cpu, label: t('toolsCalc.ua.cpu'), main: info.cpu || unknown, sub: '' },
  ] : [];

  return (
    <Bench accent="net">
      <Card title={t('toolsCalc.ua.input')} aside={<Btn variant="ghost" onClick={() => setUa(navigator.userAgent)} icon={<UserRound className="h-3.5 w-3.5" />}>{t('toolsCalc.ua.use_mine')}</Btn>}>
        <FieldLabel htmlFor="ua-input">{t('toolsCalc.ua.label')}</FieldLabel>
        <textarea
          id="ua-input"
          value={ua}
          onChange={(event) => setUa(event.target.value)}
          rows={3}
          spellCheck={false}
          autoComplete="off"
          placeholder="Mozilla/5.0 (...) ..."
          className={`${FIELD_CLASS} ${a.focus} resize-y`}
        />
        <Chips className="mt-2" value={null} onChange={setUa} options={SAMPLES.map((s) => ({ value: s.ua, label: s.label }))} />
      </Card>

      {info?.bot && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-300">
          <Bot className="h-4 w-4 shrink-0" />{t('toolsCalc.ua.bot_detected', { name: info.bot })}
        </div>
      )}

      {info && (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {cards.map((card) => (
              <div key={card.key} className="min-w-0 rounded-2xl border border-slate-200 border-l-4 border-l-rose-500 bg-white p-3 shadow-sm dark:border-slate-800 dark:border-l-rose-500 dark:bg-slate-900/60">
                <p className={`flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider ${MUTED_TEXT}`}><card.icon className="h-3.5 w-3.5" />{card.label}</p>
                <p className="mt-1.5 truncate font-mono text-lg font-bold text-slate-900 dark:text-white" title={card.main}>{card.main}</p>
                <p className={`min-h-[1.25rem] truncate font-mono text-xs ${a.text}`} title={card.sub}>{card.sub}</p>
              </div>
            ))}
          </div>

          <Card title={t('toolsCalc.ua.tokens')} aside={<CopyButton text={joinVersion(info.browser.name, info.browser.version) + (info.os.name ? ` / ${joinVersion(info.os.name, info.os.version)}` : '')} label={t('toolsCalc.common.copy')}>{t('toolsCalc.ua.copy_summary')}</CopyButton>}>
            <div className="flex flex-wrap gap-1.5">
              {info.tokens.map((token, i) => (
                token.kind === 'product'
                  ? <span key={i} className={`rounded-lg ${a.tint} px-2 py-1 font-mono text-xs font-semibold ${a.text}`}>{token.text}</span>
                  : token.text.split(/;\s*/).filter(Boolean).map((part, j) => <span key={`${i}-${j}`} className="rounded-lg border border-dashed border-slate-300 px-2 py-1 font-mono text-xs text-slate-600 dark:border-slate-700 dark:text-slate-300">{part}</span>)
              ))}
            </div>
          </Card>
        </>
      )}
    </Bench>
  );
};

export default UserAgentWorkbench;
