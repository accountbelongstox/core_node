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
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/common/localization/localization_manager.dart';
import '../config_app_bank/theme_config_app_bank.dart';
import '../config_app_bank/bank_text_styles.dart';
import '../localization_app_bank/localization_keys_app_bank.dart';

/// Base Bank Card - Common card wrapper with banking theme
/// Provides consistent styling for all bank cards
class BankBaseCard extends StatelessWidget {
  final Widget child;
  final EdgeInsets? margin;
  final EdgeInsets? padding;
  final double? elevation;
  final Color? backgroundColor;
  final Decoration? decoration;
  final VoidCallback? onTap;
  final double? borderRadius;

  const BankBaseCard({
    super.key,
    required this.child,
    this.margin,
    this.padding,
    this.elevation,
    this.backgroundColor,
    this.decoration,
    this.onTap,
    this.borderRadius,
  });

  @override
  Widget build(BuildContext context) {
    Widget cardContent = Container(
      decoration: decoration ?? BankThemeConfig.getCardDecoration(),
      child: Material(
        color: backgroundColor ?? BankThemeConfig.cardBackground,
        borderRadius: BorderRadius.circular(borderRadius ?? BankThemeConfig.cardRadius),
        elevation: elevation ?? 4,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(borderRadius ?? BankThemeConfig.cardRadius),
          child: Container(
            padding: padding ?? const EdgeInsets.all(BankThemeConfig.cardPadding),
            child: child,
          ),
        ),
      ),
    );

    if (margin != null) {
      cardContent = Container(
        margin: margin,
        child: cardContent,
      );
    }

    return cardContent;
  }
}

/// Bank Balance Card - Main balance display card with banking-specific design
/// Inherits design principles from common card system but optimized for banking
class BankBalanceCard extends StatelessWidget {
  final double totalBalance;
  final double checkingBalance;
  final double savingsBalance;
  final bool isBalanceVisible;
  final VoidCallback onToggleVisibility;

  const BankBalanceCard({
    super.key,
    required this.totalBalance,
    required this.checkingBalance,
    required this.savingsBalance,
    required this.isBalanceVisible,
    required this.onToggleVisibility,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.all(ThemeDimensions.paddingMedium),
      height: 200, // Maintain original card height
      decoration: const BoxDecoration(
        color: Colors.transparent, // Completely transparent
      ),
      child: const SizedBox.shrink(), // No content at all
    );
  }

  Widget _buildHeader(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          BankLocalizationKeys.bankTotalBalance.tr(context),
          style: BankThemeConfig.getWhiteTextStyle().copyWith(
            color: BankThemeConfig.whiteText.withOpacity(0.8),
          ),
        ),
        IconButton(
          icon: Icon(
            isBalanceVisible ? Icons.visibility : Icons.visibility_off,
            color: BankThemeConfig.whiteText,
            size: 20,
          ),
          onPressed: onToggleVisibility,
        ),
      ],
    );
  }

  Widget _buildTotalBalance(BuildContext context) {
    return Text(
      isBalanceVisible ? '\$${totalBalance.toStringAsFixed(2)}' : '•••••••',
      style: BankTextStyles.balanceAmount,
    );
  }

  Widget _buildAccountBreakdown(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: _buildAccountItem(
            context,
            BankLocalizationKeys.bankChecking.tr(context),
            checkingBalance,
          ),
        ),
        Expanded(
          child: _buildAccountItem(
            context,
            BankLocalizationKeys.bankSavings.tr(context),
            savingsBalance,
          ),
        ),
      ],
    );
  }

  Widget _buildAccountItem(BuildContext context, String label, double amount) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: BankThemeConfig.getWhiteTextStyle().copyWith(
            color: BankThemeConfig.whiteText.withOpacity(0.8),
            fontSize: 12,
          ),
        ),
        Text(
          isBalanceVisible ? '\$${amount.toStringAsFixed(2)}' : '•••••••',
          style: BankTextStyles.whiteText.copyWith(
            fontWeight: FontWeight.w600,
          ),
        ),
      ],
    );
  }

  Widget _buildAccountStatus(BuildContext context) {
    // Completely transparent placeholder maintaining original height
    return Container(
      height: 20, // Maintain original height for layout spacing
      color: Colors.transparent, // Ensure completely transparent
      child: const SizedBox.shrink(), // No content at all
    );
  }
}

/// Bank Account Card - Individual account display card
class BankAccountCard extends StatelessWidget {
  final String accountName;
  final String accountNumber;
  final double balance;
  final String accountType;
  final IconData icon;
  final Color color;
  final VoidCallback? onTap;

  const BankAccountCard({
    super.key,
    required this.accountName,
    required this.accountNumber,
    required this.balance,
    required this.accountType,
    required this.icon,
    required this.color,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return BankBaseCard(
      margin: const EdgeInsets.symmetric(
        horizontal: ThemeDimensions.paddingMedium,
        vertical: ThemeDimensions.paddingSmall,
      ),
      elevation: 4,
      onTap: onTap,
      child: Row(
        children: [
          _buildAccountIcon(),
          const SizedBox(width: 16),
          Expanded(child: _buildAccountInfo(context)),
          _buildAccountBalance(),
        ],
      ),
    );
  }

  Widget _buildAccountIcon() {
    return Container(
      width: 48,
      height: 48,
      decoration: BoxDecoration(
        color: color.withOpacity(0.1),
        borderRadius: BorderRadius.circular(BankThemeConfig.smallRadius),
      ),
      child: Icon(
        icon,
        color: color,
        size: 24,
      ),
    );
  }

  Widget _buildAccountInfo(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          accountName,
          style: BankThemeConfig.getPrimaryTextStyle().copyWith(
            fontWeight: FontWeight.w600,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          accountNumber,
          style: BankThemeConfig.getSecondaryTextStyle(),
        ),
        const SizedBox(height: 2),
        Text(
          accountType,
          style: BankThemeConfig.getSecondaryTextStyle().copyWith(
            fontSize: 12,
          ),
        ),
      ],
    );
  }

  Widget _buildAccountBalance() {
    return Text(
      '\$${balance.abs().toStringAsFixed(2)}',
      style: BankTextStyles.getTransactionAmountStyle(balance).copyWith(
        fontWeight: FontWeight.bold,
      ),
    );
  }
}

/// Bank Credit Card - 3D banking card design
class BankCreditCard extends StatelessWidget {
  final String cardNumber;
  final String cardHolderName;
  final String expiryDate;
  final String cardType;
  final bool showNumber;
  final VoidCallback onToggleNumber;
  final VoidCallback? onCopyNumber;
  final LinearGradient? gradient;

  const BankCreditCard({
    super.key,
    required this.cardNumber,
    required this.cardHolderName,
    required this.expiryDate,
    required this.cardType,
    required this.showNumber,
    required this.onToggleNumber,
    this.onCopyNumber,
    this.gradient,
  });

  @override
  Widget build(BuildContext context) {
    return BankBaseCard(
      margin: const EdgeInsets.all(ThemeDimensions.paddingMedium),
      elevation: 12,
      borderRadius: BankConstants.borderRadius,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(BankConstants.borderRadius),
        gradient: gradient ?? BankThemeConfig.cardGradient,
      ),
      padding: const EdgeInsets.all(24),
      child: SizedBox(
        height: 200,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _buildCardHeader(),
            const SizedBox(height: 24),
            _buildCardNumber(),
            const SizedBox(height: 24),
            _buildCardFooter(),
          ],
        ),
      ),
    );
  }

  Widget _buildCardHeader() {
    return Row(
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
    );
  }

  Widget _buildCardNumber() {
    return GestureDetector(
      onTap: onToggleNumber,
      child: Row(
        children: [
          Text(
            showNumber ? cardNumber : '•••• •••• •••• ${cardNumber.substring(cardNumber.length - 4)}',
            style: BankTextStyles.creditCardNumber,
          ),
          const SizedBox(width: 8),
          Icon(
            showNumber ? Icons.visibility : Icons.visibility_off,
            color: BankThemeConfig.whiteText.withOpacity(0.7),
            size: 20,
          ),
        ],
      ),
    );
  }

  Widget _buildCardFooter() {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'CARD HOLDER',
              style: BankThemeConfig.getWhiteTextStyle().copyWith(
                fontSize: 10,
                color: BankThemeConfig.whiteText.withOpacity(0.7),
              ),
            ),
            Text(
              cardHolderName,
              style: BankThemeConfig.getWhiteTextStyle().copyWith(
                fontWeight: FontWeight.w500,
              ),
            ),
          ],
        ),
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'EXPIRES',
              style: BankThemeConfig.getWhiteTextStyle().copyWith(
                fontSize: 10,
                color: BankThemeConfig.whiteText.withOpacity(0.7),
              ),
            ),
            Text(
              expiryDate,
              style: BankThemeConfig.getWhiteTextStyle().copyWith(
                fontWeight: FontWeight.w500,
              ),
            ),
          ],
        ),
        if (onCopyNumber != null)
          GestureDetector(
            onTap: onCopyNumber,
            child: Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: BankThemeConfig.whiteText.withOpacity(0.2),
                borderRadius: BorderRadius.circular(BankConstants.borderRadius),
              ),
              child: const Icon(
                Icons.copy,
                color: BankThemeConfig.whiteText,
                size: 20,
              ),
            ),
          ),
      ],
    );
  }
}

/// Bank Transaction Item Card - For transaction lists
class BankTransactionCard extends StatelessWidget {
  final String title;
  final String subtitle;
  final double amount;
  final DateTime date;
  final IconData icon;
  final String? reference;
  final String? status;

  const BankTransactionCard({
    super.key,
    required this.title,
    required this.subtitle,
    required this.amount,
    required this.date,
    required this.icon,
    this.reference,
    this.status,
  });

  @override
  Widget build(BuildContext context) {
    final isPositive = amount > 0;
    final iconColor = BankThemeConfig.getTransactionColor(isPositive);

    return BankBaseCard(
      margin: const EdgeInsets.symmetric(
        horizontal: ThemeDimensions.paddingMedium,
        vertical: ThemeDimensions.paddingSmall,
      ),
      elevation: 2,
      padding: EdgeInsets.zero,
      child: ListTile(
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 20,
          vertical: 8,
        ),
        leading: CircleAvatar(
          backgroundColor: iconColor.withOpacity(0.1),
          child: Icon(
            icon,
            color: iconColor,
            size: 24,
          ),
        ),
        title: Text(
          title,
          style: BankThemeConfig.getPrimaryTextStyle().copyWith(
            fontWeight: FontWeight.w600,
          ),
        ),
        subtitle: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const SizedBox(height: 2),
            Text(
              subtitle,
              style: BankThemeConfig.getSecondaryTextStyle(),
            ),
            if (reference != null) ...[
              const SizedBox(height: 2),
              Text(
                reference!,
                style: BankThemeConfig.getSecondaryTextStyle().copyWith(
                  fontSize: 11,
                ),
              ),
            ],
          ],
        ),
        trailing: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Text(
              '${isPositive ? '+' : ''}\$${amount.abs().toStringAsFixed(2)}',
              style: BankTextStyles.getTransactionAmountStyle(amount),
            ),
            const SizedBox(height: 2),
            Text(
              _formatDate(date, context),
              style: BankThemeConfig.getSecondaryTextStyle().copyWith(
                fontSize: 11,
              ),
            ),
            if (status != null) ...[
              const SizedBox(height: 2),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: Colors.green.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(BankConstants.borderRadius),
                ),
                child: Text(
                  status!,
                  style: BankThemeConfig.getSecondaryTextStyle().copyWith(
                    color: Colors.green,
                    fontSize: 10,
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  String _formatDate(DateTime date, BuildContext context) {
    final now = DateTime.now();
    final difference = now.difference(date);

    if (difference.inDays == 0) {
      return BankLocalizationKeys.bankToday.tr(context);
    } else if (difference.inDays == 1) {
      return BankLocalizationKeys.bankYesterday.tr(context);
    } else if (difference.inDays < 7) {
      return '${difference.inDays}d ago';
    } else {
      return '${date.day}/${date.month}';
    }
  }
}