/// Word Listening AI Explain screen with advanced AI explanations
library;

import 'package:flutter/material.dart';
import '../../../../../../common/theme/app_theme.dart';
import '../../../../../../common/widgets/animations/animation_utils.dart';

class WordListeningAIExplainScreen extends StatefulWidget {
  final String word;
  final String pronunciation;
  final String meaning;
  final String example;

  const WordListeningAIExplainScreen({
    super.key,
    required this.word,
    required this.pronunciation,
    required this.meaning,
    required this.example,
  });

  @override
  State<WordListeningAIExplainScreen> createState() => _WordListeningAIExplainScreenState();
}

class _WordListeningAIExplainScreenState extends State<WordListeningAIExplainScreen>
    with TickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _fadeAnimation;
  late Animation<Offset> _slideAnimation;

  bool _isLoading = true;
  String _aiExplanation = '';
  String _etymology = '';
  List<String> _synonyms = [];
  List<String> _antonyms = [];
  List<String> _collocations = [];

  @override
  void initState() {
    super.initState();
    _setupAnimations();
    _loadAIExplanation();
  }

  void _setupAnimations() {
    _controller = AnimationController(
      duration: ComponentStyles.normalDuration,
      vsync: this,
    );

    _fadeAnimation = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _controller, curve: ComponentStyles.primaryCurve),
    );

    _slideAnimation = Tween<Offset>(
      begin: const Offset(0, 0.3),
      end: Offset.zero,
    ).animate(
      CurvedAnimation(parent: _controller, curve: ComponentStyles.secondaryCurve),
    );

    _controller.forward();
  }

  Future<void> _loadAIExplanation() async {
    // Simulate AI API call
    await Future.delayed(const Duration(seconds: 2));

    setState(() {
      _aiExplanation = '''
${widget.word} 是一个非常常用的英语词汇，在日常交流和专业领域中都有广泛应用。

这个词的词源可以追溯到拉丁语，经过历史演变形成了现代英语中的含义。

在语法上，${widget.word} 可以作为动词使用，表示相关的动作或状态。

在商务环境中，这个词经常用来描述具体的业务场景和操作流程。
''';

      _etymology = '源自拉丁语，通过古法语进入英语，最初含义为...';
      _synonyms = ['synonym1', 'synonym2', 'synonym3'];
      _antonyms = ['antonym1', 'antonym2'];
      _collocations = [
        '${widget.word} management',
        '${widget.word} development',
        '${widget.word} strategy',
        '${widget.word} solution'
      ];
      _isLoading = false;
    });
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              AppTheme.auroraGradient.colors[0].withOpacity(0.1),
              AppTheme.auroraGradient.colors[1].withOpacity(0.05),
              Colors.white,
            ],
          ),
        ),
        child: SafeArea(
          child: FadeTransition(
            opacity: _fadeAnimation,
            child: SlideTransition(
              position: _slideAnimation,
              child: Column(
                children: [
                  _buildAppBar(),
                  Expanded(
                    child: _isLoading ? _buildLoadingState() : _buildContent(),
                  ),
                ],
              ),
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
            child: Text(
              'AI智能解释',
              style: AppTextStyles.headline4.copyWith(
                color: AppTheme.textPrimary,
                fontWeight: FontWeight.bold,
              ),
              textAlign: TextAlign.center,
            ),
          ),
          BouncingButton(
            onPressed: _shareExplanation,
            child: Icon(
              Icons.share,
              color: AppTheme.primaryGreen,
              size: 24,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildLoadingState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          AnimationUtils.pulse(
            child: Container(
              width: 80,
              height: 80,
              decoration: BoxDecoration(
                gradient: AppTheme.auroraGradient,
                borderRadius: BorderRadius.circular(40),
              ),
              child: Icon(
                Icons.psychology,
                color: Colors.white,
                size: 40,
              ),
            ),
          ),
          const SizedBox(height: 24),
          Text(
            'AI正在分析单词...',
            style: AppTextStyles.bodyLarge.copyWith(
              color: AppTheme.textSecondary,
            ),
          ),
          const SizedBox(height: 16),
          const CircularProgressIndicator(
            valueColor: AlwaysStoppedAnimation<Color>(AppTheme.primaryGreen),
          ),
        ],
      ),
    );
  }

  Widget _buildContent() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _buildWordHeader(),
          const SizedBox(height: 24),
          _buildAIExplanation(),
          const SizedBox(height: 24),
          _buildEtymology(),
          const SizedBox(height: 24),
          _buildSynonymsAndAntonyms(),
          const SizedBox(height: 24),
          _buildCollocations(),
          const SizedBox(height: 32),
          _buildActionButtons(),
        ],
      ),
    );
  }

  Widget _buildWordHeader() {
    return AnimationUtils.fadeInWithSlide(
      child: Container(
        decoration: ComponentStyles.gradientCardDecoration,
        child: Container(
          padding: const EdgeInsets.all(24),
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
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                widget.word,
                style: AppTextStyles.headline1.copyWith(
                  color: AppTheme.primaryGreen,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                widget.pronunciation,
                style: AppTextStyles.bodyLarge.copyWith(
                  color: AppTheme.textSecondary,
                  fontStyle: FontStyle.italic,
                ),
              ),
              const SizedBox(height: 12),
              Text(
                widget.meaning,
                style: AppTextStyles.bodyLarge.copyWith(
                  color: AppTheme.textPrimary,
                  fontWeight: FontWeight.w500,
                ),
              ),
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppTheme.surfaceLight,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppTheme.borderLight),
                ),
                child: Text(
                  widget.example,
                  style: AppTextStyles.bodyMedium.copyWith(
                    color: AppTheme.textSecondary,
                    fontStyle: FontStyle.italic,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildAIExplanation() {
    return AnimationUtils.fadeInWithSlide(
      child: Container(
        decoration: ComponentStyles.primaryCardDecoration,
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: AppTheme.primaryGreen.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Icon(
                      Icons.psychology,
                      color: AppTheme.primaryGreen,
                      size: 24,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Text(
                    'AI智能解析',
                    style: AppTextStyles.headline5.copyWith(
                      color: AppTheme.textPrimary,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              Text(
                _aiExplanation,
                style: AppTextStyles.bodyLarge.copyWith(
                  color: AppTheme.textPrimary,
                  height: 1.6,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildEtymology() {
    return AnimationUtils.fadeInWithSlide(
      child: Container(
        decoration: ComponentStyles.primaryCardDecoration,
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: AppTheme.secondaryGreen.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Icon(
                      Icons.history,
                      color: AppTheme.secondaryGreen,
                      size: 24,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Text(
                    '词源解释',
                    style: AppTextStyles.headline5.copyWith(
                      color: AppTheme.textPrimary,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              Text(
                _etymology,
                style: AppTextStyles.bodyLarge.copyWith(
                  color: AppTheme.textPrimary,
                  height: 1.6,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildSynonymsAndAntonyms() {
    return AnimationUtils.fadeInWithSlide(
      child: Row(
        children: [
          Expanded(
            child: _buildWordList(
              '同义词',
              _synonyms,
              Icons.compare_arrows,
              AppTheme.newColor,
            ),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: _buildWordList(
              '反义词',
              _antonyms,
              Icons.swap_horiz,
              AppTheme.error,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildWordList(String title, List<String> words, IconData icon, Color color) {
    return Container(
      decoration: ComponentStyles.primaryCardDecoration,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(icon, color: color, size: 20),
                const SizedBox(width: 8),
                Text(
                  title,
                  style: AppTextStyles.headline5.copyWith(
                    color: AppTheme.textPrimary,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            ...words.map((word) => Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                decoration: BoxDecoration(
                  color: color.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: color.withOpacity(0.3)),
                ),
                child: Text(
                  word,
                  style: AppTextStyles.bodyMedium.copyWith(
                    color: color,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ),
            )),
          ],
        ),
      ),
    );
  }

  Widget _buildCollocations() {
    return AnimationUtils.fadeInWithSlide(
      child: Container(
        decoration: ComponentStyles.primaryCardDecoration,
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: AppTheme.accentGreen.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Icon(
                      Icons.link,
                      color: AppTheme.accentGreen,
                      size: 24,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Text(
                    '常用搭配',
                    style: AppTextStyles.headline5.copyWith(
                      color: AppTheme.textPrimary,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: _collocations.map((collocation) => Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: [
                        AppTheme.accentGreen.withOpacity(0.1),
                        AppTheme.learningColor.withOpacity(0.05),
                      ],
                    ),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(
                      color: AppTheme.accentGreen.withOpacity(0.3),
                    ),
                  ),
                  child: Text(
                    collocation,
                    style: AppTextStyles.bodyMedium.copyWith(
                      color: AppTheme.accentGreen,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                )).toList(),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildActionButtons() {
    return Column(
      children: [
        BouncingButton(
          onPressed: _practiceWord,
          child: Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(vertical: 16),
            decoration: BoxDecoration(
              gradient: AppTheme.primaryGradient,
              borderRadius: BorderRadius.circular(16),
              boxShadow: [
                BoxShadow(
                  color: AppTheme.shadowColored,
                  blurRadius: 12,
                  offset: const Offset(0, 6),
                ),
              ],
            ),
            child: Text(
              '开始练习',
              style: AppTextStyles.buttonText,
              textAlign: TextAlign.center,
            ),
          ),
        ),
        const SizedBox(height: 16),
        BouncingButton(
          onPressed: () => Navigator.of(context).pop(),
          child: Container(
            width: double.infinity,
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
              '返回学习',
              style: AppTextStyles.buttonText.copyWith(
                color: AppTheme.primaryGreen,
              ),
              textAlign: TextAlign.center,
            ),
          ),
        ),
      ],
    );
  }

  void _shareExplanation() {
    // Implement share functionality
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('分享功能开发中...'),
        backgroundColor: AppTheme.primaryGreen,
      ),
    );
  }

  void _practiceWord() {
    // Navigate to practice screen
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('练习功能开发中...'),
        backgroundColor: AppTheme.primaryGreen,
      ),
    );
  }
}