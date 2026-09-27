import 'package:flutter/material.dart';
import 'package:qyflutter/common/theme/base/theme_colors.dart';

class BankPaymentScreen extends StatelessWidget {
  const BankPaymentScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Pay Bills'),
        backgroundColor: ThemeColors.primaryColor,
        foregroundColor: Colors.white,
      ),
      body: const Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.payment, size: 64, color: Colors.blue),
            SizedBox(height: 16),
            Text('Payment Feature', style: TextStyle(fontSize: 24)),
            SizedBox(height: 8),
            Text('Pay bills and manage payments'),
          ],
        ),
      ),
    );
  }
}