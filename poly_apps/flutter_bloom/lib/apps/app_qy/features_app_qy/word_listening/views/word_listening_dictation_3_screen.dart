/// Expert Dictation Practice Screen - Level 3
/// Follows Flutter Bloom architecture: theme centralization, glassmorphism, bento box layout
library;

import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/common/theme/base/theme_animations.dart';
import 'package:qyflutter/common/widgets/cards/premium_cards.dart';
import 'package:qyflutter/common/widgets/custom_app_bar.dart';
import 'package:qyflutter/common/widgets/buttons/primary_button.dart';
import 'package:qyflutter/apps/app_qy/resources_app_qy/colors_app_qy.dart';
import 'package:qyflutter/apps/app_qy/localization_app_qy/localization_keys_app_qy.dart';
import 'package:qyflutter/common/localization/localization_manager.dart';
import 'package:qyflutter/apps/app_qy/config_app_qy/storage_app_qy.dart';
import '../models/word_listening_dictation_model.dart';
import '../data/word_listening_dictation_data.dart';

class WordListeningDictation3Screen extends StatefulWidget {
  const WordListeningDictation3Screen({super.key});

  @override
  State<WordListeningDictation3Screen> createState() =>
      _WordListeningDictation3ScreenState();
}

class _WordListeningDictation3ScreenState
    extends State<WordListeningDictation3Screen> with TickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _fadeAnimation;
  late AnimationController _pulseController;
  late Animation<double> _pulseAnimation;
  late AnimationController _shimmerController;
  final StorageAppQy _storage = StorageAppQy.instance;

  // Use centralized data source instead of hardcoded array
  List<WordListeningDictationModel> get _expertWords =>
      WordListeningDictationData.getExpertWords();

  int _currentWordIndex = 0;
  String _userInput = '';
  bool _isPlaying = false;
  bool _showPhonetic = false;
  bool _showMeaning = false;
  bool _showContext = false;
  int _correctCount = 0;
  int _attempts = 0;
  final List<String> _userAttempts = [];
  int _streakCount = 0;

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
    _pulseController = AnimationController(
      duration: Duration(milliseconds: ThemeDimensions.animationDurationSlow),
      vsync: this,
    )..repeat();
    _pulseAnimation = Tween<double>(begin: 0.8, end: 1.2).animate(
      CurvedAnimation(
          parent: _pulseController, curve: ThemeAnimations.easeInOut),
    );
    _shimmerController = AnimationController(
      duration:
          Duration(milliseconds: ThemeDimensions.animationDurationSlow * 2),
      vsync: this,
    )..repeat();
    _loadProgressFromStorage();
    _controller.forward();
  }

  Future<void> _loadProgressFromStorage() async {
    try {
      final cachedProgress = await _storage.getApp<Map<String, dynamic>>(
        '${StorageAppQy.keyUserProgress}_dictation_3',
      );
      if (cachedProgress != null && mounted) {
        setState(() {
          _currentWordIndex = cachedProgress['currentWordIndex'] as int? ?? 0;
          _correctCount = cachedProgress['correctCount'] as int? ?? 0;
          _streakCount = cachedProgress['streakCount'] as int? ?? 0;
        });
      }
    } catch (e) {
      // Ignore errors
    }
  }

  Future<void> _saveProgressToStorage() async {
    try {
      await _storage.setApp(
        '${StorageAppQy.keyUserProgress}_dictation_3',
        {
          'currentWordIndex': _currentWordIndex,
          'correctCount': _correctCount,
          'streakCount': _streakCount,
        },
      );
    } catch (e) {
      // Ignore errors
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    _pulseController.dispose();
    _shimmerController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      extendBodyBehindAppBar: true,
      body: Stack(
        children: [
          _buildBackgroundGradient(),
          SafeArea(
            child: FadeTransition(
              opacity: _fadeAnimation,
              child: SingleChildScrollView(
                child: Column(
                  children: [
                    _buildAppBar(),
                    _buildProgressIndicator(),
                    _buildExpertStatus(),
                    _buildWordCard(),
                    _buildAudioSection(),
                    _buildInputSection(),
                    _buildHintButtons(),
                    _buildActionButtons(),
                    SizedBox(height: ThemeDimensions.spacing20),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBackgroundGradient() {
    return AnimatedBuilder(
      animation: _shimmerController,
      builder: (context, child) {
        return Container(
          decoration: BoxDecoration(
            gradient:
                ColorsAppQy.qyDynamicShimmerGradient(_shimmerController.value),
          ),
        );
      },
    );
  }

  Widget _buildAppBar() {
    return ClipRRect(
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
        child: Container(
          padding: EdgeInsets.symmetric(
            horizontal: ThemeDimensions.spacing16,
            vertical: ThemeDimensions.spacing12,
          ),
          decoration: BoxDecoration(
            gradient: ColorsAppQy.qyFrostedGlassGradient,
            border: Border(
              bottom: BorderSide(
                color: Colors.white.withOpacity(0.2),
                width: 1,
              ),
            ),
          ),
          child: CustomAppBar(
            title: QyAppLocalizationKeys.qyListeningDictationExpertTitle
                .tr(context),
            backgroundColor: Colors.transparent,
            titleColor: ColorsAppQy.qyTextPrimary,
            iconColor: ColorsAppQy.qyTextPrimary,
            elevation: 0,
            systemOverlayStyle: SystemUiOverlayStyle.dark,
            actions: [
              Container(
                padding: EdgeInsets.symmetric(
                  horizontal: ThemeDimensions.spacing12,
                  vertical: ThemeDimensions.spacing6,
                ),
                decoration: BoxDecoration(
                  gradient: ColorsAppQy.qyPrimaryGradient,
                  borderRadius:
                      BorderRadius.circular(ThemeDimensions.radiusLarge),
                ),
                child: Text(
                  '${_currentWordIndex + 1}/${_expertWords.length}',
                  style: ThemeTextStyles.bodySmall.copyWith(
                    color: ColorsAppQy.qyTextOnPrimary,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildProgressIndicator() {
    return Container(
      margin: EdgeInsets.symmetric(
        horizontal: ThemeDimensions.spacing16,
        vertical: ThemeDimensions.spacing8,
      ),
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                QyAppLocalizationKeys.qyListeningExpertProgress.tr(context),
                style: ThemeTextStyles.bodyMedium.copyWith(
                  color: ColorsAppQy.qyTextSecondary,
                ),
              ),
              Row(
                children: [
                  if (_streakCount >= 3)
                    Icon(
                      Icons.local_fire_department,
                      color: Colors.orange,
                      size: 20,
                    ),
                  SizedBox(width: ThemeDimensions.spacing8),
                  Text(
                    '${(_currentWordIndex / _expertWords.length * 100).toInt()}%',
                    style: ThemeTextStyles.bodyMedium.copyWith(
                      color: ColorsAppQy.qyPrimary,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ],
              ),
            ],
          ),
          SizedBox(height: ThemeDimensions.spacing8),
          Container(
            height: 8,
            decoration: BoxDecoration(
              color: Colors.white.withOpacity(0.3),
              borderRadius: ThemeDimensions.borderRadiusS,
            ),
            child: FractionallySizedBox(
              alignment: Alignment.centerLeft,
              widthFactor: _currentWordIndex / _expertWords.length,
              child: Container(
                decoration: BoxDecoration(
                  gradient: ColorsAppQy.qyPrimaryGradient,
                  borderRadius: ThemeDimensions.borderRadiusS,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildExpertStatus() {
    return Container(
      margin: EdgeInsets.symmetric(
        horizontal: ThemeDimensions.spacing16,
        vertical: ThemeDimensions.spacing8,
      ),
      padding: EdgeInsets.all(ThemeDimensions.spacing16),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            ColorsAppQy.qyPrimary.withOpacity(0.1),
            ColorsAppQy.qyPrimary.withOpacity(0.05),
          ],
        ),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: ColorsAppQy.qyPrimary.withOpacity(0.3),
        ),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceAround,
        children: [
          _buildStatusItem(
              '🎯',
              QyAppLocalizationKeys.qyListeningAccuracy.tr(context),
              '${((_correctCount / _attempts * 100).round())}%',
              _correctCount > 0),
          _buildStatusItem(
              '🔥',
              QyAppLocalizationKeys.qyListeningStreak.tr(context),
              '$_streakCount',
              _streakCount >= 3),
          _buildStatusItem(
              '📝',
              QyAppLocalizationKeys.qyListeningAttempts.tr(context),
              '$_attempts',
              _attempts > 0),
          _buildStatusItem(
              '⭐',
              QyAppLocalizationKeys.qyListeningLevel.tr(context),
              QyAppLocalizationKeys.qyListeningExpert.tr(context),
              true),
        ],
      ),
    );
  }

  Widget _buildStatusItem(
      String emoji, String label, String value, bool isHighlight) {
    return Column(
      children: [
        Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(
            color: isHighlight
                ? ColorsAppQy.qyPrimary.withOpacity(0.1)
                : Colors.white.withOpacity(0.3),
            borderRadius: ThemeDimensions.borderRadiusL,
          ),
          child: Center(
            child: Text(
              emoji,
              style: const TextStyle(fontSize: 20),
            ),
          ),
        ),
        const SizedBox(height: 4),
        Text(
          label,
          style: ThemeTextStyles.caption.copyWith(
            color: ColorsAppQy.qyTextSecondary,
          ),
        ),
        Text(
          value,
          style: ThemeTextStyles.caption.copyWith(
            color:
                isHighlight ? ColorsAppQy.qyPrimary : ColorsAppQy.qyTextPrimary,
            fontWeight: FontWeight.bold,
          ),
        ),
      ],
    );
  }

  Widget _buildWordCard() {
    final currentWord = _expertWords[_currentWordIndex];

    return GlassCard(
      borderRadius: ThemeDimensions.borderRadiusL,
      child: Padding(
        padding: EdgeInsets.all(ThemeDimensions.spacing24),
        child: Column(
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Container(
                  padding: EdgeInsets.symmetric(
                    horizontal: ThemeDimensions.spacing8,
                    vertical: ThemeDimensions.spacing4,
                  ),
                  decoration: BoxDecoration(
                    gradient: ColorsAppQy.qyPrimaryGradient,
                    borderRadius: ThemeDimensions.borderRadiusS,
                  ),
                  child: Text(
                    QyAppLocalizationKeys.qyListeningExpertLevel.tr(context),
                    style: ThemeTextStyles.bodySmall.copyWith(
                      color: ColorsAppQy.qyTextOnPrimary,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
                Container(
                  padding: EdgeInsets.symmetric(
                    horizontal: ThemeDimensions.spacing8,
                    vertical: ThemeDimensions.spacing4,
                  ),
                  decoration: BoxDecoration(
                    color: ColorsAppQy.qyPrimary.withOpacity(0.1),
                    borderRadius: ThemeDimensions.borderRadiusS,
                  ),
                  child: Text(
                    currentWord.category.toUpperCase(),
                    style: ThemeTextStyles.bodySmall.copyWith(
                      color: ColorsAppQy.qyPrimary,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ],
            ),
            SizedBox(height: ThemeDimensions.spacing20),
            if (_showPhonetic) ...[
              Text(
                currentWord.phonetic,
                style: ThemeTextStyles.headlineSmall.copyWith(
                  color: ColorsAppQy.qyTextSecondary,
                  fontStyle: FontStyle.italic,
                ),
              ),
              SizedBox(height: ThemeDimensions.spacing12),
            ],
            if (_showMeaning) ...[
              Text(
                currentWord.meaningKey.tr(context),
                style: ThemeTextStyles.bodyMedium.copyWith(
                  color: ColorsAppQy.qyTextPrimary,
                  fontWeight: FontWeight.w600,
                ),
                textAlign: TextAlign.center,
              ),
              SizedBox(height: ThemeDimensions.spacing16),
            ],
            if (_showContext) ...[
              GlassCard(
                borderRadius: ThemeDimensions.borderRadiusS,
                child: Padding(
                  padding: EdgeInsets.all(ThemeDimensions.spacing16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        QyAppLocalizationKeys.qyListeningExamples.tr(context),
                        style: ThemeTextStyles.bodySmall.copyWith(
                          color: ColorsAppQy.qyTextSecondary,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      SizedBox(height: ThemeDimensions.spacing4),
                      if (currentWord.context != null)
                        Text(
                          currentWord.context!,
                          style: ThemeTextStyles.bodyMedium.copyWith(
                            color: ColorsAppQy.qyTextPrimary,
                          ),
                        ),
                    ],
                  ),
                ),
              ),
            ],
            SizedBox(height: ThemeDimensions.spacing16),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(
                  Icons.speed,
                  color: ColorsAppQy.qyTextSecondary,
                  size: ThemeDimensions.iconSizeS,
                ),
                SizedBox(width: ThemeDimensions.spacing4),
                Text(
                  '${QyAppLocalizationKeys.qyListeningSpeed.tr(context)}: ${_getSpeedText(currentWord.audioSpeed)}',
                  style: ThemeTextStyles.bodySmall.copyWith(
                    color: ColorsAppQy.qyTextSecondary,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildAudioSection() {
    return Container(
      margin: EdgeInsets.symmetric(horizontal: ThemeDimensions.spacing16),
      child: Column(
        children: [
          AnimatedBuilder(
            animation: _pulseAnimation,
            builder: (context, child) {
              return Transform.scale(
                scale: _isPlaying ? _pulseAnimation.value : 1.0,
                child: Container(
                  width: 120,
                  height: 120,
                  decoration: BoxDecoration(
                    gradient: ColorsAppQy.qyPrimaryGradient,
                    borderRadius: ThemeDimensions.borderRadiusXL,
                    boxShadow: [
                      BoxShadow(
                        color: ColorsAppQy.qyPrimary.withOpacity(0.3),
                        blurRadius: 20,
                        offset: const Offset(0, 8),
                      ),
                    ],
                  ),
                  child: IconButton(
                    onPressed: _playAudio,
                    icon: Center(
                      child: AnimatedContainer(
                        duration: const Duration(milliseconds: 200),
                        width: _isPlaying ? 50 : 60,
                        height: _isPlaying ? 50 : 60,
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: ThemeDimensions.borderRadiusXL,
                        ),
                        child: Icon(
                          _isPlaying ? Icons.pause : Icons.play_arrow,
                          color: ColorsAppQy.qyPrimary,
                          size: _isPlaying ? 30 : 36,
                        ),
                      ),
                    ),
                  ),
                ),
              );
            },
          ),
          SizedBox(height: ThemeDimensions.spacing16),
          Text(
            _isPlaying
                ? QyAppLocalizationKeys.qyListeningPlayingExpert.tr(context)
                : QyAppLocalizationKeys.qyListeningClickExpert.tr(context),
            style: ThemeTextStyles.body1.copyWith(
              color: ColorsAppQy.qyTextSecondary,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildInputSection() {
    return Container(
      margin: EdgeInsets.all(ThemeDimensions.spacing16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text(
                QyAppLocalizationKeys.qyListeningEnterExpert.tr(context),
                style: ThemeTextStyles.headlineSmall.copyWith(
                  color: ColorsAppQy.qyTextPrimary,
                  fontWeight: FontWeight.bold,
                ),
              ),
              SizedBox(width: ThemeDimensions.spacing8),
              if (_streakCount >= 3)
                Container(
                  padding: EdgeInsets.symmetric(
                    horizontal: ThemeDimensions.spacing8,
                    vertical: ThemeDimensions.spacing4,
                  ),
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                      colors: [
                        ColorsAppQy.qyWarning,
                        ColorsAppQy.qyWarning.withOpacity(0.8)
                      ],
                    ),
                    borderRadius: ThemeDimensions.borderRadiusS,
                  ),
                  child: Text(
                    '${QyAppLocalizationKeys.qyListeningStreak.tr(context)} $_streakCount',
                    style: ThemeTextStyles.bodySmall.copyWith(
                      color: ColorsAppQy.qyTextOnPrimary,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
            ],
          ),
          SizedBox(height: ThemeDimensions.spacing12),
          Container(
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: ThemeDimensions.borderRadiusM,
              border: Border.all(
                color: _userInput.isNotEmpty
                    ? ColorsAppQy.qyPrimary
                    : Colors.white.withOpacity(0.3),
                width: _userInput.isNotEmpty ? 3 : 2,
              ),
              boxShadow: [
                BoxShadow(
                  color: _userInput.isNotEmpty
                      ? ColorsAppQy.qyPrimary.withOpacity(0.2)
                      : Colors.black.withOpacity(0.1),
                  blurRadius: _userInput.isNotEmpty ? 15 : 10,
                  offset: const Offset(0, 2),
                ),
              ],
            ),
            child: TextField(
              onChanged: (value) {
                setState(() {
                  _userInput = value.toLowerCase().trim();
                });
              },
              decoration: InputDecoration(
                hintText:
                    QyAppLocalizationKeys.qyListeningInputExpert.tr(context),
                hintStyle: ThemeTextStyles.body1.copyWith(
                  color: ColorsAppQy.qyTextSecondary.withOpacity(0.5),
                ),
                border: InputBorder.none,
                contentPadding: EdgeInsets.all(ThemeDimensions.spacing16),
                suffixIcon: _userInput.isNotEmpty
                    ? IconButton(
                        onPressed: () {
                          setState(() {
                            _userInput = '';
                          });
                        },
                        icon: Icon(
                          Icons.clear,
                          color: ColorsAppQy.qyTextSecondary,
                        ),
                      )
                    : null,
              ),
              style: ThemeTextStyles.bodySmall.copyWith(
                color: ColorsAppQy.qyTextPrimary,
                fontWeight: FontWeight.w500,
              ),
              textCapitalization: TextCapitalization.none,
            ),
          ),
          if (_userAttempts.isNotEmpty) ...[
            SizedBox(height: ThemeDimensions.spacing12),
            Text(
              QyAppLocalizationKeys.qyListeningAttemptHistory.tr(context),
              style: ThemeTextStyles.caption.copyWith(
                color: ColorsAppQy.qyTextSecondary,
              ),
            ),
            SizedBox(height: ThemeDimensions.spacing4),
            Wrap(
              spacing: 8,
              runSpacing: 4,
              children: _userAttempts.asMap().entries.map((entry) {
                final index = entry.key;
                final attempt = entry.value;
                final isRecent = index == _userAttempts.length - 1;
                return Container(
                  padding: EdgeInsets.symmetric(
                    horizontal: ThemeDimensions.spacing8,
                    vertical: ThemeDimensions.spacing4,
                  ),
                  decoration: BoxDecoration(
                    color: isRecent
                        ? ColorsAppQy.qyError.withOpacity(0.2)
                        : ColorsAppQy.qyError.withOpacity(0.1),
                    borderRadius: ThemeDimensions.borderRadiusS,
                    border: isRecent
                        ? Border.all(
                            color: ColorsAppQy.qyError.withOpacity(0.5))
                        : null,
                  ),
                  child: Text(
                    attempt,
                    style: ThemeTextStyles.bodySmall.copyWith(
                      color: ColorsAppQy.qyError,
                      decoration: TextDecoration.lineThrough,
                      fontWeight:
                          isRecent ? FontWeight.w600 : FontWeight.normal,
                    ),
                  ),
                );
              }).toList(),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildHintButtons() {
    return Container(
      margin: EdgeInsets.symmetric(horizontal: ThemeDimensions.spacing16),
      child: Column(
        children: [
          Row(
            children: [
              Expanded(
                child: _buildHintButton(
                  QyAppLocalizationKeys.qyListeningPhonetic.tr(context),
                  Icons.record_voice_over,
                  _showPhonetic,
                  () => _toggleHint('phonetic'),
                ),
              ),
              SizedBox(width: ThemeDimensions.spacing8),
              Expanded(
                child: _buildHintButton(
                  QyAppLocalizationKeys.qyListeningMeaning.tr(context),
                  Icons.translate,
                  _showMeaning,
                  () => _toggleHint('meaning'),
                ),
              ),
              SizedBox(width: ThemeDimensions.spacing8),
              Expanded(
                child: _buildHintButton(
                  QyAppLocalizationKeys.qyListeningExample.tr(context),
                  Icons.format_quote,
                  _showContext,
                  () => _toggleHint('context'),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildHintButton(
      String label, IconData icon, bool isActive, VoidCallback onPressed) {
    return IconButton(
      onPressed: isActive ? null : onPressed,
      icon: Container(
        padding: EdgeInsets.symmetric(vertical: 12),
        decoration: BoxDecoration(
          gradient: isActive
              ? LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [
                    ColorsAppQy.qyTextTertiary,
                    ColorsAppQy.qyTextTertiary.withOpacity(0.8)
                  ],
                )
              : LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [
                    ColorsAppQy.qyInfo,
                    ColorsAppQy.qyInfo.withOpacity(0.8)
                  ],
                ),
          borderRadius: BorderRadius.circular(12),
          boxShadow: isActive
              ? null
              : [
                  BoxShadow(
                    color: ColorsAppQy.qyInfo.withOpacity(0.3),
                    blurRadius: 8,
                    offset: const Offset(0, 2),
                  ),
                ],
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              icon,
              color: Colors.white,
              size: 16,
            ),
            SizedBox(width: ThemeDimensions.spacing4),
            Text(
              label,
              style: ThemeTextStyles.caption.copyWith(
                color: Colors.white,
                fontWeight: FontWeight.bold,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildActionButtons() {
    return Container(
      margin: EdgeInsets.symmetric(horizontal: ThemeDimensions.spacing16),
      child: Column(
        children: [
          Row(
            children: [
              Expanded(
                flex: 2,
                child: PrimaryButton(
                  text:
                      QyAppLocalizationKeys.qyListeningVerifyAnswer.tr(context),
                  onPressed: _userInput.isNotEmpty ? _checkAnswer : null,
                  backgroundColor: _userInput.isNotEmpty
                      ? ColorsAppQy.qyPrimary
                      : ColorsAppQy.qyTextTertiary,
                  foregroundColor: Colors.white,
                  isFullWidth: true,
                  icon: Icons.check_circle,
                ),
              ),
              SizedBox(width: ThemeDimensions.spacing12),
              Expanded(
                child: OutlinedButton(
                  onPressed: _skipWord,
                  style: OutlinedButton.styleFrom(
                    side: BorderSide(
                      color: Colors.white.withOpacity(0.3),
                    ),
                    padding: EdgeInsets.symmetric(vertical: 16),
                    shape: RoundedRectangleBorder(
                      borderRadius: ThemeDimensions.borderRadiusM,
                    ),
                  ),
                  child: Text(
                    QyAppLocalizationKeys.qyListeningSkip.tr(context),
                    style: ThemeTextStyles.bodyMedium.copyWith(
                      color: ColorsAppQy.qyTextSecondary,
                      fontWeight: FontWeight.w600,
                    ),
                    textAlign: TextAlign.center,
                  ),
                ),
              ),
            ],
          ),
          SizedBox(height: ThemeDimensions.spacing12),
          PrimaryButton(
            text: _isPlaying
                ? QyAppLocalizationKeys.qyListeningStop.tr(context)
                : QyAppLocalizationKeys.qyListeningPlay.tr(context),
            onPressed: _playAudio,
            backgroundColor: ColorsAppQy.qyPrimary.withOpacity(0.1),
            foregroundColor: ColorsAppQy.qyPrimary,
            icon: _isPlaying ? Icons.pause : Icons.play_arrow,
            isFullWidth: true,
          ),
        ],
      ),
    );
  }

  String _getSpeedText(String speed) {
    switch (speed) {
      case 'slow':
        return QyAppLocalizationKeys.qyListeningSpeedSlow.tr(context);
      case 'normal':
        return QyAppLocalizationKeys.qyListeningSpeedNormal.tr(context);
      case 'fast':
        return QyAppLocalizationKeys.qyListeningSpeedFast.tr(context);
      default:
        return QyAppLocalizationKeys.qyListeningSpeedNormal.tr(context);
    }
  }

  void _playAudio() {
    setState(() {
      _isPlaying = true;
    });

    // Simulate audio playback
    Future.delayed(const Duration(seconds: 2), () {
      if (mounted) {
        setState(() {
          _isPlaying = false;
        });
      }
    });

    // In a real app, you would play the actual audio file
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          QyAppLocalizationKeys.qyListeningPlayingExpertAudio
              .tr(context)
              .replaceAll('{word}', _expertWords[_currentWordIndex].word),
        ),
        backgroundColor: ColorsAppQy.qyPrimary,
        duration: const Duration(seconds: 2),
      ),
    );
  }

  void _toggleHint(String hintType) {
    setState(() {
      switch (hintType) {
        case 'phonetic':
          _showPhonetic = true;
          break;
        case 'meaning':
          _showMeaning = true;
          break;
        case 'context':
          _showContext = true;
          break;
      }
    });
  }

  void _checkAnswer() {
    final currentWord = _expertWords[_currentWordIndex];
    final isCorrect =
        _userInput.toLowerCase() == currentWord.word.toLowerCase();

    setState(() {
      _attempts++;
      if (!isCorrect) {
        _userAttempts.add(_userInput);
        _streakCount = 0;
      } else {
        _correctCount++;
        _streakCount++;
      }
    });
    _saveProgressToStorage();

    if (isCorrect) {
      _showCorrectDialog();
    } else {
      _showIncorrectDialog();
    }
  }

  void _skipWord() {
    setState(() {
      _streakCount = 0;
    });
    _nextWord();
  }

  void _nextWord() {
    if (_currentWordIndex < _expertWords.length - 1) {
      setState(() {
        _currentWordIndex++;
        _userInput = '';
        _showPhonetic = false;
        _showMeaning = false;
        _showContext = false;
        _userAttempts.clear();
        _isPlaying = false;
      });
    } else {
      _showCompletionDialog();
    }
  }

  void _showCorrectDialog() {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20),
        ),
        content: Container(
          padding: const EdgeInsets.all(20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 100,
                height: 100,
                decoration: BoxDecoration(
                  gradient: ColorsAppQy.qyPrimaryGradient,
                  borderRadius: BorderRadius.circular(50),
                ),
                child: const Icon(
                  Icons.emoji_events,
                  color: Colors.white,
                  size: 50,
                ),
              ),
              SizedBox(height: ThemeDimensions.spacing20),
              Text(
                _streakCount >= 3
                    ? '${QyAppLocalizationKeys.qyListeningStreak.tr(context)} ${QyAppLocalizationKeys.qyListeningComplete.tr(context)}'
                    : QyAppLocalizationKeys.qyListeningExpertLevel.tr(context),
                style: ThemeTextStyles.headlineMedium.copyWith(
                  color: ColorsAppQy.qyPrimary,
                  fontWeight: FontWeight.bold,
                ),
              ),
              SizedBox(height: ThemeDimensions.spacing12),
              Text(
                _expertWords[_currentWordIndex].word,
                style: ThemeTextStyles.headlineLarge.copyWith(
                  color: ColorsAppQy.qyTextPrimary,
                  fontWeight: FontWeight.bold,
                ),
              ),
              SizedBox(height: ThemeDimensions.spacing4),
              Text(
                _expertWords[_currentWordIndex].meaningKey.tr(context),
                style: ThemeTextStyles.bodyMedium.copyWith(
                  color: ColorsAppQy.qyTextPrimary,
                ),
                textAlign: TextAlign.center,
              ),
              if (_streakCount >= 3) ...[
                SizedBox(height: ThemeDimensions.spacing12),
                Container(
                  padding: EdgeInsets.symmetric(
                    horizontal: ThemeDimensions.spacing12,
                    vertical: ThemeDimensions.spacing6,
                  ),
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                      colors: [
                        ColorsAppQy.qyWarning,
                        ColorsAppQy.qyWarning.withOpacity(0.8),
                      ],
                    ),
                    borderRadius: ThemeDimensions.borderRadiusM,
                  ),
                  child: Text(
                    '${QyAppLocalizationKeys.qyListeningStreak.tr(context)} $_streakCount',
                    style: ThemeTextStyles.bodyMedium.copyWith(
                      color: ColorsAppQy.qyTextOnPrimary,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ],
              SizedBox(height: ThemeDimensions.spacing20),
              Row(
                children: [
                  Expanded(
                    child: PrimaryButton(
                      text: QyAppLocalizationKeys.qyNext.tr(context),
                      onPressed: () {
                        Navigator.of(context).pop();
                        _nextWord();
                      },
                      backgroundColor: ColorsAppQy.qyPrimary,
                      foregroundColor: Colors.white,
                      isFullWidth: true,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _showIncorrectDialog() {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20),
        ),
        content: Container(
          padding: const EdgeInsets.all(20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 80,
                height: 80,
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [
                      ColorsAppQy.qyError,
                      ColorsAppQy.qyError.withOpacity(0.8)
                    ],
                  ),
                  borderRadius: BorderRadius.circular(40),
                ),
                child: const Icon(
                  Icons.close,
                  color: Colors.white,
                  size: 40,
                ),
              ),
              SizedBox(height: ThemeDimensions.spacing16),
              Text(
                QyAppLocalizationKeys.qyListeningIncorrect.tr(context),
                style: ThemeTextStyles.headlineMedium.copyWith(
                  color: ColorsAppQy.qyError,
                  fontWeight: FontWeight.bold,
                ),
              ),
              SizedBox(height: ThemeDimensions.spacing12),
              GlassCard(
                borderRadius: ThemeDimensions.borderRadiusS,
                child: Padding(
                  padding: EdgeInsets.all(ThemeDimensions.spacing16),
                  child: Column(
                    children: [
                      Text(
                        QyAppLocalizationKeys.qyListeningCorrectAnswerLabel
                            .tr(context),
                        style: ThemeTextStyles.bodySmall.copyWith(
                          color: ColorsAppQy.qyTextSecondary,
                        ),
                      ),
                      SizedBox(height: ThemeDimensions.spacing4),
                      Text(
                        _expertWords[_currentWordIndex].word,
                        style: ThemeTextStyles.headlineSmall.copyWith(
                          color: ColorsAppQy.qyTextPrimary,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      SizedBox(height: ThemeDimensions.spacing8),
                      Text(
                        _expertWords[_currentWordIndex].phonetic,
                        style: ThemeTextStyles.bodyMedium.copyWith(
                          color: ColorsAppQy.qyTextSecondary,
                          fontStyle: FontStyle.italic,
                        ),
                      ),
                      SizedBox(height: ThemeDimensions.spacing4),
                      Text(
                        _expertWords[_currentWordIndex].meaningKey.tr(context),
                        style: ThemeTextStyles.bodyMedium.copyWith(
                          color: ColorsAppQy.qyTextPrimary,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              SizedBox(height: ThemeDimensions.spacing20),
              Row(
                children: [
                  Expanded(
                    child: PrimaryButton(
                      text: QyAppLocalizationKeys.qyNext.tr(context),
                      onPressed: () {
                        Navigator.of(context).pop();
                        _nextWord();
                      },
                      backgroundColor: ColorsAppQy.qyPrimary,
                      foregroundColor: Colors.white,
                      isFullWidth: true,
                    ),
                  ),
                  SizedBox(width: ThemeDimensions.spacing12),
                  Expanded(
                    child: OutlinedButton(
                      onPressed: () {
                        Navigator.of(context).pop();
                        setState(() {
                          _userInput = '';
                          _userAttempts.clear();
                        });
                      },
                      style: OutlinedButton.styleFrom(
                        side: BorderSide(
                          color: Colors.white.withOpacity(0.3),
                        ),
                        padding: EdgeInsets.symmetric(vertical: 12),
                        shape: RoundedRectangleBorder(
                          borderRadius: ThemeDimensions.borderRadiusS,
                        ),
                      ),
                      child: Text(
                        QyAppLocalizationKeys.qyCommonCancel.tr(context),
                        style: ThemeTextStyles.bodyMedium.copyWith(
                          color: ColorsAppQy.qyTextSecondary,
                          fontWeight: FontWeight.w600,
                        ),
                        textAlign: TextAlign.center,
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _showCompletionDialog() {
    final accuracy = (_correctCount / _attempts * 100).round();
    final isExpert = accuracy >= 90;

    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20),
        ),
        content: Container(
          padding: const EdgeInsets.all(20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 120,
                height: 120,
                decoration: BoxDecoration(
                  gradient: isExpert
                      ? ColorsAppQy.qyPrimaryGradient
                      : ColorsAppQy.qySecondaryGradient,
                  borderRadius: BorderRadius.circular(60),
                ),
                child: Icon(
                  isExpert ? Icons.military_tech : Icons.school,
                  color: Colors.white,
                  size: 60,
                ),
              ),
              SizedBox(height: ThemeDimensions.spacing20),
              Text(
                isExpert
                    ? QyAppLocalizationKeys.qyListeningExpertCertified
                        .tr(context)
                    : QyAppLocalizationKeys.qyListeningChallengeComplete
                        .tr(context),
                style: ThemeTextStyles.headlineLarge.copyWith(
                  color: isExpert
                      ? ColorsAppQy.qyPrimary
                      : ColorsAppQy.qySecondary,
                  fontWeight: FontWeight.bold,
                ),
                textAlign: TextAlign.center,
              ),
              SizedBox(height: ThemeDimensions.spacing20),
              GlassCard(
                borderRadius: ThemeDimensions.borderRadiusM,
                child: Padding(
                  padding: EdgeInsets.all(ThemeDimensions.spacing20),
                  child: Column(
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            QyAppLocalizationKeys.qyListeningFinalAccuracy
                                .tr(context),
                            style: ThemeTextStyles.bodyMedium.copyWith(
                              color: ColorsAppQy.qyTextSecondary,
                            ),
                          ),
                          Text(
                            '$accuracy%',
                            style: ThemeTextStyles.headlineSmall.copyWith(
                              color: isExpert
                                  ? ColorsAppQy.qyPrimary
                                  : ColorsAppQy.qySecondary,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ],
                      ),
                      SizedBox(height: ThemeDimensions.spacing12),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            QyAppLocalizationKeys.qyListeningCorrectWords
                                .tr(context),
                            style: ThemeTextStyles.bodyMedium.copyWith(
                              color: ColorsAppQy.qyTextSecondary,
                            ),
                          ),
                          Text(
                            '$_correctCount/${_expertWords.length}',
                            style: ThemeTextStyles.bodyMedium.copyWith(
                              color: ColorsAppQy.qyTextPrimary,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ],
                      ),
                      SizedBox(height: ThemeDimensions.spacing12),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            QyAppLocalizationKeys.qyListeningMaxStreak
                                .tr(context),
                            style: ThemeTextStyles.bodyMedium.copyWith(
                              color: ColorsAppQy.qyTextSecondary,
                            ),
                          ),
                          Text(
                            '$_streakCount',
                            style: ThemeTextStyles.bodyMedium.copyWith(
                              color: ColorsAppQy.qyWarning,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ],
                      ),
                      SizedBox(height: ThemeDimensions.spacing12),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            QyAppLocalizationKeys.qyListeningLevel.tr(context),
                            style: ThemeTextStyles.bodyMedium.copyWith(
                              color: ColorsAppQy.qyTextSecondary,
                            ),
                          ),
                          Text(
                            isExpert
                                ? '${QyAppLocalizationKeys.qyListeningExpert.tr(context)} ⭐⭐⭐'
                                : '${QyAppLocalizationKeys.qyListeningExpert.tr(context)} ⭐⭐',
                            style: ThemeTextStyles.bodyMedium.copyWith(
                              color: ColorsAppQy.qyPrimary,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
              SizedBox(height: ThemeDimensions.spacing20),
              Row(
                children: [
                  Expanded(
                    child: PrimaryButton(
                      text: QyAppLocalizationKeys.qyCommonOk.tr(context),
                      onPressed: () {
                        Navigator.of(context).pop();
                        Navigator.of(context).pop();
                      },
                      backgroundColor: ColorsAppQy.qyPrimary,
                      foregroundColor: Colors.white,
                      isFullWidth: true,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
