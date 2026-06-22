/* [v4.1-Iris] Word Reading Settings — walkman configuration + practice mode
 * chooser (moved from WfLearnPracticePage). Persists walkman settings via
 * wfSettingsCenter (walkman section). Provides navigation back to the practice
 * word reader and to the settings hub. */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CircleCheck, Play, Headphones } from 'lucide-react';
import { Card, Icons, Button, BackButton, SectionTitle, Sheet } from '../WfUI';
import { useWfApp } from '../WfAppContext';
import { wfPath } from '../WfBottomTabNav';
import { wfSettingsCenter } from '../services/WfSettingsCenter';

interface ToggleCardProps {
  label: string;
  description?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  icon?: React.ReactNode;
}

const ToggleCard: React.FC<ToggleCardProps> = ({ label, description, value, onChange, icon }) => (
  <div className="ds-row w-full p-4 flex items-center justify-between gap-3">
    <div className="flex items-center gap-3 min-w-0">
      {icon && (
        <span className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm bg-[var(--klein-blue-soft)] text-[var(--klein-blue)] [&_svg]:w-5 [&_svg]:h-5">
          {icon}
        </span>
      )}
      <div className="min-w-0">
        <p className="font-semibold text-[var(--color-text-primary)] truncate">{label}</p>
        {description && <p className="text-sm text-[var(--color-text-secondary)] mt-0.5">{description}</p>}
      </div>
    </div>
    <button
      onClick={() => onChange(!value)}
      className="ds-touch-target w-12 h-7 rounded-full p-1 transition-colors flex-shrink-0"
      style={{ background: value ? 'var(--klein-gradient)' : 'var(--color-glass-border)' }}
      role="switch"
      aria-checked={value}
    >
      <div className={`w-5 h-5 bg-white rounded-full shadow-sm transform transition-transform ${value ? 'translate-x-5' : ''}`} />
    </button>
  </div>
);

const WfSettingsWordReadingPage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useWfApp();

  const [durationDelay, setDurationDelay] = useState(0.5);
  const [preDelay, setPreDelay] = useState(0.5);
  const [maxPlays, setMaxPlays] = useState(1);
  const [maxReview, setMaxReview] = useState(1);
  const [wordsPerPage, setWordsPerPage] = useState(100);
  const [showTranslation, setShowTranslation] = useState(false);
  const [fontSize, setFontSize] = useState(16);

  useEffect(() => {
    let alive = true;
    wfSettingsCenter.load().then((s) => {
      if (!alive) return;
      setDurationDelay(s.walkman.durationDelay);
      setPreDelay(s.walkman.preDelay);
      setMaxPlays(s.walkman.maxPlays);
      setMaxReview(s.walkman.maxReview);
      setWordsPerPage(s.walkman.wordsPerPage);
      setShowTranslation(s.walkman.showTranslation);
      setFontSize(s.walkman.fontSize);
    });
    return () => { alive = false; };
  }, []);

  const save = (patch: Record<string, any>) => {
    wfSettingsCenter.update({ walkman: patch });
  };

  const practiceModes = [
    { id: 'reading', title: 'Reading', subtitle: 'Flow in context', icon: <Icons.Book />, recommended: true },
    { id: 'flashcards', title: 'Flashcards', subtitle: 'Spaced repetition', icon: <Icons.Sparkles />, recommended: true },
    { id: 'quiz', title: 'Quiz', subtitle: 'Gamified test', icon: <CircleCheck className="w-7 h-7" aria-hidden />, recommended: false },
    { id: 'listening', title: 'Listening', subtitle: 'Passive audio loop', icon: <Icons.Sound />, recommended: false },
  ];

  return (
    <div className="min-h-screen pb-28">
      <div className="relative w-full max-w-md mx-auto px-[var(--page-padding-h)] pt-[var(--page-padding-v)] pb-[var(--space-breath)]">
        <div className="flex items-center gap-3 mb-2">
          <BackButton onClick={() => navigate(wfPath('settings'))} />
          <h1 className="text-[2rem] leading-[1.15] font-black tracking-tight text-[var(--color-text-primary)]">
            Word Reading
          </h1>
        </div>
        <p className="text-[var(--color-text-secondary)] pl-1">
          Configure word walkman and display preferences
        </p>
      </div>

      <div className="relative w-full max-w-md mx-auto px-[var(--page-padding-h)] ds-section-gap">
        {/* Walkman Settings */}
        <div className="ds-stack-tight flex flex-col">
          <SectionTitle title="Word Walkman" className="px-1 mb-1" />

          <div className="ds-row p-4">
            <label className="block mb-3 font-semibold text-[var(--color-text-primary)]">
              Playback Delay: <span className="text-[var(--klein-blue)]">{durationDelay}s</span>
            </label>
            <p className="text-sm text-[var(--color-text-secondary)] mb-3">
              Wait time after each word finishes playing before advancing to the next
            </p>
            <input
              type="range" min="0" max="3" step="0.1"
              value={durationDelay}
              onChange={(e) => { const v = parseFloat(e.target.value); setDurationDelay(v); save({ durationDelay: v }); }}
              className="w-full accent-[color:var(--klein-blue)]"
            />
          </div>

          <div className="ds-row p-4">
            <label className="block mb-3 font-semibold text-[var(--color-text-primary)]">
              Pre-delay: <span className="text-[var(--klein-blue)]">{preDelay}s</span>
            </label>
            <p className="text-sm text-[var(--color-text-secondary)] mb-3">
              Initial wait before the first word starts playing
            </p>
            <input
              type="range" min="0" max="3" step="0.1"
              value={preDelay}
              onChange={(e) => { const v = parseFloat(e.target.value); setPreDelay(v); save({ preDelay: v }); }}
              className="w-full accent-[color:var(--klein-blue)]"
            />
          </div>

          <div className="ds-row p-4">
            <label className="block mb-3 font-semibold text-[var(--color-text-primary)]">
              Plays per Word: <span className="text-[var(--klein-blue)]">{maxPlays}</span>
            </label>
            <p className="text-sm text-[var(--color-text-secondary)] mb-3">
              How many times each word is played during learning
            </p>
            <input
              type="range" min="1" max="5" step="1"
              value={maxPlays}
              onChange={(e) => { const v = parseInt(e.target.value, 10); setMaxPlays(v); save({ maxPlays: v }); }}
              className="w-full accent-[color:var(--klein-blue)]"
            />
          </div>

          <div className="ds-row p-4">
            <label className="block mb-3 font-semibold text-[var(--color-text-primary)]">
              Review Plays: <span className="text-[var(--klein-blue)]">{maxReview}</span>
            </label>
            <p className="text-sm text-[var(--color-text-secondary)] mb-3">
              Number of review plays after all words are learned on the page
            </p>
            <input
              type="range" min="0" max="5" step="1"
              value={maxReview}
              onChange={(e) => { const v = parseInt(e.target.value, 10); setMaxReview(v); save({ maxReview: v }); }}
              className="w-full accent-[color:var(--klein-blue)]"
            />
          </div>
        </div>

        {/* Display Settings */}
        <div className="ds-stack-tight flex flex-col">
          <SectionTitle title="Display" className="px-1 mb-1" />

          <ToggleCard
            label="Show Translation"
            description="Display word translations in the word list"
            value={showTranslation}
            onChange={(v) => { setShowTranslation(v); save({ showTranslation: v }); }}
            icon={
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
              </svg>
            }
          />

          <div className="ds-row p-4">
            <label className="block mb-3 font-semibold text-[var(--color-text-primary)]">
              Font Size: <span className="text-[var(--klein-blue)]">{fontSize}px</span>
            </label>
            <input
              type="range" min="12" max="24"
              value={fontSize}
              onChange={(e) => { const v = parseInt(e.target.value, 10); setFontSize(v); save({ fontSize: v }); }}
              className="w-full accent-[color:var(--klein-blue)]"
            />
          </div>

          <div className="ds-row p-4">
            <label className="block mb-3 font-semibold text-[var(--color-text-primary)]">Words Per Page</label>
            <div className="ds-pill-nav" role="tablist" aria-label="Words per page">
              {[50, 100, 200, 500].map((n) => (
                <button
                  key={n} type="button" role="tab" aria-selected={wordsPerPage === n}
                  onClick={() => { setWordsPerPage(n); save({ wordsPerPage: n }); }}
                  className={`ds-pill-chip ${wordsPerPage === n ? 'is-active' : ''}`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Practice Modes */}
        <div className="ds-stack-tight flex flex-col">
          <SectionTitle title="Practice Modes" className="px-1 mb-1" />
          {practiceModes.map((m) => (
            <div
              key={m.id}
              className="ds-row flex items-center gap-4 p-4 cursor-pointer group"
              onClick={() => navigate(wfPath(`learn/practice?mode=${m.id}`))}
            >
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 text-[color:var(--klein-blue)]"
                style={{ background: 'var(--klein-blue-soft)' }}
              >
                {m.icon}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-[var(--color-text-primary)] truncate group-hover:text-[var(--klein-blue)] transition-colors">
                  {m.title}
                </h3>
                <p className="text-sm text-[var(--color-text-secondary)]">{m.subtitle}</p>
              </div>
              <span className="text-[var(--color-text-tertiary)] group-hover:text-[var(--klein-blue)] transition-colors flex-shrink-0">
                <Icons.ChevronRight />
              </span>
            </div>
          ))}
        </div>

        {/* Info */}
        <Card>
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-[var(--klein-blue-soft)] text-[var(--klein-blue)] rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm">
              <Headphones className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-[var(--color-text-primary)] mb-1">Word Walkman</h3>
              <ul className="space-y-2 text-sm text-[var(--color-text-secondary)]">
                <li className="flex items-start gap-2">
                  <span className="text-[var(--klein-blue)]">*</span>
                  <span>Auto-plays words one by one with configurable delays</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[var(--klein-blue)]">*</span>
                  <span>Learning mode plays each word, then switches to review mode</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[var(--klein-blue)]">*</span>
                  <span>Uses TTS audio files when available, Web Speech API as fallback</span>
                </li>
              </ul>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default WfSettingsWordReadingPage;
