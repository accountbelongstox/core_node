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

class WordListeningFreeScreen extends StatefulWidget {
  const WordListeningFreeScreen({super.key});

  @override
  State<WordListeningFreeScreen> createState() => _WordListeningFreeScreenState();
}

class _WordListeningFreeScreenState extends State<WordListeningFreeScreen>
    with TickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _fadeAnimation;

  List<Map<String, dynamic>> get _wordCategories => [
    {
      'title': QyAppLocalizationKeys.qyListeningCategoryDaily.tr(context),
      'subtitle': QyAppLocalizationKeys.qyListeningCategoryDailyDesc.tr(context),
      'icon': Icons.home,
      'color': ColorsAppQy.qyPrimary,
      'count': 1200,
      'locked': false,
    },
    {
      'title': QyAppLocalizationKeys.qyListeningCategoryBusiness.tr(context),
      'subtitle': QyAppLocalizationKeys.qyListeningCategoryBusinessDesc.tr(context),
      'icon': Icons.business,
      'color': ColorsAppQy.qySecondary,
      'count': 800,
      'locked': false,
    },
    {
      'title': QyAppLocalizationKeys.qyListeningCategoryAcademic.tr(context),
      'subtitle': QyAppLocalizationKeys.qyListeningCategoryAcademicDesc.tr(context),
      'icon': Icons.school,
      'color': ColorsAppQy.qyAccent,
      'count': 600,
      'locked': false,
    },
    {
      'title': QyAppLocalizationKeys.qyListeningCategoryTravel.tr(context),
      'subtitle': QyAppLocalizationKeys.qyListeningCategoryTravelDesc.tr(context),
      'icon': Icons.flight,
      'color': ColorsAppQy.qySuccess,
      'count': 400,
      'locked': false,
    },
    {
      'title': QyAppLocalizationKeys.qyListeningCategoryTech.tr(context),
      'subtitle': QyAppLocalizationKeys.qyListeningCategoryTechDesc.tr(context),
      'icon': Icons.computer,
      'color': ColorsAppQy.qyInfo,
      'count': 500,
      'locked': false,
    },
    {
      'title': QyAppLocalizationKeys.qyListeningCategoryMedical.tr(context),
      'subtitle': QyAppLocalizationKeys.qyListeningCategoryMedicalDesc.tr(context),
      'icon': Icons.local_hospital,
      'color': ColorsAppQy.qyWarning,
      'count': 300,
      'locked': false,
    },
  ];

  String _selectedCategory = '';
  bool _isPlaying = false;
  int _currentSpeed = 1; // 0: 慢速, 1: 正常, 2: 快速
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
          color: isSelected ? null : Colors.white,
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
              color: isSelected ? Colors.white : color,
              size: 24,
            ),
            const SizedBox(height: 4),
            Text(
              label,
              style: ThemeTextStyles.bodyMedium.copyWith(
                color: isSelected ? Colors.white : color,
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
              '${(_listeningTime / 60).toInt()} 分钟',
              Icons.access_time,
              Colors.white,
                ),
              ),
              Container(
                width: 1,
                height: 40,
                color: Colors.white.withOpacity(0.3),
              ),
              Expanded(
                child: _buildStatItem(
                  QyAppLocalizationKeys.qyListeningLearnedWords.tr(context),
                  '89',
                  Icons.headphones,
                  Colors.white,
                ),
              ),
              Container(
                width: 1,
                height: 40,
                color: Colors.white.withOpacity(0.3),
              ),
              Expanded(
                child: _buildStatItem(
                  QyAppLocalizationKeys.qyListeningStreakDays.tr(context),
                  '7 天',
                  Icons.local_fire_department,
                  Colors.white,
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
                          color: (category['color'] as Color).withOpacity(0.1),
                          borderRadius: ThemeDimensions.borderRadiusS,
                        ),
                        child: Icon(
                          category['icon'] as IconData,
                          color: category['color'] as Color,
                          size: 28,
                        ),
                      ),
                      const SizedBox(width: 16),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              category['title'] as String,
                              style: ThemeTextStyles.headlineSmall.copyWith(
                                color: ColorsAppQy.qyTextPrimary,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              category['subtitle'] as String,
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
                            '${category['count']} 词',
                            style: ThemeTextStyles.bodyMedium.copyWith(
                              color: category['color'] as Color,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          const SizedBox(height: 8),
                          Icon(
                            Icons.play_circle,
                            color: category['color'] as Color,
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
              Colors.white.withOpacity(0.9),
              Colors.white.withOpacity(0.7),
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
              '你好，世界',
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
                            color: Colors.white,
                            size: 24,
                          ),
                          SizedBox(width: ThemeDimensions.spacing8),
                          Text(
                            _isPlaying ? QyAppLocalizationKeys.qyListeningStop.tr(context) : QyAppLocalizationKeys.qyListeningPlay.tr(context),
                            style: ThemeTextStyles.bodyLarge.copyWith(
                  color: Colors.white,
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
                      color: Colors.white,
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

  void _selectCategory(Map<String, dynamic> category) {
    setState(() {
      _selectedCategory = category['title'] as String;
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
                  color: Colors.white,
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