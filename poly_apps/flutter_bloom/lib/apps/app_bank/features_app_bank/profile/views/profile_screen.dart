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
import 'package:qyflutter/apps/app_bank/config_app_bank/bank_user_provider.dart';
import '../../settings/views/settings_screen.dart';
import '../../../config_app_bank/theme_config_app_bank.dart';

class BankProfileScreen extends StatelessWidget {
  const BankProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return BankScaffold(
      currentBottomNavIndex: 4,
      backgroundColor: BankColorProvider.scaffoldBackground,
      body: Column(
        children: [
          _buildTopNavigation(context),
          Expanded(
            child: SingleChildScrollView(
              child: Column(
                children: [
                  _buildUserSection(context),
                  _buildTaskCenter(context),
                  _buildAssetsSection(context),
                  _buildServicesSection(context),
                  const SizedBox(height: 100),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }



  Widget _buildTopNavigation(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      color: Colors.white,
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          const Text(
            '安全退出',
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w600,
              color: Colors.black87,
            ),
          ),
          Row(
            children: [
              _buildNavIcon(context, 'assets/apps/app_bank/images/icon_search.png', '搜索', Icons.search),
              const SizedBox(width: 20),
              GestureDetector(
                onTap: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (context) => const SettingsScreen(),
                    ),
                  );
                },
                child: _buildNavIcon(context, 'assets/apps/app_bank/images/profile_settings.png', '设置', Icons.settings),
              ),
              const SizedBox(width: 20),
              _buildNavIcon(context, 'assets/apps/app_bank/images/icon_customer_service.png', '客服', Icons.person),
              const SizedBox(width: 20),
              _buildNavIcon(context, 'assets/apps/app_bank/images/profile_message.png', '消息', Icons.message),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildNavIcon(BuildContext context, String imagePath, String label, IconData fallbackIcon) {
    return Column(
      children: [
        Container(
          width: 32,
          height: 32,
          decoration: BoxDecoration(
            color: const Color(0xFFF0F0F0),
            borderRadius: BorderRadius.circular(16),
          ),
          child: Center(
            child: Image.asset(
              imagePath,
              width: 16,
              height: 16,
              errorBuilder: (context, error, stackTrace) {
                return Icon(fallbackIcon, size: 16, color: Colors.grey[600]);
              },
            ),
          ),
        ),
        const SizedBox(height: 4),
        Text(
          label,
          style: const TextStyle(
            fontSize: 12,
            color: Colors.grey,
          ),
        ),
      ],
    );
  }

  Widget _buildUserSection(BuildContext context) {
    return Consumer<BankUserProvider>(
      builder: (context, provider, child) {
        final user = provider.user;
        return Container(
          padding: const EdgeInsets.fromLTRB(16, 20, 16, 20),
          color: Colors.white,
          child: Column(
            children: [
              Row(
                children: [
                  Container(
                    width: 50,
                    height: 50,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      gradient: const LinearGradient(
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                        colors: [Color(0xFFFF9A9E), Color(0xFFFECFEF)],
                      ),
                    ),
                    child: Center(
                      child: Image.asset(
                        'assets/apps/app_bank/images/profile_avatar.png',
                        width: 30,
                        height: 30,
                        errorBuilder: (context, error, stackTrace) {
                          return const Icon(Icons.person, size: 24, color: Colors.white);
                        },
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          user?.maskedName ?? '*志刚',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w600,
                        color: Colors.black87,
                      ),
                    ),
                        const SizedBox(height: 4),
                        Text(
                          '上次登录 ${provider.formattedLastLoginTime}',
                          style: const TextStyle(
                            fontSize: 14,
                            color: Colors.grey,
                          ),
                        ),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [Color(0xFFFFD89B), Color(0xFF19547B)],
                  ),
                  borderRadius: BorderRadius.circular(15),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Image.asset(
                      'assets/apps/app_bank/images/profile_vip.png',
                      width: 12,
                      height: 12,
                      color: Colors.white,
                      errorBuilder: (context, error, stackTrace) {
                        return const Text('🍞', style: TextStyle(fontSize: 12));
                      },
                    ),
                    const SizedBox(width: 4),
                    const Text(
                      '我的权益',
                      style: TextStyle(
                        fontSize: 12,
                        color: Colors.white,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),
          Row(
            children: [
              _buildStatItem('${user?.cardCount ?? 0}', '银行卡'),
              _buildStatItem('${user?.points ?? 0}', '积分'),
              _buildStatItem('${user?.coupons ?? 0}', '优惠券'),
              _buildStatItem(user?.creditCardLevel ?? 'N/A', '信用卡权益'),
            ],
          ),
        ],
      ),
    );
      },
    );
  }

  Widget _buildStatItem(String number, String label) {
    return Expanded(
      child: Column(
        children: [
          Text(
            number,
            style: const TextStyle(
              fontSize: 24,
              fontWeight: FontWeight.w600,
              color: Colors.black87,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            label,
            style: const TextStyle(
              fontSize: 12,
              color: Colors.grey,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTaskCenter(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 20),
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
              const SizedBox(width: 8),
              Image.asset(
                'assets/apps/app_bank/images/icon_task_gift.png',
                width: 16,
                height: 16,
                errorBuilder: (context, error, stackTrace) {
                  return const Text('🎁', style: TextStyle(fontSize: 16));
                },
              ),
              const SizedBox(width: 4),
              const Text(
                '赚任务分享宝箱赢好礼',
                style: TextStyle(
                  fontSize: 14,
                  color: Colors.grey,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [Color(0xFFFF9A9E), Color(0xFFFECFEF)],
              ),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        '浏览精选任务 赚分抽奖',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w500,
                          color: Colors.white,
                        ),
                      ),
                      const SizedBox(height: 4),
                      const Text(
                        '权益享不停',
                        style: TextStyle(
                          fontSize: 14,
                          color: Colors.white,
                        ),
                      ),
                    ],
                  ),
                ),
                Container(
                  width: 60,
                  height: 60,
                  decoration: BoxDecoration(
                    color: Colors.white.withOpacity(0.2),
                    borderRadius: BorderRadius.circular(30),
                  ),
                  child: Center(
                    child: Image.asset(
                      'assets/apps/app_bank/images/icon_task_gift.png',
                      width: 30,
                      height: 30,
                      color: Colors.white,
                      errorBuilder: (context, error, stackTrace) {
                        return const Text('🎁', style: TextStyle(fontSize: 30));
                      },
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(12),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withOpacity(0.1),
                  spreadRadius: 0,
                  blurRadius: 8,
                  offset: const Offset(0, 2),
                ),
              ],
            ),
            child: Row(
              children: [
                Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: [Color(0xFFFF9A9E), Color(0xFFFECFEF)],
                    ),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Center(
                    child: Image.asset(
                      'assets/apps/app_bank/images/icon_checkin.png',
                      width: 20,
                      height: 20,
                      color: Colors.white,
                      errorBuilder: (context, error, stackTrace) {
                        return const Text('❤️', style: TextStyle(fontSize: 20));
                      },
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                const Text(
                  '每日签到',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w500,
                    color: Colors.black87,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildAssetsSection(BuildContext context) {
    return Consumer<BankUserProvider>(
      builder: (context, provider, child) {
        return Container(
          padding: const EdgeInsets.fromLTRB(16, 20, 16, 20),
          color: const Color(0xFFF8F9FA),
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
                          fontSize: 18,
                          fontWeight: FontWeight.w600,
                          color: Colors.black87,
                        ),
                      ),
                      const SizedBox(width: 8),
                      const Text('👁️', style: TextStyle(fontSize: 16)),
                      const SizedBox(width: 4),
                      const Text('👁️‍🗨️', style: TextStyle(fontSize: 16)),
                    ],
                  ),
                  const Text(
                    '更多',
                    style: TextStyle(
                      fontSize: 14,
                      color: Colors.grey,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              Align(
                alignment: Alignment.centerLeft,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      '总资产',
                      style: TextStyle(
                        fontSize: 14,
                        color: Colors.grey,
                      ),
                    ),
                    const SizedBox(height: 4),
                    GestureDetector(
                      onTap: () {
                        provider.toggleProfileBalanceVisibility();
                      },
                      child: Row(
                        children: [
                          Text(
                            provider.profileDisplayBalance,
                            style: const TextStyle(
                              fontSize: 32,
                              fontWeight: FontWeight.w600,
                              color: Colors.black87,
                            ),
                          ),
                          const SizedBox(width: 12),
                          Icon(
                            provider.isProfileBalanceVisible ? Icons.visibility : Icons.visibility_off,
                            size: 24,
                            color: Colors.grey[600],
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
          const SizedBox(height: 20),
          _buildAssetItem(
            context,
            'assets/apps/app_bank/images/icon_credit_card.png',
            '信用卡',
            '办理信用卡 额度高、审批快',
            '💳',
          ),
          const SizedBox(height: 12),
          _buildAssetItem(
            context,
            'assets/apps/app_bank/images/icon_loan.png',
            '贷款',
            '灵活借还 快速到账\n建信信贷|申建信消费金融公司提供',
            '💰',
          ),
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: const Color(0xFFFFF3CD),
              border: Border.all(color: const Color(0xFFFFEAA7)),
              borderRadius: BorderRadius.circular(8),
            ),
            child: const Row(
              children: [
                Text('🔸', style: TextStyle(fontSize: 16)),
                SizedBox(width: 8),
                Text(
                  '闲钱转入龙钱包，随用随取',
                  style: TextStyle(
                    fontSize: 14,
                    color: Color(0xFF856404),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
      },
    );
  }

  Widget _buildAssetItem(BuildContext context, String imagePath, String title, String description, String fallbackEmoji) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.05),
            spreadRadius: 0,
            blurRadius: 4,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: const Color(0xFFF0F0F0),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Center(
              child: Image.asset(
                imagePath,
                width: 24,
                height: 24,
                errorBuilder: (context, error, stackTrace) {
                  return Text(fallbackEmoji, style: const TextStyle(fontSize: 24));
                },
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w500,
                    color: Colors.black87,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  description,
                  style: const TextStyle(
                    fontSize: 14,
                    color: Colors.grey,
                  ),
                ),
              ],
            ),
          ),
          const Text(
            '>',
            style: TextStyle(
              fontSize: 16,
              color: Colors.grey,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildServicesSection(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 20, 16, 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            '我的服务',
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
                child: _buildServiceItem(
                  context,
                  'assets/apps/app_bank/images/icon_manager.png',
                  '专属客户经理',
                  '👤',
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: _buildServiceItem(
                  context,
                  'assets/apps/app_bank/images/icon_certificate.png',
                  '证明申请',
                  '📄',
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildServiceItem(BuildContext context, String imagePath, String title, String fallbackEmoji) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
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
          Container(
            width: 50,
            height: 50,
            decoration: BoxDecoration(
              color: const Color(0xFFF0F0F0),
              borderRadius: BorderRadius.circular(25),
            ),
            child: Center(
              child: Image.asset(
                imagePath,
                width: 24,
                height: 24,
                errorBuilder: (context, error, stackTrace) {
                  return Text(fallbackEmoji, style: const TextStyle(fontSize: 24));
                },
              ),
            ),
          ),
          const SizedBox(height: 12),
          Text(
            title,
            style: const TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w500,
              color: Colors.black87,
            ),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }
}

