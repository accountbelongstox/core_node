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
import 'package:qyflutter/common/widgets/custom_button.dart';
import 'package:qyflutter/common/localization/localization_manager.dart';
import '../config_app_bank/theme_config_app_bank.dart';
import '../localization_app_bank/localization_keys_app_bank.dart';

/// Bank Custom Button - Extends common CustomButton with banking-specific styling
/// Inherits all functionality from common CustomButton while applying bank theme
class BankCustomButton extends StatelessWidget {
  final Function()? onPressed;
  final String buttonText;
  final BankButtonType type;
  final BankButtonSize size;
  final bool isLoading;
  final IconData? icon;
  final bool disabled;

  const BankCustomButton({
    super.key,
    this.onPressed,
    required this.buttonText,
    this.type = BankButtonType.primary,
    this.size = BankButtonSize.medium,
    this.isLoading = false,
    this.icon,
    this.disabled = false,
  });

  @override
  Widget build(BuildContext context) {
    final buttonConfig = _getButtonConfig(type);
    final sizeConfig = _getSizeConfig(size);

    return Stack(
      children: [
        CustomButton(
          onPressed: disabled || isLoading ? null : onPressed,
          buttonText: isLoading ? BankLocalizationKeys.bankLoading.tr(context) : buttonText,
          backgroundColor: buttonConfig.backgroundColor,
          textColor: buttonConfig.textColor,
          borderColor: buttonConfig.borderColor,
          showBorder: buttonConfig.showBorder,
          height: sizeConfig.height,
          width: sizeConfig.width,
          fontSize: sizeConfig.fontSize,
          radius: BankThemeConfig.buttonRadius,
          icon: isLoading ? null : icon,
          isLoading: isLoading,
          margin: EdgeInsets.zero,
        ),
        if (isLoading)
          Positioned.fill(
            child: Container(
              decoration: BoxDecoration(
                color: buttonConfig.backgroundColor.withOpacity(0.7),
                borderRadius: BorderRadius.circular(BankThemeConfig.buttonRadius),
              ),
              child: Center(
                child: SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    valueColor: AlwaysStoppedAnimation<Color>(buttonConfig.textColor),
                  ),
                ),
              ),
            ),
          ),
      ],
    );
  }

  _ButtonConfig _getButtonConfig(BankButtonType type) {
    switch (type) {
      case BankButtonType.primary:
        return _ButtonConfig(
          backgroundColor: BankThemeConfig.primaryBlue,
          textColor: BankThemeConfig.whiteText,
          showBorder: false,
        );
      case BankButtonType.secondary:
        return _ButtonConfig(
          backgroundColor: BankThemeConfig.cardBackground,
          textColor: BankThemeConfig.primaryBlue,
          borderColor: BankThemeConfig.primaryBlue,
          showBorder: true,
        );
      case BankButtonType.transfer:
        return _ButtonConfig(
          backgroundColor: BankThemeConfig.transferColor,
          textColor: BankThemeConfig.whiteText,
          showBorder: false,
        );
      case BankButtonType.payment:
        return _ButtonConfig(
          backgroundColor: BankThemeConfig.paymentColor,
          textColor: BankThemeConfig.whiteText,
          showBorder: false,
        );
      case BankButtonType.danger:
        return _ButtonConfig(
          backgroundColor: BankThemeConfig.errorColor,
          textColor: BankThemeConfig.whiteText,
          showBorder: false,
        );
      case BankButtonType.ghost:
        return _ButtonConfig(
          backgroundColor: Colors.transparent,
          textColor: BankThemeConfig.primaryBlue,
          showBorder: false,
        );
    }
  }

  _SizeConfig _getSizeConfig(BankButtonSize size) {
    switch (size) {
      case BankButtonSize.small:
        return _SizeConfig(
          height: 36,
          width: double.infinity,
          fontSize: 14,
        );
      case BankButtonSize.medium:
        return _SizeConfig(
          height: 48,
          width: double.infinity,
          fontSize: 16,
        );
      case BankButtonSize.large:
        return _SizeConfig(
          height: 56,
          width: double.infinity,
          fontSize: 18,
        );
    }
  }
}

/// Banking-specific button types
enum BankButtonType {
  primary,    // Main blue button for primary actions
  secondary,  // White button with blue border for secondary actions
  transfer,   // Green button for transfer actions
  payment,    // Blue button for payment actions
  danger,     // Red button for destructive actions
  ghost,      // Transparent button for minimal actions
}

/// Banking-specific button sizes
enum BankButtonSize {
  small,   // Compact button for inline actions
  medium,  // Standard button for most actions
  large,   // Prominent button for main actions
}

class _ButtonConfig {
  final Color backgroundColor;
  final Color textColor;
  final Color? borderColor;
  final bool showBorder;

  _ButtonConfig({
    required this.backgroundColor,
    required this.textColor,
    this.borderColor,
    this.showBorder = false,
  });
}

class _SizeConfig {
  final double height;
  final double width;
  final double fontSize;

  _SizeConfig({
    required this.height,
    required this.width,
    required this.fontSize,
  });
}

/// Quick Action Button - Specialized button for dashboard quick actions
class BankQuickActionButton extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final Color? color;
  final int? index;

  const BankQuickActionButton({
    super.key,
    required this.icon,
    required this.label,
    required this.onTap,
    this.color,
    this.index,
  });

  @override
  Widget build(BuildContext context) {
    final buttonColor = color ?? (index != null
        ? BankThemeConfig.getQuickActionColor(index!)
        : BankThemeConfig.primaryBlue);

    return GestureDetector(
      onTap: onTap,
      child: Container(
        decoration: BoxDecoration(
          color: buttonColor.withOpacity(0.1),
          borderRadius: BorderRadius.circular(BankThemeConfig.buttonRadius),
          border: Border.all(
            color: buttonColor.withOpacity(0.2),
            width: 1,
          ),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              icon,
              size: 28,
              color: buttonColor,
            ),
            const SizedBox(height: 8),
            Text(
              label,
              style: BankThemeConfig.getSecondaryTextStyle().copyWith(
                fontWeight: FontWeight.w500,
                fontSize: 12,
              ),
              textAlign: TextAlign.center,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
      ),
    );
  }
}

/// Balance Toggle Button - Specialized button for balance visibility
class BankBalanceToggleButton extends StatelessWidget {
  final bool isVisible;
  final VoidCallback onToggle;

  const BankBalanceToggleButton({
    super.key,
    required this.isVisible,
    required this.onToggle,
  });

  @override
  Widget build(BuildContext context) {
    return IconButton(
      icon: Icon(
        isVisible ? Icons.visibility : Icons.visibility_off,
        color: BankThemeConfig.balanceVisibleIcon,
        size: 20,
      ),
      onPressed: onToggle,
    );
  }
}