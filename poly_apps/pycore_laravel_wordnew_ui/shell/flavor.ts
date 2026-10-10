/*
 * Flavor resolution: the runtime side of the multi-app build system.
 *
 * Flavors are the Flutter-flavors analog: one buildable app variant per entry in
 * flavors/<id>/flavor.json. A build selects ONE via the VITE_APP_FLAVOR env var
 * (set by build_app.ps1 / scripts/flavor/flavor_build.py):
 *   - unset or 'shell'  : the full multi-app shell (default npm run dev|build).
 *   - 'wordnew' etc.    : that app mounted standalone as the homepage.
 *
 * The flavors star-glob flavor.json files are the SINGLE SOURCE OF TRUTH (loaded
 * here via Vite import.meta.glob, and read by the Python helper for the Capacitor
 * native config + icon/splash). Keep the two in lock-step.
 */

export interface FlavorConfig {
  id: string;
  name: string;
  shortName?: string;
  appId?: string;
  version?: string;
  /** The in-app route the standalone build lands on (e.g. '/wordnew'). */
  rootRoute: string;
  /** Project-root-relative React entry. Presence is validated by native scripts. */
  entry?: string;
  platforms?: Array<'web' | 'android' | 'ios'>;
  /** 'shell' mounts the full multi-app shell (every end, shell controls) landing on `rootRoute`. */
  mount?: 'standalone' | 'shell';
  standalone?: {
    switcher?: {
      enabled?: boolean;
      visible?: boolean;
    };
  };
  themeColor?: string;
  backgroundColor?: string;
  description?: string;
  /** Localized display names by language code ('en', 'zh', ...); `name` is the fallback. */
  names?: Record<string, string>;
  brand?: {
    /** Project-relative brand icon: the ONE source for favicon, launcher icons and splash. */
    icon: string;
    iconBackground?: string;
    adaptiveScale?: number;
  };
  launch?: FlavorLaunchConfig;
}

export type FlavorLaunchMode = 'none' | 'logo' | 'slides';
/** When the web launch transition plays: every start, once per session/day, or once per app version. */
export type FlavorLaunchShow = 'always' | 'session' | 'daily' | 'version';

export interface FlavorLaunchSlide {
  /** Project-relative image under apps/<app>/assets/launch/. */
  image: string;
  /** CSS object-position focus point the Ken Burns zoom drifts toward, e.g. '50% 30%'. */
  focus?: string;
  caption?: Record<string, string>;
}

export interface FlavorLaunchConfig {
  /** Native splash (rendered by scripts/flavor/brand_assets.py). */
  native?: {
    background?: string;
    backgroundDark?: string;
    image?: string;
    imageFocus?: string;
    iconScale?: number;
    logoScale?: number;
  };
  /** Web transition shown after the native splash hands over to the WebView. */
  web?: {
    mode?: FlavorLaunchMode;
    show?: FlavorLaunchShow;
    durationMs?: number;
    slideMs?: number;
    skippable?: boolean;
    tagline?: Record<string, string>;
    slides?: FlavorLaunchSlide[];
  };
}

const DEFAULT_SHELL: FlavorConfig = {
  id: 'shell',
  name: 'Nexus Dash',
  rootRoute: '/home',
};

const flavorModules = import.meta.glob('../flavors/*/flavor.json', {
  eager: true,
  import: 'default',
}) as Record<string, FlavorConfig>;
// Brand icons and launch art referenced by flavor.json (project-relative). Brand
// sources inside an app follow the `*-logo-source.*` naming; launch slides live
// in apps/<app>/assets/launch/.
const brandAssetModules = import.meta.glob([
  '../flavors/*/*.{svg,png,jpg,jpeg,webp}',
  '../apps/*/assets/*-logo-source.{svg,png,jpg,jpeg,webp}',
  '../apps/*/assets/launch/**/*.{svg,png,jpg,jpeg,webp}',
], {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

/** URL of a project-relative brand/launch asset declared in flavor.json. */
export function flavorAssetUrl(relativePath: string | undefined): string | undefined {
  return relativePath ? brandAssetModules[`../${relativePath.replace(/^\.?\//, '')}`] : undefined;
}

export function flavorIconUrl(flavor: FlavorConfig): string | undefined {
  return flavorAssetUrl(flavor.brand?.icon);
}

/** Localized flavor name: exact code, then base language, then English, then `name`. */
export function flavorDisplayName(flavor: FlavorConfig, lang?: string): string {
  const names = flavor.names ?? {};
  const code = (lang || '').toLowerCase();
  return names[code] || names[code.split('-')[0]] || names.en || flavor.name;
}

/** Pick a localized string from a { lang: text } map with the same fallback chain. */
export function flavorLocalized(map: Record<string, string> | undefined, lang?: string): string {
  if (!map) return '';
  const code = (lang || '').toLowerCase();
  return map[code] || map[code.split('-')[0]] || map.en || Object.values(map)[0] || '';
}

export const FLAVOR_REGISTRY: Record<string, FlavorConfig> = {};
for (const cfg of Object.values(flavorModules)) {
  if (cfg && cfg.id) FLAVOR_REGISTRY[cfg.id] = cfg;
}

export function applyFlavorDocument(flavor: FlavorConfig, lang?: string): void {
  if (typeof document === 'undefined') return;
  const iconUrl = flavorIconUrl(flavor);
  document.title = flavorDisplayName(flavor, lang || document.documentElement.lang || navigator.language);
  if (flavor.themeColor) {
    let theme = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
    if (!theme) {
      theme = document.createElement('meta');
      theme.name = 'theme-color';
      document.head.appendChild(theme);
    }
    theme.content = flavor.themeColor;
  }
  if (iconUrl) {
    let icon = document.querySelector('link[rel="icon"]') as HTMLLinkElement | null;
    if (!icon) {
      icon = document.createElement('link');
      icon.rel = 'icon';
      document.head.appendChild(icon);
    }
    icon.href = iconUrl;
  }
}

/**
 * Build-time flavor id. Replaced by Vite `define` from the central code
 * configuration. Guarded so tsc and non-Vite contexts fall back to the full
 * shell.
 */
declare const __APP_FLAVOR__: string;
const selectedId = typeof __APP_FLAVOR__ !== 'undefined' ? __APP_FLAVOR__ : 'shell';

/** The active flavor for this build (falls back to the full shell). */
export const FLAVOR: FlavorConfig =
  FLAVOR_REGISTRY[selectedId] || FLAVOR_REGISTRY['shell'] || DEFAULT_SHELL;

/** True when a single sub-app is mounted as the homepage (not the full shell). */
export const IS_STANDALONE = FLAVOR.id !== 'shell' && FLAVOR.mount !== 'shell';
