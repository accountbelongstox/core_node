
/**
 * Assets Resource Center
 * Centralized management of all asset paths
 */

import logoMin from './logo-min.png';
import logoFull from './logo.png';
import chairmanImg from './chairman.jpg';

export const Assets = {
  // Logo resources
  logo: {
    // Small logo for header/top navigation
    min: logoMin,
    // Full logo for other uses
    full: logoFull,
  },
  // Chairman photo
  chairman: chairmanImg,
} as const;

export default Assets;
