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
import '../../../resources_app_bank/assets_images_app_bank.dart';
import '../../../widgets_app_bank/bank_loading_dialog.dart';

/// Card Features Grid Component
///
/// Displays credit card features grid with background image:
/// - 信用卡包, 卡权益, 信用卡申请, 增值礼遇, 额度调整, 积分兑换, 分期通, 一键绑卡, 现金转出, 更多
class CardFeaturesGrid extends StatelessWidget {
  const CardFeaturesGrid({super.key});

  @override
  Widget build(BuildContext context) {
    final features = [
      _FeatureItem('信用卡包', BankImages.bankIconWallet),
      _FeatureItem('卡权益', BankImages.bankIconCardRights),
      _FeatureItem('信用卡申请', BankImages.bankIconCardApply),
      _FeatureItem('增值礼遇', BankImages.bankIconValueGift),
      _FeatureItem('额度调整', BankImages.bankIconLimitAdjust),
      _FeatureItem('积分兑换', BankImages.bankIconPointsExchange),
      _FeatureItem('分期通', BankImages.bankIconInstallment),
      _FeatureItem('一键绑卡', BankImages.bankIconQuickBind),
      _FeatureItem('现金转出', BankImages.bankIconCashOut),
      _FeatureItem('更多', BankImages.bankIconMore),
    ];

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      padding: const EdgeInsets.fromLTRB(8, 8, 8, 8), // Reduced padding to fill with images
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // First row: 5 items
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceEvenly,
            children: features
                .take(5)
                .map((feature) => Expanded(
                      child: _buildFeatureItem(context, feature),
                    ))
                .toList(),
          ),
          const SizedBox(height: 16),
          // Second row: 5 items
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceEvenly,
            children: features
                .skip(5)
                .take(5)
                .map((feature) => Expanded(
                      child: _buildFeatureItem(context, feature),
                    ))
                .toList(),
          ),
        ],
      ),
    );
  }

  Widget _buildFeatureItem(BuildContext context, _FeatureItem feature) {
    return GestureDetector(
      onTap: () {
        BankLoadingDialog.show(context, title: feature.label);
      },
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 37.44, // 62.4 * 0.6 = 37.44 (40% smaller)
            height: 37.44, // 62.4 * 0.6 = 37.44 (40% smaller)
            padding: EdgeInsets.zero, // Remove padding to fill container
            child: Image.asset(
              feature.iconPath,
              width: 37.44,
              height: 37.44,
              fit: BoxFit.contain, // Maintain aspect ratio, no stretching
            ),
          ),
          const SizedBox(height: 8),
          Text(
            feature.label,
            style: const TextStyle(
              fontSize: 12,
              color: Colors.black87,
            ),
            textAlign: TextAlign.center,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ),
    );
  }
}

class _FeatureItem {
  final String label;
  final String iconPath;

  _FeatureItem(this.label, this.iconPath);
}

