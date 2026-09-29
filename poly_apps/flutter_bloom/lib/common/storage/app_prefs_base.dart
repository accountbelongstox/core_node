import 'package:shared_preferences/shared_preferences.dart';

/// Base class for all app-specific SharedPreferences classes
/// 
/// This abstract class defines the required interface that all app-specific
/// SharedPreferences classes must implement to work with the common app system.
/// 
/// DESIGN:
/// - Provides a common interface for all apps
/// - Ensures type safety and consistency across different apps
/// - Allows the common system to work with any app's SharedPreferences implementation
/// 
/// IMPLEMENTATION REQUIREMENTS:
/// All app-specific SharedPreferences classes MUST extend this class and implement:
/// - setInstance() method to receive the initialized SharedPreferences instance
/// - getInstance() method to provide access to the SharedPreferences instance
/// - isInitialized getter to check initialization status
abstract class AppPrefsBase {
  /// Check if the SharedPreferences instance is properly initialized
  bool get isInitialized;



  /// Initialize the SharedPreferences instance automatically
  /// 
  /// This method is called by the common app system after Flutter binding is ready
  /// and automatically generates the SharedPreferences instance.
  /// 
  /// IMPLEMENTATION REQUIREMENT:
  /// This method MUST be implemented by all app-specific SharedPreferences classes
  /// and MUST return the initialized SharedPreferences instance
  Future<SharedPreferences> initSharedPreferences();

  /// Get the currently initialized SharedPreferences instance
  /// 
  /// This method provides access to the SharedPreferences instance that was set
  /// via setInstance() method.
  /// 
  /// IMPLEMENTATION REQUIREMENT:
  /// This method MUST be implemented by all app-specific SharedPreferences classes
  /// and MUST return a valid SharedPreferences instance
  /// 
  /// THROWS:
  /// Exception if not properly initialized
  SharedPreferences getInstance();

  /// Get value with app-specific prefix
  /// 
  /// This method should be implemented to provide app-specific key prefixing
  /// to avoid conflicts between different apps
  T? get<T>(String key, [T? defaultValue]);

  /// Set value with app-specific prefix
  /// 
  /// This method should be implemented to provide app-specific key prefixing
  /// to avoid conflicts between different apps
  Future<bool> set<T>(String key, T value);

  /// Remove value with app-specific prefix
  /// 
  /// This method should be implemented to provide app-specific key prefixing
  /// to avoid conflicts between different apps
  Future<bool> remove(String key);

  /// Check if key exists with app-specific prefix
  /// 
  /// This method should be implemented to provide app-specific key prefixing
  /// to avoid conflicts between different apps
  bool containsKey(String key);

  /// Get all app-specific keys (without prefix)
  /// 
  /// This method should be implemented to provide app-specific key prefixing
  /// to avoid conflicts between different apps
  Set<String> getKeys();

  /// Clear all app-specific preferences
  /// 
  /// This method should be implemented to provide app-specific key prefixing
  /// to avoid conflicts between different apps
  Future<void> clearAll();
}
