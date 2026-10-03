/** Text-to-Speech: browser voices with rate/pitch control, or a server neural voice with a player and download. */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, Globe, Mic, Pause, Play, Square, Volume2 } from 'lucide-react';
import { ProgressBar } from '@/shared/ui/ProgressBar';
import { RangeField } from '@/shared/ui/RangeField';
import { laravelMediaUrl } from '@/core/integrations/laravel/LaravelMediaUrl';
import { callToolApi, ToolRunError, useToolRun } from '../toolRunner';
import { toolUsageStore } from '../toolUsageStore';
import type { ToolWorkbenchProps } from '../toolWorkbenchTypes';
import { Btn, controlClass, Field, Notice, OpsPage, OpsStatusBar, Panel, Seg, Spinner } from './opsKit';
import { useMountedRef, useRemote } from './opsHooks';
import { downloadUrl, pollUntil, speechLocale } from './opsLogic';
import type { TtsGenerateData, TtsOptionsData } from './opsTypes';

type Engine = 'browser' | 'server';

interface TtsInput {
  engine: Engine;
  language: string;
  text: string;
}

interface TtsClip {
  url: string;
}

const FALLBACK_LANGUAGES = ['en', 'zh', 'ja', 'ko', 'es', 'fr', 'de', 'ru'];
const POLL_INTERVAL_MS = 3000;
const POLL_ATTEMPTS = 20;
const RATE_RANGE = { min: 0.5, max: 2, step: 0.1 };
const PITCH_RANGE = { min: 0, max: 2, step: 0.1 };
const TEXT_PREVIEW_CHARS = 200;

const TtsWorkbench: React.FC<ToolWorkbenchProps> = ({ tool, variant, lastRun }) => {
  const { t, i18n } = useTranslation();
  const previous = lastRun?.input as Partial<TtsInput> | null | undefined;
  const synth = typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null;
  const mounted = useMountedRef();
  const [engine, setEngine] = useState<Engine>(previous?.engine ?? (synth ? 'browser' : 'server'));
  const [language, setLanguage] = useState(previous?.language ?? (i18n.language.startsWith('zh') ? 'zh' : 'en'));
  const [text, setText] = useState('');
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceUri, setVoiceUri] = useState('');
  const [rate, setRate] = useState(1);
  const [pitch, setPitch] = useState(1);
  const [speech, setSpeech] = useState<'idle' | 'speaking' | 'paused'>('idle');
  const [spoken, setSpoken] = useState(0);
  const [phase, setPhase] = useState<'idle' | 'generating' | 'queued'>('idle');
  const [attempt, setAttempt] = useState(0);
  const { result: clip, error, running, run } = useToolRun<TtsClip>(tool.id, variant);
  const options = useRemote(() => callToolApi<TtsOptionsData>('appQyV1.getTTSOptions'), [], engine === 'server');
  const trimmed = text.trim();

  useEffect(() => {
    if (!synth) return undefined;
    const load = (): void => setVoices(synth.getVoices());
    load();
    synth.addEventListener('voiceschanged', load);
    return () => {
      synth.removeEventListener('voiceschanged', load);
      synth.cancel();
    };
  }, [synth]);

  const languages = options.data?.languages?.length ? options.data.languages : FALLBACK_LANGUAGES;
  const languageName = (code: string): string => t(`uiTools.languages.${code}`, { defaultValue: code });
  const matchingVoices = useMemo(() => {
    const prefix = speechLocale(language).split('-')[0].toLowerCase();
    return voices.filter((voice) => voice.lang.toLowerCase().startsWith(prefix));
  }, [voices, language]);
  const serverVoice = options.data?.voices?.[language] ?? '';
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const speak = (): void => {
    if (!synth || !trimmed) return;
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(trimmed);
    const voice = voices.find((candidate) => candidate.voiceURI === voiceUri) ?? matchingVoices[0];
    if (voice) utterance.voice = voice;
    utterance.lang = voice?.lang ?? speechLocale(language);
    utterance.rate = rate;
    utterance.pitch = pitch;
    utterance.onboundary = (event) => setSpoken(trimmed.length ? event.charIndex / trimmed.length : 0);
    utterance.onend = () => {
      setSpeech('idle');
      setSpoken(1);
      toolUsageStore.record(tool.id, variant, { engine: 'browser', language, text: trimmed.slice(0, TEXT_PREVIEW_CHARS) } satisfies TtsInput, null);
    };
    utterance.onerror = () => setSpeech('idle');
    setSpoken(0);
    setSpeech('speaking');
    synth.speak(utterance);
  };

  const pauseOrResume = (): void => {
    if (!synth) return;
    if (speech === 'speaking') {
      synth.pause();
      setSpeech('paused');
    } else if (speech === 'paused') {
      synth.resume();
      setSpeech('speaking');
    }
  };

  const stop = (): void => {
    synth?.cancel();
    setSpeech('idle');
  };

  const generate = async (): Promise<void> => {
    if (!trimmed || running) return;
    const input: TtsInput = { engine: 'server', language, text: trimmed.slice(0, TEXT_PREVIEW_CHARS) };
    await run(input, async () => {
      setPhase('generating');
      setAttempt(0);
      try {
        const outcome = await pollUntil(
          () => callToolApi<TtsGenerateData>(tool.apiMethod, { text: trimmed, language }),
          (data) => Boolean(data?.audio_url),
          {
            intervalMs: POLL_INTERVAL_MS,
            maxAttempts: POLL_ATTEMPTS,
            isCancelled: () => !mounted.current,
            onTick: (data, count) => { setAttempt(count); if (!data?.audio_url) setPhase('queued'); },
          },
        );
        const url = outcome.value?.audio_url;
        if (!url) throw new ToolRunError('remote_failed', { message: outcome.cancelled ? '' : t('toolsOps.tts.queue_timeout') });
        return { url: laravelMediaUrl(url) };
      } finally {
        if (mounted.current) setPhase('idle');
      }
    });
  };

  const statusText = engine === 'browser'
    ? (speech === 'speaking' ? t('toolsOps.tts.speaking') : speech === 'paused' ? t('toolsOps.tts.paused') : t('toolsOps.tts.browser_ready', { count: matchingVoices.length }))
    : (phase === 'queued' ? t('toolsOps.tts.queued', { attempt, max: POLL_ATTEMPTS }) : phase === 'generating' ? t('toolsOps.tts.generating') : clip ? t('toolsOps.tts.clip_ready') : t('toolsOps.tts.server_ready'));

  return (
    <OpsPage>
      <OpsStatusBar accent="fuchsia" mode={engine === 'server' ? 'server' : 'local'}>{statusText}</OpsStatusBar>

      <div className="flex flex-wrap items-center gap-3">
        <Seg
          accent="fuchsia"
          value={engine}
          onChange={(next) => { stop(); setEngine(next); }}
          options={[
            { value: 'browser', label: t('toolsOps.tts.engine_browser'), icon: Globe, disabled: !synth },
            { value: 'server', label: t('toolsOps.tts.engine_server'), icon: Mic },
          ]}
        />
        <select value={language} onChange={(event) => setLanguage(event.target.value)} className={`${controlClass('fuchsia')} !w-auto min-w-[10rem]`} aria-label={t('toolsOps.tts.language')}>
          {languages.map((code) => <option key={code} value={code}>{languageName(code)} ({code})</option>)}
        </select>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Panel title={t('toolsOps.tts.text')} icon={Volume2} accent="fuchsia" className="lg:col-span-3">
          <textarea value={text} onChange={(event) => setText(event.target.value)} rows={9} placeholder={t('toolsOps.tts.text_placeholder')} className={`${controlClass('fuchsia')} min-h-[12rem] resize-y`} />
          <p className="mt-2 text-right text-[11px] tabular-nums text-slate-400">{t('toolsOps.tts.chars', { count: text.length })}</p>
        </Panel>

        <Panel title={t('toolsOps.tts.voice_settings')} icon={Mic} accent="fuchsia" className="lg:col-span-2">
          {engine === 'browser' ? (
            <div className="space-y-4">
              <Field label={t('toolsOps.tts.voice')} hint={matchingVoices.length === 0 ? t('toolsOps.tts.no_voice_for_language') : undefined}>
                <select value={voiceUri} onChange={(event) => setVoiceUri(event.target.value)} className={controlClass('fuchsia')} disabled={matchingVoices.length === 0}>
                  <option value="">{t('toolsOps.tts.voice_default')}</option>
                  {matchingVoices.map((voice) => <option key={voice.voiceURI} value={voice.voiceURI}>{voice.name} ({voice.lang})</option>)}
                </select>
              </Field>
              <Field label={t('toolsOps.tts.rate', { value: rate.toFixed(1) })}>
                <RangeField value={rate} {...RATE_RANGE} onChange={setRate} />
              </Field>
              <Field label={t('toolsOps.tts.pitch', { value: pitch.toFixed(1) })}>
                <RangeField value={pitch} {...PITCH_RANGE} onChange={setPitch} />
              </Field>
            </div>
          ) : (
            <div className="space-y-4">
              <Field label={t('toolsOps.tts.voice')}>
                <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 font-mono text-xs text-slate-700 dark:bg-slate-900/50 dark:text-slate-200">
                  {options.loading ? <Spinner /> : null}
                  <span className="truncate">{serverVoice || t('toolsOps.tts.voice_auto')}</span>
                </div>
              </Field>
              <Notice tone="info">{t('toolsOps.tts.server_note')}</Notice>
              {options.error && <Notice tone="warn">{options.error}</Notice>}
            </div>
          )}
        </Panel>
      </div>

      {engine === 'browser' ? (
        <Panel title={t('toolsOps.tts.player')} icon={Play} accent="fuchsia">
          {!synth && <Notice tone="warn">{t('toolsOps.tts.browser_unsupported')}</Notice>}
          <div className="flex flex-wrap items-center gap-3">
            {speech === 'idle' ? (
              <Btn variant="primary" accent="fuchsia" icon={Play} onClick={speak} disabled={!trimmed || !synth}>{t('toolsOps.tts.speak')}</Btn>
            ) : (
              <>
                <Btn variant="primary" accent="fuchsia" icon={speech === 'paused' ? Play : Pause} onClick={pauseOrResume}>{speech === 'paused' ? t('uiTools.common.play') : t('uiTools.common.pause')}</Btn>
                <Btn icon={Square} onClick={stop}>{t('toolsOps.tts.stop')}</Btn>
              </>
            )}
            <ProgressBar done={Math.round(spoken * 100)} total={100} tone="violet" className="h-2 min-w-[8rem]" label={t('toolsOps.tts.player')} />
          </div>
          <p className="mt-2 text-[11px] text-slate-400">{t('toolsOps.tts.browser_note')}</p>
        </Panel>
      ) : (
        <Panel title={t('toolsOps.tts.player')} icon={Play} accent="fuchsia">
          <div className="space-y-3">
            <Btn variant="primary" accent="fuchsia" icon={Volume2} loading={running} onClick={() => void generate()} disabled={!trimmed}>
              {running ? (phase === 'queued' ? t('toolsOps.tts.queued', { attempt, max: POLL_ATTEMPTS }) : t('toolsOps.tts.generating')) : t('toolsOps.tts.generate')}
            </Btn>
            {error && <Notice tone="error">{error}</Notice>}
            {clip && (
              <div className="space-y-2 rounded-lg bg-slate-50 p-3 dark:bg-slate-900/50">
                {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                <audio ref={audioRef} src={clip.url} controls className="w-full" />
                <Btn size="sm" icon={Download} onClick={() => void downloadUrl(clip.url, `tts_${language}_${Date.now()}.mp3`)}>{t('uiTools.common.download')}</Btn>
              </div>
            )}
          </div>
        </Panel>
      )}
    </OpsPage>
  );
};

export default TtsWorkbench;
