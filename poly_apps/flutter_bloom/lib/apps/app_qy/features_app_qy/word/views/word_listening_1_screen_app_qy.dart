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

/// Word Listening 1 Screen for QY App
library;

import 'package:flutter/material.dart';
import '../../../../../../common/theme/base/theme_colors.dart';
import '../../../../../../common/theme/base/theme_dimensions.dart';
import '../../../../../../common/theme/base/theme_text_styles.dart';
import '../../../../../../common/localization/localization_manager.dart';
import '../../../localization_app_qy/localization_keys_app_qy.dart';

class WordListening1ScreenAppQy extends StatefulWidget {
  const WordListening1ScreenAppQy({super.key});

  @override
  State<WordListening1ScreenAppQy> createState() => _WordListening1ScreenAppQyState();
}

class _WordListening1ScreenAppQyState extends State<WordListening1ScreenAppQy> {
  final List<Map<String, String>> _headerStats;
  final List<Map<String, dynamic>> _learningStatus;
  final List<Map<String, String>> _taskFilters;
  final List<Map<String, dynamic>> _todayTasks;
  int _selectedFilterIndex;

  _WordListening1ScreenAppQyState()
      : _headerStats = [
          {'label': '今日新词', 'value': '20'},
          {'label': '生词本', 'value': '12'},
          {'label': '完成率', 'value': '86%'},
        ],
        _learningStatus = [
          {'title': '在学单词', 'count': 1, 'description': '当前正在学习'},
          {'title': '未学单词', 'count': 63, 'description': '等待开启的词汇'},
          {'title': '简单词', 'count': 20, 'description': '复习巩固词'},
        ],
        _taskFilters = [
          {'title': '单词书', 'subtitle': '16952 词'},
          {'title': '生词本', 'subtitle': '27 词'},
          {'title': '今日任务', 'subtitle': '3 个任务'},
        ],
        _todayTasks = [
          {
            'title': '今日新词听写',
            'description': '跟随老师语音，完成 20 个新词听写',
            'progress': 0.75,
            'duration': '12 min',
            'isPriority': true,
          },
          {
            'title': '生词本巩固',
            'description': '慢速播放，重复 12 个薄弱词汇',
            'progress': 0.45,
            'duration': '8 min',
            'isPriority': false,
          },
          {
            'title': '轻松模式',
            'description': '随机播放简单词，保持语感',
            'progress': 0.2,
            'duration': '5 min',
            'isPriority': false,
          },
        ],
        _selectedFilterIndex = 0;

  void _handleFilterTap(int index) {
    setState(() {
      _selectedFilterIndex = index;
    });
  }

  void _handleStartTask(Map<String, dynamic> task) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('${task['title']} ${QyAppLocalizationKeys.qyListeningPracticing.tr(context)}'),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: ThemeColors.background,
      appBar: AppBar(
        title: Text(
          QyAppLocalizationKeys.qyListeningTodayListening.tr(context),
          style: TextStyles.h3.copyWith(color: ThemeColors.textPrimary),
        ),
        backgroundColor: ThemeColors.surface,
        elevation: 0,
        actions: [
          IconButton(
            onPressed: () => ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text(QyAppLocalizationKeys.qyListeningStats.tr(context)),
              ),
            ),
            icon: Icon(Icons.bar_chart, color: ThemeColors.textSecondary),
          ),
        ],
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: EdgeInsets.all(Dimensions.paddingMedium),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _buildHeroCard(),
              SizedBox(height: Dimensions.spacingMedium),
              _buildFilterRow(),
              SizedBox(height: Dimensions.spacingMedium),
              _buildStatusGrid(),
              SizedBox(height: Dimensions.spacingMedium),
              _buildTaskList(),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildHeroCard() {
    return Container(
      width: double.infinity,
      padding: EdgeInsets.all(Dimensions.paddingLarge),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [ThemeColors.primary, ThemeColors.primaryDark],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(Dimensions.radiusLarge),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            '单词随身听',
            style: TextStyles.h2.copyWith(
              color: Colors.white,
              fontWeight: FontWeight.bold,
            ),
          ),
          SizedBox(height: Dimensions.spacingXSmall),
          Text(
            '单词书 · 今日新词',
            style: TextStyles.body1.copyWith(color: Colors.white70),
          ),
          SizedBox(height: Dimensions.spacingLarge),
          Row(
            children: _headerStats.map((stat) {
              return Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      stat['value']!,
                      style: TextStyles.h2.copyWith(color: Colors.white),
                    ),
                    SizedBox(height: Dimensions.spacingXSmall),
                    Text(
                      stat['label']!,
                      style: TextStyles.caption.copyWith(color: Colors.white70),
                    ),
                  ],
                ),
              );
            }).toList(),
          ),
          SizedBox(height: Dimensions.spacingMedium),
          ElevatedButton.icon(
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.white,
              foregroundColor: ThemeColors.primary,
              minimumSize: const Size(double.infinity, 48),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(Dimensions.radiusMedium),
              ),
            ),
            onPressed: () => _handleStartTask(_todayTasks.first),
            icon: const Icon(Icons.play_arrow),
            label: Text(QyAppLocalizationKeys.qyListeningPlay.tr(context)),
          ),
        ],
      ),
    );
  }

  Widget _buildFilterRow() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          QyAppLocalizationKeys.qyListeningSelectCategory.tr(context),
          style: TextStyles.subtitle1.copyWith(color: ThemeColors.textSecondary),
        ),
        SizedBox(height: Dimensions.spacingSmall),
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(
            children: List.generate(_taskFilters.length, (index) {
              final filter = _taskFilters[index];
              final bool isSelected = _selectedFilterIndex == index;
              return GestureDetector(
                onTap: () => _handleFilterTap(index),
                child: Container(
                  margin: EdgeInsets.only(right: Dimensions.spacingSmall),
                  padding: EdgeInsets.symmetric(
                    horizontal: Dimensions.paddingMedium,
                    vertical: Dimensions.paddingSmall,
                  ),
                  decoration: BoxDecoration(
                    color: isSelected ? ThemeColors.primary.withOpacity(0.1) : ThemeColors.surface,
                    borderRadius: BorderRadius.circular(Dimensions.radiusLarge),
                    border: Border.all(
                      color: isSelected ? ThemeColors.primary : ThemeColors.border,
                    ),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        filter['title']!,
                        style: TextStyles.body1.copyWith(
                          color: isSelected ? ThemeColors.primary : ThemeColors.textPrimary,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      SizedBox(height: Dimensions.spacingXSmall),
                      Text(
                        filter['subtitle']!,
                        style: TextStyles.caption.copyWith(color: ThemeColors.textSecondary),
                      ),
                    ],
                  ),
                ),
              );
            }),
          ),
        ),
      ],
    );
  }

  Widget _buildStatusGrid() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          '学习状态',
          style: TextStyles.subtitle1.copyWith(color: ThemeColors.textSecondary),
        ),
        SizedBox(height: Dimensions.spacingSmall),
        Column(
          children: _learningStatus.map((status) {
            return Container(
              margin: EdgeInsets.only(bottom: Dimensions.spacingSmall),
              padding: EdgeInsets.all(Dimensions.paddingMedium),
              decoration: BoxDecoration(
                color: ThemeColors.surface,
                borderRadius: BorderRadius.circular(Dimensions.radiusMedium),
                border: Border.all(color: ThemeColors.border),
              ),
              child: Row(
                children: [
                  Container(
                    padding: EdgeInsets.all(Dimensions.paddingSmall),
                    decoration: BoxDecoration(
                      color: ThemeColors.primary.withOpacity(0.08),
                      borderRadius: BorderRadius.circular(Dimensions.radiusSmall),
                    ),
                    child: Text(
                      '${status['count']}',
                      style: TextStyles.h3.copyWith(color: ThemeColors.primary),
                    ),
                  ),
                  SizedBox(width: Dimensions.spacingMedium),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          status['title'] as String,
                          style: TextStyles.body1.copyWith(
                            color: ThemeColors.textPrimary,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        SizedBox(height: Dimensions.spacingXSmall),
                        Text(
                          status['description'] as String,
                          style: TextStyles.caption.copyWith(color: ThemeColors.textSecondary),
                        ),
                      ],
                    ),
                  ),
                  Icon(Icons.chevron_right, color: ThemeColors.textTertiary),
                ],
              ),
            );
          }).toList(),
        ),
      ],
    );
  }

  Widget _buildTaskList() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          '今日任务',
          style: TextStyles.subtitle1.copyWith(
            color: ThemeColors.textSecondary,
          ),
        ),
        SizedBox(height: Dimensions.spacingSmall),
        Column(
          children: _todayTasks.map((task) {
            final bool isPriority = task['isPriority'] as bool;
            return Container(
              margin: EdgeInsets.only(bottom: Dimensions.spacingSmall),
              padding: EdgeInsets.all(Dimensions.paddingMedium),
              decoration: BoxDecoration(
                color: ThemeColors.surface,
                borderRadius: BorderRadius.circular(Dimensions.radiusMedium),
                border: Border.all(
                  color: isPriority ? ThemeColors.primary : ThemeColors.border,
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          task['title'] as String,
                          style: TextStyles.body1.copyWith(
                            color: ThemeColors.textPrimary,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                      if (isPriority)
                        Container(
                          padding: EdgeInsets.symmetric(
                            horizontal: Dimensions.paddingSmall,
                            vertical: Dimensions.paddingSizeExtraSmall,
                          ),
                          decoration: BoxDecoration(
                            color: ThemeColors.primary.withOpacity(0.1),
                            borderRadius: BorderRadius.circular(Dimensions.radiusLarge),
                          ),
                          child: Text(
                            '优先任务',
                            style: TextStyles.caption.copyWith(color: ThemeColors.primary),
                          ),
                        ),
                    ],
                  ),
                  SizedBox(height: Dimensions.spacingXSmall),
                  Text(
                    task['description'] as String,
                    style: TextStyles.body2.copyWith(color: ThemeColors.textSecondary),
                  ),
                  SizedBox(height: Dimensions.spacingSmall),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(Dimensions.radiusSmall),
                    child: LinearProgressIndicator(
                      value: task['progress'] as double,
                      minHeight: 6,
                      backgroundColor: ThemeColors.primary.withOpacity(0.1),
                      valueColor: AlwaysStoppedAnimation<Color>(ThemeColors.primary),
                    ),
                  ),
                  SizedBox(height: Dimensions.spacingSmall),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Row(
                        children: [
                          Icon(Icons.timer_outlined, size: 16, color: ThemeColors.textTertiary),
                          SizedBox(width: Dimensions.spacingXSmall),
                          Text(
                            task['duration'] as String,
                            style: TextStyles.caption.copyWith(color: ThemeColors.textTertiary),
                          ),
                        ],
                      ),
                      TextButton(
                        onPressed: () => _handleStartTask(task),
                        child: Text(
                          QyAppLocalizationKeys.qyListeningPlay.tr(context),
                          style: TextStyles.button.copyWith(color: ThemeColors.primary),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            );
          }).toList(),
        ),
      ],
    );
  }
}
