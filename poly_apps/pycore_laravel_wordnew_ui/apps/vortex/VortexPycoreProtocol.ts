export const VORTEX_PYCORE_ROUTES = {
  accountOverview: 'okx.account_overview',
  cancelFill: 'okx.cancel_fill',
  candles: 'okx.candles',
  coins: 'okx.coins',
  fillBacktest: 'okx.fill_backtest',
  fillPlan: 'okx.fill_plan',
  getSettings: 'okx.get_settings',
  loadUniverse: 'okx.load_universe',
  metrics: 'okx.metrics',
  preopen: 'okx.preopen',
  quantInfo: 'okx.quant_info',
  revealCredentials: 'okx.reveal_credentials',
  serialize: 'okx.serialize',
  setSettings: 'okx.set_settings',
  sparklines: 'okx.sparklines',
  status: 'okx.status',
} as const;

export const VORTEX_PYCORE_EVENT_TOPICS = {
  marketProgress: 'okx_market_progress',
  marketStatus: 'okx_market_status',
  marketUpdate: 'okx_market_update',
} as const;
