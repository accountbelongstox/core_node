import React from 'react';
import { useTranslation } from '../../../core/i18n/UiI18n';
import { cmImage, type CmImageName } from '../assets/cmImageRegistry';

export interface CmImageProps {
  name: CmImageName;
  className?: string;
  /** Overrides the registry loading hint for this placement. */
  eager?: boolean;
}

/** Registry image with its localized alt text (empty when decorative), intrinsic size and loading hint. */
export const CmImage: React.FC<CmImageProps> = ({ name, className, eager }) => {
  const { t } = useTranslation('cm');
  const image = cmImage(name);
  if (!image) return null;
  const lazy = eager === undefined ? image.lazy : !eager;
  return (
    <img
      className={className}
      src={image.src}
      width={image.width}
      height={image.height}
      alt={image.altKey ? t(image.altKey) : ''}
      loading={lazy ? 'lazy' : 'eager'}
      decoding="async"
    />
  );
};

export default CmImage;
