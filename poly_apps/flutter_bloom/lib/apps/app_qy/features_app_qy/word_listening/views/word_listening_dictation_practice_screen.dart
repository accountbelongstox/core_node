/// Word Listening Dictation Practice screen
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

class WordListeningDictationPracticeScreen extends StatefulWidget {
  final String level;
  final String title;

  const WordListeningDictationPracticeScreen({
    super.key,
    required this.level,
    required this.title,
  });

  @override
  State<WordListeningDictationPracticeScreen> createState() => _WordListeningDictationPracticeScreenState();
}

class _WordListeningDictationPracticeScreenState extends State<WordListeningDictationPracticeScreen>
    with TickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _fadeAnimation;

  final TextEditingController _answerController = TextEditingController();
  final List<Map<String, dynamic>> _words = [
    {'word': 'apple', 'meaning': '苹果', 'example': 'I like to eat an apple every day.'},
    {'word': 'beautiful', 'meaning': '美丽的', 'example': 'The sunset is beautiful tonight.'},
    {'word': 'computer', 'meaning': '计算机', 'example': 'I work on my computer all day.'},
    {'word': 'education', 'meaning': '教育', 'example': 'Education is very important for children.'},
    {'word': 'friendship', 'meaning': '友谊', 'example': 'True friendship lasts forever.'},
  ];

  int _currentWordIndex = 0;
  int _correctAnswers = 0;
  int _totalAttempts = 0;
  bool _showResult = false;
  bool _isCorrect = false;
  bool _isPlaying = false;
  int _playCount = 0;

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
    final progress = await storage.getApp<Map<String, dynamic>>('dictation_practice_${widget.level}_progress');
    if (mounted && progress != null) {
      setState(() {
        _currentWordIndex = (progress['currentIndex'] as int?) ?? 0;
        _correctAnswers = (progress['correctAnswers'] as int?) ?? 0;
        _totalAttempts = (progress['totalAttempts'] as int?) ?? 0;
      });
    }
  }
  
  Future<void> _saveProgress() async {
    final storage = StorageAppQy.instance;
    await storage.setApp<Map<String, dynamic>>('dictation_practice_${widget.level}_progress', {
      'currentIndex': _currentWordIndex,
      'correctAnswers': _correctAnswers,
      'totalAttempts': _totalAttempts,
    });
  }

  @override
  void dispose() {
    _controller.dispose();
    _answerController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final currentWord = _words[_currentWordIndex];

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
                      _buildProgressBar(),
                      SizedBox(height: ThemeDimensions.spacing16),
                      _buildBentoBoxContent(currentWord),
                      SizedBox(height: ThemeDimensions.spacing16),
                      _buildBottomActions(),
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
  
  Widget _buildBentoBoxContent(Map<String, dynamic> currentWord) {
    return Column(
      children: [
        Row(
          children: [
            Expanded(
              flex: 2,
              child: _buildAudioPlayer(currentWord),
            ),
            SizedBox(width: ThemeDimensions.spacing16),
            Expanded(
              flex: 1,
              child: _buildStatsCard(),
            ),
          ],
        ),
        SizedBox(height: ThemeDimensions.spacing16),
        _buildAnswerInput(currentWord),
        if (_showResult) ...[
          SizedBox(height: ThemeDimensions.spacing16),
          _buildResult(currentWord),
        ],
      ],
    );
  }
  
  Widget _buildStatsCard() {
    final accuracy = _totalAttempts > 0 ? (_correctAnswers / _totalAttempts * 100).toInt() : 0;
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
              '$accuracy%',
              style: ThemeTextStyles.headlineMedium.copyWith(
                color: ColorsAppQy.qyTextPrimary,
                fontWeight: FontWeight.bold,
              ),
            ),
            SizedBox(height: ThemeDimensions.spacing4),
            Text(
              QyAppLocalizationKeys.qyListeningAccuracy.tr(context),
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
    final accuracy = _totalAttempts > 0 ? (_correctAnswers / _totalAttempts * 100).toInt() : 0;
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
              Icons.close,
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
                  widget.title,
                  style: ThemeTextStyles.headlineSmall.copyWith(
                    color: ColorsAppQy.qyTextPrimary,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                Text(
                  QyAppLocalizationKeys.qyListeningQuestionNumber.tr(context).replaceAll('{index}', '${_currentWordIndex + 1}').replaceAll('{total}', '${_words.length}'),
                  style: ThemeTextStyles.bodyMedium.copyWith(
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
              color: ColorsAppQy.qyPrimary.withOpacity(0.1),
              borderRadius: ThemeDimensions.borderRadiusS,
            ),
            child: Text(
              '$accuracy%',
              style: ThemeTextStyles.bodySmall.copyWith(
                color: ColorsAppQy.qyPrimary,
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
                  '${(_currentWordIndex / _words.length * 100).toInt()}%',
                  style: ThemeTextStyles.bodyMedium.copyWith(
                    color: ColorsAppQy.qyPrimary,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ],
            ),
            SizedBox(height: ThemeDimensions.spacing8),
            Container(
              height: 6,
              decoration: BoxDecoration(
                color: ColorsAppQy.qyHolographicMedium,
                borderRadius: ThemeDimensions.borderRadiusS,
              ),
              child: FractionallySizedBox(
                alignment: Alignment.centerLeft,
                widthFactor: _currentWordIndex / _words.length,
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
      ),
      borderRadius: ThemeDimensions.borderRadiusM,
    );
  }


  Widget _buildAudioPlayer(Map<String, dynamic> currentWord) {
    return AnimationUtils.fadeInWithSlide(
      GlassCard(
        child: Padding(
          padding: EdgeInsets.all(ThemeDimensions.spacing32),
          child: Container(
            decoration: BoxDecoration(
              gradient: ColorsAppQy.qyPrimaryGradient,
              borderRadius: ThemeDimensions.borderRadiusL,
            ),
          child: Column(
            children: [
              AnimationUtils.pulse(
                child: Container(
                  width: 100,
                  height: 100,
                  decoration: BoxDecoration(
                    gradient: ColorsAppQy.qySecondaryGradient,
                    borderRadius: ThemeDimensions.borderRadiusXL,
                    boxShadow: [
                      BoxShadow(
                        color: ColorsAppQy.qySecondary.withOpacity(0.3),
                        blurRadius: 15,
                        offset: Offset(0, 8),
                      ),
                    ],
                  ),
                  child: Icon(
                    _isPlaying ? Icons.volume_up : Icons.headphones,
                    color: ColorsAppQy.qyTextOnPrimary,
                    size: 50,
                  ),
                ),
              ),
              SizedBox(height: ThemeDimensions.spacing24),
              BouncingButton(
                onPressed: _playWord,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 16),
                  decoration: BoxDecoration(
                    gradient: AppTheme.primaryGradient,
                    borderRadius: BorderRadius.circular(30),
                    boxShadow: [
                      BoxShadow(
                        color: AppTheme.shadowColored,
                        blurRadius: 12,
                        offset: const Offset(0, 6),
                      ),
                    ],
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        _isPlaying ? Icons.stop : Icons.play_arrow,
                        color: Colors.white,
                        size: 24,
                      ),
                      const SizedBox(width: 8),
                      Text(
                        _isPlaying ? QyAppLocalizationKeys.qyListeningStopPlay.tr(context) : QyAppLocalizationKeys.qyListeningPlayWord.tr(context),
                        style: AppTextStyles.buttonText,
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 16),
              Text(
                '${QyAppLocalizationKeys.qyListeningPlayCount.tr(context)}: $_playCount / 3',
                style: AppTextStyles.bodyMedium.copyWith(
                  color: AppTheme.textSecondary,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildAnswerInput(Map<String, dynamic> currentWord) {
    return AnimationUtils.fadeInWithSlide(
      child: Container(
        decoration: ComponentStyles.primaryCardDecoration,
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                QyAppLocalizationKeys.qyListeningEnterWord.tr(context),
                style: AppTextStyles.headline5.copyWith(
                  color: AppTheme.textPrimary,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 16),
              TextField(
                controller: _answerController,
                enabled: !_showResult,
                style: AppTextStyles.inputText.copyWith(
                  fontSize: 20,
                  fontWeight: FontWeight.bold,
                ),
                textAlign: TextAlign.center,
                decoration: ComponentStyles.primaryInputDecoration.copyWith(
                  hintText: QyAppLocalizationKeys.qyListeningInputPlaceholder.tr(context),
                  hintStyle: AppTextStyles.bodyLarge.copyWith(
                    color: AppTheme.textHint,
                  ),
                ),
                textInputAction: TextInputAction.done,
                onSubmitted: (_) => _checkAnswer(currentWord),
              ),
              const SizedBox(height: 16),
              if (!_showResult)
                Row(
                  children: [
                    Expanded(
                      child: BouncingButton(
                        onPressed: () => _checkAnswer(currentWord),
                        child: Container(
                          padding: const EdgeInsets.symmetric(vertical: 16),
                          decoration: BoxDecoration(
                            gradient: AppTheme.primaryGradient,
                            borderRadius: BorderRadius.circular(16),
                          ),
                          child: Text(
                            QyAppLocalizationKeys.qyListeningSubmitAnswer.tr(context),
                            style: AppTextStyles.buttonText,
                            textAlign: TextAlign.center,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 16),
                    BouncingButton(
                      onPressed: _showHint,
                      child: Container(
                        padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 20),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(
                            color: AppTheme.warning,
                            width: 2,
                          ),
                        ),
                        child: Text(
                          QyAppLocalizationKeys.qyListeningHint.tr(context),
                          style: AppTextStyles.buttonText.copyWith(
                            color: AppTheme.warning,
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

  Widget _buildResult(Map<String, dynamic> currentWord) {
    return AnimationUtils.fadeInWithSlide(
      child: Container(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(20),
          gradient: _isCorrect
              ? AppTheme.masteredGradient
              : LinearGradient(
                  colors: [AppTheme.error.withOpacity(0.1), Colors.white],
                ),
          border: Border.all(
            color: _isCorrect ? AppTheme.masteredColor : AppTheme.error,
            width: 2,
          ),
        ),
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            children: [
              Icon(
                _isCorrect ? Icons.check_circle : Icons.cancel,
                color: _isCorrect ? AppTheme.masteredColor : AppTheme.error,
                size: 60,
              ),
              const SizedBox(height: 16),
              Text(
                _isCorrect ? QyAppLocalizationKeys.qyListeningCorrect.tr(context) : QyAppLocalizationKeys.qyListeningIncorrect.tr(context),
                style: AppTextStyles.headline4.copyWith(
                  color: _isCorrect ? AppTheme.masteredColor : AppTheme.error,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 16),
              if (!_isCorrect) ...[
                Text(
                  QyAppLocalizationKeys.qyListeningCorrectAnswer.tr(context),
                  style: AppTextStyles.bodyMedium.copyWith(
                    color: AppTheme.textSecondary,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  currentWord['word'] as String,
                  style: AppTextStyles.headline4.copyWith(
                    color: AppTheme.textPrimary,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 16),
              ],
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: AppTheme.surfaceLight,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      QyAppLocalizationKeys.qyListeningMeaning.tr(context),
                      style: AppTextStyles.bodyMedium.copyWith(
                        color: AppTheme.textSecondary,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      currentWord['meaning'] as String,
                      style: AppTextStyles.bodyLarge.copyWith(
                        color: AppTheme.textPrimary,
                      ),
                    ),
                    const SizedBox(height: 12),
                    Text(
                      QyAppLocalizationKeys.qyListeningExample.tr(context),
                      style: AppTextStyles.bodyMedium.copyWith(
                        color: AppTheme.textSecondary,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      currentWord['example'] as String,
                      style: AppTextStyles.bodyMedium.copyWith(
                        color: AppTheme.textPrimary,
                        fontStyle: FontStyle.italic,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildBottomActions() {
    return Container(
      padding: const EdgeInsets.all(16),
      child: Row(
        children: [
          if (_currentWordIndex > 0)
            Expanded(
              child: BouncingButton(
                onPressed: _previousWord,
                child: Container(
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(
                      color: AppTheme.primaryGreen,
                      width: 2,
                    ),
                  ),
                  child: Text(
                    QyAppLocalizationKeys.qyListeningPrevious.tr(context),
                    style: AppTextStyles.buttonText.copyWith(
                      color: AppTheme.primaryGreen,
                    ),
                    textAlign: TextAlign.center,
                  ),
                ),
              ),
            ),
          if (_currentWordIndex > 0) const SizedBox(width: 16),
          Expanded(
            child: BouncingButton(
              onPressed: _nextWord,
              child: Container(
                padding: const EdgeInsets.symmetric(vertical: 16),
                decoration: BoxDecoration(
                  gradient: AppTheme.primaryGradient,
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Text(
                  _currentWordIndex < _words.length - 1 ? QyAppLocalizationKeys.qyListeningNext.tr(context) : QyAppLocalizationKeys.qyListeningComplete.tr(context),
                  style: AppTextStyles.buttonText,
                  textAlign: TextAlign.center,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  void _playWord() {
    setState(() {
      _isPlaying = !_isPlaying;
      if (_isPlaying) {
        _playCount++;
        if (_playCount <= 3) {
          // Simulate audio playing
          Future.delayed(const Duration(seconds: 2), () {
            if (mounted && _isPlaying) {
              setState(() {
                _isPlaying = false;
              });
            }
          });
        }
      }
    });
  }

  void _checkAnswer(Map<String, dynamic> currentWord) {
    final userAnswer = _answerController.text.trim().toLowerCase();
    final correctAnswer = (currentWord['word'] as String).toLowerCase();

    setState(() {
      _showResult = true;
      _isCorrect = userAnswer == correctAnswer;
      _totalAttempts++;
      if (_isCorrect) {
        _correctAnswers++;
      }
    });
  }

  void _showHint() {
    final currentWord = _words[_currentWordIndex];
    final word = currentWord['word'] as String;

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(QyAppLocalizationKeys.qyListeningHintMessage.tr(context).replaceAll('{letter}', word[0].toUpperCase()).replaceAll('{length}', '${word.length}')),
        backgroundColor: AppTheme.warning,
        duration: const Duration(seconds: 3),
      ),
    );
  }

  void _nextWord() {
    if (_currentWordIndex < _words.length - 1) {
      setState(() {
        _currentWordIndex++;
        _showResult = false;
        _isCorrect = false;
        _answerController.clear();
        _playCount = 0;
      });
    } else {
      _showCompletionDialog();
    }
  }

  void _previousWord() {
    if (_currentWordIndex > 0) {
      setState(() {
        _currentWordIndex--;
        _showResult = false;
        _isCorrect = false;
        _answerController.clear();
        _playCount = 0;
      });
    }
  }

  void _showCompletionDialog() {
    final accuracy = _totalAttempts > 0 ? (_correctAnswers / _totalAttempts * 100).toInt() : 0;

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
              Icon(
                Icons.emoji_events,
                color: AppTheme.primaryGreen,
                size: 60,
              ),
              const SizedBox(height: 20),
              Text(
                QyAppLocalizationKeys.qyListeningPracticeComplete.tr(context),
                style: AppTextStyles.headline3.copyWith(
                  color: AppTheme.textPrimary,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 16),
              Text(
                '${QyAppLocalizationKeys.qyListeningAccuracy.tr(context)}: $accuracy%',
                style: AppTextStyles.headline4.copyWith(
                  color: accuracy >= 80 ? AppTheme.masteredColor :
                         accuracy >= 60 ? AppTheme.learningColor : AppTheme.error,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                '${QyAppLocalizationKeys.qyListeningCorrectAnswers.tr(context)}: $_correctAnswers / $_totalAttempts',
                style: AppTextStyles.bodyMedium.copyWith(
                  color: AppTheme.textSecondary,
                ),
              ),
              const SizedBox(height: 24),
              BouncingButton(
                onPressed: () {
                  Navigator.of(context).pop();
                  Navigator.of(context).pop();
                },
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 16),
                  decoration: BoxDecoration(
                    gradient: AppTheme.primaryGradient,
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: Text(
                    QyAppLocalizationKeys.qyListeningComplete.tr(context),
                    style: AppTextStyles.buttonText,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}