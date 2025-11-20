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
import '../models_app_wuy/history_record_model_app_wuy.dart';

class WuyLocationHistoryItem extends StatelessWidget {
  final HistoryRecordModelAppWuy record;
  final VoidCallback? onTap;

  const WuyLocationHistoryItem({
    super.key,
    required this.record,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: EdgeInsets.symmetric(
        horizontal: ThemeDimensions.paddingSizeDefault,
        vertical: ThemeDimensions.spacing8,
      ),
      decoration: BoxDecoration(
        color: ThemeColors.white,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(
            color: ThemeColors.black.withOpacity(0.06),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Material(
        color: ThemeColors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(12),
          child: Padding(
            padding: EdgeInsets.all(ThemeDimensions.paddingSizeDefault),
            child: Row(
              children: [
                Container(
                  width: 48,
                  height: 48,
                  decoration: BoxDecoration(
                    color: _getTypeColor().withOpacity(0.1),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(
                    _getTypeIcon(),
                    color: _getTypeColor(),
                    size: 24,
                  ),
                ),
                SizedBox(width: ThemeDimensions.paddingSizeDefault),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Icon(
                            Icons.access_time,
                            size: 14,
                            color: ThemeColors.secondaryLabel,
                          ),
                          SizedBox(width: ThemeDimensions.spacing4),
                          Text(
                            '${record.formattedDate} ${record.formattedTime}',
                            style: ThemeTextStyles.caption1.copyWith(
                              color: ThemeColors.secondaryLabel,
                            ),
                          ),
                        ],
                      ),
                      SizedBox(height: ThemeDimensions.spacing4),
                      Row(
                        children: [
                          Icon(
                            Icons.location_on,
                            size: 14,
                            color: ThemeColors.red,
                          ),
                          SizedBox(width: ThemeDimensions.spacing4),
                          Expanded(
                            child: Text(
                              record.displayLocationName,
                              style: ThemeTextStyles.subheadBold.copyWith(
                                color: ThemeColors.label,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        ],
                      ),
                      if (record.stayDuration != null) ...[
                        SizedBox(height: ThemeDimensions.spacing4),
                        Row(
                          children: [
                            Icon(
                              Icons.timer,
                              size: 14,
                              color: ThemeColors.blue,
                            ),
                            SizedBox(width: ThemeDimensions.spacing4),
                            Text(
                              'Stayed ${record.displayStayDuration}',
                              style: ThemeTextStyles.footnote.copyWith(
                                color: ThemeColors.secondaryLabel,
                              ),
                            ),
                          ],
                        ),
                      ],
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  IconData _getTypeIcon() {
    switch (record.type) {
      case HistoryRecordType.arrival:
        return Icons.place;
      case HistoryRecordType.departure:
        return Icons.exit_to_app;
      case HistoryRecordType.staying:
        return Icons.location_on;
      case HistoryRecordType.moving:
        return Icons.directions_walk;
    }
  }

  Color _getTypeColor() {
    switch (record.type) {
      case HistoryRecordType.arrival:
        return ThemeColors.green;
      case HistoryRecordType.departure:
        return ThemeColors.orange;
      case HistoryRecordType.staying:
        return ThemeColors.blue;
      case HistoryRecordType.moving:
        return ThemeColors.purple;
    }
  }
}
