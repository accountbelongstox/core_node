/** ko locale dictionary (composer). The key set is split across
 * ./ko_a.ts and ./ko_b.ts to keep each source file under the 800-line
 * modular limit; the merged koLocale export is consumed by ../WfNewLocales.ts. */
import { koLocaleA } from './ko_a';
import { koLocaleB } from './ko_b';

export const koLocale: Record<string, string> = {
    ...koLocaleA,
    ...koLocaleB,
};
