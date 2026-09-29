import 'package:flutter/material.dart';
import 'package:qyflutter/common/theme/base/theme_colors.dart';

class BankLoanScreen extends StatelessWidget {
  const BankLoanScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('Loan'),
        backgroundColor: ThemeColors.primaryColor,
        foregroundColor: Colors.white,
      ),
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.credit_card, size: 64, color: Colors.orange),
            SizedBox(height: 16),
            Text('Loan Feature', style: TextStyle(fontSize: 24)),
            SizedBox(height: 8),
            Text('Loan functionality will be implemented here'),
          ],
        ),
      ),
    );
  }
}
