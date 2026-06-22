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

  // Authentication Screen Images
  static const String bankAuthenticationBg =
      '$_basePath/bank_authentication_bg.png';

  // Quick Action Icons
  static const String bankIconAccountQuery =
      '$_basePath/bank_icon_account_query.png';
  static const String bankIconTransfer = '$_basePath/bank_icon_transfer.png';
  static const String bankIconLoan = '$_basePath/bank_icon_loan.png';
  static const String bankIconScan = '$_basePath/bank_icon_scan.png';
  static const String bankIconAccountDetails =
      '$_basePath/bank_icon_account_details.png';
  static const String bankIconTransferRemittance =
      '$_basePath/bank_icon_transfer_remittance.png';
  static const String bankIconWealthCheckup =
      '$_basePath/bank_icon_wealth_checkup.png';
  static const String bankIconBuilding = '$_basePath/bank_icon_building.png';

  // Header Button Images
  static const String bankVersionButton = '$_basePath/bank_version_button.png';
  static const String bankCustomerService =
      '$_basePath/bank_customer_service.png';
  static const String bankMessage = '$_basePath/bank_message.png';
  static const String myBenefitsIcon = '$_basePath/my_benefits_icon.png';

  // Banner Images
  static const String bankActivityBanner1 =
      '$_basePath/bank_activity_banner_1.png';
  static const String bankActivityBanner2 =
      '$_basePath/bank_activity_banner_2.png';
  static const String bankActivityBanner3 =
      '$_basePath/bank_activity_banner_3.png';
  static const String bankActivityBanner4 =
      '$_basePath/bank_activity_banner_4.png';

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

  // Second Page Function Icons (第二页功能图标)
  static const String bankIconSocialSecurity =
      '$_basePath/bank_icon_social_security.png';
  static const String bankIconPointsMall =
      '$_basePath/bank_icon_points_mall.png';
  static const String bankIconRightsCenter =
      '$_basePath/bank_icon_rights_center.png';
  static const String bankIconMonthlyBill =
      '$_basePath/bank_icon_monthly_bill.png';
  static const String bankIconOtherBankTransfer =
      '$_basePath/bank_icon_other_bank_transfer.png';
  static const String bankIconHousingFund =
      '$_basePath/bank_icon_housing_fund.png';
  static const String bankIconCashOutTransfer =
      '$_basePath/bank_icon_cash_out.png';
  static const String bankIconPersonalCredit =
      '$_basePath/bank_icon_personal_credit.png';
  static const String bankIconInsuranceSecond =
      '$_basePath/bank_icon_insurance_second.png';
  static const String bankIconMoreSecond =
      '$_basePath/bank_icon_more_second.png';

  // Bottom Navigation Icons
  static const String bankWealthCheckup = '$_basePath/bank_wealth_checkup.png';
  static const String bankPensionPlanning =
      '$_basePath/bank_pension_planning.png';
  static const String bankWealthActivity =
      '$_basePath/bank_wealth_activity.png';

  // Wealth My Assets Background
  static const String wealthMyAssetsBg = '$_basePath/wealth_my_assets_bg.png';
  // Wealth My Assets Background for Investment Page (财富页面专用背景图)
  static const String wealthMyAssetsBgInvestment =
      '$_basePath/wealth_my_assets_bg_investment.png';
  // Account Overview Wealth Panorama Background (账户总览 财富全景银行卡背景图)
  static const String accountOverviewWealthPanoramaBg =
      '$_basePath/account_overview_wealth_panorama_bg.png';
  // Account Overview Wealth Panorama Card Icon (账户总览 财富全景银行卡图标)
  static const String accountOverviewWealthPanoramaCardIcon =
      '$_basePath/account_overview_wealth_panorama_card_icon.png';
  // Bank Card Signed Icon (银行卡签约图标)
  static const String bankCardSignedIcon =
      '$_basePath/bank_card_signed_icon.png';
  // Account Overview Card Background Icon (账户总览卡片背景图标)
  static const String accountOverviewCardBgIcon =
      '$_basePath/account_overview_card_bg_icon.png';
  // Account Overview Card Background Icon Second (账户总览第二个卡片背景图标)
  static const String accountOverviewCardBgIconSecond =
      '$_basePath/account_overview_card_bg_icon_second.png';

  // Wealth Function Icons (财富功能图标)
  static const String wealthDeposit = '$_basePath/wealth_deposit.png';
  static const String wealthProduct = '$_basePath/wealth_product.png';
  static const String wealthFund = '$_basePath/wealth_fund.png';
  static const String wealthInsurance = '$_basePath/wealth_insurance.png';
  static const String wealthCheckup = '$_basePath/wealth_checkup.png';
  static const String wealthLongqianbao1 = '$_basePath/wealth_longqianbao1.png';
  static const String wealthLongqianbao2 = '$_basePath/wealth_longqianbao2.png';
  static const String wealthSuying = '$_basePath/wealth_suying.png';
  static const String wealthPreciousMetal =
      '$_basePath/wealth_precious_metal.png';
  static const String wealthMore = '$_basePath/wealth_more.png';

  // Housing Service Icons
  static const String bankIconMortgagePreapproval =
      '$_basePath/bank_icon_mortgage_preapproval.png';
  static const String bankIconMyLoans = '$_basePath/bank_icon_my_loans.png';
  static const String bankIconArrow = '$_basePath/bank_icon_arrow.png';
  static const String bankIconPlus = '$_basePath/bank_icon_plus.png';
  static const String housingCardBg = '$_basePath/housing_card_bg.png';
  static const String housingTabBg = '$_basePath/housing_tab_bg.png';
  static const String bankDiscountGift = '$_basePath/bank_discount_gift.png';
  static const String bankDiscountZone = '$_basePath/bank_discount_zone.png';

  // Life Service Icons (生活服务图标)
  static const String servicePhoneFee = '$_basePath/service_phone_fee.png';
  static const String serviceElectric = '$_basePath/service_electric.png';
  static const String serviceMedicalCode =
      '$_basePath/service_medical_code.png';
  static const String serviceLowCarbon = '$_basePath/service_low_carbon.png';
  static const String serviceMovie = '$_basePath/service_movie.png';
  static const String serviceCanteen = '$_basePath/service_canteen.png';
  static const String servicePoints = '$_basePath/service_points.png';
  static const String servicePartyFee = '$_basePath/service_party_fee.png';
  static const String serviceGas = '$_basePath/service_gas.png';
  static const String serviceWater = '$_basePath/service_water.png';

  // Life Page Banners (生活页面Banner)
  static const String lifeBanner1 = '$_basePath/life_banner_1.png';
  static const String lifeBanner2 = '$_basePath/life_banner_2.png';

  // Local Section Cards (本地卡片)
  static const String localCard1 = '$_basePath/local_card_1.png';
  static const String localCard2 = '$_basePath/local_card_2.png';

  // Good Stuff Section Cards (好物卡片)
  static const String goodStuffCard1 = '$_basePath/good_stuff_card_1.png';
  static const String goodStuffBg = '$_basePath/good_stuff_bg.png';

  // Beautiful Life Section (美好生活)
  static const String beautifulLifeBg = '$_basePath/beautiful_life_bg.png';
  static const String burgerKingIcon = '$_basePath/burger_king_icon.png';
  static const String pizzaHutIcon = '$_basePath/pizza_hut_icon.png';

  // New Customer Gift Section (新客礼部分)
  static const String newCustomerGiftMiddleBg =
      '$_basePath/new_customer_gift_middle_bg.png';

  // Movie Section (电影部分)
  static const String movieFlyer1 = '$_basePath/movie_flyer_1.png';
  static const String movieFlyer2 = '$_basePath/movie_flyer_2.png';
  static const String movieFlyer3 = '$_basePath/movie_flyer_3.png';

  // Daily Check-in Section (每日签到)
  static const String dailyCheckinImage = '$_basePath/daily_checkin_image.png';

  // Default User Avatar (默认用户头像)
  static const String defaultUserAvatar = '$_basePath/default_user_avatar.png';

  // Task Gift Icon (任务礼物图标)
  static const String taskGiftIcon = '$_basePath/task_gift_icon.png';

  // Order Icons (订单图标)
  static const String iconOrderPayment = '$_basePath/icon_order_payment.png';
  static const String iconOrderLife = '$_basePath/icon_order_life.png';
  static const String iconOrderShanrong = '$_basePath/icon_order_shanrong.png';

  // Certificate Icons (证明申请图标)
  static const String iconCertificateStatement =
      '$_basePath/icon_certificate_statement.png';
  static const String iconCertificateCredit =
      '$_basePath/icon_certificate_credit.png';
  static const String iconCertificateReport =
      '$_basePath/icon_certificate_report.png';
  static const String iconCertificateCard =
      '$_basePath/icon_certificate_card.png';

  // Recently Used Icons (最近使用图标)
  static const String iconRecentlyCustomerService =
      '$_basePath/icon_recently_customer_service.png';
  static const String iconRecentlyMessage =
      '$_basePath/icon_recently_message.png';
  static const String iconRecentlyCardChange =
      '$_basePath/icon_recently_card_change.png';
  static const String iconRecentlyLoan = '$_basePath/icon_recently_loan.png';

  // Settings Icons (设置图标)
  static const String iconSettingFingerprint =
      '$_basePath/icon_setting_fingerprint.png';
  static const String iconSettingTransferLimit =
      '$_basePath/icon_setting_transfer_limit.png';
  static const String iconSettingChangePhone =
      '$_basePath/icon_setting_change_phone.png';
  static const String iconSettingBindDevice =
      '$_basePath/icon_setting_bind_device.png';

  // Credit Card Page Images
  static const String bankCardBannerBg = '$_basePath/bank_card_banner_bg.png';
  static const String newbieCardBg = '$_basePath/newbie_card_bg.png';

  // Offer Section Images
  static const String offerWorldIcon = '$_basePath/offer_world_icon.png';
  static const String offerSnowIcon = '$_basePath/offer_snow_icon.png';
  static const String offerCarCardIcon = '$_basePath/offer_car_card_icon.png';

  // Installment Benefits Section (分期优享)
  static const String installmentPass = '$_basePath/installment_pass.png';
  static const String renovationInstallment =
      '$_basePath/renovation_installment.png';
  static const String cashInstallment = '$_basePath/cash_installment.png';
  static const String billInstallment = '$_basePath/bill_installment.png';

  // Installment Shopping Section (分期购物)
  static const String appleInstallment = '$_basePath/apple_installment.png';
  static const String vipshopInstallment = '$_basePath/vipshop_installment.png';
  static const String taobaoInstallment = '$_basePath/taobao_installment.png';
  static const String ctripInstallment = '$_basePath/ctrip_installment.png';
  static const String xiaomiInstallment = '$_basePath/xiaomi_installment.png';
  static const String jdInstallment = '$_basePath/jd_installment.png';

  // Value-added Benefits Section (增值礼遇)
  static const String conciergeCarBannerBg =
      '$_basePath/concierge_car_banner_bg.png';

  // Latest Offers Section Images (最新优惠部分图片)
  static const String bankLatestOffersTitle =
      '$_basePath/bank_latest_offers_title.png';
  static const String bankLatestOffersBg =
      '$_basePath/bank_latest_offers_bg.png';

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

  // Wealth function icons list
  static const List<String> wealthFunctionIcons = [
    wealthDeposit,
    wealthProduct,
    wealthFund,
    wealthInsurance,
    wealthCheckup,
    wealthLongqianbao1,
    wealthLongqianbao2,
    wealthSuying,
    wealthPreciousMetal,
    wealthMore,
  ];
}
