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
import 'package:qyflutter/apps/app_bank/config_app_bank/constants.dart';
import 'package:flutter/services.dart';
import 'package:qyflutter/common/widgets/custom_app_bar.dart';
import 'package:qyflutter/common/localization/localization_manager.dart';
import '../config_app_bank/theme_config_app_bank.dart';
import '../localization_app_bank/localization_keys_app_bank.dart';

/// Bank App Bar - Specialized app bar for banking application
/// Inherits from common CustomAppBar with banking-specific styling and features
class BankAppBar extends StatelessWidget implements PreferredSizeWidget {
  final String title;
  final bool showBackButton;
  final Function()? onBackPressed;
  final List<Widget>? actions;
  final bool isTransparent;
  final bool showWelcomeMessage;
  final String? userName;

  const BankAppBar({
    super.key,
    required this.title,
    this.showBackButton = true,
    this.onBackPressed,
    this.actions,
    this.isTransparent = false,
    this.showWelcomeMessage = false,
    this.userName,
  });

  @override
  Widget build(BuildContext context) {
    if (showWelcomeMessage) {
      return _buildWelcomeAppBar(context);
    }

    return CustomAppBar(
      title: title,
      showBackButton: showBackButton,
      onBackPressed: onBackPressed,
      backgroundColor: isTransparent ? Colors.transparent : BankThemeConfig.primaryBlue,
      titleColor: BankThemeConfig.whiteText,
      iconColor: BankThemeConfig.whiteText,
      elevation: isTransparent ? 0 : 4,
      actions: actions,
      systemOverlayStyle: SystemUiOverlayStyle.light,
      centerTitle: true,
      titleWeight: FontWeight.w600,
    );
  }

  Widget _buildWelcomeAppBar(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        gradient: BankThemeConfig.primaryGradient,
      ),
      child: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              // User Avatar
              CircleAvatar(
                radius: 20,
                backgroundColor: BankThemeConfig.whiteText,
                child: const Icon(
                  Icons.person,
                  color: BankThemeConfig.primaryBlue,
                ),
              ),
              const SizedBox(width: 12),

              // Welcome Message
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      BankLocalizationKeys.bankWelcomeMessage.tr(context),
                      style: BankThemeConfig.getWhiteTextStyle().copyWith(
                        color: BankThemeConfig.whiteText.withOpacity(0.8),
                        fontSize: 14,
                      ),
                    ),
                    Text(
                      userName ?? 'John Doe',
                      style: BankThemeConfig.getWhiteTextStyle().copyWith(
                        fontWeight: FontWeight.w600,
                        fontSize: 16,
                      ),
                    ),
                  ],
                ),
              ),

              // Action Buttons
              if (actions != null) ...actions!,
            ],
          ),
        ),
      ),
    );
  }

  @override
  Size get preferredSize => const Size.fromHeight(kToolbarHeight);
}

/// Bank Gradient App Bar - App bar with full gradient background
class BankGradientAppBar extends StatelessWidget implements PreferredSizeWidget {
  final String title;
  final bool showBackButton;
  final Function()? onBackPressed;
  final List<Widget>? actions;
  final LinearGradient? gradient;

  const BankGradientAppBar({
    super.key,
    required this.title,
    this.showBackButton = true,
    this.onBackPressed,
    this.actions,
    this.gradient,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        gradient: gradient ?? BankThemeConfig.primaryGradient,
      ),
      child: AppBar(
        title: Text(
          title,
          style: BankThemeConfig.getWhiteTextStyle().copyWith(
            fontWeight: FontWeight.w600,
            fontSize: 18,
          ),
        ),
        backgroundColor: Colors.transparent,
        elevation: 0,
        centerTitle: true,
        leading: showBackButton
            ? IconButton(
                icon: const Icon(Icons.arrow_back),
                color: BankThemeConfig.whiteText,
                onPressed: onBackPressed ?? () => Navigator.of(context).pop(),
              )
            : null,
        actions: actions,
        systemOverlayStyle: SystemUiOverlayStyle.light,
      ),
    );
  }

  @override
  Size get preferredSize => const Size.fromHeight(kToolbarHeight);
}

/// Bank Card App Bar - App bar designed to look like the top of a credit card
class BankCardAppBar extends StatelessWidget implements PreferredSizeWidget {
  final String cardNumber;
  final String cardType;
  final bool showCardNumber;
  final VoidCallback? onToggleCardNumber;
  final List<Widget>? actions;

  const BankCardAppBar({
    super.key,
    required this.cardNumber,
    required this.cardType,
    this.showCardNumber = false,
    this.onToggleCardNumber,
    this.actions,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        gradient: BankThemeConfig.cardGradient,
        borderRadius: BorderRadius.only(
          bottomLeft: Radius.circular(BankConstants.borderRadius),
          bottomRight: Radius.circular(BankConstants.borderRadius),
        ),
      ),
      child: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            children: [
              // Card Header
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'Flutter Bank',
                    style: BankThemeConfig.getWhiteTextStyle().copyWith(
                      letterSpacing: 1.2,
                      color: BankThemeConfig.whiteText.withOpacity(0.8),
                    ),
                  ),
                  Text(
                    cardType.toUpperCase(),
                    style: BankThemeConfig.getWhiteTextStyle().copyWith(
                      fontSize: 12,
                      fontWeight: FontWeight.bold,
                      letterSpacing: 1.5,
                      color: BankThemeConfig.whiteText.withOpacity(0.8),
                    ),
                  ),
                ],
              ),

              const SizedBox(height: 16),

              // Card Number
              GestureDetector(
                onTap: onToggleCardNumber,
                child: Row(
                  children: [
                    Text(
                      showCardNumber
                          ? cardNumber
                          : '•••• •••• •••• ${cardNumber.substring(cardNumber.length - 4)}',
                      style: BankThemeConfig.getWhiteTextStyle().copyWith(
                        letterSpacing: 2.0,
                        fontWeight: FontWeight.w300,
                        fontSize: 18,
                      ),
                    ),
                    if (onToggleCardNumber != null) ...[
                      const SizedBox(width: 8),
                      Icon(
                        showCardNumber ? Icons.visibility : Icons.visibility_off,
                        color: BankThemeConfig.whiteText.withOpacity(0.7),
                        size: 20,
                      ),
                    ],
                  ],
                ),
              ),

              // Actions
              if (actions != null) ...[
                const SizedBox(height: 16),
                Row(
                  mainAxisAlignment: MainAxisAlignment.end,
                  children: actions!,
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  @override
  Size get preferredSize => const Size.fromHeight(120);
}

/// Bank Search App Bar - App bar with integrated search functionality
class BankSearchAppBar extends StatelessWidget implements PreferredSizeWidget {
  final String hintText;
  final Function(String)? onSearchChanged;
  final VoidCallback? onSearchSubmitted;
  final TextEditingController? searchController;
  final List<Widget>? actions;

  const BankSearchAppBar({
    super.key,
    required this.hintText,
    this.onSearchChanged,
    this.onSearchSubmitted,
    this.searchController,
    this.actions,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        gradient: BankThemeConfig.primaryGradient,
      ),
      child: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              Expanded(
                child: Container(
                  height: 48,
                  decoration: BoxDecoration(
                    color: Colors.white.withOpacity(0.2),
                    borderRadius: BorderRadius.circular(BankConstants.searchInputBorderRadius),
                  ),
                  child: TextField(
                    controller: searchController,
                    onChanged: onSearchChanged,
                    onSubmitted: (value) => onSearchSubmitted?.call(),
                    style: BankThemeConfig.getWhiteTextStyle(),
                    decoration: InputDecoration(
                      hintText: hintText,
                      hintStyle: BankThemeConfig.getWhiteTextStyle().copyWith(
                        color: BankThemeConfig.whiteText.withOpacity(0.7),
                      ),
                      prefixIcon: const Icon(
                        Icons.search,
                        color: Colors.white70,
                      ),
                      border: InputBorder.none,
                      contentPadding: const EdgeInsets.symmetric(
                        horizontal: 16,
                        vertical: 12,
                      ),
                    ),
                  ),
                ),
              ),
              if (actions != null) ...[
                const SizedBox(width: 12),
                ...actions!,
              ],
            ],
          ),
        ),
      ),
    );
  }

  @override
  Size get preferredSize => const Size.fromHeight(80);
}