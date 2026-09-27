import 'package:flutter/material.dart';
import '../../../widgets_app_bank/bank_section_card.dart';
import '../../../widgets_app_bank/bank_gradient_card.dart';
import '../../../widgets_app_bank/bank_action_button.dart';
import '../../../widgets_app_bank/bank_loading_dialog.dart';

class GoodStuffSection extends StatelessWidget {
  const GoodStuffSection({super.key});

  @override
  Widget build(BuildContext context) {
    return BankSectionCard(
      title: '好物',
      moreText: '人气必买',
      gradient: const LinearGradient(
        begin: Alignment.topCenter,
        end: Alignment.bottomCenter,
        colors: [
          Color(0xFFFBFCFE),
          Color(0xFFFBFCFE),
        ],
      ),
      children: [
        BankGradientCard(
          gradient: const LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [Color(0xFFFFECD2), Color(0xFFFCB69F)],
          ),
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          '龙卡新卡消费达标',
                          style: TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                            color: Color(0xFF8B4513),
                          ),
                        ),
                        SizedBox(height: 8),
                        Text(
                          '享至高366元立减金',
                          style: TextStyle(
                            fontSize: 14,
                            color: Color(0xFF8B4513),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              BankActionButton(
                text: '立即查看',
                backgroundColor: Colors.white,
                textColor: const Color(0xFF8B4513),
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                onTap: () {
                  BankLoadingDialog.show(context, title: '龙卡新卡消费达标');
                },
              ),
            ],
          ),
        ),
      ],
    );
  }
}
