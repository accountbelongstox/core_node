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

class LearningLanguagesScreenAppQy extends StatefulWidget {
  const LearningLanguagesScreenAppQy({super.key});

  @override
  State<LearningLanguagesScreenAppQy> createState() => _LearningLanguagesScreenAppQyState();
}

class _LearningLanguagesScreenAppQyState extends State<LearningLanguagesScreenAppQy>
    with TickerProviderStateMixin {
  late final AnimationController _shimmerController;

  final Set<String> _selectedLanguages = {};
  String _nativeLanguage = DefaultLanguageConfigAppQy.defaultNativeLanguage;
  List<SupportedLanguageModel> _languages = [];
  bool _isLoading = true;
  String? _error;
  bool _hasChanges = false;

  @override
  void initState() {
    super.initState();
    _shimmerController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 3),
    )..repeat();

    _loadData();
  }

  @override
  void dispose() {
    _shimmerController.dispose();
    super.dispose();
  }

  Future<void> _loadData() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final authService = context.read<AuthServiceAppQy>();
      final user = authService.currentUser;

      _selectedLanguages.clear();
      _selectedLanguages.addAll(user?.learningLanguages ?? DefaultLanguageConfigAppQy.defaultLearningLanguages);
      _nativeLanguage = user?.nativeLanguage ?? DefaultLanguageConfigAppQy.defaultNativeLanguage;

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

  Future<void> _handleSave() async {
    if (_selectedLanguages.isEmpty) {
      _showError('Please select at least one learning language');
      return;
    }

    setState(() {
      _isLoading = true;
    });

    try {
      final apiService = ApiServiceAppQy();
      final response = await apiService.setUserLanguages(
        learningLanguages: _selectedLanguages.toList(),
        nativeLanguage: _nativeLanguage,
      );

      if (response['success'] == true) {
        final authService = context.read<AuthServiceAppQy>();
        await authService.refreshUser();

        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: const Text('Languages updated successfully'),
              backgroundColor: ColorsAppQy.qySuccess,
              behavior: SnackBarBehavior.floating,
            ),
          );
          context.push('/vocabulary-collections');
        }
      } else {
        _showError('Failed to update languages');
      }
    } catch (e) {
      _showError(e.toString());
    } finally {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  void _showError(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: ColorsAppQy.qyError,
        behavior: SnackBarBehavior.floating,
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
                          : _buildContent(),
                ),
                if (!_isLoading && _error == null) _buildBottomActions(),
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
                  'Learning Languages',
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
              'Select the languages you want to learn',
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
          Icon(Icons.error_outline, size: 64, color: ColorsAppQy.qyError),
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
            onPressed: _loadData,
            child: const Text('Retry'),
          ),
        ],
      ),
    );
  }

  Widget _buildContent() {
    return ListView(
      padding: const EdgeInsets.symmetric(horizontal: ThemeDimensions.spacing16),
      children: [
        _buildSection(
          title: 'Your Native Language',
          subtitle: 'Select your primary language',
          icon: Icons.home_rounded,
          iconGradient: LinearGradient(
            colors: [ColorsAppQy.qyInfo, ColorsAppQy.qyPrimaryDark],
          ),
          children: _languages.map((lang) {
            final isSelected = _nativeLanguage == lang.code;
            return _buildLanguageTile(
              language: lang,
              isSelected: isSelected,
              onTap: () {
                setState(() {
                  _nativeLanguage = lang.code;
                  _hasChanges = true;
                });
              },
              showCheckbox: false,
            );
          }).toList(),
        ),
        const SizedBox(height: ThemeDimensions.spacing24),
        _buildSection(
          title: 'Languages to Learn',
          subtitle: 'Select one or more languages',
          icon: Icons.school_rounded,
          iconGradient: LinearGradient(
            colors: [Colors.purple.shade400, Colors.purple.shade600],
          ),
          badge: _selectedLanguages.length.toString(),
          children: _languages.map((lang) {
            final isSelected = _selectedLanguages.contains(lang.code);
            return _buildLanguageTile(
              language: lang,
              isSelected: isSelected,
              onTap: () {
                setState(() {
                  if (isSelected) {
                    _selectedLanguages.remove(lang.code);
                  } else {
                    _selectedLanguages.add(lang.code);
                  }
                  _hasChanges = true;
                });
              },
              showCheckbox: true,
            );
          }).toList(),
        ),
        const SizedBox(height: ThemeDimensions.spacing80),
      ],
    );
  }

  Widget _buildSection({
    required String title,
    required String subtitle,
    required IconData icon,
    required Gradient iconGradient,
    required List<Widget> children,
    String? badge,
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
              color: ColorsAppQy.qyFrostMedium,
              width: 1.5,
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(ThemeDimensions.spacing8),
                    decoration: BoxDecoration(
                      gradient: iconGradient,
                      borderRadius: BorderRadius.circular(ThemeDimensions.radiusMedium),
                    ),
                    child: Icon(icon, color: ColorsAppQy.qyTextOnPrimary, size: 20),
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
                  if (badge != null)
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: ThemeDimensions.spacing12,
                        vertical: ThemeDimensions.spacing6,
                      ),
                      decoration: BoxDecoration(
                        gradient: iconGradient,
                        borderRadius: BorderRadius.circular(ThemeDimensions.radiusFull),
                      ),
                      child: Text(
                        badge,
                        style: ThemeTextStyles.caption.copyWith(
                          color: ColorsAppQy.qyTextOnPrimary,
                          fontWeight: FontWeight.bold,
                        ),
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
    required bool showCheckbox,
  }) {
    return Padding(
      padding: const EdgeInsets.only(bottom: ThemeDimensions.spacing8),
      child: Material(
        color: ColorsAppQy.qyPageBackground.withOpacity(0),
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
                  : ColorsAppQy.qyFrostLight,
              borderRadius: BorderRadius.circular(ThemeDimensions.radiusMedium),
              border: Border.all(
                color: isSelected
                    ? ColorsAppQy.qyPrimary.withOpacity(0.5)
                    : ColorsAppQy.qyFrostMedium,
                width: 1.5,
              ),
            ),
            child: Row(
              children: [
                if (showCheckbox)
                  Container(
                    width: 24,
                    height: 24,
                    decoration: BoxDecoration(
                      gradient: isSelected ? ColorsAppQy.qyPrimaryGradient : null,
                      border: !isSelected
                          ? Border.all(
                              color: ColorsAppQy.qyFrostMedium,
                              width: 2,
                            )
                          : null,
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: isSelected
                        ? Icon(Icons.check, size: 16, color: ColorsAppQy.qyTextOnPrimary)
                        : null,
                  )
                else
                  Container(
                    width: 24,
                    height: 24,
                    decoration: BoxDecoration(
                      gradient: isSelected ? ColorsAppQy.qyPrimaryGradient : null,
                      border: !isSelected
                          ? Border.all(
                              color: ColorsAppQy.qyFrostMedium,
                              width: 2,
                            )
                          : null,
                      shape: BoxShape.circle,
                    ),
                    child: isSelected
                        ? Icon(Icons.check, size: 16, color: ColorsAppQy.qyTextOnPrimary)
                        : null,
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
            ColorsAppQy.qyPageBackground.withOpacity(0),
            ColorsAppQy.qyPageBackground.withOpacity(0.95),
          ],
        ),
      ),
      child: SafeArea(
        top: false,
        child: Material(
          color: ColorsAppQy.qyPageBackground.withOpacity(0),
          child: InkWell(
            onTap: _selectedLanguages.isNotEmpty && _hasChanges ? _handleSave : null,
            borderRadius: BorderRadius.circular(ThemeDimensions.radiusFull),
            child: Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(vertical: ThemeDimensions.spacing16),
              decoration: BoxDecoration(
                gradient: _selectedLanguages.isNotEmpty && _hasChanges
                    ? ColorsAppQy.qyPrimaryGradient
                    : LinearGradient(
                        colors: [ColorsAppQy.qyTextSecondary, ColorsAppQy.qyTextTertiary],
                      ),
                borderRadius: BorderRadius.circular(ThemeDimensions.radiusFull),
                boxShadow: _selectedLanguages.isNotEmpty && _hasChanges
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
                'Continue to Vocabulary Selection',
                style: ThemeTextStyles.button.copyWith(
                  color: ColorsAppQy.qyTextOnPrimary,
                  fontWeight: FontWeight.bold,
                ),
                textAlign: TextAlign.center,
              ),
            ),
          ),
        ),
      ),
    );
  }
}
