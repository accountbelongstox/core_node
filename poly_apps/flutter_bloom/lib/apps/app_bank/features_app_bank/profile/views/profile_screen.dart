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
import 'package:go_router/go_router.dart';
import 'package:qyflutter/apps/app_bank/config_app_bank/constants.dart';
import 'package:provider/provider.dart';
import 'package:qyflutter/common/widgets/bank_scaffold.dart';
// Fix: Use providers_app_bank/bank_user_provider.dart (returns BankUserModel?)
import '../../../providers_app_bank/bank_user_provider.dart';
import '../../settings/views/settings_screen.dart';
import '../../account_overview/views/account_overview_screen_new.dart';
import '../../../widgets_app_bank/bank_nav_icon.dart';
import '../../../widgets_app_bank/bank_stat_item.dart';
import '../../../widgets_app_bank/bank_loading_dialog.dart';
import '../../../resources_app_bank/assets_images_app_bank.dart';

class BankProfileScreen extends StatelessWidget {
  final bool forceOriginalView;
  
  const BankProfileScreen({
    super.key,
    this.forceOriginalView = false,
  });

  @override
  Widget build(BuildContext context) {
    return Consumer<BankUserProvider>(
      builder: (context, provider, child) {
        final user = provider.user;
        final isLoggedIn = provider.isAuthenticated || provider.user != null || provider.globalData?.fullName != null;

        if (forceOriginalView) {
          return _buildOriginalProfileView(context, isLoggedIn, provider, user);
        }

        if (isLoggedIn) {
          return const AccountOverviewScreenNew();
        }

        return _buildOriginalProfileView(context, isLoggedIn, provider, user);
      },
    );
  }

  Widget _buildOriginalProfileView(BuildContext context, bool isLoggedIn, BankUserProvider provider, dynamic user) {
    return BankScaffold(
      currentBottomNavIndex: 4,
      backgroundColor: Colors.transparent,
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            stops: [0.0, 0.35],
            colors: [
              Color(0xFFE9F3FC),
              Color(0xFFFAFBFF),
            ],
          ),
        ),
        child: SingleChildScrollView(
          child: Column(
            children: [
              _buildTopNavigation(context),
              _buildUserSection(context, isLoggedIn, provider, user),
              _buildTaskCenter(context),
              _buildAssetsSection(context),
              _buildServicesSection(context),
              const SizedBox(height: 20),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildTopNavigation(BuildContext context) {
    return SafeArea(
      bottom: false,
      child: Container(
        padding: const EdgeInsets.all(16),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.end,
          children: [
            BankNavIcon(
              imagePath: 'assets/apps/app_bank/images/icon_search.png',
              label: '搜索',
              fallbackIcon: Icons.search,
            ),
            const SizedBox(width: 20),
            BankNavIcon(
              imagePath: 'assets/apps/app_bank/images/profile_settings.png',
              label: '设置',
              fallbackIcon: Icons.settings,
              onTap: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (context) => const SettingsScreen(),
                  ),
                );
              },
            ),
            const SizedBox(width: 20),
            BankNavIcon(
              imagePath:
                  'assets/apps/app_bank/images/icon_customer_service.png',
              label: '客服',
              fallbackIcon: Icons.headset_mic,
            ),
            const SizedBox(width: 20),
            BankNavIcon(
              imagePath: 'assets/apps/app_bank/images/profile_message.png',
              label: '消息',
              fallbackIcon: Icons.mail_outline,
              showNotificationDot: true,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildUserSection(BuildContext context, bool isLoggedIn,
      BankUserProvider provider, dynamic user) {
    return Consumer<BankUserProvider>(
      builder: (context, provider, child) {
        final actualIsLoggedIn = provider.isAuthenticated || provider.user != null || provider.globalData?.fullName != null;
        
        return Container(
          padding: const EdgeInsets.fromLTRB(16, 20, 16, 20),
          child: Column(
            children: [
              Row(
                children: [
                  ClipOval(
                    child: Container(
                      width: 50,
                      height: 50,
                      color: Colors.grey[300],
                      child: Image.asset(
                        BankImages.defaultUserAvatar,
                        width: 50,
                        height: 50,
                        fit: BoxFit.cover,
                        errorBuilder: (context, error, stackTrace) {
                          return Container(
                            width: 50,
                            height: 50,
                            color: Colors.grey[300],
                            child: const Icon(Icons.person,
                                size: 30, color: Colors.grey),
                          );
                        },
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: GestureDetector(
                      onTap: () {
                        if (!actualIsLoggedIn) {
                          context.push(BankConstants.routeAuthentication);
                        }
                      },
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            actualIsLoggedIn
                                ? (provider.globalData?.fullName ??
                                    provider.user?.maskedName ??
                                    provider.user?.name ??
                                    '*志刚')
                                : '登录/开通',
                            style: const TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.w600,
                              color: Colors.black87,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            actualIsLoggedIn
                                ? '上次登录 ${provider.formattedLastLoginTime}'
                                : '登录后享受更多金融服务',
                            style: const TextStyle(
                              fontSize: 14,
                              color: Colors.grey,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  Expanded(
                    child: ClipRRect(
                      borderRadius: const BorderRadius.only(
                        topLeft: Radius.circular(60), // 50% of 120 = 60
                        bottomLeft: Radius.circular(60), // 50% of 120 = 60
                        topRight: Radius.circular(12), // 10% of 120 = 12
                        bottomRight: Radius.circular(12), // 10% of 120 = 12
                      ),
                      child: Image.asset(
                        BankImages.myBenefitsIcon,
                        fit: BoxFit.cover,
                        errorBuilder: (context, error, stackTrace) {
                          return const Icon(Icons.handshake,
                              size: 120, color: Colors.grey);
                        },
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 20),
              Row(
                children: [
                  BankStatItem(number: '**', label: '银行卡'),
                  BankStatItem(number: '**', label: '龙积分'),
                  BankStatItem(number: '**', label: '优惠券'),
                  BankStatItem(number: '**', label: '信用卡权益'),
                ],
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildTaskCenter(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 10),
      color: const Color(0xFFFAFBFF),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(BankConstants.borderRadius),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.1),
              spreadRadius: 0,
              blurRadius: 8,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Text(
                  '任务中心',
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w600,
                    color: Colors.black87,
                  ),
                ),
                const SizedBox(width: 12),
                const Text(
                  '开宝箱赢好礼',
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFFFF6B35),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  child: Row(
                    children: [
                      Image.asset(
                        BankImages.taskGiftIcon,
                        width: 50,
                        height: 50,
                        fit: BoxFit.cover,
                        errorBuilder: (context, error, stackTrace) {
                          return const Text('🎁',
                              style: TextStyle(fontSize: 50));
                        },
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text.rich(
                              TextSpan(
                                children: [
                                  const TextSpan(
                                    text: '玩转精选任务',
                                    style: TextStyle(
                                      fontSize: 13,
                                      fontWeight: FontWeight.w600,
                                      color: Colors.black87,
                                    ),
                                  ),
                                  const TextSpan(
                                    text: '集卡抽奖',
                                    style: TextStyle(
                                      fontSize: 13,
                                      fontWeight: FontWeight.w600,
                                      color: Color(0xFFFF6B35),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(height: 4),
                            const Text(
                              '权益享不停',
                              style: TextStyle(
                                fontSize: 11,
                                color: Colors.grey,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 12),
                Image.asset(
                  BankImages.dailyCheckinImage,
                  width: 50,
                  height: 50,
                  fit: BoxFit.cover,
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildAssetsSection(BuildContext context) {
    return Consumer<BankUserProvider>(
      builder: (context, provider, child) {
        final isAuthenticated = provider.isAuthenticated;
        
        return Container(
          padding: const EdgeInsets.fromLTRB(13, 10, 13, 16),
          color: const Color(0xFFFAFBFF),
          child: Column(
            children: [
              GestureDetector(
                onTap: () {
                  if (!isAuthenticated) {
                    context.push(BankConstants.routeAuthentication);
                  } else {
                    context.push(BankConstants.routeAccountOverview);
                  }
                },
                child: Container(
                  padding: const EdgeInsets.all(13),
                  decoration: BoxDecoration(
                    image: DecorationImage(
                      image: AssetImage(BankImages.wealthMyAssetsBg),
                      fit: BoxFit.cover,
                    ),
                    color: Colors.white,
                    borderRadius:
                        BorderRadius.circular(BankConstants.borderRadius),
                    border: Border.all(
                      color: Colors.white,
                      width: 1,
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withOpacity(0.1),
                        spreadRadius: 0,
                        blurRadius: 8,
                        offset: const Offset(0, 2),
                      ),
                    ],
                  ),
                  child: Column(
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Row(
                            children: [
                              const Text(
                                '我的资产',
                                style: TextStyle(
                                  fontSize: 14,
                                  fontWeight: FontWeight.w600,
                                  color: Colors.black87,
                                ),
                              ),
                              const SizedBox(width: 6),
                              GestureDetector(
                                onTap: () {
                                  if (!isAuthenticated) {
                                    context.push(BankConstants.routeAuthentication);
                                  } else {
                                    provider.toggleProfileBalanceVisibility();
                                  }
                                },
                                child: Icon(
                                  provider.isProfileBalanceVisible
                                      ? Icons.visibility
                                      : Icons.visibility_off,
                                  size: 16,
                                  color: Colors.grey[600],
                                ),
                              ),
                            ],
                          ),
                          const Text(
                            '更多',
                            style: TextStyle(
                              fontSize: 11,
                              color: Colors.grey,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 13),
                      Row(
                        children: [
                          Expanded(
                            child: Align(
                              alignment: Alignment.centerLeft,
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  const Text(
                                    '总资产',
                                    style: TextStyle(
                                      fontSize: 11,
                                      color: Colors.grey,
                                    ),
                                  ),
                                  const SizedBox(height: 3),
                                  Text(
                                    provider.isProfileBalanceVisible
                                        ? provider.profileDisplayBalance
                                        : '****',
                                    style: const TextStyle(
                                      fontSize: 18,
                                      fontWeight: FontWeight.w600,
                                      color: Colors.black87,
                                      fontFamily: 'monospace',
                                    ),
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ],
                              ),
                            ),
                          ),
                          Expanded(
                            child: Align(
                              alignment: Alignment.centerRight,
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.end,
                                children: [
                                  const Text(
                                    '持仓总额',
                                    style: TextStyle(
                                      fontSize: 11,
                                      color: Colors.grey,
                                    ),
                                  ),
                                  const SizedBox(height: 3),
                                  Text(
                                    provider.formatHoldingsTotal(),
                                    style: const TextStyle(
                                      fontSize: 18,
                                      fontWeight: FontWeight.w600,
                                      color: Colors.black87,
                                      fontFamily: 'monospace',
                                    ),
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
              Center(
                child: Container(
                  margin: const EdgeInsets.only(top: 0),
                  width: MediaQuery.of(context).size.width * 0.9,
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: const BorderRadius.only(
                      bottomLeft: Radius.circular(BankConstants.borderRadius),
                      bottomRight: Radius.circular(BankConstants.borderRadius),
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withOpacity(0.1),
                        spreadRadius: 0,
                        blurRadius: 8,
                        offset: const Offset(2, 2),
                      ),
                    ],
                  ),
                  child: Column(
                    children: [
                      GestureDetector(
                        onTap: () {
                          BankLoadingDialog.show(context, title: '信用卡');
                        },
                        child: Row(
                          children: [
                            Image.asset(
                              'assets/apps/app_bank/images/icon_credit_card.png',
                              width: 32,
                              height: 32,
                              errorBuilder: (context, error, stackTrace) {
                                return const Text('💳',
                                    style: TextStyle(fontSize: 32));
                              },
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  const Text(
                                    '信用卡',
                                    style: TextStyle(
                                      fontSize: 14,
                                      fontWeight: FontWeight.w600,
                                      color: Colors.black87,
                                    ),
                                  ),
                                  const Text(
                                    '办理信用卡额度高、审批快',
                                    style: TextStyle(
                                      fontSize: 12,
                                      fontWeight: FontWeight.w600,
                                      color: Colors.grey,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            const Text(
                              '>',
                              style: TextStyle(
                                fontSize: 14,
                                fontWeight: FontWeight.w600,
                                color: Colors.grey,
                              ),
                            ),
                          ],
                        ),
                      ),
                      Padding(
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        child: LayoutBuilder(
                          builder: (context, constraints) {
                            return Center(
                              child: Container(
                                width: constraints.maxWidth * 0.95,
                                height: 1,
                                color: Colors.grey[300],
                              ),
                            );
                          },
                        ),
                      ),
                      GestureDetector(
                        onTap: () {
                          BankLoadingDialog.show(context, title: '贷款');
                        },
                        child: Row(
                          children: [
                            Image.asset(
                              'assets/apps/app_bank/images/icon_loan.png',
                              width: 32,
                              height: 32,
                              errorBuilder: (context, error, stackTrace) {
                                return const Text('💰',
                                    style: TextStyle(fontSize: 32));
                              },
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Row(
                                children: [
                                  const Text(
                                    '贷款',
                                    style: TextStyle(
                                      fontSize: 14,
                                      fontWeight: FontWeight.w600,
                                      color: Colors.black87,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            const Text(
                              '>',
                              style: TextStyle(
                                fontSize: 14,
                                fontWeight: FontWeight.w600,
                                color: Colors.grey,
                              ),
                            ),
                          ],
                        ),
                      ),
                      Padding(
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        child: LayoutBuilder(
                          builder: (context, constraints) {
                            return Center(
                              child: Container(
                                width: constraints.maxWidth * 0.95,
                                height: 1,
                                color: Colors.grey[300],
                              ),
                            );
                          },
                        ),
                      ),
                      const Row(
                        children: [
                          Icon(Icons.volume_up,
                              size: 14, color: Color(0xFFFF6B35)),
                          SizedBox(width: 8),
                          Text(
                            '闲钱转入龙钱宝,随用随取',
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w600,
                              color: Color(0xFF856404),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildServicesSection(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 20, 16, 20),
      color: const Color(0xFFFAFBFF),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(BankConstants.borderRadius),
              border: Border.all(color: Colors.white, width: 1),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withOpacity(0.1),
                  spreadRadius: 0,
                  blurRadius: 8,
                  offset: const Offset(2, 2),
                ),
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  '我的服务',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w600,
                    color: Colors.black87,
                  ),
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: _buildCertificateApplicationCard(context),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: _buildMyPaymentCard(context),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: _buildMyOrdersCard(context),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: _buildRecentlyUsedCard(context),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          _buildSettingsCard(context),
        ],
      ),
    );
  }

  Widget _buildCertificateApplicationCard(BuildContext context) {
    return Container(
      height: 140,
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: const Color(0xFFFAFAFA),
        borderRadius: BorderRadius.circular(BankConstants.borderRadius),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          const Text(
            '证明申请',
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: Colors.black87,
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
          const SizedBox(height: 10),
          Expanded(
            child: Row(
              children: [
                Expanded(
                  child: _buildGridItem(
                    imagePath: BankImages.iconCertificateStatement,
                    label: '流水打印',
                    context: context,
                  ),
                ),
                const SizedBox(width: 6),
                Expanded(
                  child: _buildGridItem(
                    imagePath: BankImages.iconCertificateReport,
                    label: '个人信用报告',
                    context: context,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 6),
          Expanded(
            child: Row(
              children: [
                Expanded(
                  child: _buildGridItem(
                    imagePath: BankImages.iconCertificateCredit,
                    label: '资信证明',
                    context: context,
                  ),
                ),
                const SizedBox(width: 6),
                Expanded(
                  child: _buildGridItem(
                    imagePath: BankImages.iconCertificateCard,
                    label: '银行卡持有...',
                    context: context,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMyPaymentCard(BuildContext context) {
    return Container(
      height: 140,
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: const Color(0xFFFAFAFA),
        borderRadius: BorderRadius.circular(BankConstants.borderRadius),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Expanded(
                child: Text(
                  '我的支付',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: Colors.black87,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              const Icon(
                Icons.arrow_forward_ios,
                size: 10,
                color: Colors.grey,
              ),
            ],
          ),
          const SizedBox(height: 6),
          Row(
            children: [
              const Expanded(
                child: Text(
                  '本月消费',
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w600,
                    color: Colors.grey,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              const Icon(
                Icons.visibility_off_outlined,
                size: 12,
                color: Colors.grey,
              ),
            ],
          ),
          const SizedBox(height: 3),
          const Text(
            '****',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w600,
              color: Colors.black87,
            ),
          ),
          const Spacer(),
          const Text(
            '月月领取支付立减金',
            style: TextStyle(
              fontSize: 9,
              fontWeight: FontWeight.w600,
              color: Colors.grey,
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
          const SizedBox(height: 4),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Expanded(
                child: Text(
                  '一键绑卡',
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w600,
                    color: Colors.blue,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              const Expanded(
                child: Text(
                  '省钱卡',
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w600,
                    color: Colors.blue,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  textAlign: TextAlign.right,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildMyOrdersCard(BuildContext context) {
    return Container(
      height: 150,
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: const Color(0xFFFAFAFA),
        borderRadius: BorderRadius.circular(BankConstants.borderRadius),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          const Text(
            '我的订单',
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: Colors.black87,
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
          const SizedBox(height: 8),
          SizedBox(
            height: 28,
            child: _buildOrderItem(context, BankImages.iconOrderPayment, '缴费订单'),
          ),
          const SizedBox(height: 8),
          SizedBox(
            height: 28,
            child: _buildOrderItem(context, BankImages.iconOrderLife, '生活订单'),
          ),
          const SizedBox(height: 8),
          SizedBox(
            height: 28,
            child: _buildOrderItem(context, BankImages.iconOrderShanrong, '善融订单'),
          ),
        ],
      ),
    );
  }

  Widget _buildOrderItem(BuildContext context, String imagePath, String label) {
    return GestureDetector(
      onTap: () {
        BankLoadingDialog.show(context, title: label);
      },
      child: Row(
      children: [
        Image.asset(
          imagePath,
          height: 14,
          fit: BoxFit.contain,
          errorBuilder: (context, error, stackTrace) {
            return const Icon(Icons.receipt, size: 14, color: Colors.grey);
          },
        ),
        const SizedBox(width: 6),
        Expanded(
          child: Text(
            label,
            style: const TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.w600,
              color: Colors.black87,
              height: 1.4,
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ),
        const Icon(
          Icons.arrow_forward_ios,
          size: 10,
          color: Colors.grey,
        ),
      ],
      ),
    );
  }

  Widget _buildRecentlyUsedCard(BuildContext context) {
    return Container(
      height: 140,
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: const Color(0xFFFAFAFA),
        borderRadius: BorderRadius.circular(BankConstants.borderRadius),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          const Text(
            '最近使用',
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: Colors.black87,
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
          const SizedBox(height: 10),
          Expanded(
            child: Row(
              children: [
                Expanded(
                  child: _buildGridItem(
                    imagePath: BankImages.iconRecentlyCustomerService,
                    label: '建行客服',
                    context: context,
                  ),
                ),
                const SizedBox(width: 6),
                Expanded(
                  child: _buildGridItem(
                    imagePath: BankImages.iconRecentlyCardChange,
                    label: '卡面随心换',
                    context: context,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 6),
          Expanded(
            child: Row(
              children: [
                Expanded(
                  child: _buildGridItem(
                    imagePath: BankImages.iconRecentlyMessage,
                    label: '消息',
                    context: context,
                  ),
                ),
                const SizedBox(width: 6),
                Expanded(
                  child: _buildGridItem(
                    imagePath: BankImages.iconRecentlyLoan,
                    label: '贷款',
                    context: context,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildGridItem(
      {IconData? icon, String? imagePath, required String label, BuildContext? context}) {
    Widget content = Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        imagePath != null
            ? Image.asset(
                imagePath,
                width: 20,
                height: 20,
                fit: BoxFit.contain,
                errorBuilder: (context, error, stackTrace) {
                  return Icon(icon ?? Icons.image,
                      size: 20, color: Colors.black87);
                },
              )
            : Icon(icon ?? Icons.image, size: 20, color: Colors.black87),
        const SizedBox(height: 4),
        Text(
          label,
          style: const TextStyle(
            fontSize: 9,
            fontWeight: FontWeight.w600,
            color: Colors.black87,
          ),
          textAlign: TextAlign.center,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
      ],
    );
    
    if (context != null) {
      return GestureDetector(
        onTap: () {
          BankLoadingDialog.show(context, title: label);
        },
        child: content,
      );
    }
    
    return content;
  }

  Widget _buildSettingsCard(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(BankConstants.borderRadius),
        border: Border.all(color: Colors.white, width: 1),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.1),
            spreadRadius: 0,
            blurRadius: 8,
            offset: const Offset(2, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                '我的设置',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w600,
                  color: Colors.black87,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              Row(
                children: [
                  const Text(
                    '更多',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: Colors.grey,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(width: 4),
                  const Icon(
                    Icons.arrow_forward_ios,
                    size: 10,
                    color: Colors.grey,
                  ),
                ],
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: [
              _buildSettingItem(
                  imagePath: BankImages.iconSettingFingerprint, label: '指纹', context: context),
              _buildSettingItem(
                  imagePath: BankImages.iconSettingTransferLimit,
                  label: '转账限额', context: context),
              _buildSettingItem(
                  imagePath: BankImages.iconSettingChangePhone, label: '修改手机号', context: context),
              _buildSettingItem(
                  imagePath: BankImages.iconSettingBindDevice, label: '绑定设备', context: context),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildSettingItem(
      {IconData? icon, String? imagePath, required String label, BuildContext? context}) {
    final Widget content = Column(
      children: [
        imagePath != null
            ? Image.asset(
                imagePath,
                width: 20,
                height: 20,
                fit: BoxFit.contain,
                errorBuilder: (context, error, stackTrace) {
                  return Icon(icon ?? Icons.settings,
                      size: 20, color: Colors.black87);
                },
              )
            : Icon(icon ?? Icons.settings, size: 20, color: Colors.black87),
        const SizedBox(height: 4),
        Text(
          label,
          style: const TextStyle(
            fontSize: 10,
            fontWeight: FontWeight.w600,
            color: Colors.black87,
          ),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
      ],
    );
    
    if (context != null) {
      return GestureDetector(
        onTap: () {
          BankLoadingDialog.show(context, title: label);
        },
        child: content,
      );
    }
    
    return content;
  }
}
