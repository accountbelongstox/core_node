import { defineMobileLocale } from './defineMobileLocale';

/** Work package A: welcome and sign-in flow, home, notifications. */
export const cmMobileWpA = defineMobileLocale(
  {
    welcome: {
      lead: 'Post a brief, fund it into escrow, and let verified developers deliver it.',
      browse: 'Browse the showcase',
    },
    home: {
      greeting: 'Hi, {{name}}',
    },
  },
  {
    welcome: {
      lead: '发布需求并托管资金，由已认证的开发者按里程碑交付。',
      browse: '浏览案例展示',
    },
    home: {
      greeting: '你好，{{name}}',
    },
  },
);
