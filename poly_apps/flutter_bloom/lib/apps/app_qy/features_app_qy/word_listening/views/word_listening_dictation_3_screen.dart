/// Expert Dictation Practice Screen - Level 3
library;

import 'package:flutter/material.dart';
import '../../../../../../common/theme/app_theme.dart';
import '../../../../../../common/widgets/animations/animation_utils.dart';
import '../../../localization_app_qy/localization_manager.dart';
import '../../../localization_app_qy/localization_keys_app_qy.dart';

class WordListeningDictation3Screen extends StatefulWidget {
  const WordListeningDictation3Screen({super.key});

  @override
  State<WordListeningDictation3Screen> createState() => _WordListeningDictation3ScreenState();
}

class _WordListeningDictation3ScreenState extends State<WordListeningDictation3Screen>
    with TickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _fadeAnimation;
  late AnimationController _pulseController;
  late Animation<double> _pulseAnimation;

  final List<Map<String, dynamic>> _expertWords = [
    {
      'word': 'phenomenal',
      'phonetic': '/fəˈnɒmɪnl/',
      'meaning': '非凡的，惊人的',
      'difficulty': 'expert',
      'category': 'adjective',
      'examples': [
        'The performance was phenomenal.',
        'She has phenomenal memory.',
      ],
      'audioSpeed': 'normal',
      'context': 'The company achieved phenomenal growth this quarter.',
    },
    {
      'word': 'conscientious',
      'phonetic': '/ˌkɒnʃiˈenʃəs/',
      'meaning': '认真负责的，勤勉认真的',
      'difficulty': 'expert',
      'category': 'adjective',
      'examples': [
        'She is a conscientious student.',
        'He is conscientious about his work.',
      ],
      'audioSpeed': 'slow',
      'context': 'The conscientious employee always double-checked his work.',
    },
    {
      'word': 'unprecedented',
      'phonetic': '/ʌnˈpresɪdentɪd/',
      'meaning': '史无前例的，空前的',
      'difficulty': 'expert',
      'category': 'adjective',
      'examples': [
        'It was an unprecedented event.',
        'The crisis reached unprecedented levels.',
      ],
      'audioSpeed': 'slow',
      'context': 'The pandemic caused unprecedented changes in society.',
    },
    {
      'word': 'entrepreneurial',
      'phonetic': '/ˌɒntrəprəˈnɜːriəl/',
      'meaning': '创业的，企业家的',
      'difficulty': 'expert',
      'category': 'adjective',
      'examples': [
        'She has an entrepreneurial spirit.',
        'The program encourages entrepreneurial thinking.',
      ],
      'audioSpeed': 'slow',
      'context': 'His entrepreneurial vision led to the creation of multiple successful companies.',
    },
    {
      'word': 'sophisticated',
      'phonetic': '/səˈfɪstɪkeɪtɪd/',
      'meaning': '复杂的，精密的，久经世故的',
      'difficulty': 'expert',
      'category': 'adjective',
      'examples': [
        'The system is very sophisticated.',
        'She has sophisticated taste.',
      ],
      'audioSpeed': 'normal',
      'context': 'The research required sophisticated analytical techniques.',
    },
  ];

  int _currentWordIndex = 0;
  String _userInput = '';
  bool _isPlaying = false;
  bool _showPhonetic = false;
  bool _showMeaning = false;
  bool _showContext = false;
  bool _isCompleted = false;
  int _correctCount = 0;
  int _attempts = 0;
  final List<String> _userAttempts = [];
  int _streakCount = 0;

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
    _pulseController = AnimationController(
      duration: const Duration(seconds: 2),
      vsync: this,
    )..repeat();
    _pulseAnimation = Tween<double>(begin: 0.8, end: 1.2).animate(
      CurvedAnimation(parent: _pulseController, curve: Curves.easeInOut),
    );
    _controller.forward();
  }

  @override
  void dispose() {
    _controller.dispose();
    _pulseController.dispose();
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
              AppTheme.masteredGradient.colors[0].withOpacity(0.1),
              AppTheme.masteredGradient.colors[1].withOpacity(0.05),
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
                _buildProgressIndicator(),
                _buildExpertStatus(),
                _buildWordCard(),
                _buildAudioSection(),
                _buildInputSection(),
                _buildHintButtons(),
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
                  QyAppLocalizationKeys.qyListeningDictationExpertTitle.tr(context),
                  style: AppTextStyles.headline4.copyWith(
                    color: AppTheme.textPrimary,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                Text(
                  'Level 3 - 专家级词汇',
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
              gradient: AppTheme.masteredGradient,
              borderRadius: BorderRadius.circular(20),
            ),
            child: Text(
              '${_currentWordIndex + 1}/${_expertWords.length}',
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

  Widget _buildProgressIndicator() {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                QyAppLocalizationKeys.qyListeningExpertProgress.tr(context),
                style: AppTextStyles.bodyMedium.copyWith(
                  color: AppTheme.textSecondary,
                ),
              ),
              Row(
                children: [
                  if (_streakCount >= 3)
                    AnimationUtils.pulsingWidget(
                      Icon(
                        Icons.local_fire_department,
                        color: Colors.orange,
                        size: 20,
                      ),
                    ),
                  const SizedBox(width: 8),
                  Text(
                    '${(_currentWordIndex / _expertWords.length * 100).toInt()}%',
                    style: AppTextStyles.bodyMedium.copyWith(
                      color: AppTheme.masteredColor,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ],
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
              widthFactor: _currentWordIndex / _expertWords.length,
              child: Container(
                decoration: BoxDecoration(
                  gradient: AppTheme.masteredGradient,
                  borderRadius: BorderRadius.circular(4),
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
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            AppTheme.masteredColor.withOpacity(0.1),
            AppTheme.masteredColor.withOpacity(0.05),
          ],
        ),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: AppTheme.masteredColor.withOpacity(0.3),
        ),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceAround,
        children: [
          _buildStatusItem('🎯', QyAppLocalizationKeys.qyListeningAccuracy.tr(context), '${((_correctCount / _attempts * 100).round())}%', _correctCount > 0),
          _buildStatusItem('🔥', QyAppLocalizationKeys.qyListeningStreak.tr(context), '$_streakCount', _streakCount >= 3),
          _buildStatusItem('📝', QyAppLocalizationKeys.qyListeningAttempts.tr(context), '$_attempts', _attempts > 0),
          _buildStatusItem('⭐', QyAppLocalizationKeys.qyListeningLevel.tr(context), QyAppLocalizationKeys.qyListeningExpert.tr(context), true),
        ],
      ),
    );
  }

  Widget _buildStatusItem(String emoji, String label, String value, bool isHighlight) {
    return Column(
      children: [
        Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(
            color: isHighlight ? AppTheme.masteredColor.withOpacity(0.1) : AppTheme.backgroundLight,
            borderRadius: BorderRadius.circular(20),
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
          style: AppTextStyles.bodySmall.copyWith(
            color: AppTheme.textSecondary,
          ),
        ),
        Text(
          value,
          style: AppTextStyles.bodySmall.copyWith(
            color: isHighlight ? AppTheme.masteredColor : AppTheme.textPrimary,
            fontWeight: FontWeight.bold,
          ),
        ),
      ],
    );
  }

  Widget _buildWordCard() {
    final currentWord = _expertWords[_currentWordIndex];

    return Container(
      margin: const EdgeInsets.all(16),
      padding: const EdgeInsets.all(24),
      decoration: ComponentStyles.primaryCardDecoration,
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  gradient: AppTheme.masteredGradient,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(
                  QyAppLocalizationKeys.qyListeningExpertLevel.tr(context),
                  style: AppTextStyles.bodySmall.copyWith(
                    color: Colors.white,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: AppTheme.masteredColor.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(
                  currentWord['category'].toString().toUpperCase(),
                  style: AppTextStyles.bodySmall.copyWith(
                    color: AppTheme.masteredColor,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),
          if (_showPhonetic) ...[
            Text(
              currentWord['phonetic'],
              style: AppTextStyles.headline6.copyWith(
                color: AppTheme.textSecondary,
                fontStyle: FontStyle.italic,
              ),
            ),
            const SizedBox(height: 12),
          ],
          if (_showMeaning) ...[
            Text(
              currentWord['meaning'],
              style: AppTextStyles.bodyLarge.copyWith(
                color: AppTheme.textPrimary,
                fontWeight: FontWeight.w600,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 16),
          ],
          if (_showContext) ...[
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: AppTheme.backgroundLight,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                  color: AppTheme.borderLight,
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    QyAppLocalizationKeys.qyListeningExamples.tr(context),
                    style: AppTextStyles.bodySmall.copyWith(
                      color: AppTheme.textSecondary,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    currentWord['context'],
                    style: AppTextStyles.bodyMedium.copyWith(
                      color: AppTheme.textPrimary,
                    ),
                  ),
                ],
              ),
            ),
          ],
          const SizedBox(height: 16),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
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
          AnimatedBuilder(
            animation: _pulseAnimation,
            builder: (context, child) {
              return Transform.scale(
                scale: _isPlaying ? _pulseAnimation.value : 1.0,
                child: Container(
                  width: 120,
                  height: 120,
                  decoration: BoxDecoration(
                    gradient: AppTheme.masteredGradient,
                    borderRadius: BorderRadius.circular(60),
                    boxShadow: [
                      BoxShadow(
                        color: AppTheme.masteredColor.withOpacity(0.3),
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
                          color: AppTheme.masteredColor,
                          size: _isPlaying ? 30 : 36,
                        ),
                      ),
                    ),
                  ),
                ),
              );
            },
          ),
          const SizedBox(height: 16),
          Text(
            _isPlaying ? QyAppLocalizationKeys.qyListeningPlayingExpert.tr(context) : QyAppLocalizationKeys.qyListeningClickExpert.tr(context),
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
          Row(
            children: [
              Text(
                QyAppLocalizationKeys.qyListeningEnterExpert.tr(context),
                style: AppTextStyles.headline6.copyWith(
                  color: AppTheme.textPrimary,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(width: 8),
              if (_streakCount >= 3)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    gradient: AppTheme.warningGradient,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(
                    '🔥 连胜 $_streakCount',
                    style: AppTextStyles.bodySmall.copyWith(
                      color: Colors.white,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 12),
          Container(
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(
                color: _userInput.isNotEmpty ? AppTheme.masteredColor : AppTheme.borderLight,
                width: _userInput.isNotEmpty ? 3 : 2,
              ),
              boxShadow: [
                BoxShadow(
                  color: _userInput.isNotEmpty
                      ? AppTheme.masteredColor.withOpacity(0.2)
                      : AppTheme.shadowLight.withOpacity(0.1),
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
                hintText: QyAppLocalizationKeys.qyListeningInputExpert.tr(context),
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
                fontWeight: FontWeight.w500,
              ),
              textCapitalization: TextCapitalization.none,
            ),
          ),
          if (_userAttempts.isNotEmpty) ...[
            const SizedBox(height: 12),
            Text(
              QyAppLocalizationKeys.qyListeningAttemptHistory.tr(context),
              style: AppTextStyles.bodySmall.copyWith(
                color: AppTheme.textSecondary,
              ),
            ),
            const SizedBox(height: 4),
            Wrap(
              spacing: 8,
              runSpacing: 4,
              children: _userAttempts.asMap().entries.map((entry) {
                final index = entry.key;
                final attempt = entry.value;
                final isRecent = index == _userAttempts.length - 1;
                return Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: isRecent
                        ? AppTheme.error.withOpacity(0.2)
                        : AppTheme.error.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(8),
                    border: isRecent
                        ? Border.all(color: AppTheme.error.withOpacity(0.5))
                        : null,
                  ),
                  child: Text(
                    attempt,
                    style: AppTextStyles.bodySmall.copyWith(
                      color: AppTheme.error,
                      decoration: TextDecoration.lineThrough,
                      fontWeight: isRecent ? FontWeight.w600 : FontWeight.normal,
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
      margin: const EdgeInsets.symmetric(horizontal: 16),
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
              const SizedBox(width: 8),
              Expanded(
                child: _buildHintButton(
                  QyAppLocalizationKeys.qyListeningMeaning.tr(context),
                  Icons.translate,
                  _showMeaning,
                  () => _toggleHint('meaning'),
                ),
              ),
              const SizedBox(width: 8),
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

  Widget _buildHintButton(String label, IconData icon, bool isActive, VoidCallback onPressed) {
    return BouncingButton(
      onPressed: isActive ? null : onPressed,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12),
        decoration: BoxDecoration(
          gradient: isActive ? AppTheme.disabledGradient : AppTheme.infoGradient,
          borderRadius: BorderRadius.circular(12),
          boxShadow: isActive ? null : [
            BoxShadow(
              color: AppTheme.info.withOpacity(0.3),
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
            const SizedBox(width: 4),
            Text(
              label,
              style: AppTextStyles.bodySmall.copyWith(
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
      margin: const EdgeInsets.symmetric(horizontal: 16),
      child: Column(
        children: [
          Row(
            children: [
              Expanded(
                flex: 2,
                child: BouncingButton(
                  onPressed: _userInput.isNotEmpty ? _checkAnswer : null,
                  child: Container(
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    decoration: BoxDecoration(
                      gradient: _userInput.isNotEmpty ? AppTheme.masteredGradient : AppTheme.disabledGradient,
                      borderRadius: BorderRadius.circular(16),
                      boxShadow: _userInput.isNotEmpty ? [
                        BoxShadow(
                          color: AppTheme.masteredColor.withOpacity(0.3),
                          blurRadius: 12,
                          offset: const Offset(0, 4),
                        ),
                      ] : null,
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(
                          Icons.check_circle,
                          color: Colors.white,
                          size: 20,
                        ),
                        const SizedBox(width: 8),
                        Text(
                          QyAppLocalizationKeys.qyListeningVerifyAnswer.tr(context),
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
                  onPressed: _skipWord,
                  child: Container(
                    padding: const EdgeInsets.symmetric(vertical: 16),
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
            ],
          ),
          const SizedBox(height: 12),
          BouncingButton(
            onPressed: _playAudio,
            child: Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(vertical: 12),
              decoration: BoxDecoration(
                color: AppTheme.masteredColor.withOpacity(0.1),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(
                  color: AppTheme.masteredColor.withOpacity(0.3),
                ),
              ),
              child: Text(
                '🔊 重新播放发音',
                style: AppTextStyles.bodyMedium.copyWith(
                  color: AppTheme.masteredColor,
                  fontWeight: FontWeight.w600,
                ),
                textAlign: TextAlign.center,
              ),
            ),
          ),
        ],
      ),
    );
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
        content: Text('🎯 正在播放专家级发音: ${_expertWords[_currentWordIndex]['word']}'),
        backgroundColor: AppTheme.masteredColor,
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
    final isCorrect = _userInput == currentWord['word'].toString().toLowerCase();

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
                  gradient: AppTheme.masteredGradient,
                  borderRadius: BorderRadius.circular(50),
                ),
                child: const Icon(
                  Icons.emoji_events,
                  color: Colors.white,
                  size: 50,
                ),
              ),
              const SizedBox(height: 20),
              Text(
                _streakCount >= 3 ? '🔥 连胜成功！' : '专家级回答！',
                style: AppTextStyles.headline5.copyWith(
                  color: AppTheme.masteredColor,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 12),
              Text(
                '${_expertWords[_currentWordIndex]['word']}',
                style: AppTextStyles.headline4.copyWith(
                  color: AppTheme.textPrimary,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                _expertWords[_currentWordIndex]['meaning'],
                style: AppTextStyles.bodyLarge.copyWith(
                  color: AppTheme.textPrimary,
                ),
                textAlign: TextAlign.center,
              ),
              if (_streakCount >= 3) ...[
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(
                    gradient: AppTheme.warningGradient,
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: Text(
                    '🔥 连胜 $_streakCount',
                    style: AppTextStyles.bodyMedium.copyWith(
                      color: Colors.white,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ],
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
                          gradient: AppTheme.masteredGradient,
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Text(
                          '继续挑战',
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
                '还需努力',
                style: AppTextStyles.headline5.copyWith(
                  color: AppTheme.error,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: AppTheme.backgroundLight,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Column(
                  children: [
                    Text(
                      '正确答案:',
                      style: AppTextStyles.bodySmall.copyWith(
                        color: AppTheme.textSecondary,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      _expertWords[_currentWordIndex]['word'],
                      style: AppTextStyles.headline6.copyWith(
                        color: AppTheme.textPrimary,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      _expertWords[_currentWordIndex]['phonetic'],
                      style: AppTextStyles.bodyMedium.copyWith(
                        color: AppTheme.textSecondary,
                        fontStyle: FontStyle.italic,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      _expertWords[_currentWordIndex]['meaning'],
                      style: AppTextStyles.bodyMedium.copyWith(
                        color: AppTheme.textPrimary,
                      ),
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
                        _nextWord();
                      },
                      child: Container(
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        decoration: BoxDecoration(
                          gradient: AppTheme.primaryGradient,
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Text(
                          '继续学习',
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
                          '重新尝试',
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
                  gradient: isExpert ? AppTheme.masteredGradient : AppTheme.learningGradient,
                  borderRadius: BorderRadius.circular(60),
                ),
                child: Icon(
                  isExpert ? Icons.military_tech : Icons.school,
                  color: Colors.white,
                  size: 60,
                ),
              ),
              const SizedBox(height: 20),
              Text(
                isExpert ? '🏆 专家认证通过！' : '🎯 挑战完成！',
                style: AppTextStyles.headline4.copyWith(
                  color: isExpert ? AppTheme.masteredColor : AppTheme.learningColor,
                  fontWeight: FontWeight.bold,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 20),
              Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [
                      isExpert ? AppTheme.masteredColor.withOpacity(0.1) : AppTheme.learningColor.withOpacity(0.1),
                      Colors.white.withOpacity(0.9),
                    ],
                  ),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(
                    color: isExpert ? AppTheme.masteredColor.withOpacity(0.3) : AppTheme.learningColor.withOpacity(0.3),
                  ),
                ),
                child: Column(
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          '最终准确率:',
                          style: AppTextStyles.bodyMedium.copyWith(
                            color: AppTheme.textSecondary,
                          ),
                        ),
                        Text(
                          '$accuracy%',
                          style: AppTextStyles.headline6.copyWith(
                            color: isExpert ? AppTheme.masteredColor : AppTheme.learningColor,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
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
                          '$_correctCount/${_expertWords.length}',
                          style: AppTextStyles.bodyMedium.copyWith(
                            color: AppTheme.textPrimary,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          '最高连胜:',
                          style: AppTextStyles.bodyMedium.copyWith(
                            color: AppTheme.textSecondary,
                          ),
                        ),
                        Text(
                          '$_streakCount',
                          style: AppTextStyles.bodyMedium.copyWith(
                            color: Colors.orange,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          '专家等级:',
                          style: AppTextStyles.bodyMedium.copyWith(
                            color: AppTheme.textSecondary,
                          ),
                        ),
                        Text(
                          isExpert ? '⭐⭐⭐ 大师' : '⭐⭐ 专业',
                          style: AppTextStyles.bodyMedium.copyWith(
                            color: AppTheme.masteredColor,
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
                          gradient: isExpert ? AppTheme.masteredGradient : AppTheme.primaryGradient,
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Text(
                          '完成挑战',
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