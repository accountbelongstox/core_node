import React, { useEffect, useMemo, useState } from 'react';
import { Apple, ArrowDownToLine, MonitorSmartphone, Smartphone } from 'lucide-react';
import { useTranslation } from '../../../core/i18n/UiI18n';
import {
  CM_APP_FALLBACK_VERSION,
  CM_APP_MIN_OS_KEYS,
  detectMobilePlatform,
  type CmAppPlatform,
} from '../cmAppDownloads';
import { cmPublicApi, type CmAppDownloadEntry } from '../api/CmPublicApi';
import { CmPublicSection, CmPublicSplit } from '../components/public-home/CmPublicBlocks';
import { CmPublicPage } from '../components/public-home/CmPublicPage';
import { CM_PROTECTED_ROUTE } from '../components/public-home/cmPublicRoutes';

const APP_FEATURES = ['projects', 'tasks', 'wallet', 'notifications'];

const PlatformIcon: React.FC<{ platform: CmAppPlatform }> = ({ platform }) => (
  platform === 'ios' ? <Apple aria-hidden="true" /> : <Smartphone aria-hidden="true" />
);

const DownloadCard: React.FC<{ download: CmAppDownloadEntry; highlighted: boolean }> = ({ download, highlighted }) => {
  const { t } = useTranslation('cm');
  return (
    <article className={`cm-download-card ${highlighted ? 'is-highlighted' : ''}`}>
      <span className="cm-download-card__icon"><PlatformIcon platform={download.platform} /></span>
      <h3>{t(`downloadPage.platforms.${download.platform}`)}</h3>
      <dl>
        <div>
          <dt>{t('downloadPage.versionLabel')}</dt>
          <dd>{download.version || CM_APP_FALLBACK_VERSION}</dd>
        </div>
        <div>
          <dt>{t('downloadPage.requirementLabel')}</dt>
          <dd>{t(CM_APP_MIN_OS_KEYS[download.platform])}</dd>
        </div>
      </dl>
      <a
        className="cm-public-button cm-public-button--primary cm-download-card__action"
        href={download.url}
        target="_blank"
        rel="noopener noreferrer"
      >
        <ArrowDownToLine aria-hidden="true" />
        {t('downloadPage.downloadAction')}
      </a>
    </article>
  );
};

/**
 * Public mobile-app download page. The published package list comes from the
 * server; when nothing is published the page shows a plain notice and never
 * probes artifact URLs. Auto-detects the visitor's OS to promote the
 * matching package.
 */
const CmDownloadPage: React.FC = () => {
  const { t } = useTranslation('cm');
  const detected = useMemo(detectMobilePlatform, []);
  const [downloads, setDownloads] = useState<CmAppDownloadEntry[] | null>(null);

  useEffect(() => {
    let active = true;
    void cmPublicApi.getAppDownloads().then((response) => {
      if (active) setDownloads(response.success && response.data ? response.data : []);
    });
    return () => {
      active = false;
    };
  }, []);

  const platforms = downloads ?? [];
  const highlighted = detected && platforms.some((entry) => entry.platform === detected)
    ? detected
    : platforms[0]?.platform ?? null;
  const featured = highlighted ? platforms.find((entry) => entry.platform === highlighted) ?? null : null;
  const subtitle = detected ? t(`downloadPage.detected.${detected}`) : t('downloadPage.detected.unknown');

  return (
    <CmPublicPage
      titleKey="downloadPage.title"
      descriptionKey="downloadPage.metaDescription"
      className="cm-download-page"
      eyebrow={<><MonitorSmartphone aria-hidden="true" /> {t('downloadPage.eyebrow')}</>}
      lead={subtitle}
    >
      {downloads === null && <p className="cm-public-page__status" role="status">{t('downloadPage.checking')}</p>}
      {downloads !== null && platforms.length === 0 && (
        <div className="cm-public-container">
          <p className="cm-public-form__notice cm-download-none" role="status">{t('downloadPage.noneAvailable')}</p>
        </div>
      )}
      {featured && (
        <section className="cm-download-featured">
          <div className="cm-public-container cm-download-hero__featured">
            <DownloadCard download={featured} highlighted />
          </div>
        </section>
      )}
      {platforms.length > 1 && (
        <section className="cm-download-all">
          <div className="cm-public-container">
            <h2>{t('downloadPage.allPlatformsTitle')}</h2>
            <div className="cm-download-all__grid">
              {platforms.map((entry) => (
                <DownloadCard key={entry.platform} download={entry} highlighted={entry.platform === highlighted} />
              ))}
            </div>
          </div>
        </section>
      )}
      <CmPublicSection tone="muted">
        <CmPublicSplit
          image="download-devices"
          eyebrowKey="downloadPage.features.eyebrow"
          titleKey="downloadPage.features.title"
          bodyKeys={['downloadPage.features.body']}
          pointKeys={APP_FEATURES.map((id) => `downloadPage.features.items.${id}`)}
          action={{ to: CM_PROTECTED_ROUTE.dashboard, labelKey: 'downloadPage.features.webAction' }}
        />
      </CmPublicSection>
    </CmPublicPage>
  );
};

export default CmDownloadPage;
