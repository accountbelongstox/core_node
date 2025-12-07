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
  static const String bankIconAccountQuery =
      '$_basePath/bank_icon_account_query.png';
  static const String bankIconTransfer = '$_basePath/bank_icon_transfer.png';
  static const String bankIconLoan = '$_basePath/bank_icon_loan.png';
  static const String bankIconScan = '$_basePath/bank_icon_scan.png';

  // Header Button Images
  static const String bankVersionButton = '$_basePath/bank_version_button.png';
  static const String bankCustomerService =
      '$_basePath/bank_customer_service.png';
  static const String bankMessage = '$_basePath/bank_message.png';

  // Banner Images
  static const String bankActivityBanner =
      '$_basePath/bank_activity_banner.png';

  // Additional Function Icons
  static const String bankIconDeposit = '$_basePath/bank_icon_deposit.png';
  static const String bankIconFund = '$_basePath/bank_icon_fund.png';
  static const String bankIconCreditCard =
      '$_basePath/bank_icon_credit_card.png';
  static const String bankIconInsurance = '$_basePath/bank_icon_insurance.png';
  static const String bankIconWealth = '$_basePath/bank_icon_wealth.png';
  static const String bankIconPension = '$_basePath/bank_icon_pension.png';
  static const String bankIconGuizhouBank =
      '$_basePath/bank_icon_guizhou_bank.png';
  static const String bankIconTimeDeposit =
      '$_basePath/bank_icon_time_deposit.png';
  static const String bankIconDragonPay = '$_basePath/bank_icon_dragon_pay.png';
  static const String bankIconGold = '$_basePath/bank_icon_gold.png';

  // Bottom Navigation Icons
  static const String bankWealthCheckup = '$_basePath/bank_wealth_checkup.png';
  static const String bankPensionPlanning =
      '$_basePath/bank_pension_planning.png';
  static const String bankWealthActivity =
      '$_basePath/bank_wealth_activity.png';

  // Housing Service Icons
  static const String bankIconMortgagePreapproval =
      '$_basePath/bank_icon_mortgage_preapproval.png';
  static const String bankIconMyLoans = '$_basePath/bank_icon_my_loans.png';
  static const String bankIconArrow = '$_basePath/bank_icon_arrow.png';
  static const String bankIconPlus = '$_basePath/bank_icon_plus.png';
  static const String bankDiscountGift = '$_basePath/bank_discount_gift.png';
  static const String bankDiscountZone = '$_basePath/bank_discount_zone.png';

  // Credit Card Page Images
  static const String bankCardBannerBg = '$_basePath/bank_card_banner_bg.png';
  static const String bankCardFeaturesBg =
      '$_basePath/bank_card_features_bg.png';

  // Credit Card Feature Icons (extracted from bank_card_features_bg.png)
  static const String bankIconWallet = '$_basePath/bank_icon_wallet.png';
  static const String bankIconCardRights =
      '$_basePath/bank_icon_document_diamond.png';
  static const String bankIconCardApply =
      '$_basePath/bank_icon_document_plus.png';
  static const String bankIconValueGift = '$_basePath/bank_icon_calendar.png';
  static const String bankIconLimitAdjust =
      '$_basePath/bank_icon_document_yuan.png';
  static const String bankIconPointsExchange =
      '$_basePath/bank_icon_gift_diamond.png';
  static const String bankIconInstallment =
      '$_basePath/bank_icon_document_sliders.png';
  static const String bankIconQuickBind =
      '$_basePath/bank_icon_stacked_discs.png';
  static const String bankIconCashOut =
      '$_basePath/bank_icon_document_link.png';
  static const String bankIconMore = '$_basePath/bank_icon_more.png';

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
    bankWealthCheckup,
    bankPensionPlanning,
    bankWealthActivity,
    bankIconMortgagePreapproval,
    bankIconMyLoans,
    bankIconArrow,
    bankIconPlus,
    bankDiscountGift,
    bankDiscountZone,
    bankCardBannerBg,
    bankCardFeaturesBg,
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
