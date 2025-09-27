import 'dart:convert';
import 'dart:mirrors';
import 'package:flutter/foundation.dart';

/// Adaptive data parser that handles unexpected response structures
class AdaptiveDataParser {
  static AdaptiveDataParser? _instance;
  static AdaptiveDataParser get instance => _instance ??= AdaptiveDataParser._();
  AdaptiveDataParser._();

  // Cache for known data structures
  final Map<String, DataStructurePattern> _structureCache = {};

  // Error recovery patterns
  final Map<String, ErrorRecoveryPattern> _errorPatterns = {};

  /// Parse response data with automatic structure detection
  ParseResult<T> parseResponse<T>(
    dynamic rawData, {
    String? endpoint,
    Type? expectedType,
    Map<String, dynamic>? expectedStructure,
    bool enableLearning = true,
  }) {
    try {
      // Step 1: Validate basic data structure
      final validationResult = _validateBasicStructure(rawData);
      if (!validationResult.isValid) {
        return _handleStructureError<T>(rawData, validationResult, endpoint);
      }

      // Step 2: Try to parse with expected structure
      if (expectedStructure != null || expectedType != null) {
        final expectedResult = _tryExpectedParsing<T>(
          rawData,
          expectedType: expectedType,
          expectedStructure: expectedStructure,
        );

        if (expectedResult.isSuccess) {
          if (enableLearning && endpoint != null) {
            _learnStructurePattern(endpoint, rawData, expectedResult.structure!);
          }
          return expectedResult;
        }
      }

      // Step 3: Check cached patterns for this endpoint
      if (endpoint != null && _structureCache.containsKey(endpoint)) {
        final cachedPattern = _structureCache[endpoint]!;
        final cachedResult = _tryPatternParsing<T>(rawData, cachedPattern);

        if (cachedResult.isSuccess) {
          return cachedResult;
        }
      }

      // Step 4: Adaptive structure detection
      final adaptiveResult = _performAdaptiveParsing<T>(rawData);

      if (adaptiveResult.isSuccess && enableLearning && endpoint != null) {
        _learnStructurePattern(endpoint, rawData, adaptiveResult.structure!);
      }

      return adaptiveResult;

    } catch (error) {
      debugPrint('❌ Parsing error: $error');
      return ParseResult<T>.error(
        error: ParsingError.unknown,
        message: error.toString(),
        rawData: rawData,
      );
    }
  }

  /// Handle common API response wrappers
  dynamic unwrapApiResponse(dynamic data) {
    if (data is! Map<String, dynamic>) return data;

    // Common wrapper patterns
    final wrapperKeys = [
      'data', 'result', 'response', 'payload', 'body',
      'content', 'items', 'records', 'entities'
    ];

    for (final key in wrapperKeys) {
      if (data.containsKey(key) && data[key] != null) {
        // Additional validation for banking APIs
        if (_isLikelyDataWrapper(data, key)) {
          return data[key];
        }
      }
    }

    // Check for status + data pattern
    if (data.containsKey('status') && data.containsKey('data')) {
      final status = data['status'];
      if (status == 'success' || status == 200 || status == true) {
        return data['data'];
      }
    }

    // Check for error wrapper
    if (data.containsKey('error') && data['error'] == false && data.containsKey('data')) {
      return data['data'];
    }

    return data;
  }

  /// Extract list data from various response formats
  List<dynamic> extractListData(dynamic data) {
    final unwrapped = unwrapApiResponse(data);

    if (unwrapped is List) return unwrapped;

    if (unwrapped is Map<String, dynamic>) {
      // Common list container keys
      final listKeys = [
        'items', 'list', 'data', 'records', 'results',
        'transactions', 'accounts', 'transfers', 'payments'
      ];

      for (final key in listKeys) {
        if (unwrapped.containsKey(key) && unwrapped[key] is List) {
          return unwrapped[key] as List<dynamic>;
        }
      }

      // Check for pagination wrapper
      if (unwrapped.containsKey('page') || unwrapped.containsKey('pagination')) {
        final pageData = unwrapped['page'] ?? unwrapped['pagination'];
        if (pageData is Map && pageData.containsKey('items')) {
          return pageData['items'] as List<dynamic>? ?? [];
        }
      }
    }

    return [unwrapped];
  }

  /// Convert data to expected model type
  T? convertToModel<T>(dynamic data) {
    if (data == null) return null;

    try {
      // Handle primitive types
      if (T == String) return data.toString() as T;
      if (T == int) return int.tryParse(data.toString()) as T?;
      if (T == double) return double.tryParse(data.toString()) as T?;
      if (T == bool) return _parseBoolean(data) as T?;

      // Handle Map<String, dynamic>
      if (T == Map<String, dynamic>) {
        if (data is Map) {
          return Map<String, dynamic>.from(data) as T;
        }
        if (data is String) {
          try {
            return jsonDecode(data) as T;
          } catch (e) {
            return null;
          }
        }
      }

      // Handle List<dynamic>
      if (T.toString().startsWith('List<')) {
        if (data is List) {
          return data as T;
        }
        return extractListData(data) as T;
      }

      // Try to instantiate custom model class
      return _tryModelInstantiation<T>(data);

    } catch (error) {
      debugPrint('❌ Model conversion error for type $T: $error');
      return null;
    }
  }

  /// Get parsing statistics and patterns
  ParsingStats getStats() {
    final totalPatterns = _structureCache.length;
    final errorPatterns = _errorPatterns.length;
    final successRate = totalPatterns > 0 ?
        _structureCache.values.where((p) => p.successCount > 0).length / totalPatterns :
        0.0;

    return ParsingStats(
      totalEndpoints: totalPatterns,
      learnedPatterns: totalPatterns,
      errorRecoveryPatterns: errorPatterns,
      successRate: successRate,
      mostCommonStructures: _getMostCommonStructures(),
      recentErrors: _getRecentErrors(),
    );
  }

  /// Clear learned patterns (for testing or reset)
  void clearPatterns() {
    _structureCache.clear();
    _errorPatterns.clear();
    debugPrint('🧹 Cleared all learned parsing patterns');
  }

  // Private methods

  ValidationResult _validateBasicStructure(dynamic data) {
    if (data == null) {
      return ValidationResult(false, ParsingError.nullData, 'Response data is null');
    }

    if (data is String) {
      if (data.trim().isEmpty) {
        return ValidationResult(false, ParsingError.emptyData, 'Response data is empty');
      }

      // Try to parse JSON string
      try {
        jsonDecode(data);
        return ValidationResult(true, ParsingError.none, 'Valid JSON string');
      } catch (e) {
        // Check if it's a plain text response that should be treated as data
        if (data.length < 1000 && !data.contains('\n')) {
          return ValidationResult(true, ParsingError.none, 'Plain text response');
        }
        return ValidationResult(false, ParsingError.invalidJson, 'Invalid JSON: $e');
      }
    }

    return ValidationResult(true, ParsingError.none, 'Valid data structure');
  }

  ParseResult<T> _tryExpectedParsing<T>(
    dynamic data, {
    Type? expectedType,
    Map<String, dynamic>? expectedStructure,
  }) {
    try {
      final unwrapped = unwrapApiResponse(data);

      if (expectedStructure != null) {
        final matches = _matchesStructure(unwrapped, expectedStructure);
        if (matches) {
          final converted = convertToModel<T>(unwrapped);
          if (converted != null) {
            return ParseResult<T>.success(
              data: converted,
              structure: DataStructure.fromData(unwrapped),
            );
          }
        }
      }

      if (expectedType != null) {
        final converted = convertToModel<T>(unwrapped);
        if (converted != null) {
          return ParseResult<T>.success(
            data: converted,
            structure: DataStructure.fromData(unwrapped),
          );
        }
      }

      return ParseResult<T>.error(
        error: ParsingError.typeMismatch,
        message: 'Data does not match expected structure or type',
        rawData: data,
      );

    } catch (error) {
      return ParseResult<T>.error(
        error: ParsingError.conversionFailed,
        message: error.toString(),
        rawData: data,
      );
    }
  }

  ParseResult<T> _tryPatternParsing<T>(dynamic data, DataStructurePattern pattern) {
    try {
      final unwrapped = unwrapApiResponse(data);

      if (pattern.matches(unwrapped)) {
        final converted = convertToModel<T>(pattern.extractData(unwrapped));
        if (converted != null) {
          pattern.successCount++;
          return ParseResult<T>.success(
            data: converted,
            structure: pattern.structure,
          );
        }
      }

      pattern.failureCount++;
      return ParseResult<T>.error(
        error: ParsingError.patternMismatch,
        message: 'Data does not match cached pattern',
        rawData: data,
      );

    } catch (error) {
      pattern.failureCount++;
      return ParseResult<T>.error(
        error: ParsingError.patternError,
        message: error.toString(),
        rawData: data,
      );
    }
  }

  ParseResult<T> _performAdaptiveParsing<T>(dynamic data) {
    try {
      final unwrapped = unwrapApiResponse(data);

      // Generate multiple parsing strategies
      final strategies = _generateParsingStrategies<T>(unwrapped);

      for (final strategy in strategies) {
        try {
          final result = strategy.parse(unwrapped);
          if (result != null) {
            return ParseResult<T>.success(
              data: result,
              structure: DataStructure.fromData(unwrapped),
              strategy: strategy.name,
            );
          }
        } catch (e) {
          debugPrint('Strategy ${strategy.name} failed: $e');
          continue;
        }
      }

      return ParseResult<T>.error(
        error: ParsingError.noValidStrategy,
        message: 'No parsing strategy succeeded',
        rawData: data,
      );

    } catch (error) {
      return ParseResult<T>.error(
        error: ParsingError.adaptiveFailed,
        message: error.toString(),
        rawData: data,
      );
    }
  }

  ParseResult<T> _handleStructureError<T>(
    dynamic data,
    ValidationResult validation,
    String? endpoint,
  ) {
    // Try error recovery patterns
    if (endpoint != null && _errorPatterns.containsKey(endpoint)) {
      final pattern = _errorPatterns[endpoint]!;
      final recovered = pattern.tryRecover(data);

      if (recovered != null) {
        return parseResponse<T>(recovered, endpoint: endpoint, enableLearning: false);
      }
    }

    // Learn new error pattern
    if (endpoint != null) {
      _learnErrorPattern(endpoint, data, validation.error);
    }

    return ParseResult<T>.error(
      error: validation.error,
      message: validation.message,
      rawData: data,
      isRecoverable: _isRecoverableError(validation.error),
    );
  }

  List<ParsingStrategy<T>> _generateParsingStrategies<T>(dynamic data) {
    return [
      DirectParsingStrategy<T>(),
      ListExtractionStrategy<T>(),
      NestedObjectStrategy<T>(),
      BankingApiStrategy<T>(),
      FallbackStrategy<T>(),
    ];
  }

  bool _isLikelyDataWrapper(Map<String, dynamic> data, String key) {
    final value = data[key];
    final totalKeys = data.keys.length;

    // If this is the only meaningful key, it's likely a wrapper
    if (totalKeys == 1) return true;

    // If there are status/meta keys and this data key, it's likely a wrapper
    final metaKeys = ['status', 'code', 'message', 'meta', 'pagination', 'timestamp'];
    final nonMetaKeys = data.keys.where((k) => k != key && !metaKeys.contains(k)).length;

    return nonMetaKeys <= 1;
  }

  bool _matchesStructure(dynamic data, Map<String, dynamic> expectedStructure) {
    if (data is! Map<String, dynamic>) return false;

    for (final entry in expectedStructure.entries) {
      if (!data.containsKey(entry.key)) return false;

      final expectedType = entry.value;
      final actualValue = data[entry.key];

      if (expectedType is Type) {
        if (!_isOfType(actualValue, expectedType)) return false;
      } else if (expectedType is Map<String, dynamic>) {
        if (!_matchesStructure(actualValue, expectedType)) return false;
      }
    }

    return true;
  }

  bool _isOfType(dynamic value, Type expectedType) {
    if (expectedType == String) return value is String;
    if (expectedType == int) return value is int || (value is String && int.tryParse(value) != null);
    if (expectedType == double) return value is double || value is int || (value is String && double.tryParse(value) != null);
    if (expectedType == bool) return value is bool || _parseBoolean(value) != null;
    if (expectedType == List) return value is List;
    if (expectedType == Map) return value is Map;

    return true; // Unknown type, assume compatible
  }

  bool? _parseBoolean(dynamic value) {
    if (value is bool) return value;
    if (value is String) {
      final lower = value.toLowerCase();
      if (['true', '1', 'yes', 'on'].contains(lower)) return true;
      if (['false', '0', 'no', 'off'].contains(lower)) return false;
    }
    if (value is int) return value != 0;
    return null;
  }

  T? _tryModelInstantiation<T>(dynamic data) {
    // This would require reflection or code generation
    // For now, return null and handle in the specific app
    return null;
  }

  void _learnStructurePattern(String endpoint, dynamic rawData, DataStructure structure) {
    final pattern = _structureCache[endpoint];

    if (pattern == null) {
      _structureCache[endpoint] = DataStructurePattern(
        endpoint: endpoint,
        structure: structure,
        successCount: 1,
        failureCount: 0,
        lastUsed: DateTime.now(),
      );
    } else {
      pattern.successCount++;
      pattern.lastUsed = DateTime.now();
      // Optionally merge/update structure patterns
    }
  }

  void _learnErrorPattern(String endpoint, dynamic data, ParsingError error) {
    _errorPatterns[endpoint] = ErrorRecoveryPattern(
      endpoint: endpoint,
      errorType: error,
      rawData: data,
      recoveryAttempts: 0,
      lastSeen: DateTime.now(),
    );
  }

  bool _isRecoverableError(ParsingError error) {
    return error == ParsingError.invalidJson ||
           error == ParsingError.typeMismatch ||
           error == ParsingError.conversionFailed;
  }

  List<String> _getMostCommonStructures() {
    final structures = _structureCache.values
        .map((p) => p.structure.signature)
        .toList();

    final frequency = <String, int>{};
    for (final sig in structures) {
      frequency[sig] = (frequency[sig] ?? 0) + 1;
    }

    final sorted = frequency.entries.toList()
      ..sort((a, b) => b.value.compareTo(a.value));

    return sorted.take(5).map((e) => e.key).toList();
  }

  List<String> _getRecentErrors() {
    final recentErrors = _errorPatterns.values
        .where((p) => DateTime.now().difference(p.lastSeen).inHours < 24)
        .map((p) => '${p.endpoint}: ${p.errorType}')
        .toList();

    return recentErrors.take(10).toList();
  }
}

/// Data structure pattern for caching
class DataStructurePattern {
  final String endpoint;
  final DataStructure structure;
  int successCount;
  int failureCount;
  DateTime lastUsed;

  DataStructurePattern({
    required this.endpoint,
    required this.structure,
    required this.successCount,
    required this.failureCount,
    required this.lastUsed,
  });

  bool matches(dynamic data) {
    return structure.matches(data);
  }

  dynamic extractData(dynamic data) {
    return structure.extractRelevantData(data);
  }

  double get successRate =>
      successCount + failureCount > 0 ? successCount / (successCount + failureCount) : 0.0;
}

/// Error recovery pattern
class ErrorRecoveryPattern {
  final String endpoint;
  final ParsingError errorType;
  final dynamic rawData;
  int recoveryAttempts;
  DateTime lastSeen;

  ErrorRecoveryPattern({
    required this.endpoint,
    required this.errorType,
    required this.rawData,
    required this.recoveryAttempts,
    required this.lastSeen,
  });

  dynamic tryRecover(dynamic data) {
    recoveryAttempts++;

    switch (errorType) {
      case ParsingError.invalidJson:
        return _tryJsonRecovery(data);
      case ParsingError.emptyData:
        return _tryEmptyDataRecovery(data);
      case ParsingError.typeMismatch:
        return _tryTypeRecovery(data);
      default:
        return null;
    }
  }

  dynamic _tryJsonRecovery(dynamic data) {
    if (data is String) {
      // Try to fix common JSON issues
      String fixed = data
          .replaceAll("'", '"')  // Single quotes to double quotes
          .replaceAll('True', 'true')  // Python style booleans
          .replaceAll('False', 'false')
          .replaceAll('None', 'null');

      try {
        return jsonDecode(fixed);
      } catch (e) {
        return null;
      }
    }
    return null;
  }

  dynamic _tryEmptyDataRecovery(dynamic data) {
    // Return empty structure based on expected type
    return {};
  }

  dynamic _tryTypeRecovery(dynamic data) {
    // Try to coerce to expected type
    return data;
  }
}

/// Data structure analysis
class DataStructure {
  final String signature;
  final Map<String, Type> fields;
  final List<String> requiredFields;
  final int depth;

  DataStructure({
    required this.signature,
    required this.fields,
    required this.requiredFields,
    required this.depth,
  });

  factory DataStructure.fromData(dynamic data) {
    final signature = _generateSignature(data);
    final fields = _extractFields(data);
    final requiredFields = fields.keys.toList();
    final depth = _calculateDepth(data);

    return DataStructure(
      signature: signature,
      fields: fields,
      requiredFields: requiredFields,
      depth: depth,
    );
  }

  bool matches(dynamic data) {
    return _generateSignature(data) == signature;
  }

  dynamic extractRelevantData(dynamic data) {
    // Extract the core data based on learned structure
    return data;
  }

  static String _generateSignature(dynamic data) {
    if (data == null) return 'null';
    if (data is String) return 'string';
    if (data is int) return 'int';
    if (data is double) return 'double';
    if (data is bool) return 'bool';
    if (data is List) return 'list[${data.isNotEmpty ? _generateSignature(data.first) : 'unknown'}]';

    if (data is Map<String, dynamic>) {
      final keys = data.keys.toList()..sort();
      return 'map{${keys.join(',')}}';
    }

    return 'unknown';
  }

  static Map<String, Type> _extractFields(dynamic data) {
    final fields = <String, Type>{};

    if (data is Map<String, dynamic>) {
      for (final entry in data.entries) {
        fields[entry.key] = entry.value.runtimeType;
      }
    }

    return fields;
  }

  static int _calculateDepth(dynamic data, [int currentDepth = 0]) {
    if (data is Map) {
      int maxDepth = currentDepth;
      for (final value in data.values) {
        final depth = _calculateDepth(value, currentDepth + 1);
        if (depth > maxDepth) maxDepth = depth;
      }
      return maxDepth;
    } else if (data is List && data.isNotEmpty) {
      return _calculateDepth(data.first, currentDepth + 1);
    }

    return currentDepth;
  }
}

/// Parsing strategies
abstract class ParsingStrategy<T> {
  String get name;
  T? parse(dynamic data);
}

class DirectParsingStrategy<T> extends ParsingStrategy<T> {
  @override
  String get name => 'direct';

  @override
  T? parse(dynamic data) {
    return AdaptiveDataParser.instance.convertToModel<T>(data);
  }
}

class ListExtractionStrategy<T> extends ParsingStrategy<T> {
  @override
  String get name => 'list_extraction';

  @override
  T? parse(dynamic data) {
    final listData = AdaptiveDataParser.instance.extractListData(data);
    return AdaptiveDataParser.instance.convertToModel<T>(listData);
  }
}

class NestedObjectStrategy<T> extends ParsingStrategy<T> {
  @override
  String get name => 'nested_object';

  @override
  T? parse(dynamic data) {
    if (data is Map<String, dynamic>) {
      // Try to find the most complex nested object
      MapEntry<String, dynamic>? bestEntry;
      int maxComplexity = 0;

      for (final entry in data.entries) {
        if (entry.value is Map || entry.value is List) {
          final complexity = _calculateComplexity(entry.value);
          if (complexity > maxComplexity) {
            maxComplexity = complexity;
            bestEntry = entry;
          }
        }
      }

      if (bestEntry != null) {
        return AdaptiveDataParser.instance.convertToModel<T>(bestEntry.value);
      }
    }

    return null;
  }

  int _calculateComplexity(dynamic data) {
    if (data is Map) return data.length;
    if (data is List) return data.length;
    return 0;
  }
}

class BankingApiStrategy<T> extends ParsingStrategy<T> {
  @override
  String get name => 'banking_api';

  @override
  T? parse(dynamic data) {
    if (data is Map<String, dynamic>) {
      // Banking-specific data extraction
      final bankingKeys = [
        'account', 'accounts', 'balance', 'transaction', 'transactions',
        'transfer', 'transfers', 'payment', 'payments', 'card', 'cards'
      ];

      for (final key in bankingKeys) {
        if (data.containsKey(key)) {
          return AdaptiveDataParser.instance.convertToModel<T>(data[key]);
        }
      }
    }

    return null;
  }
}

class FallbackStrategy<T> extends ParsingStrategy<T> {
  @override
  String get name => 'fallback';

  @override
  T? parse(dynamic data) {
    // Last resort: try to return the data as-is if it matches the type
    if (data is T) return data;

    // Try string conversion for primitive types
    if (T == String) return data.toString() as T;

    return null;
  }
}

/// Parsing result model
class ParseResult<T> {
  final T? data;
  final bool isSuccess;
  final ParsingError error;
  final String message;
  final dynamic rawData;
  final DataStructure? structure;
  final String? strategy;
  final bool isRecoverable;

  const ParseResult._({
    this.data,
    required this.isSuccess,
    required this.error,
    required this.message,
    this.rawData,
    this.structure,
    this.strategy,
    this.isRecoverable = false,
  });

  factory ParseResult.success({
    required T data,
    DataStructure? structure,
    String? strategy,
  }) => ParseResult._(
    data: data,
    isSuccess: true,
    error: ParsingError.none,
    message: 'Parsing successful',
    structure: structure,
    strategy: strategy,
  );

  factory ParseResult.error({
    required ParsingError error,
    required String message,
    dynamic rawData,
    bool isRecoverable = false,
  }) => ParseResult._(
    isSuccess: false,
    error: error,
    message: message,
    rawData: rawData,
    isRecoverable: isRecoverable,
  );
}

/// Validation result model
class ValidationResult {
  final bool isValid;
  final ParsingError error;
  final String message;

  const ValidationResult(this.isValid, this.error, this.message);
}

/// Parsing statistics
class ParsingStats {
  final int totalEndpoints;
  final int learnedPatterns;
  final int errorRecoveryPatterns;
  final double successRate;
  final List<String> mostCommonStructures;
  final List<String> recentErrors;

  const ParsingStats({
    required this.totalEndpoints,
    required this.learnedPatterns,
    required this.errorRecoveryPatterns,
    required this.successRate,
    required this.mostCommonStructures,
    required this.recentErrors,
  });
}

/// Parsing error types
enum ParsingError {
  none,
  nullData,
  emptyData,
  invalidJson,
  typeMismatch,
  conversionFailed,
  patternMismatch,
  patternError,
  noValidStrategy,
  adaptiveFailed,
  unknown,
}