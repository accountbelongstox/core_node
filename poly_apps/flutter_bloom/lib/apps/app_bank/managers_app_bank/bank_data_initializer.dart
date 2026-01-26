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

import 'dart:math';
import 'package:flutter/foundation.dart';
import '../../../common/storage/unified_storage.dart';
import '../models_app_bank/bank_card_model.dart';
import '../providers_app_bank/bank_user_provider.dart';
import '../config_app_bank/bank_storage_keys.dart';

class BankDataInitializer {
  static final Random _random = Random();
  static bool _isInitialized = false;

  static bool get isInitialized => _isInitialized;

  static Future<void> checkAndInitialize(BankUserProvider provider) async {
    final initialized = await UnifiedStorage.get<bool>(BankStorageKeys.dataInitializedKey);
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
                         provider.globalData?.location == '北京';
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

      final totalBalance = _generateTotalBalance();
      final card1Balance = double.parse((totalBalance * 0.6).toStringAsFixed(2));
      final card2Balance = double.parse((totalBalance * 0.4).toStringAsFixed(2));

      final card1 = BankCardModel(
        cardNumber: _generateCardNumber(),
        cardType: '储蓄卡',
        balance: card1Balance,
        currency: 'CNY',
        cardName: '主账户',
        openedAt: DateTime.now(),
      );

      final card2 = BankCardModel(
        cardNumber: _generateCardNumber(),
        cardType: '储蓄卡',
        balance: card2Balance,
        currency: 'CNY',
        cardName: '备用账户',
        openedAt: DateTime.now(),
      );

      await provider.addBankCard(card1);
      await provider.addBankCard(card2);

      // Sync balance: Update user.balance and globalData.balance to match total card balance
      // Only update if user exists (should always exist after provider.initialize())
      if (provider.user != null) {
        await provider.updateUser(balance: totalBalance);
      }
      await provider.updateGlobalState(balance: totalBalance);

      debugPrint('BankDataInitializer: Bank cards initialized - Card1: ${card1.cardNumber} (${card1.balance}), Card2: ${card2.cardNumber} (${card2.balance}), Total Balance: $totalBalance');
    } catch (e) {
      debugPrint('BankDataInitializer: Error initializing bank cards: $e');
    }
  }

  static Future<void> _initializeUserName(BankUserProvider provider) async {
    try {
      final currentName = provider.user?.fullName ?? provider.globalData?.fullName;
      if (currentName != null && currentName.isNotEmpty && currentName != 'Default User') {
        debugPrint('BankDataInitializer: User name already exists: $currentName');
        return;
      }

      final generatedName = _generateUserName();
      await provider.updateUser(fullName: generatedName);
      await provider.updateGlobalState(fullName: generatedName);

      debugPrint('BankDataInitializer: User name initialized: $generatedName');
    } catch (e) {
      debugPrint('BankDataInitializer: Error initializing user name: $e');
    }
  }

  static Future<void> _initializeLocation(BankUserProvider provider) async {
    try {
      await provider.updateUser(location: '北京', city: '北京');
      await provider.updateGlobalState(location: '北京', city: '北京');

      debugPrint('BankDataInitializer: Location initialized to 北京');
    } catch (e) {
      debugPrint('BankDataInitializer: Error initializing location: $e');
    }
  }

  static Future<void> _initializeHoldingsTotal(BankUserProvider provider) async {
    try {
      final holdingsTotal = _generateHoldingsTotal();
      await provider.updateHoldingsTotal(holdingsTotal);

      debugPrint('BankDataInitializer: Holdings total initialized: $holdingsTotal');
    } catch (e) {
      debugPrint('BankDataInitializer: Error initializing holdings total: $e');
    }
  }

  static String _generateCardNumber() {
    final prefix = '6228';
    final remainingLength = 19 - prefix.length;
    final randomDigits = List.generate(remainingLength, (_) => _random.nextInt(10));
    final cardNumber = prefix + randomDigits.join();
    
    if (cardNumber.length != 19) {
      debugPrint('BankDataInitializer: Warning - Generated card number length is ${cardNumber.length}, expected 19');
    }
    
    return cardNumber;
  }

  static double _generateTotalBalance() {
    final minBalance = 10000000.0;
    final maxBalance = 30000000.0;
    final range = maxBalance - minBalance;
    final randomValue = _random.nextDouble() * range;
    final balance = minBalance + randomValue;
    return double.parse(balance.toStringAsFixed(2));
  }

  static double _generateHoldingsTotal() {
    final minHoldings = 5000000.0;
    final maxHoldings = 10000000.0;
    final range = maxHoldings - minHoldings;
    final randomValue = _random.nextDouble() * range;
    final holdings = minHoldings + randomValue;
    return double.parse(holdings.toStringAsFixed(2));
  }

  static String _generateUserName() {
    final surnames = ['张', '李', '王', '刘', '陈', '杨', '赵', '黄', '周', '吴'];
    final givenNames = ['伟', '芳', '娜', '秀英', '敏', '静', '丽', '强', '磊', '军', '洋', '勇', '艳', '杰', '涛', '明', '超', '秀兰'];
    
    final surname = surnames[_random.nextInt(surnames.length)];
    final givenName = givenNames[_random.nextInt(givenNames.length)];
    
    return '$surname$givenName';
  }

  static Future<void> resetInitialization() async {
    await UnifiedStorage.remove(BankStorageKeys.dataInitializedKey);
    _isInitialized = false;
    debugPrint('BankDataInitializer: Initialization status reset');
  }
}
