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
import 'text_with_subtitle.dart';
import 'bank_image_widget.dart';
import 'gradient_card.dart';

class BannerCard extends StatelessWidget {
  final String? title;
  final String? subtitle;
  final String? imagePath;
  final LinearGradient? gradient;
  final Color? textColor;
  final VoidCallback? onTap;

  const BannerCard({
    super.key,
    this.title,
    this.subtitle,
    this.imagePath,
    this.gradient,
    this.textColor,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GradientCard(
      gradient: gradient,
      padding: const EdgeInsets.all(20),
      borderRadius: BankConstants.borderRadius,
      onTap: onTap,
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          if (title != null || subtitle != null)
            Expanded(
              child: textColor != null
                  ? Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          title ?? '',
                          style: TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.w600,
                            color: textColor,
                          ),
                        ),
                        if (subtitle != null) ...[
                          const SizedBox(height: 4),
                          Text(
                            subtitle!,
                            style: TextStyle(
                              fontSize: 14,
                              color: textColor,
                            ),
                          ),
                        ],
                      ],
                    )
                  : TextWithSubtitle(
                      title: title ?? '',
                      subtitle: subtitle ?? '',
                      titleFontSize: 18,
                      subtitleFontSize: 14,
                      titleFontWeight: FontWeight.w600,
                    ),
            ),
          if (imagePath != null) ...[
            const SizedBox(width: 16),
            Container(
              width: 80,
              height: 60,
              decoration: BoxDecoration(
                color: Colors.white.withOpacity(0.3),
                borderRadius: BorderRadius.circular(BankConstants.borderRadius),
              ),
              child: Center(
                child: BankImageWidget(
                  imagePath: imagePath!,
                  width: 32,
                  height: 32,
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
