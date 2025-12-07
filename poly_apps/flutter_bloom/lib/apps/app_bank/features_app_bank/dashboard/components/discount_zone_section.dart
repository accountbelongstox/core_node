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

/// Discount Zone Section Component
///
/// Displays a discount zone section with:
/// - Left card: 财富会员
/// - Top right card: 支付达标赢好礼
/// - Bottom right card: 消费金融专项行动专区
class DiscountZoneSection extends StatelessWidget {
  const DiscountZoneSection({super.key});

  // Unified card decoration for small cards
  BoxDecoration _getUnifiedCardDecoration() {
    return BoxDecoration(
      color: const Color(0xFFF8FCFF), // Internal background color
      borderRadius: BorderRadius.circular(12),
      border: Border.all(
        color: Colors.white.withOpacity(0.8),
        width: 1.5,
      ),
      boxShadow: [
        // White glow border effect
        BoxShadow(
          color: Colors.white.withOpacity(0.9),
          spreadRadius: 2.0,
          blurRadius: 12.0,
          offset: const Offset(0, 0),
        ),
        // Drop shadow effect
        BoxShadow(
          color: Colors.black.withOpacity(0.04),
          spreadRadius: 0,
          blurRadius: 8.0,
          offset: const Offset(0, 6),
        ),
        BoxShadow(
          color: Colors.black.withOpacity(0.02),
          spreadRadius: 0,
          blurRadius: 4.0,
          offset: const Offset(0, 3),
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
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
          // Header with title
          const Text(
            '优惠专区',
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w900, // Extra bold
              color: Colors.black87,
            ),
          ),
          const SizedBox(height: 16),
          // Discount cards layout
          LayoutBuilder(
            builder: (context, constraints) {
              return IntrinsicHeight(
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    // Left card: 财富会员
                    Expanded(
                      flex: 1,
                      child: Container(
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF8FCFF), // Background color
                          borderRadius: BorderRadius.circular(12),
                          boxShadow: [
                            BoxShadow(
                              color: Colors.black.withOpacity(0.05),
                              blurRadius: 4,
                              offset: const Offset(0, 2),
                            ),
                          ],
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Text(
                              '财富会员',
                              style: TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.bold,
                                color: Colors.black87,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                            const SizedBox(height: 8),
                            const Text(
                              '月月享好礼',
                              style: TextStyle(
                                fontSize: 12,
                                color: Colors.black54,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                            const Spacer(),
                            const SizedBox(height: 12),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 16, vertical: 8),
                              decoration: BoxDecoration(
                                gradient: const LinearGradient(
                                  begin: Alignment.centerLeft,
                                  end: Alignment.centerRight,
                                  colors: [
                                    Color(0xFFE1BC87), // #E1BC87
                                    Color(0xFFD39A49), // #D39A49
                                  ],
                                ),
                                borderRadius: BorderRadius.circular(20),
                              ),
                              child: const Text(
                                '去了解',
                                style: TextStyle(
                                  fontSize: 14,
                                  color: Colors.white,
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    // Right column with two cards
                    Expanded(
                      flex: 1,
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          // Top right card: 支付达标赢好礼
                          Expanded(
                            child: Container(
                              padding: const EdgeInsets.all(12),
                              decoration: _getUnifiedCardDecoration(),
                              child: Stack(
                                children: [
                                  Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    mainAxisAlignment: MainAxisAlignment.start,
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      const Text(
                                        '支付达标赢好礼',
                                        style: TextStyle(
                                          fontSize: 14,
                                          fontWeight: FontWeight.bold,
                                          color: Colors.black87,
                                        ),
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                      const SizedBox(height: 4),
                                      const Text(
                                        '抽微信立减金',
                                        style: TextStyle(
                                          fontSize: 12,
                                          color: Colors.black54,
                                        ),
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                    ],
                                  ),
                                  // Background image at bottom right
                                  Positioned(
                                    right: 0,
                                    bottom: 0,
                                    child: ClipRRect(
                                      borderRadius: const BorderRadius.only(
                                        bottomRight: Radius.circular(12),
                                      ),
                                      child: Image.asset(
                                        BankImages.bankDiscountGift,
                                        width:
                                            30, // 60 * 0.5 = 30 (50% smaller)
                                        height:
                                            30, // 60 * 0.5 = 30 (50% smaller)
                                        fit: BoxFit.cover,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                          const SizedBox(height: 8),
                          // Bottom right card: 消费金融专项行动专区
                          Expanded(
                            child: Container(
                              padding: const EdgeInsets.all(12),
                              decoration: _getUnifiedCardDecoration(),
                              child: Stack(
                                children: [
                                  Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    mainAxisAlignment: MainAxisAlignment.start,
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      const Text(
                                        '消费金融专项行动专区',
                                        style: TextStyle(
                                          fontSize: 14,
                                          fontWeight: FontWeight.bold,
                                          color: Colors.black87,
                                        ),
                                        maxLines: 2,
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                      const SizedBox(height: 4),
                                      const Text(
                                        '享好礼,惠消费',
                                        style: TextStyle(
                                          fontSize: 12,
                                          color: Colors.black54,
                                        ),
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                    ],
                                  ),
                                  // Background image at bottom right
                                  Positioned(
                                    right: 0,
                                    bottom: 0,
                                    child: ClipRRect(
                                      borderRadius: const BorderRadius.only(
                                        bottomRight: Radius.circular(12),
                                      ),
                                      child: Image.asset(
                                        BankImages.bankDiscountZone,
                                        width:
                                            30, // 60 * 0.5 = 30 (50% smaller)
                                        height:
                                            30, // 60 * 0.5 = 30 (50% smaller)
                                        fit: BoxFit.cover,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
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
        ],
      ),
    );
  }
}
