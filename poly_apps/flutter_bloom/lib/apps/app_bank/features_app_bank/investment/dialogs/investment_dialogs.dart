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

class InvestmentDialogs {
  static void showInvestDialog(BuildContext context, {Function(double)? onInvest}) {
    final TextEditingController amountController = TextEditingController();
    
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Invest'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: amountController,
              decoration: const InputDecoration(
                labelText: 'Investment Amount',
                prefixText: '\$',
                border: OutlineInputBorder(),
              ),
              keyboardType: TextInputType.number,
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () {
              final amount = double.tryParse(amountController.text) ?? 0.0;
              Navigator.of(context).pop();
              if (onInvest != null) {
                onInvest(amount);
              } else {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                      content: Text('Investment order placed successfully!')),
                );
              }
            },
            child: const Text('Invest'),
          ),
        ],
      ),
    );
  }

  static void showWithdrawDialog(BuildContext context, {VoidCallback? onContinue}) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Withdraw'),
        content: const Text('Select investment to withdraw from:'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.of(context).pop();
              if (onContinue != null) {
                onContinue();
              }
            },
            child: const Text('Continue'),
          ),
        ],
      ),
    );
  }

  static void showRebalanceDialog(BuildContext context, {VoidCallback? onRebalance}) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Rebalance Portfolio'),
        content: const Text(
            'This will automatically rebalance your portfolio according to your risk profile.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.of(context).pop();
              if (onRebalance != null) {
                onRebalance();
              }
            },
            child: const Text('Rebalance'),
          ),
        ],
      ),
    );
  }
}
