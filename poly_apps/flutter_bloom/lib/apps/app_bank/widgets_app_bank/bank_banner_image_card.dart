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
import 'bank_image_widget.dart';
import 'bank_text_with_subtitle.dart';

class BankBannerImageCard extends StatelessWidget {
  final String imagePath;
  final String? backgroundImagePath;
  final String? title;
  final String? subtitle;
  final double height;
  final Color? textColor;
  final EdgeInsets? textPadding;
  final Alignment textAlignment;
  final VoidCallback? onTap;

  const BankBannerImageCard({
    super.key,
    required this.imagePath,
    this.backgroundImagePath,
    this.title,
    this.subtitle,
    this.height = 120,
    this.textColor,
    this.textPadding,
    this.textAlignment = Alignment.topLeft,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        height: height,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(BankConstants.borderRadius),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.05),
              spreadRadius: 0,
              blurRadius: 8,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(BankConstants.borderRadius),
          child: Stack(
            children: [
              if (backgroundImagePath != null)
                BankImageWidget(
                  imagePath: backgroundImagePath!,
                  fit: BoxFit.cover,
                )
              else
                BankImageWidget(
                  imagePath: imagePath,
                  fit: BoxFit.cover,
                ),
              if (title != null || subtitle != null)
                Positioned(
                  left: textAlignment == Alignment.topLeft ? 16 : null,
                  right: textAlignment == Alignment.topRight ? 16 : null,
                  top: 8,
                  child: textColor != null
                      ? Column(
                          crossAxisAlignment: textAlignment == Alignment.topLeft
                              ? CrossAxisAlignment.start
                              : CrossAxisAlignment.end,
                          children: [
                            Text(
                              title ?? '',
                              style: TextStyle(
                                fontSize: 16,
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
                      : BankTextWithSubtitle(
                          title: title ?? '',
                          subtitle: subtitle ?? '',
                          titleFontSize: 16,
                          subtitleFontSize: 14,
                          titleFontWeight: FontWeight.w600,
                        ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
