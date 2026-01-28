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
import 'dart:ui';
import '../../../resources_app_bank/assets_images_app_bank.dart';
import '../../../widgets_app_bank/bank_loading_dialog.dart';

/// Custom Clipper for slanted left edge tab effect
/// Creates a tab with a diagonal left edge (slanted edge)
class SlantedTabClipper extends CustomClipper<Path> {
  @override
  Path getClip(Size size) {
    final path = Path();
    final radius = 8.0;
    final slantWidth = size.height * 0.4; // Width of the slanted edge

    // Start from top-left (after slant)
    path.moveTo(slantWidth, 0);

    // Top-right corner (rounded)
    path.lineTo(size.width - radius, 0);
    path.quadraticBezierTo(size.width, 0, size.width, radius);

    // Right side
    path.lineTo(size.width, size.height - radius);

    // Bottom-right corner (rounded)
    path.quadraticBezierTo(
      size.width,
      size.height,
      size.width - radius,
      size.height,
    );

    // Bottom side
    path.lineTo(slantWidth, size.height);

    // Bottom-left slanted edge (diagonal from bottom to top-left)
    path.lineTo(0, size.height * 0.6);

    // Top-left slanted edge (diagonal from top-left to top)
    path.lineTo(0, size.height * 0.4);
    path.lineTo(slantWidth, 0);

    path.close();
    return path;
  }

  @override
  bool shouldReclip(CustomClipper<Path> oldClipper) => false;
}

/// Housing Section Component
///
/// Displays a housing section with:
/// - Service tabs (购房服务, 租房服务)
/// - Service cards (房贷预审, 我的贷款)
/// - Horizontal links (住房公积金, 还款计划, 建行找房)
class HousingSection extends StatefulWidget {
  const HousingSection({super.key});

  @override
  State<HousingSection> createState() => _HousingSectionState();
}

class _HousingSectionState extends State<HousingSection> {
  int _selectedTabIndex = 1; // 0: 购房服务, 1: 租房服务

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      decoration: BankConstants.getDashboardCardDecoration(),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(BankConstants.borderRadius),
        child: Stack(
          children: [
            Positioned.fill(
              child: Image.asset(
                BankImages.housingCardBg,
                fit: BoxFit.cover,
                alignment: Alignment.topRight,
              ),
            ),
            Container(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                      // Header with title and "更多" (More)
                      Row(
                        children: [
                          const Text(
                            '住房',
                            style: TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.w900, // Extra bold
                              color: Colors.black87,
                            ),
                          ),
                          const Spacer(),
                          GestureDetector(
                            onTap: () {
                              BankLoadingDialog.show(context, title: '更多');
                            },
                            child: const Text(
                              '更多',
                              style: TextStyle(
                                fontSize: 14,
                                color: Colors.grey,
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 16),
                      // Service tabs
                      ClipRRect(
                        borderRadius: const BorderRadius.only(
                          topLeft: Radius.circular(BankConstants.borderRadius),
                          topRight: Radius.circular(BankConstants.borderRadius),
                        ),
                        child: SizedBox(
                          height: 40,
                          child: Stack(
                            children: [
                              Positioned.fill(
                                child: Image.asset(
                                  BankImages.housingTabBg,
                                  fit: BoxFit.fitHeight,
                                  alignment: Alignment.center,
                                ),
                              ),
                              Row(
                                children: [
                                  Expanded(
                                    child: GestureDetector(
                                      onTap: () {
                                        setState(() {
                                          _selectedTabIndex = 0;
                                        });
                                      },
                                      child: Center(
                                        child: Text(
                                          '购房服务',
                                          style: TextStyle(
                                            fontSize: 19.6,
                                            fontWeight: FontWeight.bold,
                                            color: const Color(0xFF4A90E2),
                                          ),
                                        ),
                                      ),
                                    ),
                                  ),
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: GestureDetector(
                                      onTap: () {
                                        setState(() {
                                          _selectedTabIndex = 1;
                                        });
                                      },
                                      child: Center(
                                        child: Text(
                                          '租房服务',
                                          style: TextStyle(
                                            fontSize: 19.6,
                                            fontWeight: FontWeight.bold,
                                            color: Colors.white,
                                          ),
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
                  const SizedBox(height: 16),
                  // Service cards row
                  Row(
                    children: [
                      Expanded(
                        child: _buildServiceCard(
                          context,
                          imagePath: BankImages.bankIconMortgagePreapproval,
                          title: '房贷预审',
                          subtitle: '自助申请贷款',
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: _buildServiceCard(
                          context,
                          imagePath: BankImages.bankIconMyLoans,
                          title: '我的贷款',
                          subtitle: '贷款信息 一键查询',
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  // Horizontal links row
                  Container(
                    padding: const EdgeInsets.symmetric(
                        vertical: 12, horizontal: 16),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF9FDFD),
                      borderRadius:
                          BorderRadius.circular(BankConstants.borderRadius),
                      border: Border.all(
                        color: Colors.white.withOpacity(0.8),
                        width: 1.5,
                      ),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.white.withOpacity(0.9),
                          spreadRadius: 2.0,
                          blurRadius: 12.0,
                          offset: const Offset(0, 0),
                        ),
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
                    ),
                    child: Row(
                      children: [
                        Expanded(
                          child: _buildHorizontalLink(context, '住房公积金'),
                        ),
                        Container(
                          width: 1,
                          height: 16,
                          color: Colors.grey[300],
                        ),
                        Expanded(
                          child: _buildHorizontalLink(context, '还款计划'),
                        ),
                        Container(
                          width: 1,
                          height: 16,
                          color: Colors.grey[300],
                        ),
                        Expanded(
                          child: _buildHorizontalLink(context, '建行找房'),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildServiceCard(
    BuildContext context, {
    required String imagePath,
    required String title,
    required String subtitle,
  }) {
    return GestureDetector(
      onTap: () {
        BankLoadingDialog.show(context, title: title);
      },
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: const Color(0xFFF9FDFD),
          borderRadius: BorderRadius.circular(BankConstants.borderRadius),
          border: Border.all(
            color: Colors.white.withOpacity(0.8),
            width: 1.5,
          ),
          boxShadow: [
            BoxShadow(
              color: Colors.white.withOpacity(0.9),
              spreadRadius: 2.0,
              blurRadius: 12.0,
              offset: const Offset(0, 0),
            ),
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
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            // First row: Icon and title
            Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                Image.asset(
                  imagePath,
                  width: 19.2, // 16 * 1.2 = 19.2 (20% larger)
                  height: 19.2, // 16 * 1.2 = 19.2 (20% larger)
                  fit: BoxFit.contain,
                ),
                const SizedBox(width: 8), // Reduced spacing
                Expanded(
                  child: Text(
                    title,
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                      color: Colors.black87,
                    ),
                  ),
                ),
              ],
            ),
            // Second row: Subtitle (aligned with icon start)
            const SizedBox(height: 6),
            Text(
              subtitle,
              style: const TextStyle(
                fontSize: 12,
                color: Colors.grey,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildHorizontalLink(BuildContext context, String text) {
    return GestureDetector(
      onTap: () {
        BankLoadingDialog.show(context, title: text);
      },
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            text,
            style: const TextStyle(
              fontSize: 12,
              color: Colors.black87,
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
          const SizedBox(width: 6),
          Image.asset(
            BankImages.bankIconArrow,
            width: 16,
            height: 16,
            fit: BoxFit.contain,
          ),
        ],
      ),
    );
  }
}
