import { registerLocalDataGroup } from '../../core/persistence/LocalDataRegistry';

/** localStorage keys of the vortex app (use via core/persistence StorageManager). */
export const VortexStorageKeys = {
  BOOKMARKS: 'vortex_bookmarks',
  CRYPTO_CASH: 'vortex_crypto_cash',
  CRYPTO_POSITIONS: 'vortex_crypto_positions',
  CRYPTO_HISTORY: 'vortex_crypto_history',
  SIMULATED_COINS: 'vortex_simulated_coins',
  OKX_COINS: 'vortex_okx_coins',
} as const;

registerLocalDataGroup({
  id: 'vortex.workspace',
  appId: 'vortex',
  labelKey: 'common.local_data.groups.vortex_workspace',
  descriptionKey: 'common.local_data.groups.vortex_workspace_desc',
  clearable: true,
  sources: [{ kind: 'localStorage', keys: Object.values(VortexStorageKeys) }],
});
