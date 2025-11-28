/// Expert Dictation Practice Screen - Level 3
library;

import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../../../../../common/theme/base/theme_dimensions.dart';
import '../../../../../../common/theme/base/theme_text_styles.dart';
import '../../../../../../common/localization/localization_manager.dart';
import '../../../../../../common/widgets/custom_app_bar.dart';
import '../../../../../../common/widgets/buttons/primary_button.dart';
import '../../../localization_app_qy/localization_keys_app_qy.dart';
import '../../../resources_app_qy/colors_app_qy.dart';
import '../../../config_app_qy/storage_app_qy.dart';

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
      'context':
          'His entrepreneurial vision led to the creation of multiple successful companies.',
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
      duration: const Duration(milliseconds: 500),
      vsync: this,
    );
    _fadeAnimation = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeOut),
    );
    _pulseController = AnimationController(
      duration: const Duration(seconds: 2),
      vsync: this,
    )..repeat();
    _pulseAnimation = Tween<double>(begin: 0.8, end: 1.2).animate(
      CurvedAnimation(parent: _pulseController, curve: Curves.easeInOut),
    );
    _shimmerController = AnimationController(
      duration: const Duration(seconds: 3),
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
                    const SizedBox(height: ThemeDimensions.spacing20),
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
          padding: const EdgeInsets.symmetric(
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
                padding: const EdgeInsets.symmetric(
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
                  style: ThemeTextStyles.body2.copyWith(
                    color: Colors.white,
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
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                QyAppLocalizationKeys.qyListeningExpertProgress.tr(context),
                style: ThemeTextStyles.body1.copyWith(
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
                  const SizedBox(width: 8),
                  Text(
                    '${(_currentWordIndex / _expertWords.length * 100).toInt()}%',
                    style: ThemeTextStyles.body1.copyWith(
                      color: ColorsAppQy.qyPrimary,
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
              color: Colors.white.withOpacity(0.3),
              borderRadius: BorderRadius.circular(4),
            ),
            child: FractionallySizedBox(
              alignment: Alignment.centerLeft,
              widthFactor: _currentWordIndex / _expertWords.length,
              child: Container(
                decoration: BoxDecoration(
                  gradient: ColorsAppQy.qyPrimaryGradient,
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

    return Container(
      margin: const EdgeInsets.all(16),
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        gradient: ColorsAppQy.qyFrostedGlassGradient,
        borderRadius: BorderRadius.circular(ThemeDimensions.radiusLarge),
      ),
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  gradient: ColorsAppQy.qyPrimaryGradient,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(
                  QyAppLocalizationKeys.qyListeningExpertLevel.tr(context),
                  style: ThemeTextStyles.caption.copyWith(
                    color: Colors.white,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: ColorsAppQy.qyPrimary.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(
                  currentWord['category'].toString().toUpperCase(),
                  style: ThemeTextStyles.caption.copyWith(
                    color: ColorsAppQy.qyPrimary,
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
              style: ThemeTextStyles.h4.copyWith(
                color: ColorsAppQy.qyTextSecondary,
                fontStyle: FontStyle.italic,
              ),
            ),
            const SizedBox(height: 12),
          ],
          if (_showMeaning) ...[
            Text(
              currentWord['meaning'],
              style: ThemeTextStyles.body2.copyWith(
                color: ColorsAppQy.qyTextPrimary,
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
                color: Colors.white.withOpacity(0.3),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                  color: Colors.white.withOpacity(0.3),
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    QyAppLocalizationKeys.qyListeningExamples.tr(context),
                    style: ThemeTextStyles.caption.copyWith(
                      color: ColorsAppQy.qyTextSecondary,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    currentWord['context'],
                    style: ThemeTextStyles.body1.copyWith(
                      color: ColorsAppQy.qyTextPrimary,
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
                color: ColorsAppQy.qyTextSecondary,
                size: 16,
              ),
              const SizedBox(width: 4),
              Text(
                '${QyAppLocalizationKeys.qyListeningSpeed.tr(context)}: ${_getSpeedText(currentWord['audioSpeed'])}',
                style: ThemeTextStyles.caption.copyWith(
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
                    borderRadius: BorderRadius.circular(60),
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
                          borderRadius:
                              BorderRadius.circular(_isPlaying ? 25 : 30),
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
          const SizedBox(height: 16),
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
      margin: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text(
                QyAppLocalizationKeys.qyListeningEnterExpert.tr(context),
                style: ThemeTextStyles.h4.copyWith(
                  color: ColorsAppQy.qyTextPrimary,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(width: 8),
              if (_streakCount >= 3)
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                      colors: [
                        ColorsAppQy.qyWarning,
                        ColorsAppQy.qyWarning.withOpacity(0.8)
                      ],
                    ),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(
                    '🔥 连胜 $_streakCount',
                    style: ThemeTextStyles.caption.copyWith(
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
                contentPadding: const EdgeInsets.all(16),
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
              style: ThemeTextStyles.body2.copyWith(
                color: ColorsAppQy.qyTextPrimary,
                fontWeight: FontWeight.w500,
              ),
              textCapitalization: TextCapitalization.none,
            ),
          ),
          if (_userAttempts.isNotEmpty) ...[
            const SizedBox(height: 12),
            Text(
              QyAppLocalizationKeys.qyListeningAttemptHistory.tr(context),
              style: ThemeTextStyles.caption.copyWith(
                color: ColorsAppQy.qyTextSecondary,
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
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: isRecent
                        ? ColorsAppQy.qyError.withOpacity(0.2)
                        : ColorsAppQy.qyError.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(8),
                    border: isRecent
                        ? Border.all(
                            color: ColorsAppQy.qyError.withOpacity(0.5))
                        : null,
                  ),
                  child: Text(
                    attempt,
                    style: ThemeTextStyles.caption.copyWith(
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

  Widget _buildHintButton(
      String label, IconData icon, bool isActive, VoidCallback onPressed) {
    return IconButton(
      onPressed: isActive ? null : onPressed,
      icon: Container(
        padding: const EdgeInsets.symmetric(vertical: 12),
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
            const SizedBox(width: 4),
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
      margin: const EdgeInsets.symmetric(horizontal: 16),
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
              const SizedBox(width: 12),
              Expanded(
                child: OutlinedButton(
                  onPressed: _skipWord,
                  style: OutlinedButton.styleFrom(
                    side: BorderSide(
                      color: Colors.white.withOpacity(0.3),
                    ),
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(16),
                    ),
                  ),
                  child: Text(
                    QyAppLocalizationKeys.qyListeningSkip.tr(context),
                    style: ThemeTextStyles.body1.copyWith(
                      color: ColorsAppQy.qyTextSecondary,
                      fontWeight: FontWeight.w600,
                    ),
                    textAlign: TextAlign.center,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
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
        content:
            Text('🎯 正在播放专家级发音: ${_expertWords[_currentWordIndex]['word']}'),
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
        _userInput == currentWord['word'].toString().toLowerCase();

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
                  gradient: ColorsAppQy.qyPrimaryGradient,
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
                style: ThemeTextStyles.h3.copyWith(
                  color: ColorsAppQy.qyPrimary,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 12),
              Text(
                '${_expertWords[_currentWordIndex]['word']}',
                style: ThemeTextStyles.h2.copyWith(
                  color: ColorsAppQy.qyTextPrimary,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                _expertWords[_currentWordIndex]['meaning'],
                style: ThemeTextStyles.body2.copyWith(
                  color: ColorsAppQy.qyTextPrimary,
                ),
                textAlign: TextAlign.center,
              ),
              if (_streakCount >= 3) ...[
                const SizedBox(height: 12),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                      colors: [
                        ColorsAppQy.qyWarning,
                        ColorsAppQy.qyWarning.withOpacity(0.8)
                      ],
                    ),
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: Text(
                    '🔥 连胜 $_streakCount',
                    style: ThemeTextStyles.body1.copyWith(
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
              const SizedBox(height: 16),
              Text(
                '还需努力',
                style: ThemeTextStyles.h3.copyWith(
                  color: ColorsAppQy.qyError,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.white.withOpacity(0.3),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Column(
                  children: [
                    Text(
                      '正确答案:',
                      style: ThemeTextStyles.caption.copyWith(
                        color: ColorsAppQy.qyTextSecondary,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      _expertWords[_currentWordIndex]['word'],
                      style: ThemeTextStyles.h4.copyWith(
                        color: ColorsAppQy.qyTextPrimary,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      _expertWords[_currentWordIndex]['phonetic'],
                      style: ThemeTextStyles.body1.copyWith(
                        color: ColorsAppQy.qyTextSecondary,
                        fontStyle: FontStyle.italic,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      _expertWords[_currentWordIndex]['meaning'],
                      style: ThemeTextStyles.body1.copyWith(
                        color: ColorsAppQy.qyTextPrimary,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),
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
                  const SizedBox(width: 12),
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
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                      child: Text(
                        QyAppLocalizationKeys.qyCommonCancel.tr(context),
                        style: ThemeTextStyles.body1.copyWith(
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
              const SizedBox(height: 20),
              Text(
                isExpert ? '🏆 专家认证通过！' : '🎯 挑战完成！',
                style: ThemeTextStyles.h2.copyWith(
                  color: isExpert
                      ? ColorsAppQy.qyPrimary
                      : ColorsAppQy.qySecondary,
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
                      isExpert
                          ? ColorsAppQy.qyPrimary.withOpacity(0.1)
                          : ColorsAppQy.qySecondary.withOpacity(0.1),
                      Colors.white.withOpacity(0.9),
                    ],
                  ),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(
                    color: isExpert
                        ? ColorsAppQy.qyPrimary.withOpacity(0.3)
                        : ColorsAppQy.qySecondary.withOpacity(0.3),
                  ),
                ),
                child: Column(
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          '最终准确率:',
                          style: ThemeTextStyles.body1.copyWith(
                            color: ColorsAppQy.qyTextSecondary,
                          ),
                        ),
                        Text(
                          '$accuracy%',
                          style: ThemeTextStyles.h4.copyWith(
                            color: isExpert
                                ? ColorsAppQy.qyPrimary
                                : ColorsAppQy.qySecondary,
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
                          style: ThemeTextStyles.body1.copyWith(
                            color: ColorsAppQy.qyTextSecondary,
                          ),
                        ),
                        Text(
                          '$_correctCount/${_expertWords.length}',
                          style: ThemeTextStyles.body1.copyWith(
                            color: ColorsAppQy.qyTextPrimary,
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
                          style: ThemeTextStyles.body1.copyWith(
                            color: ColorsAppQy.qyTextSecondary,
                          ),
                        ),
                        Text(
                          '$_streakCount',
                          style: ThemeTextStyles.body1.copyWith(
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
                          style: ThemeTextStyles.body1.copyWith(
                            color: ColorsAppQy.qyTextSecondary,
                          ),
                        ),
                        Text(
                          isExpert ? '⭐⭐⭐ 大师' : '⭐⭐ 专业',
                          style: ThemeTextStyles.body1.copyWith(
                            color: ColorsAppQy.qyPrimary,
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
