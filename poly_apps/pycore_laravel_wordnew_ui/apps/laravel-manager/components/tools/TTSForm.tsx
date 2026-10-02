import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Volume2,
  Play,
  Pause,
  Download,
  RefreshCw,
  Mic,
  Settings
} from 'lucide-react';
import { useToolModel } from '@/apps/laravel-manager/hooks';
import { AI_TOOLS } from '@/apps/laravel-manager/config/tools.config';
import ToolWrapper from '@/shared/ui/ToolWrapper';
import HistoryList from '../universal/HistoryList';
import { commonClasses } from '@/shared/styles/theme';
import { appQyV1Model } from '@/apps/laravel-manager/models';
import {
  AI_BODY,
  AI_GRID_2,
  AiBentoCard,
  AiToolActions,
  AiToolAlert,
  AiToolField,
  AiToolRange,
  AiToolStatRow,
  AiToolTips,
} from '@/shared/ui/AiToolUi';

const TTSForm: React.FC = () => {
  const { t } = useTranslation();
  const config = AI_TOOLS.tts;
  const {
    history,
    isFavorite,
    toggleFavorite,
  } = useToolModel(config);

  const [text, setText] = useState('');
  const [language, setLanguage] = useState('en');
  const [voice, setVoice] = useState('');
  const [speed, setSpeed] = useState(0);
  const [pitch, setPitch] = useState(0);

  const [ttsOptions, setTtsOptions] = useState<any>(null);
  const [loadingOptions, setLoadingOptions] = useState(true);

  // TTS generation goes through appQyV1Model directly (not the hook's execute),
  // so generation loading/error/notice state is tracked locally here. The hook's
  // own loading/error never update for this flow.
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [currentAudio, setCurrentAudio] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    loadOptions();
  }, []);

  const loadOptions = async () => {
    setLoadingOptions(true);
    try {
      const result = await appQyV1Model.aiTools.tts.getOptions();

      if (result.success && result.data) {
        setTtsOptions(result.data);

        if (result.data.languages?.length > 0) {
          const defaultLang = result.data.languages.includes('en') ? 'en' : result.data.languages[0];
          setLanguage(defaultLang);

          if (result.data.voices && result.data.voices[defaultLang]) {
            setVoice(result.data.voices[defaultLang]);
          }
        }

        if (result.data.speed?.default !== undefined) {
          setSpeed(result.data.speed.default);
        }
        if (result.data.pitch?.default !== undefined) {
          setPitch(result.data.pitch.default);
        }
      }
    } catch (err) {
      console.error('Failed to load TTS options:', err);
    } finally {
      setLoadingOptions(false);
    }
  };

  const handleGenerate = async () => {
    if (!text.trim()) return;

    setError(null);
    setNotice(null);
    setGenerating(true);

    try {
      const result = await appQyV1Model.aiTools.tts.generate(text.trim(), language, {
        type: 'sentence',
        // `options` carries the edge-tts rate/pitch payload to the /tts/generate
        // endpoint. The model's intermediate options type is narrower than the
        // API layer (which accepts `options?: any`), so cast to keep types clean
        // without changing the runtime contract.
        options: {
          rate: `${speed >= 0 ? '+' : ''}${speed}%`,
          pitch: `${pitch >= 0 ? '+' : ''}${pitch}Hz`,
        },
      } as { type?: string; options?: any });

      if (!result.success) {
        setError(result.error || t('uiTools.tts.error_generation_failed'));
        return;
      }

      if (result.data?.audio_url) {
        // Cache hit — audio is ready immediately.
        setCurrentAudio(result.data.audio_url);
        setText('');
      } else if (result.data?.queued) {
        // Task was enqueued for background generation; no audio URL yet.
        setNotice(
          result.data.message ||
            t('uiTools.tts.notice_queued')
        );
      } else {
        setError(t('uiTools.tts.error_no_audio'));
      }
    } catch (err) {
      console.error('TTS generation failed:', err);
      setError(t('uiTools.tts.error_generation_failed'));
    } finally {
      setGenerating(false);
    }
  };

  const handlePlayAudio = (audioUrl: string) => {
    if (!audioRef.current) return;

    if (playing && currentAudio === audioUrl) {
      audioRef.current.pause();
      setPlaying(false);
    } else {
      audioRef.current.src = audioUrl;
      audioRef.current.play();
      setCurrentAudio(audioUrl);
      setPlaying(true);
    }
  };

  const handleDownload = (audioUrl: string, id: string) => {
    const link = document.createElement('a');
    link.href = audioUrl;
    link.download = `tts_${id}.mp3`;
    link.click();
  };

  const getLanguageName = (lang: string): string =>
    t(`uiTools.languages.${lang}`, { defaultValue: lang });

  const availableLanguages = ttsOptions?.languages || [];
  const speedConfig = ttsOptions?.speed || { min: -50, max: 100, step: 10, default: 0, unit: '%' };
  const pitchConfig = ttsOptions?.pitch || { min: -50, max: 50, step: 5, default: 0, unit: 'Hz' };

  return (
    <ToolWrapper
      title={config.name}
      icon={Volume2}
      gradient="green-teal"
      description={config.description}
      favorites={config.favorites}
      isFavorite={isFavorite}
      onToggleFavorite={toggleFavorite}
      showHistory={showHistory}
      onToggleHistory={() => setShowHistory(!showHistory)}
      history={
        <HistoryList
          items={history}
          showInput={true}
          showOutput={false}
        />
      }
    >
      <div className={AI_BODY}>
        <AiBentoCard title={t('uiTools.tts.text_input')}>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t('uiTools.tts.text_placeholder')}
            className={`${commonClasses.input} w-full resize-none min-h-[160px]`}
            rows={6}
          />
          <AiToolStatRow
            left={t('uiTools.tts.characters_count', { count: text.length })}
            right={t('uiTools.tts.seconds_estimate', { count: Math.ceil(text.length / 100) })}
          />
        </AiBentoCard>

        <div className={AI_GRID_2}>
          <AiBentoCard title={t('uiTools.tts.voice_settings')}>
            <div className="space-y-4">
              <AiToolField label={t('uiTools.tts.language_label', { count: availableLanguages.length })}>
                {loadingOptions ? (
                  <div className="flex items-center justify-center py-6">
                    <RefreshCw className="w-5 h-5 animate-spin text-emerald-500" />
                  </div>
                ) : (
                  <select
                    value={language}
                    onChange={(e) => {
                      const newLang = e.target.value;
                      setLanguage(newLang);
                      if (ttsOptions?.voices && ttsOptions.voices[newLang]) {
                        setVoice(ttsOptions.voices[newLang]);
                      }
                    }}
                    className={`${commonClasses.input} w-full`}
                  >
                    {availableLanguages.map((lang: string) => (
                      <option key={lang} value={lang}>
                        {getLanguageName(lang)} ({lang})
                      </option>
                    ))}
                  </select>
                )}
              </AiToolField>

              <AiToolField
                label={t('uiTools.tts.voice')}
                hint={t('uiTools.tts.voice_hint')}
              >
                <input
                  type="text"
                  value={voice}
                  readOnly
                  className={`${commonClasses.input} w-full bg-slate-50 dark:bg-slate-800/80`}
                  placeholder={t('uiTools.tts.voice_placeholder')}
                />
              </AiToolField>
            </div>
          </AiBentoCard>

          <AiBentoCard title={t('uiTools.tts.advanced_settings')}>
            <div className="space-y-5">
              <AiToolRange
                label={t('uiTools.tts.speed_label', { value: `${speed >= 0 ? '+' : ''}${speed}${speedConfig.unit}` })}
                value={speed}
                min={speedConfig.min}
                max={speedConfig.max}
                step={speedConfig.step}
                unit={speedConfig.unit}
                minLabel={t('uiTools.tts.slower', { value: `${speedConfig.min}${speedConfig.unit}` })}
                maxLabel={t('uiTools.tts.faster', { value: `${speedConfig.max}${speedConfig.unit}` })}
                onChange={setSpeed}
                disabled={loadingOptions}
                accent="emerald"
              />
              <AiToolRange
                label={t('uiTools.tts.pitch_label', { value: `${pitch >= 0 ? '+' : ''}${pitch}${pitchConfig.unit}` })}
                value={pitch}
                min={pitchConfig.min}
                max={pitchConfig.max}
                step={pitchConfig.step}
                unit={pitchConfig.unit}
                minLabel={t('uiTools.tts.lower', { value: `${pitchConfig.min}${pitchConfig.unit}` })}
                maxLabel={t('uiTools.tts.higher', { value: `${pitchConfig.max}${pitchConfig.unit}` })}
                onChange={setPitch}
                disabled={loadingOptions}
                accent="emerald"
              />
            </div>
          </AiBentoCard>
        </div>

        <AiToolActions>
          <button
            onClick={handleGenerate}
            disabled={!text.trim() || generating || loadingOptions}
            className={`${commonClasses.button} ${commonClasses.buttonPrimary} px-8 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {generating ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                {t('uiTools.tts.generating')}
              </>
            ) : (
              <>
                <Volume2 className="w-4 h-4" />
                {t('uiTools.tts.generate_speech')}
              </>
            )}
          </button>
        </AiToolActions>

        {error && <AiToolAlert>{error}</AiToolAlert>}

        {notice && (
          <div className="px-4 py-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/40 text-sm text-amber-700 dark:text-amber-300">
            {notice}
          </div>
        )}

        {currentAudio && (
          <AiBentoCard title={t('uiTools.tts.generated_audio')}>
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => handlePlayAudio(currentAudio)}
                className={`${commonClasses.button} ${commonClasses.buttonPrimary} flex items-center gap-2`}
              >
                {playing && currentAudio ? (
                  <>
                    <Pause className="w-4 h-4" />
                    {t('uiTools.common.pause')}
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    {t('uiTools.common.play')}
                  </>
                )}
              </button>
              <button
                onClick={() => handleDownload(currentAudio, Date.now().toString())}
                className={`${commonClasses.button} ${commonClasses.buttonSecondary} flex items-center gap-2`}
              >
                <Download className="w-4 h-4" />
                {t('uiTools.common.download')}
              </button>
            </div>
          </AiBentoCard>
        )}

        <AiToolTips
          accent="emerald"
          items={[
            { icon: Mic, text: t('uiTools.tts.tip_voices') },
            { icon: Settings, text: t('uiTools.tts.tip_adjust') },
            { icon: Download, text: t('uiTools.tts.tip_download') },
          ]}
        />
      </div>

      <audio
        ref={audioRef}
        onEnded={() => setPlaying(false)}
        className="hidden"
      />
    </ToolWrapper>
  );
};

export default TTSForm;
