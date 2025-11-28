/// Advanced Dictation Practice Screen - Level 2
/// Follows Flutter Bloom architecture: theme centralization, glassmorphism, bento box layout
library;

import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:qyflutter/common/theme/base/theme_colors.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/common/theme/base/theme_animations.dart';
import 'package:qyflutter/common/widgets/cards/premium_cards.dart';
import 'package:qyflutter/common/widgets/buttons/primary_button.dart';
import 'package:qyflutter/common/widgets/animations/animation_utils.dart';
import 'package:qyflutter/apps/app_qy/resources_app_qy/colors_app_qy.dart';
import 'package:qyflutter/apps/app_qy/localization_app_qy/localization_keys_app_qy.dart';
import 'package:qyflutter/common/localization/localization_manager.dart';
import 'package:qyflutter/apps/app_qy/config_app_qy/storage_app_qy.dart';

class WordListeningDictation2Screen extends StatefulWidget {
  const WordListeningDictation2Screen({super.key});

  @override
  State<WordListeningDictation2Screen> createState() => _WordListeningDictation2ScreenState();
}

class _WordListeningDictation2ScreenState extends State<WordListeningDictation2Screen>
    with TickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _fadeAnimation;
  late AnimationController _progressController;
  late Animation<double> _progressAnimation;

  final List<Map<String, dynamic>> _dictationWords = [
    {
      'word': 'magnificent',
      'phonetic': '/mæɡˈnɪfɪsənt/',
      'meaning': '宏伟的，壮丽的',
      'difficulty': 'medium',
      'category': 'adjective',
      'examples': [
        'The magnificent palace attracts millions of tourists.',
        'She has a magnificent voice.',
      ],
      'audioSpeed': 'normal',
    },
    {
      'word': 'extraordinary',
      'phonetic': '/ɪkˈstrɔːrdəneri/',
      'meaning': '非凡的，特别的',
      'difficulty': 'medium',
      'category': 'adjective',
      'examples': [
        'It was an extraordinary achievement.',
        'She has extraordinary talent.',
      ],
      'audioSpeed': 'normal',
    },
    {
      'word': 'accomplishment',
      'phonetic': '/əˈkʌmplɪʃmənt/',
      'meaning': '成就，完成',
      'difficulty': 'medium',
      'category': 'noun',
      'examples': [
        'Winning the award was a great accomplishment.',
        'She felt a sense of accomplishment.',
      ],
      'audioSpeed': 'normal',
    },
    {
      'word': 'environmental',
      'phonetic': '/ɪnˌvaɪrənˈmentl/',
      'meaning': '环境的',
      'difficulty': 'medium',
      'category': 'adjective',
      'examples': [
        'We need to address environmental issues.',
        'Environmental protection is important.',
      ],
      'audioSpeed': 'slow',
    },
    {
      'word': 'revolutionary',
      'phonetic': '/ˌrevəˈluːʃəneri/',
      'meaning': '革命性的，创新的',
      'difficulty': 'hard',
      'category': 'adjective',
      'examples': [
        'It was a revolutionary discovery.',
        'The technology is revolutionary.',
      ],
      'audioSpeed': 'slow',
    },
  ];

  int _currentWordIndex = 0;
  String _userInput = '';
  bool _isPlaying = false;
  bool _showHint = false;
  bool _isCompleted = false;
  int _correctCount = 0;
  int _attempts = 0;
  final List<String> _userAttempts = [];

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
    _progressController = AnimationController(
      duration: const Duration(seconds: 30),
      vsync: this,
    );
    _progressAnimation = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _progressController, curve: Curves.linear),
    );
    _controller.forward();
    _loadProgress();
  }
  
  Future<void> _loadProgress() async {
    final storage = StorageAppQy.instance;
    final progress = await storage.getApp<Map<String, dynamic>>('dictation_2_progress');
    if (mounted && progress != null) {
      setState(() {
        _currentWordIndex = (progress['currentIndex'] as int?) ?? 0;
        _correctCount = (progress['correctCount'] as int?) ?? 0;
        _attempts = (progress['attempts'] as int?) ?? 0;
        _isCompleted = (progress['isCompleted'] as bool?) ?? false;
      });
    }
  }
  
  Future<void> _saveProgress() async {
    final storage = StorageAppQy.instance;
    await storage.setApp<Map<String, dynamic>>('dictation_2_progress', {
      'currentIndex': _currentWordIndex,
      'correctCount': _correctCount,
      'attempts': _attempts,
      'isCompleted': _isCompleted,
    });
  }

  @override
  void dispose() {
    _controller.dispose();
    _progressController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: AnimatedBuilder(
        animation: _progressAnimation,
        builder: (context, child) {
          return Container(
            decoration: BoxDecoration(
              gradient: ColorsAppQy.qyDynamicShimmerGradient(_progressAnimation.value),
            ),
            child: SafeArea(
              child: FadeTransition(
                opacity: _fadeAnimation,
                child: SingleChildScrollView(
                  padding: EdgeInsets.all(ThemeDimensions.spacing16),
                  child: Column(
                    children: [
                      _buildAppBar(context),
                      SizedBox(height: ThemeDimensions.spacing16),
                      _buildProgressBar(),
                      SizedBox(height: ThemeDimensions.spacing16),
                      _buildBentoBoxContent(context),
                      SizedBox(height: ThemeDimensions.spacing20),
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
  
  Widget _buildBentoBoxContent(BuildContext context) {
    return Column(
      children: [
        Row(
          children: [
            Expanded(
              flex: 2,
              child: _buildWordInfo(),
            ),
            SizedBox(width: ThemeDimensions.spacing16),
            Expanded(
              flex: 1,
              child: _buildStatsCard(context),
            ),
          ],
        ),
        SizedBox(height: ThemeDimensions.spacing16),
        _buildAudioSection(),
        SizedBox(height: ThemeDimensions.spacing16),
        _buildInputSection(),
        SizedBox(height: ThemeDimensions.spacing16),
        _buildActionButtons(),
      ],
    );
  }
  
  Widget _buildStatsCard(BuildContext context) {
    return GlassCard(
      child: Padding(
        padding: EdgeInsets.all(ThemeDimensions.spacing16),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.check_circle,
              color: ColorsAppQy.qySuccess,
              size: ThemeDimensions.iconSizeL,
            ),
            SizedBox(height: ThemeDimensions.spacing8),
            Text(
              '$_correctCount',
              style: ThemeTextStyles.headlineMedium.copyWith(
                color: ColorsAppQy.qyTextPrimary,
                fontWeight: FontWeight.bold,
              ),
            ),
            SizedBox(height: ThemeDimensions.spacing4),
            Text(
              QyAppLocalizationKeys.qyListeningCorrectAnswers.tr(context),
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

  Widget _buildAppBar(BuildContext context) {
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
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  QyAppLocalizationKeys.qyListeningDictationAdvanced.tr(context),
                  style: ThemeTextStyles.headlineSmall.copyWith(
                    color: ColorsAppQy.qyTextPrimary,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                Text(
                  QyAppLocalizationKeys.qyListeningDictationIntermediateDesc.tr(context),
                  style: ThemeTextStyles.bodySmall.copyWith(
                    color: ColorsAppQy.qyTextSecondary,
                  ),
                ),
              ],
            ),
          ),
          Container(
            padding: EdgeInsets.symmetric(
              horizontal: ThemeDimensions.spacing12,
              vertical: ThemeDimensions.spacing6,
            ),
            decoration: BoxDecoration(
              gradient: ColorsAppQy.qySecondaryGradient,
              borderRadius: ThemeDimensions.borderRadiusM,
            ),
            child: Text(
              '${_currentWordIndex + 1}/${_dictationWords.length}',
              style: ThemeTextStyles.bodySmall.copyWith(
                color: ColorsAppQy.qyTextOnPrimary,
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildProgressBar() {
    return GlassCard(
      child: Padding(
        padding: EdgeInsets.all(ThemeDimensions.spacing16),
        child: Column(
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  QyAppLocalizationKeys.qyListeningProgress.tr(context),
                  style: ThemeTextStyles.bodyMedium.copyWith(
                    color: ColorsAppQy.qyTextSecondary,
                  ),
                ),
                Text(
                  '${(_currentWordIndex / _dictationWords.length * 100).toInt()}%',
                  style: ThemeTextStyles.bodyMedium.copyWith(
                    color: ColorsAppQy.qySecondary,
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
                widthFactor: _currentWordIndex / _dictationWords.length,
                child: Container(
                  decoration: BoxDecoration(
                    gradient: ColorsAppQy.qySecondaryGradient,
                    borderRadius: ThemeDimensions.borderRadiusS,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
      borderRadius: ThemeDimensions.borderRadiusM,
    );
  }

  Widget _buildWordInfo() {
    final currentWord = _dictationWords[_currentWordIndex];

    return GlassCard(
      child: Padding(
        padding: EdgeInsets.all(ThemeDimensions.spacing20),
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: _getDifficultyColor(currentWord['difficulty']).withOpacity(0.1),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(
                  _getDifficultyText(currentWord['difficulty']),
                  style: ThemeTextStyles.bodySmall.copyWith(
                    color: _getDifficultyColor(currentWord['difficulty']),
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: ColorsAppQy.qyInfo.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(
                  currentWord['category'].toString().toUpperCase(),
                  style: ThemeTextStyles.bodySmall.copyWith(
                    color: ColorsAppQy.qyInfo,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          if (_showHint) ...[
            Text(
              currentWord['phonetic'],
              style: ThemeTextStyles.bodyLarge.copyWith(
                color: ColorsAppQy.qyTextSecondary,
                fontStyle: FontStyle.italic,
              ),
            ),
            const SizedBox(height: 12),
            Text(
              currentWord['meaning'],
              style: AppTextStyles.bodyMedium.copyWith(
                color: AppTheme.textPrimary,
                fontWeight: FontWeight.w500,
              ),
            ),
            const SizedBox(height: 16),
          ],
          Row(
            children: [
              Icon(
                Icons.speed,
                color: ColorsAppQy.qyTextSecondary,
                size: 16,
              ),
              const SizedBox(width: 4),
              Text(
                '${QyAppLocalizationKeys.qyListeningSpeed.tr(context)}: ${_getSpeedText(currentWord['audioSpeed'])}',
                style: AppTextStyles.bodySmall.copyWith(
                  color: ColorsAppQy.qyTextSecondary,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildAudioSection() {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16),
      child: Column(
        children: [
          Container(
            width: 120,
            height: 120,
            decoration: BoxDecoration(
              gradient: ColorsAppQy.qySecondaryGradient,
              borderRadius: BorderRadius.circular(60),
              boxShadow: [
                BoxShadow(
                  color: ColorsAppQy.qySecondary.withOpacity(0.3),
                  blurRadius: 20,
                  offset: const Offset(0, 8),
                ),
              ],
            ),
            child: BouncingButton(
              onPressed: _playAudio,
              child: Center(
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 200),
                  width: _isPlaying ? 50 : 60,
                  height: _isPlaying ? 50 : 60,
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(_isPlaying ? 25 : 30),
                  ),
                  child: Icon(
                    _isPlaying ? Icons.pause : Icons.play_arrow,
                    color: ColorsAppQy.qySecondary,
                    size: _isPlaying ? 30 : 36,
                  ),
                ),
              ),
            ),
          ),
          const SizedBox(height: 16),
          Text(
            _isPlaying ? QyAppLocalizationKeys.qyListeningPlaying.tr(context) : QyAppLocalizationKeys.qyListeningClickToPlay.tr(context),
            style: AppTextStyles.bodyMedium.copyWith(
                          color: ColorsAppQy.qyTextSecondary,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildInputSection() {
    return Container(
      margin: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            QyAppLocalizationKeys.qyListeningWriteWord.tr(context),
            style: ThemeTextStyles.headlineSmall.copyWith(
              color: AppTheme.textPrimary,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 12),
          Container(
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(
                color: _userInput.isNotEmpty ? ColorsAppQy.qySecondary : ColorsAppQy.qyBorderLight,
                width: 2,
              ),
              boxShadow: [
                BoxShadow(
                  color: ColorsAppQy.qyShadowLight.withOpacity(0.1),
                  blurRadius: 10,
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
                hintText: QyAppLocalizationKeys.qyListeningInputWord.tr(context),
                hintStyle: ThemeTextStyles.bodyMedium.copyWith(
                  color: ColorsAppQy.qyTextSecondary.withOpacity(0.5),
                ),
                border: InputBorder.none,
                contentPadding: const EdgeInsets.all(16),
                suffixIcon: _userInput.isNotEmpty
                    ? BouncingButton(
                        onPressed: () {
                          setState(() {
                            _userInput = '';
                          });
                        },
                        child: Icon(
                          Icons.clear,
                          color: ColorsAppQy.qyTextSecondary,
                        ),
                      )
                    : null,
              ),
              style: ThemeTextStyles.bodyLarge.copyWith(
                color: AppTheme.textPrimary,
              ),
              textCapitalization: TextCapitalization.none,
            ),
          ),
          if (_userAttempts.isNotEmpty) ...[
            const SizedBox(height: 12),
            Text(
              QyAppLocalizationKeys.qyListeningPreviousAttempts.tr(context),
              style: AppTextStyles.bodySmall.copyWith(
                color: ColorsAppQy.qyTextSecondary,
              ),
            ),
            const SizedBox(height: 4),
            Wrap(
              spacing: 8,
              runSpacing: 4,
              children: _userAttempts.map((attempt) => Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: ColorsAppQy.qyError.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  attempt,
                  style: ThemeTextStyles.bodySmall.copyWith(
                    color: ColorsAppQy.qyError,
                    decoration: TextDecoration.lineThrough,
                  ),
                ),
              )).toList(),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildActionButtons() {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16),
      child: Column(
        children: [
          Row(
            children: [
              Expanded(
                child: BouncingButton(
                  onPressed: _showHint ? null : _toggleHint,
                  child: Container(
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    decoration: BoxDecoration(
                      gradient: _showHint ? ColorsAppQy.qyHolographicGradient : ColorsAppQy.qyPrimaryGradient,
                      borderRadius: BorderRadius.circular(16),
                      boxShadow: _showHint ? null : [
                        BoxShadow(
                          color: ColorsAppQy.qyInfo.withOpacity(0.3),
                          blurRadius: 12,
                          offset: const Offset(0, 4),
                        ),
                      ],
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(
                          Icons.lightbulb_outline,
                          color: Colors.white,
                          size: 20,
                        ),
                        const SizedBox(width: 8),
                        Text(
                          _showHint ? QyAppLocalizationKeys.qyListeningHintShown.tr(context) : QyAppLocalizationKeys.qyListeningShowHint.tr(context),
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
              Expanded(
                child: BouncingButton(
                  onPressed: _userInput.isNotEmpty ? _checkAnswer : null,
                  child: Container(
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    decoration: BoxDecoration(
                      gradient: _userInput.isNotEmpty ? ColorsAppQy.qySecondaryGradient : ColorsAppQy.qyHolographicGradient,
                      borderRadius: BorderRadius.circular(16),
                      boxShadow: _userInput.isNotEmpty ? [
                        BoxShadow(
                          color: ColorsAppQy.qySecondary.withOpacity(0.3),
                          blurRadius: 12,
                          offset: const Offset(0, 4),
                        ),
                      ] : null,
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(
                          Icons.check,
                          color: Colors.white,
                          size: 20,
                        ),
                        const SizedBox(width: 8),
                        Text(
                          QyAppLocalizationKeys.qyListeningCheckAnswer.tr(context),
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
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: BouncingButton(
                  onPressed: _skipWord,
                  child: Container(
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    decoration: BoxDecoration(
                      color: ColorsAppQy.qyFrostWhite,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(
                        color: ColorsAppQy.qyBorderLight,
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
              ),
              const SizedBox(width: 12),
              Expanded(
                child: BouncingButton(
                  onPressed: _playAudio,
                  child: Container(
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    decoration: BoxDecoration(
                      color: AppTheme.learningColor.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(
                        color: ColorsAppQy.qySecondary.withOpacity(0.3),
                      ),
                    ),
                    child: Text(
                      QyAppLocalizationKeys.qyListeningReplay.tr(context),
                      style: ThemeTextStyles.bodyMedium.copyWith(
                        color: ColorsAppQy.qySecondary,
                        fontWeight: FontWeight.w600,
                      ),
                      textAlign: TextAlign.center,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Color _getDifficultyColor(String difficulty) {
    switch (difficulty) {
      case 'easy':
        return ColorsAppQy.qySuccess;
      case 'medium':
        return ColorsAppQy.qyWarning;
      case 'hard':
        return ColorsAppQy.qyError;
      default:
        return ColorsAppQy.qyInfo;
    }
  }

  String _getDifficultyText(String difficulty) {
    switch (difficulty) {
      case 'easy':
        return QyAppLocalizationKeys.qyListeningEasy.tr(context);
      case 'medium':
        return QyAppLocalizationKeys.qyListeningMedium.tr(context);
      case 'hard':
        return QyAppLocalizationKeys.qyListeningHard.tr(context);
      default:
        return QyAppLocalizationKeys.qyListeningUnknown.tr(context);
    }
  }

  String _getSpeedText(String speed) {
    switch (speed) {
      case 'slow':
        return QyAppLocalizationKeys.qyListeningSlow.tr(context);
      case 'normal':
        return QyAppLocalizationKeys.qyListeningNormal.tr(context);
      case 'fast':
        return QyAppLocalizationKeys.qyListeningFast.tr(context);
      default:
        return QyAppLocalizationKeys.qyListeningNormal.tr(context);
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
        content: Text('正在播放: ${_dictationWords[_currentWordIndex]['word']}'),
        backgroundColor: AppTheme.learningColor,
        duration: const Duration(seconds: 1),
      ),
    );
  }

  void _toggleHint() {
    setState(() {
      _showHint = true;
    });
  }

  void _checkAnswer() {
    final currentWord = _dictationWords[_currentWordIndex];
    final isCorrect = _userInput == currentWord['word'].toString().toLowerCase();

    setState(() {
      _attempts++;
      if (!isCorrect) {
        _userAttempts.add(_userInput);
      }
    });

    if (isCorrect) {
      setState(() {
        _correctCount++;
      });

      _showCorrectDialog();
    } else {
      _showIncorrectDialog();
    }
  }

  void _skipWord() {
    _nextWord();
  }

  void _nextWord() {
    if (_currentWordIndex < _dictationWords.length - 1) {
      setState(() {
        _currentWordIndex++;
        _userInput = '';
        _showHint = false;
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
                width: 80,
                height: 80,
                decoration: BoxDecoration(
                  gradient: AppTheme.successGradient,
                  borderRadius: BorderRadius.circular(40),
                ),
                child: const Icon(
                  Icons.check,
                  color: Colors.white,
                  size: 40,
                ),
              ),
              const SizedBox(height: 16),
              Text(
                '回答正确！',
                style: AppTextStyles.headline5.copyWith(
                  color: AppTheme.success,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                '${_dictationWords[_currentWordIndex]['word']} - ${_dictationWords[_currentWordIndex]['meaning']}',
                style: AppTextStyles.bodyMedium.copyWith(
                  color: ColorsAppQy.qyTextPrimary,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 20),
              Row(
                children: [
                  Expanded(
                    child: BouncingButton(
                      onPressed: () {
                        Navigator.of(context).pop();
                        _nextWord();
                      },
                      child: Container(
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        decoration: BoxDecoration(
                          gradient: AppTheme.primaryGradient,
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Text(
                          '下一个',
                          style: ThemeTextStyles.bodyMedium.copyWith(
                            color: Colors.white,
                            fontWeight: FontWeight.bold,
                          ),
                          textAlign: TextAlign.center,
                        ),
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
                  gradient: AppTheme.errorGradient,
                  borderRadius: BorderRadius.circular(40),
                ),
                child: const Icon(
                  Icons.close,
                  color: Colors.white,
                  size: 40,
                ),
              ),
              const SizedBox(height: 16),
              Text(
                '答案不正确',
                style: AppTextStyles.headline5.copyWith(
                  color: AppTheme.error,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                '正确答案: ${_dictationWords[_currentWordIndex]['word']}',
                style: AppTextStyles.bodyMedium.copyWith(
                  color: ColorsAppQy.qyTextPrimary,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 8),
              Text(
                '${_dictationWords[_currentWordIndex]['meaning']}',
                style: AppTextStyles.bodySmall.copyWith(
                  color: ColorsAppQy.qyTextSecondary,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 20),
              Row(
                children: [
                  Expanded(
                    child: BouncingButton(
                      onPressed: () {
                        Navigator.of(context).pop();
                        _nextWord();
                      },
                      child: Container(
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        decoration: BoxDecoration(
                          gradient: AppTheme.primaryGradient,
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Text(
                          '继续',
                          style: ThemeTextStyles.bodyMedium.copyWith(
                            color: Colors.white,
                            fontWeight: FontWeight.bold,
                          ),
                          textAlign: TextAlign.center,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: BouncingButton(
                      onPressed: () {
                        Navigator.of(context).pop();
                        setState(() {
                          _userInput = '';
                          _userAttempts.clear();
                        });
                      },
                      child: Container(
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        decoration: BoxDecoration(
                          color: ColorsAppQy.qyFrostWhite,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(
                            color: ColorsAppQy.qyBorderLight,
                          ),
                        ),
                        child: Text(
                          '重试',
                          style: ThemeTextStyles.bodyMedium.copyWith(
                            color: ColorsAppQy.qyTextSecondary,
                            fontWeight: FontWeight.w600,
                          ),
                          textAlign: TextAlign.center,
                        ),
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
    setState(() {
      _isCompleted = true;
    });

    final accuracy = (_correctCount / _attempts * 100).round();

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
                  gradient: accuracy >= 80 ? AppTheme.successGradient : AppTheme.learningGradient,
                  borderRadius: BorderRadius.circular(50),
                ),
                child: Icon(
                  accuracy >= 80 ? Icons.emoji_events : Icons.school,
                  color: Colors.white,
                  size: 50,
                ),
              ),
              const SizedBox(height: 20),
              Text(
                '练习完成！',
                style: AppTextStyles.headline4.copyWith(
                  color: ColorsAppQy.qyTextPrimary,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 16),
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: AppTheme.backgroundLight,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Column(
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          '正确率:',
                          style: ThemeTextStyles.bodyMedium.copyWith(
                            color: ColorsAppQy.qyTextSecondary,
                          ),
                        ),
                        Text(
                          '$accuracy%',
                          style: ThemeTextStyles.bodyMedium.copyWith(
                            color: accuracy >= 80 ? AppTheme.success : AppTheme.warning,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          '正确单词:',
                          style: ThemeTextStyles.bodyMedium.copyWith(
                            color: ColorsAppQy.qyTextSecondary,
                          ),
                        ),
                        Text(
                          '$_correctCount/${_dictationWords.length}',
                          style: ThemeTextStyles.bodyMedium.copyWith(
                            color: ColorsAppQy.qyTextPrimary,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          '总尝试次数:',
                          style: ThemeTextStyles.bodyMedium.copyWith(
                            color: ColorsAppQy.qyTextSecondary,
                          ),
                        ),
                        Text(
                          '$_attempts',
                          style: ThemeTextStyles.bodyMedium.copyWith(
                            color: ColorsAppQy.qyTextPrimary,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),
              Row(
                children: [
                  Expanded(
                    child: BouncingButton(
                      onPressed: () {
                        Navigator.of(context).pop();
                        Navigator.of(context).pop();
                      },
                      child: Container(
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        decoration: BoxDecoration(
                          gradient: AppTheme.primaryGradient,
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Text(
                          '完成',
                          style: ThemeTextStyles.bodyMedium.copyWith(
                            color: Colors.white,
                            fontWeight: FontWeight.bold,
                          ),
                          textAlign: TextAlign.center,
                        ),
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
}