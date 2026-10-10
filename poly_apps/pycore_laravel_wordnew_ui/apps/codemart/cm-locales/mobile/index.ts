import { cmMobileShell } from './shell';
import { cmMobileWpA } from './wpA';
import { cmMobileWpB } from './wpB';
import { cmMobileWpC } from './wpC';

const BLOCKS = [cmMobileShell, cmMobileWpA, cmMobileWpB, cmMobileWpC];

/** The `mobile` namespace of the cm resources, merged from the shell block and one block per work package. */
export const cmMobileEn = Object.assign({}, ...BLOCKS.map((block) => block.en));
export const cmMobileZh = Object.assign({}, ...BLOCKS.map((block) => block.zh));
