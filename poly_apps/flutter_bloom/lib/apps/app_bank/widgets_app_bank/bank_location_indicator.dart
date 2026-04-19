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
import '../providers_app_bank/bank_user_provider.dart';
import '../helpers/bank_region_utils.dart';

class BankLocationIndicator extends StatelessWidget {
  final Color iconColor;
  final double iconSize;
  final TextStyle? textStyle;
  final double spacing;
  final String fallbackText;

  const BankLocationIndicator({
    super.key,
    this.iconColor = Colors.black87,
    this.iconSize = 18,
    this.textStyle,
    this.spacing = 4,
    this.fallbackText = '北京',
  });

  String _resolveDisplayText(BankUserProvider provider) {
    final location = provider.globalData?.location ?? provider.user?.location;
    final city = provider.globalData?.city ?? provider.user?.city;
    final cityText =
        (city != null && city.trim().isNotEmpty) ? city.trim() : null;
    final locationText = (location != null && location.trim().isNotEmpty)
        ? location.trim()
        : null;
    final raw = cityText ?? locationText ?? fallbackText;
    return BankRegionUtils.stripAdminSuffixForDisplay(raw);
  }

  @override
  Widget build(BuildContext context) {
    return Consumer<BankUserProvider>(
      builder: (context, provider, child) {
        final displayText = _resolveDisplayText(provider);
        return Row(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            Icon(Icons.location_on, size: iconSize, color: iconColor),
            SizedBox(width: spacing),
            Text(displayText, style: textStyle),
          ],
        );
      },
    );
  }
}
