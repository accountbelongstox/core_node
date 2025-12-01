import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:go_router/go_router.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:qyflutter/apps/app_qy/resources_app_qy/colors_app_qy.dart';
import 'package:qyflutter/apps/app_qy/services_app_qy/auth_service_app_qy.dart';
import 'package:qyflutter/apps/app_qy/services_app_qy/api_service_app_qy.dart';
import 'package:qyflutter/apps/app_qy/models_app_qy/vocabulary_models_app_qy.dart';
import 'package:qyflutter/apps/app_qy/config_app_qy/default_language_config_app_qy.dart';

class LanguageSelectionScreenAppQy extends StatefulWidget {
  const LanguageSelectionScreenAppQy({super.key});

  @override
  State<LanguageSelectionScreenAppQy> createState() => _LanguageSelectionScreenAppQyState();
}

class _LanguageSelectionScreenAppQyState extends State<LanguageSelectionScreenAppQy>
    with TickerProviderStateMixin {
  late final AnimationController _shimmerController;

  final Set<String> _selectedLearningLanguages = {DefaultLanguageConfigAppQy.defaultLearningLanguage};
  String _selectedNativeLanguage = DefaultLanguageConfigAppQy.defaultNativeLanguage;

  List<SupportedLanguageModel> _languages = [];
  bool _isLoading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _shimmerController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 3),
    )..repeat();

    _loadLanguages();
  }

  @override
  void dispose() {
    _shimmerController.dispose();
    super.dispose();
  }

  Future<void> _loadLanguages() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final apiService = ApiServiceAppQy();
      final response = await apiService.getSupportedLanguages();

      if (response['success'] == true) {
        final data = response['data'] as List<dynamic>?;
        if (data != null) {
          setState(() {
            _languages = data
                .map((json) => SupportedLanguageModel.fromJson(json as Map<String, dynamic>))
                .toList();
            _isLoading = false;
          });
          return;
        }
      }

      setState(() {
        _error = 'Failed to load languages';
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _error = e.toString();
        _isLoading = false;
      });
    }
  }

  Future<void> _handleContinue() async {
    if (_selectedLearningLanguages.isEmpty) {
      _showError('Please select at least one learning language');
      return;
    }

    try {
      final apiService = ApiServiceAppQy();
      final response = await apiService.setUserLanguages(
        learningLanguages: _selectedLearningLanguages.toList(),
        nativeLanguage: _selectedNativeLanguage,
      );

      if (response['success'] == true && mounted) {
        final authService = context.read<AuthServiceAppQy>();
        await authService.refreshUser();
        context.go('/home');
      } else {
        _showError('Failed to save language preferences');
      }
    } catch (e) {
      _showError(e.toString());
    }
  }

  void _showError(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: ColorsAppQy.qyError,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(ThemeDimensions.radiusMedium),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Stack(
        children: [
          _buildBackgroundGradient(),
          SafeArea(
            child: Column(
              children: [
                _buildHeader(),
                Expanded(
                  child: _isLoading
                      ? _buildLoadingState()
                      : _error != null
                          ? _buildErrorState()
                          : _buildLanguageList(),
                ),
                _buildBottomActions(),
              ],
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
            gradient: ColorsAppQy.qyDynamicShimmerGradient(_shimmerController.value),
          ),
        );
      },
    );
  }

  Widget _buildHeader() {
    return Padding(
      padding: const EdgeInsets.all(ThemeDimensions.spacing24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              IconButton(
                icon: const Icon(Icons.arrow_back, color: ColorsAppQy.qyTextPrimary),
                onPressed: () => context.pop(),
              ),
              const SizedBox(width: ThemeDimensions.spacing8),
              Expanded(
                child: Text(
                  'Choose Your Languages',
                  style: ThemeTextStyles.title1.copyWith(
                    color: ColorsAppQy.qyTextPrimary,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: ThemeDimensions.spacing8),
          Padding(
            padding: const EdgeInsets.only(left: 56),
            child: Text(
              'Select languages you want to learn and your native language',
              style: ThemeTextStyles.caption.copyWith(
                color: ColorsAppQy.qyTextSecondary,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildLoadingState() {
    return const Center(
      child: CircularProgressIndicator(
        valueColor: AlwaysStoppedAnimation<Color>(ColorsAppQy.qyPrimary),
      ),
    );
  }

  Widget _buildErrorState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(
            Icons.error_outline,
            size: 64,
            color: ColorsAppQy.qyError,
          ),
          const SizedBox(height: ThemeDimensions.spacing16),
          Text(
            _error ?? 'An error occurred',
            style: ThemeTextStyles.body.copyWith(
              color: ColorsAppQy.qyTextSecondary,
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: ThemeDimensions.spacing24),
          ElevatedButton(
            onPressed: _loadLanguages,
            child: const Text('Retry'),
          ),
        ],
      ),
    );
  }

  Widget _buildLanguageList() {
    return ListView(
      padding: const EdgeInsets.symmetric(horizontal: ThemeDimensions.spacing16),
      children: [
        _buildSectionCard(
          title: 'Learning Languages',
          subtitle: 'Select one or more languages you want to learn',
          icon: Icons.school_rounded,
          children: _languages.map((lang) {
            final isSelected = _selectedLearningLanguages.contains(lang.code);
            return _buildLanguageTile(
              language: lang,
              isSelected: isSelected,
              onTap: () {
                setState(() {
                  if (isSelected) {
                    _selectedLearningLanguages.remove(lang.code);
                  } else {
                    _selectedLearningLanguages.add(lang.code);
                  }
                });
              },
            );
          }).toList(),
        ),
        const SizedBox(height: ThemeDimensions.spacing24),
        _buildSectionCard(
          title: 'Native Language',
          subtitle: 'Select your primary language',
          icon: Icons.home_rounded,
          children: _languages.map((lang) {
            final isSelected = _selectedNativeLanguage == lang.code;
            return _buildLanguageTile(
              language: lang,
              isSelected: isSelected,
              isNativeLanguage: true,
              onTap: () {
                setState(() {
                  _selectedNativeLanguage = lang.code;
                });
              },
            );
          }).toList(),
        ),
        const SizedBox(height: ThemeDimensions.spacing80),
      ],
    );
  }

  Widget _buildSectionCard({
    required String title,
    required String subtitle,
    required IconData icon,
    required List<Widget> children,
  }) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(ThemeDimensions.radiusLarge),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 15, sigmaY: 15),
        child: Container(
          padding: const EdgeInsets.all(ThemeDimensions.spacing16),
          decoration: BoxDecoration(
            gradient: ColorsAppQy.qyFrostedGlassGradient,
            borderRadius: BorderRadius.circular(ThemeDimensions.radiusLarge),
            border: Border.all(
              color: Colors.white.withOpacity(0.2),
              width: 1.5,
            ),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(0.1),
                blurRadius: 20,
                offset: const Offset(0, 8),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(ThemeDimensions.spacing8),
                    decoration: BoxDecoration(
                      gradient: ColorsAppQy.qyPrimaryGradient,
                      borderRadius: BorderRadius.circular(ThemeDimensions.radiusMedium),
                    ),
                    child: Icon(icon, color: Colors.white, size: 20),
                  ),
                  const SizedBox(width: ThemeDimensions.spacing12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          title,
                          style: ThemeTextStyles.title3.copyWith(
                            color: ColorsAppQy.qyTextPrimary,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        Text(
                          subtitle,
                          style: ThemeTextStyles.caption.copyWith(
                            color: ColorsAppQy.qyTextSecondary,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: ThemeDimensions.spacing16),
              ...children,
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildLanguageTile({
    required SupportedLanguageModel language,
    required bool isSelected,
    required VoidCallback onTap,
    bool isNativeLanguage = false,
  }) {
    return Padding(
      padding: const EdgeInsets.only(bottom: ThemeDimensions.spacing8),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(ThemeDimensions.radiusMedium),
          child: Container(
            padding: const EdgeInsets.symmetric(
              horizontal: ThemeDimensions.spacing16,
              vertical: ThemeDimensions.spacing12,
            ),
            decoration: BoxDecoration(
              color: isSelected
                  ? ColorsAppQy.qyPrimary.withOpacity(0.1)
                  : Colors.white.withOpacity(0.05),
              borderRadius: BorderRadius.circular(ThemeDimensions.radiusMedium),
              border: Border.all(
                color: isSelected
                    ? ColorsAppQy.qyPrimary.withOpacity(0.5)
                    : Colors.white.withOpacity(0.1),
                width: 1.5,
              ),
            ),
            child: Row(
              children: [
                if (isSelected)
                  Container(
                    width: 24,
                    height: 24,
                    decoration: BoxDecoration(
                      gradient: ColorsAppQy.qyPrimaryGradient,
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(
                      Icons.check,
                      size: 16,
                      color: Colors.white,
                    ),
                  )
                else
                  Container(
                    width: 24,
                    height: 24,
                    decoration: BoxDecoration(
                      border: Border.all(
                        color: Colors.white.withOpacity(0.3),
                        width: 2,
                      ),
                      shape: isNativeLanguage ? BoxShape.circle : BoxShape.circle,
                    ),
                  ),
                const SizedBox(width: ThemeDimensions.spacing12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        language.name,
                        style: ThemeTextStyles.body.copyWith(
                          color: ColorsAppQy.qyTextPrimary,
                          fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal,
                        ),
                      ),
                      if (language.nativeName.isNotEmpty &&
                          language.nativeName != language.name)
                        Text(
                          language.nativeName,
                          style: ThemeTextStyles.caption.copyWith(
                            color: ColorsAppQy.qyTextSecondary,
                          ),
                        ),
                    ],
                  ),
                ),
                if (language.hasTts)
                  Icon(
                    Icons.volume_up_rounded,
                    size: 20,
                    color: ColorsAppQy.qyTextSecondary.withOpacity(0.5),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildBottomActions() {
    return Container(
      padding: const EdgeInsets.all(ThemeDimensions.spacing24),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [
            Colors.transparent,
            ColorsAppQy.qyPageBackground.withOpacity(0.95),
          ],
        ),
      ),
      child: SafeArea(
        top: false,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (_selectedLearningLanguages.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(bottom: ThemeDimensions.spacing16),
                child: Text(
                  'Selected ${_selectedLearningLanguages.length} learning language(s)',
                  style: ThemeTextStyles.caption.copyWith(
                    color: ColorsAppQy.qyTextSecondary,
                  ),
                ),
              ),
            Material(
              color: Colors.transparent,
              child: InkWell(
                onTap: _selectedLearningLanguages.isNotEmpty ? _handleContinue : null,
                borderRadius: BorderRadius.circular(ThemeDimensions.radiusFull),
                child: Container(
                  width: double.infinity,
                  padding: const EdgeInsets.symmetric(vertical: ThemeDimensions.spacing16),
                  decoration: BoxDecoration(
                    gradient: _selectedLearningLanguages.isNotEmpty
                        ? ColorsAppQy.qyPrimaryGradient
                        : LinearGradient(
                            colors: [Colors.grey.shade400, Colors.grey.shade500],
                          ),
                    borderRadius: BorderRadius.circular(ThemeDimensions.radiusFull),
                    boxShadow: _selectedLearningLanguages.isNotEmpty
                        ? [
                            BoxShadow(
                              color: ColorsAppQy.qyPrimary.withOpacity(0.4),
                              blurRadius: 15,
                              offset: const Offset(0, 8),
                            ),
                          ]
                        : null,
                  ),
                  child: Text(
                    'Continue',
                    style: ThemeTextStyles.button.copyWith(
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
      ),
    );
  }
}
