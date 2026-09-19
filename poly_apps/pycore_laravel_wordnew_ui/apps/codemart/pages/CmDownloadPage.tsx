import React, { useMemo } from 'react';
import { Apple, ArrowDownToLine, MonitorSmartphone, Smartphone } from 'lucide-react';
import { useTranslation } from '../../../core/i18n/UiI18n';
import { CM_APP_DOWNLOADS, detectMobilePlatform, type CmAppDownload, type CmAppPlatform } from '../cmAppDownloads';
import { CmPublicFooter } from '../components/public-home/CmPublicFooter';
import { CmPublicHeader } from '../components/public-home/CmPublicHeader';

const PLATFORM_ORDER: CmAppPlatform[] = ['android', 'ios'];

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
 * the matching app to the hero slot; both platforms stay listed below.
 */
const CmDownloadPage: React.FC = () => {
  const { t } = useTranslation('cm');
  const detected = useMemo(detectMobilePlatform, []);
  const highlighted = detected ?? 'android';

  return (
    <div className="cm-public-home cm-download-page" data-end="codemart">
      <CmPublicHeader />
      <main>
        <section className="cm-download-hero">
          <div className="cm-public-container">
            <p className="cm-download-hero__eyebrow">
              <MonitorSmartphone aria-hidden="true" /> {t('downloadPage.eyebrow')}
            </p>
            <h1>{t('downloadPage.title')}</h1>
            <p className="cm-download-hero__subtitle">
              {detected
                ? t(`downloadPage.detected.${detected}`)
                : t('downloadPage.detected.unknown')}
            </p>
            <div className="cm-download-hero__featured">
              <DownloadCard download={CM_APP_DOWNLOADS[highlighted]} highlighted />
            </div>
          </div>
        </section>
        <section className="cm-download-all">
          <div className="cm-public-container">
            <h2>{t('downloadPage.allPlatformsTitle')}</h2>
            <div className="cm-download-all__grid">
              {PLATFORM_ORDER.map((platform) => (
                <DownloadCard
                  key={platform}
                  download={CM_APP_DOWNLOADS[platform]}
                  highlighted={platform === highlighted}
                />
              ))}
            </div>
          </div>
        </section>
      </main>
      <CmPublicFooter />
    </div>
  );
};

export default CmDownloadPage;
