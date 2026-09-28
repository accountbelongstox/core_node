import 'package:flutter/material.dart';
import 'package:qyflutter/apps/app_bank/config_app_bank/constants.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'performance_metric.dart';

class PerformanceTab extends StatelessWidget {
  const PerformanceTab({super.key});

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Performance Overview',
            style: ThemeTextStyles.headingLarge.copyWith(
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 20),
          Card(
            elevation: 2,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(BankConstants.borderRadius),
            ),
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                children: [
                  const PerformanceMetric(
                    period: '1 Day',
                    performance: '+1.35%',
                    color: Colors.green,
                  ),
                  const Divider(),
                  const PerformanceMetric(
                    period: '1 Week',
                    performance: '+3.42%',
                    color: Colors.green,
                  ),
                  const Divider(),
                  const PerformanceMetric(
                    period: '1 Month',
                    performance: '+8.75%',
                    color: Colors.green,
                  ),
                  const Divider(),
                  const PerformanceMetric(
                    period: '3 Months',
                    performance: '+15.20%',
                    color: Colors.green,
                  ),
                  const Divider(),
                  const PerformanceMetric(
                    period: '1 Year',
                    performance: '+28.45%',
                    color: Colors.green,
                  ),
                  const Divider(),
                  const PerformanceMetric(
                    period: 'All Time',
                    performance: '+42.33%',
                    color: Colors.green,
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
