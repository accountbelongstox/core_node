/**
 * Settings > Cache (`#/cache`): storage volumes and the clip root, the
 * orchestration clips on this device, and every data cache.
 */
import React, { useCallback, useState } from 'react';
import type { ElementTheme } from '../WfNewThemes';
import { WfNewStorageSection } from '../components/cache/WfNewStorageSection';
import { WfNewOrchClipLibrary } from '../components/cache/WfNewOrchClipLibrary';
import { WfNewCacheItemsSection } from '../components/cache/WfNewCacheItemsSection';

interface Props {
  activeTheme: ElementTheme;
  trans: (key: string, replacements?: Record<string, string | number>) => string;
}

export const WfNewCachePage: React.FC<Props> = ({ activeTheme, trans }) => {
  const [revision, setRevision] = useState(0);
  const bump = useCallback(() => setRevision((value) => value + 1), []);

  return (
    <div className="space-y-6">
      <WfNewStorageSection activeTheme={activeTheme} trans={trans} revision={revision} onRootChanged={bump} />
      <WfNewOrchClipLibrary activeTheme={activeTheme} trans={trans} revision={revision} onChanged={bump} />
      <WfNewCacheItemsSection activeTheme={activeTheme} trans={trans} onCleared={bump} />
    </div>
  );
};
