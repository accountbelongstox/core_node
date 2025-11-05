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

/// Word Listening Screen for QY App
library;

import 'package:flutter/material.dart';
import '../../../../../../common/theme/base/theme_colors.dart';
import '../../../../../../common/theme/base/theme_dimensions.dart';
import '../../../../../../common/theme/base/theme_text_styles.dart';
import '../../../../../../common/localization/localization_manager.dart';
import '../../../localization_app_qy/localization_keys_app_qy.dart';

class WordListeningScreenAppQy extends StatefulWidget {
  const WordListeningScreenAppQy({super.key});

  @override
  State<WordListeningScreenAppQy> createState() => _WordListeningScreenAppQyState();
}

class _WordListeningScreenAppQyState extends State<WordListeningScreenAppQy> {
  final List<Map<String, dynamic>> _filters;
  final List<Map<String, dynamic>> _summaryStats;
  final List<Map<String, dynamic>> _wordProgress;
  final List<Map<String, dynamic>> _playlistItems;
  int _selectedFilterIndex;
  bool _isLoopingEnabled;
  double _playbackSpeed;

  _WordListeningScreenAppQyState()
      : _filters = [
          {'title': '单词书', 'subtitle': '200 词'},
          {'title': '生词本', 'subtitle': '27 词'},
          {'title': '今日新词', 'subtitle': '27 词'},
          {'title': '今日复习', 'subtitle': '45 词'},
        ],
        _summaryStats = [
          {'title': '已听词汇', 'value': '200', 'description': 'Word Book'},
          {'title': '今日进度', 'value': '84%', 'description': 'Progress'},
          {'title': '连续天数', 'value': '12', 'description': 'Streak'},
          {'title': '本周时长', 'value': '145 min', 'description': 'Listening'},
        ],
        _wordProgress = [
          {'title': '全书词表', 'value': '16952', 'progress': 0.78, 'tag': '全部'},
          {'title': '全书未学', 'value': '16925', 'progress': 0.62, 'tag': '未学'},
          {'title': '全书在学', 'value': '27', 'progress': 0.35, 'tag': '在学'},
          {'title': '全书简单词', 'value': '200', 'progress': 0.18, 'tag': '易记'},
        ],
        _playlistItems = [
          {
            'title': '今日新词播放列表',
            'description': '循环播放今日新词，巩固发音与拼写',
            'duration': '12 min',
            'words': 18,
            'icon': Icons.headphones,
            'isActive': true,
          },
          {
            'title': '生词本 AI 讲解',
            'description': 'AI 语音讲解难点词汇，支持慢速播放',
            'duration': '18 min',
            'words': 24,
            'icon': Icons.psychology_alt_outlined,
            'isActive': false,
          },
          {
            'title': 'COCA 高频词强化',
            'description': '精选 3000 高频词，强化听力与拼写同步',
            'duration': '25 min',
            'words': 32,
            'icon': Icons.trending_up,
            'isActive': false,
          },
        ],
        _selectedFilterIndex = 0,
        _isLoopingEnabled = true,
        _playbackSpeed = 1.0;

  void _handleFilterChange(int index) {
    setState(() {
      _selectedFilterIndex = index;
    });
  }

  void _toggleLooping(bool value) {
    setState(() {
      _isLoopingEnabled = value;
    });
  }

  void _handleSpeedChange(double value) {
    setState(() {
      _playbackSpeed = value;
    });
  }

  void _handlePlaylistTap(Map<String, dynamic> playlist) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('${playlist['title']} ${QyAppLocalizationKeys.qyListeningPracticing.tr(context)}'),
      ),
    );
  }

  void _handleHistoryTap() {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(QyAppLocalizationKeys.qyListeningTodayPractice.tr(context)),
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
            onPressed: _handleHistoryTap,
            icon: Icon(
              Icons.history_outlined,
              color: ThemeColors.textSecondary,
            ),
          ),
        ],
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: EdgeInsets.all(Dimensions.paddingMedium),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _buildHeaderCard(),
              SizedBox(height: Dimensions.spacingMedium),
              _buildQuickFilters(),
              SizedBox(height: Dimensions.spacingMedium),
              _buildSummaryGrid(),
              SizedBox(height: Dimensions.spacingMedium),
              _buildListeningControls(),
              SizedBox(height: Dimensions.spacingMedium),
              _buildProgressSection(),
              SizedBox(height: Dimensions.spacingMedium),
              _buildPlaylistSection(),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildHeaderCard() {
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
        boxShadow: [
          BoxShadow(
            color: ThemeColors.shadow.withOpacity(0.15),
            blurRadius: 18,
            offset: const Offset(0, 8),
          ),
        ],
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
          SizedBox(height: Dimensions.spacingSmall),
          Text(
            QyAppLocalizationKeys.qyListeningSelectCategory.tr(context),
            style: TextStyles.body1.copyWith(
              color: Colors.white70,
            ),
          ),
          SizedBox(height: Dimensions.spacingLarge),
          Row(
            children: [
              _buildHeaderMetric('今日新词', '27'),
              SizedBox(width: Dimensions.spacingMedium),
              _buildHeaderMetric('连续天数', '12'),
              SizedBox(width: Dimensions.spacingMedium),
              _buildHeaderMetric('听力时长', '45m'),
            ],
          ),
          SizedBox(height: Dimensions.spacingMedium),
          Row(
            children: [
              Expanded(
                child: ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.white,
                    foregroundColor: ThemeColors.primary,
                    padding: EdgeInsets.symmetric(vertical: Dimensions.paddingSmall),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(Dimensions.radiusMedium),
                    ),
                  ),
                  onPressed: () => _handlePlaylistTap(_playlistItems.first),
                  child: Text(
                    QyAppLocalizationKeys.qyListeningPlay.tr(context),
                  ),
                ),
              ),
              SizedBox(width: Dimensions.spacingSmall),
              OutlinedButton(
                style: OutlinedButton.styleFrom(
                  foregroundColor: Colors.white,
                  side: const BorderSide(color: Colors.white70),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(Dimensions.radiusMedium),
                  ),
                ),
                onPressed: _handleHistoryTap,
                child: Text(
                  QyAppLocalizationKeys.qyListeningStats.tr(context),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildHeaderMetric(String label, String value) {
    return Expanded(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            value,
            style: TextStyles.h2.copyWith(
              color: Colors.white,
            ),
          ),
          SizedBox(height: Dimensions.spacingXSmall),
          Text(
            label,
            style: TextStyles.caption.copyWith(color: Colors.white70),
          ),
        ],
      ),
    );
  }

  Widget _buildQuickFilters() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          '学习范围',
          style: TextStyles.subtitle1.copyWith(color: ThemeColors.textSecondary),
        ),
        SizedBox(height: Dimensions.spacingSmall),
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(
            children: List.generate(_filters.length, (index) {
              final filter = _filters[index];
              final bool isSelected = _selectedFilterIndex == index;
              return GestureDetector(
                onTap: () => _handleFilterChange(index),
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
                        filter['title'] as String,
                        style: TextStyles.body1.copyWith(
                          color: isSelected ? ThemeColors.primary : ThemeColors.textPrimary,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      SizedBox(height: Dimensions.spacingXSmall),
                      Text(
                        filter['subtitle'] as String,
                        style: TextStyles.caption.copyWith(
                          color: ThemeColors.textSecondary,
                        ),
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

  Widget _buildSummaryGrid() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          '听力进度',
          style: TextStyles.subtitle1.copyWith(color: ThemeColors.textSecondary),
        ),
        SizedBox(height: Dimensions.spacingSmall),
        GridView.builder(
          shrinkWrap: true,
          itemCount: _summaryStats.length,
          physics: const NeverScrollableScrollPhysics(),
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 2,
            mainAxisSpacing: 12,
            crossAxisSpacing: 12,
            childAspectRatio: 1.4,
          ),
          itemBuilder: (context, index) {
            final stat = _summaryStats[index];
            return Container(
              padding: EdgeInsets.all(Dimensions.paddingMedium),
              decoration: BoxDecoration(
                color: ThemeColors.surface,
                borderRadius: BorderRadius.circular(Dimensions.radiusMedium),
                border: Border.all(color: ThemeColors.border),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    stat['title'] as String,
                    style: TextStyles.caption.copyWith(color: ThemeColors.textSecondary),
                  ),
                  SizedBox(height: Dimensions.spacingSmall),
                  Text(
                    stat['value'] as String,
                    style: TextStyles.h2.copyWith(
                      color: ThemeColors.textPrimary,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const Spacer(),
                  Text(
                    stat['description'] as String,
                    style: TextStyles.caption.copyWith(color: ThemeColors.textTertiary),
                  ),
                ],
              ),
            );
          },
        ),
      ],
    );
  }

  Widget _buildListeningControls() {
    return Container(
      width: double.infinity,
      padding: EdgeInsets.all(Dimensions.paddingMedium),
      decoration: BoxDecoration(
        color: ThemeColors.surface,
        borderRadius: BorderRadius.circular(Dimensions.radiusLarge),
        border: Border.all(color: ThemeColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  '播放设置',
                  style: TextStyles.subtitle1.copyWith(
                    color: ThemeColors.textPrimary,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
              Switch(
                value: _isLoopingEnabled,
                activeColor: ThemeColors.primary,
                onChanged: _toggleLooping,
              ),
              Text(
                _isLoopingEnabled
                    ? QyAppLocalizationKeys.qyListeningLoop.tr(context)
                    : QyAppLocalizationKeys.qyListeningOff.tr(context),
                style: TextStyles.caption.copyWith(color: ThemeColors.textSecondary),
              ),
            ],
          ),
          SizedBox(height: Dimensions.spacingMedium),
          Text(
            QyAppLocalizationKeys.qyListeningSpeed.tr(context),
            style: TextStyles.body1.copyWith(color: ThemeColors.textSecondary),
          ),
          Slider(
            value: _playbackSpeed,
            min: 0.75,
            max: 1.25,
            onChanged: _handleSpeedChange,
            activeColor: ThemeColors.primary,
            inactiveColor: ThemeColors.primary.withOpacity(0.2),
          ),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: const [
              Text('0.75x'),
              Text('1.0x'),
              Text('1.25x'),
            ],
          ),
          SizedBox(height: Dimensions.spacingMedium),
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () => _handlePlaylistTap(_playlistItems.first),
                  icon: const Icon(Icons.play_arrow),
                  label: Text(QyAppLocalizationKeys.qyListeningPlay.tr(context)),
                ),
              ),
              SizedBox(width: Dimensions.spacingSmall),
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () => _handlePlaylistTap(_playlistItems.first),
                  icon: const Icon(Icons.favorite_border),
                  label: Text(QyAppLocalizationKeys.qyListeningAddToVocab.tr(context)),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildProgressSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          '词书进度',
          style: TextStyles.subtitle1.copyWith(color: ThemeColors.textSecondary),
        ),
        SizedBox(height: Dimensions.spacingSmall),
        Column(
          children: _wordProgress.map((stat) {
            return Container(
              margin: EdgeInsets.only(bottom: Dimensions.spacingSmall),
              padding: EdgeInsets.all(Dimensions.paddingMedium),
              decoration: BoxDecoration(
                color: ThemeColors.surface,
                borderRadius: BorderRadius.circular(Dimensions.radiusMedium),
                border: Border.all(color: ThemeColors.border),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          stat['title'] as String,
                          style: TextStyles.body1.copyWith(
                            color: ThemeColors.textPrimary,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                      _buildTag(stat['tag'] as String),
                    ],
                  ),
                  SizedBox(height: Dimensions.spacingSmall),
                  Text(
                    stat['value'] as String,
                    style: TextStyles.h2.copyWith(
                      color: ThemeColors.textPrimary,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  SizedBox(height: Dimensions.spacingSmall),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(Dimensions.radiusSmall),
                    child: LinearProgressIndicator(
                      value: stat['progress'] as double,
                      minHeight: 6,
                      backgroundColor: ThemeColors.primary.withOpacity(0.1),
                      valueColor: AlwaysStoppedAnimation<Color>(ThemeColors.primary),
                    ),
                  ),
                ],
              ),
            );
          }).toList(),
        ),
      ],
    );
  }

  Widget _buildPlaylistSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          QyAppLocalizationKeys.qyListeningPlaylist.tr(context),
          style: TextStyles.subtitle1.copyWith(color: ThemeColors.textSecondary),
        ),
        SizedBox(height: Dimensions.spacingSmall),
        Column(
          children: _playlistItems.map((playlist) {
            final bool isActive = playlist['isActive'] as bool;
            return Container(
              margin: EdgeInsets.only(bottom: Dimensions.spacingSmall),
              padding: EdgeInsets.all(Dimensions.paddingMedium),
              decoration: BoxDecoration(
                color: ThemeColors.surface,
                borderRadius: BorderRadius.circular(Dimensions.radiusMedium),
                border: Border.all(
                  color: isActive ? ThemeColors.primary : ThemeColors.border,
                ),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    padding: EdgeInsets.all(Dimensions.paddingSmall),
                    decoration: BoxDecoration(
                      color: ThemeColors.primary.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(Dimensions.radiusSmall),
                    ),
                    child: Icon(
                      playlist['icon'] as IconData,
                      color: ThemeColors.primary,
                    ),
                  ),
                  SizedBox(width: Dimensions.spacingMedium),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Expanded(
                              child: Text(
                                playlist['title'] as String,
                                style: TextStyles.body1.copyWith(
                                  color: ThemeColors.textPrimary,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ),
                            if (isActive) _buildTag('进行中'),
                          ],
                        ),
                        SizedBox(height: Dimensions.spacingXSmall),
                        Text(
                          playlist['description'] as String,
                          style: TextStyles.body2.copyWith(color: ThemeColors.textSecondary),
                        ),
                        SizedBox(height: Dimensions.spacingSmall),
                        Row(
                          children: [
                            Icon(Icons.access_time, size: 16, color: ThemeColors.textTertiary),
                            SizedBox(width: Dimensions.spacingXSmall),
                            Text(
                              playlist['duration'] as String,
                              style: TextStyles.caption.copyWith(color: ThemeColors.textTertiary),
                            ),
                            SizedBox(width: Dimensions.spacingMedium),
                            Icon(Icons.library_books_outlined, size: 16, color: ThemeColors.textTertiary),
                            SizedBox(width: Dimensions.spacingXSmall),
                            Text(
                              '${playlist['words']} ${QyAppLocalizationKeys.qyWords.tr(context)}',
                              style: TextStyles.caption.copyWith(color: ThemeColors.textTertiary),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                  SizedBox(width: Dimensions.spacingSmall),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      TextButton(
                        onPressed: () => _handlePlaylistTap(playlist),
                        child: Text(
                          QyAppLocalizationKeys.qyListeningPlay.tr(context),
                          style: TextStyles.button.copyWith(color: ThemeColors.primary),
                        ),
                      ),
                      Text(
                        isActive ? QyAppLocalizationKeys.qyListeningPracticing.tr(context) : '',
                        style: TextStyles.caption.copyWith(color: ThemeColors.primary),
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

  Widget _buildTag(String text) {
    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: Dimensions.paddingSmall,
        vertical: Dimensions.paddingSizeExtraSmall,
      ),
      decoration: BoxDecoration(
        color: ThemeColors.primary.withOpacity(0.1),
        borderRadius: BorderRadius.circular(Dimensions.radiusRound),
      ),
      child: Text(
        text,
        style: TextStyles.caption.copyWith(
          color: ThemeColors.primary,
        ),
      ),
    );
  }
}
