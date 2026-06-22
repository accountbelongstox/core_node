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
import 'package:qyflutter/apps/app_bank/config_app_bank/constants.dart';
import 'bank_text_with_subtitle.dart';
import 'bank_image_widget.dart';

class BankActivityCard extends StatelessWidget {
  final String title;
  final String subtitle;
  final String? imagePath;
  final LinearGradient? iconGradient;
  final VoidCallback? onTap;

  const BankActivityCard({
    super.key,
    required this.title,
    required this.subtitle,
    this.imagePath,
    this.iconGradient,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: const Color(0xFFF0F0F0)),
        borderRadius: BorderRadius.circular(BankConstants.borderRadius),
      ),
      child: Row(
        children: [
          Container(
            width: 60,
            height: 60,
            decoration: BoxDecoration(
              gradient: iconGradient ??
                  const LinearGradient(
                    colors: [Color(0xFFFF9A9E), Color(0xFFFECFEF)],
                  ),
              borderRadius: BorderRadius.circular(BankConstants.borderRadius),
            ),
            child: Center(
              child: imagePath != null
                  ? BankImageWidget(
                      imagePath: imagePath!,
                      width: 24,
                      height: 24,
                    )
                  : const Text('🎊', style: TextStyle(fontSize: 24)),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: BankTextWithSubtitle(
              title: title,
              subtitle: subtitle,
              titleFontSize: 16,
              subtitleFontSize: 14,
              titleFontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }
}
