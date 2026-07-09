/** en locale dictionary (composer). The key set is split across
 * ./en_a.ts and ./en_b.ts to keep each source file under the 800-line
 * modular limit; the merged enLocale export is consumed by ../WfNewLocales.ts. */
import { enLocaleA } from './en_a';
import { enLocaleB } from './en_b';

export const enLocale: Record<string, string> = {
    ...enLocaleA,
    ...enLocaleB,
};
