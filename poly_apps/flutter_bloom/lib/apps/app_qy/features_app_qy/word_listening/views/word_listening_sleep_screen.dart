/// Word Listening Sleep Mode screen
library word_listening_sleep_screen;

import 'package:flutter/material.dart';
import '../../../../../../common/i18n/i18n_service.dart';
import '../../../../../../common/theme/app_theme.dart';
import '../../../../../../common/widgets/animations/animation_utils.dart';

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

  final List<String> _wordCategories = [
    '舒缓词汇',
    '自然词汇',
    '故事词汇',
    '诗歌词汇',
    '冥想词汇',
  ];

  String _selectedCategory = '舒缓词汇';

  @override
  void initState() {
    super.initState();
    _setupAnimations();
  }

  void _setupAnimations() {
    _fadeController = AnimationController(
      duration: ComponentStyles.normalDuration,
      vsync: this,
    );
    _pulseController = AnimationController(
      duration: const Duration(seconds: 2),
      vsync: this,
    );

    _fadeAnimation = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _fadeController, curve: ComponentStyles.primaryCurve),
    );

    _pulseAnimation = Tween<double>(begin: 0.8, end: 1.2).animate(
      CurvedAnimation(parent: _pulseController, curve: ComponentStyles.springCurve),
    );

    _fadeController.forward();
    _pulseController.repeat(reverse: true);
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
      body: AnimatedContainer(
        duration: const Duration(milliseconds: 500),
        decoration: BoxDecoration(
          gradient: _isDarkMode
              ? LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [
                    AppTheme.midnightGradient.colors[0].withOpacity(0.9),
                    AppTheme.midnightGradient.colors[1].withOpacity(0.8),
                    AppTheme.backgroundDark,
                  ],
                )
              : LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [
                    AppTheme.oceanGradient.colors[0].withOpacity(0.2),
                    AppTheme.oceanGradient.colors[1].withOpacity(0.1),
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
                Expanded(
                  child: _isPlaying ? _buildPlayingState() : _buildSetupState(),
                ),
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
              color: _isDarkMode ? Colors.white : AppTheme.textPrimary,
              size: 24,
            ),
          ),
          Expanded(
            child: Column(
              children: [
                Text(
                  '睡眠听力',
                  style: AppTextStyles.headline4.copyWith(
                    color: _isDarkMode ? Colors.white : AppTheme.textPrimary,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                Text(
                  '舒缓词汇，助眠入眠',
                  style: AppTextStyles.bodyMedium.copyWith(
                    color: _isDarkMode ? Colors.white70 : AppTheme.textSecondary,
                  ),
                ),
              ],
            ),
          ),
          BouncingButton(
            onPressed: _toggleDarkMode,
            child: Icon(
              _isDarkMode ? Icons.light_mode : Icons.dark_mode,
              color: _isDarkMode ? Colors.white : AppTheme.textPrimary,
              size: 24,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSetupState() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
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
                            ? AppTheme.midnightGradient
                            : AppTheme.oceanGradient,
                        borderRadius: BorderRadius.circular(60),
                        boxShadow: [
                          BoxShadow(
                            color: (_isDarkMode ? Colors.white : AppTheme.primaryGreen)
                                .withOpacity(0.3),
                            blurRadius: 20,
                            offset: const Offset(0, 10),
                          ),
                        ],
                      ),
                      child: Icon(
                        Icons.bedtime,
                        color: Colors.white,
                        size: 60,
                      ),
                    ),
                  );
                },
              ),
              const SizedBox(height: 32),
              Text(
                '正在播放舒缓词汇...',
                style: AppTextStyles.headline4.copyWith(
                  color: _isDarkMode ? Colors.white : AppTheme.textPrimary,
                  fontWeight: FontWeight.w300,
                ),
              ),
              const SizedBox(height: 16),
              Text(
                '剩余时间: ${_formatTime(_remainingTime)}',
                style: AppTextStyles.bodyLarge.copyWith(
                  color: _isDarkMode ? Colors.white70 : AppTheme.textSecondary,
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
    return AnimationUtils.fadeInWithSlide(
      child: Container(
        height: 200,
        decoration: BoxDecoration(
          gradient: _isDarkMode
              ? AppTheme.midnightGradient
              : AppTheme.oceanGradient,
          borderRadius: BorderRadius.circular(20),
        ),
        child: Stack(
          children: [
            Positioned(
              top: 20,
              left: 20,
              child: Icon(
                Icons.nights_stay,
                color: Colors.white.withOpacity(0.3),
                size: 40,
              ),
            ),
            Positioned(
              top: 60,
              right: 30,
              child: Icon(
                Icons.cloud,
                color: Colors.white.withOpacity(0.2),
                size: 35,
              ),
            ),
            Positioned(
              bottom: 30,
              left: 40,
              child: Icon(
                Icons.star,
                color: Colors.white.withOpacity(0.4),
                size: 25,
              ),
            ),
            Center(
              child: AnimationUtils.pulse(
                child: Icon(
                  Icons.bedtime,
                  color: Colors.white,
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
      decoration: ComponentStyles.primaryCardDecoration,
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              '选择词汇类别',
              style: AppTextStyles.headline5.copyWith(
                color: _isDarkMode ? Colors.white : AppTheme.textPrimary,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 16),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: _wordCategories.map((category) {
                final isSelected = category == _selectedCategory;
                return BouncingButton(
                  onPressed: () => setState(() => _selectedCategory = category),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                    decoration: BoxDecoration(
                      gradient: isSelected
                          ? _isDarkMode
                              ? AppTheme.midnightGradient
                              : AppTheme.oceanGradient
                          : null,
                      color: isSelected ? null : Colors.white,
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(
                        color: isSelected
                            ? Colors.transparent
                            : _isDarkMode
                                ? Colors.white24
                                : AppTheme.borderLight,
                        width: isSelected ? 0 : 1,
                      ),
                    ),
                    child: Text(
                      category,
                      style: AppTextStyles.bodyMedium.copyWith(
                        color: isSelected
                            ? Colors.white
                            : _isDarkMode
                                ? Colors.white70
                                : AppTheme.textPrimary,
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
    );
  }

  Widget _buildDurationSelector() {
    return Container(
      decoration: ComponentStyles.primaryCardDecoration,
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              '播放时长',
              style: AppTextStyles.headline5.copyWith(
                color: _isDarkMode ? Colors.white : AppTheme.textPrimary,
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
    );
  }

  Widget _buildDurationButton(int minutes) {
    final isSelected = _selectedDuration == minutes;

    return Expanded(
      child: BouncingButton(
        onPressed: () => setState(() => _selectedDuration = minutes),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 16),
          decoration: BoxDecoration(
            gradient: isSelected
                ? (_isDarkMode
                    ? AppTheme.midnightGradient
                    : AppTheme.oceanGradient)
                : null,
            color: isSelected ? null : Colors.white,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: isSelected
                  ? Colors.transparent
                  : _isDarkMode
                      ? Colors.white24
                      : AppTheme.borderLight,
              width: isSelected ? 0 : 1,
            ),
          ),
          child: Text(
            '$minutes分钟',
            style: AppTextStyles.bodyMedium.copyWith(
              color: isSelected
                  ? Colors.white
                  : _isDarkMode
                      ? Colors.white70
                      : AppTheme.textPrimary,
              fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildSleepTips() {
    return Container(
      decoration: ComponentStyles.primaryCardDecoration,
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(
                  Icons.lightbulb,
                  color: AppTheme.warning,
                  size: 24,
                ),
                const SizedBox(width: 12),
                Text(
                  '睡眠小贴士',
                  style: AppTextStyles.headline5.copyWith(
                    color: _isDarkMode ? Colors.white : AppTheme.textPrimary,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            ...[
              '• 睡前1小时避免使用电子设备',
              '• 保持卧室温度在18-22°C',
              '• 使用柔和的背景音乐',
              '• 调整屏幕亮度至最低',
            ].map((tip) => Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Text(
                tip,
                style: AppTextStyles.bodyMedium.copyWith(
                  color: _isDarkMode ? Colors.white70 : AppTheme.textSecondary,
                ),
              ),
            )).toList(),
          ],
        ),
      ),
    );
  }

  Widget _buildStartButton() {
    return BouncingButton(
      onPressed: _startSleepMode,
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(vertical: 20),
        decoration: BoxDecoration(
          gradient: _isDarkMode ? AppTheme.midnightGradient : AppTheme.oceanGradient,
          borderRadius: BorderRadius.circular(20),
          boxShadow: [
            BoxShadow(
              color: (_isDarkMode ? Colors.white : AppTheme.primaryGreen)
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
              color: Colors.white,
              size: 28,
            ),
            const SizedBox(width: 12),
            Text(
              '开始睡眠听力',
              style: AppTextStyles.buttonText,
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
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white.withOpacity(0.2),
              borderRadius: BorderRadius.circular(30),
            ),
            child: Icon(
              Icons.skip_previous,
              color: Colors.white,
              size: 28,
            ),
          ),
        ),
        BouncingButton(
          onPressed: _togglePlayPause,
          child: Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: Colors.white.withOpacity(0.3),
              borderRadius: BorderRadius.circular(35),
            ),
            child: Icon(
              _isPlaying ? Icons.pause : Icons.play_arrow,
              color: Colors.white,
              size: 36,
            ),
          ),
        ),
        BouncingButton(
          onPressed: _nextWord,
          child: Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white.withOpacity(0.2),
              borderRadius: BorderRadius.circular(30),
            ),
            child: Icon(
              Icons.skip_next,
              color: Colors.white,
              size: 28,
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildSleepProgress() {
    return Container(
      margin: const EdgeInsets.all(16),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: _isDarkMode ? Colors.white.withOpacity(0.1) : AppTheme.surfaceLight,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: _isDarkMode ? Colors.white24 : AppTheme.borderLight,
        ),
      ),
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                '播放进度',
                style: AppTextStyles.bodyMedium.copyWith(
                  color: _isDarkMode ? Colors.white70 : AppTheme.textSecondary,
                ),
              ),
              Text(
                '${_formatTime(_remainingTime)}',
                style: AppTextStyles.bodyMedium.copyWith(
                  color: _isDarkMode ? Colors.white : AppTheme.textPrimary,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Container(
            height: 6,
            decoration: BoxDecoration(
              color: _isDarkMode ? Colors.white24 : AppTheme.surfaceLight,
              borderRadius: BorderRadius.circular(3),
            ),
            child: FractionallySizedBox(
              alignment: Alignment.centerLeft,
              widthFactor: 1 - (_remainingTime / (_selectedDuration * 60)),
              child: Container(
                decoration: BoxDecoration(
                  gradient: _isDarkMode
                      ? AppTheme.midnightGradient
                      : AppTheme.oceanGradient,
                  borderRadius: BorderRadius.circular(3),
                ),
              ),
            ),
          ),
          const SizedBox(height: 16),
          BouncingButton(
            onPressed: _stopSleepMode,
            child: Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(vertical: 16),
              decoration: BoxDecoration(
                color: AppTheme.error.withOpacity(0.2),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(
                  color: AppTheme.error,
                  width: 2,
                ),
              ),
              child: Text(
                '结束睡眠模式',
                style: AppTextStyles.buttonText.copyWith(
                  color: AppTheme.error,
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
        content: Text('上一个词汇'),
        backgroundColor: AppTheme.primaryGreen,
      ),
    );
  }

  void _nextWord() {
    // Next word logic
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('下一个词汇'),
        backgroundColor: AppTheme.primaryGreen,
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
          borderRadius: BorderRadius.circular(20),
        ),
        title: Text(
          '睡眠模式结束',
          style: AppTextStyles.headline5.copyWith(
            color: AppTheme.textPrimary,
          ),
        ),
        content: Text(
          '希望您有一个美好的睡眠！\n已播放 $_selectedDuration 分钟舒缓词汇。',
          style: AppTextStyles.bodyMedium,
          textAlign: TextAlign.center,
        ),
        actions: [
          BouncingButton(
            onPressed: () => Navigator.of(context).pop(),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
              decoration: BoxDecoration(
                color: AppTheme.primaryGreen,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Text(
                '好的',
                style: AppTextStyles.buttonText,
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