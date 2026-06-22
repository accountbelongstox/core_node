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

/// Setting item types for different UI implementations
enum SettingType {
  toggle,      // Switch/Toggle button
  select,      // Dropdown/Select options
  checkbox,    // Checkbox
  slider,      // Slider for numeric values
  textInput,   // Text input field
  number,      // Number input field (integer)
  colorPicker, // Color picker
  custom,      // Custom implementation
}

/// Setting item model for universal settings template
class SettingItem {
  final String key;                    // Setting key for storage
  final String name;                   // Display name
  final String? description;           // Optional description
  final SettingType type;              // UI implementation type
  final dynamic defaultValue;         // Default value
  final List<dynamic>? options;        // Available options for select/checkbox
  final Map<String, String>? labels;  // Label texts for options
  final double? minValue;              // Min value for slider
  final double? maxValue;              // Max value for slider
  final int? minIntValue;              // Min value for number input
  final int? maxIntValue;              // Max value for number input
  final String? category;              // Setting category
  final bool isRequired;               // Whether this setting is required
  final String? appId;                 // App ID if this is app-specific setting
  final bool disableCache;             // Whether to disable caching for this setting (default: false)
  final String? placeholder;           // Placeholder text for input fields
  final String? validationPattern;     // Regex pattern for validation
  final String? validationMessage;     // Custom validation error message

  const SettingItem({
    required this.key,
    required this.name,
    required this.type,
    required this.defaultValue,
    this.description,
    this.options,
    this.labels,
    this.minValue,
    this.maxValue,
    this.minIntValue,
    this.maxIntValue,
    this.category,
    this.isRequired = false,
    this.appId,
    this.disableCache = false,
    this.placeholder,
    this.validationPattern,
    this.validationMessage,
  });

  /// Create a toggle setting
  factory SettingItem.toggle({
    required String key,
    required String name,
    String? description,
    bool defaultValue = false,
    String? category,
    bool isRequired = false,
    String? appId,
    bool disableCache = false,
  }) {
    return SettingItem(
      key: key,
      name: name,
      description: description,
      type: SettingType.toggle,
      defaultValue: defaultValue,
      category: category,
      isRequired: isRequired,
      appId: appId,
      disableCache: disableCache,
    );
  }

  /// Create a select setting
  factory SettingItem.select({
    required String key,
    required String name,
    String? description,
    required List<dynamic> options,
    required dynamic defaultValue,
    Map<String, String>? labels,
    String? category,
    bool isRequired = false,
    String? appId,
    bool disableCache = false,
  }) {
    return SettingItem(
      key: key,
      name: name,
      description: description,
      type: SettingType.select,
      defaultValue: defaultValue,
      options: options,
      labels: labels,
      category: category,
      isRequired: isRequired,
      appId: appId,
      disableCache: disableCache,
    );
  }

  /// Create a checkbox setting
  factory SettingItem.checkbox({
    required String key,
    required String name,
    String? description,
    required List<dynamic> options,
    List<dynamic> defaultValue = const [],
    Map<String, String>? labels,
    String? category,
    bool isRequired = false,
    String? appId,
    bool disableCache = false,
  }) {
    return SettingItem(
      key: key,
      name: name,
      description: description,
      type: SettingType.checkbox,
      defaultValue: defaultValue,
      options: options,
      labels: labels,
      category: category,
      isRequired: isRequired,
      appId: appId,
      disableCache: disableCache,
    );
  }

  /// Create a slider setting
  factory SettingItem.slider({
    required String key,
    required String name,
    String? description,
    required double defaultValue,
    required double minValue,
    required double maxValue,
    String? category,
    bool isRequired = false,
    String? appId,
    bool disableCache = false,
  }) {
    return SettingItem(
      key: key,
      name: name,
      description: description,
      type: SettingType.slider,
      defaultValue: defaultValue,
      minValue: minValue,
      maxValue: maxValue,
      category: category,
      isRequired: isRequired,
      appId: appId,
      disableCache: disableCache,
    );
  }

  /// Create a text input setting
  factory SettingItem.textInput({
    required String key,
    required String name,
    String? description,
    String defaultValue = '',
    String? category,
    bool isRequired = false,
    String? appId,
    bool disableCache = false,
    String? placeholder,
    String? validationPattern,
    String? validationMessage,
  }) {
    return SettingItem(
      key: key,
      name: name,
      description: description,
      type: SettingType.textInput,
      defaultValue: defaultValue,
      category: category,
      isRequired: isRequired,
      appId: appId,
      disableCache: disableCache,
      placeholder: placeholder,
      validationPattern: validationPattern,
      validationMessage: validationMessage,
    );
  }

  /// Create a number input setting (alias for textInput with number validation)
  factory SettingItem.number({
    required String key,
    required String name,
    String? description,
    int defaultValue = 0,
    String? category,
    bool isRequired = false,
    String? appId,
    bool disableCache = false,
    int? minIntValue,
    int? maxIntValue,
    String? placeholder,
    String? validationMessage,
  }) {
    return SettingItem(
      key: key,
      name: name,
      description: description,
      type: SettingType.number,
      defaultValue: defaultValue,
      category: category,
      isRequired: isRequired,
      appId: appId,
      disableCache: disableCache,
      minIntValue: minIntValue,
      maxIntValue: maxIntValue,
      placeholder: placeholder,
      validationMessage: validationMessage,
    );
  }

  /// Create a text setting (alias for textInput for backward compatibility)
  factory SettingItem.text({
    required String key,
    required String name,
    String? description,
    String defaultValue = '',
    String? category,
    bool isRequired = false,
    String? appId,
    bool disableCache = false,
    String? placeholder,
    String? validationPattern,
    String? validationMessage,
  }) {
    return SettingItem.textInput(
      key: key,
      name: name,
      description: description,
      defaultValue: defaultValue,
      category: category,
      isRequired: isRequired,
      appId: appId,
      disableCache: disableCache,
      placeholder: placeholder,
      validationPattern: validationPattern,
      validationMessage: validationMessage,
    );
  }

  /// Create a color picker setting
  factory SettingItem.colorPicker({
    required String key,
    required String name,
    String? description,
    String defaultValue = '#000000',
    String? category,
    bool isRequired = false,
    String? appId,
    bool disableCache = false,
  }) {
    return SettingItem(
      key: key,
      name: name,
      description: description,
      type: SettingType.colorPicker,
      defaultValue: defaultValue,
      category: category,
      isRequired: isRequired,
      appId: appId,
      disableCache: disableCache,
    );
  }

  /// Create a custom setting
  factory SettingItem.custom({
    required String key,
    required String name,
    String? description,
    dynamic defaultValue,
    String? category,
    bool isRequired = false,
    String? appId,
    bool disableCache = false,
  }) {
    return SettingItem(
      key: key,
      name: name,
      description: description,
      type: SettingType.custom,
      defaultValue: defaultValue,
      category: category,
      isRequired: isRequired,
      appId: appId,
      disableCache: disableCache,
    );
  }

  /// Get storage key with app prefix if needed
  String get storageKey {
    if (appId != null) {
      return 'app_${appId}_$key';
    }
    return key;
  }

  /// Check if this is an app-specific setting
  bool get isAppSpecific => appId != null;

  /// Check if this is a base setting
  bool get isBaseSetting => appId == null;

  /// Check if this setting has validation rules
  bool get hasValidation => validationPattern != null || validationMessage != null;

  /// Check if this setting has numeric constraints
  bool get hasNumericConstraints => 
      (minValue != null && maxValue != null) || 
      (minIntValue != null && maxIntValue != null);

  /// Validate a value against this setting's constraints
  bool validateValue(dynamic value) {
    if (validationPattern != null && value is String) {
      final regex = RegExp(validationPattern!);
      if (!regex.hasMatch(value)) {
        return false;
      }
    }

    if (type == SettingType.number && value is int) {
      if (minIntValue != null && value < minIntValue!) return false;
      if (maxIntValue != null && value > maxIntValue!) return false;
    }

    if (type == SettingType.slider && value is double) {
      if (minValue != null && value < minValue!) return false;
      if (maxValue != null && value > maxValue!) return false;
    }

    return true;
  }

  /// Get validation error message
  String? getValidationError(dynamic value) {
    if (!validateValue(value)) {
      if (validationMessage != null) {
        return validationMessage;
      }
      
      if (type == SettingType.number && value is int) {
        if (minIntValue != null && value < minIntValue!) {
          return 'Value must be at least $minIntValue';
        }
        if (maxIntValue != null && value > maxIntValue!) {
          return 'Value must be at most $maxIntValue';
        }
      }
      
      if (type == SettingType.slider && value is double) {
        if (minValue != null && value < minValue!) {
          return 'Value must be at least $minValue';
        }
        if (maxValue != null && value > maxValue!) {
          return 'Value must be at most $maxValue';
        }
      }
      
      if (validationPattern != null && value is String) {
        return 'Invalid format';
      }
    }
    return null;
  }

  @override
  bool operator ==(Object other) {
    if (identical(this, other)) return true;
    return other is SettingItem && other.key == key && other.appId == appId;
  }

  @override
  int get hashCode => key.hashCode ^ (appId?.hashCode ?? 0);

  @override
  String toString() {
    return 'SettingItem(key: $key, name: $name, type: $type, appId: $appId)';
  }
}
