/** zh locale dictionary (composer). The key set is split across
 * ./zh_a.ts and ./zh_b.ts to keep each source file under the 800-line
 * modular limit; the merged zhLocale export is consumed by ../WfNewLocales.ts. */
import { zhLocaleA } from './zh_a';
import { zhLocaleB } from './zh_b';

export const zhLocale: Record<string, string> = {
    ...zhLocaleA,
    ...zhLocaleB,
};
