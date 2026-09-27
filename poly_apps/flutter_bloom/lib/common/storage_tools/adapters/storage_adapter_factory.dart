import 'package:flutter/foundation.dart' show kIsWeb;
import '../interfaces/storage_interface.dart';
import 'storage_adapter_unified.dart';

// Conditional import: use web adapter on web, stub on other platforms
import 'web_storage_adapter_stub.dart'
    if (dart.library.html) 'web_storage_adapter.dart' as web_storage;

/// Factory for creating platform-appropriate storage adapters
/// Automatically selects the correct storage implementation based on the platform
class StorageAdapterFactory {
  /// Create a platform-appropriate storage adapter
  static KeyValueStorageInterface createAdapter() {
    if (kIsWeb) {
      return web_storage.WebStorageAdapter.instance;
    } else {
      return UnifiedSQLiteStorageAdapter.instance;
    }
  }

  /// Get the appropriate storage adapter for the current platform
  static KeyValueStorageInterface getAdapter() {
    return createAdapter();
  }
}
