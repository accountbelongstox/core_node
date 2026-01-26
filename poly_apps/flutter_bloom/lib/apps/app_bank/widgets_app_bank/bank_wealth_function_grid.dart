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
import 'bank_section_card.dart';
import 'bank_sprite_icon.dart';
import 'bank_loading_dialog.dart';

/// Configuration for a single wealth function icon
class WealthIconConfig {
  final String label;
  final String? spritePath;
  final String? imagePath;
  final double? x;
  final double? y;
  final double? width;
  final double? height;
  final double? iconWidth;
  final double? iconHeight;
  final double? scale;
  final VoidCallback? onTap;

  const WealthIconConfig({
    required this.label,
    this.spritePath,
    this.imagePath,
    this.x,
    this.y,
    this.width,
    this.height,
    this.iconWidth,
    this.iconHeight,
    this.scale,
    this.onTap,
  })  : assert(
          (spritePath != null &&
                  x != null &&
                  y != null &&
                  width != null &&
                  height != null) ||
              imagePath != null,
          'Either (spritePath with x, y, width, height) or imagePath must be provided',
        ),
        assert(
          imagePath == null ||
              (iconWidth != null && iconHeight != null) ||
              scale != null,
          'When using imagePath, either (iconWidth, iconHeight) or scale must be provided',
        );

  /// Get the display width for the icon (equal proportion scaling)
  double get displayWidth {
    if (iconWidth != null) {
      return iconWidth!;
    }
    if (scale != null && width != null) {
      return width! * scale!;
    }
    if (width != null) {
      return width!;
    }
    return 32.0; // Default size
  }

  /// Get the display height for the icon (equal proportion scaling)
  double get displayHeight {
    if (iconHeight != null) {
      return iconHeight!;
    }
    if (scale != null && height != null) {
      return height! * scale!;
    }
    if (height != null) {
      return height!;
    }
    return 32.0; // Default size
  }

  /// Check if using direct image path
  bool get isDirectImage => imagePath != null;
}

/// Wealth Function Grid Component
///
/// A reusable component for displaying wealth function icons in a grid layout.
/// Supports sprite sheet with individual icon positioning and scaling.
class BankWealthFunctionGrid extends StatelessWidget {
  final String? title;
  final String? moreText;
  final VoidCallback? onMoreTap;
  final List<WealthIconConfig> icons;
  final LinearGradient gradient;
  final int itemsPerRow;
  final EdgeInsets? margin;
  final EdgeInsets? padding;
  final double borderRadius;
  final double titleFontSize;
  final FontWeight titleFontWeight;
  final Color titleColor;
  final double iconContainerSize;
  final double iconContainerBorderRadius;
  final Color? iconContainerBackgroundColor;
  final List<BoxShadow>? iconContainerBoxShadow;
  final double labelFontSize;
  final Color labelColor;
  final double rowSpacing;
  final Border? border;
  final List<BoxShadow>? boxShadow;

  const BankWealthFunctionGrid({
    super.key,
    this.title,
    this.moreText,
    this.onMoreTap,
    required this.icons,
    required this.gradient,
    this.itemsPerRow = 5,
    this.margin,
    this.padding,
    this.borderRadius = BankConstants.borderRadius,
    this.titleFontSize = 18,
    this.titleFontWeight = FontWeight.w900,
    this.titleColor = Colors.black,
    this.iconContainerSize = 48,
    this.iconContainerBorderRadius = 0,
    this.iconContainerBackgroundColor,
    this.iconContainerBoxShadow,
    this.labelFontSize = 12,
    this.labelColor = Colors.black87,
    this.rowSpacing = 20,
    this.border,
    this.boxShadow,
  });

  @override
  Widget build(BuildContext context) {
    return BankSectionCard(
      title: title,
      moreText: moreText,
      onMoreTap: onMoreTap,
      gradient: gradient,
      margin: margin,
      padding: padding,
      borderRadius: borderRadius,
      titleFontSize: titleFontSize,
      titleFontWeight: titleFontWeight,
      titleColor: titleColor,
      border: border,
      boxShadow: boxShadow,
      children: _buildGridRows(context),
    );
  }

  List<Widget> _buildGridRows(BuildContext context) {
    final List<Widget> rows = [];

    for (int i = 0; i < icons.length; i += itemsPerRow) {
      final rowIcons = icons.skip(i).take(itemsPerRow).toList();

      if (rows.isNotEmpty) {
        rows.add(SizedBox(height: rowSpacing));
      }

      rows.add(
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceEvenly,
          children: rowIcons.map((icon) => _buildWealthIconItem(context, icon)).toList(),
        ),
      );
    }

    return rows;
  }

  Widget _buildWealthIconItem(BuildContext context, WealthIconConfig iconConfig) {
    final hasBackground = iconContainerBackgroundColor != null;
    final hasBorderRadius = iconContainerBorderRadius > 0;
    final hasBoxShadow =
        iconContainerBoxShadow != null && iconContainerBoxShadow!.isNotEmpty;

    final iconWidget = Column(
      children: [
        GestureDetector(
          onTap: iconConfig.onTap ?? () {
            BankLoadingDialog.show(context, title: iconConfig.label);
          },
          child: Container(
            width: iconContainerSize,
            height: iconContainerSize,
            decoration: (hasBackground || hasBorderRadius || hasBoxShadow)
                ? BoxDecoration(
                    color: iconContainerBackgroundColor,
                    borderRadius: hasBorderRadius
                        ? BorderRadius.circular(iconContainerBorderRadius)
                        : null,
                    boxShadow: iconContainerBoxShadow,
                  )
                : null,
            child: Center(
              child: iconConfig.isDirectImage
                  ? Image.asset(
                      iconConfig.imagePath!,
                      width: iconConfig.displayWidth,
                      height: iconConfig.displayHeight,
                      fit: BoxFit.contain,
                      errorBuilder: (context, error, stackTrace) {
                        return Container(
                          width: iconConfig.displayWidth,
                          height: iconConfig.displayHeight,
                          color: Colors.grey[200],
                          child: const Icon(Icons.image, color: Colors.grey),
                        );
                      },
                    )
                  : BankSpriteIcon(
                      spritePath: iconConfig.spritePath!,
                      x: iconConfig.x!,
                      y: iconConfig.y!,
                      width: iconConfig.width!,
                      height: iconConfig.height!,
                      iconWidth: iconConfig.displayWidth,
                      iconHeight: iconConfig.displayHeight,
                    ),
            ),
          ),
        ),
        const SizedBox(height: 8),
        Text(
          iconConfig.label,
          style: TextStyle(
            fontSize: labelFontSize,
            color: labelColor,
          ),
          textAlign: TextAlign.center,
        ),
      ],
    );

    return iconWidget;
  }
}
