import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:go_router/go_router.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:qyflutter/common/localization/localization_manager.dart';
import 'package:qyflutter/apps/app_qy/resources_app_qy/colors_app_qy.dart';
import 'package:qyflutter/apps/app_qy/localization_app_qy/localization_keys_app_qy.dart';
import 'package:qyflutter/apps/app_qy/services_app_qy/auth_service_app_qy.dart';
import 'package:qyflutter/apps/app_qy/router_app_qy/routes_provider_app_qy.dart';
import 'package:qyflutter/apps/app_qy/config_app_qy/default_language_config_app_qy.dart';

class LoginScreenRefactoredAppQy extends StatefulWidget {
  const LoginScreenRefactoredAppQy({super.key});

  @override
  State<LoginScreenRefactoredAppQy> createState() =>
      _LoginScreenRefactoredAppQyState();
}

class _LoginScreenRefactoredAppQyState extends State<LoginScreenRefactoredAppQy>
    with TickerProviderStateMixin {
  late final AnimationController _shimmerController;
  late final AnimationController _fadeController;

  final TextEditingController _usernameController = TextEditingController();
  final TextEditingController _emailController = TextEditingController();
  final TextEditingController _passwordController = TextEditingController();
  final TextEditingController _confirmPasswordController =
      TextEditingController();
  final TextEditingController _phoneController = TextEditingController();
  final TextEditingController _codeController = TextEditingController();

  bool _isRegisterMode = false;
  bool _isPhoneLogin = false;
  bool _agreedToTerms = false;
  bool _obscurePassword = true;
  bool _obscureConfirmPassword = true;
  int _countdown = 0;

  @override
  void initState() {
    super.initState();
    _shimmerController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 3),
    )..repeat();

    _fadeController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 500),
    )..forward();
  }

  @override
  void dispose() {
    _shimmerController.dispose();
    _fadeController.dispose();
    _usernameController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    _confirmPasswordController.dispose();
    _phoneController.dispose();
    _codeController.dispose();
    super.dispose();
  }

  Future<void> _handleLogin(AuthServiceAppQy authService) async {
    if (!_agreedToTerms) {
      _showError(QyAppLocalizationKeys.qyPleaseAgreeToTerms.tr(context));
      return;
    }

    bool success;
    if (_isPhoneLogin) {
      if (_phoneController.text.isEmpty || _codeController.text.isEmpty) {
        _showError(QyAppLocalizationKeys.qyPleaseEnterPhoneAndCode.tr(context));
        return;
      }

      success = await authService.login(
        phoneNumber: _phoneController.text.trim(),
        verificationCode: _codeController.text.trim(),
      );
    } else {
      if (_usernameController.text.isEmpty ||
          _passwordController.text.isEmpty) {
        _showError(
            QyAppLocalizationKeys.qyPleaseEnterUsernameAndPassword.tr(context));
        return;
      }

      success = await authService.login(
        username: _usernameController.text.trim(),
        password: _passwordController.text.trim(),
      );
    }

    if (success && mounted) {
      // Check if user needs initialization, otherwise go to home
      final user = authService.currentUser;
      final needsInit = user == null || 
          (user.learningLanguages.isEmpty || 
           user.learningLanguages.length == 1 && user.learningLanguages.first == DefaultLanguageConfigAppQy.defaultLearningLanguage);
      context.go(needsInit ? QyAppRoutesProvider.routeOnboarding : QyAppRoutesProvider.routeHome);
    } else if (mounted) {
      _showError(
          authService.error ?? QyAppLocalizationKeys.qyLoginFailed.tr(context));
    }
  }

  Future<void> _handleRegister(AuthServiceAppQy authService) async {
    if (!_agreedToTerms) {
      _showError(QyAppLocalizationKeys.qyPleaseAgreeToTerms.tr(context));
      return;
    }

    bool success;
    if (_isPhoneLogin) {
      if (_phoneController.text.isEmpty || _codeController.text.isEmpty) {
        _showError(QyAppLocalizationKeys.qyPleaseEnterPhoneAndCode.tr(context));
        return;
      }

      success = await authService.register(
        phoneNumber: _phoneController.text.trim(),
        verificationCode: _codeController.text.trim(),
      );
    } else {
      if (_usernameController.text.isEmpty ||
          _emailController.text.isEmpty ||
          _passwordController.text.isEmpty ||
          _confirmPasswordController.text.isEmpty) {
        _showError(QyAppLocalizationKeys.qyPleaseCompleteForm.tr(context));
        return;
      }

      if (_passwordController.text != _confirmPasswordController.text) {
        _showError(QyAppLocalizationKeys.qyPasswordsDoNotMatch.tr(context));
        return;
      }

      success = await authService.register(
        username: _usernameController.text.trim(),
        email: _emailController.text.trim(),
        password: _passwordController.text.trim(),
        confirmPassword: _confirmPasswordController.text.trim(),
      );
    }

    if (success && mounted) {
      _showSuccess(QyAppLocalizationKeys.qyRegisterSuccess.tr(context));
      Future.delayed(const Duration(seconds: 1), () {
        if (mounted) {
          // New users always need initialization
          context.go(QyAppRoutesProvider.routeOnboarding);
        }
      });
    } else if (mounted) {
      _showError(authService.error ??
          QyAppLocalizationKeys.qyRegisterFailed.tr(context));
    }
  }

  Future<void> _handleSendCode(AuthServiceAppQy authService) async {
    if (_phoneController.text.isEmpty) {
      _showError(QyAppLocalizationKeys.qyPleaseEnterPhone.tr(context));
      return;
    }

    if (_countdown > 0) {
      return;
    }

    final purpose = _isRegisterMode ? 'register' : 'login';
    final success = await authService.sendVerificationCode(
      _phoneController.text.trim(),
      purpose: purpose,
    );

    if (success) {
      setState(() {
        _countdown = 60;
      });
      _startCountdown();
    } else {
      _showError(authService.error ??
          QyAppLocalizationKeys.qyFailedToSendCode.tr(context));
    }
  }

  void _startCountdown() {
    Future.doWhile(() async {
      await Future.delayed(const Duration(seconds: 1));
      if (_countdown > 0 && mounted) {
        setState(() {
          _countdown--;
        });
        return true;
      }
      return false;
    });
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

  void _showSuccess(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: ColorsAppQy.qySuccess,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(ThemeDimensions.radiusMedium),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final authService = context.watch<AuthServiceAppQy>();

    return Scaffold(
      body: Stack(
        children: [
          _buildBackgroundGradient(),
          SafeArea(
            child: Column(
              children: [
                _buildBackButton(),
                Expanded(
                  child: Center(
                    child: SingleChildScrollView(
                      padding: const EdgeInsets.all(ThemeDimensions.spacing24),
                      child: FadeTransition(
                        opacity: _fadeController,
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            _buildLogo(),
                            const SizedBox(height: ThemeDimensions.spacing48),
                            _buildAuthCard(authService),
                            const SizedBox(height: ThemeDimensions.spacing24),
                            _buildTermsCheckbox(),
                            const SizedBox(height: ThemeDimensions.spacing16),
                            _buildModeSwitch(),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
          if (authService.isLoading)
            Container(
              color: ColorsAppQy.qyShadowMedium,
              child: const Center(
                child: CircularProgressIndicator(
                  valueColor:
                      AlwaysStoppedAnimation<Color>(ColorsAppQy.qyPrimary),
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildBackButton() {
    return Padding(
      padding: const EdgeInsets.all(ThemeDimensions.spacing16),
      child: Align(
        alignment: Alignment.topLeft,
        child: Material(
          color: ColorsAppQy.qyPageBackground.withOpacity(0),
          child: InkWell(
            onTap: () {
              context.go(QyAppRoutesProvider.routeHome);
            },
            borderRadius: BorderRadius.circular(ThemeDimensions.radiusFull),
            child: Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: ColorsAppQy.qyFrostMedium,
                borderRadius: BorderRadius.circular(ThemeDimensions.radiusFull),
                border: Border.all(
                  color: ColorsAppQy.qyFrostMedium,
                  width: 1,
                ),
              ),
              child: Icon(
                Icons.arrow_back_rounded,
                color: ColorsAppQy.qyTextPrimary,
                size: 24,
              ),
            ),
          ),
        ),
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

  Widget _buildLogo() {
    return Container(
      width: 100,
      height: 100,
      decoration: BoxDecoration(
        gradient: ColorsAppQy.qyPrimaryGradient,
        borderRadius: BorderRadius.circular(ThemeDimensions.radiusFull),
        boxShadow: [
          BoxShadow(
            color: ColorsAppQy.qyPrimary.withOpacity(0.3),
            blurRadius: 20,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: const Icon(
        Icons.school_rounded,
        size: 50,
        color: ColorsAppQy.qyTextOnPrimary,
      ),
    );
  }

  Widget _buildAuthCard(AuthServiceAppQy authService) {
    return Container(
      constraints: const BoxConstraints(maxWidth: 400),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(ThemeDimensions.radiusLarge),
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 15, sigmaY: 15),
          child: Container(
            padding: const EdgeInsets.all(ThemeDimensions.spacing24),
            decoration: BoxDecoration(
              gradient: ColorsAppQy.qyFrostedGlassGradient,
              borderRadius: BorderRadius.circular(ThemeDimensions.radiusLarge),
              border: Border.all(
                color: ColorsAppQy.qyFrostMedium,
                width: 1.5,
              ),
              boxShadow: [
                BoxShadow(
                  color: ColorsAppQy.qyShadowLight,
                  blurRadius: 30,
                  offset: const Offset(0, 10),
                ),
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  QyAppLocalizationKeys.qyWelcome.tr(context),
                  style: ThemeTextStyles.title1.copyWith(
                    color: ColorsAppQy.qyTextPrimary,
                    fontWeight: FontWeight.bold,
                  ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: ThemeDimensions.spacing8),
                Text(
                  _isRegisterMode
                      ? QyAppLocalizationKeys.qyRegisterToContinue.tr(context)
                      : QyAppLocalizationKeys.qyLoginToContinue.tr(context),
                  style: ThemeTextStyles.caption.copyWith(
                    color: ColorsAppQy.qyTextSecondary,
                  ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: ThemeDimensions.spacing32),
                if (_isPhoneLogin)
                  _buildPhoneForm(authService)
                else
                  _buildUsernameForm(),
                const SizedBox(height: ThemeDimensions.spacing24),
                _buildActionButton(authService),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildUsernameForm() {
    return Column(
      children: [
        _buildInputField(
          controller: _usernameController,
          label: QyAppLocalizationKeys.qyUsername.tr(context),
          icon: Icons.person_outline_rounded,
          keyboardType: TextInputType.text,
        ),
        if (_isRegisterMode) ...[
          const SizedBox(height: ThemeDimensions.spacing16),
          _buildInputField(
            controller: _emailController,
            label: QyAppLocalizationKeys.qyEmail.tr(context),
            icon: Icons.email_outlined,
            keyboardType: TextInputType.emailAddress,
          ),
        ],
        const SizedBox(height: ThemeDimensions.spacing16),
        _buildInputField(
          controller: _passwordController,
          label: QyAppLocalizationKeys.qyPassword.tr(context),
          icon: Icons.lock_outline_rounded,
          obscureText: _obscurePassword,
          keyboardType: TextInputType.visiblePassword,
          suffixIcon: IconButton(
            icon: Icon(
              _obscurePassword ? Icons.visibility_off : Icons.visibility,
              color: ColorsAppQy.qyTextSecondary,
            ),
            onPressed: () {
              setState(() {
                _obscurePassword = !_obscurePassword;
              });
            },
          ),
        ),
        if (_isRegisterMode) ...[
          const SizedBox(height: ThemeDimensions.spacing16),
          _buildInputField(
            controller: _confirmPasswordController,
            label: QyAppLocalizationKeys.qyConfirmPassword.tr(context),
            icon: Icons.lock_outline_rounded,
            obscureText: _obscureConfirmPassword,
            keyboardType: TextInputType.visiblePassword,
            suffixIcon: IconButton(
              icon: Icon(
                _obscureConfirmPassword
                    ? Icons.visibility_off
                    : Icons.visibility,
                color: ColorsAppQy.qyTextSecondary,
              ),
              onPressed: () {
                setState(() {
                  _obscureConfirmPassword = !_obscureConfirmPassword;
                });
              },
            ),
          ),
        ],
      ],
    );
  }

  Widget _buildPhoneForm(AuthServiceAppQy authService) {
    return Column(
      children: [
        _buildInputField(
          controller: _phoneController,
          label: QyAppLocalizationKeys.qyPhoneNumber.tr(context),
          icon: Icons.phone_outlined,
          keyboardType: TextInputType.phone,
        ),
        const SizedBox(height: ThemeDimensions.spacing16),
        Row(
          children: [
            Expanded(
              child: _buildInputField(
                controller: _codeController,
                label: QyAppLocalizationKeys.qyVerificationCode.tr(context),
                icon: Icons.sms_outlined,
                keyboardType: TextInputType.number,
              ),
            ),
            const SizedBox(width: ThemeDimensions.spacing12),
            _buildSendCodeButton(authService),
          ],
        ),
      ],
    );
  }

  Widget _buildInputField({
    required TextEditingController controller,
    required String label,
    required IconData icon,
    bool obscureText = false,
    TextInputType? keyboardType,
    Widget? suffixIcon,
  }) {
    return Container(
      decoration: BoxDecoration(
        color: ColorsAppQy.qyFrostLight,
        borderRadius: BorderRadius.circular(ThemeDimensions.radiusMedium),
        border: Border.all(
          color: ColorsAppQy.qyFrostMedium,
        ),
      ),
      child: TextField(
        controller: controller,
        obscureText: obscureText,
        keyboardType: keyboardType,
        style: ThemeTextStyles.body.copyWith(color: ColorsAppQy.qyTextPrimary),
        decoration: InputDecoration(
          labelText: label,
          labelStyle: ThemeTextStyles.caption.copyWith(
            color: ColorsAppQy.qyTextSecondary,
          ),
          prefixIcon: Icon(icon, color: ColorsAppQy.qyPrimary),
          suffixIcon: suffixIcon,
          border: InputBorder.none,
          contentPadding: const EdgeInsets.symmetric(
            horizontal: ThemeDimensions.spacing16,
            vertical: ThemeDimensions.spacing16,
          ),
        ),
      ),
    );
  }

  Widget _buildSendCodeButton(AuthServiceAppQy authService) {
    final canSend = _countdown == 0 && !authService.isLoading;

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: canSend ? () => _handleSendCode(authService) : null,
        borderRadius: BorderRadius.circular(ThemeDimensions.radiusMedium),
        child: Container(
          padding: const EdgeInsets.symmetric(
            horizontal: ThemeDimensions.spacing16,
            vertical: ThemeDimensions.spacing16,
          ),
          decoration: BoxDecoration(
            gradient: canSend
                ? ColorsAppQy.qyPrimaryGradient
                : LinearGradient(
                    colors: [ColorsAppQy.qyTextTertiary, ColorsAppQy.qyTextSecondary],
                  ),
            borderRadius: BorderRadius.circular(ThemeDimensions.radiusMedium),
            boxShadow: canSend
                ? [
                    BoxShadow(
                      color: ColorsAppQy.qyPrimary.withOpacity(0.3),
                      blurRadius: 8,
                      offset: const Offset(0, 4),
                    ),
                  ]
                : null,
          ),
          child: Text(
            _countdown > 0
                ? '${_countdown}s'
                : QyAppLocalizationKeys.qySendCode.tr(context),
            style: ThemeTextStyles.button.copyWith(
              color: ColorsAppQy.qyTextOnPrimary,
              fontSize: 14,
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildActionButton(AuthServiceAppQy authService) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: !authService.isLoading && _agreedToTerms
            ? () => _isRegisterMode
                ? _handleRegister(authService)
                : _handleLogin(authService)
            : null,
        borderRadius: BorderRadius.circular(ThemeDimensions.radiusFull),
        child: Container(
          padding:
              const EdgeInsets.symmetric(vertical: ThemeDimensions.spacing16),
          decoration: BoxDecoration(
            gradient: _agreedToTerms && !authService.isLoading
                ? ColorsAppQy.qyPrimaryGradient
                : LinearGradient(
                    colors: [ColorsAppQy.qyTextTertiary, ColorsAppQy.qyTextSecondary],
                  ),
            borderRadius: BorderRadius.circular(ThemeDimensions.radiusFull),
            boxShadow: _agreedToTerms && !authService.isLoading
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
            _isRegisterMode
                ? QyAppLocalizationKeys.qyRegister.tr(context)
                : QyAppLocalizationKeys.qyLogin.tr(context),
            style: ThemeTextStyles.button.copyWith(
              color: ColorsAppQy.qyTextOnPrimary,
              fontWeight: FontWeight.bold,
            ),
            textAlign: TextAlign.center,
          ),
        ),
      ),
    );
  }

  Widget _buildTermsCheckbox() {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        SizedBox(
          width: 24,
          height: 24,
          child: Checkbox(
            value: _agreedToTerms,
            onChanged: (value) {
              setState(() {
                _agreedToTerms = value ?? false;
              });
            },
            activeColor: ColorsAppQy.qyPrimary,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(4),
            ),
          ),
        ),
        const SizedBox(width: ThemeDimensions.spacing8),
        Flexible(
          child: Text(
            QyAppLocalizationKeys.qyAgreeToTermsAndPrivacy.tr(context),
            style: ThemeTextStyles.caption.copyWith(
              color: ColorsAppQy.qyTextSecondary,
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildModeSwitch() {
    return Column(
      children: [
        TextButton(
          onPressed: () {
            setState(() {
              _isPhoneLogin = !_isPhoneLogin;
            });
          },
          child: Text(
            _isPhoneLogin
                ? QyAppLocalizationKeys.qyLoginWithUsername.tr(context)
                : QyAppLocalizationKeys.qyLoginWithPhone.tr(context),
            style: ThemeTextStyles.body.copyWith(
              color: ColorsAppQy.qyPrimary,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
        const SizedBox(height: ThemeDimensions.spacing8),
        TextButton(
          onPressed: () {
            setState(() {
              _isRegisterMode = !_isRegisterMode;
              _usernameController.clear();
              _emailController.clear();
              _passwordController.clear();
              _confirmPasswordController.clear();
              _phoneController.clear();
              _codeController.clear();
            });
          },
          child: Text(
            _isRegisterMode
                ? QyAppLocalizationKeys.qyHaveAccount.tr(context)
                : QyAppLocalizationKeys.qyNoAccount.tr(context),
            style: ThemeTextStyles.body.copyWith(
              color: ColorsAppQy.qyPrimary,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
      ],
    );
  }
}
