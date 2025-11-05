/// Advanced Dictation Practice Screen - Level 2
library;

import 'package:flutter/material.dart';
import '../../../../../../common/theme/app_theme.dart';
import '../../../../../../common/widgets/animations/animation_utils.dart';
import '../../../localization_app_qy/localization_manager.dart';
import '../../../localization_app_qy/localization_keys_app_qy.dart';

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
      duration: ComponentStyles.normalDuration,
      vsync: this,
    );
    _fadeAnimation = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _controller, curve: ComponentStyles.primaryCurve),
    );
    _progressController = AnimationController(
      duration: const Duration(seconds: 30),
      vsync: this,
    );
    _progressAnimation = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _progressController, curve: Curves.linear),
    );
    _controller.forward();
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
      body: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [
              AppTheme.learningGradient.colors[0].withOpacity(0.1),
              AppTheme.learningGradient.colors[1].withOpacity(0.05),
              Colors.white,
            ],
          ),
        ),
        child: SafeArea(
          child: FadeTransition(
            opacity: _fadeAnimation,
            child: Column(
              children: [
                _buildAppBar(),
                _buildProgressBar(),
                _buildWordInfo(),
                _buildAudioSection(),
                _buildInputSection(),
                _buildActionButtons(),
                const SizedBox(height: 20),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildAppBar() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Row(
        children: [
          BouncingButton(
            onPressed: () => Navigator.of(context).pop(),
            child: Icon(
              Icons.arrow_back,
              color: AppTheme.textPrimary,
              size: 24,
            ),
          ),
          Expanded(
            child: Column(
              children: [
                Text(
                  QyAppLocalizationKeys.qyListeningDictationAdvancedTitle.tr(context),
                  style: AppTextStyles.headline4.copyWith(
                    color: AppTheme.textPrimary,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                Text(
                  'Level 2 - 中级词汇挑战',
                  style: AppTextStyles.bodySmall.copyWith(
                    color: AppTheme.textSecondary,
                  ),
                ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            decoration: BoxDecoration(
              gradient: AppTheme.learningGradient,
              borderRadius: BorderRadius.circular(20),
            ),
            child: Text(
              '${_currentWordIndex + 1}/${_dictationWords.length}',
              style: AppTextStyles.bodySmall.copyWith(
                color: Colors.white,
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildProgressBar() {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                QyAppLocalizationKeys.qyListeningProgress.tr(context),
                style: AppTextStyles.bodyMedium.copyWith(
                  color: AppTheme.textSecondary,
                ),
              ),
              Text(
                '${(_currentWordIndex / _dictationWords.length * 100).toInt()}%',
                style: AppTextStyles.bodyMedium.copyWith(
                  color: AppTheme.learningColor,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Container(
            height: 8,
            decoration: BoxDecoration(
              color: AppTheme.backgroundLight,
              borderRadius: BorderRadius.circular(4),
            ),
            child: FractionallySizedBox(
              alignment: Alignment.centerLeft,
              widthFactor: _currentWordIndex / _dictationWords.length,
              child: Container(
                decoration: BoxDecoration(
                  gradient: AppTheme.learningGradient,
                  borderRadius: BorderRadius.circular(4),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildWordInfo() {
    final currentWord = _dictationWords[_currentWordIndex];

    return Container(
      margin: const EdgeInsets.all(16),
      padding: const EdgeInsets.all(20),
      decoration: ComponentStyles.primaryCardDecoration,
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
                  style: AppTextStyles.bodySmall.copyWith(
                    color: _getDifficultyColor(currentWord['difficulty']),
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: AppTheme.info.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(
                  currentWord['category'].toString().toUpperCase(),
                  style: AppTextStyles.bodySmall.copyWith(
                    color: AppTheme.info,
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
              style: AppTextStyles.bodyLarge.copyWith(
                color: AppTheme.textSecondary,
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
                color: AppTheme.textSecondary,
                size: 16,
              ),
              const SizedBox(width: 4),
              Text(
                '${QyAppLocalizationKeys.qyListeningSpeed.tr(context)}: ${_getSpeedText(currentWord['audioSpeed'])}',
                style: AppTextStyles.bodySmall.copyWith(
                  color: AppTheme.textSecondary,
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
              gradient: AppTheme.learningGradient,
              borderRadius: BorderRadius.circular(60),
              boxShadow: [
                BoxShadow(
                  color: AppTheme.learningColor.withOpacity(0.3),
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
                    color: AppTheme.learningColor,
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
              color: AppTheme.textSecondary,
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
            style: AppTextStyles.headline6.copyWith(
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
                color: _userInput.isNotEmpty ? AppTheme.learningColor : AppTheme.borderLight,
                width: 2,
              ),
              boxShadow: [
                BoxShadow(
                  color: AppTheme.shadowLight.withOpacity(0.1),
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
                hintStyle: AppTextStyles.bodyMedium.copyWith(
                  color: AppTheme.textSecondary.withOpacity(0.5),
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
                          color: AppTheme.textSecondary,
                        ),
                      )
                    : null,
              ),
              style: AppTextStyles.bodyLarge.copyWith(
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
                color: AppTheme.textSecondary,
              ),
            ),
            const SizedBox(height: 4),
            Wrap(
              spacing: 8,
              runSpacing: 4,
              children: _userAttempts.map((attempt) => Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: AppTheme.error.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  attempt,
                  style: AppTextStyles.bodySmall.copyWith(
                    color: AppTheme.error,
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
                      gradient: _showHint ? AppTheme.disabledGradient : AppTheme.infoGradient,
                      borderRadius: BorderRadius.circular(16),
                      boxShadow: _showHint ? null : [
                        BoxShadow(
                          color: AppTheme.info.withOpacity(0.3),
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
                          style: AppTextStyles.bodyLarge.copyWith(
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
                      gradient: _userInput.isNotEmpty ? AppTheme.learningGradient : AppTheme.disabledGradient,
                      borderRadius: BorderRadius.circular(16),
                      boxShadow: _userInput.isNotEmpty ? [
                        BoxShadow(
                          color: AppTheme.learningColor.withOpacity(0.3),
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
                          style: AppTextStyles.bodyLarge.copyWith(
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
                      color: AppTheme.backgroundLight,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(
                        color: AppTheme.borderLight,
                      ),
                    ),
                    child: Text(
                      QyAppLocalizationKeys.qyListeningSkip.tr(context),
                      style: AppTextStyles.bodyMedium.copyWith(
                        color: AppTheme.textSecondary,
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
                        color: AppTheme.learningColor.withOpacity(0.3),
                      ),
                    ),
                    child: Text(
                      QyAppLocalizationKeys.qyListeningReplay.tr(context),
                      style: AppTextStyles.bodyMedium.copyWith(
                        color: AppTheme.learningColor,
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
        return AppTheme.success;
      case 'medium':
        return AppTheme.warning;
      case 'hard':
        return AppTheme.error;
      default:
        return AppTheme.info;
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
                  color: AppTheme.textPrimary,
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
                          style: AppTextStyles.bodyMedium.copyWith(
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
                  color: AppTheme.textPrimary,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 8),
              Text(
                '${_dictationWords[_currentWordIndex]['meaning']}',
                style: AppTextStyles.bodySmall.copyWith(
                  color: AppTheme.textSecondary,
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
                          style: AppTextStyles.bodyMedium.copyWith(
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
                          color: AppTheme.backgroundLight,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(
                            color: AppTheme.borderLight,
                          ),
                        ),
                        child: Text(
                          '重试',
                          style: AppTextStyles.bodyMedium.copyWith(
                            color: AppTheme.textSecondary,
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
                  color: AppTheme.textPrimary,
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
                          style: AppTextStyles.bodyMedium.copyWith(
                            color: AppTheme.textSecondary,
                          ),
                        ),
                        Text(
                          '$accuracy%',
                          style: AppTextStyles.bodyMedium.copyWith(
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
                          style: AppTextStyles.bodyMedium.copyWith(
                            color: AppTheme.textSecondary,
                          ),
                        ),
                        Text(
                          '$_correctCount/${_dictationWords.length}',
                          style: AppTextStyles.bodyMedium.copyWith(
                            color: AppTheme.textPrimary,
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
                          style: AppTextStyles.bodyMedium.copyWith(
                            color: AppTheme.textSecondary,
                          ),
                        ),
                        Text(
                          '$_attempts',
                          style: AppTextStyles.bodyMedium.copyWith(
                            color: AppTheme.textPrimary,
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
                          style: AppTextStyles.bodyMedium.copyWith(
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