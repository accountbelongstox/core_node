// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'storage_provider.dart';
import 'app_storage_base.dart';
import 'unified_storage.dart';

/// Examples of how to use the unified storage system
/// Note: These are generic examples. For app-specific usage,
/// see the storage implementations in each app's config directory.
class StorageUsageExamples {

  /// Example 1: Basic unified storage usage
  static void basicUnifiedStorageExample() async {
    // Initialize unified storage (usually done in main.dart)
    await UnifiedStorage.init();

    // Use synchronous methods for frequently accessed data
    final isFirstLaunch = UnifiedStorage.getSync<bool>(CommonKeys.isFirstLaunch) ?? true;
    final locale = UnifiedStorage.getSync<String>(CommonKeys.locale);
    final themeMode = UnifiedStorage.getSync<String>(CommonKeys.themeMode);

    // Use asynchronous methods for other data
    final appVersion = await UnifiedStorage.get<String>(CommonKeys.appVersion);
    final notificationsEnabled = await UnifiedStorage.get<bool>(CommonKeys.notificationsEnabled);

    // Example: Use the data in your app logic
    if (isFirstLaunch) {
      // Handle first launch logic
    }

    if (locale != null && themeMode != null) {
      // Apply locale and theme settings
    }

    if (appVersion != null && notificationsEnabled != null) {
      // Handle app version and notification settings
    }

    // Update data synchronously (auto-persisted)
    UnifiedStorage.setSync<String>(CommonKeys.locale, 'en');
    UnifiedStorage.setSync<String>(CommonKeys.themeMode, 'dark');

    // Update data asynchronously
    await UnifiedStorage.set<String>(CommonKeys.appVersion, '1.0.0');
    await UnifiedStorage.set<bool>(CommonKeys.notificationsEnabled, false);
  }

  /// Example 2: Using AppStorageBase methods
  static void appStorageBaseExample() {
    // This example shows how to use AppStorageBase methods
    // In real usage, you would extend AppStorageBase in your app-specific storage class

    // Note: This is a conceptual example. In practice, you would use
    // your app-specific storage class that extends AppStorageBase

    // Example of what methods are available:
    // storage.isFirstLaunch()
    // storage.setNotFirstLaunch()
    // storage.getLocale()
    // storage.setLocale('en')
    // storage.isDarkMode()
    // storage.setDarkMode(true)
    // storage.isNotificationsEnabled()
    // storage.setNotificationsEnabled(false)

    // AppStorageBase provides 60+ common storage methods
    // See the class documentation for full method list
  }

  /// Example 3: Cache usage with UnifiedStorage
  static void cacheUsageExample() {
    // Cache temporary data
    UnifiedStorage.setCache('temp_data', {'key': 'value'}, expiry: const Duration(minutes: 30));

    // Get cached data
    final cachedData = UnifiedStorage.getCache<Map<String, dynamic>>('temp_data');
    // Use cached data in your app logic
    if (cachedData != null) {
      // Process cached data
    }

    // Remove cached data
    UnifiedStorage.removeCache('temp_data');

    // Clear all cache
    UnifiedStorage.clearCache();
  }

  /// Example 4: Data export and import
  static void dataManagementExample() async {
    // Export all data for backup
    final exportedData = await UnifiedStorage.exportData();
    // Use exported data for backup purposes

    // Import data from backup
    await UnifiedStorage.importData(exportedData);
    // Data imported successfully

    // Get storage statistics
    final stats = await UnifiedStorage.getStats();
    // Use stats for monitoring purposes
    if (stats.isNotEmpty) {
      // Process statistics
    }
  }

  /// Example 5: Using with Provider pattern (generic)
  static Widget providerUsageExample(AppStorageBase appStorage) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(
          create: (_) => StorageProviderFactory.getProvider(
            'generic_app',
            appStorage,
          ),
        ),
      ],
      child: const GenericStorageWidget(),
    );
  }
}

/// Generic storage widget showing how to use storage with Provider
class GenericStorageWidget extends StatelessWidget {
  const GenericStorageWidget({super.key});

  @override
  Widget build(BuildContext context) {
    return Consumer<StorageProvider>(
      builder: (context, storageProvider, child) {
        if (!storageProvider.isInitialized) {
          return const Center(child: CircularProgressIndicator());
        }

        return Scaffold(
          appBar: AppBar(
            title: const Text('Generic Storage Example'),
          ),
          body: Padding(
            padding: const EdgeInsets.all(16.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'First Launch: ${storageProvider.isFirstLaunch()}',
                  style: const TextStyle(fontSize: 16),
                ),
                const SizedBox(height: 8),
                Text(
                  'Locale: ${storageProvider.getLocale() ?? "Not set"}',
                  style: const TextStyle(fontSize: 16),
                ),
                const SizedBox(height: 8),
                Text(
                  'Theme: ${storageProvider.getThemeMode() ?? "Not set"}',
                  style: const TextStyle(fontSize: 16),
                ),
                const SizedBox(height: 8),
                Text(
                  'Authenticated: ${storageProvider.isAuthenticated()}',
                  style: const TextStyle(fontSize: 16),
                ),
                const SizedBox(height: 24),

                ElevatedButton(
                  onPressed: () {
                    storageProvider.setNotFirstLaunch();
                  },
                  child: const Text('Mark as Not First Launch'),
                ),
                const SizedBox(height: 8),

                ElevatedButton(
                  onPressed: () {
                    final currentTheme = storageProvider.getThemeMode();
                    final newTheme = currentTheme == 'dark' ? 'light' : 'dark';
                    storageProvider.setThemeMode(newTheme);
                  },
                  child: const Text('Toggle Theme'),
                ),
                const SizedBox(height: 8),

                ElevatedButton(
                  onPressed: () {
                    final currentLocale = storageProvider.getLocale();
                    final newLocale = currentLocale == 'en' ? 'zh' : 'en';
                    storageProvider.setLocale(newLocale);
                  },
                  child: const Text('Toggle Locale'),
                ),
                const SizedBox(height: 8),

                ElevatedButton(
                  onPressed: () async {
                    await storageProvider.clearAuth();
                  },
                  child: const Text('Clear Auth'),
                ),
                const SizedBox(height: 8),

                ElevatedButton(
                  onPressed: () async {
                    await storageProvider.refresh();
                  },
                  child: const Text('Refresh Data'),
                ),
                const SizedBox(height: 24),

                FutureBuilder<Map<String, dynamic>>(
                  future: storageProvider.getStats(),
                  builder: (context, snapshot) {
                    if (snapshot.hasData) {
                      return Expanded(
                        child: SingleChildScrollView(
                          child: Text(
                            'Storage Stats:\n${snapshot.data}',
                            style: const TextStyle(
                              fontFamily: 'monospace',
                              fontSize: 12,
                            ),
                          ),
                        ),
                      );
                    }
                    return const CircularProgressIndicator();
                  },
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}

/// Example of how to initialize unified storage in main.dart
class StorageInitializationExample {
  /// Initialize unified storage system
  static Future<void> initializeUnifiedStorage() async {
    // Initialize the unified storage system
    await UnifiedStorage.init();

    // Unified storage initialized successfully
  }

  /// Example of creating app with storage provider
  /// Note: In real usage, you would use your app-specific storage class
  static Widget createAppWithStorageExample(AppStorageBase appStorage) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(
          create: (_) => StorageProviderFactory.getProvider(
            'generic_app',
            appStorage,
          ),
        ),
      ],
      child: MaterialApp(
        title: 'Generic Storage Example App',
        home: const GenericStorageWidget(),
      ),
    );
  }
}
