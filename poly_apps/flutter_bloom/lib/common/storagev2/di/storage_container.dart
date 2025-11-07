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

import 'dart:async';
import '../interfaces/storage_adapter_interface.dart';
import '../interfaces/encryption_service_interface.dart';
import '../interfaces/cache_service_interface.dart';
import '../infrastructure/hive_storage.dart';
import '../infrastructure/sqlite_storage.dart';
import '../infrastructure/memory_cache.dart';
import '../data_access/storage_data_access.dart';
import '../repository/storage_repository_impl.dart';
import '../business/user_service.dart';
import '../business/config_service.dart';
import '../application/storage_application_service.dart';
import '../models/storage_result.dart';
import '../config/storage_config.dart';

/// Dependency injection container for storage system
class StorageContainer {
  static final StorageContainer _instance = StorageContainer._internal();
  factory StorageContainer() => _instance;
  StorageContainer._internal();
  
  final Map<Type, dynamic> _services = {};
  final Map<Type, dynamic Function()> _factories = {};
  bool _isInitialized = false;
  
  /// Initialize the container with configuration
  Future<StorageResult<void>> initialize(StorageConfig config) async {
    try {
      if (_isInitialized) {
        return const StorageSuccess(null);
      }
      
      // Register core services
      await _registerCoreServices(config);
      
      // Register infrastructure services
      await _registerInfrastructureServices(config);
      
      // Register data access services
      await _registerDataAccessServices(config);
      
      // Register repository services
      await _registerRepositoryServices(config);
      
      // Register business services
      await _registerBusinessServices(config);
      
      // Register application services
      await _registerApplicationServices(config);
      
      _isInitialized = true;
      
      return const StorageSuccess(null);
    } catch (e) {
      return StorageError.fromException(
        e is Exception ? e : Exception(e.toString()),
        message: 'Failed to initialize storage container',
      );
    }
  }
  
  /// Register a singleton service
  void registerSingleton<T>(T instance) {
    _services[T] = instance;
  }
  
  /// Register a factory for service creation
  void registerFactory<T>(T Function() factory) {
    _factories[T] = factory;
  }
  
  /// Get a service instance
  T get<T>() {
    if (_services.containsKey(T)) {
      return _services[T] as T;
    }
    
    if (_factories.containsKey(T)) {
      final instance = _factories[T]!() as T;
      _services[T] = instance;
      return instance;
    }
    
    throw Exception('Service not registered: $T');
  }
  
  /// Check if service is registered
  bool isRegistered<T>() {
    return _services.containsKey(T) || _factories.containsKey(T);
  }
  
  /// Dispose all services
  Future<StorageResult<void>> dispose() async {
    try {
      // Dispose services in reverse order
      final servicesToDispose = _services.values.toList().reversed;
      
      for (final service in servicesToDispose) {
        if (service is StorageAdapter) {
          await service.close();
        } else if (service is CacheService) {
          await service.close();
        } else if (service is EncryptionService) {
          await service.close();
        }
      }
      
      _services.clear();
      _factories.clear();
      _isInitialized = false;
      
      return const StorageSuccess(null);
    } catch (e) {
      return StorageError.fromException(
        e is Exception ? e : Exception(e.toString()),
        message: 'Failed to dispose storage container',
      );
    }
  }
  
  /// Register core services
  Future<void> _registerCoreServices(StorageConfig config) async {
    registerSingleton<StorageConfig>(config);
  }
  
  /// Register infrastructure services
  Future<void> _registerInfrastructureServices(StorageConfig config) async {
    // Register storage adapter based on configuration
    if (config.storageType.name == 'hive') {
      final hiveAdapter = HiveStorageAdapter();
      await hiveAdapter.initialize(config);
      registerSingleton<StorageAdapter>(hiveAdapter);
    } else if (config.storageType.name == 'sqlite') {
      final sqliteAdapter = SQLiteStorageAdapter();
      await sqliteAdapter.initialize(config);
      registerSingleton<StorageAdapter>(sqliteAdapter);
    } else {
      throw Exception('Unsupported storage type: ${config.storageType}');
    }
    
    // Register cache service if enabled
    if (config.enableCaching) {
      final cacheService = MemoryCacheService();
      await cacheService.initialize(
        maxSize: config.cacheMaxSize,
        defaultExpiry: Duration(seconds: config.cacheDefaultExpiry),
      );
      registerSingleton<CacheService>(cacheService);
    }
    
    // Register encryption service if enabled
    if (config.encryptSensitiveData) {
      // For now, we'll use a placeholder encryption service
      // In a real implementation, you would register an actual encryption service
      registerFactory<EncryptionService>(() => _PlaceholderEncryptionService());
    }
  }
  
  /// Register data access services
  Future<void> _registerDataAccessServices(StorageConfig config) async {
    final adapter = get<StorageAdapter>();
    final encryptionService = config.encryptSensitiveData ? get<EncryptionService>() : null;
    final cacheService = config.enableCaching ? get<CacheService>() : null;
    
    // User data access
    final userDataAccess = StorageDataAccess(
      adapter: adapter,
      config: config,
      boxName: 'users',
      entityType: String,
      encryptionService: encryptionService,
      cacheService: cacheService,
    );
    await userDataAccess.initialize();
    registerSingleton<StorageDataAccess>(userDataAccess);
    
    // Config data access
    final configDataAccess = StorageDataAccess(
      adapter: adapter,
      config: config,
      boxName: 'configs',
      entityType: String,
      encryptionService: encryptionService,
      cacheService: cacheService,
    );
    await configDataAccess.initialize();
    registerSingleton<StorageDataAccess>(configDataAccess);
  }
  
  /// Register repository services
  Future<void> _registerRepositoryServices(StorageConfig config) async {
    final userDataAccess = get<StorageDataAccess>();
    final configDataAccess = get<StorageDataAccess>();
    
    final userRepository = UserRepository(dataAccess: userDataAccess);
    final configRepository = ConfigRepository(dataAccess: configDataAccess);
    
    registerSingleton<UserRepository>(userRepository);
    registerSingleton<ConfigRepository>(configRepository);
  }
  
  /// Register business services
  Future<void> _registerBusinessServices(StorageConfig config) async {
    final userRepository = get<UserRepository>();
    final configRepository = get<ConfigRepository>();
    
    final userService = UserService(userRepository: userRepository);
    final configService = ConfigService(configRepository: configRepository);
    
    registerSingleton<UserService>(userService);
    registerSingleton<ConfigService>(configService);
  }
  
  /// Register application services
  Future<void> _registerApplicationServices(StorageConfig config) async {
    final userService = get<UserService>();
    final configService = get<ConfigService>();
    
    final applicationService = StorageApplicationService(
      userService: userService,
      configService: configService,
    );
    await applicationService.initialize();
    
    registerSingleton<StorageApplicationService>(applicationService);
  }
}

/// Placeholder encryption service for demonstration
class _PlaceholderEncryptionService implements EncryptionService {
  @override
  Future<StorageResult<void>> initialize(String? key) async {
    return const StorageSuccess(null);
  }
  
  @override
  Future<StorageResult<String>> encrypt(String data) async {
    // In a real implementation, this would perform actual encryption
    return StorageSuccess('encrypted_$data');
  }
  
  @override
  Future<StorageResult<String>> decrypt(String encryptedData) async {
    // In a real implementation, this would perform actual decryption
    if (encryptedData.startsWith('encrypted_')) {
      return StorageSuccess(encryptedData.substring(10));
    }
    return StorageSuccess(encryptedData);
  }
  
  @override
  Future<StorageResult<List<int>>> encryptBytes(List<int> data) async {
    return StorageSuccess(data);
  }
  
  @override
  Future<StorageResult<List<int>>> decryptBytes(List<int> encryptedData) async {
    return StorageSuccess(encryptedData);
  }
  
  @override
  Future<StorageResult<String>> generateKey() async {
    return StorageSuccess('placeholder_key');
  }
  
  @override
  bool isEncrypted(String data) {
    return data.startsWith('encrypted_');
  }
  
  @override
  EncryptionInfo getEncryptionInfo() {
    return EncryptionInfo(
      algorithm: 'placeholder',
      keySize: 256,
      mode: 'CBC',
      padding: 'PKCS7',
      isSecure: true,
    );
  }
  
  @override
  Future<StorageResult<void>> close() async {
    return const StorageSuccess(null);
  }
}
