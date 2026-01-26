// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\" instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:qyflutter/common/widgets/bank_scaffold.dart';
import '../../../config_app_bank/constants.dart';
import '../../../providers_app_bank/bank_user_provider.dart';
import '../../../widgets_app_bank/bank_section_card.dart';
import '../../../widgets_app_bank/bank_gradient_card.dart';
import '../../../widgets_app_bank/bank_action_button.dart';
import '../../../widgets_app_bank/bank_text_with_subtitle.dart';
import '../../../widgets_app_bank/bank_wealth_function_grid.dart';
import '../../../widgets_app_bank/bank_loading_dialog.dart';
import '../../../resources_app_bank/assets_images_app_bank.dart';
import '../components/investment_top_header.dart';
import '../components/wealth_selection_section.dart';
import '../components/wealth_hot_section.dart';
import '../components/product_card.dart';

class BankInvestmentScreen extends StatefulWidget {
  const BankInvestmentScreen({super.key});

  @override
  State<BankInvestmentScreen> createState() => _BankInvestmentScreenState();
}

class _BankInvestmentScreenState extends State<BankInvestmentScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;

  final List<List<ProductCardData>> _tabProducts = [
    [
      ProductCardData('日日享', '按日申赎', '2.61', '成立以来年化'),
      ProductCardData('周周享', '短期闲钱', '1.98', '成立以来年化'),
      ProductCardData('月月享', '稳健投资', '2.32', '成立以来年化'),
      ProductCardData('年年享', '长线优选', '3.36', '成立以来年化'),
    ],
    [
      ProductCardData('日日享', '按日申赎', '2.61', '成立以来年化'),
      ProductCardData('周周享', '短期闲钱', '1.98', '成立以来年化'),
      ProductCardData('月月享', '稳健投资', '2.32', '成立以来年化'),
      ProductCardData('年年享', '长线优选', '3.36', '成立以来年化'),
    ],
    [
      ProductCardData('日日享', '按日申赎', '2.61', '成立以来年化'),
      ProductCardData('周周享', '短期闲钱', '1.98', '成立以来年化'),
      ProductCardData('月月享', '稳健投资', '2.32', '成立以来年化'),
      ProductCardData('年年享', '长线优选', '3.36', '成立以来年化'),
    ],
    [
      ProductCardData('日日享', '按日申赎', '2.61', '成立以来年化'),
      ProductCardData('周周享', '短期闲钱', '1.98', '成立以来年化'),
      ProductCardData('月月享', '稳健投资', '2.32', '成立以来年化'),
      ProductCardData('年年享', '长线优选', '3.36', '成立以来年化'),
    ],
    [
      ProductCardData('日日享', '按日申赎', '2.61', '成立以来年化'),
      ProductCardData('周周享', '短期闲钱', '1.98', '成立以来年化'),
      ProductCardData('月月享', '稳健投资', '2.32', '成立以来年化'),
      ProductCardData('年年享', '长线优选', '3.36', '成立以来年化'),
    ],
  ];

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 5, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return BankScaffold(
      currentBottomNavIndex: 2,
      backgroundColor: Colors.transparent,
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [
              Color(0xFFFBEFD9),
              Color(0xFFFBFCFE),
            ],
          ),
        ),
        child: SingleChildScrollView(
          padding: EdgeInsets.zero,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const InvestmentTopHeader(),
              _buildMainBanner(context),
              _buildServicesGrid(context),
              WealthSelectionSection(
                tabController: _tabController,
                tabProducts: _tabProducts,
              ),
              const WealthHotSection(),
              _buildLocalLifeSection(context),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildMainBanner(BuildContext context) {
    return Center(
      child: Container(
        margin: const EdgeInsets.fromLTRB(16, 8, 16, 16),
        width: double.infinity,
        decoration: BoxDecoration(
          borderRadius:
              BorderRadius.circular(BankConstants.quickAccessIconBorderRadius),
        ),
        child: ClipRRect(
          borderRadius:
              BorderRadius.circular(BankConstants.quickAccessIconBorderRadius),
          child: Stack(
            children: [
              // Background image - 100% width, proportional height, overflow hidden
              LayoutBuilder(
                builder: (context, constraints) {
                  return SizedBox(
                    width: double.infinity,
                    child: Image.asset(
                      BankImages.wealthMyAssetsBgInvestment,
                      width: double.infinity,
                      fit: BoxFit.fitWidth,
                      alignment: Alignment.topCenter,
                      errorBuilder: (context, error, stackTrace) {
                        return Container(
                          color: const Color(0xFFFAFBFD),
                          height: 200,
                        );
                      },
                    ),
                  );
                },
              ),
              // Content - button or assets info
              Consumer<BankUserProvider>(
                builder: (context, provider, child) {
                  final user = provider.user;
                  final isLoggedIn =
                      user != null || provider.globalData?.fullName != null;

                  if (isLoggedIn) {
                    // Show assets information when logged in
                    final totalAssets = provider.totalAssets;
                    final holdingsTotal = provider.holdingsTotal;
                    final isVisible = provider.isInvestmentBalanceVisible;
                    
                    return Positioned.fill(
                      child: Container(
                        padding: const EdgeInsets.fromLTRB(20, 16, 20, 16),
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisAlignment: MainAxisAlignment.start,
                          children: [
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                const Text(
                                  '我的资产',
                                  style: TextStyle(
                                    fontSize: 18,
                                    fontWeight: FontWeight.w700,
                                    color: Colors.black87,
                                  ),
                                ),
                                GestureDetector(
                                  onTap: () {
                                    provider
                                        .toggleInvestmentBalanceVisibility();
                                  },
                                  child: Icon(
                                    isVisible
                                        ? Icons.visibility
                                        : Icons.visibility_off,
                                    size: 18,
                                    color: Colors.black87,
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 12),
                            Row(
                              children: [
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      const Text(
                                        '总资产',
                                        style: TextStyle(
                                          fontSize: 11,
                                          color: Colors.black54,
                                        ),
                                      ),
                                      const SizedBox(height: 4),
                                      GestureDetector(
                                        onTap: () {
                                          provider.toggleInvestmentBalanceVisibility();
                                        },
                                        child: Text(
                                          isVisible
                                              ? provider.investmentDisplayBalance
                                              : '¥****',
                                          style: const TextStyle(
                                            fontSize: 14,
                                            fontWeight: FontWeight.w600,
                                            color: Colors.black87,
                                            fontFamily: 'monospace',
                                          ),
                                          overflow: TextOverflow.ellipsis,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                                Container(
                                  width: 1,
                                  height: 40,
                                  color: Colors.black26,
                                ),
                                const SizedBox(width: 16),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      const Text(
                                        '持仓总额',
                                        style: TextStyle(
                                          fontSize: 11,
                                          color: Colors.black54,
                                        ),
                                      ),
                                      const SizedBox(height: 4),
                                      Text(
                                        provider.formatHoldingsTotal(useProfileVisibility: false),
                                        style: const TextStyle(
                                          fontSize: 14,
                                          fontWeight: FontWeight.w600,
                                          color: Colors.black87,
                                          fontFamily: 'monospace',
                                        ),
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    );
                  }

                  // Show login button when not logged in
                  return Positioned.fill(
                    child: Container(
                      padding: const EdgeInsets.fromLTRB(20, 16, 20, 20),
                      child: Align(
                        alignment: Alignment.topCenter,
                        child: ElevatedButton(
                          onPressed: () {
                            BankLoadingDialog.show(context, title: '登录查看我的资产');
                          },
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFF8B4513),
                            foregroundColor: Colors.white,
                            padding: const EdgeInsets.symmetric(
                              horizontal: 24,
                              vertical: 12,
                            ),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(50),
                            ),
                          ),
                          child: const Text(
                            '登录查看我的资产',
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                      ),
                    ),
                  );
                },
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildServicesGrid(BuildContext context) {
    final wealthIcons = [
      WealthIconConfig(
        label: '存款产品',
        imagePath: BankImages.wealthDeposit,
        iconWidth: 32,
        iconHeight: 32,
      ),
      WealthIconConfig(
        label: '理财产品',
        imagePath: BankImages.wealthProduct,
        iconWidth: 32,
        iconHeight: 32,
      ),
      WealthIconConfig(
        label: '基金投资',
        imagePath: BankImages.wealthFund,
        iconWidth: 32,
        iconHeight: 32,
      ),
      WealthIconConfig(
        label: '保险',
        imagePath: BankImages.wealthInsurance,
        iconWidth: 32,
        iconHeight: 32,
      ),
      WealthIconConfig(
        label: '财富体检',
        imagePath: BankImages.wealthCheckup,
        iconWidth: 32,
        iconHeight: 32,
      ),
      WealthIconConfig(
        label: '龙钱宝1号',
        imagePath: BankImages.wealthLongqianbao1,
        iconWidth: 32,
        iconHeight: 32,
      ),
      WealthIconConfig(
        label: '龙钱宝2号',
        imagePath: BankImages.wealthLongqianbao2,
        iconWidth: 32,
        iconHeight: 32,
      ),
      WealthIconConfig(
        label: '速盈',
        imagePath: BankImages.wealthSuying,
        iconWidth: 32,
        iconHeight: 32,
      ),
      WealthIconConfig(
        label: '贵金属',
        imagePath: BankImages.wealthPreciousMetal,
        iconWidth: 32,
        iconHeight: 32,
      ),
      WealthIconConfig(
        label: '更多',
        imagePath: BankImages.wealthMore,
        iconWidth: 32,
        iconHeight: 32,
      ),
    ];

    return BankWealthFunctionGrid(
      title: '财富功能',
      moreText: '更多',
      onMoreTap: () {
        BankLoadingDialog.show(context, title: '更多');
      },
      icons: wealthIcons,
      gradient: const LinearGradient(
        begin: Alignment.topCenter,
        end: Alignment.bottomCenter,
        colors: [
          Color(0xFFFAFBFD),
          Color(0xFFFAFBFD),
        ],
      ),
      itemsPerRow: 5,
    );
  }

  Widget _buildLocalLifeSection(BuildContext context) {
    return BankSectionCard(
      title: '财富管理',
      gradient: const LinearGradient(
        begin: Alignment.topCenter,
        end: Alignment.bottomCenter,
        colors: [
          Color(0xFFFBFCFE),
          Color(0xFFFBFCFE),
        ],
      ),
      children: [
        Row(
          children: [
            Expanded(
              child: BankGradientCard(
                gradient: const LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [Color(0xFF74B9FF), Color(0xFF0984E3)],
                ),
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    BankTextWithSubtitle(
                      title: '财富号',
                      subtitle: '月月有好礼',
                      titleFontSize: 14,
                      subtitleFontSize: 12,
                      titleFontWeight: FontWeight.w500,
                      titleColor: Colors.white,
                      subtitleColor: Colors.white.withOpacity(0.9),
                    ),
                    const SizedBox(height: 8),
                    BankActionButton(
                      text: '去了解',
                      backgroundColor: Colors.white,
                      textColor: const Color(0xFF0984E3),
                      padding: const EdgeInsets.symmetric(
                          horizontal: 16, vertical: 8),
                      borderRadius: BankConstants.buttonBorderRadiusMedium,
                      onTap: () {
                        BankLoadingDialog.show(context, title: '财富号');
                      },
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: BankGradientCard(
                gradient: const LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [Color(0xFF74B9FF), Color(0xFF0984E3)],
                ),
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    BankTextWithSubtitle(
                      title: '周周抽好礼',
                      subtitle: '一分钱抽100元立减金',
                      titleFontSize: 14,
                      subtitleFontSize: 12,
                      titleFontWeight: FontWeight.w500,
                      titleColor: Colors.white,
                      subtitleColor: Colors.white.withOpacity(0.9),
                    ),
                    const SizedBox(height: 8),
                    BankActionButton(
                      text: '去了解',
                      backgroundColor: Colors.white,
                      textColor: const Color(0xFF0984E3),
                      padding: const EdgeInsets.symmetric(
                          horizontal: 16, vertical: 8),
                      borderRadius: BankConstants.buttonBorderRadiusMedium,
                      onTap: () {
                        BankLoadingDialog.show(context, title: '周周抽好礼');
                      },
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ],
    );
  }
}
