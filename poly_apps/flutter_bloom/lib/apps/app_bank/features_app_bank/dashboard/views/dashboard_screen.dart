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

import 'package:flutter/material.dart';
import 'package:qyflutter/apps/app_bank/config_app_bank/constants.dart';
import 'package:qyflutter/common/widgets/bank_scaffold.dart';
import 'package:qyflutter/common/widgets/custom_image_icon_label.dart';
import 'package:qyflutter/common/widgets/custom_image_icon_label_group.dart';
import '../../../resources_app_bank/assets_images_app_bank.dart';
import '../../../resources_app_bank/gradients_app_bank.dart';
import '../../../config_app_bank/theme_config_app_bank.dart';
import '../../../services_app_bank/bank_network_service.dart';
import '../components/wealth_selection_section.dart';
import '../components/pension_section.dart';
import '../components/housing_section.dart';
import '../components/discount_zone_section.dart';
import '../components/custom_service_section.dart';
import '../components/dashboard_activity_banner.dart';
import '../components/dashboard_account_section.dart';
import '../../../widgets_app_bank/bank_loading_dialog.dart';
import '../../../widgets_app_bank/bank_rotating_search_hint.dart';
// Fix: Import network_framework.dart for UnifiedAuthManager
import '../../../../../common/network/network_framework.dart';

class BankDashboardScreen extends StatefulWidget {
  const BankDashboardScreen({super.key});

  @override
  State<BankDashboardScreen> createState() => _BankDashboardScreenState();
}

class _BankDashboardScreenState extends State<BankDashboardScreen> {
  final BankNetworkService _networkService = BankNetworkService.instance;

  @override
  void initState() {
    super.initState();
    _initializeNetworkFramework();
  }

  Future<void> _initializeNetworkFramework() async {
    try {
      // Fix: NetworkFramework.initialize requires a BaseNetworkConfig
      // For Bank app, we simply initialize the network service
      await _networkService.initialize();

      // Report app open event
      final authManager = UnifiedAuthManager.instance;
      if (authManager.deviceId != null && authManager.appSignature != null) {
        await _networkService.appOpen(
          deviceId: authManager.deviceId!,
          appSignature: authManager.appSignature!,
          appVersion: '1.0.0',
          platform: 'flutter',
        );
      }
    } catch (e) {
      debugPrint('Failed to initialize network framework: $e');
    }
  }

  @override
  Widget build(BuildContext context) {
    return BankScaffold(
      currentBottomNavIndex: 0,
      backgroundColor: Colors.transparent, // Transparent to show gradient
      body: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            stops: const [
              0.0,
              0.1,
              1.0
            ], // Top 10% keeps original, bottom 90% uses gradient
            colors: [
              BankColorProvider.scaffoldBackground, // Top color (original)
              const Color(0xFFF6FBFF), // Transition to #F6FBFF
              const Color(0xFFF2F9FF), // Bottom color #F2F9FF
            ],
          ),
        ),
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              _buildTopHeaderWithBackground(context),
              _buildFunctionsSection(context),
              const DashboardActivityBanner(),
              _buildWealthSection(context),
              const DashboardAccountSection(),
              _buildPensionSection(context),
              _buildHousingSection(context),
              _buildDiscountZoneSection(context),
              _buildCustomServiceSection(context),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildTopHeaderWithBackground(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 11.2),
      decoration: BoxDecoration(
        image: DecorationImage(
          image: AssetImage(BankImages.bankHomeHeaderBg),
          fit: BoxFit.cover,
          scale: 0.8, // Scale down image by 20%
          alignment: Alignment(
              -1.0, 0), // Move image 100% to the left (fully left aligned)
        ),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Top header section - Add more spacing and use image assets
          SafeArea(
            bottom: false,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(8, 4, 8, 16),
              child: Row(
                children: [
                  CustomImageIconLabel(
                    imagePath: BankImages.bankVersionButton,
                    label: '版本',
                    imageSize: 28.8,
                    labelSize: 14.4,
                    labelColor: Colors.white,
                    showBackground: false,
                    showBorder: false,
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: BankRotatingSearchHint(
                      pageType: BankPageType.dashboard,
                      textColor: Colors.grey,
                      fontSize: 14,
                      backgroundColor: Colors.white.withOpacity(0.9),
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Row(
                    children: [
                      CustomImageIconLabel(
                        imagePath: BankImages.bankCustomerService,
                        label: '客服',
                        imageSize: 28.8,
                        labelSize: 14.4,
                        labelColor: Colors.white,
                        showBackground: false,
                        showBorder: false,
                      ),
                      const SizedBox(width: 12),
                      CustomImageIconLabel(
                        imagePath: BankImages.bankMessage,
                        label: '消息',
                        imageSize: 28.8,
                        labelSize: 14.4,
                        labelColor: Colors.white,
                        showBackground: false,
                        showBorder: false,
                        badge: Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: const Color(0xFFFF4757),
                            borderRadius: BorderRadius.circular(BankConstants.borderRadius),
                          ),
                          child: const Text(
                            '11',
                            style: TextStyle(
                              fontSize: 10,
                              color: Colors.white,
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
          // Main banner section - Add more spacing and better layout
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 19, 20, 24),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      // Transparent placeholder to maintain spacing
                      SizedBox(
                        height: 10,
                        width: double.infinity,
                      ),
                      const SizedBox(height: 7),
                      SizedBox(
                        height: 17,
                        width: double.infinity,
                      ),
                      const SizedBox(height: 7),
                      SizedBox(
                        height: 10,
                        width: double.infinity,
                      ),
                    ],
                  ),
                ),
                Container(
                  width: 72,
                  height: 48,
                  decoration: BoxDecoration(
                    color: Colors.white.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(BankConstants.borderRadius),
                  ),
                  child: const Center(
                    child: Text('🎓', style: TextStyle(fontSize: 19)),
                  ),
                ),
              ],
            ),
          ),
          // Quick access icons section
          _buildQuickAccessIcons(context),
        ],
      ),
    );
  }

  Widget _buildQuickAccessIcons(BuildContext context) {
    final quickAccessItems = [
      IconLabelData(
        imagePath: BankImages.bankIconAccountQuery,
        label: '账户查询',
        onTap: () => _handleFunctionTap('账户查询'),
      ),
      IconLabelData(
        imagePath: BankImages.bankIconTransfer,
        label: '转账汇款',
        onTap: () => _handleFunctionTap('转账汇款'),
      ),
      IconLabelData(
        imagePath: BankImages.bankIconLoan,
        label: '贷款',
        onTap: () => _handleFunctionTap('贷款'),
      ),
      IconLabelData(
        imagePath: BankImages.bankIconScan,
        label: '扫一扫',
        onTap: () => _handleFunctionTap('扫一扫'),
      ),
    ];

    return CustomImageIconLabelGroup(
      config: IconGroupConfig(
        items: quickAccessItems,
        itemsPerRow: 4,
        mainAxisAlignment: MainAxisAlignment.center,
        crossAxisAlignment: CrossAxisAlignment.center,
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 20),
        backgroundGradient: BankGradients.bankFunctionSectionGradient,
        borderRadius: BorderRadius.circular(BankConstants.quickAccessIconBorderRadius),
        border: Border.all(color: Colors.white, width: 1.0),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.1),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
        iconSize: 48.0,
        labelSize: 14.0,
        labelFontWeight: FontWeight.bold,
        labelColor: Colors.black,
        spacing: 16.0,
        runSpacing: 8.0,
        distributeEvenly: true,
        maxLines: 2,
        overflow: TextOverflow.visible,
      ),
    );
  }

  Widget _buildFunctionsSection(BuildContext context) {
    final functionItems = [
      // First page items
      IconLabelData(
        imagePath: BankImages.bankIconDeposit,
        label: '存款产品',
        onTap: () => _handleFunctionTap('存款产品'),
      ),
      IconLabelData(
        imagePath: BankImages.bankIconFund,
        label: '基金投资',
        onTap: () => _handleFunctionTap('基金投资'),
      ),
      IconLabelData(
        imagePath: BankImages.bankIconCreditCard,
        label: '信用卡申请',
        onTap: () => _handleFunctionTap('信用卡申请'),
      ),
      IconLabelData(
        imagePath: BankImages.bankIconInsurance,
        label: '住房',
        onTap: () => _handleFunctionTap('住房'),
      ),
      IconLabelData(
        imagePath: BankImages.bankIconWealth,
        label: '理财产品',
        onTap: () => _handleFunctionTap('理财产品'),
      ),
      IconLabelData(
        imagePath: BankImages.bankIconPension,
        label: '个人养老金',
        onTap: () => _handleFunctionTap('个人养老金'),
      ),
      IconLabelData(
        imagePath: BankImages.bankIconGuizhouBank,
        label: '生活缴费',
        onTap: () => _handleFunctionTap('生活缴费'),
      ),
      IconLabelData(
        imagePath: BankImages.bankIconTimeDeposit,
        label: '惠省钱',
        onTap: () => _handleFunctionTap('惠省钱'),
      ),
      IconLabelData(
        imagePath: BankImages.bankIconDragonPay,
        label: '任务中心',
        onTap: () => _handleFunctionTap('任务中心'),
      ),
      IconLabelData(
        imagePath: BankImages.bankIconGold,
        label: '贵金属',
        onTap: () => _handleFunctionTap('贵金属'),
      ),
      // Second page items
      IconLabelData(
        imagePath: BankImages.bankIconSocialSecurity,
        label: '社保',
        onTap: () => _handleFunctionTap('社保'),
      ),
      IconLabelData(
        imagePath: BankImages.bankIconPointsMall,
        label: '龙积分商城',
        onTap: () => _handleFunctionTap('龙积分商城'),
      ),
      IconLabelData(
        imagePath: BankImages.bankIconRightsCenter,
        label: '权益中心',
        onTap: () => _handleFunctionTap('权益中心'),
      ),
      IconLabelData(
        imagePath: BankImages.bankIconMonthlyBill,
        label: '月度账单',
        onTap: () => _handleFunctionTap('月度账单'),
      ),
      IconLabelData(
        imagePath: BankImages.bankIconOtherBankTransfer,
        label: '他行转入',
        onTap: () => _handleFunctionTap('他行转入'),
      ),
      IconLabelData(
        imagePath: BankImages.bankIconHousingFund,
        label: '住房公积金',
        onTap: () => _handleFunctionTap('住房公积金'),
      ),
      IconLabelData(
        imagePath: BankImages.bankIconCashOutTransfer,
        label: '现金转出',
        onTap: () => _handleFunctionTap('现金转出'),
      ),
      IconLabelData(
        imagePath: BankImages.bankIconPersonalCredit,
        label: '个人信用',
        onTap: () => _handleFunctionTap('个人信用'),
      ),
      IconLabelData(
        imagePath: BankImages.bankIconInsuranceSecond,
        label: '保险',
        onTap: () => _handleFunctionTap('保险'),
      ),
      IconLabelData(
        imagePath: BankImages.bankIconMoreSecond,
        label: '更多',
        onTap: () => _handleFunctionTap('更多'),
      ),
    ];

    return CustomImageIconLabelGroup(
      config: IconGroupConfig(
        items: functionItems,
        itemsPerRow: 5,
        mainAxisAlignment: MainAxisAlignment.center,
        crossAxisAlignment: CrossAxisAlignment.center,
        padding: const EdgeInsets.all(20),
        iconSize: 48.0,
        labelSize: 12.0,
        labelFontWeight: FontWeight.bold,
        labelColor: const Color(0xFF1A1A1A),
        spacing: 16.0,
        runSpacing: 16.0,
        distributeEvenly: true,
        enablePagination: true,
        maxRowsPerPage: 2,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
      ),
    );
  }


  Widget _buildWealthSection(BuildContext context) {
    return const WealthSelectionSection();
  }


  Widget _buildPensionSection(BuildContext context) {
    return const PensionSection();
  }

  Widget _buildHousingSection(BuildContext context) {
    return const HousingSection();
  }

  Widget _buildDiscountZoneSection(BuildContext context) {
    return const DiscountZoneSection();
  }

  Widget _buildCustomServiceSection(BuildContext context) {
    return const CustomServiceSection();
  }


  /// Handle function item tap with loading dialog and navigation
  void _handleFunctionTap(String label) {
    BankLoadingDialog.show(
      context,
      title: label,
    );
  }

}
