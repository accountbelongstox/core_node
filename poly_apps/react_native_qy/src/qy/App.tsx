/**
 * QY Word Learning App
 */

import React, { useEffect, useState } from 'react';
import { StatusBar, View, ActivityIndicator } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StoreProvider, useStore } from '@/qy/qy_store';
import AppNavigator from '@/qy/qy_navigation';
import { initializeApi } from '@/common/services/api-init';
import { QY_ENDPOINT_PATHS } from '@/qy/qy_services/api-endpoints';
import { getQyApiConfigs } from '@/qy/qy_services/api-config';
import { ApiBase } from '@/common/services/api-base';

const AppContent: React.FC = () => {
  const { theme, isInitialized } = useStore();
  const isDarkMode = theme === 'dark';

  if (!isInitialized) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <AppNavigator />
    </>
  );
};

const QyApp: React.FC = () => {
  const [apiInitialized, setApiInitialized] = useState(false);

  useEffect(() => {
    const initApi = async () => {
      try {
        const configs = getQyApiConfigs();
        const apiBase = ApiBase.getInstance();
        apiBase.configure(configs);
        apiBase.registerEndpoints(QY_ENDPOINT_PATHS);
        
        // Try to detect available API, but don't block if unavailable
        await apiBase.detectAvailableApi();
        
        setApiInitialized(true);
      } catch (error) {
        console.warn('API initialization failed, using mock data:', error);
        // Still allow app to run with mock data
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

export default QyApp;

