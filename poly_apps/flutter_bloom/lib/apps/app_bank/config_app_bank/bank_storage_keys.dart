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

class BankStorageKeys {
  BankStorageKeys._();

  static const String boxName = 'bank_user_data';

  static const String userKey = 'user_profile';
  static const String globalDataKey = 'global_data';
  static const String debugModeKey = 'debug_mode';
  static const String authMetadataKey = 'auth_metadata';
  static const String dashboardBalanceVisibleKey = 'dashboard_balance_visible';
  static const String profileBalanceVisibleKey = 'profile_balance_visible';
  static const String investmentBalanceVisibleKey = 'investment_balance_visible';
  static const String bankCardsKey = 'bank_cards';

  static const String dataInitializedKey = 'bank_data_initialized';

  static const String locationKey = 'bank_location';
  static const String cityKey = 'bank_city';
  static const String balanceKey = 'bank_balance';
  static const String usernameKey = 'bank_username';
  static const String fullNameKey = 'bank_full_name';
  static const String pointsKey = 'bank_points';
  static const String couponsKey = 'bank_coupons';
  static const String creditCardLevelKey = 'bank_credit_card_level';
  static const String isLoggedInKey = 'bank_is_logged_in';
  static const String loginTimeKey = 'bank_login_time';
  static const String holdingsTotalKey = 'bank_holdings_total';
}
