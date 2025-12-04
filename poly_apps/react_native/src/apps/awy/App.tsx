import React, { useEffect, useState } from 'react';
import { StatusBar, View, ActivityIndicator } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StoreProvider, useStore } from '@/apps/awy/awy_store';
import AppRoutes from '@/apps/awy/awy_navigation';
import { initializeApi } from '@/common/services/api-init';
import { AWY_ENDPOINT_PATHS } from '@/apps/awy/awy_services/api-endpoints';
import { getAwyApiConfigs } from '@/apps/awy/awy_config/api-config';

const AppContent: React.FC = () => {
  const { theme } = useStore();
  const isDarkMode = theme === 'dark';

  return (
    <>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <AppRoutes />
    </>
  );
};

const AwyApp: React.FC = () => {
  const [apiInitialized, setApiInitialized] = useState(false);

  useEffect(() => {
    // Initialize API on app start
    const initApi = async () => {
      try {
        const configs = getAwyApiConfigs();
        await initializeApi(configs, AWY_ENDPOINT_PATHS);
        setApiInitialized(true);
      } catch (error) {
        console.error('Failed to initialize API:', error);
        // Still allow app to run even if API init fails
        setApiInitialized(true);
      }
    };

    initApi();
  }, []);

  if (!apiInitialized) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StoreProvider>
          <AppContent />
        </StoreProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
};

export default AwyApp;

