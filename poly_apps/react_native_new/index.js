/**
 * @format
 */

// Import gesture handler at the top (required for React Navigation)
import 'react-native-gesture-handler';

import { AppRegistry } from 'react-native';
import { name as appName } from './app.json';

// Direct app import - no hardcoding, dynamically set by app_switcher.py
import App from './src/apps/awy/App';

AppRegistry.registerComponent(appName, () => App);
