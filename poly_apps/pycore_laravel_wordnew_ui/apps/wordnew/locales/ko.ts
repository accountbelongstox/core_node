/** ko locale dictionary (composer). The key set is split across
 * ./ko_a.ts to ./ko_d.ts to keep each source file under the 800-line
 * modular limit; the merged koLocale export is consumed by ../WfNewLocales.ts. */
import { koLocaleA } from './ko_a';
import { koLocaleB } from './ko_b';
import { koLocaleC } from './ko_c';
import { koLocaleD } from './ko_d';

export const koLocale: Record<string, string> = {
    ...koLocaleA,
    ...koLocaleB,
    ...koLocaleC,
    ...koLocaleD,
};
