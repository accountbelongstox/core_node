import 'package:flutter/material.dart';
import 'package:qyflutter/common/theme/base/theme_colors.dart';

class BankSecurityScreen extends StatelessWidget {
  const BankSecurityScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('Security'),
        backgroundColor: ThemeColors.primaryColor,
        foregroundColor: Colors.white,
      ),
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.credit_card, size: 64, color: Colors.orange),
            SizedBox(height: 16),
            Text('Security Feature', style: TextStyle(fontSize: 24)),
            SizedBox(height: 8),
            Text('Security functionality will be implemented here'),
          ],
        ),
      ),
    );
  }
}
