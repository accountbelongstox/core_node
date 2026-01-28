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
import '../../../common/storage/unified_storage.dart';
import '../providers_app_bank/bank_user_provider.dart';
import '../config_app_bank/bank_storage_keys.dart';
import '../models_app_bank/bank_card_model.dart';

class BankDataInitializer {
  static bool _isInitialized = false;

  static bool get isInitialized => _isInitialized;

  static Future<void> checkAndInitialize(BankUserProvider provider) async {
    final initialized =
        await UnifiedStorage.get<bool>(BankStorageKeys.dataInitializedKey);
    if (initialized == true) {
      _isInitialized = true;
      debugPrint('BankDataInitializer: Data already initialized, skipping');
      return;
    }

    _isInitialized = false;
    await initializeUserData(provider);
  }

  static Future<void> initializeUserData(BankUserProvider provider) async {
    try {
      if (!provider.isInitialized) {
        await provider.initialize();
      }

      // Always re-initialize bank cards when dataInitializedKey is false
      // This ensures fresh data after login, even if old cards exist in storage
      await _initializeBankCards(provider);

      final hasName = provider.user?.fullName != null &&
          provider.user?.fullName!.isNotEmpty == true &&
          provider.user?.fullName != 'Default User';
      if (!hasName) {
        await _initializeUserName(provider);
      }

      final hasLocation = provider.globalData?.location != null &&
          provider.globalData?.location!.isNotEmpty == true;
      if (!hasLocation) {
        await _initializeLocation(provider);
      }

      final hasHoldingsTotal = provider.holdingsTotal > 0;
      if (!hasHoldingsTotal) {
        await _initializeHoldingsTotal(provider);
      }

      // Sync all data to UnifiedStorage after initialization
      // This ensures user.balance, globalData.balance, cardCount, and other fields are synchronized
      // Only update if user exists (should always exist after provider.initialize())
      if (provider.user != null) {
        await provider.updateUser(
          balance: provider.totalAssets,
          cardCount: provider.bankCards.length,
        );
      }
      await provider.updateGlobalState(balance: provider.totalAssets);

      await UnifiedStorage.set(BankStorageKeys.dataInitializedKey, true);
      _isInitialized = true;

      debugPrint('BankDataInitializer: User data initialized successfully');
    } catch (e) {
      debugPrint('BankDataInitializer: Error initializing user data: $e');
    }
  }

  static Future<void> _initializeBankCards(BankUserProvider provider) async {
    try {
      // Remove all existing cards before initializing new ones
      // This ensures fresh data initialization after login
      while (provider.bankCards.length > 0) {
        await provider.removeBankCard(0);
      }

      await provider.addBankCard(
        const BankCardModel(
          cardNumber: '6222 8888 8888 8888',
          cardType: '储蓄卡',
          balance: 12500.75,
          currency: 'CNY',
          cardName: '薪资卡',
        ),
      );
      await provider.addBankCard(
        const BankCardModel(
          cardNumber: '6222 6666 6666 6666',
          cardType: '信用卡',
          balance: 3800.25,
          currency: 'CNY',
          cardName: '日常消费卡',
        ),
      );

      debugPrint(
          'BankDataInitializer: Bank cards initialized with 2 default cards');
    } catch (e) {
      debugPrint('BankDataInitializer: Error initializing bank cards: $e');
    }
  }

  static Future<void> _initializeUserName(BankUserProvider provider) async {
    try {
      final currentName =
          provider.user?.fullName ?? provider.globalData?.fullName;
      if (currentName != null && currentName.isNotEmpty) {
        debugPrint(
            'BankDataInitializer: User name already exists: $currentName');
        return;
      }

      // User name should be loaded from server API, not generated locally
      debugPrint(
          'BankDataInitializer: User name initialization - waiting for server data');
    } catch (e) {
      debugPrint('BankDataInitializer: Error initializing user name: $e');
    }
  }

  static Future<void> _initializeLocation(BankUserProvider provider) async {
    try {
      // Location should be loaded from server API or user preferences, not hardcoded
      debugPrint(
          'BankDataInitializer: Location initialization - waiting for server data');
    } catch (e) {
      debugPrint('BankDataInitializer: Error initializing location: $e');
    }
  }

  static Future<void> _initializeHoldingsTotal(
      BankUserProvider provider) async {
    try {
      // Holdings total should be loaded from server API, not generated locally
      debugPrint(
          'BankDataInitializer: Holdings total initialization - waiting for server data');
    } catch (e) {
      debugPrint('BankDataInitializer: Error initializing holdings total: $e');
    }
  }

  static Future<void> resetInitialization() async {
    await UnifiedStorage.remove(BankStorageKeys.dataInitializedKey);
    _isInitialized = false;
    debugPrint('BankDataInitializer: Initialization status reset');
  }
}
