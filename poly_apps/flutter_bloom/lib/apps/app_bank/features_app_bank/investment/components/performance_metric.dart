import 'package:flutter/material.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';

class PerformanceMetric extends StatelessWidget {
  final String period;
  final String performance;
  final Color color;

  const PerformanceMetric({
    super.key,
    required this.period,
    required this.performance,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            period,
            style: ThemeTextStyles.bodyMedium,
          ),
          Text(
            performance,
            style: ThemeTextStyles.bodyMedium.copyWith(
              color: color,
              fontWeight: FontWeight.bold,
            ),
          ),
        ],
      ),
    );
  }
}
