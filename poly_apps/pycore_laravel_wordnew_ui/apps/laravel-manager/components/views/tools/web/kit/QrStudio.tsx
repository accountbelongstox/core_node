/** QR preview and export studio shared by the QR and WiFi QR workbenches (browser-side encoder). */
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Download, FileImage, QrCode, SlidersHorizontal } from 'lucide-react';
import { CHECKER_STYLE, Btn, CopyBtn, Notice, Pane, Seg, Slider, Toggle, WEB_INPUT_CLASS, WEB_LABEL_CLASS, downloadBlob, downloadText } from './webKit';
import { QrCapacityError, encodeQr, type QrEcc, type QrSymbol } from '../logic/qr';
import { drawQrCanvas, qrContrast, qrToSvg, type QrModuleStyle, type QrRenderOptions } from '../logic/qrRender';
import { svgDataUri } from '../logic/svg';

export interface QrSettings {
  ecc: QrEcc;
  size: number;
  margin: number;
  fg: string;
  bg: string;
  style: QrModuleStyle;
  transparent: boolean;
}

export const DEFAULT_QR_SETTINGS: QrSettings = { ecc: 'M', size: 320, margin: 4, fg: '#0f172a', bg: '#ffffff', style: 'square', transparent: false };

const ECC_LEVELS: QrEcc[] = ['L', 'M', 'Q', 'H'];
const STYLES: QrModuleStyle[] = ['square', 'rounded', 'dots'];
const MIN_SIZE = 100;
const MAX_SIZE = 1000;
const MIN_CONTRAST = 3;
const HEX = /^#[0-9a-f]{6}$/i;

export const restoreQrSettings = (source: Record<string, unknown>): QrSettings => ({
  ecc: ECC_LEVELS.includes(source.ecc as QrEcc) ? source.ecc as QrEcc : DEFAULT_QR_SETTINGS.ecc,
  size: typeof source.size === 'number' ? Math.min(MAX_SIZE, Math.max(MIN_SIZE, source.size)) : DEFAULT_QR_SETTINGS.size,
  margin: typeof source.margin === 'number' ? Math.min(8, Math.max(0, source.margin)) : DEFAULT_QR_SETTINGS.margin,
  fg: typeof source.fg === 'string' && HEX.test(source.fg) ? source.fg : DEFAULT_QR_SETTINGS.fg,
  bg: typeof source.bg === 'string' && HEX.test(source.bg) ? source.bg : DEFAULT_QR_SETTINGS.bg,
  style: STYLES.includes(source.style as QrModuleStyle) ? source.style as QrModuleStyle : DEFAULT_QR_SETTINGS.style,
  transparent: typeof source.transparent === 'boolean' ? source.transparent : DEFAULT_QR_SETTINGS.transparent,
});

const renderOptions = (settings: QrSettings): QrRenderOptions => ({ fg: settings.fg, bg: settings.bg, margin: settings.margin, style: settings.style, transparent: settings.transparent });

interface ColorFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

const ColorField: React.FC<ColorFieldProps> = ({ label, value, onChange }) => (
  <div className="min-w-0">
    <span className={WEB_LABEL_CLASS}>{label}</span>
    <div className="flex gap-2">
      <input type="color" value={HEX.test(value) ? value : '#000000'} onChange={(event) => onChange(event.target.value)} aria-label={label} className="h-9 w-10 shrink-0 cursor-pointer rounded border border-slate-300 bg-transparent p-0.5 dark:border-slate-700" />
      <input value={value} onChange={(event) => onChange(event.target.value)} spellCheck={false} aria-label={label} className={`${WEB_INPUT_CLASS} font-mono uppercase`} />
    </div>
  </div>
);

interface QrStudioProps {
  payload: string;
  settings: QrSettings;
  onChange: (settings: QrSettings) => void;
  filename: string;
  onExport: (symbol: QrSymbol) => void;
  /** Rendered between the preview and its actions (for example a printable caption). */
  caption?: React.ReactNode;
}

export const QrStudio: React.FC<QrStudioProps> = ({ payload, settings, onChange, filename, onExport, caption }) => {
  const { t } = useTranslation();
  const set = <K extends keyof QrSettings>(key: K, value: QrSettings[K]) => onChange({ ...settings, [key]: value });

  const encoded = useMemo(() => {
    if (!payload) return { symbol: null, overflow: false };
    try {
      return { symbol: encodeQr(payload, settings.ecc), overflow: false };
    } catch (error) {
      return { symbol: null, overflow: error instanceof QrCapacityError };
    }
  }, [payload, settings.ecc]);
  const symbol = encoded.symbol;
  const options = renderOptions(settings);
  const svg = useMemo(() => (symbol ? qrToSvg(symbol, options, settings.size) : ''), [symbol, settings.fg, settings.bg, settings.margin, settings.style, settings.transparent, settings.size]);
  const contrast = qrContrast(settings.fg, settings.bg);
  const total = symbol ? symbol.size + settings.margin * 2 : 0;
  const edge = symbol ? Math.max(1, Math.floor(settings.size / total)) * total : 0;
  const hasHex = HEX.test(settings.fg) && HEX.test(settings.bg);

  const downloadPng = () => {
    if (!symbol) return;
    const canvas = document.createElement('canvas');
    drawQrCanvas(canvas, symbol, options, settings.size);
    canvas.toBlob((blob) => {
      if (!blob) return;
      downloadBlob(blob, `${filename}.png`);
      onExport(symbol);
    }, 'image/png');
  };

  return (
    <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,22rem)_1fr]">
      <Pane
        title={t('toolsWeb.qr.preview')}
        icon={QrCode}
        bodyClassName="space-y-3 p-3"
        footer={symbol ? t('toolsWeb.qr.info', { version: symbol.version, modules: symbol.size, mode: t(`toolsWeb.qr.mode_${symbol.mode}`) }) : undefined}
      >
        <div className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700" style={settings.transparent ? CHECKER_STYLE : { backgroundColor: settings.bg }}>
          {symbol ? <img src={svgDataUri(svg)} alt={t('toolsWeb.qr.preview')} className="h-full w-full object-contain" /> : (
            <p className="px-6 text-center text-xs text-slate-500 dark:text-slate-400">{t(encoded.overflow ? 'toolsWeb.qr.too_long' : 'toolsWeb.qr.empty')}</p>
          )}
        </div>
        {caption}
        {encoded.overflow && <Notice tone="error" icon={AlertTriangle}>{t('toolsWeb.qr.too_long')}</Notice>}
        {symbol && hasHex && !settings.transparent && contrast.inverted && <Notice tone="warn" icon={AlertTriangle}>{t('toolsWeb.qr.warn_inverted')}</Notice>}
        {symbol && hasHex && !settings.transparent && !contrast.inverted && contrast.ratio < MIN_CONTRAST && <Notice tone="warn" icon={AlertTriangle}>{t('toolsWeb.qr.warn_contrast', { ratio: contrast.ratio.toFixed(1) })}</Notice>}
        <div className="flex flex-wrap items-center gap-1">
          <Btn tone="primary" icon={Download} disabled={!symbol} onClick={downloadPng}>PNG</Btn>
          <Btn icon={FileImage} disabled={!symbol} onClick={() => { downloadText(svg, `${filename}.svg`, 'image/svg+xml'); if (symbol) onExport(symbol); }}>SVG</Btn>
          <CopyBtn getText={() => svg} label={t('toolsWeb.qr.copy_svg')} disabled={!symbol} onCopied={() => { if (symbol) onExport(symbol); }} />
          {symbol && <span className="ml-auto font-mono text-[11px] text-slate-500">{edge}{'×'}{edge}px</span>}
        </div>
      </Pane>

      <Pane title={t('toolsWeb.qr.settings')} icon={SlidersHorizontal} bodyClassName="space-y-4 p-3">
        <div>
          <span className={WEB_LABEL_CLASS}>{t('toolsWeb.qr.ecc')}</span>
          <Seg value={settings.ecc} onChange={(value) => set('ecc', value)} options={ECC_LEVELS.map((level) => ({ value: level, label: level, title: t(`toolsWeb.qr.ecc_${level}`) }))} />
          <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">{t(`toolsWeb.qr.ecc_${settings.ecc}`)}</p>
        </div>
        <Slider value={settings.size} min={MIN_SIZE} max={MAX_SIZE} step={10} onChange={(value) => set('size', value)} label={t('toolsWeb.qr.size')} format={(value) => `${value}px`} />
        <Slider value={settings.margin} min={0} max={8} onChange={(value) => set('margin', value)} label={t('toolsWeb.qr.margin')} format={(value) => t('toolsWeb.qr.modules', { count: value })} />
        <div>
          <span className={WEB_LABEL_CLASS}>{t('toolsWeb.qr.style')}</span>
          <Seg value={settings.style} onChange={(value) => set('style', value)} options={STYLES.map((value) => ({ value, label: t(`toolsWeb.qr.style_${value}`) }))} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <ColorField label={t('toolsWeb.qr.foreground')} value={settings.fg} onChange={(value) => set('fg', value)} />
          <ColorField label={t('toolsWeb.qr.background')} value={settings.bg} onChange={(value) => set('bg', value)} />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Toggle on={settings.transparent} onChange={(value) => set('transparent', value)} label={t('toolsWeb.qr.transparent')} />
          <Btn onClick={() => onChange({ ...DEFAULT_QR_SETTINGS, ecc: settings.ecc })}>{t('toolsWeb.qr.reset_style')}</Btn>
        </div>
      </Pane>
    </div>
  );
};
