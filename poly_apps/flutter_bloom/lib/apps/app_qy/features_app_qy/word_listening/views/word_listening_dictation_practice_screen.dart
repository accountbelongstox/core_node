/// Word Listening Dictation Practice screen
library;

import 'package:flutter/material.dart';
import '../../../../../../common/theme/app_theme.dart';
import '../../../../../../common/widgets/animations/animation_utils.dart';

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
      duration: ComponentStyles.normalDuration,
      vsync: this,
    );
    _fadeAnimation = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _controller, curve: ComponentStyles.primaryCurve),
    );
    _controller.forward();
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
      body: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [
              AppTheme.learningGradient.colors[0].withOpacity(0.15),
              AppTheme.learningGradient.colors[1].withOpacity(0.08),
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
                Expanded(
                  child: _buildContent(currentWord),
                ),
                _buildBottomActions(),
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
              Icons.close,
              color: AppTheme.textPrimary,
              size: 24,
            ),
          ),
          Expanded(
            child: Column(
              children: [
                Text(
                  widget.title,
                  style: AppTextStyles.headline5.copyWith(
                    color: AppTheme.textPrimary,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                Text(
                  '第 ${_currentWordIndex + 1} / ${_words.length} 题',
                  style: AppTextStyles.bodyMedium.copyWith(
                    color: AppTheme.textSecondary,
                  ),
                ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            decoration: BoxDecoration(
              color: AppTheme.primaryGreen.withOpacity(0.1),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Text(
              '正确率: $_totalAttempts > 0 ? ${(_correctAnswers / _totalAttempts * 100).toInt()}% : 0%',
              style: AppTextStyles.bodySmall.copyWith(
                color: AppTheme.primaryGreen,
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
      margin: const EdgeInsets.all(16),
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                '练习进度',
                style: AppTextStyles.bodyMedium.copyWith(
                  color: AppTheme.textSecondary,
                ),
              ),
              Text(
                '${(_currentWordIndex / _words.length * 100).toInt()}%',
                style: AppTextStyles.bodyMedium.copyWith(
                  color: AppTheme.primaryGreen,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Container(
            height: 6,
            decoration: BoxDecoration(
              color: AppTheme.surfaceLight,
              borderRadius: BorderRadius.circular(3),
            ),
            child: FractionallySizedBox(
              alignment: Alignment.centerLeft,
              widthFactor: _currentWordIndex / _words.length,
              child: Container(
                decoration: BoxDecoration(
                  gradient: AppTheme.primaryGradient,
                  borderRadius: BorderRadius.circular(3),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildContent(Map<String, dynamic> currentWord) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        children: [
          _buildAudioPlayer(currentWord),
          const SizedBox(height: 24),
          _buildAnswerInput(currentWord),
          if (_showResult) ...[
            const SizedBox(height: 24),
            _buildResult(currentWord),
          ],
        ],
      ),
    );
  }

  Widget _buildAudioPlayer(Map<String, dynamic> currentWord) {
    return AnimationUtils.fadeInWithSlide(
      child: Container(
        decoration: ComponentStyles.gradientCardDecoration,
        child: Container(
          padding: const EdgeInsets.all(32),
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
              AnimationUtils.pulse(
                child: Container(
                  width: 100,
                  height: 100,
                  decoration: BoxDecoration(
                    gradient: AppTheme.learningGradient,
                    borderRadius: BorderRadius.circular(50),
                    boxShadow: [
                      BoxShadow(
                        color: AppTheme.learningPrimary.withOpacity(0.3),
                        blurRadius: 15,
                        offset: const Offset(0, 8),
                      ),
                    ],
                  ),
                  child: Icon(
                    _isPlaying ? Icons.volume_up : Icons.headphones,
                    color: Colors.white,
                    size: 50,
                  ),
                ),
              ),
              const SizedBox(height: 24),
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
                        _isPlaying ? '停止播放' : '播放单词',
                        style: AppTextStyles.buttonText,
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 16),
              Text(
                '播放次数: $_playCount / 3',
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
                '请输入听到的单词',
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
                  hintText: '在此输入单词...',
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
                            '提交答案',
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
                          '提示',
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
                _isCorrect ? '回答正确！' : '回答错误',
                style: AppTextStyles.headline4.copyWith(
                  color: _isCorrect ? AppTheme.masteredColor : AppTheme.error,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 16),
              if (!_isCorrect) ...[
                Text(
                  '正确答案',
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
                      '词义',
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
                      '例句',
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
                    '上一题',
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
                  _currentWordIndex < _words.length - 1 ? '下一题' : '完成',
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
        content: Text('提示：这个词以 "${word[0].toUpperCase()}" 开头，共 ${word.length} 个字母'),
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
                '练习完成！',
                style: AppTextStyles.headline3.copyWith(
                  color: AppTheme.textPrimary,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 16),
              Text(
                '正确率: $accuracy%',
                style: AppTextStyles.headline4.copyWith(
                  color: accuracy >= 80 ? AppTheme.masteredColor :
                         accuracy >= 60 ? AppTheme.learningColor : AppTheme.error,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                '正确答案: $_correctAnswers / $_totalAttempts',
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
                    '完成',
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