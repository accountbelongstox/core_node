import 'package:flutter/material.dart';
import '../../../widgets_app_bank/bank_simple_card.dart';

class QuickAccessCards extends StatelessWidget {
  const QuickAccessCards({super.key});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: Container(
            margin: const EdgeInsets.only(left: 16, right: 8, top: 8),
            child: BankSimpleCard(
              padding: const EdgeInsets.all(16),
              child: Column(
                children: [
                  const Text(
                    '好券中心',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w600,
                      color: Colors.black87,
                    ),
                  ),
                  const SizedBox(height: 4),
                  const Text(
                    '精选好券限时领',
                    style: TextStyle(
                      fontSize: 12,
                      color: Colors.grey,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
        Expanded(
          child: Container(
            margin: const EdgeInsets.only(left: 8, right: 8, top: 8),
            child: BankSimpleCard(
              padding: const EdgeInsets.all(16),
              child: Column(
                children: [
                  const Text(
                    '低碳生活',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w600,
                      color: Colors.black87,
                    ),
                  ),
                  const SizedBox(height: 4),
                  const Text(
                    '抢兑20元立减金',
                    style: TextStyle(
                      fontSize: 12,
                      color: Colors.grey,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
        Expanded(
          child: Container(
            margin: const EdgeInsets.only(left: 8, right: 16, top: 8),
            child: BankSimpleCard(
              padding: const EdgeInsets.all(16),
              child: Column(
                children: [
                  const Text(
                    '做任务赢好礼',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w600,
                      color: Colors.black87,
                    ),
                  ),
                  const SizedBox(height: 4),
                  const Text(
                    '抽100元立减金',
                    style: TextStyle(
                      fontSize: 12,
                      color: Colors.grey,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }
}
