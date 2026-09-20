import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Calculator } from 'lucide-react';
import { useTranslation } from '../../../core/i18n/UiI18n';
import { cmApi } from '../api/CmApi';
import type { CmEstimateResult } from '../api/CmApiTypes';
import { CmChromeControls } from '../components/CmChromeControls';
import { CmBrand } from '../components/CmBrand';

const COMPLEXITIES = ['simple', 'medium', 'complex', 'very_complex'] as const;

/**
 * Public project-estimate page. Inputs are posted to Laravel, which owns the
 * rates and policy; the browser only renders the returned ranges.
 */
export const CmEstimatePage: React.FC = () => {
  const { t } = useTranslation('cm');
  const [complexity, setComplexity] = useState<string>('medium');
  const [platforms, setPlatforms] = useState(1);
  const [features, setFeatures] = useState(5);
  const [result, setResult] = useState<CmEstimateResult | null>(null);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  const runEstimate = useCallback(async (nextComplexity: string, nextPlatforms: number, nextFeatures: number) => {
    setPending(true);
    setFailed(false);
    const response = await cmApi.estimate({
      complexity: nextComplexity,
      platforms: nextPlatforms,
      features: nextFeatures,
    });
    if (response.success && response.data) {
      setResult(response.data);
    } else {
      setFailed(true);
    }
    setPending(false);
  }, []);

  useEffect(() => {
    void runEstimate(complexity, platforms, features);
    // Only the initial estimate runs on mount; further changes are explicit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="cm-info-page cm-estimate-page">
      <header className="cm-info-page__header">
        <div className="cm-info-page__header-inner">
          <Link to="/codemart" aria-label={t('brand.name')}><CmBrand /></Link>
          <CmChromeControls />
        </div>
      </header>
      <div className="cm-info-page__body">
        <Link to="/codemart" className="cm-info-page__back">
          <ArrowLeft aria-hidden="true" /> {t('common.backHome')}
        </Link>
        <h1>{t('estimate.title')}</h1>
        <p className="cm-info-page__lead">{t('estimate.lead')}</p>

        <form
          className="cm-estimate-form"
          onSubmit={(event) => {
            event.preventDefault();
            void runEstimate(complexity, platforms, features);
          }}
        >
          <label>
            <span>{t('estimate.complexity')}</span>
            <select value={complexity} onChange={(event) => setComplexity(event.target.value)}>
              {COMPLEXITIES.map((value) => (
                <option key={value} value={value}>{t(`estimate.complexities.${value}`)}</option>
              ))}
            </select>
          </label>
          <label>
            <span>{t('estimate.platforms')}</span>
            <input
              type="number"
              min={1}
              max={6}
              value={platforms}
              onChange={(event) => setPlatforms(Math.max(1, Math.min(6, Number(event.target.value) || 1)))}
            />
          </label>
          <label>
            <span>{t('estimate.features')}</span>
            <input
              type="number"
              min={1}
              max={50}
              value={features}
              onChange={(event) => setFeatures(Math.max(1, Math.min(50, Number(event.target.value) || 1)))}
            />
          </label>
          <button type="submit" className="cm-estimate-submit" disabled={pending}>
            <Calculator aria-hidden="true" />
            {pending ? t('common.loading') : t('estimate.calculate')}
          </button>
        </form>

        {failed && <p className="cm-estimate-error">{t('estimate.failed')}</p>}

        {result && !failed && (
          <section className="cm-estimate-result" aria-live="polite">
            <div className="cm-estimate-result__row">
              <span>{t('estimate.costRange')}</span>
              <strong>{result.currency} {result.estimated_cost_min} – {result.estimated_cost_max}</strong>
            </div>
            <div className="cm-estimate-result__row">
              <span>{t('estimate.durationRange')}</span>
              <strong>{t('estimate.weeks', { min: result.estimated_duration_weeks_min, max: result.estimated_duration_weeks_max })}</strong>
            </div>
            <div className="cm-estimate-result__row">
              <span>{t('estimate.effortRange')}</span>
              <strong>{t('estimate.hours', { min: result.estimated_hours_min, max: result.estimated_hours_max })}</strong>
            </div>
            <div className="cm-estimate-result__row">
              <span>{t('estimate.team')}</span>
              <strong>{result.recommended_team.map((role) => t(`estimate.roles.${role}`)).join(', ')}</strong>
            </div>
            <p className="cm-estimate-result__note">{t('estimate.note')}</p>
            <Link to="/codemart/projects/new" className="cm-estimate-result__cta">{t('estimate.startProject')}</Link>
          </section>
        )}
      </div>
    </main>
  );
};

export default CmEstimatePage;
