import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import '../../../common/provider_status/user_provider.dart';
import '../../../common/storage_tools/storage_manager.dart';
import '../../../common/storage/unified_storage.dart';
import '../../../common/cache_manager/cache_manager.dart';
// Fix: Import AuthType explicitly from network_types.dart
import '../../../common/network/core/network_types.dart' show AuthType;
import '../models_app_bank/bank_user_model.dart';
import '../models_app_bank/bank_global_data.dart';
import '../models_app_bank/bank_card_model.dart';
import '../config_app_bank/prefs_app_bank.dart';
import '../config_app_bank/bank_storage_keys.dart';

/// Bank User Provider extending the base user provider
/// Manages bank user data with persistent storage, caching, and authentication metadata
class BankUserProvider extends BaseUserProvider with WidgetsBindingObserver {

  BankUserModel? _user;
  BankGlobalData? _globalData;
  bool _isDebugMode = false;
  bool _isDashboardBalanceVisible = false;
  bool _isProfileBalanceVisible = false;
  bool _isInvestmentBalanceVisible = false;
  bool _isInitialized = false;
  AppLifecycleState? _lastAppLifecycleState;
  AuthMetadata _authMetadata = const AuthMetadata();
  List<BankCardModel> _bankCards = [];
  double _holdingsTotal = 0.0;

  final StorageManager _storage = StorageManager.instance;
  final CacheManager _cache = CacheManager.instance;

  /// Get current user
  @override
  BankUserModel? get user => _user;

  /// Get global data
  BankGlobalData? get globalData => _globalData;

  /// Check if debug mode is enabled
  bool get isDebugMode => _isDebugMode;

  /// Check if dashboard balance is visible
  bool get isDashboardBalanceVisible => _isDashboardBalanceVisible;

  /// Check if profile balance is visible
  bool get isProfileBalanceVisible => _isProfileBalanceVisible;

  /// Check if investment balance is visible
  bool get isInvestmentBalanceVisible => _isInvestmentBalanceVisible;

  /// Check if provider is initialized
  bool get isInitialized => _isInitialized;

  @override
  bool get isAuthenticated => _authMetadata.isAuthenticated || _user != null;

  @override
  String? get token => _authMetadata.jwtToken;

  @override
  String? get userToken => _user?.userToken;

  @override
  String? get tokenType =>
      _authMetadata.authType == AuthType.jwt ? 'Bearer' : null;

  @override
  AuthMetadata get authMetadata => _authMetadata;

  @override
  bool get needsAuthRefresh => _authMetadata.needsRefresh;

  /// Get bank cards list
  List<BankCardModel> get bankCards => _bankCards;

  /// Get total assets (sum of all card balances)
  double get totalAssets {
    return _bankCards.fold(0.0, (sum, card) => sum + card.balance);
  }

  /// Get current balance (活期)
  double get currentBalance {
    return _bankCards
        .where((card) => card.cardType == '储蓄卡' || card.cardType == '活期' || card.cardType == 'current')
        .fold(0.0, (sum, card) => sum + card.balance);
  }

  /// Get holdings total (持仓总额)
  double get holdingsTotal {
    return _holdingsTotal;
  }

  /// Initialize the provider
  Future<void> initialize() async {
    if (_isInitialized) return;

    try {
      // Initialize UnifiedStorage
      await UnifiedStorage.init(appName: 'bank_app');

      // Initialize storage
      await _storage.init(appName: 'bank_app');
      await _storage.openBox(BankStorageKeys.boxName);

      // Load data
      await _loadUserData();
      await _loadGlobalData();
      await _loadDebugMode();
      await _loadAuthMetadata();
      await _loadBalanceVisibilityStates();
      await _loadBankCards();
      await _loadHoldingsTotal();

      // Load global state from UnifiedStorage
      await _loadGlobalStateFromUnifiedStorage();
      
      // Load login status from UnifiedStorage
      await _loadLoginStatusFromUnifiedStorage();

      // Sync phone number from PrefsAppBank if not in user/globalData
      await _syncPhoneFromPrefs();

      // Update session data
      await _updateSessionData();

      // Sync user data to UnifiedStorage
      await _syncToUnifiedStorage();

      WidgetsBinding.instance.addObserver(this);
      _isInitialized = true;
      notifyListeners();
    } catch (e) {
      debugPrint('BankUserProvider initialization error: $e');
      await _createDefaultData();
      _isInitialized = true;
      notifyListeners();
    }
  }

  /// Load user data from storage
  Future<void> _loadUserData() async {
    try {
      final userData = await _storage.getValue<String>(BankStorageKeys.boxName, BankStorageKeys.userKey);
      if (userData != null && userData.isNotEmpty) {
        _user = BankUserModel.fromJsonString(userData);
      } else {
        _user = null;
      }
    } catch (e) {
      debugPrint('Error loading user data: $e');
      _user = null;
    }
  }

  /// Load global data from storage
  Future<void> _loadGlobalData() async {
    try {
      final globalDataString =
          await _storage.getValue<String>(BankStorageKeys.boxName, BankStorageKeys.globalDataKey);
      if (globalDataString != null && globalDataString.isNotEmpty) {
        _globalData = BankGlobalData.fromJsonString(globalDataString);
      } else {
        _globalData = BankGlobalData.defaultData();
      }
    } catch (e) {
      debugPrint('Error loading global data: $e');
      _globalData = BankGlobalData.defaultData();
    }
  }

  /// Load debug mode setting
  Future<void> _loadDebugMode() async {
    try {
      _isDebugMode =
          await _storage.getValue<bool>(BankStorageKeys.boxName, BankStorageKeys.debugModeKey) ?? false;
    } catch (e) {
      debugPrint('Error loading debug mode: $e');
      _isDebugMode = false;
    }
  }

  /// Load authentication metadata
  Future<void> _loadAuthMetadata() async {
    try {
      final authData = await _storage.getValue<Map<String, dynamic>>(
          BankStorageKeys.boxName, BankStorageKeys.authMetadataKey);
      if (authData != null) {
        _authMetadata = AuthMetadata.fromMap(authData);
      }
    } catch (e) {
      debugPrint('Error loading auth metadata: $e');
      _authMetadata = const AuthMetadata();
    }
  }

  /// Load balance visibility states (always hidden on cold start; not persisted)
  Future<void> _loadBalanceVisibilityStates() async {
    _isDashboardBalanceVisible = false;
    _isProfileBalanceVisible = false;
    _isInvestmentBalanceVisible = false;
  }

  /// Load bank cards from storage
  Future<void> _loadBankCards() async {
    try {
      final cardsData =
          await _storage.getValue<String>(BankStorageKeys.boxName, BankStorageKeys.bankCardsKey);
      if (cardsData != null && cardsData.isNotEmpty) {
        try {
          final List<BankCardModel> cardsList = [];
          final cardStrings = cardsData.split('|||');
          for (var cardStr in cardStrings) {
            if (cardStr.trim().isEmpty) continue;
            final Map<String, dynamic> cardMap = {};
            final parts = cardStr.split('||');
            for (var part in parts) {
              final kv = part.split('::');
              if (kv.length == 2) {
                final key = kv[0].trim();
                var value = kv[1].trim();
                if (key == 'balance') {
                  cardMap[key] = double.tryParse(value) ?? 0.0;
                } else if (key == 'opened_at' && value != 'null') {
                  try {
                    cardMap[key] = value;
                  } catch (e) {
                    cardMap[key] = null;
                  }
                } else {
                  cardMap[key] = value == 'null' ? null : value;
                }
              }
            }
            if (cardMap.containsKey('card_number') &&
                cardMap.containsKey('card_type') &&
                cardMap.containsKey('balance')) {
              cardsList.add(BankCardModel.fromMap(cardMap));
            }
          }
          if (cardsList.isNotEmpty) {
            _bankCards = cardsList;
          } else {
            _bankCards = [];
          }
        } catch (e) {
          debugPrint('Error parsing bank cards: $e');
          _bankCards = [];
          try {
            await _storage.deleteKey(BankStorageKeys.boxName, BankStorageKeys.bankCardsKey);
          } catch (_) {}
        }
      } else {
        _bankCards = [];
      }
    } catch (e) {
      debugPrint('Error loading bank cards: $e');
      _bankCards = [];
    }
  }

  /// Load holdings total from storage
  Future<void> _loadHoldingsTotal() async {
    try {
      final holdingsTotal = await UnifiedStorage.get<double>(BankStorageKeys.holdingsTotalKey);
      if (holdingsTotal != null && holdingsTotal > 0) {
        _holdingsTotal = holdingsTotal;
      }
    } catch (e) {
      debugPrint('Error loading holdings total: $e');
      _holdingsTotal = 0.0;
    }
  }

  /// Save holdings total to storage
  Future<void> _saveHoldingsTotal() async {
    try {
      await UnifiedStorage.set(BankStorageKeys.holdingsTotalKey, _holdingsTotal);
    } catch (e) {
      debugPrint('Error saving holdings total: $e');
    }
  }

  /// Update holdings total
  Future<void> updateHoldingsTotal(double holdingsTotal) async {
    _holdingsTotal = holdingsTotal;
    await _saveHoldingsTotal();
    notifyListeners();
  }

  /// Save bank cards to storage
  Future<void> _saveBankCards() async {
    try {
      final cardsJson = _bankCards.map((card) {
        final map = card.toMap();
        return map.entries.map((e) {
          final value = e.value?.toString() ?? 'null';
          return '${e.key}::$value';
        }).join('||');
      }).join('|||');
      await _storage.putValue(BankStorageKeys.boxName, BankStorageKeys.bankCardsKey, cardsJson);
    } catch (e) {
      debugPrint('Error saving bank cards: $e');
    }
  }

  /// Add a new bank card
  Future<void> addBankCard(BankCardModel card) async {
    _bankCards.add(card);
    await _saveBankCards();
    notifyListeners();
  }

  /// Update a bank card
  Future<void> updateBankCard(int index, BankCardModel card) async {
    if (index >= 0 && index < _bankCards.length) {
      _bankCards[index] = card;
      await _saveBankCards();
      notifyListeners();
    }
  }

  /// Remove a bank card
  Future<void> removeBankCard(int index) async {
    if (index >= 0 && index < _bankCards.length) {
      _bankCards.removeAt(index);
      await _saveBankCards();
      notifyListeners();
    }
  }

  /// Update session data
  Future<void> _updateSessionData() async {
    if (_globalData == null) return;

    final now = DateTime.now();
    _globalData = _globalData!.copyWith(
      lastActiveTime: now,
      sessionCount: _globalData!.sessionCount + 1,
    );

    await _saveGlobalData();
  }

  /// Create default data
  Future<void> _createDefaultData() async {
    _user = null;
    _globalData = BankGlobalData.defaultData();
    _bankCards = [];
    _isDebugMode = false;
    _authMetadata = const AuthMetadata();

    await _saveGlobalData();
    await _saveDebugMode();
    await _saveAuthMetadata();
    try {
      await _storage.deleteKey(BankStorageKeys.boxName, BankStorageKeys.bankCardsKey);
    } catch (_) {}
  }

  /// Save user data to storage
  Future<void> _saveUserData() async {
    if (_user == null) return;
    try {
      await _storage.putValue(BankStorageKeys.boxName, BankStorageKeys.userKey, _user!.toJsonString());
      await _cache.put('bank_user', 'user_data', _user!,
          ttl: const Duration(hours: 24));
    } catch (e) {
      debugPrint('Error saving user data: $e');
    }
  }

  /// Save global data to storage
  Future<void> _saveGlobalData() async {
    if (_globalData == null) return;
    try {
      await _storage.putValue(
          BankStorageKeys.boxName, BankStorageKeys.globalDataKey, _globalData!.toJsonString());
    } catch (e) {
      debugPrint('Error saving global data: $e');
    }
  }

  /// Save debug mode setting
  Future<void> _saveDebugMode() async {
    try {
      await _storage.putValue(BankStorageKeys.boxName, BankStorageKeys.debugModeKey, _isDebugMode);
    } catch (e) {
      debugPrint('Error saving debug mode: $e');
    }
  }

  /// Save authentication metadata
  Future<void> _saveAuthMetadata() async {
    try {
      await _storage.putValue(
          BankStorageKeys.boxName, BankStorageKeys.authMetadataKey, _authMetadata.toMap());
    } catch (e) {
      debugPrint('Error saving auth metadata: $e');
    }
  }

  /// Update user data
  Future<void> updateUser({
    String? name,
    String? location,
    double? balance,
    int? cardCount,
    int? points,
    int? coupons,
    String? creditCardLevel,
    String? fullName,
    String? phone,
    String? street,
    String? city,
    String? state,
    String? zipCode,
    String? country,
  }) async {
    if (_user == null) return;

    _user = _user!.copyWith(
      name: name,
      location: location,
      balance: balance,
      cardCount: cardCount,
      points: points,
      coupons: coupons,
      creditCardLevel: creditCardLevel,
      fullName: fullName,
      phone: phone,
      street: street,
      city: city,
      state: state,
      zipCode: zipCode,
      country: country,
    );

    await _saveUserData();

    // Update global data
    if (_globalData != null) {
      _globalData = _globalData!.copyWith(
        location: location ?? _user!.location,
        city: city ?? _user!.city,
        balance: balance ?? _user!.balance,
        username: _user!.username,
        fullName: fullName ?? _user!.fullName,
        points: points ?? _user!.points,
        coupons: coupons ?? _user!.coupons,
        creditCardLevel: creditCardLevel ?? _user!.creditCardLevel,
      );
      await _saveGlobalData();
    }

    // Sync to UnifiedStorage
    await _syncToUnifiedStorage();

    notifyListeners();
  }

  /// Update global state data
  Future<void> updateGlobalState({
    String? location,
    String? city,
    double? balance,
    String? username,
    String? fullName,
    int? points,
    int? coupons,
    String? creditCardLevel,
  }) async {
    if (_globalData == null) {
      _globalData = BankGlobalData.defaultData();
    }

    _globalData = _globalData!.copyWith(
      location: location,
      city: city,
      balance: balance,
      username: username,
      fullName: fullName,
      points: points,
      coupons: coupons,
      creditCardLevel: creditCardLevel,
    );

    await _saveGlobalData();
    await _syncToUnifiedStorage();
    notifyListeners();
  }

  /// Load global state from UnifiedStorage
  Future<void> _loadGlobalStateFromUnifiedStorage() async {
    try {
      final location = await UnifiedStorage.get<String>(BankStorageKeys.locationKey);
      final city = await UnifiedStorage.get<String>(BankStorageKeys.cityKey);
      final balance = await UnifiedStorage.get<double>(BankStorageKeys.balanceKey);
      final username = await UnifiedStorage.get<String>(BankStorageKeys.usernameKey);
      final fullName = await UnifiedStorage.get<String>(BankStorageKeys.fullNameKey);
      final points = await UnifiedStorage.get<int>(BankStorageKeys.pointsKey);
      final coupons = await UnifiedStorage.get<int>(BankStorageKeys.couponsKey);
      final creditCardLevel =
          await UnifiedStorage.get<String>(BankStorageKeys.creditCardLevelKey);

      if (location != null ||
          city != null ||
          balance != null ||
          username != null ||
          fullName != null ||
          points != null ||
          coupons != null ||
          creditCardLevel != null) {
        if (_globalData == null) {
          _globalData = BankGlobalData.defaultData();
        }

        _globalData = _globalData!.copyWith(
          location: location,
          city: city,
          balance: balance,
          username: username,
          fullName: fullName,
          points: points,
          coupons: coupons,
          creditCardLevel: creditCardLevel,
        );
      }
    } catch (e) {
      debugPrint('Error loading global state from UnifiedStorage: $e');
    }
  }

  /// Load login status from UnifiedStorage
  Future<void> _loadLoginStatusFromUnifiedStorage() async {
    try {
      final isLoggedIn = await UnifiedStorage.get<bool>(BankStorageKeys.isLoggedInKey);
      if (isLoggedIn == true) {
        _authMetadata = _authMetadata.copyWith(
          isAuthenticated: true,
        );
      }
    } catch (e) {
      debugPrint('Error loading login status from UnifiedStorage: $e');
    }
  }

  /// Sync phone number from PrefsAppBank to user/globalData if not exists
  Future<void> _syncPhoneFromPrefs() async {
    try {
      final currentPhone = _user?.phone ?? _globalData?.username;
      if (currentPhone == null || currentPhone.isEmpty) {
        final prefs = PrefsAppBank();
        if (!prefs.isInitialized) {
          await prefs.initSharedPreferences();
        }
        final phoneFromPrefs = prefs.getString('phone_number');
        if (phoneFromPrefs != null && phoneFromPrefs.isNotEmpty) {
          final maskedName = phoneFromPrefs.length >= 4 
              ? '*${phoneFromPrefs.substring(phoneFromPrefs.length - 4)}' 
              : '*$phoneFromPrefs';
          
          if (_user != null) {
            _user = _user!.copyWith(phone: phoneFromPrefs, fullName: maskedName);
            await _saveUserData();
          }
          if (_globalData != null) {
            _globalData = _globalData!.copyWith(username: phoneFromPrefs, fullName: maskedName);
            await _saveGlobalData();
          } else {
            _globalData = BankGlobalData.defaultData().copyWith(username: phoneFromPrefs, fullName: maskedName);
            await _saveGlobalData();
          }
        }
      }
    } catch (e) {
      debugPrint('Error syncing phone from PrefsAppBank: $e');
    }
  }

  /// Sync global state to UnifiedStorage
  Future<void> _syncToUnifiedStorage() async {
    try {
      if (_globalData != null) {
        if (_globalData!.location != null) {
          await UnifiedStorage.set(BankStorageKeys.locationKey, _globalData!.location!);
        }
        if (_globalData!.city != null) {
          await UnifiedStorage.set(BankStorageKeys.cityKey, _globalData!.city!);
        }
        if (_globalData!.balance != null) {
          await UnifiedStorage.set(BankStorageKeys.balanceKey, _globalData!.balance!);
        }
        if (_globalData!.username != null) {
          await UnifiedStorage.set(BankStorageKeys.usernameKey, _globalData!.username!);
        }
        if (_globalData!.fullName != null) {
          await UnifiedStorage.set(BankStorageKeys.fullNameKey, _globalData!.fullName!);
        }
        if (_globalData!.points != null) {
          await UnifiedStorage.set(BankStorageKeys.pointsKey, _globalData!.points!);
        }
        if (_globalData!.coupons != null) {
          await UnifiedStorage.set(BankStorageKeys.couponsKey, _globalData!.coupons!);
        }
        if (_globalData!.creditCardLevel != null) {
          await UnifiedStorage.set(
              BankStorageKeys.creditCardLevelKey, _globalData!.creditCardLevel!);
        }
      }

      // Also sync from user model if available
      if (_user != null) {
        if (_user!.location != null) {
          await UnifiedStorage.set(BankStorageKeys.locationKey, _user!.location!);
        }
        if (_user!.city != null) {
          await UnifiedStorage.set(BankStorageKeys.cityKey, _user!.city!);
        }
        await UnifiedStorage.set(BankStorageKeys.balanceKey, _user!.balance);
        if (_user!.username != null) {
          await UnifiedStorage.set(BankStorageKeys.usernameKey, _user!.username!);
        }
        if (_user!.fullName != null) {
          await UnifiedStorage.set(BankStorageKeys.fullNameKey, _user!.fullName!);
        }
        await UnifiedStorage.set(BankStorageKeys.pointsKey, _user!.points);
        await UnifiedStorage.set(BankStorageKeys.couponsKey, _user!.coupons);
        if (_user!.creditCardLevel != null) {
          await UnifiedStorage.set(
              BankStorageKeys.creditCardLevelKey, _user!.creditCardLevel!);
        }
      }
    } catch (e) {
      debugPrint('Error syncing to UnifiedStorage: $e');
    }
  }

  /// Set debug mode
  Future<void> setDebugMode(bool enabled) async {
    _isDebugMode = enabled;
    await _saveDebugMode();
    notifyListeners();
  }

  /// Reset all balance visibility to hidden (e.g. when app resumed from background)
  void resetAllBalanceVisibilityToHidden() {
    if (_isDashboardBalanceVisible ||
        _isProfileBalanceVisible ||
        _isInvestmentBalanceVisible) {
      _isDashboardBalanceVisible = false;
      _isProfileBalanceVisible = false;
      _isInvestmentBalanceVisible = false;
      notifyListeners();
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    final wasInBackground = _lastAppLifecycleState == AppLifecycleState.paused ||
        _lastAppLifecycleState == AppLifecycleState.inactive;
    _lastAppLifecycleState = state;
    if (state == AppLifecycleState.resumed && wasInBackground) {
      resetAllBalanceVisibilityToHidden();
    }
  }

  /// Toggle dashboard balance visibility (session-only, not persisted)
  void toggleDashboardBalanceVisibility() {
    _isDashboardBalanceVisible = !_isDashboardBalanceVisible;
    notifyListeners();
  }

  /// Toggle profile balance visibility (session-only, not persisted)
  void toggleProfileBalanceVisibility() {
    _isProfileBalanceVisible = !_isProfileBalanceVisible;
    notifyListeners();
  }

  /// Set dashboard balance visibility (session-only, not persisted)
  void setDashboardBalanceVisibility(bool visible) {
    _isDashboardBalanceVisible = visible;
    notifyListeners();
  }

  /// Set profile balance visibility (session-only, not persisted)
  void setProfileBalanceVisibility(bool visible) {
    _isProfileBalanceVisible = visible;
    notifyListeners();
  }

  /// Toggle investment balance visibility (session-only, not persisted)
  void toggleInvestmentBalanceVisibility() {
    _isInvestmentBalanceVisible = !_isInvestmentBalanceVisible;
    notifyListeners();
  }

  /// Set investment balance visibility (session-only, not persisted)
  void setInvestmentBalanceVisibility(bool visible) {
    _isInvestmentBalanceVisible = visible;
    notifyListeners();
  }

  /// Reset to default data
  Future<void> resetToDefault() async {
    await _createDefaultData();
    notifyListeners();
  }

  /// Clear all user storage data (but preserve registration info)
  /// CRITICAL: Registration information is NEVER cleared by this method
  /// Registration info can only be cleared by unregister() or re-registration
  Future<void> clearUserStorageData() async {
    try {
      // Clear in-memory state
      _user = null;
      _globalData = null;
      _authMetadata = const AuthMetadata();
      _bankCards = [];
      _holdingsTotal = 0.0;
      _isDebugMode = false;
      _isDashboardBalanceVisible = false;
      _isProfileBalanceVisible = false;
      _isInvestmentBalanceVisible = false;

      // Clear StorageManager data (bank_user_data box)
      try {
        final allKeys = await _storage.getKeys(BankStorageKeys.boxName);
        for (final key in allKeys) {
          await _storage.deleteKey(BankStorageKeys.boxName, key);
        }
      } catch (e) {
        debugPrint('Error clearing StorageManager data: $e');
      }

      // Clear UnifiedStorage data (including dataInitializedKey to allow re-initialization)
      try {
        // Clear dataInitializedKey so that re-login will trigger re-initialization
        await UnifiedStorage.remove(BankStorageKeys.dataInitializedKey);

        // Clear specific UnifiedStorage keys
        final keysToRemove = [
          BankStorageKeys.locationKey,
          BankStorageKeys.cityKey,
          BankStorageKeys.balanceKey,
          BankStorageKeys.usernameKey,
          BankStorageKeys.fullNameKey,
          BankStorageKeys.pointsKey,
          BankStorageKeys.couponsKey,
          BankStorageKeys.creditCardLevelKey,
          BankStorageKeys.isLoggedInKey,
          BankStorageKeys.loginTimeKey,
          BankStorageKeys.holdingsTotalKey,
        ];

        for (final key in keysToRemove) {
          await UnifiedStorage.remove(key);
        }

        // Clear specific app storage boxes
        await UnifiedStorage.clearBox('bank_app_user');
        UnifiedStorage.clearCache();
      } catch (e) {
        debugPrint('Error clearing UnifiedStorage data: $e');
      }

      // Clear PrefsAppBank data (but preserve registration info)
      try {
        final prefs = PrefsAppBank();
        if (prefs.isInitialized) {
          // CRITICAL: Only remove phone_number, preserve all registration keys
          // Registration keys are protected in PrefsAppBank.clearAll() method
          await prefs.remove('phone_number');
        }
      } catch (e) {
        debugPrint('Error clearing PrefsAppBank phone number: $e');
      }

      // Clear cache
      try {
        await _cache.clear('bank_user');
      } catch (e) {
        debugPrint('Error clearing cache: $e');
      }

      debugPrint('User storage data cleared (registration info preserved, dataInitializedKey cleared for re-initialization)');
      notifyListeners();
    } catch (e) {
      debugPrint('Error clearing user storage data: $e');
    }
  }

  /// Update last active time
  Future<void> updateLastActiveTime() async {
    if (_globalData == null) return;

    _globalData = _globalData!.copyWith(
      lastActiveTime: DateTime.now(),
    );

    await _saveGlobalData();
    notifyListeners();
  }

  @override
  void setUser(BaseUserModel user) {
    if (user is BankUserModel) {
      _user = user;
      _saveUserData();
      notifyListeners();
    }
  }

  @override
  void clearUser() {
    // Only clear in-memory state, keep storage data intact
    // This allows user data to persist for next login
    // CRITICAL: Registration information is stored in PrefsAppBank and should NEVER be cleared on logout
    // Registration info is machine-bound and persists across logout/login cycles
    _user = null;
    _globalData = null;
    _authMetadata = const AuthMetadata();
    // Note: _isDebugMode and balance visibility states are kept in storage
    // They will be reloaded on next initialization
    // Registration info in PrefsAppBank is also preserved
    notifyListeners();
  }

  @override
  void updateToken(String? token, {String? tokenType}) {
    if (token != null) {
      _authMetadata = _authMetadata.copyWith(
        authType: AuthType.jwt,
        jwtToken: token,
        isAuthenticated: true,
        authenticatedAt: DateTime.now(),
      );
      _saveAuthMetadata();
      notifyListeners();
    }
  }

  @override
  void setAuthMetadata(AuthMetadata metadata) {
    _authMetadata = metadata;
    _saveAuthMetadata();
    notifyListeners();
  }

  @override
  void updateAuthMetadata({
    AuthType? authType,
    Map<String, dynamic>? data,
    DateTime? authenticatedAt,
    DateTime? expiresAt,
    bool? isAuthenticated,
    String? clientId,
    String? headerKey,
    String? headerValue,
    String? jwtToken,
    String? refreshToken,
    String? sessionId,
    Map<String, String>? customHeaders,
  }) {
    _authMetadata = _authMetadata.copyWith(
      authType: authType,
      data: data,
      authenticatedAt: authenticatedAt,
      expiresAt: expiresAt,
      isAuthenticated: isAuthenticated,
      clientId: clientId,
      headerKey: headerKey,
      headerValue: headerValue,
      jwtToken: jwtToken,
      refreshToken: refreshToken,
      sessionId: sessionId,
      customHeaders: customHeaders,
    );
    _saveAuthMetadata();
    notifyListeners();
  }

  @override
  Map<String, String> getAuthHeaders() {
    return _authMetadata.getAuthHeaders();
  }

  @override
  bool hasPermission(String permission) {
    if (_user == null) return false;

    // Bank-specific permission logic
    switch (permission) {
      case 'transfer':
        return _user!.isAccountActive && _user!.canTransact;
      case 'view_balance':
        return _user!.isAccountActive;
      case 'admin':
        return _user!.roleLevel != null && _user!.roleLevel! >= 10;
      default:
        return _user!.roleLevel != null && _user!.roleLevel! > 0;
    }
  }

  @override
  bool hasRole(String role) {
    return _user?.roleName == role;
  }

  /// Get formatted last login time
  String get formattedLastLoginTime {
    if (_globalData?.lastActiveTime == null) return '';

    final lastLogin = _globalData!.lastActiveTime;
    final now = DateTime.now();
    final difference = now.difference(lastLogin);

    if (difference.inMinutes < 1) {
      return '刚刚';
    } else if (difference.inHours < 1) {
      return '${difference.inMinutes}分钟前';
    } else if (difference.inDays < 1) {
      return '${difference.inHours}小时前';
    } else if (difference.inDays < 7) {
      return '${difference.inDays}天前';
    } else {
      return '${lastLogin.month}月${lastLogin.day}日';
    }
  }

  /// Format amount without thousand separators
  static String _formatAmount(double amount) {
    return amount.toStringAsFixed(2);
  }

  /// Get dashboard display balance (hidden or visible)
  String get dashboardDisplayBalance {
    final totalAssetsValue = totalAssets;
    if (_isDashboardBalanceVisible) {
      return '¥${_formatAmount(totalAssetsValue)}';
    } else {
      return '¥ ****';
    }
  }

  /// Get profile display balance (for assets section)
  String get profileDisplayBalance {
    final totalAssetsValue = totalAssets;
    if (_isProfileBalanceVisible) {
      return '¥${_formatAmount(totalAssetsValue)}';
    } else {
      return '¥ ****';
    }
  }

  /// Get investment display balance (for wealth assets section)
  String get investmentDisplayBalance {
    final totalAssetsValue = totalAssets;
    if (_isInvestmentBalanceVisible) {
      return '¥${_formatAmount(totalAssetsValue)}';
    } else {
      return '¥ ****';
    }
  }

  /// Format holdings total with thousand separators
  String formatHoldingsTotal({bool useProfileVisibility = true}) {
    final isVisible = useProfileVisibility ? _isProfileBalanceVisible : _isInvestmentBalanceVisible;
    if (isVisible) {
      return '¥${_formatAmount(_holdingsTotal)}';
    } else {
      return '¥ ****';
    }
  }

  /// Dispose resources
  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }
}
