import React, { useState, useEffect } from 'react';
import { CheckCircle, ArrowRight, Loader2 } from 'lucide-react';
import { api } from '../../core/api';
import { commonClasses } from '../../styles/theme';

interface UserInitWizardProps {
  onComplete: () => void;
}

const UserInitWizard: React.FC<UserInitWizardProps> = ({ onComplete }) => {
  const [step, setStep] = useState(1);
  const [languages, setLanguages] = useState<any[]>([]);
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
  const [occupation, setOccupation] = useState('');
  const [dailyWordsTarget, setDailyWordsTarget] = useState(20);
  const [dailyStudyTime, setDailyStudyTime] = useState(30);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadLanguages();
  }, []);

  const loadLanguages = async () => {
    try {
      const response = await api.appQyV1.getSupportedLanguages();
      if (response.success && response.data) {
        setLanguages(response.data.languages || response.data);
      }
    } catch (err) {
      console.error('Failed to load languages:', err);
    }
  };

  const handleComplete = async () => {
    if (selectedLanguages.length === 0) {
      setError('Please select at least one language');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await api.appQyV1.completeUserInit({
        learning_languages: selectedLanguages,
        occupation,
        daily_words_target: dailyWordsTarget,
        daily_study_time: dailyStudyTime,
        preferences: {}
      });

      if (response.success) {
        onComplete();
      } else {
        setError(response.error || 'Initialization failed');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to complete initialization');
    } finally {
      setLoading(false);
    }
  };

  const toggleLanguage = (code: string) => {
    setSelectedLanguages(prev =>
      prev.includes(code)
        ? prev.filter(l => l !== code)
        : [...prev, code]
    );
  };

  return (
    <div className={`${commonClasses.card} p-6 max-w-2xl mx-auto`}>
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          {[1, 2, 3].map(s => (
            <div
              key={s}
              className={`flex items-center ${s < 3 ? 'flex-1' : ''}`}
            >
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                  step >= s
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-200 dark:bg-slate-700 text-slate-500'
                }`}
              >
                {s < step ? <CheckCircle className="w-5 h-5" /> : s}
              </div>
              {s < 3 && (
                <div
                  className={`h-1 flex-1 mx-2 ${
                    step > s ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-slate-700'
                  }`}
                />
              )}
            </div>
          ))}
        </div>
        <div className="flex justify-between text-xs text-slate-500">
          <span>Languages</span>
          <span>Goals</span>
          <span>Preferences</span>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded text-sm">
          {error}
        </div>
      )}

      {step === 1 && (
        <div>
          <h2 className="text-2xl font-bold mb-2">Select Learning Languages</h2>
          <p className="text-sm text-slate-500 mb-6">
            Choose the languages you want to learn
          </p>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
            {languages.map(lang => (
              <button
                key={lang.code}
                onClick={() => toggleLanguage(lang.code)}
                className={`p-4 rounded-lg border-2 transition-colors ${
                  selectedLanguages.includes(lang.code)
                    ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20'
                    : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
                }`}
              >
                <div className="font-semibold">{lang.native_name}</div>
                <div className="text-xs text-slate-500">{lang.name}</div>
              </button>
            ))}
          </div>

          <button
            onClick={() => setStep(2)}
            disabled={selectedLanguages.length === 0}
            className={`${commonClasses.button} ${commonClasses.buttonPrimary} w-full flex items-center justify-center gap-2`}
          >
            Continue
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {step === 2 && (
        <div>
          <h2 className="text-2xl font-bold mb-2">Set Your Goals</h2>
          <p className="text-sm text-slate-500 mb-6">
            Define your learning targets
          </p>

          <div className="space-y-6 mb-6">
            <div>
              <label className="block text-sm font-medium mb-2">
                Daily Words Target: {dailyWordsTarget}
              </label>
              <input
                type="range"
                min="5"
                max="100"
                step="5"
                value={dailyWordsTarget}
                onChange={(e) => setDailyWordsTarget(parseInt(e.target.value))}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-slate-500 mt-1">
                <span>5 words</span>
                <span>100 words</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Daily Study Time: {dailyStudyTime} minutes
              </label>
              <input
                type="range"
                min="10"
                max="120"
                step="10"
                value={dailyStudyTime}
                onChange={(e) => setDailyStudyTime(parseInt(e.target.value))}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-slate-500 mt-1">
                <span>10 min</span>
                <span>120 min</span>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setStep(1)}
              className={`${commonClasses.button} ${commonClasses.buttonSecondary}`}
            >
              Back
            </button>
            <button
              onClick={() => setStep(3)}
              className={`${commonClasses.button} ${commonClasses.buttonPrimary} flex-1 flex items-center justify-center gap-2`}
            >
              Continue
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div>
          <h2 className="text-2xl font-bold mb-2">Additional Information</h2>
          <p className="text-sm text-slate-500 mb-6">
            Help us personalize your experience
          </p>

          <div className="space-y-4 mb-6">
            <div>
              <label className="block text-sm font-medium mb-2">
                Occupation (Optional)
              </label>
              <input
                type="text"
                value={occupation}
                onChange={(e) => setOccupation(e.target.value)}
                placeholder="e.g., Student, Developer, Teacher"
                className={commonClasses.input}
              />
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setStep(2)}
              className={`${commonClasses.button} ${commonClasses.buttonSecondary}`}
            >
              Back
            </button>
            <button
              onClick={handleComplete}
              disabled={loading}
              className={`${commonClasses.button} ${commonClasses.buttonPrimary} flex-1 flex items-center justify-center gap-2`}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Completing Setup...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Complete Setup
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserInitWizard;
