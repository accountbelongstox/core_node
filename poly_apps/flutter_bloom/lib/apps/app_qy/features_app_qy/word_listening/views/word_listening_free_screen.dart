/// Word Listening Free Mode screen
/// Follows Flutter Bloom architecture: theme centralization, glassmorphism, bento box layout
library;

import 'dart:async';
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
import '../models/word_category_model.dart';
import '../data/word_category_data.dart';

class WordListeningFreeScreen extends StatefulWidget {
  const WordListeningFreeScreen({super.key});

  @override
  State<WordListeningFreeScreen> createState() => _WordListeningFreeScreenState();
}

class _WordListeningFreeScreenState extends State<WordListeningFreeScreen>
    with TickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _fadeAnimation;

  List<WordCategoryModel> get _wordCategories => WordCategoryData.getFreeListeningCategories();

  String _selectedCategory = '';
  bool _isPlaying = false;
  int _currentSpeed = 1; // 0: slow, 1: normal, 2: fast
  int _listeningTime = 0;
  Timer? _timer;

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
    _loadSettings();
  }
  
  Future<void> _loadSettings() async {
    final storage = StorageAppQy.instance;
    final speed = await storage.getApp<int>('free_listening_speed');
    final listeningTime = await storage.getApp<int>('free_listening_time');
    if (mounted) {
      setState(() {
        _currentSpeed = speed ?? 1;
        _listeningTime = listeningTime ?? 0;
      });
    }
  }
  
  Future<void> _saveSettings() async {
    final storage = StorageAppQy.instance;
    await storage.setApp<int>('free_listening_speed', _currentSpeed);
    await storage.setApp<int>('free_listening_time', _listeningTime);
  }

  @override
  void dispose() {
    _controller.dispose();
    _timer?.cancel();
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
              child: _buildSpeedSelector(),
            ),
            SizedBox(width: ThemeDimensions.spacing16),
            Expanded(
              flex: 1,
              child: _buildStatsHeader(),
            ),
          ],
        ),
        SizedBox(height: ThemeDimensions.spacing16),
        _buildWordCategories(),
        SizedBox(height: ThemeDimensions.spacing16),
        _buildCurrentWord(),
      ],
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
              size: 24,
            ),
          ),
          Expanded(
            child: Column(
              children: [
                Text(
                  QyAppLocalizationKeys.qyListeningFreeTitle.tr(context),
                  style: ThemeTextStyles.headlineSmall.copyWith(
                    color: ColorsAppQy.qyTextPrimary,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                Text(
                  QyAppLocalizationKeys.qyListeningFreeDesc.tr(context),
                  style: ThemeTextStyles.bodyMedium.copyWith(
                    color: ColorsAppQy.qyTextSecondary,
                  ),
                ),
              ],
            ),
          ),
          BouncingButton(
            onPressed: _showListeningStats,
            child: Icon(
              Icons.analytics,
              color: ColorsAppQy.qyPrimary,
              size: 24,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSpeedSelector() {
    return GlassCard(
      child: Padding(
        padding: EdgeInsets.all(ThemeDimensions.spacing16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              QyAppLocalizationKeys.qyListeningSpeed.tr(context),
              style: ThemeTextStyles.headlineSmall.copyWith(
                color: ColorsAppQy.qyTextPrimary,
                fontWeight: FontWeight.bold,
              ),
            ),
            SizedBox(height: ThemeDimensions.spacing12),
            Row(
              children: [
                Expanded(
                  child: _buildSpeedButton(0, QyAppLocalizationKeys.qyListeningSpeedSlow.tr(context), Icons.slow_motion_video, ColorsAppQy.qySecondary),
                ),
                SizedBox(width: ThemeDimensions.spacing8),
                Expanded(
                  child: _buildSpeedButton(1, QyAppLocalizationKeys.qyListeningSpeedNormal.tr(context), Icons.play_arrow, ColorsAppQy.qyPrimary),
                ),
                SizedBox(width: ThemeDimensions.spacing8),
                Expanded(
                  child: _buildSpeedButton(2, QyAppLocalizationKeys.qyListeningSpeedFast.tr(context), Icons.fast_forward, ColorsAppQy.qyAccent),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSpeedButton(int speed, String label, IconData icon, Color color) {
    final isSelected = _currentSpeed == speed;

    return BouncingButton(
      onPressed: () {
        setState(() => _currentSpeed = speed);
        _saveSettings();
      },
      child: Container(
        padding: EdgeInsets.symmetric(vertical: ThemeDimensions.spacing12),
        decoration: BoxDecoration(
          gradient: isSelected
              ? LinearGradient(
                  colors: [color, color.withOpacity(0.7)],
                )
              : null,
          color: isSelected ? null : ColorsAppQy.qyTextOnPrimary,
          borderRadius: ThemeDimensions.borderRadiusS,
          border: Border.all(
            color: isSelected ? color : ColorsAppQy.qyBorderLight,
            width: isSelected ? 0 : 2,
          ),
        ),
        child: Column(
          children: [
            Icon(
              icon,
              color: isSelected ? ColorsAppQy.qyTextOnPrimary : color,
              size: 24,
            ),
            const SizedBox(height: 4),
            Text(
              label,
              style: ThemeTextStyles.bodyMedium.copyWith(
                color: isSelected ? ColorsAppQy.qyTextOnPrimary : color,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStatsHeader() {
    return Container(
      margin: EdgeInsets.symmetric(horizontal: ThemeDimensions.spacing16),
      child: GlassCard(
        child: Padding(
          padding: EdgeInsets.all(ThemeDimensions.spacing16),
          child: Container(
            decoration: BoxDecoration(
              gradient: ColorsAppQy.qyPrimaryGradient,
              borderRadius: ThemeDimensions.borderRadiusM,
            ),
            child: Row(
              children: [
                Expanded(
            child: _buildStatItem(
              QyAppLocalizationKeys.qyListeningTodayListening.tr(context),
              '${(_listeningTime / 60).toInt()} ${QyAppLocalizationKeys.qyListeningMinutes.tr(context)}',
              Icons.access_time,
              ColorsAppQy.qyTextOnPrimary,
                ),
              ),
              Container(
                width: 1,
                height: 40,
                color: ColorsAppQy.qyFrostMedium,
              ),
              Expanded(
                child: _buildStatItem(
                  QyAppLocalizationKeys.qyListeningLearnedWords.tr(context),
                  '89',
                  Icons.headphones,
                  ColorsAppQy.qyTextOnPrimary,
                ),
              ),
              Container(
                width: 1,
                height: 40,
                color: ColorsAppQy.qyFrostMedium,
              ),
              Expanded(
                child: _buildStatItem(
                  QyAppLocalizationKeys.qyListeningStreakDays.tr(context),
                  '7 ${QyAppLocalizationKeys.qyListeningDays.tr(context)}',
                  Icons.local_fire_department,
                  ColorsAppQy.qyTextOnPrimary,
                ),
              ),
              ],
            ),
          ),
        ),
        borderRadius: ThemeDimensions.borderRadiusM,
      ),
    );
  }

  Widget _buildStatItem(String label, String value, IconData icon, Color color) {
    return Column(
      children: [
        Icon(icon, color: color, size: 24),
        const SizedBox(height: 8),
        Text(
          value,
          style: ThemeTextStyles.bodyLarge.copyWith(
            color: color,
            fontWeight: FontWeight.bold,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          label,
              style: ThemeTextStyles.bodySmall.copyWith(
            color: color.withOpacity(0.9),
          ),
        ),
      ],
    );
  }

  Widget _buildWordCategories() {
    return ListView.builder(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      itemCount: _wordCategories.length,
      itemBuilder: (context, index) {
        final category = _wordCategories[index];
        return AnimationUtils.staggeredAnimation(
          index: index,
          child: Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: BouncingButton(
              onPressed: () => _selectCategory(category),
              child: GlassCard(
                child: Padding(
                  padding: EdgeInsets.all(ThemeDimensions.spacing20),
                  child: Row(
                    children: [
                      Container(
                        width: 50,
                        height: 50,
                        decoration: BoxDecoration(
                          color: category.color.withOpacity(0.1),
                          borderRadius: ThemeDimensions.borderRadiusS,
                        ),
                        child: Icon(
                          category.icon,
                          color: category.color,
                          size: 28,
                        ),
                      ),
                      const SizedBox(width: 16),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              category.titleKey.tr(context),
                              style: ThemeTextStyles.headlineSmall.copyWith(
                                color: ColorsAppQy.qyTextPrimary,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              category.subtitleKey.tr(context),
                              style: ThemeTextStyles.bodyMedium.copyWith(
                                color: ColorsAppQy.qyTextSecondary,
                              ),
                            ),
                          ],
                        ),
                      ),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          Text(
                            '${category.count} ${QyAppLocalizationKeys.qyWords.tr(context)}',
                            style: ThemeTextStyles.bodyMedium.copyWith(
                              color: category.color,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          const SizedBox(height: 8),
                          Icon(
                            Icons.play_circle,
                            color: category.color,
                            size: 24,
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                borderRadius: ThemeDimensions.borderRadiusM,
              ),
            ),
          ),
        );
      },
    );
  }

  Widget _buildCurrentWord() {
    if (_selectedCategory.isEmpty) {
      return GlassCard(
        child: Padding(
          padding: EdgeInsets.all(ThemeDimensions.spacing24),
          child: Column(
          children: [
            Icon(
              Icons.category,
              color: ColorsAppQy.qyTextSecondary,
              size: 48,
            ),
            const SizedBox(height: 16),
            Text(
              QyAppLocalizationKeys.qyListeningSelectCategory.tr(context),
              style: ThemeTextStyles.bodyLarge.copyWith(
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

    return GlassCard(
      child: Padding(
        padding: EdgeInsets.all(ThemeDimensions.spacing20),
        child: Container(
          padding: EdgeInsets.all(ThemeDimensions.spacing20),
          decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(20),
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              ColorsAppQy.qyFrostWhite,
              ColorsAppQy.qyFrostMedium,
            ],
          ),
        ),
        child: Column(
          children: [
            Text(
              QyAppLocalizationKeys.qyListeningCurrentWord.tr(context),
              style: ThemeTextStyles.bodyMedium.copyWith(
                color: ColorsAppQy.qyTextSecondary,
              ),
            ),
            SizedBox(height: ThemeDimensions.spacing12),
            Text(
              'Hello World',
              style: ThemeTextStyles.headlineMedium.copyWith(
                color: ColorsAppQy.qyPrimary,
                fontWeight: FontWeight.bold,
              ),
            ),
            SizedBox(height: ThemeDimensions.spacing12),
            Text(
              QyAppLocalizationKeys.qyListeningExampleText.tr(context),
              style: ThemeTextStyles.bodyLarge.copyWith(
                color: ColorsAppQy.qyTextPrimary,
              ),
            ),
            const SizedBox(height: 20),
            Row(
              children: [
                Expanded(
                  child: BouncingButton(
                    onPressed: _playCurrentWord,
                    child: Container(
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      decoration: BoxDecoration(
                        gradient: ColorsAppQy.qyPrimaryGradient,
                        borderRadius: BorderRadius.circular(16),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(
                            _isPlaying ? Icons.stop : Icons.play_arrow,
                            color: ColorsAppQy.qyTextOnPrimary,
                            size: 24,
                          ),
                          SizedBox(width: ThemeDimensions.spacing8),
                          Text(
                            _isPlaying ? QyAppLocalizationKeys.qyListeningStop.tr(context) : QyAppLocalizationKeys.qyListeningPlay.tr(context),
                            style: ThemeTextStyles.bodyLarge.copyWith(
                  color: ColorsAppQy.qyTextOnPrimary,
                  fontWeight: FontWeight.bold,
                ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                BouncingButton(
                  onPressed: _nextWord,
                  child: Container(
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    decoration: BoxDecoration(
                      color: ColorsAppQy.qyTextOnPrimary,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(
                        color: ColorsAppQy.qyPrimary,
                        width: 2,
                      ),
                    ),
                    child: Icon(
                      Icons.skip_next,
                      color: ColorsAppQy.qyPrimary,
                      size: 24,
                    ),
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

  void _selectCategory(WordCategoryModel category) {
    setState(() {
      _selectedCategory = category.titleKey.tr(context);
    });
    _startListening();
  }

  void _startListening() {
    _timer?.cancel();
    _timer = Timer.periodic(const Duration(seconds: 1), (timer) {
      setState(() {
        _listeningTime++;
      });
    });
  }

  void _playCurrentWord() {
    setState(() {
      _isPlaying = !_isPlaying;
    });

    if (_isPlaying && _timer == null) {
      _startListening();
    }

    // Simulate audio playing
    Future.delayed(const Duration(seconds: 2), () {
      if (mounted && _isPlaying) {
        setState(() {
          _isPlaying = false;
        });
      }
    });
  }

  void _nextWord() {
    // Simulate getting next word
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(QyAppLocalizationKeys.qyListeningNextWordTip.tr(context)),
                backgroundColor: ColorsAppQy.qyPrimary,
      ),
    );
  }

  void _showListeningStats() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20),
        ),
        title: Text(
          QyAppLocalizationKeys.qyListeningStats.tr(context),
          style: ThemeTextStyles.headlineSmall.copyWith(
            color: ColorsAppQy.qyTextPrimary,
          ),
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            _buildStatsRow(QyAppLocalizationKeys.qyListeningTodayPractice.tr(context), '${(_listeningTime / 60).toInt()} ${QyAppLocalizationKeys.qyListeningMinutes.tr(context)}'),
            _buildStatsRow(QyAppLocalizationKeys.qyListeningWeekPractice.tr(context), '245 ${QyAppLocalizationKeys.qyListeningMinutes.tr(context)}'),
            _buildStatsRow(QyAppLocalizationKeys.qyListeningTotalTime.tr(context), '1,234 ${QyAppLocalizationKeys.qyListeningMinutes.tr(context)}'),
            _buildStatsRow(QyAppLocalizationKeys.qyListeningContinuousDays.tr(context), '7 ${QyAppLocalizationKeys.qyListeningDays.tr(context)}'),
            _buildStatsRow(QyAppLocalizationKeys.qyListeningDailyAverage.tr(context), '176 ${QyAppLocalizationKeys.qyListeningMinutes.tr(context)}'),
          ],
        ),
        actions: [
          BouncingButton(
            onPressed: () => Navigator.of(context).pop(),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
              decoration: BoxDecoration(
                color: ColorsAppQy.qyPrimary,
                borderRadius: ThemeDimensions.borderRadiusS,
              ),
              child: Text(
                QyAppLocalizationKeys.qyClose.tr(context),
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

  Widget _buildStatsRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: ThemeTextStyles.bodyMedium.copyWith(
              color: ColorsAppQy.qyTextSecondary,
            ),
          ),
          Text(
            value,
            style: ThemeTextStyles.bodyMedium.copyWith(
              color: ColorsAppQy.qyTextPrimary,
              fontWeight: FontWeight.bold,
            ),
          ),
        ],
      ),
    );
  }
}