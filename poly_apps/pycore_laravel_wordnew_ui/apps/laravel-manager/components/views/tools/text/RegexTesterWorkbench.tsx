/** Regex tester: live inline match highlighting, flag toggles, capture-group table, replace preview and pattern presets. */
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ToolWorkbenchProps } from '../toolWorkbenchTypes';
import {
  CopyButton, Desk, FieldLabel, FOCUS_RING, Notice, Paper, PaperTextarea, Segmented, ToggleChip, prefillString, useDebounced, useToolRecord,
} from './textKit';
import { REGEX_FLAGS, REGEX_PRESETS, MAX_MATCHES, normalizeFlags, previewReplace, scanMatches, toSegments } from './logic/regexLogic';

const DEBOUNCE_MS = 120;
const LIST_LIMIT = 200;
const DEFAULT_PRESET = REGEX_PRESETS[0];
const MARK_CLASSES = ['bg-violet-300/70 dark:bg-violet-500/40', 'bg-fuchsia-300/70 dark:bg-fuchsia-500/40'];
const TABS = ['matches', 'replace'] as const;
type Tab = (typeof TABS)[number];

const RegexTesterWorkbench: React.FC<ToolWorkbenchProps> = ({ tool, variant, lastRun }) => {
  const { t } = useTranslation();
  const record = useToolRecord(tool.id, variant);
  const [pattern, setPattern] = useState(() => prefillString(lastRun, 'pattern', DEFAULT_PRESET.pattern));
  const [flags, setFlags] = useState(() => prefillString(lastRun, 'flags', DEFAULT_PRESET.flags));
  const [text, setText] = useState(() => prefillString(lastRun, 'text', DEFAULT_PRESET.sample));
  const [replacement, setReplacement] = useState(() => prefillString(lastRun, 'replacement', '[$&]'));
  const [tab, setTab] = useState<Tab>('matches');
  const live = useDebounced({ pattern, flags, text }, DEBOUNCE_MS);

  const scan = useMemo(() => scanMatches(live.pattern, live.flags, live.text), [live]);
  const segments = useMemo(() => toSegments(live.text, scan.matches), [live.text, scan.matches]);
  const replaced = useMemo(() => previewReplace(live.pattern, live.flags, live.text, replacement), [live, replacement]);
  const fullPattern = `/${pattern}/${normalizeFlags(flags)}`;

  const toggleFlag = (flag: string): void => setFlags((current) => normalizeFlags(current.includes(flag) ? current.replace(flag, '') : `${current}${flag}`));
  const applyPreset = (id: string): void => {
    const preset = REGEX_PRESETS.find((entry) => entry.id === id);
    if (!preset) return;
    setPattern(preset.pattern);
    setFlags(preset.flags);
    setText(preset.sample);
  };
  const recordRun = (): void => record({ pattern, flags, text, replacement }, { matches: scan.matches.length });

  return (
    <Desk wide>
      <Paper
        title={t('toolsText.regex.pattern')}
        actions={<CopyButton text={fullPattern} label={t('toolsText.regex.copy_regex')} onCopied={recordRun} />}
      >
        <div className="flex flex-wrap items-center gap-2">
          <div className={`flex min-w-0 flex-1 basis-64 items-center rounded-xl border bg-[#fffdf8] font-mono text-sm dark:bg-slate-950/50 ${scan.error ? 'border-rose-400 dark:border-rose-500/70' : 'border-stone-200 dark:border-slate-700/70'} focus-within:border-violet-400 focus-within:ring-2 focus-within:ring-violet-400/25`}>
            <span className="select-none pl-3 text-violet-500">/</span>
            <input
              value={pattern}
              onChange={(event) => setPattern(event.target.value)}
              aria-label={t('toolsText.regex.pattern')}
              placeholder={t('toolsText.regex.pattern_placeholder')}
              spellCheck={false}
              autoComplete="off"
              className="min-w-0 flex-1 bg-transparent px-1.5 py-2.5 text-slate-800 outline-none dark:text-slate-100"
            />
            <span className="select-none pr-3 text-violet-500">/{normalizeFlags(flags)}</span>
          </div>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('toolsText.regex.flags')}>
            {REGEX_FLAGS.map((flag) => (
              <ToggleChip key={flag} mono active={flags.includes(flag)} onClick={() => toggleFlag(flag)} title={t(`toolsText.regex.flag_${flag}`)}>{flag}</ToggleChip>
            ))}
          </div>
        </div>
        <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1" role="group" aria-label={t('toolsText.regex.presets')}>
          {REGEX_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => applyPreset(preset.id)}
              className="shrink-0 cursor-pointer rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700 hover:bg-violet-100 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-300 dark:hover:bg-violet-500/20"
            >
              {t(`toolsText.regex.preset_${preset.id}`)}
            </button>
          ))}
        </div>
        {scan.error && <Notice tone="error" className="mt-3 font-mono">{scan.error}</Notice>}
      </Paper>

      <div className="grid gap-4 lg:grid-cols-2">
        <Paper title={t('toolsText.regex.test_text')} actions={<span className="text-[11px] text-slate-400">{t('toolsText.regex.chars', { n: text.length })}</span>}>
          <div className="relative rounded-xl border border-stone-200 bg-[#fffdf8] dark:border-slate-700/70 dark:bg-slate-950/50">
            <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden whitespace-pre-wrap break-words border border-transparent px-3.5 py-3 font-mono text-sm leading-relaxed text-transparent">
              {segments.map((segment, index) => (segment.matchIndex < 0
                ? <span key={index}>{segment.text}</span>
                : <mark key={index} className={`rounded-sm text-transparent ${MARK_CLASSES[segment.matchIndex % MARK_CLASSES.length]}`}>{segment.text}</mark>))}
              {'\n'}
            </div>
            <PaperTextarea
              bare
              autoGrow
              mono
              rows={8}
              value={text}
              onChange={setText}
              ariaLabel={t('toolsText.regex.test_text')}
              placeholder={t('toolsText.regex.text_placeholder')}
              className="relative min-h-[12rem]"
            />
          </div>
        </Paper>

        <Paper
          title={<Segmented value={tab} onChange={setTab} ariaLabel={t('toolsText.regex.view')} options={TABS.map((id) => ({ value: id, label: t(`toolsText.regex.tab_${id}`) }))} />}
          actions={<span className="rounded-full bg-violet-600 px-2.5 py-0.5 font-mono text-[11px] font-bold text-white">{t('toolsText.regex.match_count', { n: scan.matches.length })}</span>}
        >
          {tab === 'matches' ? (
            scan.matches.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-400">{pattern ? t('toolsText.regex.no_matches') : t('toolsText.regex.enter_pattern')}</p>
            ) : (
              <div className="max-h-[28rem] space-y-2 overflow-y-auto pr-1">
                {scan.truncated && <Notice tone="warn">{t('toolsText.regex.truncated', { n: MAX_MATCHES })}</Notice>}
                {scan.matches.slice(0, LIST_LIMIT).map((match, index) => (
                  <div key={`${match.index}-${index}`} className="rounded-xl border border-stone-200 bg-stone-50/60 p-2.5 dark:border-slate-700/60 dark:bg-slate-800/40">
                    <div className="flex items-center justify-between gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      <span>{t('toolsText.regex.match_n', { n: index + 1 })}</span>
                      <span className="font-mono normal-case">{match.index}-{match.end}</span>
                    </div>
                    <p className={`mt-1 break-all rounded-md px-1.5 py-0.5 font-mono text-sm text-slate-800 dark:text-slate-100 ${MARK_CLASSES[index % MARK_CLASSES.length]}`}>{match.value || t('toolsText.regex.empty_match')}</p>
                    {match.groups.length > 0 && (
                      <table className="mt-2 w-full table-fixed text-xs">
                        <tbody>
                          {match.groups.map((group) => (
                            <tr key={group.index} className="border-t border-stone-200/70 dark:border-slate-700/50">
                              <td className="w-20 truncate py-1 pr-2 font-mono text-violet-600 dark:text-violet-300">{group.name || `$${group.index}`}</td>
                              <td className="break-all py-1 font-mono text-slate-700 dark:text-slate-200">{group.value === undefined ? <span className="italic text-slate-400">{t('toolsText.regex.group_unset')}</span> : group.value}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                ))}
              </div>
            )
          ) : (
            <div className="space-y-3">
              <div>
                <FieldLabel hint={t('toolsText.regex.replace_hint')}>{t('toolsText.regex.replacement')}</FieldLabel>
                <input
                  value={replacement}
                  onChange={(event) => setReplacement(event.target.value)}
                  spellCheck={false}
                  aria-label={t('toolsText.regex.replacement')}
                  className={`w-full rounded-xl border border-stone-200 bg-[#fffdf8] px-3 py-2 font-mono text-sm text-slate-800 dark:border-slate-700/70 dark:bg-slate-950/50 dark:text-slate-100 ${FOCUS_RING}`}
                />
              </div>
              <div>
                <FieldLabel>{t('toolsText.regex.result')}</FieldLabel>
                <PaperTextarea readOnly mono rows={8} value={replaced ?? ''} onChange={() => undefined} ariaLabel={t('toolsText.regex.result')} />
                <div className="mt-2"><CopyButton text={replaced ?? ''} onCopied={recordRun} /></div>
              </div>
            </div>
          )}
        </Paper>
      </div>
    </Desk>
  );
};

export default RegexTesterWorkbench;
