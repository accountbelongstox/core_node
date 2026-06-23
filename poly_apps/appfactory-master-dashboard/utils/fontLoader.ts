/**
 * Font Loader Utility
 * Provides multiple font loading strategies for better accessibility in China
 * 
 * Strategies:
 * 1. Local hosting (recommended) - fonts in public/fonts/
 * 2. jsDelivr CDN (fallback) - fast CDN accessible in China
 * 3. unpkg CDN (fallback) - alternative CDN
 */

export type FontLoadStrategy = 'local' | 'jsdelivr' | 'unpkg' | 'google';

/**
 * Get font CSS URL based on strategy
 */
export function getFontCSSUrl(strategy: FontLoadStrategy = 'local'): string {
  switch (strategy) {
    case 'local':
      return '/fonts/inter.css';
    
    case 'jsdelivr':
      // jsDelivr CDN - fast and accessible in China
      return 'https://cdn.jsdelivr.net/npm/@fontsource/inter@5.0.0/css/inter.min.css';
    
    case 'unpkg':
      // unpkg CDN - alternative
      return 'https://unpkg.com/@fontsource/inter@5.0.0/css/inter.min.css';
    
    case 'google':
      // Original Google Fonts (may be slow in China)
      return 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap';
    
    default:
      return '/fonts/inter.css';
  }
}

/**
 * Load font dynamically
 */
export function loadFont(strategy: FontLoadStrategy = 'local'): Promise<void> {
  return new Promise((resolve, reject) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = getFontCSSUrl(strategy);
    
    link.onload = () => {
      console.log(`[FontLoader] Font loaded successfully using strategy: ${strategy}`);
      resolve();
    };
    
    link.onerror = () => {
      console.warn(`[FontLoader] Failed to load font using strategy: ${strategy}, trying fallback...`);
      
      // Try fallback strategies
      if (strategy === 'local') {
        loadFont('jsdelivr').then(resolve).catch(reject);
      } else if (strategy === 'jsdelivr') {
        loadFont('unpkg').then(resolve).catch(reject);
      } else {
        reject(new Error('All font loading strategies failed'));
      }
    };
    
    document.head.appendChild(link);
  });
}

