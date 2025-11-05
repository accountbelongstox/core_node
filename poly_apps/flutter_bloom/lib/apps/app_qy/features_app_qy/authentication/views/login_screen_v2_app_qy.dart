/// Beautiful login screen with glassmorphism and gradients
/// Uses centralized i18n, theme, and settings systems
library;

import 'dart:async';
import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../../../../common/i18n/i18n_service.dart';
import '../../../../../../common/localization/localization_manager.dart';
import '../../../../../../common/theme/app_theme.dart';
import '../../../../../../common/widgets/gradient_button.dart';
import '../../../../../../common/widgets/glassmorphism_card.dart';
import '../../../../../../common/widgets/animations/animation_utils.dart';
import '../../../../../../common/services/settings_service.dart';
import '../../../../../../common/auth_v2/auth_v2.dart';
import '../../../provider_app_qy/user_provider_app_qy.dart';
import '../../../localization_app_qy/localization_keys_app_qy.dart';

class LoginScreenV2AppQy extends StatefulWidget {
  const LoginScreenV2AppQy({super.key});

  @override
  State<LoginScreenV2AppQy> createState() => _LoginScreenV2AppQyState();
}

class _LoginScreenV2AppQyState extends State<LoginScreenV2AppQy>
    with SingleTickerProviderStateMixin {
  final _formKey = GlobalKey<FormState>();
  final _phoneController = TextEditingController();
  final _codeController = TextEditingController();

  bool _showPhoneForm = false;
  bool _agreedToTerms = false;
  bool _isLoading = false;
  Timer? _resendTimer;
  int _countdownSeconds = 0;
  bool _showMoreOptions = false;

  late AnimationController _animationController;
  late Animation<double> _fadeAnimation;
  late Animation<Offset> _slideAnimation;

  final I18nService _i18n = I18nService();
  final SettingsService _settings = SettingsService();

  @override
  void initState() {
    super.initState();
    _initializeServices();
    _setupAnimations();
  }

  Future<void> _initializeServices() async {
    await _settings.initialize();
    final userProvider = Provider.of<UserProviderAppQy>(context, listen: false);
    await userProvider.initializeAuth();
  }

  void _setupAnimations() {
    _animationController = AnimationController(
      duration: const Duration(milliseconds: 1200),
      vsync: this,
    );

    _fadeAnimation = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _animationController, curve: Curves.easeIn),
    );

    _slideAnimation = Tween<Offset>(
      begin: const Offset(0, 0.3),
      end: Offset.zero,
    ).animate(
      CurvedAnimation(parent: _animationController, curve: Curves.easeOutCubic),
    );

    _animationController.forward();
  }

  @override
  void dispose() {
    _phoneController.dispose();
    _codeController.dispose();
    _resendTimer?.cancel();
    _animationController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Stack(
        children: [
          _buildGradientBackground(),
          _buildContent(),
        ],
      ),
    );
  }

  Widget _buildGradientBackground() {
    return AnimatedContainer(
      duration: ComponentStyles.normalDuration,
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            AppTheme.sunsetGradient.colors[0].withOpacity(0.7),
            AppTheme.sunsetGradient.colors[1].withOpacity(0.6),
            AppTheme.sunsetGradient.colors[2].withOpacity(0.5),
            AppTheme.primaryGreen.withOpacity(0.8),
          ],
          stops: const [0.0, 0.25, 0.75, 1.0],
        ),
      ),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 80, sigmaY: 80),
        child: Container(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [
                Colors.transparent,
                Colors.black.withOpacity(0.15),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildContent() {
    return SafeArea(
      child: FadeTransition(
        opacity: _fadeAnimation,
        child: SlideTransition(
          position: _slideAnimation,
          child: Consumer<UserProviderAppQy>(
            builder: (context, userProvider, child) {
              return SingleChildScrollView(
                padding: const EdgeInsets.symmetric(horizontal: 24.0),
                child: Column(
                  children: [
                    const SizedBox(height: 60),
                    _buildAppLogo(),
                    const SizedBox(height: 24),
                    _buildAppTitle(),
                    const SizedBox(height: 12),
                    _buildAppSubtitle(),
                    const SizedBox(height: 60),
                    if (_showPhoneForm)
                      _buildPhoneLoginCard(userProvider)
                    else
                      _buildLoginOptions(userProvider),
                    const SizedBox(height: 24),
                    _buildAgreementSection(),
                    const SizedBox(height: 32),
                    _buildBottomActions(),
                    const SizedBox(height: 20),
                  ],
                ),
              );
            },
          ),
        ),
      ),
    );
  }

  Widget _buildAppLogo() {
    return Hero(
      tag: 'app_logo',
      child: Container(
        width: 100,
        height: 100,
        decoration: BoxDecoration(
          gradient: AppTheme.primaryGradient,
          borderRadius: BorderRadius.circular(28),
          boxShadow: [
            BoxShadow(
              color: AppTheme.primaryGreen.withOpacity(0.5),
              blurRadius: 20,
              offset: const Offset(0, 10),
            ),
          ],
        ),
        child: const Icon(
          Icons.auto_stories,
          size: 50,
          color: Colors.white,
        ),
      ),
    );
  }

  Widget _buildAppTitle() {
    return Text(
      'app.slogan'.tr,
      style: const TextStyle(
        fontSize: 28,
        fontWeight: FontWeight.bold,
        color: Colors.white,
        shadows: [
          Shadow(
            color: Colors.black26,
            offset: Offset(0, 2),
            blurRadius: 4,
          ),
        ],
      ),
      textAlign: TextAlign.center,
    );
  }

  Widget _buildAppSubtitle() {
    return Text(
      'app.subtitle'.tr,
      style: TextStyle(
        fontSize: 16,
        color: Colors.white.withOpacity(0.9),
        shadows: const [
          Shadow(
            color: Colors.black26,
            offset: Offset(0, 1),
            blurRadius: 2,
          ),
        ],
      ),
    );
  }

  Widget _buildLoginOptions(UserProviderAppQy userProvider) {
    return Column(
      children: [
        GlassmorphismCard(
          borderRadius: 20,
          padding: const EdgeInsets.all(20),
          child: Column(
            children: [
              _buildPrimaryLoginButton(userProvider),
              const SizedBox(height: 16),
              _buildSecondaryLoginButton(userProvider),
            ],
          ),
        ),
        const SizedBox(height: 16),
        _buildMoreOptionsButton(),
        if (_showMoreOptions) ...[
          const SizedBox(height: 16),
          _buildAlternativeLogins(),
        ],
      ],
    );
  }

  Widget _buildPrimaryLoginButton(UserProviderAppQy userProvider) {
    return GradientButton(
      text: 'auth.phoneLogin'.tr,
      width: double.infinity,
      height: 56,
      icon: const Icon(Icons.phone, color: Colors.white),
      gradient: AppTheme.primaryGradient,
      onPressed: _agreedToTerms && !_isLoading ? _togglePhoneForm : null,
    );
  }

  Widget _buildSecondaryLoginButton(UserProviderAppQy userProvider) {
    return GradientButton(
      text: 'auth.wechatLogin'.tr,
      width: double.infinity,
      height: 56,
      icon: const Icon(Icons.wechat, color: Colors.white),
      gradient: const LinearGradient(
        colors: [Color(0xFF07C160), Color(0xFF05A352)],
      ),
      onPressed: _agreedToTerms && !_isLoading
          ? () => _handleWeChatLogin(userProvider)
          : null,
    );
  }

  Widget _buildMoreOptionsButton() {
    return TextButton.icon(
      onPressed: () {
        setState(() => _showMoreOptions = !_showMoreOptions);
      },
      icon: Icon(
        _showMoreOptions ? Icons.keyboard_arrow_up : Icons.keyboard_arrow_down,
        color: Colors.white,
      ),
      label: Text(
        _showMoreOptions
            ? QyAppLocalizationKeys.qyAuthCollapseOptions.tr(context)
            : QyAppLocalizationKeys.qyAuthMoreOptions.tr(context),
        style: const TextStyle(color: Colors.white),
      ),
    );
  }

  Widget _buildAlternativeLogins() {
    return GlassmorphismCard(
      borderRadius: 16,
      padding: const EdgeInsets.all(16),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceEvenly,
        children: [
          _buildSocialLoginIcon(
            icon: Icons.auto_stories,
            label: 'auth.accountLogin'.tr,
            gradient: AppTheme.primaryGradient,
            onTap: () {},
          ),
          _buildSocialLoginIcon(
            icon: Icons.circle,
            label: 'auth.weiboLogin'.tr,
            gradient: const LinearGradient(
              colors: [Color(0xFFFF8140), Color(0xFFFF6B6B)],
            ),
            onTap: () {},
          ),
        ],
      ),
    );
  }

  Widget _buildSocialLoginIcon({
    required IconData icon,
    required String label,
    required Gradient gradient,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 60,
            height: 60,
            decoration: BoxDecoration(
              gradient: gradient,
              shape: BoxShape.circle,
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withOpacity(0.2),
                  blurRadius: 8,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: Icon(icon, color: Colors.white, size: 28),
          ),
          const SizedBox(height: 8),
          Text(
            label,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 12,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPhoneLoginCard(UserProviderAppQy userProvider) {
    return Container(
      decoration: ComponentStyles.glassCardDecoration,
      child: Container(
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
        child: Padding(
          padding: const EdgeInsets.all(28),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  'auth.phoneLogin'.tr,
                  style: AppTextStyles.headline3.copyWith(
                    color: AppTheme.textPrimary,
                    fontWeight: FontWeight.bold,
                  ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: ComponentStyles.lg),
                _buildPhoneInput(userProvider),
                const SizedBox(height: ComponentStyles.md),
                _buildCodeInput(),
                const SizedBox(height: ComponentStyles.lg),
                _buildSubmitButton(userProvider),
                const SizedBox(height: ComponentStyles.sm),
                _buildBackButton(),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildPhoneInput(UserProviderAppQy userProvider) {
    return TextFormField(
      controller: _phoneController,
      keyboardType: TextInputType.phone,
      style: AppTextStyles.inputText.copyWith(color: AppTheme.textPrimary),
      decoration: ComponentStyles.primaryInputDecoration.copyWith(
        labelText: 'auth.phoneNumber'.tr,
        hintText: 'auth.pleaseEnterPhone'.tr,
        prefixIcon: Icon(Icons.phone, color: AppTheme.primaryGreen),
      ),
      validator: (value) {
        if (!userProvider.validatePhoneNumber(value ?? '')) {
          return 'auth.invalidPhone'.tr;
        }
        return null;
      },
    );
  }

  Widget _buildCodeInput() {
    return Row(
      children: [
        Expanded(
          child: TextFormField(
            controller: _codeController,
            keyboardType: TextInputType.number,
            style: const TextStyle(color: Colors.white),
            decoration: InputDecoration(
              labelText: 'auth.verificationCode'.tr,
              labelStyle: const TextStyle(color: Colors.white70),
              hintText: 'auth.pleaseEnterCode'.tr,
              hintStyle: const TextStyle(color: Colors.white38),
              prefixIcon: const Icon(Icons.message, color: Colors.white70),
              filled: true,
              fillColor: Colors.white.withOpacity(0.1),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide.none,
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide(color: Colors.white.withOpacity(0.2)),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: const BorderSide(color: Colors.white, width: 2),
              ),
            ),
            validator: (value) {
              final userProvider = Provider.of<UserProviderAppQy>(context, listen: false);
              if (!userProvider.validateVerificationCode(value ?? '')) {
                return 'auth.invalidCode'.tr;
              }
              return null;
            },
          ),
        ),
        const SizedBox(width: 12),
        _buildCodeButton(),
      ],
    );
  }

  Widget _buildCodeButton() {
    return Container(
      height: 56,
      decoration: BoxDecoration(
        gradient: _countdownSeconds > 0
            ? null
            : const LinearGradient(
                colors: [Color(0xFF4CAF50), Color(0xFF66BB6A)],
              ),
        color: _countdownSeconds > 0 ? Colors.white.withOpacity(0.2) : null,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: _countdownSeconds > 0 || _isLoading
              ? null
              : () {
                  final userProvider = Provider.of<UserProviderAppQy>(context, listen: false);
                  _sendVerificationCode(userProvider);
                },
          borderRadius: BorderRadius.circular(12),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Center(
              child: Text(
                _countdownSeconds > 0
                    ? 'auth.countdown'.trParams({'seconds': _countdownSeconds})
                    : 'auth.getCode'.tr,
                style: const TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildSubmitButton(UserProviderAppQy userProvider) {
    return GradientButton(
      text: 'auth.login'.tr,
      width: double.infinity,
      height: 56,
      gradient: AppTheme.primaryGradient,
      onPressed: _isLoading ? null : () => _handlePhoneLogin(userProvider),
      icon: _isLoading
          ? const SizedBox(
              width: 20,
              height: 20,
              child: CircularProgressIndicator(
                strokeWidth: 2,
                valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
              ),
            )
          : null,
    );
  }

  Widget _buildBackButton() {
    return BouncingButton(
      onPressed: () => setState(() => _showPhoneForm = false),
      child: Text(
        'common.back'.tr,
        style: AppTextStyles.buttonText.copyWith(
          color: AppTheme.textSecondary,
          fontWeight: FontWeight.w500,
        ),
      ),
    );
  }

  Widget _buildAgreementSection() {
    return GlassmorphismCard(
      borderRadius: 12,
      padding: const EdgeInsets.all(12),
      child: Row(
        children: [
          SizedBox(
            width: 24,
            height: 24,
            child: Checkbox(
              value: _agreedToTerms,
              onChanged: (value) => setState(() => _agreedToTerms = value ?? false),
              fillColor: WidgetStateProperty.resolveWith((states) {
                if (states.contains(WidgetState.selected)) {
                  return AppTheme.primaryGreen;
                }
                return Colors.white.withOpacity(0.3);
              }),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(4),
              ),
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text.rich(
              TextSpan(
                style: const TextStyle(
                  fontSize: 12,
                  color: Colors.white70,
                ),
                children: [
                  TextSpan(text: 'auth.agreementPrefix'.tr),
                  TextSpan(
                    text: 'auth.userAgreement'.tr,
                    style: const TextStyle(
                      color: Colors.white,
                      decoration: TextDecoration.underline,
                    ),
                  ),
                  TextSpan(text: 'auth.and'.tr),
                  TextSpan(
                    text: 'auth.privacyPolicy'.tr,
                    style: const TextStyle(
                      color: Colors.white,
                      decoration: TextDecoration.underline,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBottomActions() {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        _buildBottomIcon(Icons.notifications_outlined, () {}),
        const SizedBox(width: 32),
        _buildBottomIcon(Icons.language, _showLanguageDialog),
        const SizedBox(width: 32),
        _buildBottomIcon(Icons.settings_outlined, () {}),
      ],
    );
  }

  Widget _buildBottomIcon(IconData icon, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 48,
        height: 48,
        decoration: BoxDecoration(
          color: Colors.white.withOpacity(0.15),
          shape: BoxShape.circle,
          border: Border.all(
            color: Colors.white.withOpacity(0.3),
            width: 1,
          ),
        ),
        child: Icon(icon, color: Colors.white, size: 24),
      ),
    );
  }

  void _togglePhoneForm() {
    setState(() => _showPhoneForm = true);
  }

  Future<void> _sendVerificationCode(UserProviderAppQy userProvider) async {
    if (_formKey.currentState?.validate() ?? false) {
      setState(() => _isLoading = true);

      try {
        final result = await userProvider.sendVerificationCode(_phoneController.text);

        if (result.success) {
          _startCountdown();
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text('auth.codeSent'.tr),
                backgroundColor: AppTheme.primaryGreen,
              ),
            );
          }
        } else {
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text(result.errorMessage ?? 'auth.sendCodeFailed'.tr),
                backgroundColor: Colors.red,
              ),
            );
          }
        }
      } finally {
        setState(() => _isLoading = false);
      }
    }
  }

  void _startCountdown() {
    setState(() => _countdownSeconds = 60);
    _resendTimer?.cancel();
    _resendTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      setState(() => _countdownSeconds--);
      if (_countdownSeconds <= 0) {
        timer.cancel();
      }
    });
  }

  Future<void> _handlePhoneLogin(UserProviderAppQy userProvider) async {
    if (_formKey.currentState?.validate() ?? false) {
      setState(() => _isLoading = true);

      try {
        final success = await userProvider.loginWithPhone(
          _phoneController.text,
          _codeController.text,
        );

        if (success && mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('auth.loginSuccess'.tr),
              backgroundColor: AppTheme.primaryGreen,
            ),
          );
          Navigator.of(context).pushReplacementNamed('/home');
        } else if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('auth.loginFailed'.tr),
              backgroundColor: Colors.red,
            ),
          );
        }
      } finally {
        setState(() => _isLoading = false);
      }
    }
  }

  Future<void> _handleWeChatLogin(UserProviderAppQy userProvider) async {
    setState(() => _isLoading = true);

    try {
      final success = await userProvider.loginWithWeChat();

      if (success && mounted) {
        Navigator.of(context).pushReplacementNamed(QyAppRoutesProvider.routeHome);
      } else if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('auth.loginFailed'.tr),
            backgroundColor: Colors.red,
          ),
        );
      }
    } finally {
      setState(() => _isLoading = false);
    }
  }

  void _showLanguageDialog() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('settings.language'.tr),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              title: Text(QyAppLocalizationKeys.qyLanguageChinese.tr(context)),
              trailing: _i18n.languageCode == 'zh'
                  ? const Icon(Icons.check, color: AppTheme.primaryGreen)
                  : null,
              onTap: () {
                _i18n.changeLanguage('zh');
                Navigator.pop(context);
              },
            ),
            ListTile(
              title: Text(QyAppLocalizationKeys.qyLanguageEnglish.tr(context)),
              trailing: _i18n.languageCode == 'en'
                  ? const Icon(Icons.check, color: AppTheme.primaryGreen)
                  : null,
              onTap: () {
                _i18n.changeLanguage('en');
                Navigator.pop(context);
              },
            ),
          ],
        ),
      ),
    );
  }
}
