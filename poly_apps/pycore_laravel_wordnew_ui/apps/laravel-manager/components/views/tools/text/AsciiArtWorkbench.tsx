/** ASCII art generator: pixel-font banner with fill, scale, spacing, shadow and frame controls rendered live. */
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Download } from 'lucide-react';
import { Stepper } from '@/shared/ui/Stepper';
import { buildExportFilename, downloadAsFile } from '@/apps/laravel-manager/utils/exportResult';
import type { ToolWorkbenchProps } from '../toolWorkbenchTypes';
import { CopyButton, Desk, FieldLabel, Notice, Paper, PaperTextarea, Segmented, SoftButton, ToggleChip, prefillBool, prefillNumber, prefillOneOf, prefillString, useDebounced, useToolRecord } from './textKit';
import { FILL_PRESETS, FRAME_STYLES, renderAscii, type AsciiOptions, type FrameStyle } from './logic/asciiFont';

const DEFAULT_FILL = FILL_PRESETS[0];
const SCALE_RANGE = { min: 1, max: 3 };
const SPACING_RANGE = { min: 0, max: 3 };
const MAX_TEXT = 200;

const AsciiArtWorkbench: React.FC<ToolWorkbenchProps> = ({ tool, variant, lastRun }) => {
  const { t } = useTranslation();
  const record = useToolRecord(tool.id, variant);
  const [text, setText] = useState(() => prefillString(lastRun, 'text', 'Hello'));
  const [fill, setFill] = useState(() => prefillString(lastRun, 'fill', DEFAULT_FILL) || DEFAULT_FILL);
  const [scale, setScale] = useState(() => prefillNumber(lastRun, 'scale', 1));
  const [spacing, setSpacing] = useState(() => prefillNumber(lastRun, 'spacing', 1));
  const [shadow, setShadow] = useState(() => prefillBool(lastRun, 'shadow', false));
  const [wide, setWide] = useState(() => prefillBool(lastRun, 'wide', true));
  const [frame, setFrame] = useState<FrameStyle>(() => prefillOneOf(lastRun, 'frame', FRAME_STYLES, 'none'));
  const liveText = useDebounced(text.slice(0, MAX_TEXT), 60);

  const options: AsciiOptions = useMemo(() => ({ fill, scale, spacing, shadow, frame, wide }), [fill, scale, spacing, shadow, frame, wide]);
  const result = useMemo(() => renderAscii(liveText, options), [liveText, options]);
  const settings = { text, fill, scale, spacing, shadow, wide, frame };

  return (
    <Desk wide>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-1">
          <Paper title={t('toolsText.ascii.text')}>
            <PaperTextarea mono rows={3} value={text} onChange={(value) => setText(value.slice(0, MAX_TEXT))} ariaLabel={t('toolsText.ascii.text')} placeholder={t('toolsText.ascii.placeholder')} />
            <p className="mt-1 text-right font-mono text-[11px] text-slate-400">{text.length} / {MAX_TEXT}</p>
          </Paper>

          <Paper title={t('toolsText.ascii.style')}>
            <div className="space-y-4">
              <div>
                <FieldLabel>{t('toolsText.ascii.fill')}</FieldLabel>
                <div className="flex flex-wrap gap-1.5">
                  {FILL_PRESETS.map((preset) => <ToggleChip key={preset} mono active={fill === preset} onClick={() => setFill(preset)}>{preset}</ToggleChip>)}
                  <input
                    value={FILL_PRESETS.includes(fill as (typeof FILL_PRESETS)[number]) ? '' : fill}
                    onChange={(event) => { const next = Array.from(event.target.value).pop(); if (next && next.trim()) setFill(next); }}
                    placeholder={t('toolsText.ascii.custom')}
                    aria-label={t('toolsText.ascii.custom')}
                    className="w-16 rounded-lg border border-stone-200 bg-[#fffdf8] px-2 py-1 text-center font-mono text-xs text-slate-800 focus:border-violet-400 focus:outline-none dark:border-slate-700 dark:bg-slate-950/50 dark:text-slate-100"
                  />
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div><FieldLabel>{t('toolsText.ascii.scale')}</FieldLabel><Stepper value={scale} min={SCALE_RANGE.min} max={SCALE_RANGE.max} step={1} suffix="x" onChange={setScale} /></div>
                <div><FieldLabel>{t('toolsText.ascii.spacing')}</FieldLabel><Stepper value={spacing} min={SPACING_RANGE.min} max={SPACING_RANGE.max} step={1} onChange={setSpacing} /></div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <ToggleChip active={shadow} onClick={() => setShadow((value) => !value)}>{t('toolsText.ascii.shadow')}</ToggleChip>
                <ToggleChip active={wide} onClick={() => setWide((value) => !value)} title={t('toolsText.ascii.wide_hint')}>{t('toolsText.ascii.wide')}</ToggleChip>
              </div>
              <div>
                <FieldLabel>{t('toolsText.ascii.frame')}</FieldLabel>
                <Segmented value={frame} onChange={(next) => setFrame(next)} ariaLabel={t('toolsText.ascii.frame')} options={FRAME_STYLES.map((id) => ({ value: id, label: t(`toolsText.ascii.frame_${id}`) }))} />
              </div>
            </div>
          </Paper>
        </div>

        <Paper
          className="lg:col-span-2"
          title={t('toolsText.ascii.output')}
          actions={(
            <>
              <SoftButton icon={<Download className="h-3.5 w-3.5" />} disabled={!result.art} onClick={() => { downloadAsFile(result.art, buildExportFilename(tool.id, 'txt'), 'text/plain'); record(settings, { width: result.width }); }}>{t('uiTools.common.download')}</SoftButton>
              <CopyButton text={result.art} onCopied={() => record(settings, { width: result.width })} />
            </>
          )}
        >
          {result.unsupported.length > 0 && <Notice tone="warn" className="mb-3">{t('toolsText.ascii.unsupported', { chars: result.unsupported.join(' ') })}</Notice>}
          {result.art ? (
            <pre className="max-h-[32rem] overflow-auto rounded-xl bg-slate-900 p-4 font-mono text-[11px] leading-[1.05] text-violet-200 shadow-inner sm:text-sm sm:leading-[1.05]" aria-label={t('toolsText.ascii.output')}>{result.art}</pre>
          ) : (
            <p className="py-16 text-center text-sm text-slate-400">{t('toolsText.ascii.empty')}</p>
          )}
          {result.art && <p className="mt-2 text-right font-mono text-[11px] text-slate-400">{result.width} x {result.height}</p>}
        </Paper>
      </div>
    </Desk>
  );
};

export default AsciiArtWorkbench;
