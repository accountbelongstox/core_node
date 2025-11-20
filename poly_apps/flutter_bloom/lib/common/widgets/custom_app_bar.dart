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
import 'package:flutter/services.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/common/assets/common_assets_icons.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:qyflutter/common/theme/base/theme_colors.dart';
import 'package:qyflutter/common/localization/localization_manager.dart';
import 'package:go_router/go_router.dart';

// AI: Claude Code - Enhanced common app bar based on better implementations from app_achat
// Reason: Combines best features from BackAppBar (better styling, customization) and ChatListAppBar (action buttons support)
// Maintains backward compatibility while adding system overlay style, better customization, and action button support
class CustomAppBar extends StatelessWidget implements PreferredSizeWidget {
  final String title;
  final bool showBackButton;
  final Function()? onBackPressed;
  final Function()? onTap;
  final bool regularAppbar;
  
  // Enhanced properties from better implementations
  final Color? backgroundColor;
  final Color? titleColor;
  final Color? iconColor;
  final double? elevation;
  final double? iconSize;
  final double? titleSize;
  final FontWeight? titleWeight;
  final List<Widget>? actions;
  final SystemUiOverlayStyle? systemOverlayStyle;
  final Widget? leadingWidget;
  final bool automaticallyImplyLeading;
  final bool centerTitle;

  const CustomAppBar({
    super.key,
    required this.title,
    this.showBackButton = true,
    this.onBackPressed,
    this.onTap,
    this.regularAppbar = false,
    // Enhanced properties
    this.backgroundColor,
    this.titleColor,
    this.iconColor,
    this.elevation,
    this.iconSize,
    this.titleSize,
    this.titleWeight,
    this.actions,
    this.systemOverlayStyle,
    this.leadingWidget,
    this.automaticallyImplyLeading = true,
    this.centerTitle = true,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final defaultBackgroundColor = backgroundColor ?? theme.primaryColor;
    final defaultTitleColor = titleColor ?? Colors.white;
    final defaultIconColor = iconColor ?? Colors.white;
    final defaultElevation = elevation ?? 0.0;

    return Container(
      height: regularAppbar
          ? 100
          : 120,
      color: defaultBackgroundColor,
      child: AppBar(
        systemOverlayStyle: systemOverlayStyle ?? SystemUiOverlayStyle.dark,
        forceMaterialTransparency: false,
        backgroundColor: defaultBackgroundColor,
        elevation: defaultElevation,
        centerTitle: centerTitle,
        automaticallyImplyLeading: automaticallyImplyLeading,
        title: Text(
          title.tr(context),
          style: ThemeTextStyles.textSemiBold.copyWith(
            fontSize: titleSize ?? ThemeDimensions.fontSizeExtraLarge,
            color: defaultTitleColor,
            fontWeight: titleWeight ?? FontWeight.w600,
          ),
        ),
        leading: leadingWidget ?? _buildLeading(context, defaultIconColor),
        actions: actions,
      ),
    );
  }

  Widget? _buildLeading(BuildContext context, Color iconColor) {
    if (!showBackButton && onTap == null) return null;
    
    if (showBackButton) {
      return IconButton(
        icon: Icon(
          Icons.arrow_back_ios_new,
          color: iconColor,
          size: iconSize ?? ThemeDimensions.iconSizeMedium,
        ),
        onPressed: () => onBackPressed != null ? onBackPressed!() : context.pop(),
      );
    } else {
      return SizedBox(
        width: ThemeDimensions.iconSizeMedium,
        child: InkWell(
          highlightColor: ThemeColors.transparent,
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.all(ThemeDimensions.paddingSizeDefault),
            child: Image.asset(
              CommonAssetsIcons.menu,
              color: iconColor,
              width: iconSize ?? ThemeDimensions.iconSizeMedium,
            ),
          ),
        ),
      );
    }
  }

  @override
  Size get preferredSize => const Size.fromHeight(kToolbarHeight);
}
