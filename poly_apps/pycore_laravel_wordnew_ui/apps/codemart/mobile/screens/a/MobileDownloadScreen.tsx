import React from 'react';
import { Apple, ArrowDownToLine, MonitorSmartphone, Smartphone } from 'lucide-react';
import { useTranslation } from '../../../../../core/i18n/UiI18n';
import type { CmAppDownloadEntry } from '../../../api/CmPublicApi';
import { CM_APP_FALLBACK_VERSION, CM_APP_MIN_OS_KEYS, type CmAppPlatform } from '../../../cmAppDownloads';
import { CM_PROTECTED_ROUTE } from '../../../components/public-home/cmPublicRoutes';
import { useCmAppDownloads } from '../../../shared/useCmAppDownloads';
import { MobileCard, MobileList, MobileListRow, MobileNotice, MobileScreen, MobileSkeletonBlock } from '../../ui';
import { MobileBlock, MobilePageHead } from './MobilePublicParts';

const APP_FEATURES = ['projects', 'tasks', 'wallet', 'notifications'];

const PlatformIcon: React.FC<{ platform: CmAppPlatform }> = ({ platform }) => (
  platform === 'ios' ? <Apple aria-hidden="true" /> : <Smartphone aria-hidden="true" />
);

const DownloadCard: React.FC<{ download: CmAppDownloadEntry; highlighted: boolean }> = ({ download, highlighted }) => {
  const { t } = useTranslation('cm');
  return (
    <MobileCard className={`cmm-a-download ${highlighted ? 'is-highlighted' : ''}`}>
      <span className="cmm-a-download__icon"><PlatformIcon platform={download.platform} /></span>
      <div>
        <h3>{t(`downloadPage.platforms.${download.platform}`)}</h3>
        <p>
          {t('downloadPage.versionLabel')} {download.version || CM_APP_FALLBACK_VERSION}
          {download.min_os ? ` · ${t(CM_APP_MIN_OS_KEYS[download.platform], { version: download.min_os })}` : ''}
        </p>
      </div>
      <a className="cmm-btn is-primary is-small" href={download.url} target="_blank" rel="noopener noreferrer">
        <ArrowDownToLine aria-hidden="true" /><span>{t('downloadPage.downloadAction')}</span>
      </a>
    </MobileCard>
  );
};

/** Mobile app download: the published packages with the visitor's platform first. */
const MobileDownloadScreen: React.FC = () => {
  const { t } = useTranslation('cm');
  const { downloads, detected, highlighted, featured } = useCmAppDownloads();
  const others = (downloads ?? []).filter((entry) => entry.platform !== featured?.platform);

  return (
    <MobileScreen>
      <MobilePageHead
        titleKey="downloadPage.title"
        leadKey="downloadPage.metaDescription"
        title={t('downloadPage.title')}
        lead={detected ? t(`downloadPage.detected.${detected}`) : t('downloadPage.detected.unknown')}
        icon={<MonitorSmartphone aria-hidden="true" />}
        eyebrow={t('downloadPage.eyebrow')}
      />
      {downloads === null && <MobileSkeletonBlock height={96} />}
      {downloads !== null && downloads.length === 0 && <MobileNotice>{t('downloadPage.noneAvailable')}</MobileNotice>}
      {featured && <DownloadCard download={featured} highlighted />}
      {others.length > 0 && (
        <MobileBlock title={t('downloadPage.allPlatformsTitle')}>
          <div className="cmm-a-stack">
            {others.map((entry) => <DownloadCard key={entry.platform} download={entry} highlighted={entry.platform === highlighted} />)}
          </div>
        </MobileBlock>
      )}
      <MobileBlock title={t('downloadPage.features.title')} lead={t('downloadPage.features.body')}>
        <MobileList>
          {APP_FEATURES.map((id) => <MobileListRow key={id} title={t(`downloadPage.features.items.${id}`)} />)}
        </MobileList>
      </MobileBlock>
      <MobileList><MobileListRow to={CM_PROTECTED_ROUTE.dashboard} title={t('downloadPage.features.webAction')} /></MobileList>
    </MobileScreen>
  );
};

export default MobileDownloadScreen;
