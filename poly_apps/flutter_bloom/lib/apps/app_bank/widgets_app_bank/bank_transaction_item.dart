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
import '../config_app_bank/constants.dart';
import '../config_app_bank/bank_text_styles.dart';

enum TransactionType { credit, debit, transfer, withdrawal }

class TransactionDetail {
  final String title;
  final String subtitle;
  final double amount;
  final DateTime date;
  final TransactionType type;
  final String status;
  final String reference;

  TransactionDetail({
    required this.title,
    required this.subtitle,
    required this.amount,
    required this.date,
    required this.type,
    required this.status,
    required this.reference,
  });
}

class BankTransactionItem extends StatelessWidget {
  final TransactionDetail transaction;
  final VoidCallback? onTap;

  const BankTransactionItem({
    super.key,
    required this.transaction,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final IconData iconData;
    final Color iconColor;

    switch (transaction.type) {
      case TransactionType.credit:
        iconData = Icons.add_circle;
        iconColor = Colors.green;
        break;
      case TransactionType.debit:
        iconData = Icons.shopping_cart;
        iconColor = Colors.orange;
        break;
      case TransactionType.transfer:
        iconData = Icons.send;
        iconColor = Colors.blue;
        break;
      case TransactionType.withdrawal:
        iconData = Icons.local_atm;
        iconColor = Colors.red;
        break;
    }

    return ListTile(
      contentPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
      leading: CircleAvatar(
        backgroundColor: iconColor.withOpacity(0.1),
        child: Icon(
          iconData,
          color: iconColor,
          size: 24,
        ),
      ),
      title: Text(
        transaction.title,
        style: BankTextStyles.bodyLarge.copyWith(
          fontWeight: FontWeight.w600,
        ),
      ),
      subtitle: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SizedBox(height: 2),
          Text(
            transaction.subtitle,
            style: BankTextStyles.bodySmall.copyWith(
              color: Colors.grey[600],
            ),
          ),
          const SizedBox(height: 2),
          Text(
            transaction.reference,
            style: BankTextStyles.bodySmall.copyWith(
              color: Colors.grey[500],
              fontSize: 11,
            ),
          ),
        ],
      ),
      trailing: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          Text(
            '${transaction.amount > 0 ? '+' : ''}\$${transaction.amount.abs().toStringAsFixed(2)}',
            style: BankTextStyles.bodyLarge.copyWith(
              color: transaction.amount > 0 ? Colors.green : Colors.red,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            _formatDate(transaction.date),
            style: BankTextStyles.bodySmall.copyWith(
              color: Colors.grey[500],
            ),
          ),
          const SizedBox(height: 2),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
            decoration: BoxDecoration(
              color: Colors.green.withOpacity(0.1),
              borderRadius: BorderRadius.circular(BankConstants.borderRadius),
            ),
            child: Text(
              transaction.status,
              style: BankTextStyles.bodySmall.copyWith(
                color: Colors.green,
                fontSize: 10,
              ),
            ),
          ),
        ],
      ),
      onTap: onTap,
    );
  }

  String _formatDate(DateTime date) {
    final now = DateTime.now();
    final difference = now.difference(date);

    if (difference.inDays == 0) {
      return '${date.hour}:${date.minute.toString().padLeft(2, '0')}';
    } else if (difference.inDays == 1) {
      return 'Yesterday';
    } else if (difference.inDays < 7) {
      return '${difference.inDays}d ago';
    } else {
      return '${date.day}/${date.month}';
    }
  }
}
