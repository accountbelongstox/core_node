/** Speech-to-Text: live dictation with the browser's speech recognition (no server round trip). */
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, Eraser, Mic, Square } from 'lucide-react';
import { downloadAsFile } from '@/apps/laravel-manager/utils/exportResult';
import { Switch } from '@/shared/ui/Switch';
import { toolUsageStore } from '../toolUsageStore';
import type { ToolWorkbenchProps } from '../toolWorkbenchTypes';
import { Btn, Chips, controlClass, CopyBtn, Metric, Notice, OpsPage, OpsStatusBar, Panel } from './opsKit';

interface RecognitionAlternative {
  transcript: string;
}

interface RecognitionResult {
  isFinal: boolean;
  [index: number]: RecognitionAlternative;
}

interface RecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<RecognitionResult>;
}

interface RecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: RecognitionEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

type RecognitionCtor = new () => RecognitionLike;

const LANGUAGE_CODES = ['en-US', 'zh-CN', 'ja-JP', 'ko-KR', 'es-ES', 'fr-FR', 'de-DE', 'ru-RU'];
const IGNORED_ERRORS = new Set(['no-speech', 'aborted']);
const FATAL_ERRORS = new Set(['not-allowed', 'service-not-allowed', 'audio-capture', 'language-not-supported']);

const recognitionCtor = (): RecognitionCtor | null => {
  if (typeof window === 'undefined') return null;
  const scope = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return scope.SpeechRecognition ?? scope.webkitSpeechRecognition ?? null;
};

const SpeechToTextWorkbench: React.FC<ToolWorkbenchProps> = ({ tool, variant, lastRun }) => {
  const { t, i18n } = useTranslation();
  const Ctor = recognitionCtor();
  const previous = lastRun?.input as { language?: string } | null | undefined;
  const preferred = previous?.language ?? (i18n.language.startsWith('zh') ? 'zh-CN' : navigator.language || 'en-US');
  const languageCodes = LANGUAGE_CODES.includes(preferred) ? LANGUAGE_CODES : [preferred, ...LANGUAGE_CODES];
  const [language, setLanguage] = useState(preferred);
  const [continuous, setContinuous] = useState(true);
  const [interimOn, setInterimOn] = useState(true);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interim, setInterim] = useState('');
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const recognizer = useRef<RecognitionLike | null>(null);
  const wanted = useRef(false);
  const transcriptRef = useRef('');
  transcriptRef.current = transcript;

  const languageLabel = (code: string): string => t(`uiTools.languages.${code.split('-')[0]}`, { defaultValue: code });
  const words = transcript.trim() ? transcript.trim().split(/\s+/).length : 0;

  const record = (): void => {
    if (transcriptRef.current.trim()) toolUsageStore.record(tool.id, variant, { language }, transcriptRef.current);
  };

  const stop = (): void => {
    wanted.current = false;
    recognizer.current?.stop();
  };

  const start = (): void => {
    if (!Ctor || listening) return;
    const instance = new Ctor();
    instance.lang = language;
    instance.continuous = continuous;
    instance.interimResults = interimOn;
    instance.onresult = (event) => {
      let finalChunk = '';
      let pending = '';
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        if (result.isFinal) finalChunk += result[0].transcript;
        else pending += result[0].transcript;
      }
      if (finalChunk) setTranscript((current) => `${current}${current && !/\s$/.test(current) ? ' ' : ''}${finalChunk.trim()}`);
      setInterim(pending);
    };
    instance.onerror = (event) => {
      if (IGNORED_ERRORS.has(event.error)) return;
      if (FATAL_ERRORS.has(event.error)) wanted.current = false;
      setErrorCode(event.error);
    };
    instance.onend = () => {
      setInterim('');
      if (wanted.current && continuous) {
        try {
          instance.start();
          return;
        } catch {
          wanted.current = false;
        }
      }
      setListening(false);
      record();
    };
    recognizer.current = instance;
    wanted.current = true;
    setErrorCode(null);
    try {
      instance.start();
      setListening(true);
    } catch {
      wanted.current = false;
    }
  };

  useEffect(() => () => {
    wanted.current = false;
    recognizer.current?.abort();
  }, []);

  return (
    <OpsPage>
      <OpsStatusBar accent="fuchsia" mode="local">
        {!Ctor ? t('toolsOps.stt.unsupported_status') : listening ? t('toolsOps.stt.listening') : t('toolsOps.stt.ready')}
      </OpsStatusBar>

      {!Ctor && <Notice tone="warn">{t('toolsOps.stt.unsupported')}</Notice>}
      {errorCode && <Notice tone="error">{t(`toolsOps.stt.errors.${errorCode}`, { defaultValue: t('toolsOps.stt.errors.unknown', { code: errorCode }) })}</Notice>}

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title={t('toolsOps.stt.capture')} icon={Mic} accent="fuchsia">
          <div className="flex flex-col items-center gap-4">
            <div className="relative flex h-28 w-28 items-center justify-center">
              {listening && <span className="absolute inset-0 animate-ping rounded-full bg-fuchsia-500/30" />}
              <button
                type="button"
                onClick={listening ? stop : start}
                disabled={!Ctor}
                aria-label={listening ? t('toolsOps.stt.stop') : t('toolsOps.stt.start')}
                className={`relative flex h-20 w-20 items-center justify-center rounded-full text-white shadow-lg transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${listening ? 'bg-rose-600 hover:bg-rose-700' : 'bg-fuchsia-600 hover:bg-fuchsia-700'}`}
              >
                {listening ? <Square className="h-8 w-8" /> : <Mic className="h-8 w-8" />}
              </button>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">{listening ? t('toolsOps.stt.tap_to_stop') : t('toolsOps.stt.tap_to_start')}</p>
          </div>
          <div className="mt-4 space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{t('toolsOps.stt.language')}</p>
            <Chips accent="fuchsia" value={language} onChange={(code) => { if (!listening) setLanguage(code); }} options={languageCodes.map((code) => ({ value: code, label: languageLabel(code), disabled: listening }))} />
            <label className="flex items-center justify-between gap-3 text-sm text-slate-600 dark:text-slate-300">
              {t('toolsOps.stt.continuous')}
              <Switch on={continuous} onChange={setContinuous} tone="fuchsia" disabled={listening} label={t('toolsOps.stt.continuous')} />
            </label>
            <label className="flex items-center justify-between gap-3 text-sm text-slate-600 dark:text-slate-300">
              {t('toolsOps.stt.interim')}
              <Switch on={interimOn} onChange={setInterimOn} tone="fuchsia" disabled={listening} label={t('toolsOps.stt.interim')} />
            </label>
          </div>
        </Panel>

        <Panel
          title={t('toolsOps.stt.transcript')}
          icon={Mic}
          accent="fuchsia"
          className="lg:col-span-2"
          actions={(
            <>
              <CopyBtn text={transcript} accent="fuchsia" />
              <Btn size="sm" icon={Download} onClick={() => downloadAsFile(transcript, `transcript_${Date.now()}.txt`, 'text/plain')} disabled={!transcript}>{t('uiTools.common.download')}</Btn>
              <Btn size="sm" icon={Eraser} onClick={() => { setTranscript(''); setInterim(''); }} disabled={!transcript && !interim}>{t('uiTools.common.clear')}</Btn>
            </>
          )}
        >
          <textarea value={transcript} onChange={(event) => setTranscript(event.target.value)} rows={10} placeholder={t('toolsOps.stt.placeholder')} className={`${controlClass('fuchsia')} min-h-[14rem] resize-y`} />
          <p className="mt-2 min-h-[1.25rem] text-sm italic text-slate-400">{interim}</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Metric label={t('toolsOps.stt.stat_words')} value={words} />
            <Metric label={t('toolsOps.stt.stat_chars')} value={transcript.length} />
          </div>
        </Panel>
      </div>
      <Notice tone="info">{t('toolsOps.stt.file_note')}</Notice>
    </OpsPage>
  );
};

export default SpeechToTextWorkbench;
