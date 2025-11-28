/// Word Listening Dictation main screen
/// Follows Flutter Bloom architecture: theme centralization, glassmorphism, bento box layout
library;

import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/common/theme/base/theme_animations.dart';
import 'package:qyflutter/common/widgets/cards/premium_cards.dart';
import 'package:qyflutter/common/widgets/animations/animation_utils.dart';
import 'package:qyflutter/apps/app_qy/resources_app_qy/colors_app_qy.dart';
import 'package:qyflutter/apps/app_qy/localization_app_qy/localization_keys_app_qy.dart';
import 'package:qyflutter/common/localization/localization_manager.dart';
import 'package:qyflutter/apps/app_qy/config_app_qy/storage_app_qy.dart';
import 'word_listening_dictation_practice_screen.dart';

class WordListeningDictationScreen extends StatefulWidget {
  const WordListeningDictationScreen({super.key});

  @override
  State<WordListeningDictationScreen> createState() => _WordListeningDictationScreenState();
}

class _WordListeningDictationScreenState extends State<WordListeningDictationScreen>
    with TickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _fadeAnimation;

  List<Map<String, dynamic>> get _dictationLevels => [
    {
      'title': QyAppLocalizationKeys.qyListeningDictationBeginner.tr(context),
      'subtitle': QyAppLocalizationKeys.qyListeningDictationBeginnerDesc.tr(context),
      'level': 'Beginner',
      'icon': Icons.school,
      'color': ColorsAppQy.qySecondary,
      'wordCount': 500,
      'progress': 0.3,
      'locked': false,
    },
    {
      'title': QyAppLocalizationKeys.qyListeningDictationIntermediate.tr(context),
      'subtitle': QyAppLocalizationKeys.qyListeningDictationIntermediateDesc.tr(context),
      'level': 'Intermediate',
      'icon': Icons.trending_up,
      'color': ColorsAppQy.qyAccent,
      'wordCount': 1000,
      'progress': 0.0,
      'locked': false,
    },
    {
      'title': QyAppLocalizationKeys.qyListeningDictationAdvanced.tr(context),
      'subtitle': QyAppLocalizationKeys.qyListeningDictationAdvancedDesc.tr(context),
      'level': 'Advanced',
      'icon': Icons.psychology,
      'color': ColorsAppQy.qySuccess,
      'wordCount': 1500,
      'progress': 0.0,
      'locked': false,
    },
    {
      'title': QyAppLocalizationKeys.qyListeningDictationExpert.tr(context),
      'subtitle': QyAppLocalizationKeys.qyListeningDictationExpertDesc.tr(context),
      'level': 'Expert',
      'icon': Icons.workspace_premium,
      'color': ColorsAppQy.qyInfo,
      'wordCount': 2000,
      'progress': 0.0,
      'locked': true,
    },
  ];

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      duration: Duration(milliseconds: ThemeDimensions.animationDurationNormal),
      vsync: this,
    );
    _fadeAnimation = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _controller, curve: ThemeAnimations.easeInOut),
    );
    _controller.forward();
    _loadProgress();
  }
  
  Future<void> _loadProgress() async {
    final storage = StorageAppQy.instance;
    final progress = await storage.getApp<Map<String, dynamic>>('dictation_progress');
    if (mounted && progress != null) {
      // Load progress data if needed
    }
  }
  
  Future<void> _saveProgress() async {
    final storage = StorageAppQy.instance;
    await storage.setApp<Map<String, dynamic>>('dictation_progress', {
      'lastLevel': _dictationLevels.firstWhere((l) => !(l['locked'] as bool))['level'],
    });
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: AnimatedBuilder(
        animation: _fadeAnimation,
        builder: (context, child) {
          return Container(
            decoration: BoxDecoration(
              gradient: ColorsAppQy.qyDynamicShimmerGradient(_fadeAnimation.value),
            ),
            child: SafeArea(
              child: FadeTransition(
                opacity: _fadeAnimation,
                child: SingleChildScrollView(
                  padding: EdgeInsets.all(ThemeDimensions.spacing16),
                  child: Column(
                    children: [
                      _buildAppBar(),
                      SizedBox(height: ThemeDimensions.spacing16),
                      _buildBentoBoxContent(),
                      SizedBox(height: ThemeDimensions.spacing16),
                    ],
                  ),
                ),
              ),
            ),
          );
        },
      ),
    );
  }
  
  Widget _buildBentoBoxContent() {
    return Column(
      children: [
        Row(
          children: [
            Expanded(
              flex: 2,
              child: _buildStatsHeader(),
            ),
            SizedBox(width: ThemeDimensions.spacing16),
            Expanded(
              flex: 1,
              child: _buildQuickStats(),
            ),
          ],
        ),
        SizedBox(height: ThemeDimensions.spacing16),
        _buildDictationLevels(),
        SizedBox(height: ThemeDimensions.spacing16),
        _buildBottomActions(),
      ],
    );
  }
  
  Widget _buildQuickStats() {
    return GlassCard(
      child: Padding(
        padding: EdgeInsets.all(ThemeDimensions.spacing16),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.trending_up,
              color: ColorsAppQy.qySuccess,
              size: ThemeDimensions.iconSizeL,
            ),
            SizedBox(height: ThemeDimensions.spacing8),
            Text(
              '87%',
              style: ThemeTextStyles.headlineMedium.copyWith(
                color: ColorsAppQy.qyTextPrimary,
                fontWeight: FontWeight.bold,
              ),
            ),
            SizedBox(height: ThemeDimensions.spacing4),
            Text(
              QyAppLocalizationKeys.qyListeningAccuracyRate.tr(context),
              style: ThemeTextStyles.bodySmall.copyWith(
                color: ColorsAppQy.qyTextSecondary,
              ),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
      borderRadius: ThemeDimensions.borderRadiusM,
    );
  }

  Widget _buildAppBar() {
    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: ThemeDimensions.spacing16,
        vertical: ThemeDimensions.spacing12,
      ),
      child: Row(
        children: [
          BouncingButton(
            onPressed: () => Navigator.of(context).pop(),
            child: Icon(
              Icons.arrow_back,
              color: ColorsAppQy.qyTextPrimary,
              size: ThemeDimensions.iconSizeM,
            ),
          ),
          SizedBox(width: ThemeDimensions.spacing8),
          Expanded(
            child: Text(
              QyAppLocalizationKeys.qyListeningDictationTitle.tr(context),
              style: ThemeTextStyles.headlineSmall.copyWith(
                color: ColorsAppQy.qyTextPrimary,
                fontWeight: FontWeight.bold,
              ),
              textAlign: TextAlign.center,
            ),
          ),
          SizedBox(width: ThemeDimensions.spacing8),
          BouncingButton(
            onPressed: _showHelp,
            child: Icon(
              Icons.help_outline,
              color: ColorsAppQy.qyPrimary,
              size: ThemeDimensions.iconSizeM,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStatsHeader() {
    return GlassCard(
      child: Padding(
        padding: EdgeInsets.all(ThemeDimensions.spacing20),
        child: Container(
          decoration: BoxDecoration(
            gradient: ColorsAppQy.qyPrimaryGradient,
            borderRadius: ThemeDimensions.borderRadiusM,
          ),
        child: Column(
          children: [
            Row(
              children: [
                Container(
                  padding: EdgeInsets.all(ThemeDimensions.spacing12),
                  decoration: BoxDecoration(
                    color: ColorsAppQy.qyPrimary.withOpacity(0.1),
                    borderRadius: ThemeDimensions.borderRadiusS,
                  ),
                  child: Icon(
                    Icons.headphones,
                    color: ColorsAppQy.qyPrimary,
                    size: ThemeDimensions.iconSizeL,
                  ),
                ),
                SizedBox(width: ThemeDimensions.spacing16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        QyAppLocalizationKeys.qyListeningDictationTraining.tr(context),
                        style: ThemeTextStyles.headlineSmall.copyWith(
                          color: ColorsAppQy.qyTextOnPrimary,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      SizedBox(height: ThemeDimensions.spacing4),
                      Text(
                        QyAppLocalizationKeys.qyListeningDictationTrainingDesc.tr(context),
                        style: ThemeTextStyles.bodyMedium.copyWith(
                          color: ColorsAppQy.qyTextOnPrimary.withOpacity(0.9),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            SizedBox(height: ThemeDimensions.spacing20),
            Row(
              children: [
                Expanded(
                  child: _buildStatItem(
                    QyAppLocalizationKeys.qyListeningMastered.tr(context),
                    '245',
                    Icons.check_circle,
                    ColorsAppQy.qyTextOnPrimary,
                  ),
                ),
                Container(
                  width: 1,
                  height: 40,
                  color: ColorsAppQy.qyTextOnPrimary.withOpacity(0.3),
                ),
                Expanded(
                  child: _buildStatItem(
                    QyAppLocalizationKeys.qyListeningPracticing.tr(context),
                    '128',
                    Icons.pending,
                    ColorsAppQy.qyTextOnPrimary,
                  ),
                ),
              ],
            ),
          ],
        ),
        ),
      ),
      borderRadius: ThemeDimensions.borderRadiusM,
    );
  }

  Widget _buildStatItem(String label, String value, IconData icon, Color color) {
    return Column(
      children: [
        Icon(icon, color: color, size: ThemeDimensions.iconSizeM),
        SizedBox(height: ThemeDimensions.spacing8),
        Text(
          value,
          style: ThemeTextStyles.headlineSmall.copyWith(
            color: color,
            fontWeight: FontWeight.bold,
          ),
        ),
        SizedBox(height: ThemeDimensions.spacing4),
        Text(
          label,
          style: ThemeTextStyles.bodySmall.copyWith(
            color: color.withOpacity(0.9),
          ),
        ),
      ],
    );
  }

  Widget _buildDictationLevels() {
    return Column(
      children: _dictationLevels.asMap().entries.map((entry) {
        final index = entry.key;
        final level = entry.value;
        return Padding(
          padding: EdgeInsets.only(bottom: ThemeDimensions.spacing16),
          child: AnimationUtils.fadeInWithSlide(
            _buildLevelCard(level, index),
            duration: Duration(milliseconds: ThemeDimensions.animationDurationNormal + (index * 100)),
          ),
        );
      }).toList(),
    );
  }

  Widget _buildLevelCard(Map<String, dynamic> level, int index) {
    final isLocked = level['locked'] as bool;

    return BouncingButton(
      onPressed: isLocked ? _showLockedMessage : () => _startDictation(level),
      child: GlassCard(
        child: Padding(
          padding: EdgeInsets.all(ThemeDimensions.spacing20),
          child: Column(
            children: [
              Row(
                children: [
                  Container(
                    width: 60,
                    height: 60,
                    decoration: BoxDecoration(
                      color: isLocked
                          ? Colors.grey.shade300
                          : (level['color'] as Color).withOpacity(0.1),
                      borderRadius: ThemeDimensions.borderRadiusM,
                    ),
                    child: Icon(
                      level['icon'] as IconData,
                      color: isLocked
                          ? Colors.grey.shade500
                          : level['color'] as Color,
                      size: 30,
                    ),
                  ),
                  SizedBox(width: ThemeDimensions.spacing16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          level['title'] as String,
                          style: ThemeTextStyles.headlineSmall.copyWith(
                            color: isLocked
                                ? Colors.grey.shade600
                                : ColorsAppQy.qyTextPrimary,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        SizedBox(height: ThemeDimensions.spacing4),
                        Text(
                          level['subtitle'] as String,
                          style: ThemeTextStyles.bodyMedium.copyWith(
                            color: isLocked
                                ? Colors.grey.shade500
                                : ColorsAppQy.qyTextSecondary,
                          ),
                        ),
                      ],
                    ),
                  ),
                  if (isLocked)
                    Icon(
                      Icons.lock,
                      color: Colors.grey.shade500,
                      size: 24,
                    )
                  else
                    Icon(
                      Icons.play_circle,
                      color: level['color'] as Color,
                      size: 32,
                    ),
                ],
              ),
              if (!isLocked) ...[
                SizedBox(height: ThemeDimensions.spacing16),
                Row(
                  children: [
                    Expanded(
                      child: _buildProgressIndicator(
                        level['progress'] as double,
                        level['color'] as Color,
                      ),
                    ),
                    SizedBox(width: ThemeDimensions.spacing16),
                    Text(
                      QyAppLocalizationKeys.qyListeningWordCount.tr(context).replaceAll('{count}', level['wordCount'].toString()),
                      style: ThemeTextStyles.bodyMedium.copyWith(
                        color: ColorsAppQy.qyTextSecondary,
                      ),
                    ),
                  ],
                ),
              ],
            ],
          ),
        ),
        borderRadius: ThemeDimensions.borderRadiusM,
      ),
    );
  }

  Widget _buildProgressIndicator(double progress, Color color) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              QyAppLocalizationKeys.qyListeningProgress.tr(context),
              style: ThemeTextStyles.bodySmall.copyWith(
                color: ColorsAppQy.qyTextSecondary,
              ),
            ),
            Text(
              '${(progress * 100).toInt()}%',
              style: ThemeTextStyles.bodySmall.copyWith(
                color: color,
                fontWeight: FontWeight.bold,
              ),
            ),
          ],
        ),
        SizedBox(height: ThemeDimensions.spacing8),
        Container(
          height: 8,
          decoration: BoxDecoration(
            color: ColorsAppQy.qyHolographicMedium,
            borderRadius: ThemeDimensions.borderRadiusS,
          ),
          child: FractionallySizedBox(
            alignment: Alignment.centerLeft,
            widthFactor: progress,
            child: Container(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [color, color.withOpacity(0.7)],
                ),
                borderRadius: ThemeDimensions.borderRadiusS,
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildBottomActions() {
    return Container(
      padding: EdgeInsets.all(ThemeDimensions.spacing16),
      child: BouncingButton(
        onPressed: _showDailyChallenge,
        child: Container(
          width: double.infinity,
          padding: EdgeInsets.symmetric(vertical: ThemeDimensions.spacing16),
          decoration: BoxDecoration(
            gradient: ColorsAppQy.qyAccentGradient,
            borderRadius: ThemeDimensions.borderRadiusM,
            boxShadow: [
              BoxShadow(
                color: ColorsAppQy.qyShadowLight,
                blurRadius: 12,
                offset: Offset(0, 6),
              ),
            ],
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                Icons.emoji_events,
                color: ColorsAppQy.qyTextOnPrimary,
                size: ThemeDimensions.iconSizeM,
              ),
              SizedBox(width: ThemeDimensions.spacing12),
              Text(
                QyAppLocalizationKeys.qyListeningDailyChallenge.tr(context),
                style: ThemeTextStyles.bodyLarge.copyWith(
                  color: ColorsAppQy.qyTextOnPrimary,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _startDictation(Map<String, dynamic> level) {
    _saveProgress();
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (context) => WordListeningDictationPracticeScreen(
          level: level['level'] as String,
          title: level['title'] as String,
        ),
      ),
    );
  }

  void _showLockedMessage() {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(QyAppLocalizationKeys.qyListeningUnlockAfterCurrentLevel.tr(context)),
        backgroundColor: ColorsAppQy.qyWarning,
      ),
    );
  }

  void _showHelp() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20),
        ),
        title: Text(
          QyAppLocalizationKeys.qyListeningDictationHelp.tr(context),
          style: ThemeTextStyles.headlineSmall.copyWith(
            color: ColorsAppQy.qyTextPrimary,
          ),
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              QyAppLocalizationKeys.qyListeningHelpHowToPractice.tr(context),
              style: ThemeTextStyles.bodyLarge.copyWith(
                fontWeight: FontWeight.bold,
                color: ColorsAppQy.qyTextPrimary,
              ),
            ),
            SizedBox(height: ThemeDimensions.spacing8),
            Text(
              QyAppLocalizationKeys.qyListeningHelpPracticeSteps.tr(context),
              style: ThemeTextStyles.bodyMedium.copyWith(
                color: ColorsAppQy.qyTextSecondary,
              ),
            ),
            SizedBox(height: ThemeDimensions.spacing16),
            Text(
              QyAppLocalizationKeys.qyListeningHelpTips.tr(context),
              style: ThemeTextStyles.bodyLarge.copyWith(
                fontWeight: FontWeight.bold,
                color: ColorsAppQy.qyTextPrimary,
              ),
            ),
            SizedBox(height: ThemeDimensions.spacing8),
            Text(
              QyAppLocalizationKeys.qyListeningHelpTipsContent.tr(context),
              style: ThemeTextStyles.bodyMedium.copyWith(
                color: ColorsAppQy.qyTextSecondary,
              ),
            ),
          ],
        ),
        actions: [
          BouncingButton(
            onPressed: () => Navigator.of(context).pop(),
            child: Container(
              padding: EdgeInsets.symmetric(
                horizontal: ThemeDimensions.spacing24,
                vertical: ThemeDimensions.spacing12,
              ),
              decoration: BoxDecoration(
                gradient: ColorsAppQy.qyPrimaryGradient,
                borderRadius: ThemeDimensions.borderRadiusS,
              ),
              child: Text(
                QyAppLocalizationKeys.qyCommonGotIt.tr(context),
                style: ThemeTextStyles.bodyLarge.copyWith(
                  color: ColorsAppQy.qyTextOnPrimary,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  void _showDailyChallenge() {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(QyAppLocalizationKeys.qyListeningDailyChallengeInDev.tr(context)),
        backgroundColor: ColorsAppQy.qyPrimary,
      ),
    );
  }
}