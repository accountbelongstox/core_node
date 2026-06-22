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
  themeColor?: string;
  backgroundColor?: string;
  description?: string;
  icon?: string;
  splash?: string;
}

// Static imports of every flavor.json (the source of truth, shared with the
// Python native build). Add a line here when you add a flavors/<id>/ folder.
import shellFlavor from '../flavors/shell/flavor.json';
import wordnewFlavor from '../flavors/wordnew/flavor.json';
import vortexFlavor from '../flavors/vortex/flavor.json';

const DEFAULT_SHELL: FlavorConfig = {
  id: 'shell',
  name: 'Nexus Dash',
  rootRoute: '/home',
};

export const FLAVOR_REGISTRY: Record<string, FlavorConfig> = {};
for (const cfg of [shellFlavor, wordnewFlavor, vortexFlavor] as FlavorConfig[]) {
  if (cfg && cfg.id) FLAVOR_REGISTRY[cfg.id] = cfg;
}

/**
 * Build-time flavor id. Replaced by Vite `define` (__APP_FLAVOR__, set from the
 * VITE_APP_FLAVOR env var by build_app.ps1). The project convention is to avoid
 * import.meta.env — a define constant keeps config in plain JS. Guarded so tsc /
 * non-Vite contexts fall back to the full shell.
 */
declare const __APP_FLAVOR__: string;
const selectedId = typeof __APP_FLAVOR__ !== 'undefined' ? __APP_FLAVOR__ : 'shell';

/** The active flavor for this build (falls back to the full shell). */
export const FLAVOR: FlavorConfig =
  FLAVOR_REGISTRY[selectedId] || FLAVOR_REGISTRY['shell'] || DEFAULT_SHELL;

/** True when a single sub-app is mounted as the homepage (not the full shell). */
export const IS_STANDALONE = FLAVOR.id !== 'shell';
