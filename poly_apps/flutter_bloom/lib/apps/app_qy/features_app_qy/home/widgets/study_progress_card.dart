/// Study progress card widget
library;

import 'package:flutter/material.dart';
import '../../../../../../common/i18n/i18n_service.dart';
import '../../../../../../common/theme/app_theme.dart';
import '../../../../../../common/widgets/gradient_button.dart';

class StudyProgressCard extends StatelessWidget {
  const StudyProgressCard({super.key});

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 4,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(20),
      ),
      child: Container(
        decoration: BoxDecoration(
          gradient: AppTheme.primaryGradient,
          borderRadius: BorderRadius.circular(20),
        ),
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'home.todayGoal'.tr,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(
                    color: Colors.white.withOpacity(0.2),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.local_fire_department, color: Colors.orange, size: 16),
                      const SizedBox(width: 4),
                      Text(
                        '7 ${'home.days'.tr}',
                        style: const TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 20),
            Row(
              children: [
                Expanded(
                  child: _buildProgressItem(
                    context,
                    'home.newWords'.tr,
                    '0',
                    '200',
                    Colors.white,
                  ),
                ),
                const SizedBox(width: 20),
                Expanded(
                  child: _buildProgressItem(
                    context,
                    'home.reviewWords'.tr,
                    '0',
                    '27',
                    Colors.white70,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 20),
            GradientButton(
              text: 'home.startStudy'.tr,
              width: double.infinity,
              height: 50,
              gradient: const LinearGradient(
                colors: [Colors.white, Colors.white],
              ),
              textStyle: const TextStyle(
                color: AppTheme.primaryGreen,
                fontSize: 16,
                fontWeight: FontWeight.bold,
              ),
              icon: const Icon(Icons.arrow_forward, color: AppTheme.primaryGreen),
              onPressed: () {},
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildProgressItem(
    BuildContext context,
    String label,
    String current,
    String total,
    Color textColor,
  ) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: TextStyle(
            color: textColor,
            fontSize: 14,
          ),
        ),
        const SizedBox(height: 8),
        Text(
          '$current/$total',
          style: TextStyle(
            color: textColor,
            fontSize: 24,
            fontWeight: FontWeight.bold,
          ),
        ),
      ],
    );
  }
}