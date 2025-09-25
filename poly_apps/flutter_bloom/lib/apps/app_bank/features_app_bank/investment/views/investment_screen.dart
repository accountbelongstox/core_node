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
import 'package:qyflutter/common/provider_status/bank_user_provider.dart';
import '../../../config_app_bank/theme_config_app_bank.dart';

class BankInvestmentScreen extends StatelessWidget {
  const BankInvestmentScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return BankScaffold(
      currentBottomNavIndex: 2,
      backgroundColor: BankColorProvider.scaffoldBackground,
      body: Column(
        children: [
          _buildTopHeader(context),
          Expanded(
            child: SingleChildScrollView(
              child: Column(
                children: [
                  _buildMainBanner(context),
                  _buildServicesGrid(context),
                  _buildPaymentSection(context),
                  _buildLocalLifeSection(context),
                  const SizedBox(height: 100),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }



  Widget _buildTopHeader(BuildContext context) {
    return Consumer<BankUserProvider>(
      builder: (context, provider, child) {
        final user = provider.user;
        return Container(
          padding: const EdgeInsets.all(12),
          color: Colors.white,
          child: Row(
            children: [
              Row(
                children: [
                  const Text('📍', style: TextStyle(fontSize: 16)),
                  const SizedBox(width: 4),
                  Text(
                    user?.location ?? '北京',
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w500,
                      color: Colors.black87,
                    ),
                  ),
                ],
              ),
          const SizedBox(width: 12),
          Expanded(
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              decoration: BoxDecoration(
                color: const Color(0xFFF5F5F5),
                borderRadius: BorderRadius.circular(20),
              ),
              child: const Text(
                '查看您的理财收益',
                style: TextStyle(
                  fontSize: 14,
                  color: Colors.grey,
                ),
              ),
            ),
          ),
          const SizedBox(width: 12),
          Row(
            children: [
              _buildHeaderIcon('🎧', '客服'),
              const SizedBox(width: 16),
              _buildHeaderIcon('📋', '订单'),
            ],
          ),
        ],
      ),
    );
      },
    );
  }

  Widget _buildHeaderIcon(String emoji, String label) {
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
            child: Text(emoji, style: const TextStyle(fontSize: 16)),
          ),
        ),
        const SizedBox(height: 2),
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

  Widget _buildMainBanner(BuildContext context) {
    return Container(
      margin: const EdgeInsets.all(16),
      height: 160,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(12),
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFFFFECD2), Color(0xFFFCB69F)],
        ),
      ),
      child: Stack(
        children: [
          Positioned(
            left: 20,
            top: 20,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Text('🌟', style: TextStyle(fontSize: 20)),
                    const SizedBox(width: 4),
                    const Text(
                      '理财小助手',
                      style: TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.w600,
                        color: Color(0xFFD4691A),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                const Text(
                  '智能投资享收益',
                  style: TextStyle(
                    fontSize: 16,
                    color: Color(0xFFE67E22),
                  ),
                ),
                const SizedBox(height: 4),
                const Text(
                  '年化收益率高达8%',
                  style: TextStyle(
                    fontSize: 14,
                    color: Color(0xFF8B4513),
                  ),
                ),
              ],
            ),
          ),
          Positioned(
            right: 20,
            top: 20,
            child: Container(
              width: 120,
              height: 120,
              decoration: BoxDecoration(
                color: Colors.white.withOpacity(0.3),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Center(
                child: Image.asset(
                  'assets/apps/app_bank/images/wealth_person.png',
                  width: 80,
                  height: 80,
                  errorBuilder: (context, error, stackTrace) {
                    return const Text('👩‍💼', style: TextStyle(fontSize: 48));
                  },
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildServicesGrid(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 20, 16, 20),
      color: Colors.white,
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceEvenly,
            children: [
              _buildServiceItem('assets/apps/app_bank/images/service_phone.png', '基金理财', const Color(0xFFE3F2FD), '📱'),
              _buildServiceItem('assets/apps/app_bank/images/service_electric.png', '定期存款', const Color(0xFFFFF3E0), '⚡'),
              _buildServiceItem('assets/apps/app_bank/images/service_medical.png', '保险产品', const Color(0xFFF3E5F5), '🏥'),
              _buildServiceItem('assets/apps/app_bank/images/service_life.png', '黄金投资', const Color(0xFFE8F5E8), '🏠'),
              _buildServiceItem('assets/apps/app_bank/images/service_movie.png', '股票交易', const Color(0xFFFCE4EC), '🎬'),
            ],
          ),
          const SizedBox(height: 20),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceEvenly,
            children: [
              _buildServiceItem('assets/apps/app_bank/images/service_food.png', '债券投资', const Color(0xFFFFF8E1), '🍽️'),
              _buildServiceItem('assets/apps/app_bank/images/service_points.png', '积分理财', const Color(0xFFE1F5FE), '🏪'),
              _buildServiceItem('assets/apps/app_bank/images/service_party.png', '外汇交易', const Color(0xFFFFEBEE), '🎉'),
              _buildServiceItem('assets/apps/app_bank/images/service_gas.png', '期货投资', const Color(0xFFF1F8E9), '🔥'),
              _buildServiceItem('assets/apps/app_bank/images/service_water.png', '信托产品', const Color(0xFFE0F2F1), '💧'),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildServiceItem(String imagePath, String title, Color backgroundColor, String fallbackEmoji) {
    return Column(
      children: [
        Container(
          width: 48,
          height: 48,
          decoration: BoxDecoration(
            color: backgroundColor,
            borderRadius: BorderRadius.circular(12),
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
        const SizedBox(height: 8),
        Text(
          title,
          style: const TextStyle(
            fontSize: 12,
            color: Colors.black87,
          ),
          textAlign: TextAlign.center,
        ),
      ],
    );
  }

  Widget _buildPaymentSection(BuildContext context) {
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 8, 16, 8),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.05),
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
              const Text(
                '理财产品',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w600,
                  color: Colors.black87,
                ),
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
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceEvenly,
            children: [
              _buildPaymentItem('assets/apps/app_bank/images/payment_gas.png', '货币基金', '🔥'),
              _buildPaymentItem('assets/apps/app_bank/images/payment_heating.png', '混合基金', '📡'),
              _buildPaymentItem('assets/apps/app_bank/images/payment_landline.png', '股票基金', '📞'),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildPaymentItem(String imagePath, String title, String fallbackEmoji) {
    return Column(
      children: [
        Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(
            color: const Color(0xFFF8F9FA),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Center(
            child: Image.asset(
              imagePath,
              width: 20,
              height: 20,
              errorBuilder: (context, error, stackTrace) {
                return Text(fallbackEmoji, style: const TextStyle(fontSize: 20));
              },
            ),
          ),
        ),
        const SizedBox(height: 8),
        Text(
          title,
          style: const TextStyle(
            fontSize: 14,
            color: Colors.black87,
          ),
        ),
        const SizedBox(height: 4),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [Color(0xFFFF9A56), Color(0xFFFF6B35)],
            ),
            borderRadius: BorderRadius.circular(20),
          ),
          child: const Text(
            '立即购买',
            style: TextStyle(
              fontSize: 12,
              color: Colors.white,
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildLocalLifeSection(BuildContext context) {
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 8, 16, 8),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.05),
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
              const Text(
                '财富管理',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w600,
                  color: Colors.black87,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: _buildLifeCard(
                  'assets/apps/app_bank/images/life_wealth.png',
                  '财富号',
                  '月月有好礼',
                  '💰',
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _buildLifeCard(
                  'assets/apps/app_bank/images/life_lottery.png',
                  '周周抽好礼',
                  '一分钱抽100元立减金',
                  '🎁',
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildLifeCard(String imagePath, String title, String description, String fallbackEmoji) {
    return Container(
      decoration: BoxDecoration(
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
            height: 100,
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [Color(0xFF74B9FF), Color(0xFF0984E3)],
              ),
              borderRadius: BorderRadius.only(
                topLeft: Radius.circular(12),
                topRight: Radius.circular(12),
              ),
            ),
            child: Center(
              child: Image.asset(
                imagePath,
                width: 32,
                height: 32,
                color: Colors.white,
                errorBuilder: (context, error, stackTrace) {
                  return Text(fallbackEmoji, style: const TextStyle(fontSize: 32, color: Colors.white));
                },
              ),
            ),
          ),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: const BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.only(
                bottomLeft: Radius.circular(12),
                bottomRight: Radius.circular(12),
              ),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w500,
                    color: Colors.black87,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  description,
                  style: const TextStyle(
                    fontSize: 12,
                    color: Colors.grey,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
