/// Word Listening AI Explain screen with advanced AI explanations
/// Follows Flutter Bloom architecture: theme centralization, glassmorphism, bento box layout
library;

import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:qyflutter/common/theme/base/theme_colors.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/common/widgets/animations/animation_utils.dart';
import 'package:qyflutter/common/widgets/cards/premium_cards.dart';
import 'package:qyflutter/common/widgets/buttons/primary_button.dart';
import 'package:qyflutter/apps/app_qy/resources_app_qy/colors_app_qy.dart';
import 'package:qyflutter/apps/app_qy/localization_app_qy/localization_keys_app_qy.dart';
import 'package:qyflutter/common/localization/localization_manager.dart';
import 'package:qyflutter/apps/app_qy/config_app_qy/storage_app_qy.dart';

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
  State<WordListeningAIExplainScreen> createState() =>
      _WordListeningAIExplainScreenState();
}

class _WordListeningAIExplainScreenState
    extends State<WordListeningAIExplainScreen> with TickerProviderStateMixin {
  late AnimationController _controller;
  late AnimationController _shimmerController;
  late Animation<double> _fadeAnimation;
  late Animation<Offset> _slideAnimation;
  late Animation<double> _shimmerAnimation;

  bool _isLoading = true;
  String _aiExplanation = '';
  String _etymology = '';
  List<String> _synonyms = [];
  List<String> _antonyms = [];
  List<String> _collocations = [];

  final StorageAppQy _storage = StorageAppQy.instance;

  @override
  void initState() {
    super.initState();
    _setupAnimations();
    _loadAIExplanation();
  }

  void _setupAnimations() {
    _controller = AnimationController(
      duration: const Duration(milliseconds: 600),
      vsync: this,
    );

    _shimmerController = AnimationController(
      duration: const Duration(milliseconds: 2000),
      vsync: this,
    )..repeat();

    _fadeAnimation = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeOut),
    );

    _slideAnimation = Tween<Offset>(
      begin: const Offset(0, 0.3),
      end: Offset.zero,
    ).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeOutCubic),
    );

    _shimmerAnimation = Tween<double>(begin: -2.0, end: 2.0).animate(
      CurvedAnimation(parent: _shimmerController, curve: Curves.linear),
    );

    _controller.forward();
  }

  Future<void> _loadAIExplanation() async {
    final cachedData = await _storage.getApp<Map<String, dynamic>>(
      'ai_explanation_${widget.word}',
    );

    if (cachedData != null) {
      setState(() {
        _aiExplanation = (cachedData['explanation'] as String?) ?? '';
        _etymology = (cachedData['etymology'] as String?) ?? '';
        _synonyms =
            List<String>.from((cachedData['synonyms'] as List<dynamic>?) ?? []);
        _antonyms =
            List<String>.from((cachedData['antonyms'] as List<dynamic>?) ?? []);
        _collocations = List<String>.from(
            (cachedData['collocations'] as List<dynamic>?) ?? []);
        _isLoading = false;
      });
      return;
    }

    await Future.delayed(const Duration(seconds: 2));

    final data = {
      'explanation': '''
${widget.word} is a very commonly used English word, widely applied in daily communication and professional fields.

The etymology of this word can be traced back to Latin, and through historical evolution, it has formed its modern English meaning.

Grammatically, ${widget.word} can be used as a verb, representing related actions or states.

In business environments, this word is often used to describe specific business scenarios and operational processes.
''',
      'etymology':
          'Derived from Latin, entered English through Old French, originally meaning...',
      'synonyms': ['synonym1', 'synonym2', 'synonym3'],
      'antonyms': ['antonym1', 'antonym2'],
      'collocations': [
        '${widget.word} management',
        '${widget.word} development',
        '${widget.word} strategy',
        '${widget.word} solution'
      ],
    };

    await _storage.setApp<Map<String, dynamic>>(
      'ai_explanation_${widget.word}',
      data,
    );

    setState(() {
      _aiExplanation = (data['explanation'] as String?) ?? '';
      _etymology = (data['etymology'] as String?) ?? '';
      _synonyms = List<String>.from((data['synonyms'] as List<dynamic>?) ?? []);
      _antonyms = List<String>.from((data['antonyms'] as List<dynamic>?) ?? []);
      _collocations =
          List<String>.from((data['collocations'] as List<dynamic>?) ?? []);
      _isLoading = false;
    });
  }

  @override
  void dispose() {
    _controller.dispose();
    _shimmerController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: AnimatedBuilder(
        animation: _shimmerController,
        builder: (context, child) {
          return Container(
            decoration: BoxDecoration(
              gradient:
                  ColorsAppQy.qyDynamicShimmerGradient(_shimmerAnimation.value),
            ),
            child: SafeArea(
              child: FadeTransition(
                opacity: _fadeAnimation,
                child: SlideTransition(
                  position: _slideAnimation,
                  child: Column(
                    children: [
                      _buildAppBar(context),
                      Expanded(
                        child: _isLoading
                            ? _buildLoadingState(context)
                            : _buildBentoBoxContent(context),
                      ),
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
              color: ThemeColors.textPrimary,
              size: ThemeDimensions.spacing24,
            ),
          ),
          Expanded(
            child: Text(
              QyAppLocalizationKeys.qyListeningAIExplainTitle.tr(context),
              style: ThemeTextStyles.headline4.copyWith(
                color: ThemeColors.textPrimary,
                fontWeight: FontWeight.bold,
              ),
              textAlign: TextAlign.center,
            ),
          ),
          BouncingButton(
            onPressed: _shareExplanation,
            child: Icon(
              Icons.share,
              color: ColorsAppQy.qyPrimary,
              size: ThemeDimensions.spacing24,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildLoadingState(BuildContext context) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          AnimationUtils.pulse(
            child: Container(
              width: ThemeDimensions.spacing80,
              height: ThemeDimensions.spacing80,
              decoration: BoxDecoration(
                gradient: ColorsAppQy.qyPrimaryGradient,
                borderRadius: BorderRadius.circular(ThemeDimensions.spacing40),
              ),
              child: Icon(
                Icons.psychology,
                color: ColorsAppQy.qyTextOnPrimary,
                size: ThemeDimensions.spacing40,
              ),
            ),
          ),
          SizedBox(height: ThemeDimensions.spacing24),
          Text(
            QyAppLocalizationKeys.qyListeningAIAnalyzing.tr(context),
            style: ThemeTextStyles.bodyLarge.copyWith(
              color: ThemeColors.textSecondary,
            ),
          ),
          SizedBox(height: ThemeDimensions.spacing16),
          CircularProgressIndicator(
            valueColor: AlwaysStoppedAnimation<Color>(ColorsAppQy.qyPrimary),
          ),
        ],
      ),
    );
  }

  Widget _buildBentoBoxContent(BuildContext context) {
    return SingleChildScrollView(
      padding: EdgeInsets.all(ThemeDimensions.spacing16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _buildWordHeaderCard(context),
          SizedBox(height: ThemeDimensions.spacing16),
          _buildBentoGrid(context),
          SizedBox(height: ThemeDimensions.spacing16),
          _buildActionButtons(context),
        ],
      ),
    );
  }

  Widget _buildWordHeaderCard(BuildContext context) {
    return GlassCard(
      padding: EdgeInsets.all(ThemeDimensions.spacing24),
      blurAmount: 15.0,
      opacity: 0.25,
      backgroundColor: ColorsAppQy.qyHolographicWhite,
      borderRadius: ThemeDimensions.borderRadiusL,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            widget.word,
            style: ThemeTextStyles.largeTitle.copyWith(
              color: ColorsAppQy.qyPrimary,
              fontWeight: FontWeight.bold,
            ),
          ),
          SizedBox(height: ThemeDimensions.spacing8),
          Text(
            widget.pronunciation,
            style: ThemeTextStyles.bodyLarge.copyWith(
              color: ThemeColors.textSecondary,
              fontStyle: FontStyle.italic,
            ),
          ),
          SizedBox(height: ThemeDimensions.spacing12),
          Text(
            widget.meaning,
            style: ThemeTextStyles.bodyLarge.copyWith(
              color: ThemeColors.textPrimary,
              fontWeight: FontWeight.w500,
            ),
          ),
          SizedBox(height: ThemeDimensions.spacing12),
          Container(
            padding: EdgeInsets.all(ThemeDimensions.spacing12),
            decoration: BoxDecoration(
              color: ColorsAppQy.qyFrostWhite.withOpacity(0.5),
              borderRadius: ThemeDimensions.borderRadiusM,
              border: Border.all(
                color: ColorsAppQy.qyBorderLight.withOpacity(0.3),
              ),
            ),
            child: Text(
              widget.example,
              style: ThemeTextStyles.bodyMedium.copyWith(
                color: ThemeColors.textSecondary,
                fontStyle: FontStyle.italic,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBentoGrid(BuildContext context) {
    return Column(
      children: [
        Row(
          children: [
            Expanded(
              flex: 2,
              child: _buildAICard(context),
            ),
            SizedBox(width: ThemeDimensions.spacing16),
            Expanded(
              flex: 1,
              child: _buildEtymologyCard(context),
            ),
          ],
        ),
        SizedBox(height: ThemeDimensions.spacing16),
        Row(
          children: [
            Expanded(
              child: _buildSynonymsCard(context),
            ),
            SizedBox(width: ThemeDimensions.spacing16),
            Expanded(
              child: _buildAntonymsCard(context),
            ),
          ],
        ),
        SizedBox(height: ThemeDimensions.spacing16),
        _buildCollocationsCard(context),
      ],
    );
  }

  Widget _buildAICard(BuildContext context) {
    return GlassCard(
      padding: EdgeInsets.all(ThemeDimensions.spacing20),
      blurAmount: 12.0,
      opacity: 0.2,
      backgroundColor: ColorsAppQy.qyGlassWhite,
      borderRadius: ThemeDimensions.borderRadiusL,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: EdgeInsets.all(ThemeDimensions.spacing8),
                decoration: BoxDecoration(
                  color: ColorsAppQy.qyPrimary.withOpacity(0.1),
                  borderRadius: ThemeDimensions.borderRadiusS,
                ),
                child: Icon(
                  Icons.psychology,
                  color: ColorsAppQy.qyPrimary,
                  size: ThemeDimensions.spacing24,
                ),
              ),
              SizedBox(width: ThemeDimensions.spacing12),
              Text(
                QyAppLocalizationKeys.qyListeningAIAnalysis.tr(context),
                style: ThemeTextStyles.headline5.copyWith(
                  color: ThemeColors.textPrimary,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ],
          ),
          SizedBox(height: ThemeDimensions.spacing16),
          Text(
            _aiExplanation,
            style: ThemeTextStyles.bodyLarge.copyWith(
              color: ThemeColors.textPrimary,
              height: 1.6,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildEtymologyCard(BuildContext context) {
    return GlassCard(
      padding: EdgeInsets.all(ThemeDimensions.spacing20),
      blurAmount: 12.0,
      opacity: 0.2,
      backgroundColor: ColorsAppQy.qyGlassLight,
      borderRadius: ThemeDimensions.borderRadiusL,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: EdgeInsets.all(ThemeDimensions.spacing8),
                decoration: BoxDecoration(
                  color: ColorsAppQy.qySecondary.withOpacity(0.1),
                  borderRadius: ThemeDimensions.borderRadiusS,
                ),
                child: Icon(
                  Icons.history,
                  color: ColorsAppQy.qySecondary,
                  size: ThemeDimensions.spacing20,
                ),
              ),
              SizedBox(width: ThemeDimensions.spacing8),
              Expanded(
                child: Text(
                  QyAppLocalizationKeys.qyListeningEtymology.tr(context),
                  style: ThemeTextStyles.headline6.copyWith(
                    color: ThemeColors.textPrimary,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ],
          ),
          SizedBox(height: ThemeDimensions.spacing12),
          Text(
            _etymology,
            style: ThemeTextStyles.bodyMedium.copyWith(
              color: ThemeColors.textPrimary,
              height: 1.5,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSynonymsCard(BuildContext context) {
    return GlassCard(
      padding: EdgeInsets.all(ThemeDimensions.spacing16),
      blurAmount: 10.0,
      opacity: 0.2,
      backgroundColor: ColorsAppQy.qyGlassWhite,
      borderRadius: ThemeDimensions.borderRadiusL,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(
                Icons.compare_arrows,
                color: ColorsAppQy.qyPrimary,
                size: ThemeDimensions.spacing20,
              ),
              SizedBox(width: ThemeDimensions.spacing8),
              Text(
                QyAppLocalizationKeys.qyListeningSynonyms.tr(context),
                style: ThemeTextStyles.headline6.copyWith(
                  color: ThemeColors.textPrimary,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ],
          ),
          SizedBox(height: ThemeDimensions.spacing12),
          ..._synonyms.map((word) => Padding(
                padding: EdgeInsets.only(bottom: ThemeDimensions.spacing8),
                child: Container(
                  padding: EdgeInsets.symmetric(
                    horizontal: ThemeDimensions.spacing12,
                    vertical: ThemeDimensions.spacing8,
                  ),
                  decoration: BoxDecoration(
                    color: ColorsAppQy.qyPrimary.withOpacity(0.1),
                    borderRadius: ThemeDimensions.borderRadiusS,
                    border: Border.all(
                      color: ColorsAppQy.qyPrimary.withOpacity(0.3),
                    ),
                  ),
                  child: Text(
                    word,
                    style: ThemeTextStyles.bodyMedium.copyWith(
                      color: ColorsAppQy.qyPrimary,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ),
              )),
        ],
      ),
    );
  }

  Widget _buildAntonymsCard(BuildContext context) {
    return GlassCard(
      padding: EdgeInsets.all(ThemeDimensions.spacing16),
      blurAmount: 10.0,
      opacity: 0.2,
      backgroundColor: ColorsAppQy.qyGlassWhite,
      borderRadius: ThemeDimensions.borderRadiusL,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(
                Icons.swap_horiz,
                color: ColorsAppQy.qyError,
                size: ThemeDimensions.spacing20,
              ),
              SizedBox(width: ThemeDimensions.spacing8),
              Text(
                QyAppLocalizationKeys.qyListeningAntonyms.tr(context),
                style: ThemeTextStyles.headline6.copyWith(
                  color: ThemeColors.textPrimary,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ],
          ),
          SizedBox(height: ThemeDimensions.spacing12),
          ..._antonyms.map((word) => Padding(
                padding: EdgeInsets.only(bottom: ThemeDimensions.spacing8),
                child: Container(
                  padding: EdgeInsets.symmetric(
                    horizontal: ThemeDimensions.spacing12,
                    vertical: ThemeDimensions.spacing8,
                  ),
                  decoration: BoxDecoration(
                    color: ColorsAppQy.qyError.withOpacity(0.1),
                    borderRadius: ThemeDimensions.borderRadiusS,
                    border: Border.all(
                      color: ColorsAppQy.qyError.withOpacity(0.3),
                    ),
                  ),
                  child: Text(
                    word,
                    style: ThemeTextStyles.bodyMedium.copyWith(
                      color: ColorsAppQy.qyError,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ),
              )),
        ],
      ),
    );
  }

  Widget _buildCollocationsCard(BuildContext context) {
    return GlassCard(
      padding: EdgeInsets.all(ThemeDimensions.spacing20),
      blurAmount: 12.0,
      opacity: 0.2,
      backgroundColor: ColorsAppQy.qyGlassWhite,
      borderRadius: ThemeDimensions.borderRadiusL,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: EdgeInsets.all(ThemeDimensions.spacing8),
                decoration: BoxDecoration(
                  color: ColorsAppQy.qySecondary.withOpacity(0.1),
                  borderRadius: ThemeDimensions.borderRadiusS,
                ),
                child: Icon(
                  Icons.link,
                  color: ColorsAppQy.qySecondary,
                  size: ThemeDimensions.spacing24,
                ),
              ),
              SizedBox(width: ThemeDimensions.spacing12),
              Text(
                QyAppLocalizationKeys.qyListeningCollocations.tr(context),
                style: ThemeTextStyles.headline5.copyWith(
                  color: ThemeColors.textPrimary,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ],
          ),
          SizedBox(height: ThemeDimensions.spacing16),
          Wrap(
            spacing: ThemeDimensions.spacing8,
            runSpacing: ThemeDimensions.spacing8,
            children: _collocations
                .map((collocation) => Container(
                      padding: EdgeInsets.symmetric(
                        horizontal: ThemeDimensions.spacing12,
                        vertical: ThemeDimensions.spacing8,
                      ),
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          colors: [
                            ColorsAppQy.qySecondary.withOpacity(0.1),
                            ColorsAppQy.qySecondary.withOpacity(0.05),
                          ],
                        ),
                        borderRadius:
                            BorderRadius.circular(ThemeDimensions.spacing20),
                        border: Border.all(
                          color: ColorsAppQy.qySecondary.withOpacity(0.3),
                        ),
                      ),
                      child: Text(
                        collocation,
                        style: ThemeTextStyles.bodyMedium.copyWith(
                          color: ColorsAppQy.qySecondary,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ))
                .toList(),
          ),
        ],
      ),
    );
  }

  Widget _buildActionButtons(BuildContext context) {
    return Column(
      children: [
        PrimaryButton(
          text: QyAppLocalizationKeys.qyListeningStartPractice.tr(context),
          onPressed: _practiceWord,
          isFullWidth: true,
        ),
        SizedBox(height: ThemeDimensions.spacing16),
        OutlinedButton(
          onPressed: () => Navigator.of(context).pop(),
          style: OutlinedButton.styleFrom(
            padding: EdgeInsets.symmetric(vertical: ThemeDimensions.spacing16),
            side: BorderSide(
              color: ColorsAppQy.qyPrimary,
              width: 2,
            ),
            shape: RoundedRectangleBorder(
              borderRadius: ThemeDimensions.borderRadiusL,
            ),
          ),
          child: SizedBox(
            width: double.infinity,
            child: Text(
              QyAppLocalizationKeys.qyListeningBackToStudy.tr(context),
              style: ThemeTextStyles.buttonText.copyWith(
                color: ColorsAppQy.qyPrimary,
              ),
              textAlign: TextAlign.center,
            ),
          ),
        ),
      ],
    );
  }

  void _shareExplanation() {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(QyAppLocalizationKeys.qyListeningShareInDev.tr(context)),
        backgroundColor: ColorsAppQy.qyPrimary,
      ),
    );
  }

  void _practiceWord() {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content:
            Text(QyAppLocalizationKeys.qyListeningPracticeInDev.tr(context)),
        backgroundColor: ColorsAppQy.qyPrimary,
      ),
    );
  }
}
