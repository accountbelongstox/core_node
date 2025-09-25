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

/// Bank App Images Assets
/// 
/// This file contains all image assets for the bank application.
/// Assets are organized by category and follow the naming convention:
/// - bank_[category]_[description].png
/// 
/// USAGE:
/// ```dart
/// Image.asset(BankImages.bankHomeHeaderBg)
/// ```
class BankImages {
  // Private constructor to prevent instantiation
  BankImages._();

  // Base path for bank app images
  static const String _basePath = 'assets/apps/app_bank/images';

  // Home Page Images
  static const String bankHomeHeaderBg = '$_basePath/bank_home_header_bg.png';

  // Quick Action Icons
  static const String bankIconAccountQuery = '$_basePath/bank_icon_account_query.png';
  static const String bankIconTransfer = '$_basePath/bank_icon_transfer.png';
  static const String bankIconLoan = '$_basePath/bank_icon_loan.png';
  static const String bankIconScan = '$_basePath/bank_icon_scan.png';

  // Header Button Images
  static const String bankVersionButton = '$_basePath/bank_version_button.png';
  static const String bankCustomerService = '$_basePath/bank_customer_service.png';
  static const String bankMessage = '$_basePath/bank_message.png';
  
  // Banner Images
  static const String bankActivityBanner = '$_basePath/bank_activity_banner.png';
  
  // Additional Function Icons
  static const String bankIconDeposit = '$_basePath/bank_icon_deposit.png';
  static const String bankIconFund = '$_basePath/bank_icon_fund.png';
  static const String bankIconCreditCard = '$_basePath/bank_icon_credit_card.png';
  static const String bankIconInsurance = '$_basePath/bank_icon_insurance.png';
  static const String bankIconWealth = '$_basePath/bank_icon_wealth.png';
  static const String bankIconPension = '$_basePath/bank_icon_pension.png';
  static const String bankIconGuizhouBank = '$_basePath/bank_icon_guizhou_bank.png';
  static const String bankIconTimeDeposit = '$_basePath/bank_icon_time_deposit.png';
  static const String bankIconDragonPay = '$_basePath/bank_icon_dragon_pay.png';
  static const String bankIconGold = '$_basePath/bank_icon_gold.png';

  // All images list for easy iteration
  static const List<String> allImages = [
    bankHomeHeaderBg,
    bankIconAccountQuery,
    bankIconTransfer,
    bankIconLoan,
    bankIconScan,
    bankVersionButton,
    bankCustomerService,
    bankMessage,
    bankActivityBanner,
    bankIconDeposit,
    bankIconFund,
    bankIconCreditCard,
    bankIconInsurance,
    bankIconWealth,
    bankIconPension,
    bankIconGuizhouBank,
    bankIconTimeDeposit,
    bankIconDragonPay,
    bankIconGold,
  ];

  // Quick action icons list
  static const List<String> quickActionIcons = [
    bankIconAccountQuery,
    bankIconTransfer,
    bankIconLoan,
    bankIconScan,
  ];

  // Home page specific images
  static const List<String> homePageImages = [
    bankHomeHeaderBg,
    ...quickActionIcons,
  ];
}
