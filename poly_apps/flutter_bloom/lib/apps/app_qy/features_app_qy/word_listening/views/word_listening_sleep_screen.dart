/// Word Listening Sleep Mode screen
/// Follows Flutter Bloom architecture: theme centralization, glassmorphism, dynamic gradients
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

class WordListeningSleepScreen extends StatefulWidget {
  const WordListeningSleepScreen({super.key});

  @override
  State<WordListeningSleepScreen> createState() => _WordListeningSleepScreenState();
}

class _WordListeningSleepScreenState extends State<WordListeningSleepScreen>
    with TickerProviderStateMixin {
  late AnimationController _fadeController;
  late AnimationController _pulseController;
  late Animation<double> _fadeAnimation;
  late Animation<double> _pulseAnimation;

  bool _isPlaying = false;
  bool _isDarkMode = false;
  int _selectedDuration = 30; // minutes
  int _remainingTime = 0;
  Timer? _timer;
  Timer? _sleepTimer;

  List<WordSleepCategoryModel> get _wordCategories => WordSleepCategoryData.getSleepCategories();

  int _selectedCategoryIndex = 0;


  void _setupAnimations() {
    _fadeController = AnimationController(
      duration: Duration(milliseconds: ThemeDimensions.animationDurationNormal),
      vsync: this,
    );
    _pulseController = AnimationController(
      duration: const Duration(seconds: 2),
      vsync: this,
    );

    _fadeAnimation = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _fadeController, curve: ThemeAnimations.easeInOut),
    );

    _pulseAnimation = Tween<double>(begin: 0.8, end: 1.2).animate(
      CurvedAnimation(parent: _pulseController, curve: ThemeAnimations.spring),
    );

    _fadeController.forward();
    _pulseController.repeat(reverse: true);
  }
  
  @override
  void initState() {
    super.initState();
    _setupAnimations();
    _loadSettings();
  }
  
  Future<void> _loadSettings() async {
    final storage = StorageAppQy.instance;
    final settings = await storage.getApp<Map<String, dynamic>>('word_listening_sleep_settings');
    if (mounted && settings != null) {
      setState(() {
        if (settings['darkMode'] != null) _isDarkMode = settings['darkMode'] as bool;
        if (settings['duration'] != null) _selectedDuration = settings['duration'] as int;
        if (settings['categoryIndex'] != null) _selectedCategoryIndex = settings['categoryIndex'] as int;
      });
    }
  }
  
  Future<void> _saveSettings() async {
    final storage = StorageAppQy.instance;
    await storage.setApp<Map<String, dynamic>>('word_listening_sleep_settings', {
      'darkMode': _isDarkMode,
      'duration': _selectedDuration,
      'categoryIndex': _selectedCategoryIndex,
    });
  }

  @override
  void dispose() {
    _fadeController.dispose();
    _pulseController.dispose();
    _timer?.cancel();
    _sleepTimer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: AnimatedBuilder(
        animation: _pulseAnimation,
        builder: (context, child) {
          return Container(
            decoration: BoxDecoration(
              gradient: _isDarkMode
                  ? ColorsAppQy.qyDynamicShimmerGradient(_pulseAnimation.value * 0.5)
                  : ColorsAppQy.qyHolographicGradient,
            ),
            child: SafeArea(
              child: FadeTransition(
                opacity: _fadeAnimation,
                child: Column(
                  children: [
                    _buildAppBar(),
                    Expanded(
                      child: _isPlaying ? _buildPlayingState() : _buildSetupState(),
                    ),
                  ],
                ),
              ),
            ),
          );
        },
      ),
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
              color: _isDarkMode ? ColorsAppQy.qyTextOnPrimary : ColorsAppQy.qyTextPrimary,
              size: 24,
            ),
          ),
          Expanded(
            child: Column(
              children: [
                Text(
                  QyAppLocalizationKeys.qyListeningSleepTitle.tr(context),
                  style: ThemeTextStyles.headlineMedium.copyWith(
                    color: _isDarkMode ? ColorsAppQy.qyTextOnPrimary : ColorsAppQy.qyTextPrimary,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                Text(
                  QyAppLocalizationKeys.qyListeningSleepSubtitle.tr(context),
                  style: ThemeTextStyles.bodyMedium.copyWith(
                    color: _isDarkMode ? ColorsAppQy.qyTextOnPrimary.withOpacity(0.7) : ColorsAppQy.qyTextSecondary,
                  ),
                ),
              ],
            ),
          ),
          BouncingButton(
            onPressed: _toggleDarkMode,
            child: Icon(
              _isDarkMode ? Icons.light_mode : Icons.dark_mode,
              color: _isDarkMode ? ColorsAppQy.qyTextOnPrimary : ColorsAppQy.qyTextPrimary,
              size: 24,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSetupState() {
    return SingleChildScrollView(
      padding: EdgeInsets.all(ThemeDimensions.spacing16),
      child: Column(
        children: [
          _buildSleepIllustration(),
          const SizedBox(height: 32),
          _buildCategorySelector(),
          const SizedBox(height: 24),
          _buildDurationSelector(),
          const SizedBox(height: 32),
          _buildSleepTips(),
          const SizedBox(height: 32),
          _buildStartButton(),
        ],
      ),
    );
  }

  Widget _buildPlayingState() {
    return Column(
      children: [
        Expanded(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              AnimatedBuilder(
                animation: _pulseAnimation,
                builder: (context, child) {
                  return Transform.scale(
                    scale: _pulseAnimation.value,
                    child: Container(
                      width: 120,
                      height: 120,
                      decoration: BoxDecoration(
                        gradient: _isDarkMode
                            ? ColorsAppQy.qyPrimaryGradient
                            : ColorsAppQy.qySecondaryGradient,
                        borderRadius: ThemeDimensions.borderRadiusXL,
                        boxShadow: [
                          BoxShadow(
                            color: (_isDarkMode ? ColorsAppQy.qyTextOnPrimary : ColorsAppQy.qyPrimary)
                                .withOpacity(0.3),
                            blurRadius: 20,
                            offset: const Offset(0, 10),
                          ),
                        ],
                      ),
                      child: Icon(
                        Icons.bedtime,
                        color: ColorsAppQy.qyTextOnPrimary,
                        size: 60,
                      ),
                    ),
                  );
                },
              ),
              const SizedBox(height: 32),
              Text(
                QyAppLocalizationKeys.qyListeningSleepPlaying.tr(context),
                style: ThemeTextStyles.headlineMedium.copyWith(
                  color: _isDarkMode ? ColorsAppQy.qyTextOnPrimary : ColorsAppQy.qyTextPrimary,
                  fontWeight: FontWeight.w300,
                ),
              ),
              const SizedBox(height: 16),
              Text(
                QyAppLocalizationKeys.qyListeningSleepRemainingTime.tr(context).replaceAll('{time}', _formatTime(_remainingTime)),
                  style: ThemeTextStyles.bodyLarge.copyWith(
                  color: _isDarkMode ? ColorsAppQy.qyTextOnPrimary.withOpacity(0.7) : ColorsAppQy.qyTextSecondary,
                ),
              ),
              const SizedBox(height: 48),
              _buildPlayingControls(),
            ],
          ),
        ),
        _buildSleepProgress(),
      ],
    );
  }

  Widget _buildSleepIllustration() {
    return ThemeAnimations.fadeSlideIn(
      child: Container(
        height: 200,
        decoration: BoxDecoration(
          gradient: _isDarkMode
              ? ColorsAppQy.qyPrimaryGradient
              : ColorsAppQy.qySecondaryGradient,
            borderRadius: ThemeDimensions.borderRadiusL,
        ),
        child: Stack(
          children: [
            Positioned(
              top: 20,
              left: 20,
              child: Icon(
                Icons.nights_stay,
                color: ColorsAppQy.qyFrostMedium,
                size: 40,
              ),
            ),
            Positioned(
              top: 60,
              right: 30,
              child: Icon(
                Icons.cloud,
                color: ColorsAppQy.qyFrostLight,
                size: 35,
              ),
            ),
            Positioned(
              bottom: 30,
              left: 40,
              child: Icon(
                Icons.star,
                color: ColorsAppQy.qyFrostMedium,
                size: 25,
              ),
            ),
            Center(
              child: AnimationUtils.pulse(
                child: Icon(
                  Icons.bedtime,
                  color: ColorsAppQy.qyTextOnPrimary,
                  size: 60,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildCategorySelector() {
    return Container(
      child: GlassCard(
        borderRadius: ThemeDimensions.borderRadiusL,
        child: Padding(
          padding: EdgeInsets.all(ThemeDimensions.spacing20),
          child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              QyAppLocalizationKeys.qyListeningSleepSelectCategory.tr(context),
              style: ThemeTextStyles.headlineSmall.copyWith(
                color: _isDarkMode ? ColorsAppQy.qyTextOnPrimary : ColorsAppQy.qyTextPrimary,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 16),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: _wordCategories.asMap().entries.map((entry) {
                final index = entry.key;
                final category = entry.value;
                final isSelected = index == _selectedCategoryIndex;
                return BouncingButton(
                  onPressed: () {
                    setState(() => _selectedCategoryIndex = index);
                    _saveSettings();
                  },
                  child: Container(
                    padding: EdgeInsets.symmetric(
                      horizontal: ThemeDimensions.spacing16,
                      vertical: ThemeDimensions.spacing8,
                    ),
                    decoration: BoxDecoration(
                      gradient: isSelected
                          ? _isDarkMode
                              ? ColorsAppQy.qyPrimaryGradient
                              : ColorsAppQy.qySecondaryGradient
                          : null,
                      color: isSelected ? null : ColorsAppQy.qyFrostWhite,
                      borderRadius: ThemeDimensions.borderRadiusM,
                      border: Border.all(
                        color: isSelected
                            ? ColorsAppQy.qyPageBackground.withOpacity(0)
                            : _isDarkMode
                                ? ColorsAppQy.qyTextOnPrimary.withOpacity(0.24)
                                : ColorsAppQy.qyBorderLight,
                        width: isSelected ? 0 : 1,
                      ),
                    ),
                    child: Text(
                      category.nameKey.tr(context),
                      style: ThemeTextStyles.bodyMedium.copyWith(
                        color: isSelected
                            ? ColorsAppQy.qyTextOnPrimary
                            : _isDarkMode
                                ? ColorsAppQy.qyTextOnPrimary.withOpacity(0.7)
                                : ColorsAppQy.qyTextPrimary,
                        fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                      ),
                    ),
                  ),
                );
              }).toList(),
            ),
          ],
        ),
      ),
      ),
    );
  }

  Widget _buildDurationSelector() {
    return Container(
      child: GlassCard(
        borderRadius: ThemeDimensions.borderRadiusL,
        child: Padding(
          padding: EdgeInsets.all(ThemeDimensions.spacing20),
          child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              QyAppLocalizationKeys.qyListeningSleepDuration.tr(context),
              style: ThemeTextStyles.headlineSmall.copyWith(
                color: _isDarkMode ? ColorsAppQy.qyTextOnPrimary : ColorsAppQy.qyTextPrimary,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                _buildDurationButton(15),
                const SizedBox(width: 8),
                _buildDurationButton(30),
                const SizedBox(width: 8),
                _buildDurationButton(45),
                const SizedBox(width: 8),
                _buildDurationButton(60),
              ],
            ),
          ],
        ),
      ),
      ),
    );
  }

  Widget _buildDurationButton(int minutes) {
    final isSelected = _selectedDuration == minutes;

    return Expanded(
      child: BouncingButton(
        onPressed: () {
          setState(() => _selectedDuration = minutes);
          _saveSettings();
        },
        child: Container(
          padding: EdgeInsets.symmetric(vertical: ThemeDimensions.spacing16),
          decoration: BoxDecoration(
            gradient: isSelected
                ? (_isDarkMode
                    ? ColorsAppQy.qyPrimaryGradient
                    : ColorsAppQy.qySecondaryGradient)
                : null,
            color: isSelected ? null : ColorsAppQy.qyTextOnPrimary,
            borderRadius: ThemeDimensions.borderRadiusM,
            border: Border.all(
              color: isSelected
                  ? ColorsAppQy.qyPageBackground.withOpacity(0)
                  : _isDarkMode
                      ? ColorsAppQy.qyFrostLight
                      : ColorsAppQy.qyBorderLight,
              width: isSelected ? 0 : 1,
            ),
          ),
          child: Text(
            QyAppLocalizationKeys.qyListeningSleepMinutes.tr(context).replaceAll('{minutes}', minutes.toString()),
            style: ThemeTextStyles.bodyMedium.copyWith(
              color: isSelected
                  ? ColorsAppQy.qyTextOnPrimary
                  : _isDarkMode
                      ? ColorsAppQy.qyFrostMedium
                                : ColorsAppQy.qyTextPrimary,
              fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildSleepTips() {
    return Container(
      child: GlassCard(
        borderRadius: ThemeDimensions.borderRadiusL,
        child: Padding(
          padding: EdgeInsets.all(ThemeDimensions.spacing20),
          child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(
                  Icons.lightbulb,
                  color: ColorsAppQy.qyWarning,
                  size: 24,
                ),
                const SizedBox(width: 12),
                Text(
                  QyAppLocalizationKeys.qyListeningSleepTipsTitle.tr(context),
                  style: ThemeTextStyles.headlineSmall.copyWith(
                    color: _isDarkMode ? ColorsAppQy.qyTextOnPrimary : ColorsAppQy.qyTextPrimary,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            ...[
              QyAppLocalizationKeys.qyListeningSleepTip1.tr(context),
              QyAppLocalizationKeys.qyListeningSleepTip2.tr(context),
              QyAppLocalizationKeys.qyListeningSleepTip3.tr(context),
              QyAppLocalizationKeys.qyListeningSleepTip4.tr(context),
            ].map((tip) => Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Text(
                tip,
                style: ThemeTextStyles.bodyMedium.copyWith(
                  color: _isDarkMode ? ColorsAppQy.qyTextOnPrimary.withOpacity(0.7) : ColorsAppQy.qyTextSecondary,
                ),
              ),
            )),
          ],
        ),
      ),
      ),
    );
  }

  Widget _buildStartButton() {
    return BouncingButton(
      onPressed: _startSleepMode,
      child: Container(
        width: double.infinity,
        padding: EdgeInsets.symmetric(vertical: ThemeDimensions.spacing20),
        decoration: BoxDecoration(
          gradient: _isDarkMode ? ColorsAppQy.qyPrimaryGradient : ColorsAppQy.qySecondaryGradient,
            borderRadius: ThemeDimensions.borderRadiusL,
          boxShadow: [
            BoxShadow(
              color: (_isDarkMode ? ColorsAppQy.qyTextOnPrimary : ColorsAppQy.qyPrimary)
                  .withOpacity(0.3),
              blurRadius: 20,
              offset: const Offset(0, 10),
            ),
          ],
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.bedtime,
              color: ColorsAppQy.qyTextOnPrimary,
              size: 28,
            ),
            const SizedBox(width: 12),
            Text(
              QyAppLocalizationKeys.qyListeningSleepStart.tr(context),
                  style: ThemeTextStyles.bodyLarge.copyWith(
                    color: ColorsAppQy.qyTextOnPrimary,
                    fontWeight: FontWeight.bold,
                  ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPlayingControls() {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceEvenly,
      children: [
        BouncingButton(
          onPressed: _previousWord,
          child: Container(
            padding: EdgeInsets.all(ThemeDimensions.spacing16),
            decoration: BoxDecoration(
              color: Colors.white.withOpacity(0.2),
              borderRadius: BorderRadius.circular(30),
            ),
            child: Icon(
              Icons.skip_previous,
              color: ColorsAppQy.qyTextOnPrimary,
              size: 28,
            ),
          ),
        ),
        BouncingButton(
          onPressed: _togglePlayPause,
          child: Container(
            padding: EdgeInsets.all(ThemeDimensions.spacing20),
            decoration: BoxDecoration(
              color: ColorsAppQy.qyFrostMedium,
              borderRadius: BorderRadius.circular(35),
            ),
            child: Icon(
              _isPlaying ? Icons.pause : Icons.play_arrow,
              color: ColorsAppQy.qyTextOnPrimary,
              size: 36,
            ),
          ),
        ),
        BouncingButton(
          onPressed: _nextWord,
          child: Container(
            padding: EdgeInsets.all(ThemeDimensions.spacing16),
            decoration: BoxDecoration(
              color: Colors.white.withOpacity(0.2),
              borderRadius: BorderRadius.circular(30),
            ),
            child: Icon(
              Icons.skip_next,
              color: ColorsAppQy.qyTextOnPrimary,
              size: 28,
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildSleepProgress() {
    return Container(
      margin: EdgeInsets.all(ThemeDimensions.spacing16),
      padding: EdgeInsets.all(ThemeDimensions.spacing20),
      decoration: BoxDecoration(
        color: _isDarkMode ? ColorsAppQy.qyTextOnPrimary.withOpacity(0.1) : ColorsAppQy.qyFrostWhite,
            borderRadius: ThemeDimensions.borderRadiusL,
        border: Border.all(
          color: _isDarkMode ? ColorsAppQy.qyTextOnPrimary.withOpacity(0.24) : ColorsAppQy.qyBorderLight,
        ),
      ),
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                QyAppLocalizationKeys.qyListeningSleepProgress.tr(context),
                style: ThemeTextStyles.bodyMedium.copyWith(
                  color: _isDarkMode ? ColorsAppQy.qyTextOnPrimary.withOpacity(0.7) : ColorsAppQy.qyTextSecondary,
                ),
              ),
              Text(
                _formatTime(_remainingTime),
                style: ThemeTextStyles.bodyMedium.copyWith(
                  color: _isDarkMode ? ColorsAppQy.qyTextOnPrimary : ColorsAppQy.qyTextPrimary,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Container(
            height: 6,
            decoration: BoxDecoration(
              color: _isDarkMode ? ColorsAppQy.qyTextOnPrimary.withOpacity(0.24) : ColorsAppQy.qyFrostWhite,
              borderRadius: ThemeDimensions.borderRadiusS,
            ),
            child: FractionallySizedBox(
              alignment: Alignment.centerLeft,
              widthFactor: 1 - (_remainingTime / (_selectedDuration * 60)),
              child: Container(
                decoration: BoxDecoration(
                  gradient: _isDarkMode
                      ? ColorsAppQy.qyPrimaryGradient
                      : ColorsAppQy.qySecondaryGradient,
                  borderRadius: ThemeDimensions.borderRadiusS,
                ),
              ),
            ),
          ),
          const SizedBox(height: 16),
          BouncingButton(
            onPressed: _stopSleepMode,
            child: Container(
              width: double.infinity,
              padding: EdgeInsets.symmetric(vertical: ThemeDimensions.spacing16),
              decoration: BoxDecoration(
                  color: ColorsAppQy.qyError.withOpacity(0.2),
                borderRadius: ThemeDimensions.borderRadiusM,
                border: Border.all(
                  color: ColorsAppQy.qyError,
                  width: 2,
                ),
              ),
              child: Text(
                QyAppLocalizationKeys.qyListeningSleepEnd.tr(context),
                style: ThemeTextStyles.bodyLarge.copyWith(
                  color: ColorsAppQy.qyTextOnPrimary,
                  fontWeight: FontWeight.bold,
                ).copyWith(
                  color: ColorsAppQy.qyError,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  void _toggleDarkMode() {
    setState(() {
      _isDarkMode = !_isDarkMode;
    });
    _saveSettings();
  }

  void _startSleepMode() {
    setState(() {
      _isPlaying = true;
      _remainingTime = _selectedDuration * 60;
    });

    // Start countdown timer
    _sleepTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      setState(() {
        _remainingTime--;
        if (_remainingTime <= 0) {
          _stopSleepMode();
        }
      });
    });

    // Auto stop after duration
    Timer(Duration(minutes: _selectedDuration), () {
      if (mounted) {
        _stopSleepMode();
      }
    });
  }

  void _togglePlayPause() {
    setState(() {
      _isPlaying = !_isPlaying;
    });
  }

  void _previousWord() {
    // Previous word logic
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(QyAppLocalizationKeys.qyListeningSleepPrevious.tr(context)),
        backgroundColor: ColorsAppQy.qyPrimary,
      ),
    );
  }

  void _nextWord() {
    // Next word logic
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(QyAppLocalizationKeys.qyListeningSleepNext.tr(context)),
        backgroundColor: ColorsAppQy.qyPrimary,
      ),
    );
  }

  void _stopSleepMode() {
    _sleepTimer?.cancel();
    setState(() {
      _isPlaying = false;
      _remainingTime = 0;
    });

    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(
            borderRadius: ThemeDimensions.borderRadiusL,
        ),
        title: Text(
          QyAppLocalizationKeys.qyListeningSleepEndTitle.tr(context),
          style: ThemeTextStyles.headlineSmall.copyWith(
            color: ColorsAppQy.qyTextPrimary,
          ),
        ),
        content: Text(
          QyAppLocalizationKeys.qyListeningSleepEndMessage.tr(context).replaceAll('{minutes}', _selectedDuration.toString()),
          style: ThemeTextStyles.bodyMedium,
          textAlign: TextAlign.center,
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
                  color: ColorsAppQy.qyPrimary,
                borderRadius: ThemeDimensions.borderRadiusM,
              ),
              child: Text(
                QyAppLocalizationKeys.qyCommonOk.tr(context),
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

  String _formatTime(int seconds) {
    final hours = seconds ~/ 3600;
    final minutes = (seconds % 3600) ~/ 60;
    final secs = seconds % 60;

    if (hours > 0) {
      return '${hours.toString().padLeft(2, '0')}:${minutes.toString().padLeft(2, '0')}:${secs.toString().padLeft(2, '0')}';
    } else {
      return '${minutes.toString().padLeft(2, '0')}:${secs.toString().padLeft(2, '0')}';
    }
  }
}