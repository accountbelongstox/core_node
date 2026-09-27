export const VORTEX_PYCORE_HTTP_ROUTES = {
  accountOverview: 'okx/account_overview',
  cancelFill: 'okx/cancel_fill',
  candles: 'okx/candles',
  coins: 'okx/coins',
  fillBacktest: 'okx/fill_backtest',
  fillPlan: 'okx/fill_plan',
  getSettings: 'okx/get_settings',
  loadUniverse: 'okx/load_universe',
  metrics: 'okx/metrics',
  preopen: 'okx/preopen',
  quantInfo: 'okx/quant_info',
  serialize: 'okx/serialize',
  setSettings: 'okx/set_settings',
  sparklines: 'okx/sparklines',
  status: 'okx/status',
} as const;

export type VortexPycoreHttpRoute = (typeof VORTEX_PYCORE_HTTP_ROUTES)[keyof typeof VORTEX_PYCORE_HTTP_ROUTES];

/** Mirrors the okx/* names registered in pycore/callmodule/rpc_routes/route_names.py. */
export const VORTEX_PYCORE_SERVED_HTTP_ROUTES: readonly VortexPycoreHttpRoute[] = [];

export const VORTEX_PYCORE_PANEL_ROUTES = {
  account: [VORTEX_PYCORE_HTTP_ROUTES.accountOverview],
  quant: [
    VORTEX_PYCORE_HTTP_ROUTES.quantInfo,
    VORTEX_PYCORE_HTTP_ROUTES.getSettings,
    VORTEX_PYCORE_HTTP_ROUTES.setSettings,
    VORTEX_PYCORE_HTTP_ROUTES.serialize,
    VORTEX_PYCORE_HTTP_ROUTES.preopen,
  ],
  backtest: [
    VORTEX_PYCORE_HTTP_ROUTES.status,
    VORTEX_PYCORE_HTTP_ROUTES.coins,
    VORTEX_PYCORE_HTTP_ROUTES.getSettings,
    VORTEX_PYCORE_HTTP_ROUTES.setSettings,
    VORTEX_PYCORE_HTTP_ROUTES.loadUniverse,
    VORTEX_PYCORE_HTTP_ROUTES.fillPlan,
    VORTEX_PYCORE_HTTP_ROUTES.fillBacktest,
    VORTEX_PYCORE_HTTP_ROUTES.cancelFill,
    VORTEX_PYCORE_HTTP_ROUTES.candles,
    VORTEX_PYCORE_HTTP_ROUTES.sparklines,
    VORTEX_PYCORE_HTTP_ROUTES.metrics,
  ],
} as const satisfies Record<string, readonly VortexPycoreHttpRoute[]>;

export type VortexPycorePanel = keyof typeof VORTEX_PYCORE_PANEL_ROUTES;

export const isVortexPycorePanelServed = (panel: VortexPycorePanel): boolean =>
  VORTEX_PYCORE_PANEL_ROUTES[panel].every((route) => VORTEX_PYCORE_SERVED_HTTP_ROUTES.includes(route));

export const VORTEX_PYCORE_EVENT_TOPICS = {
  marketProgress: 'okx_market_progress',
  marketStatus: 'okx_market_status',
  marketUpdate: 'okx_market_update',
} as const;
