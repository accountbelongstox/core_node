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

import 'package:flutter/foundation.dart';
import '../models_app_travel/user_model_app_travel.dart';
import '../services_app_travel/cache_service.dart';

class UserProviderAppTravel extends ChangeNotifier {
  UserModelAppTravel _user;
  final CacheService _cacheService;
  bool _isLoading = false;

  UserProviderAppTravel({
    CacheService? cacheService,
  })  : _user = UserModelAppTravel.empty(),
        _cacheService = cacheService ?? CacheService() {
    _loadUserFromStorage();
  }

  UserModelAppTravel get user => _user;
  bool get isLoggedIn => _user.isLoggedIn;
  bool get isLoading => _isLoading;

  Future<void> _loadUserFromStorage() async {
    try {
      _isLoading = true;
      notifyListeners();

      final userData = _cacheService.getJson('user_data');
      if (userData != null) {
        _user = UserModelAppTravel.fromJson(userData);
      }
    } catch (e) {
      debugPrint('Error loading user from storage: $e');
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<bool> login({
    required String username,
    required String password,
    bool isDebugMode = true,
  }) async {
    try {
      _isLoading = true;
      notifyListeners();

      if (isDebugMode) {
        await Future.delayed(const Duration(milliseconds: 500));

        _user = UserModelAppTravel(
          id: 'debug_${DateTime.now().millisecondsSinceEpoch}',
          username: username,
          email: '$username@travel.debug',
          isLoggedIn: true,
          favorites: [],
          bookmarks: [],
          currentCity: '塞班',
          lastLoginTime: DateTime.now(),
          createdAt: DateTime.now(),
          updatedAt: DateTime.now(),
        );

        await _saveUserToStorage();
        notifyListeners();
        return true;
      }

      return false;
    } catch (e) {
      debugPrint('Login error: $e');
      return false;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<bool> register({
    required String username,
    required String email,
    required String password,
  }) async {
    try {
      _isLoading = true;
      notifyListeners();

      await Future.delayed(const Duration(milliseconds: 500));

      _user = UserModelAppTravel(
        id: 'user_${DateTime.now().millisecondsSinceEpoch}',
        username: username,
        email: email,
        isLoggedIn: true,
        favorites: [],
        bookmarks: [],
        createdAt: DateTime.now(),
        updatedAt: DateTime.now(),
      );

      await _saveUserToStorage();
      notifyListeners();
      return true;
    } catch (e) {
      debugPrint('Register error: $e');
      return false;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> logout() async {
    try {
      _user = UserModelAppTravel.empty();
      await _cacheService.remove('user_data');
      notifyListeners();
    } catch (e) {
      debugPrint('Logout error: $e');
    }
  }

  Future<bool> updateProfile({
    String? username,
    String? email,
    String? avatarUrl,
    String? currentCity,
    Map<String, dynamic>? preferences,
  }) async {
    try {
      _user = _user.copyWith(
        username: username,
        email: email,
        avatarUrl: avatarUrl,
        currentCity: currentCity,
        preferences: preferences,
        updatedAt: DateTime.now(),
      );

      await _saveUserToStorage();
      notifyListeners();
      return true;
    } catch (e) {
      debugPrint('Update profile error: $e');
      return false;
    }
  }

  Future<void> addFavorite(String itemId) async {
    try {
      final favorites = List<String>.from(_user.favorites ?? []);
      if (!favorites.contains(itemId)) {
        favorites.add(itemId);
        _user = _user.copyWith(favorites: favorites);
        await _saveUserToStorage();
        notifyListeners();
      }
    } catch (e) {
      debugPrint('Add favorite error: $e');
    }
  }

  Future<void> removeFavorite(String itemId) async {
    try {
      final favorites = List<String>.from(_user.favorites ?? []);
      favorites.remove(itemId);
      _user = _user.copyWith(favorites: favorites);
      await _saveUserToStorage();
      notifyListeners();
    } catch (e) {
      debugPrint('Remove favorite error: $e');
    }
  }

  Future<void> addBookmark(String itemId) async {
    try {
      final bookmarks = List<String>.from(_user.bookmarks ?? []);
      if (!bookmarks.contains(itemId)) {
        bookmarks.add(itemId);
        _user = _user.copyWith(bookmarks: bookmarks);
        await _saveUserToStorage();
        notifyListeners();
      }
    } catch (e) {
      debugPrint('Add bookmark error: $e');
    }
  }

  Future<void> removeBookmark(String itemId) async {
    try {
      final bookmarks = List<String>.from(_user.bookmarks ?? []);
      bookmarks.remove(itemId);
      _user = _user.copyWith(bookmarks: bookmarks);
      await _saveUserToStorage();
      notifyListeners();
    } catch (e) {
      debugPrint('Remove bookmark error: $e');
    }
  }

  bool isFavorite(String itemId) {
    return _user.favorites?.contains(itemId) ?? false;
  }

  bool isBookmarked(String itemId) {
    return _user.bookmarks?.contains(itemId) ?? false;
  }

  Future<void> _saveUserToStorage() async {
    try {
      await _cacheService.setJson('user_data', _user.toJson());
    } catch (e) {
      debugPrint('Save user to storage error: $e');
    }
  }
}
