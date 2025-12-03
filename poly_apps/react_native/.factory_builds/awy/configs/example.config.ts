// Example App Configuration for React Native Multi-App System
export default {
  namespace: 'example',
  displayName: 'Example App',
  bundleId: 'com.example.app',
  version: '1.0.0',
  platforms: ['android', 'ios'],
  defaultTheme: 'light',
  features: {
    authentication: true,
    pushNotifications: false,
    analytics: true
  },
  apiBaseUrl: 'https://api.example.com',
  navigation: {
    initialRoute: 'Home',
    screens: ['Home', 'Profile', 'Settings']
  }
};
