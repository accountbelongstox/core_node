import React from 'react';
import { useTranslation } from '../../../core/i18n/UiI18n';
import { cmIcon, cmImage, type CmIconName, type CmImageAsset, type CmImageName } from '../assets/cmImageRegistry';

const ICON_CLASS_NAME = 'cm-icon';

interface CmAssetImageProps {
  asset: CmImageAsset | null;
  className?: string;
  eager?: boolean;
  size?: number;
  decorative?: boolean;
}

const CmAssetImage: React.FC<CmAssetImageProps> = ({ asset, className, eager, size, decorative = false }) => {
  const { t } = useTranslation('cm');
  if (!asset) return null;
  const lazy = eager === undefined ? asset.lazy : !eager;
  return (
    <img
      className={className}
      src={asset.src}
      width={size ?? asset.width}
      height={size ?? asset.height}
      alt={!decorative && asset.altKey ? t(asset.altKey) : ''}
      loading={lazy ? 'lazy' : 'eager'}
      decoding="async"
    />
  );
};

export interface CmImageProps {
  name: CmImageName;
  className?: string;
  eager?: boolean;
}

export const CmImage: React.FC<CmImageProps> = ({ name, className, eager }) => (
  <CmAssetImage asset={cmImage(name)} className={className} eager={eager} />
);

export interface CmIconProps {
  name: CmIconName;
  size: number;
  decorative?: boolean;
}

export const CmIcon: React.FC<CmIconProps> = ({ name, size, decorative }) => (
  <CmAssetImage asset={cmIcon(name)} className={ICON_CLASS_NAME} size={size} decorative={decorative} />
);

export default CmImage;
