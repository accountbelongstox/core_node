// Demo App Configuration for React Native Multi-App System
export default {
  namespace: 'demo',
  displayName: 'Demo App',
  bundleId: 'com.demo.app',
  version: '1.0.0',
  platforms: ['android', 'ios'],
  defaultTheme: 'dark',
  features: {
    authentication: true,
    pushNotifications: true,
    analytics: true
  },
  apiBaseUrl: 'https://api.demo.com',
  navigation: {
    initialRoute: 'Dashboard',
    screens: ['Dashboard', 'Products', 'Cart', 'Checkout']
  }
};
