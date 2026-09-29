import 'package:flutter/material.dart';
import 'package:qyflutter/common/theme/base/theme_colors.dart';

class BankTransactionHistoryScreen extends StatelessWidget {
  const BankTransactionHistoryScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Transaction History'),
        backgroundColor: ThemeColors.primaryColor,
        foregroundColor: Colors.white,
      ),
      body: const Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.history, size: 64, color: Colors.green),
            SizedBox(height: 16),
            Text('Transaction History', style: TextStyle(fontSize: 24)),
            SizedBox(height: 8),
            Text('View all your transactions'),
          ],
        ),
      ),
    );
  }
}