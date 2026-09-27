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
