/** ja locale dictionary (composer). The key set is split across
 * ./ja_a.ts to ./ja_d.ts to keep each source file under the 800-line
 * modular limit; the merged jaLocale export is consumed by ../WfNewLocales.ts. */
import { jaLocaleA } from './ja_a';
import { jaLocaleB } from './ja_b';
import { jaLocaleC } from './ja_c';
import { jaLocaleD } from './ja_d';

export const jaLocale: Record<string, string> = {
    ...jaLocaleA,
    ...jaLocaleB,
    ...jaLocaleC,
    ...jaLocaleD,
};
