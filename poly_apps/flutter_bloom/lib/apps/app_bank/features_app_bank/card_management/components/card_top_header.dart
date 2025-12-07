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
import 'package:qyflutter/common/widgets/custom_image_icon_label.dart';
import '../../../resources_app_bank/assets_images_app_bank.dart';

/// Card Top Header Component
///
/// Displays the top header for credit card page with:
/// - Location indicator (北京)
/// - Search bar (same position as dashboard)
/// - Customer service and message icons
class CardTopHeader extends StatelessWidget {
  const CardTopHeader({super.key});

  @override
  Widget build(BuildContext context) {
    return ClipRect(
      child: Container(
        padding: const EdgeInsets.fromLTRB(16, 0, 16, 11.2),
        child: Stack(
          children: [
            // Background image positioned below search box
            Positioned(
              top: 80, // Start background image below search box area
              left: 0,
              right: 0,
              bottom: 0,
              child: Container(
                decoration: BoxDecoration(
                  image: DecorationImage(
                    image: AssetImage(BankImages.bankCardBannerBg),
                    fit: BoxFit.cover,
                  ),
                ),
              ),
            ),
            // Content layer (search box and icons) stays in original position
            Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                SafeArea(
                  bottom: false,
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(8, 4, 8, 16),
                    child: Row(
                      children: [
                        Row(
                          children: [
                            const Icon(
                              Icons.location_on,
                              size: 20,
                              color: Colors.red,
                            ),
                            const SizedBox(width: 4),
                            const Text(
                              '北京',
                              style: TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.w500,
                                color: Colors.white,
                              ),
                            ),
                          ],
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
                            child: Row(
                              children: [
                                const Icon(Icons.search,
                                    size: 18, color: Colors.grey),
                                const SizedBox(width: 8),
                                const Text(
                                  '手机号收款超省心',
                                  style: TextStyle(
                                    fontSize: 14,
                                    color: Colors.grey,
                                  ),
                                ),
                                const Spacer(),
                                const Icon(Icons.mic,
                                    size: 18, color: Colors.grey),
                              ],
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
              ],
            ),
          ],
        ),
      ),
    );
  }
}
