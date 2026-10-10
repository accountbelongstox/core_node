import React, { useState } from 'react';
import { Copy, X } from 'lucide-react';
import { useTranslation } from '../../../core/i18n/UiI18n';
import { CmBrandCandidateCard } from '../components/brand-gallery/CmBrandCandidateCard';
import {
  cmBrandSourceUrl,
  groupCandidates,
  useCmBrandManifest,
  useCmBrandPick,
  type CmBrandManifest,
} from '../components/brand-gallery/cmBrandGalleryData';
import { CmPublicPage } from '../components/public-home/CmPublicPage';
import '../styles/cm-brand-gallery.css';

const COPIED_RESET_MS = 1800;

const CmBrandPickPanel: React.FC<{ pick: string; setPick: (id: string) => void }> = ({ pick, setPick }) => {
  const { t } = useTranslation('cm');
  const [copied, setCopied] = useState(false);

  const copy = (): void => {
    navigator.clipboard?.writeText(pick).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), COPIED_RESET_MS);
    }).catch(() => undefined);
  };

  return (
    <section className="cm-brand-panel" aria-labelledby="cm-brand-pick-title">
      <h2 id="cm-brand-pick-title">{t('brandGallery.pickTitle')}</h2>
      {pick ? (
        <>
          <p className="cm-brand-pick-id"><code>{pick}</code></p>
          <div className="cm-brand-panel__actions">
            <button type="button" onClick={copy}><Copy aria-hidden="true" />{t(copied ? 'brandGallery.pickCopied' : 'brandGallery.pickCopy')}</button>
            <button type="button" onClick={() => setPick('')}><X aria-hidden="true" />{t('brandGallery.pickClear')}</button>
          </div>
        </>
      ) : (
        <p className="cm-brand-gallery__muted">{t('brandGallery.pickNone')}</p>
      )}
      <p className="cm-brand-gallery__muted">{t('brandGallery.pickHint')}</p>
    </section>
  );
};

const CmBrandGalleryBody: React.FC<{ manifest: CmBrandManifest }> = ({ manifest }) => {
  const { t } = useTranslation('cm');
  const { pick, setPick } = useCmBrandPick();
  const sourceUrl = cmBrandSourceUrl(manifest) ?? '';
  const ranked = manifest.ranking
    .map((id) => manifest.candidates.find((candidate) => candidate.id === id))
    .filter((candidate): candidate is NonNullable<typeof candidate> => Boolean(candidate && candidate.score));

  return (
    <>
      <div className="cm-brand-top">
        <section className="cm-brand-panel" aria-labelledby="cm-brand-source-title">
          <h2 id="cm-brand-source-title">{t('brandGallery.sourceTitle')}</h2>
          <div className="cm-brand-source"><img src={sourceUrl} alt={t('brandGallery.sourceTitle')} width={manifest.source.width} height={manifest.source.height} /></div>
          <p className="cm-brand-gallery__muted">{t('brandGallery.sourceCaption', { width: manifest.source.width, height: manifest.source.height })}</p>
        </section>
        <CmBrandPickPanel pick={pick} setPick={setPick} />
      </div>

      <section className="cm-brand-panel" aria-labelledby="cm-brand-ranking-title">
        <h2 id="cm-brand-ranking-title">{t('brandGallery.rankingTitle')}</h2>
        <p className="cm-brand-gallery__muted">{t('brandGallery.rankingHint')}</p>
        <ol className="cm-brand-ranking">
          {ranked.map((candidate) => (
            <li key={candidate.id}>
              <a href={`#cand-${candidate.id}`}><code>{candidate.id}</code></a>
              <span className="cm-brand-ranking__bar"><i style={{ width: `${Math.round((candidate.score?.score ?? 0) * 100)}%` }} /></span>
              <b>{candidate.score?.score.toFixed(4)}</b>
              {candidate.id === manifest.default && <span className="cm-brand-badge cm-brand-badge--default">{t('brandGallery.badgeDefault')}</span>}
            </li>
          ))}
        </ol>
      </section>

      {groupCandidates(manifest.candidates).map((group) => (
        <section key={group.method} className="cm-brand-group" aria-labelledby={`cm-brand-group-${group.method}`}>
          <h2 id={`cm-brand-group-${group.method}`}>{t(`brandGallery.methodGroup.${group.method}`)}</h2>
          {group.rounds.map((round) => (
            <div key={round.round} className="cm-brand-round">
              <h3 className="cm-brand-round__title">{t('brandGallery.round', { round: round.round })}</h3>
              <div className="cm-brand-round__grid">
                {round.items.map((candidate) => (
                  <CmBrandCandidateCard
                    key={candidate.id}
                    candidate={candidate}
                    manifest={manifest}
                    sourceUrl={sourceUrl}
                    isDefault={candidate.id === manifest.default}
                    picked={candidate.id === pick}
                    onPick={setPick}
                  />
                ))}
              </div>
            </div>
          ))}
        </section>
      ))}
    </>
  );
};

const CmBrandGalleryPage: React.FC = () => {
  const { t } = useTranslation('cm');
  const { manifest, loading, failed, reload } = useCmBrandManifest();

  return (
    <CmPublicPage
      titleKey="brandGallery.title"
      descriptionKey="brandGallery.description"
      eyebrow={t('brandGallery.eyebrow')}
      lead={t('brandGallery.lead')}
      className="cm-brand-gallery"
    >
      <div className="cm-public-container cm-brand-gallery__body">
        {loading && <p className="cm-public-page__status" role="status">{t('brandGallery.loading')}</p>}
        {!loading && failed && (
          <div className="cm-public-page__status" role="alert">
            <p>{t('brandGallery.loadFailed')}</p>
            <button type="button" className="cm-brand-pick" onClick={reload}>{t('brandGallery.retry')}</button>
          </div>
        )}
        {!loading && !failed && manifest && manifest.candidates.length === 0 && <p className="cm-public-page__status">{t('brandGallery.empty')}</p>}
        {!loading && !failed && manifest && manifest.candidates.length > 0 && <CmBrandGalleryBody manifest={manifest} />}
      </div>
    </CmPublicPage>
  );
};

export default CmBrandGalleryPage;
