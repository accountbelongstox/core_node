import { FLAVOR_REGISTRY, flavorIconUrl } from '../../shell/flavor';

const CM_FLAVOR_ID = 'codemart';
const CM_FLAVOR = FLAVOR_REGISTRY[CM_FLAVOR_ID];

/** App version, declared once in flavors/codemart/flavor.json. */
export const CM_APP_VERSION = CM_FLAVOR?.version ?? '';

/** Brand mark: the flavor brand icon (flavor.json brand.icon). */
export const CM_BRAND_ICON_URL = (CM_FLAVOR && flavorIconUrl(CM_FLAVOR)) || '';
