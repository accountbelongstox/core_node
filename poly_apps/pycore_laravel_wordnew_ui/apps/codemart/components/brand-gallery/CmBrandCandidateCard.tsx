import React from 'react';
import { Check, Download } from 'lucide-react';
import { useTranslation } from '../../../../core/i18n/UiI18n';
import { CmBrandCompare } from './CmBrandCompare';
import { CmBrandForms } from './CmBrandForms';
import { CM_BRAND_FORMS, cmBrandCandidateUrl, type CmBrandCandidate, type CmBrandManifest } from './cmBrandGalleryData';

export interface CmBrandCandidateCardProps {
  candidate: CmBrandCandidate;
  manifest: CmBrandManifest;
  sourceUrl: string;
  isDefault: boolean;
  picked: boolean;
  onPick: (id: string) => void;
}

function formatScore(value: number): string {
  return value.toFixed(4);
}

function formatDate(value: string, language: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(language, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

export const CmBrandCandidateCard: React.FC<CmBrandCandidateCardProps> = ({ candidate, manifest, sourceUrl, isDefault, picked, onPick }) => {
  const { t, i18n } = useTranslation('cm');
  const unavailable = candidate.status !== 'ok';
  const files = CM_BRAND_FORMS.flatMap((form) => Object.entries(candidate.files[form] ?? {}).map(([variant, file]) => ({ form, variant, file })));

  return (
    <article id={`cand-${candidate.id}`} className={`cm-brand-card ${isDefault ? 'is-default' : ''} ${picked ? 'is-picked' : ''}`}>
      <header className="cm-brand-card__head">
        <div>
          <h3><code>{candidate.id}</code></h3>
          <p className="cm-brand-gallery__muted">{candidate.note}</p>
        </div>
        <div className="cm-brand-card__badges">
          {isDefault && <span className="cm-brand-badge cm-brand-badge--default">{t('brandGallery.badgeDefault')}</span>}
          {picked && <span className="cm-brand-badge cm-brand-badge--picked">{t('brandGallery.badgePicked')}</span>}
          {unavailable && <span className="cm-brand-badge cm-brand-badge--muted">{t('brandGallery.unavailable')}</span>}
        </div>
      </header>

      <dl className="cm-brand-card__meta">
        <div><dt>{t('brandGallery.score')}</dt><dd>{candidate.score ? formatScore(candidate.score.score) : t('brandGallery.notScored')}</dd></div>
        {candidate.score && <div><dt>{t('brandGallery.iou')}</dt><dd>{formatScore(candidate.score.iou)}</dd></div>}
        {candidate.score && <div><dt>{t('brandGallery.ssim')}</dt><dd>{formatScore(candidate.score.ssim)}</dd></div>}
        <div><dt>{t('brandGallery.tool')}</dt><dd>{candidate.tool}</dd></div>
        <div><dt>{t('brandGallery.created')}</dt><dd>{formatDate(candidate.created_at, i18n.language)}</dd></div>
      </dl>

      {unavailable ? null : (
        <>
          <section className="cm-brand-card__section">
            <h4>{t('brandGallery.compareTitle')}</h4>
            {candidate.kind === 'raster' && <p className="cm-brand-gallery__muted">{t('brandGallery.rasterNote')}</p>}
            <CmBrandCompare candidate={candidate} manifest={manifest} sourceUrl={sourceUrl} />
          </section>
          <section className="cm-brand-card__section">
            <h4>{t('brandGallery.formsTitle')}</h4>
            <CmBrandForms candidate={candidate} manifest={manifest} />
          </section>
          <section className="cm-brand-card__section">
            <h4>{t('brandGallery.filesTitle')}</h4>
            <ul className="cm-brand-card__files">
              {files.map(({ form, variant, file }) => {
                const url = cmBrandCandidateUrl(candidate.id, file);
                return url ? (
                  <li key={`${form}-${variant}`}>
                    <a href={url} download={`${candidate.id}-${file}`}><Download aria-hidden="true" />{file}</a>
                  </li>
                ) : null;
              })}
            </ul>
          </section>
          <footer className="cm-brand-card__foot">
            <button type="button" className={`cm-brand-pick ${picked ? 'is-picked' : ''}`} aria-pressed={picked} onClick={() => onPick(picked ? '' : candidate.id)}>
              {picked && <Check aria-hidden="true" />}
              {t(picked ? 'brandGallery.pickedButton' : 'brandGallery.pickButton')}
            </button>
          </footer>
        </>
      )}
    </article>
  );
};

export default CmBrandCandidateCard;
