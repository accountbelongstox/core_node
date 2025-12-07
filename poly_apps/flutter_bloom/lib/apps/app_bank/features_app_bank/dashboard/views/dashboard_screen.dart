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
import 'package:provider/provider.dart';
import 'package:qyflutter/common/widgets/bank_scaffold.dart';
import 'package:qyflutter/common/widgets/custom_image_icon_label.dart';
import 'package:qyflutter/common/widgets/custom_image_icon_label_group.dart';
import '../../../providers_app_bank/bank_user_provider.dart';
import '../../../resources_app_bank/assets_images_app_bank.dart';
import '../../../resources_app_bank/gradients_app_bank.dart';
import '../../../config_app_bank/theme_config_app_bank.dart';
import '../../../services_app_bank/bank_network_service.dart';
import '../components/wealth_selection_section.dart';
import '../components/pension_section.dart';
import '../components/housing_section.dart';
import '../components/discount_zone_section.dart';
import '../components/custom_service_section.dart';
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
              _buildAnnouncementBanner(context),
              _buildActivityBanner(context),
              _buildWealthSection(context),
              _buildAccountSection(context),
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
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 16, vertical: 8),
                      decoration: BoxDecoration(
                        color: Colors.white.withOpacity(0.9),
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: const Text(
                        '个人养老金来啦',
                        style: TextStyle(
                          fontSize: 14,
                          color: Colors.grey,
                        ),
                      ),
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
                            borderRadius: BorderRadius.circular(10),
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
                    borderRadius: BorderRadius.circular(8),
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
        borderRadius: BorderRadius.circular(12),
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

  Widget _buildAnnouncementBanner(BuildContext context) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(8),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.05),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        children: [
          Container(
            width: 32,
            height: 32,
            decoration: const BoxDecoration(
              color: Color(0xFFFF6B35),
              shape: BoxShape.circle,
            ),
            child: const Center(
              child: Text('📢', style: TextStyle(fontSize: 16)),
            ),
          ),
          const SizedBox(width: 12),
          const Expanded(
            child: Text(
              '关于调整部分业务服务时间的公告',
              style: TextStyle(
                fontSize: 14,
                color: Colors.black87,
              ),
            ),
          ),
          const Icon(
            Icons.arrow_forward_ios,
            size: 16,
            color: Colors.grey,
          ),
        ],
      ),
    );
  }

  Widget _buildActivityBanner(BuildContext context) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      height: 120, // Set a fixed height for the banner
      decoration: BoxDecoration(
        image: const DecorationImage(
          image: AssetImage(BankImages.bankActivityBanner),
          fit: BoxFit.cover, // Fill the entire container
        ),
        borderRadius: BorderRadius.circular(12),
      ),
    );
  }

  Widget _buildWealthSection(BuildContext context) {
    return const WealthSelectionSection();
  }

  Widget _buildAccountSection(BuildContext context) {
    return Consumer<BankUserProvider>(
      builder: (context, provider, child) {
        return Container(
          margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(12),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(0.05),
                blurRadius: 8,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text(
                '我的账户',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w600,
                  color: Colors.black87,
                ),
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Text(
                          '储蓄卡余额',
                          style: TextStyle(
                            fontSize: 14,
                            color: Colors.grey,
                          ),
                        ),
                        const SizedBox(height: 4),
                        GestureDetector(
                          onTap: () {
                            _handleAccountAction(provider);
                          },
                          child: Row(
                            children: [
                              Text(
                                provider.dashboardDisplayBalance,
                                style: const TextStyle(
                                  fontSize: 24,
                                  fontWeight: FontWeight.bold,
                                  color: Colors.black87,
                                ),
                              ),
                              const SizedBox(width: 8),
                              Icon(
                                provider.isDashboardBalanceVisible
                                    ? Icons.visibility
                                    : Icons.visibility_off,
                                size: 20,
                                color: Colors.grey[600],
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                  GestureDetector(
                    onTap: () {
                      _handleAccountAction(provider);
                    },
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 12, vertical: 6),
                      decoration: BoxDecoration(
                        color: const Color(0xFF74B9FF),
                        borderRadius: BorderRadius.circular(16),
                      ),
                      child: const Text(
                        '查看详情',
                        style: TextStyle(
                          fontSize: 12,
                          color: Colors.white,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        );
      },
    );
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

  /// Handle account action (toggle balance visibility or navigate to details)
  void _handleAccountAction(BankUserProvider provider) {
    // Toggle balance visibility
    provider.toggleDashboardBalanceVisibility();

    // You can add navigation to account details page here if needed
    // For example:
    // Navigator.push(context, MaterialPageRoute(builder: (context) => AccountDetailScreen()));
  }

  /// Handle function item tap with loading dialog and navigation
  void _handleFunctionTap(String label) {
    // Show loading dialog
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (BuildContext context) {
        return AlertDialog(
          title: Text(label),
          content: const Text('请稍候正在为你打开'),
          actions: [
            SizedBox(
              width: double.infinity,
              child: const Center(
                child: CircularProgressIndicator(),
              ),
            ),
          ],
        );
      },
    );

    // Simulate loading time and then navigate to profile
    Future.delayed(const Duration(seconds: 2), () {
      Navigator.of(context).pop(); // Close loading dialog
      // Navigate to profile page (index 4 in bottom navigation)
      // This will be handled by the bottom navigation
      // You can also use Navigator.push if you want to push a new page
    });
  }
}
