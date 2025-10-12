// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

// FlutterStorage - Modern, layered storage architecture for Flutter applications

// Core models and types
export 'models/storage_result.dart';
export 'models/storage_entity.dart';
export 'models/user_entity.dart';
export 'models/config_entity.dart';

// Configuration
export 'config/storage_config.dart';

// Interfaces
export 'interfaces/storage_repository_interface.dart';
export 'interfaces/storage_adapter_interface.dart';
export 'interfaces/encryption_service_interface.dart';
export 'interfaces/cache_service_interface.dart';

// Infrastructure implementations
export 'infrastructure/hive_storage.dart';
export 'infrastructure/sqlite_storage.dart';
export 'infrastructure/memory_cache.dart';

// Data access layer
export 'data_access/storage_data_access.dart';
export 'data_access/storage_adapter.dart';
export 'data_access/encryption_adapter.dart';
export 'data_access/cache_adapter.dart';

// Repository implementations
export 'repository/storage_repository_impl.dart';

// Business logic services
export 'business/user_service.dart';
export 'business/config_service.dart';
export 'business/security_service.dart';
export 'business/storage_service.dart';
export 'business/sync_service.dart';

// Application services
export 'application/storage_application_service.dart';

// Dependency injection
export 'di/storage_container.dart';

// Utilities
export 'utils/storage_utils.dart';

// Exceptions
export 'exceptions/storage_exceptions.dart';
