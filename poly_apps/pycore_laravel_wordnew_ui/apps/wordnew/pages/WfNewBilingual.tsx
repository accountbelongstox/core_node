import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Volume2, Play, Pause, ChevronDown, ChevronUp, Layers, Sparkles, 
  Settings2, Languages, HelpCircle, BookOpen, RefreshCw, AudioLines
} from 'lucide-react';
import type { ElementTheme } from '../WfNewThemes';
import { wfNewApi, type BilingualSentence, type BilingualWord } from '../api';
import { wfNewSettings } from '../WfNewSettingsStore';

interface WfNewBilingualProps {
  activeTheme: ElementTheme;
  addToast: (text: string, type: 'success' | 'info' | 'warning' | 'star') => void;
  trans: (key: string, replacements?: Record<string, string | number>) => string;
  dark?: boolean;
}

export const WfNewBilingual: React.FC<WfNewBilingualProps> = ({
  activeTheme,
  addToast,
  trans,
  dark
}) => {
  // Sync core values with the shared settings store (WfNewSettingsStore).
  const [nativeLang, setNativeLang] = useState<string>(() => wfNewSettings.get('settingNativeLang'));
  const [targetLang, setTargetLang] = useState<string>(() => wfNewSettings.get('settingTargetLang'));
  const [bilingualRatio, setBilingualRatio] = useState<string>(() => wfNewSettings.get('bilingualRatio'));
  const [recitalOrder, setRecitalOrder] = useState<string>(() => wfNewSettings.get('recitalOrder'));

  // Track expanded sentence word lists
  const [expandedSentenceIds, setExpandedSentenceIds] = useState<Record<string, boolean>>({});
  
  // Custom speech voice playback tracking
  const [speakingSentenceId, setSpeakingSentenceId] = useState<string | null>(null);
  const [currentlyPlayingChain, setCurrentlyPlayingChain] = useState<boolean>(false);
  const [activeVoiceChainIndex, setActiveVoiceChainIndex] = useState<number>(0);
  const [playbackStage, setPlaybackStage] = useState<'idle' | 'target' | 'native'>('idle');

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Re-read on any settings change (reactive store; no polling / 'storage' event).
  useEffect(() => {
    return wfNewSettings.subscribe(() => {
      setNativeLang(wfNewSettings.get('settingNativeLang'));
      setTargetLang(wfNewSettings.get('settingTargetLang'));
      setBilingualRatio(wfNewSettings.get('bilingualRatio'));
      setRecitalOrder(wfNewSettings.get('recitalOrder'));
    });
  }, []);

  // All sentence pairs loaded via the API gateway (mock or real).
  const [allSentences, setAllSentences] = useState<BilingualSentence[]>([]);
  useEffect(() => {
    let alive = true;
    wfNewApi.getBilingualSentences()
      .then((list) => { if (alive && Array.isArray(list)) setAllSentences(list); })
      .catch(() => { /* leave empty on failure */ });
    return () => { alive = false; };
  }, []);

  // Filter sentences based on selected settings
  const filteredSentences = useMemo((): BilingualSentence[] => {
    const matches = allSentences.filter(
      s => s.nativeLang === nativeLang && s.targetLang === targetLang
    );
    // Fallback if no combinations found for the chosen language pair
    if (matches.length === 0) {
      return allSentences.filter(s => s.nativeLang === 'zh' && s.targetLang === 'en');
    }
    return matches;
  }, [nativeLang, targetLang, allSentences]);

  // Expand helper
  const toggleSentenceWords = (id: string) => {
    setExpandedSentenceIds(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  // Speaks a given piece of text in a specific language
  const speakText = (text: string, langCode: string, onEnd: () => void) => {
    if (!('speechSynthesis' in window)) {
      addToast(trans('bilingual.ttsUnsupported'), "warning");
      onEnd();
      return;
    }
    
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    
    // Choose appropriate voice code
    if (langCode === 'en') utterance.lang = 'en-US';
    else if (langCode === 'zh') utterance.lang = 'zh-CN';
    else if (langCode === 'fr') utterance.lang = 'fr-FR';
    else if (langCode === 'de') utterance.lang = 'de-DE';
    else if (langCode === 'es') utterance.lang = 'es-ES';
    else if (langCode === 'ja') utterance.lang = 'ja-JP';
    else if (langCode === 'ko') utterance.lang = 'ko-KR';
    else utterance.lang = langCode;

    utterance.onend = () => {
      onEnd();
    };
    utterance.onerror = () => {
      onEnd();
    };

    window.speechSynthesis.speak(utterance);
  };

  // Trigger continuous sequential recital
  const startRecitalChain = (sentence: BilingualSentence) => {
    if (currentlyPlayingChain && speakingSentenceId === sentence.id) {
      // Toggle off
      window.speechSynthesis.cancel();
      setCurrentlyPlayingChain(false);
      setSpeakingSentenceId(null);
      setPlaybackStage('idle');
      return;
    }

    window.speechSynthesis.cancel();
    setSpeakingSentenceId(sentence.id);
    setCurrentlyPlayingChain(true);
    
    // Begin step based on configured order
    executeRecitalStep(sentence, recitalOrder === 'target_first' ? 'target' : 'native');
  };

  const executeRecitalStep = (sentence: BilingualSentence, type: 'target' | 'native') => {
    setPlaybackStage(type);

    if (type === 'target') {
      // Speak target language (e.g. English)
      speakText(sentence.targetText, sentence.targetLang, () => {
        // If ratio is 2en_1zh, should we repeat? We follow the configured layout ratio
        if (bilingualRatio === '2en_1zh') {
          // Play target language one more time before switching to native translation
          setPlaybackStage('target');
          timerRef.current = setTimeout(() => {
            speakText(sentence.targetText, sentence.targetLang, () => {
              timerRef.current = setTimeout(() => {
                executeRecitalStep(sentence, 'native');
              }, 600);
            });
          }, 600);
        } else {
          // Otherwise play native translation directly
          timerRef.current = setTimeout(() => {
            executeRecitalStep(sentence, 'native');
          }, 600);
        }
      });
    } else {
      // Speak native language translation (e.g. Chinese)
      speakText(sentence.nativeText, sentence.nativeLang, () => {
        timerRef.current = setTimeout(() => {
          if (recitalOrder === 'native_first') {
            // If native was read first, now speak the target sentences
            setPlaybackStage('target');
            speakText(sentence.targetText, sentence.targetLang, () => {
              if (bilingualRatio === '2en_1zh') {
                timerRef.current = setTimeout(() => {
                  speakText(sentence.targetText, sentence.targetLang, () => {
                    stopRecitalGracefully();
                  });
                }, 600);
              } else {
                stopRecitalGracefully();
              }
            });
          } else {
            stopRecitalGracefully();
          }
        }, 600);
      });
    }
  };

  const stopRecitalGracefully = () => {
    setCurrentlyPlayingChain(false);
    setSpeakingSentenceId(null);
    setPlaybackStage('idle');
  };

  useEffect(() => {
    return () => {
      window.speechSynthesis.cancel();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const getLangBadgeName = (code: string) => trans('lang.name.' + code);

  const handleRatioSwitch = (ratio: string) => {
    setBilingualRatio(ratio);
    wfNewSettings.setField('bilingualRatio', ratio);
    addToast(trans('bilingual.ratioSet', { ratio: trans(ratio === '1en_1zh' ? 'bilingual.ratio_1_1' : 'bilingual.ratio_2_1') }), "info");
  };

  const handleOrderSwitch = (order: string) => {
    setRecitalOrder(order);
    wfNewSettings.setField('recitalOrder', order);
    addToast(trans('bilingual.orderSet', { order: trans(order === 'target_first' ? 'bilingual.order_targetFirst' : 'bilingual.order_nativeFirst') }), "info");
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      className="space-y-8 pb-24 max-w-4xl mx-auto"
    >
      {/* Control Deck for the user to optimize ratios directly inside the page view */}
      <div className={`p-5 sm:p-6 rounded-3xl ${activeTheme.cardClass} border border-zinc-100 dark:border-white/5 space-y-4 shadow-sm`}>
        <div className="flex items-center justify-between border-b border-zinc-100 dark:border-white/5 pb-3">
          <h3 className="text-xs font-black font-mono uppercase tracking-widest text-indigo-500 dark:text-indigo-400 flex items-center gap-2">
            <Settings2 className="w-4 h-4 text-indigo-505" />
            {trans('bilingual.synthTitle')}
          </h3>
          <span className="text-[10px] font-mono text-zinc-400">{trans('bilingual.synthNote')}</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Paragraph Ratio Logic */}
          <div className="space-y-2">
            <span className="text-[10px] font-bold tracking-wider text-zinc-500 font-mono uppercase block">
              {trans('bilingual.ratioLabel')}
            </span>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                onClick={() => handleRatioSwitch('1en_1zh')}
                className={`py-3 px-4 rounded-xl text-xs font-bold font-mono border text-center transition-all cursor-pointer ${
                  bilingualRatio === '1en_1zh'
                    ? 'bg-indigo-500/15 border-indigo-500 text-indigo-600 dark:text-white'
                    : 'bg-zinc-50 dark:bg-white/5 border-transparent text-zinc-400 hover:text-zinc-100'
                }`}
              >
                {trans('bilingual.ratioBtn11')}
              </button>
              <button
                onClick={() => handleRatioSwitch('2en_1zh')}
                className={`py-3 px-4 rounded-xl text-xs font-bold font-mono border text-center transition-all cursor-pointer ${
                  bilingualRatio === '2en_1zh'
                    ? 'bg-indigo-500/15 border-indigo-500 text-indigo-600 dark:text-white'
                    : 'bg-zinc-50 dark:bg-white/5 border-transparent text-zinc-400 hover:text-zinc-100'
                }`}
              >
                {trans('bilingual.ratioBtn21')}
              </button>
            </div>
          </div>

          {/* Pronunciation Reading Order Sequence */}
          <div className="space-y-2">
            <span className="text-[10px] font-bold tracking-wider text-zinc-500 font-mono uppercase block">
              {trans('bilingual.orderLabel')}
            </span>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                onClick={() => handleOrderSwitch('target_first')}
                className={`py-3 px-4 rounded-xl text-xs font-bold font-mono border text-center transition-all cursor-pointer ${
                  recitalOrder === 'target_first'
                    ? 'bg-purple-500/15 border-purple-500 text-purple-600 dark:text-white'
                    : 'bg-zinc-50 dark:bg-white/5 border-transparent text-zinc-400 hover:text-zinc-100'
                }`}
              >
                {trans('bilingual.orderBtnTarget')}
              </button>
              <button
                onClick={() => handleOrderSwitch('native_first')}
                className={`py-3 px-4 rounded-xl text-xs font-bold font-mono border text-center transition-all cursor-pointer ${
                  recitalOrder === 'native_first'
                    ? 'bg-purple-500/15 border-purple-500 text-purple-600 dark:text-white'
                    : 'bg-zinc-50 dark:bg-white/5 border-transparent text-zinc-400 hover:text-zinc-100'
                }`}
              >
                {trans('bilingual.orderBtnNative')}
              </button>
            </div>
          </div>
        </div>

        {/* Informative tips */}
        <div className="bg-sky-500/5 border border-sky-500/15 rounded-2xl p-3 flex gap-2 sm:gap-2.5 text-[11px] text-zinc-500 dark:text-sky-400 line-clamp-1">
          <HelpCircle className="w-4 h-4 text-sky-400 flex-shrink-0" />
          <span>{trans('bilingual.ttsTip', { lang: getLangBadgeName(targetLang) })}</span>
        </div>
      </div>

      {/* Main Bilingual Sentences Stack Container */}
      <div className="space-y-5">
        <div className="flex justify-between items-center px-1">
          <h3 className="text-xs font-black font-mono uppercase tracking-widest text-zinc-400 flex items-center gap-1.5">
            <BookOpen className="w-3.5 h-3.5" />
            {trans('bilingual.specimens', { n: filteredSentences.length })}
          </h3>
          <span className="text-[10px] text-zinc-500 font-mono">
            {getLangBadgeName(nativeLang)} ↔ {getLangBadgeName(targetLang)}
          </span>
        </div>

        {/* Show list of sentence comparative layouts */}
        <div className="space-y-4">
          {filteredSentences.map((sentence, idx) => {
            const isSpeakingThis = speakingSentenceId === sentence.id;
            const wordsExpanded = !!expandedSentenceIds[sentence.id];

            return (
              <motion.div
                key={sentence.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: idx * 0.05 }}
                className={`p-6 rounded-3xl relative overflow-hidden transition-all duration-300 border backdrop-blur-md ${
                  isSpeakingThis
                    ? 'border-indigo-500 bg-indigo-550/10 dark:bg-indigo-500/10 shadow-[0_0_25px_rgba(99,102,241,0.15)] shadow-indigo-500/10'
                    : dark 
                      ? 'bg-slate-900/40 border-white/5 hover:border-zinc-700/50' 
                      : 'bg-white/50 border-zinc-200 hover:border-zinc-300 shadow-sm'
                }`}
              >
                {/* Embedded speech wave visualization for active sentence recital */}
                {isSpeakingThis && (
                  <div className="absolute right-0 top-0 bottom-0 w-32 pointer-events-none overflow-hidden opacity-10 dark:opacity-[0.15] flex items-center justify-end pr-6">
                    <div className="flex items-end gap-1.5 h-12">
                      <div className="w-1.5 bg-indigo-500 rounded-full animate-[bounce_0.8s_infinite]" style={{ animationDelay: '0.1s' }} />
                      <div className="w-1.5 bg-indigo-505 rounded-full h-10 animate-[bounce_0.9s_infinite]" style={{ animationDelay: '0.3s' }} />
                      <div className="w-1.5 bg-fuchsia-400 rounded-full h-8 animate-[bounce_0.7s_infinite]" style={{ animationDelay: '0s' }} />
                      <div className="w-1.5 bg-indigo-500 rounded-full h-12 animate-[bounce_1.1s_infinite]" style={{ animationDelay: '0.5s' }} />
                    </div>
                  </div>
                )}

                {/* Left vertical timeline decoration node */}
                <div className={`absolute top-0 bottom-0 left-0 w-1 transition-colors ${
                  isSpeakingThis ? 'bg-indigo-550' : 'bg-transparent'
                }`} />

                <div className="flex flex-col gap-4">
                  {/* Playback action headers */}
                  <div className="flex justify-between items-start gap-4">
                    <div className="space-y-1 min-w-0">
                      <span className="text-[9px] font-black font-mono tracking-widest uppercase bg-indigo-500/10 text-indigo-550 dark:text-indigo-300 px-2.5 py-0.5 rounded-full border border-indigo-500/10">
                        {trans('bilingual.specimen', { n: idx + 1 })}
                      </span>
                    </div>

                    <div className="flex gap-2">
                      {/* Integrated Play Recital Loop Button */}
                      <button
                        onClick={() => startRecitalChain(sentence)}
                        className={`w-9 l h-9 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                          isSpeakingThis
                            ? 'bg-indigo-650 hover:bg-indigo-700 text-white animate-spin'
                            : 'bg-indigo-500/5 hover:bg-indigo-500/15 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 hover:scale-105'
                        }`}
                        title={trans('bilingual.playTitle')}
                        style={{ animationDuration: isSpeakingThis ? '3s' : '0s' }}
                      >
                        {isSpeakingThis ? (
                          <Pause className="w-4 h-4 text-white" />
                        ) : (
                          <Volume2 className="w-4 h-4" />
                        )}
                      </button>

                      {/* Expand word list details toggle */}
                      <button
                        onClick={() => toggleSentenceWords(sentence.id)}
                        className={`w-9 h-9 rounded-full bg-zinc-100 dark:bg-white/5 border dark:border-white/10 hover:bg-zinc-200 dark:hover:bg-white/10 text-zinc-500 dark:text-zinc-400 flex items-center justify-center transition-all cursor-pointer`}
                        title={trans('bilingual.expandTitle')}
                      >
                        {wordsExpanded ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Bilingual Contrast Paragraph Display */}
                  <div className="space-y-2.5 max-w-[85%]">
                    {/* Target Sentence Display */}
                    <div className={`text-lg font-black tracking-tight leading-relaxed transition-all ${
                      playbackStage === 'target' && isSpeakingThis
                        ? 'text-indigo-505 dark:text-indigo-400 drop-shadow-[0_0_8px_rgba(99,102,241,0.2)]'
                        : 'text-slate-800 dark:text-zinc-100'
                    }`}>
                      {sentence.targetText}
                    </div>

                    {/* Native Translation Display */}
                    <div className={`text-sm tracking-wide leading-relaxed font-medium transition-all ${
                      playbackStage === 'native' && isSpeakingThis
                        ? 'text-indigo-505 dark:text-indigo-400 font-extrabold'
                        : 'text-zinc-500 dark:text-zinc-400'
                    }`}>
                      {sentence.nativeText}
                    </div>
                  </div>

                  {/* Interactive Expandable words lists detail panels */}
                  <AnimatePresence>
                    {wordsExpanded && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.3 }}
                        className="overflow-hidden"
                      >
                        <div className="pt-4 border-t border-zinc-200/50 dark:border-white/5 mt-2 space-y-3">
                          <p className="text-[10px] font-black font-mono uppercase tracking-widest text-zinc-400 flex items-center gap-1.5 bg-zinc-100 dark:bg-white/2 p-2 px-3.5 rounded-xl border border-zinc-200/50 dark:border-white/5 w-fit select-none">
                            <Sparkles className="w-3 h-3 text-indigo-400 animate-pulse" />
                            {trans('bilingual.lexAnalysis')}
                          </p>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
                            {sentence.words.map((w, wIdx) => (
                              <motion.div
                                key={w.text}
                                initial={{ opacity: 0, scale: 0.98, x: -10 }}
                                animate={{ opacity: 1, scale: 1, x: 0 }}
                                transition={{ delay: wIdx * 0.05 }}
                                className={`p-4 rounded-2xl border flex flex-col justify-between gap-1.5 transition-colors relative group ${
                                  dark 
                                    ? 'bg-slate-950/40 border-white/5 hover:border-indigo-500/25' 
                                    : 'bg-zinc-50/50 border-zinc-200 hover:border-indigo-400/20 hover:bg-indigo-50/10'
                                }`}
                              >
                                <div>
                                  <div className="flex justify-between items-center">
                                    <span className="text-sm font-extrabold text-indigo-500 dark:text-indigo-400">
                                      {w.text}
                                    </span>
                                    <span className="text-[10px] text-zinc-500 font-mono font-bold tracking-tight bg-zinc-200/50 dark:bg-white/5 px-2 py-0.5 rounded-md">
                                      {w.phonetic}
                                    </span>
                                  </div>
                                  <p className="text-xs text-zinc-400 dark:text-zinc-500 italic mt-0.5 max-w-[85%] leading-normal">
                                    {w.definition}
                                  </p>
                                </div>
                                <div className="text-xs text-slate-800 dark:text-zinc-300 font-bold border-t border-zinc-200/50 dark:border-white/5 pt-2 mt-1">
                                  {w.translation}
                                </div>

                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    speakText(w.text, sentence.targetLang, () => {});
                                  }}
                                  className="absolute right-3.5 bottom-3 text-zinc-400 hover:text-indigo-400 transition-colors opacity-0 group-hover:opacity-100 p-1 rounded-full hover:bg-indigo-550/10"
                                >
                                  <Volume2 className="w-3.5 h-3.5" />
                                </button>
                              </motion.div>
                            ))}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
};
