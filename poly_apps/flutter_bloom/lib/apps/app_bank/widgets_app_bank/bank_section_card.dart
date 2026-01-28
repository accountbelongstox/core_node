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
import '../config_app_bank/constants.dart';

class BankSectionCard extends StatelessWidget {
  final String? title;
  final String? titleImagePath;
  final double? titleImageHeight;
  final double? titleImageWidth;
  final BoxFit titleImageFit;
  final String? moreText;
  final VoidCallback? onMoreTap;
  final List<Widget> children;
  final LinearGradient? gradient;
  final String? backgroundImagePath;
  final BoxFit backgroundImageFit;
  final EdgeInsets? margin;
  final EdgeInsets? padding;
  final double borderRadius;
  final double titleFontSize;
  final FontWeight titleFontWeight;
  final Color titleColor;
  final double titleBottomPadding;
  final Border? border;
  final List<BoxShadow>? boxShadow;

  const BankSectionCard({
    super.key,
    this.title,
    this.titleImagePath,
    this.titleImageHeight,
    this.titleImageWidth,
    this.titleImageFit = BoxFit.contain,
    this.moreText,
    this.onMoreTap,
    required this.children,
    this.gradient,
    this.backgroundImagePath,
    this.backgroundImageFit = BoxFit.cover,
    this.margin,
    this.padding,
    this.borderRadius = BankConstants.borderRadius,
    this.titleFontSize = 18,
    this.titleFontWeight = FontWeight.w900,
    this.titleColor = Colors.black,
    this.titleBottomPadding = 4,
    this.border,
    this.boxShadow,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: margin ?? const EdgeInsets.all(16),
      padding: padding ?? const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: gradient,
        image: backgroundImagePath != null
            ? DecorationImage(
                image: AssetImage(backgroundImagePath!),
                fit: backgroundImageFit,
              )
            : null,
        borderRadius: BorderRadius.circular(borderRadius),
        border: border ??
            Border.all(
              color: Colors.white.withOpacity(0.8),
              width: 1.5,
            ),
        boxShadow: boxShadow ??
            [
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
          if (title != null || titleImagePath != null || moreText != null)
            Padding(
              padding: EdgeInsets.only(left: 4, bottom: titleBottomPadding),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  if (titleImagePath != null)
                    Image.asset(
                      titleImagePath!,
                      height: titleImageHeight,
                      width: titleImageWidth,
                      fit: titleImageFit,
                    )
                  else if (title != null)
                    Text(
                      title!,
                      style: TextStyle(
                        fontSize: titleFontSize,
                        fontWeight: titleFontWeight,
                        color: titleColor,
                      ),
                    ),
                  if (moreText != null)
                    GestureDetector(
                      onTap: onMoreTap,
                      child: Text(
                        moreText!,
                        style: const TextStyle(
                          fontSize: 14,
                          color: Colors.grey,
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ...children,
        ],
      ),
    );
  }
}
