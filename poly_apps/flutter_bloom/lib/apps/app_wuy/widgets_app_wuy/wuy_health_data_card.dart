// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

import 'package:flutter/material.dart';
import 'package:qyflutter/common/theme/base/theme_colors.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import '../models_app_wuy/health_data_model_app_wuy.dart';

class WuyHealthDataCard extends StatelessWidget {
  final HealthDataModelAppWuy? healthData;
  final bool showBloodOxygen;
  final String? title;
  final EdgeInsets? padding;

  const WuyHealthDataCard({
    super.key,
    this.healthData,
    this.showBloodOxygen = true,
    this.title,
    this.padding,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: padding ?? EdgeInsets.all(ThemeDimensions.paddingSizeDefault),
      padding: EdgeInsets.all(ThemeDimensions.paddingSizeDefault),
      decoration: BoxDecoration(
        color: ThemeColors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: ThemeColors.black.withOpacity(0.06),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
          BoxShadow(
            color: ThemeColors.black.withOpacity(0.02),
            blurRadius: 4,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (title != null) ...[
            Text(
              title!,
              style: ThemeTextStyles.title3Bold.copyWith(
                color: ThemeColors.label,
              ),
            ),
            SizedBox(height: ThemeDimensions.paddingSizeDefault),
          ],
          Row(
            children: [
              Expanded(
                child: _buildHealthItem(
                  icon: Icons.directions_walk,
                  label: 'Steps',
                  value: healthData?.displaySteps ?? 'N/A',
                  color: ThemeColors.green,
                ),
              ),
              Expanded(
                child: _buildHealthItem(
                  icon: Icons.favorite,
                  label: 'Heart Rate',
                  value: healthData?.displayHeartRate ?? 'N/A',
                  color: ThemeColors.red,
                ),
              ),
            ],
          ),
          SizedBox(height: ThemeDimensions.paddingSizeDefault),
          Row(
            children: [
              Expanded(
                child: _buildHealthItem(
                  icon: Icons.thermostat,
                  label: 'Temperature',
                  value: healthData?.displayTemperature ?? 'N/A',
                  color: ThemeColors.orange,
                ),
              ),
              Expanded(
                child: _buildHealthItem(
                  icon: Icons.local_fire_department,
                  label: 'Calories',
                  value: healthData?.displayCalories ?? 'N/A',
                  color: ThemeColors.purple,
                ),
              ),
            ],
          ),
          if (showBloodOxygen) ...[
            SizedBox(height: ThemeDimensions.paddingSizeDefault),
            Row(
              children: [
                Expanded(
                  child: _buildHealthItem(
                    icon: Icons.opacity,
                    label: 'Blood Oxygen',
                    value: healthData?.displayBloodOxygen ?? 'N/A',
                    color: ThemeColors.blue,
                  ),
                ),
                Expanded(child: Container()),
              ],
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildHealthItem({
    required IconData icon,
    required String label,
    required String value,
    required Color color,
  }) {
    return Container(
      padding: EdgeInsets.all(ThemeDimensions.spacing12),
      decoration: BoxDecoration(
        color: color.withOpacity(0.1),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        children: [
          Icon(
            icon,
            color: color,
            size: 28,
          ),
          SizedBox(height: ThemeDimensions.spacing8),
          Text(
            label,
            style: ThemeTextStyles.caption1.copyWith(
              color: ThemeColors.secondaryLabel,
            ),
            textAlign: TextAlign.center,
          ),
          SizedBox(height: ThemeDimensions.spacing4),
          Text(
            value,
            style: ThemeTextStyles.calloutBold.copyWith(
              color: color,
            ),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }
}
