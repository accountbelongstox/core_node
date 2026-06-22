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
