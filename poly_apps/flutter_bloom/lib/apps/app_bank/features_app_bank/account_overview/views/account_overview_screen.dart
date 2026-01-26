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
import 'package:qyflutter/common/theme/base/theme_colors.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';

/// Bank Account Overview Screen
/// Displays detailed view of all user accounts
class BankAccountOverviewScreen extends StatelessWidget {
  const BankAccountOverviewScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final List<BankAccount> accounts = [
      BankAccount(
        name: 'Checking Account',
        accountNumber: '****1234',
        balance: 8459.50,
        type: 'Checking',
        icon: Icons.account_balance_wallet,
        color: const Color(0xFF4CAF50),
      ),
      BankAccount(
        name: 'Savings Account',
        accountNumber: '****5678',
        balance: 4000.00,
        type: 'Savings',
        icon: Icons.savings,
        color: const Color(0xFF2196F3),
      ),
      BankAccount(
        name: 'Credit Card',
        accountNumber: '****9012',
        balance: -1250.75,
        type: 'Credit',
        icon: Icons.credit_card,
        color: const Color(0xFFFF5722),
      ),
      BankAccount(
        name: 'Investment Account',
        accountNumber: '****3456',
        balance: 15750.25,
        type: 'Investment',
        icon: Icons.trending_up,
        color: const Color(0xFF9C27B0),
      ),
    ];

    return Scaffold(
      appBar: AppBar(
        title: const Text('My Accounts'),
        backgroundColor: ThemeColors.primaryColor,
        foregroundColor: Colors.white,
        elevation: 0,
      ),
      body: Padding(
        padding: const EdgeInsets.all(ThemeDimensions.paddingMedium),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Total Balance Summary
            Card(
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(BankConstants.borderRadius),
              ),
              child: Padding(
                padding: const EdgeInsets.all(ThemeDimensions.paddingLarge),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Total Balance',
                      style: ThemeTextStyles.bodyMedium.copyWith(
                        color: ThemeColors.textSecondary,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      '\$26,959.00',
                      style: ThemeTextStyles.headingLarge.copyWith(
                        color: ThemeColors.textPrimary,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: ThemeDimensions.spacingMedium),
                    Row(
                      children: [
                        Icon(
                          Icons.trending_up,
                          color: Colors.green,
                          size: 16,
                        ),
                        const SizedBox(width: 4),
                        Text(
                          '+2.5% from last month',
                          style: ThemeTextStyles.bodySmall.copyWith(
                            color: Colors.green,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),

            const SizedBox(height: ThemeDimensions.spacingLarge),

            // Accounts List
            Text(
              'Your Accounts',
              style: ThemeTextStyles.headingMedium.copyWith(
                color: ThemeColors.textPrimary,
                fontWeight: FontWeight.bold,
              ),
            ),

            const SizedBox(height: ThemeDimensions.spacingMedium),

            Expanded(
              child: ListView.builder(
                itemCount: accounts.length,
                itemBuilder: (context, index) {
                  final account = accounts[index];
                  return Card(
                    margin: const EdgeInsets.only(bottom: ThemeDimensions.spacingMedium),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(BankConstants.borderRadius),
                    ),
                    child: ListTile(
                      contentPadding: const EdgeInsets.all(ThemeDimensions.paddingMedium),
                      leading: CircleAvatar(
                        backgroundColor: account.color.withOpacity(0.1),
                        child: Icon(
                          account.icon,
                          color: account.color,
                        ),
                      ),
                      title: Text(
                        account.name,
                        style: ThemeTextStyles.bodyLarge.copyWith(
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      subtitle: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const SizedBox(height: 4),
                          Text(
                            account.accountNumber,
                            style: ThemeTextStyles.bodySmall.copyWith(
                              color: ThemeColors.textSecondary,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            account.type,
                            style: ThemeTextStyles.bodySmall.copyWith(
                              color: account.color,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ],
                      ),
                      trailing: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          Text(
                            '${account.balance < 0 ? '-' : ''}\$${account.balance.abs().toStringAsFixed(2)}',
                            style: ThemeTextStyles.bodyLarge.copyWith(
                              color: account.balance < 0 ? Colors.red : ThemeColors.textPrimary,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Icon(
                            Icons.arrow_forward_ios,
                            size: 16,
                            color: ThemeColors.textSecondary,
                          ),
                        ],
                      ),
                      onTap: () {
                        // Navigate to account details
                      },
                    ),
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class BankAccount {
  final String name;
  final String accountNumber;
  final double balance;
  final String type;
  final IconData icon;
  final Color color;

  BankAccount({
    required this.name,
    required this.accountNumber,
    required this.balance,
    required this.type,
    required this.icon,
    required this.color,
  });
}