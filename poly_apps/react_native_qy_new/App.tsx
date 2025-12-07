import 'react-native-reanimated';
import React from 'react';
import { StatusBar, View, Text, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppProvider, useAppContext } from './src/state/AppContext';
import { AppRouter } from './src/navigation/AppRouter';
import { Background } from './src/components/Background';
import { Dock } from './src/components/Dock';

const immersivePages = new Set([
  'reading_run',
  'flashcard_run',
  'quiz_run',
  'listening_player',
  'playlist',
]);

const AppContent = () => {
  const { isDark, isReady, currentPage } = useAppContext();

  return (
    <Background>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      {isReady ? (
        <>
          <AppRouter />
          {!immersivePages.has(currentPage) && <Dock />}
        </>
      ) : (
        <View style={styles.loader}>
          <Text style={styles.loaderText}>Preparing workspace...</Text>
        </View>
      )}
    </Background>
  );
};

function App(): React.JSX.Element {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <AppContent />
      </AppProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loaderText: {
    color: '#475569',
    fontWeight: '700',
  },
});

export default App;
