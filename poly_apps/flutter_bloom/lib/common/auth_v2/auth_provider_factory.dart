/// Authentication provider factory for creating and managing authentication providers
library auth_provider_factory;

import 'dart:async';
import 'package:flutter/foundation.dart';
import '../auth_interface.dart';
import '../auth_config.dart';
import 'providers/wechat_auth_provider.dart';
import 'providers/qq_auth_provider.dart';
import 'providers/google_auth_provider.dart';
import 'providers/github_auth_provider.dart';
import 'providers/phone_auth_provider.dart';

/// Authentication provider factory implementation
class AuthProviderFactory extends IAuthProviderFactory {
  final Map<AuthProvider, IAuthProvider Function()> _factories = {};
  final Map<AuthProvider, IAuthProvider> _instances = {};

  AuthProviderFactory() {
    // Register built-in providers
    _registerBuiltinProviders();
  }

  @override
  IAuthProvider createProvider(AuthProvider provider) {
    // Return existing instance if available
    if (_instances.containsKey(provider)) {
      return _instances[provider]!;
    }

    // Create new instance using factory
    final factory = _factories[provider];
    if (factory == null) {
      throw ArgumentError('Provider $provider is not registered');
    }

    final instance = factory();
    _instances[provider] = instance;
    return instance;
  }

  @override
  void registerProvider<T extends IAuthProvider>(
    AuthProvider type,
    T Function() factory,
  ) {
    _factories[type] = factory;
  }

  @override
  List<AuthProvider> getAvailableProviders() {
    return _factories.keys.toList();
  }

  @override
  bool isProviderSupported(AuthProvider provider) {
    return _factories.containsKey(provider);
  }

  /// Get provider instance without creating new one
  IAuthProvider? getProviderInstance(AuthProvider provider) {
    return _instances[provider];
  }

  /// Dispose all provider instances
  void disposeAll() {
    for (final instance in _instances.values) {
      try {
        instance.dispose();
      } catch (e) {
        if (kDebugMode) {
          print('Error disposing provider: $e');
        }
      }
    }
    _instances.clear();
  }

  /// Remove provider instance
  void removeProviderInstance(AuthProvider provider) {
    final instance = _instances.remove(provider);
    if (instance != null) {
      try {
        instance.dispose();
      } catch (e) {
        if (kDebugMode) {
          print('Error disposing provider: $e');
        }
      }
    }
  }

  /// Check if provider instance exists
  bool hasProviderInstance(AuthProvider provider) {
    return _instances.containsKey(provider);
  }

  /// Register built-in providers
  void _registerBuiltinProviders() {
    _factories[AuthProvider.wechat] = () => WeChatAuthProvider();
    _factories[AuthProvider.qq] = () => QQAuthProvider();
    _factories[AuthProvider.google] = () => GoogleAuthProvider();
    _factories[AuthProvider.github] = () => GitHubAuthProvider();
    _factories[AuthProvider.phone] = () => PhoneAuthProvider();
  }
}