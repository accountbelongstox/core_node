/**
 * App Registry
 * Main app registration and loading system
 * Scans src/apps/ directory automatically
 */

import { AppRegistry } from 'react-native';
import { name as appName } from '../app.json';
import { scanApps, getActiveAppNamespace, loadAppComponent } from './common/utils/app-registry';

// Scan all available apps
const availableApps = scanApps();

console.log(`Found ${availableApps.length} app(s):`, availableApps.map((app) => app.namespace));

// Get active app namespace
const activeNamespace = getActiveAppNamespace();

console.log(`Loading app: ${activeNamespace}`);

// Load and register the active app
loadAppComponent(activeNamespace)
  .then((AppComponent) => {
    if (!AppComponent) {
      console.error(`Failed to load app: ${activeNamespace}`);
      // Fallback to demo if available
      const fallbackApp = availableApps.find((app) => app.namespace === 'demo');
      if (fallbackApp) {
        return loadAppComponent('demo');
      }
      throw new Error('No app available to load');
    }
    return AppComponent;
  })
  .then((AppComponent) => {
    if (AppComponent) {
      AppRegistry.registerComponent(appName, () => AppComponent);
    }
  })
  .catch((error) => {
    console.error('Failed to register app:', error);
  });

// Export for use in other parts of the app
export { availableApps, getActiveAppNamespace, scanApps };

