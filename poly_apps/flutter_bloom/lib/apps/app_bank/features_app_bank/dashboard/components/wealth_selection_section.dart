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
import 'package:qyflutter/apps/app_bank/config_app_bank/constants.dart';
import '../../../resources_app_bank/assets_images_app_bank.dart';
import '../../../providers_app_bank/bank_user_provider.dart';
import '../../../widgets_app_bank/bank_loading_dialog.dart';
import 'wealth_large_card.dart';
import 'wealth_small_card.dart';

/// Wealth Selection Section Component
///
/// Displays a wealth selection section with:
/// - Left large card showing featured product
/// - Right column with two small cards
class WealthSelectionSection extends StatelessWidget {
  const WealthSelectionSection({super.key});


  @override
  Widget build(BuildContext context) {
    final baseDecoration = BankConstants.getDashboardCardDecoration();
    return Container(
      margin: const EdgeInsets.all(16),
      padding: const EdgeInsets.all(16),
      decoration: baseDecoration.copyWith(
        gradient: const LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [
            Color(0xFFF1FAFF),
            Color(0xFFEEF7FE),
            Color(0xFFF1FAFF),
          ],
          stops: [0.0, 0.5, 1.0],
        ),
        color: null, // Remove solid color when using gradient
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          const Padding(
            padding: EdgeInsets.only(left: 4, bottom: 12),
                  child: Text(
                    '财富精选',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w900, // Extra bold
                      color: Colors.black,
                    ),
                  ),
          ),
          LayoutBuilder(
            builder: (context, constraints) {
              return IntrinsicHeight(
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    // Left large card
                    const Expanded(
                      flex: 3,
                      child: WealthLargeCard(),
                    ),
                    const SizedBox(width: 12),
                    // Right column with two small cards
                    Expanded(
                      flex: 2,
                      child: Column(
                        mainAxisSize: MainAxisSize.max,
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          // Top small card
                          const Expanded(
                            child: WealthSmallCard(
                              title: '建信货币B',
                              percentage: '1.4020%',
                              percentageLabel: '七日年化',
                            ),
                          ),
                          const SizedBox(height: 8),
                          // Bottom small card
                          const Expanded(
                            child: WealthSmallCard(
                              title: '整存整取',
                              percentage: '1.55%',
                              percentageLabel: '最高年利率',
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              );
            },
          ),
          const SizedBox(height: 16),
          const SizedBox(height: 16),
          // Wealth features section
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: [
              _buildWealthFeatureItem(
                context,
                imagePath: BankImages.bankWealthCheckup,
                label: '财富体检',
              ),
              _buildWealthFeatureItem(
                context,
                imagePath: BankImages.bankPensionPlanning,
                label: '养老规划',
              ),
              _buildWealthFeatureItem(
                context,
                imagePath: BankImages.bankWealthActivity,
                label: '财富活动',
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildWealthFeatureItem(
    BuildContext context, {
    required String imagePath,
    required String label,
  }) {
    return Expanded(
      child: GestureDetector(
        onTap: () => _showLoadingDialog(context, label),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          mainAxisSize: MainAxisSize.min,
          children: [
            Image.asset(
              imagePath,
              width: 20,
              height: 20,
              fit: BoxFit.contain,
            ),
            const SizedBox(width: 6),
            Text(
              label,
              style: const TextStyle(
                fontSize: 14,
                color: Colors.black87,
                fontWeight: FontWeight.bold,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
      ),
    );
  }

  void _showLoadingDialog(BuildContext context, String label) {
    BankLoadingDialog.show(
      context,
      title: label,
    );
  }

}
