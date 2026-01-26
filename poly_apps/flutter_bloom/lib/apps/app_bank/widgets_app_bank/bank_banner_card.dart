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
import 'bank_text_with_subtitle.dart';
import 'bank_gradient_card.dart';
import 'package:qyflutter/apps/app_bank/config_app_bank/constants.dart';

class BankBannerCard extends StatelessWidget {
  final String? title;
  final String? subtitle;
  final String? imagePath;
  final String? backgroundImagePath;
  final LinearGradient? gradient;
  final Color? textColor;
  final VoidCallback? onTap;
  final EdgeInsets? margin;

  const BankBannerCard({
    super.key,
    this.title,
    this.subtitle,
    this.imagePath,
    this.backgroundImagePath,
    this.gradient,
    this.textColor,
    this.onTap,
    this.margin,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: margin,
      child: BankGradientCard(
        gradient: gradient,
        backgroundImagePath: backgroundImagePath,
        backgroundImageFit: BoxFit.cover,
        padding: const EdgeInsets.all(20),
        borderRadius: BankConstants.borderRadius,
        onTap: onTap,
        child: Row(
          mainAxisAlignment: MainAxisAlignment.start,
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
                              fontSize: 22,
                              fontWeight: FontWeight.w800,
                              color: textColor,
                              shadows: [
                                Shadow(
                                  offset: const Offset(1, 1),
                                  blurRadius: 3,
                                  color: Colors.black.withOpacity(0.5),
                                ),
                                Shadow(
                                  offset: const Offset(0, 1),
                                  blurRadius: 2,
                                  color: Colors.black.withOpacity(0.3),
                                ),
                              ],
                            ),
                          ),
                          if (subtitle != null) ...[
                            const SizedBox(height: 4),
                            Text(
                              subtitle!,
                              style: TextStyle(
                                fontSize: 18,
                                fontWeight: FontWeight.w700,
                                color: textColor,
                                shadows: [
                                  Shadow(
                                    offset: const Offset(1, 1),
                                    blurRadius: 3,
                                    color: Colors.black.withOpacity(0.5),
                                  ),
                                  Shadow(
                                    offset: const Offset(0, 1),
                                    blurRadius: 2,
                                    color: Colors.black.withOpacity(0.3),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ],
                      )
                    : BankTextWithSubtitle(
                        title: title ?? '',
                        subtitle: subtitle ?? '',
                        titleFontSize: 18,
                        subtitleFontSize: 14,
                        titleFontWeight: FontWeight.w600,
                      ),
              ),
          ],
        ),
      ),
    );
  }
}
