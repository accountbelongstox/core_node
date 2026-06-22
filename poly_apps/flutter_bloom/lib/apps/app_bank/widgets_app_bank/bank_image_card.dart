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
import 'bank_simple_card.dart';
import 'bank_image_widget.dart';
import 'bank_text_with_subtitle.dart';
import 'package:qyflutter/apps/app_bank/config_app_bank/constants.dart';

enum BankImageCardLayoutDirection { horizontal, vertical }

class BankImageCard extends StatelessWidget {
  final String imagePath;
  final String title;
  final String? subtitle;
  final double? imageWidth;
  final double? imageHeight;
  final BoxFit imageFit;
  final BankImageCardLayoutDirection layoutDirection;
  final EdgeInsets? padding;
  final Color? backgroundColor;
  final VoidCallback? onTap;
  final Border? border;

  const BankImageCard({
    super.key,
    required this.imagePath,
    required this.title,
    this.subtitle,
    this.imageWidth,
    this.imageHeight,
    this.imageFit = BoxFit.contain,
    this.layoutDirection = BankImageCardLayoutDirection.vertical,
    this.padding,
    this.backgroundColor,
    this.onTap,
    this.border,
  });

  @override
  Widget build(BuildContext context) {
    Widget imageWidget = BankImageWidget(
      imagePath: imagePath,
      width: imageWidth,
      height: imageHeight,
      fit: imageFit,
    );

    Widget textContent = BankTextWithSubtitle(
      title: title,
      subtitle: subtitle ?? '',
      titleFontSize:
          layoutDirection == BankImageCardLayoutDirection.horizontal ? 12 : 12,
      subtitleFontSize:
          layoutDirection == BankImageCardLayoutDirection.horizontal ? 9 : 10,
      titleFontWeight: FontWeight.w600,
      crossAxisAlignment:
          layoutDirection == BankImageCardLayoutDirection.horizontal
              ? CrossAxisAlignment.start
              : CrossAxisAlignment.center,
      maxLines: 1,
      overflow: TextOverflow.ellipsis,
    );

    return layoutDirection == BankImageCardLayoutDirection.horizontal
        ? LayoutBuilder(
            builder: (context, constraints) {
              final containerHeight = constraints.maxHeight.isFinite && constraints.maxHeight > 0 
                  ? constraints.maxHeight 
                  : 100.0;
              final iconSizeRatio = 0.72;
              final iconSize = containerHeight * iconSizeRatio;
              final effectivePadding = padding ?? const EdgeInsets.all(12);
              final paddingRightOffset = 8.0;
              final paddingBottomOffset = 8.0;
              final paddingRight = iconSize + paddingRightOffset;
              final paddingBottom = iconSize + paddingBottomOffset;
              
              return Container(
                margin: const EdgeInsets.all(0),
                decoration: BoxDecoration(
                  color: backgroundColor ?? Colors.white,
                  borderRadius: BorderRadius.circular(BankConstants.borderRadius),
                  border: border,
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withOpacity(0.05),
                      spreadRadius: 0,
                      blurRadius: 8,
                      offset: const Offset(0, 2),
                    ),
                  ],
                ),
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    Positioned(
                      right: 0,
                      bottom: 0,
                      child: SizedBox(
                        width: iconSize,
                        height: iconSize,
                        child: Image.asset(
                          imagePath,
                          fit: BoxFit.contain,
                        ),
                      ),
                    ),
                    Positioned(
                      left: effectivePadding.left,
                      top: effectivePadding.top,
                      right: paddingRight,
                      child: Material(
                        color: Colors.transparent,
                        child: InkWell(
                          onTap: onTap,
                          borderRadius: BorderRadius.circular(BankConstants.borderRadius),
                          child: Align(
                            alignment: Alignment.topLeft,
                            child: textContent,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              );
            },
          )
        : BankSimpleCard(
            padding: padding,
            backgroundColor: backgroundColor,
            onTap: onTap,
            border: border,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.center,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                if (imageWidth != null && imageHeight != null)
                  SizedBox(
                    width: imageWidth,
                    height: imageHeight,
                    child: Center(child: imageWidget),
                  )
                else if (imageWidth != null || imageHeight != null)
                  Center(child: imageWidget)
                else
                  ConstrainedBox(
                    constraints: const BoxConstraints(
                      maxHeight: 100,
                    ),
                    child: Center(child: imageWidget),
                  ),
                const SizedBox(height: 4),
                ConstrainedBox(
                  constraints: const BoxConstraints(
                    maxHeight: 40,
                    minHeight: 0,
                  ),
                  child: textContent,
                ),
              ],
            ),
          );
  }
}
