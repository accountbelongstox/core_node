// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

import 'package:flutter/material.dart';

class CustomImageIconLabel extends StatelessWidget {
  final String imagePath;
  final String label;
  final VoidCallback? onTap;
  final Color? backgroundColor;
  final Color? imageColor;
  final Color? labelColor;
  final double? imageSize;
  final double? labelSize;
  final double? spacing;
  final BorderRadius? borderRadius;
  final Border? border;
  final EdgeInsets? padding;
  final EdgeInsets? margin;
  final bool showBackground;
  final bool showBorder;
  final Widget? badge;
  final FontWeight? labelFontWeight;
  final int? maxLines;
  final TextOverflow? overflow;

  const CustomImageIconLabel({
    super.key,
    required this.imagePath,
    required this.label,
    this.onTap,
    this.backgroundColor,
    this.imageColor,
    this.labelColor,
    this.imageSize = 32.0,
    this.labelSize = 12.0,
    this.spacing = 4.0,
    this.borderRadius,
    this.border,
    this.padding,
    this.margin,
    this.showBackground = false,
    this.showBorder = false,
    this.badge,
    this.labelFontWeight,
    this.maxLines = 1,
    this.overflow = TextOverflow.ellipsis,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    Widget imageWidget = SizedBox(
      width: imageSize,
      height: imageSize,
      child: imageColor != null
          ? Image(
              image: AssetImage(imagePath),
              width: imageSize,
              height: imageSize,
              fit: BoxFit.contain,
              color: imageColor,
            )
          : Image(
              image: AssetImage(imagePath),
              width: imageSize,
              height: imageSize,
              fit: BoxFit.contain,
            ),
    );

    // Add background container if needed
    if (showBackground || showBorder) {
      imageWidget = Container(
        width: imageSize! + (padding?.horizontal ?? 0),
        height: imageSize! + (padding?.vertical ?? 0),
        padding: padding,
        decoration: BoxDecoration(
          color: showBackground ? (backgroundColor ?? theme.colorScheme.surface.withOpacity(0.1)) : null,
          borderRadius: borderRadius,
          border: showBorder ? (border ?? Border.all(color: theme.colorScheme.outline.withOpacity(0.2))) : null,
        ),
        child: Center(child: imageWidget),
      );
    }

    // Add badge if provided
    if (badge != null) {
      imageWidget = Stack(
        children: [
          imageWidget,
          Positioned(
            top: -2,
            right: -2,
            child: badge!,
          ),
        ],
      );
    }

    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: margin,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          mainAxisAlignment: MainAxisAlignment.center,
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            imageWidget,
            SizedBox(height: spacing),
            Text(
              label,
              style: theme.textTheme.bodySmall?.copyWith(
                color: labelColor ?? theme.colorScheme.onSurface,
                fontSize: labelSize,
                fontWeight: labelFontWeight,
              ),
              maxLines: maxLines,
              overflow: overflow,
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}
