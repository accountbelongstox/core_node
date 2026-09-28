import 'package:flutter/material.dart';
import '../../../widgets_app_bank/bank_rotating_search_hint.dart';
import '../../../widgets_app_bank/bank_location_indicator.dart';

class LifeTopHeader extends StatelessWidget {
  const LifeTopHeader({super.key});

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      bottom: false,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        child: Row(
          children: [
            const BankLocationIndicator(
              iconSize: 18,
              iconColor: Colors.black87,
              textStyle: TextStyle(
                fontSize: 14,
                color: Colors.black87,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: BankRotatingSearchHint(
                pageType: BankPageType.life,
                textColor: Colors.grey,
                fontSize: 14,
                backgroundColor: Colors.grey[100],
                padding:
                    const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                prefixIcon:
                    Icon(Icons.search, color: Colors.grey[600], size: 20),
                suffixIcon: Icon(Icons.mic, color: Colors.grey[600], size: 20),
              ),
            ),
            const SizedBox(width: 12),
            Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.headset_mic, color: Colors.black87, size: 24),
                const SizedBox(height: 2),
                const Text(
                  '客服',
                  style: TextStyle(
                    fontSize: 12,
                    color: Colors.black87,
                  ),
                ),
              ],
            ),
            const SizedBox(width: 12),
            Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.description, color: Colors.black87, size: 24),
                const SizedBox(height: 2),
                const Text(
                  '订单',
                  style: TextStyle(
                    fontSize: 12,
                    color: Colors.black87,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
