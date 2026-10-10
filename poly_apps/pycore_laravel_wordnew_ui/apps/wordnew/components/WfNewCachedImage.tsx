import React, { useState } from 'react';
import { useWfNewStaticUrl } from '../hooks/useWfNewStaticUrl';

export type WfNewCachedImageProps = React.ImgHTMLAttributes<HTMLImageElement>;

/**
 * `<img>` over the device static library: a remote image is shown from the device copy (fetched once and kept,
 * WORDNEW_GUIDE R14). A local copy that fails to render falls back to the remote URL once before `onError` fires.
 */
export const WfNewCachedImage: React.FC<WfNewCachedImageProps> = ({ src, onError, ...rest }) => {
  const local = useWfNewStaticUrl(src);
  const [failedLocal, setFailedLocal] = useState<string | null>(null);
  const shown = local && failedLocal === local ? src : local;

  const handleError = (event: React.SyntheticEvent<HTMLImageElement, Event>): void => {
    if (local && local !== src && failedLocal !== local) {
      setFailedLocal(local);
      return;
    }
    onError?.(event);
  };

  return <img {...rest} src={shown} onError={handleError} />;
};
