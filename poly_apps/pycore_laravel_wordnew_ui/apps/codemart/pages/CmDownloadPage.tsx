import React, { useEffect, useMemo, useState } from 'react';
import { Apple, ArrowDownToLine, MonitorSmartphone, Smartphone } from 'lucide-react';
import { useTranslation } from '../../../core/i18n/UiI18n';
import {
  CM_APP_DOWNLOADS,
  detectMobilePlatform,
  isCmDownloadReachable,
  type CmAppDownload,
  type CmAppPlatform,
} from '../cmAppDownloads';
import { CmPublicSection, CmPublicSplit } from '../components/public-home/CmPublicBlocks';
import { CmPublicPage } from '../components/public-home/CmPublicPage';
import { CM_PROTECTED_ROUTE } from '../components/public-home/cmPublicRoutes';

const PLATFORM_ORDER: CmAppPlatform[] = ['android', 'ios'];
const APP_FEATURES = ['projects', 'tasks', 'wallet', 'notifications'];

const PlatformIcon: React.FC<{ platform: CmAppPlatform }> = ({ platform }) => (
  platform === 'ios' ? <Apple aria-hidden="true" /> : <Smartphone aria-hidden="true" />
);

const DownloadCard: React.FC<{ download: CmAppDownload; highlighted: boolean }> = ({ download, highlighted }) => {
  const { t } = useTranslation('cm');
  return (
    <article className={`cm-download-card ${highlighted ? 'is-highlighted' : ''}`}>
      <span className="cm-download-card__icon"><PlatformIcon platform={download.platform} /></span>
      <h3>{t(`downloadPage.platforms.${download.platform}`)}</h3>
      <dl>
        <div>
          <dt>{t('downloadPage.versionLabel')}</dt>
          <dd>{download.version}</dd>
        </div>
        <div>
          <dt>{t('downloadPage.requirementLabel')}</dt>
          <dd>{t(download.minOsKey)}</dd>
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
 * Public mobile-app download page. Auto-detects the visitor's OS and promotes
 * the matching app; packages whose artifact is not configured or not
 * reachable are hidden.
 */
const CmDownloadPage: React.FC = () => {
  const { t } = useTranslation('cm');
  const detected = useMemo(detectMobilePlatform, []);
  const [available, setAvailable] = useState<CmAppPlatform[] | null>(null);

  useEffect(() => {
    let active = true;
    void Promise.all(PLATFORM_ORDER.map(async (platform) => (
      (await isCmDownloadReachable(CM_APP_DOWNLOADS[platform].url)) ? platform : null
    ))).then((results) => {
      if (active) setAvailable(results.filter((platform): platform is CmAppPlatform => platform !== null));
    });
    return () => {
      active = false;
    };
  }, []);

  const platforms = available ?? [];
  const highlighted = detected && platforms.includes(detected) ? detected : platforms[0] ?? null;
  const subtitle = detected ? t(`downloadPage.detected.${detected}`) : t('downloadPage.detected.unknown');

  return (
    <CmPublicPage
      titleKey="downloadPage.title"
      descriptionKey="downloadPage.metaDescription"
      className="cm-download-page"
      eyebrow={<><MonitorSmartphone aria-hidden="true" /> {t('downloadPage.eyebrow')}</>}
      lead={subtitle}
    >
      {available === null && <p className="cm-public-page__status" role="status">{t('downloadPage.checking')}</p>}
      {available !== null && platforms.length === 0 && (
        <div className="cm-public-container">
          <p className="cm-public-form__notice cm-download-none" role="status">{t('downloadPage.noneAvailable')}</p>
        </div>
      )}
      {highlighted && (
        <section className="cm-download-featured">
          <div className="cm-public-container cm-download-hero__featured">
            <DownloadCard download={CM_APP_DOWNLOADS[highlighted]} highlighted />
          </div>
        </section>
      )}
      {platforms.length > 1 && (
        <section className="cm-download-all">
          <div className="cm-public-container">
            <h2>{t('downloadPage.allPlatformsTitle')}</h2>
            <div className="cm-download-all__grid">
              {platforms.map((platform) => (
                <DownloadCard key={platform} download={CM_APP_DOWNLOADS[platform]} highlighted={platform === highlighted} />
              ))}
            </div>
          </div>
        </section>
      )}
      <CmPublicSection tone="muted">
        <CmPublicSplit
          image="download-devices"
          altKey="downloadPage.features.alt"
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
