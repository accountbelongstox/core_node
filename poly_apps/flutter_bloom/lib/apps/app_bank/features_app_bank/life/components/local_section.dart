import 'package:flutter/material.dart';
import '../../../widgets_app_bank/bank_section_card.dart';
import '../../../widgets_app_bank/bank_gradient_card.dart';
import '../../../widgets_app_bank/bank_action_button.dart';
import '../../../widgets_app_bank/bank_loading_dialog.dart';

class LocalSection extends StatelessWidget {
  const LocalSection({super.key});

  @override
  Widget build(BuildContext context) {
    return BankSectionCard(
      title: '本地',
      moreText: '优惠享不停',
      gradient: const LinearGradient(
        begin: Alignment.topCenter,
        end: Alignment.bottomCenter,
        colors: [
          Color(0xFFFBFCFE),
          Color(0xFFFBFCFE),
        ],
      ),
      children: [
        Row(
          children: [
            Expanded(
              child: BankGradientCard(
                gradient: const LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [Color(0xFF74B9FF), Color(0xFF0984E3)],
                ),
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      '国补权益',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                        color: Colors.white,
                      ),
                    ),
                    const SizedBox(height: 8),
                    const Text(
                      '至高20%',
                      style: TextStyle(
                        fontSize: 24,
                        fontWeight: FontWeight.bold,
                        color: Colors.white,
                      ),
                    ),
                    const SizedBox(height: 12),
                    BankActionButton(
                      text: '立即查看',
                      backgroundColor: Colors.white,
                      textColor: const Color(0xFF0984E3),
                      padding: const EdgeInsets.symmetric(
                          horizontal: 16, vertical: 8),
                      onTap: () {
                        BankLoadingDialog.show(context, title: '国补权益');
                      },
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: BankGradientCard(
                gradient: const LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [Color(0xFFFFECD2), Color(0xFFFCB69F)],
                ),
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      '建"社"开卡享好礼',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                        color: Color(0xFF8B4513),
                      ),
                    ),
                    const SizedBox(height: 8),
                    const Text(
                      '至高可得288元立减金',
                      style: TextStyle(
                        fontSize: 14,
                        color: Color(0xFF8B4513),
                      ),
                    ),
                    const SizedBox(height: 12),
                    BankActionButton(
                      text: '立即查看',
                      backgroundColor: Colors.white,
                      textColor: const Color(0xFF8B4513),
                      padding: const EdgeInsets.symmetric(
                          horizontal: 16, vertical: 8),
                      onTap: () {
                        BankLoadingDialog.show(context, title: '建"社"开卡享好礼');
                      },
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        const Text(
          '以旧换新 优惠加倍',
          style: TextStyle(
            fontSize: 14,
            color: Colors.black87,
          ),
        ),
        const SizedBox(height: 4),
        const Text(
          '本地国补攻略快速看',
          style: TextStyle(
            fontSize: 12,
            color: Colors.grey,
          ),
        ),
      ],
    );
  }
}
