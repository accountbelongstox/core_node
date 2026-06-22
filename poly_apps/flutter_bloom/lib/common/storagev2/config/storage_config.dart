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

/// Storage type enumeration
enum StorageType {
  hive,
  sqlite,
}

/// Storage configuration class
class StorageConfig {
  final String appName;
  final bool enableLogging;
  final bool enableCaching;
  final bool encryptSensitiveData;
  final int cacheMaxSize;
  final int cacheDefaultExpiry;
  final String? encryptionKey;
  final StorageType storageType;
  final String? subDirectory;
  final Map<String, dynamic> customSettings;
  
  const StorageConfig({
    required this.appName,
    this.enableLogging = false,
    this.enableCaching = true,
    this.encryptSensitiveData = false,
    this.cacheMaxSize = 1000,
    this.cacheDefaultExpiry = 3600,
    this.encryptionKey,
    this.storageType = StorageType.hive,
    this.subDirectory,
    this.customSettings = const {},
  });
  
  /// Create a default configuration
  factory StorageConfig.defaultConfig(String appName) {
    return StorageConfig(
      appName: appName,
      enableLogging: true,
      enableCaching: true,
      encryptSensitiveData: false,
      cacheMaxSize: 1000,
      cacheDefaultExpiry: 3600,
      storageType: StorageType.hive,
    );
  }
  
  /// Create a production configuration
  factory StorageConfig.production(String appName, {String? encryptionKey}) {
    return StorageConfig(
      appName: appName,
      enableLogging: false,
      enableCaching: true,
      encryptSensitiveData: true,
      cacheMaxSize: 5000,
      cacheDefaultExpiry: 7200,
      encryptionKey: encryptionKey,
      storageType: StorageType.sqlite,
    );
  }
  
  /// Create a development configuration
  factory StorageConfig.development(String appName) {
    return StorageConfig(
      appName: appName,
      enableLogging: true,
      enableCaching: false,
      encryptSensitiveData: false,
      cacheMaxSize: 100,
      cacheDefaultExpiry: 300,
      storageType: StorageType.hive,
    );
  }
  
  /// Copy with new values
  StorageConfig copyWith({
    String? appName,
    bool? enableLogging,
    bool? enableCaching,
    bool? encryptSensitiveData,
    int? cacheMaxSize,
    int? cacheDefaultExpiry,
    String? encryptionKey,
    StorageType? storageType,
    String? subDirectory,
    Map<String, dynamic>? customSettings,
  }) {
    return StorageConfig(
      appName: appName ?? this.appName,
      enableLogging: enableLogging ?? this.enableLogging,
      enableCaching: enableCaching ?? this.enableCaching,
      encryptSensitiveData: encryptSensitiveData ?? this.encryptSensitiveData,
      cacheMaxSize: cacheMaxSize ?? this.cacheMaxSize,
      cacheDefaultExpiry: cacheDefaultExpiry ?? this.cacheDefaultExpiry,
      encryptionKey: encryptionKey ?? this.encryptionKey,
      storageType: storageType ?? this.storageType,
      subDirectory: subDirectory ?? this.subDirectory,
      customSettings: customSettings ?? this.customSettings,
    );
  }
  
  /// Convert to map
  Map<String, dynamic> toMap() {
    return {
      'appName': appName,
      'enableLogging': enableLogging,
      'enableCaching': enableCaching,
      'encryptSensitiveData': encryptSensitiveData,
      'cacheMaxSize': cacheMaxSize,
      'cacheDefaultExpiry': cacheDefaultExpiry,
      'encryptionKey': encryptionKey,
      'storageType': storageType.name,
      'subDirectory': subDirectory,
      'customSettings': customSettings,
    };
  }
  
  /// Create from map
  factory StorageConfig.fromMap(Map<String, dynamic> map) {
    return StorageConfig(
      appName: map['appName'] as String,
      enableLogging: map['enableLogging'] as bool? ?? false,
      enableCaching: map['enableCaching'] as bool? ?? true,
      encryptSensitiveData: map['encryptSensitiveData'] as bool? ?? false,
      cacheMaxSize: map['cacheMaxSize'] as int? ?? 1000,
      cacheDefaultExpiry: map['cacheDefaultExpiry'] as int? ?? 3600,
      encryptionKey: map['encryptionKey'] as String?,
      storageType: StorageType.values.firstWhere(
        (e) => e.name == map['storageType'],
        orElse: () => StorageType.hive,
      ),
      subDirectory: map['subDirectory'] as String?,
      customSettings: Map<String, dynamic>.from(map['customSettings'] as Map? ?? {}),
    );
  }
  
  @override
  String toString() {
    return 'StorageConfig(appName: $appName, enableLogging: $enableLogging, enableCaching: $enableCaching, encryptSensitiveData: $encryptSensitiveData, cacheMaxSize: $cacheMaxSize, cacheDefaultExpiry: $cacheDefaultExpiry, storageType: $storageType)';
  }
  
  @override
  bool operator ==(Object other) {
    if (identical(this, other)) return true;
    
    return other is StorageConfig &&
        other.appName == appName &&
        other.enableLogging == enableLogging &&
        other.enableCaching == enableCaching &&
        other.encryptSensitiveData == encryptSensitiveData &&
        other.cacheMaxSize == cacheMaxSize &&
        other.cacheDefaultExpiry == cacheDefaultExpiry &&
        other.encryptionKey == encryptionKey &&
        other.storageType == storageType;
  }
  
  @override
  int get hashCode {
    return Object.hash(
      appName,
      enableLogging,
      enableCaching,
      encryptSensitiveData,
      cacheMaxSize,
      cacheDefaultExpiry,
      encryptionKey,
      storageType,
    );
  }
}