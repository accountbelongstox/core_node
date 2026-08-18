/* WfNewBrand — the single source of truth for the WordNew brand logo.
 *
 * Renders the raster app icon (generated from the flutter_bloom app_qy logo by
 * assets/generate_wordnew_brand.py) at multiple sizes. Used by the header mark
 * (sub-app top-left), the welcome/onboarding splash and the About card.
 *
 * Vite emits the PNG imports exposed by WfNewBrandData.ts, keeping the URLs
 * valid in development, production, and native bundles without inline data
 * URI parsing. The full multi-size PNG set and .ico live under assets/. */
import React from 'react';
import { WORDNEW_LOGO_64, WORDNEW_LOGO_128 } from './WfNewBrandData';

// Smallest-first tiers; pickSrc returns the first asset whose pixel budget
// covers the requested device pixels, falling back to the largest embedded one.
const TIERS: Array<[number, string]> = [
  [64, WORDNEW_LOGO_64],
  [128, WORDNEW_LOGO_128],
];

function pickSrc(devicePx: number): string {
  for (const [tier, src] of TIERS) if (devicePx <= tier) return src;
  return WORDNEW_LOGO_128;
}

export interface WfNewLogoProps {
  /** Rendered (CSS) size in px. A 2x asset is chosen for crisp retina output. */
  size?: number;
  className?: string;
  /** Apply the rounded-2xl app-icon mask (default true). */
  rounded?: boolean;
  alt?: string;
}

export const WfNewLogo: React.FC<WfNewLogoProps> = ({
  size = 40,
  className = '',
  rounded = true,
  alt = 'WordNew',
}) => (
  <img
    src={pickSrc(size * 2)}
    width={size}
    height={size}
    alt={alt}
    draggable={false}
    className={`object-contain select-none ${rounded ? 'rounded-2xl' : ''} ${className}`}
  />
);

export default WfNewLogo;
