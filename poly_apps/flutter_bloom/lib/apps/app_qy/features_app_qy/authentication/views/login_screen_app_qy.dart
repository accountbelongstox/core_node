/// Login screen for app_qy
/// Features phone number and WeChat authentication options
/// Uses centralized theme, localization, glassmorphism, and dynamic gradients
library;

import 'dart:async';
import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import '../../../../../common/localization/localization_manager.dart';
import '../../../../../common/theme/base/theme_dimensions.dart';
import '../../../../../common/theme/base/theme_text_styles.dart';
import '../../../../../common/widgets/cards/premium_cards.dart';
import '../../../../../common/widgets/buttons/primary_button.dart';
import '../../../../../common/widgets/animations/animation_utils.dart';
import '../../../localization_app_qy/localization_keys_app_qy.dart';
import '../../../resources_app_qy/colors_app_qy.dart';
import '../../../config_app_qy/storage_app_qy.dart';
import '../../../provider_app_qy/user_provider_app_qy.dart';
import '../widgets/phone_login_button.dart';
import '../widgets/wechat_login_button.dart';
import '../widgets/agreement_checkbox.dart';

class LoginScreenAppQy extends StatefulWidget {
  const LoginScreenAppQy({super.key});

  @override
  State<LoginScreenAppQy> createState() => _LoginScreenAppQyState();
}

class _LoginScreenAppQyState extends State<LoginScreenAppQy>
    with SingleTickerProviderStateMixin {
  final _formKey = GlobalKey<FormState>();
  final _phoneController = TextEditingController();
  final _codeController = TextEditingController();
  final StorageAppQy _storage = StorageAppQy.instance;
  bool _showPhoneForm = false;
  bool _agreedToTerms = false;
  bool _isLoading = false;
  Timer? _resendTimer;
  int _countdownSeconds = 0;
  late AnimationController _shimmerController;

  @override
  void initState() {
    super.initState();
    _shimmerController = AnimationController(
      duration: const Duration(seconds: 3),
      vsync: this,
    )..repeat();
    _initializeAuth();
    _loadSavedSettings();
  }

  @override
  void dispose() {
    _phoneController.dispose();
    _codeController.dispose();
    _resendTimer?.cancel();
    _shimmerController.dispose();
    super.dispose();
  }

  Future<void> _initializeAuth() async {
    final userProvider = Provider.of<UserProviderAppQy>(context, listen: false);
    await userProvider.initializeAuth();
  }

  Future<void> _loadSavedSettings() async {
    final savedAgreed = await _storage.getApp<bool>('login_agreed_to_terms');
    if (savedAgreed != null) {
      setState(() => _agreedToTerms = savedAgreed);
    }
  }

  Future<void> _saveSettings() async {
    await _storage.setApp('login_agreed_to_terms', _agreedToTerms);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: BoxDecoration(
          gradient:
              ColorsAppQy.qyDynamicShimmerGradient(_shimmerController.value),
        ),
        child: SafeArea(
          child: Consumer<UserProviderAppQy>(
            builder: (context, userProvider, child) {
              return AnimationUtils.fadeInWithSlide(
                SingleChildScrollView(
                  padding: EdgeInsets.symmetric(
                    horizontal: ThemeDimensions.spacing32,
                  ),
                  child: Column(
                    children: [
                      SizedBox(height: ThemeDimensions.spacing80),
                      _buildAppIcon(),
                      SizedBox(height: ThemeDimensions.spacing16),
                      _buildAppTitle(),
                      SizedBox(height: ThemeDimensions.spacing8),
                      _buildAppSubtitle(),
                      SizedBox(height: ThemeDimensions.spacing64),
                      if (_showPhoneForm) ...[
                        _buildPhoneForm(userProvider),
                        SizedBox(height: ThemeDimensions.spacing24),
                      ] else ...[
                        _buildLoginButtons(userProvider),
                        SizedBox(height: ThemeDimensions.spacing32),
                      ],
                      _buildBottomSection(),
                      SizedBox(height: ThemeDimensions.spacing20),
                    ],
                  ),
                ),
              );
            },
          ),
        ),
      ),
    );
  }

  Widget _buildAppIcon() {
    return AnimationUtils.scaleOnTap(
      onTap: () {},
      child: Container(
        width: 100,
        height: 100,
        decoration: BoxDecoration(
          gradient: ColorsAppQy.qyPrimaryGradient,
          borderRadius: ThemeDimensions.borderRadiusL,
          boxShadow: [
            BoxShadow(
              color: ColorsAppQy.qyPrimary.withOpacity(0.3),
              blurRadius: ThemeDimensions.spacing20,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: const Icon(
          Icons.auto_stories,
          size: 50,
          color: ColorsAppQy.qyTextOnPrimary,
        ),
      ),
    );
  }

  Widget _buildAppTitle() {
    return Text(
      QyAppLocalizationKeys.qyAuthAppTitle.tr(context),
      style: ThemeTextStyles.title1Bold.copyWith(
        color: ColorsAppQy.qyTextPrimary,
      ),
    );
  }

  Widget _buildAppSubtitle() {
    return Text(
      QyAppLocalizationKeys.qyAuthAppSlogan.tr(context),
      style: ThemeTextStyles.body1.copyWith(
        color: ColorsAppQy.qyTextSecondary,
      ),
    );
  }

  Widget _buildLoginButtons(UserProviderAppQy userProvider) {
    return Column(
      children: [
        PhoneLoginButton(
          onPressed:
              _agreedToTerms && !_isLoading ? () => _togglePhoneForm() : null,
        ),
        SizedBox(height: ThemeDimensions.spacing16),
        WeChatLoginButton(
          onPressed: _agreedToTerms && !_isLoading
              ? () => _handleWeChatLogin(userProvider)
              : null,
        ),
        SizedBox(height: ThemeDimensions.spacing24),
        _buildSkipLoginButton(userProvider),
      ],
    );
  }

  Widget _buildPhoneForm(UserProviderAppQy userProvider) {
    return GlassCard(
      borderRadius: ThemeDimensions.borderRadiusL,
      padding: EdgeInsets.all(ThemeDimensions.spacing20),
      child: Form(
        key: _formKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            TextFormField(
              controller: _phoneController,
              keyboardType: TextInputType.phone,
              style: ThemeTextStyles.body1.copyWith(
                color: ColorsAppQy.qyTextPrimary,
              ),
              decoration: InputDecoration(
                labelText: QyAppLocalizationKeys.qyAuthPhoneNumber.tr(context),
                hintText:
                    QyAppLocalizationKeys.qyAuthPhonePlaceholder.tr(context),
                prefixIcon: Icon(
                  Icons.phone,
                  color: ColorsAppQy.qyPrimary,
                ),
                border: OutlineInputBorder(
                  borderRadius: ThemeDimensions.borderRadiusM,
                  borderSide: BorderSide(
                    color: ColorsAppQy.qyBorderLight,
                  ),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: ThemeDimensions.borderRadiusM,
                  borderSide: BorderSide(
                    color: ColorsAppQy.qyBorderLight,
                  ),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: ThemeDimensions.borderRadiusM,
                  borderSide: BorderSide(
                    color: ColorsAppQy.qyPrimary,
                    width: 2,
                  ),
                ),
              ),
              validator: (value) {
                if (!userProvider.validatePhoneNumber(value ?? '')) {
                  return QyAppLocalizationKeys.qyAuthPhoneInvalid.tr(context);
                }
                return null;
              },
            ),
            SizedBox(height: ThemeDimensions.spacing16),
            Row(
              children: [
                Expanded(
                  child: TextFormField(
                    controller: _codeController,
                    keyboardType: TextInputType.number,
                    style: ThemeTextStyles.body1.copyWith(
                      color: ColorsAppQy.qyTextPrimary,
                    ),
                    decoration: InputDecoration(
                      labelText: QyAppLocalizationKeys.qyAuthVerificationCode
                          .tr(context),
                      hintText: QyAppLocalizationKeys.qyAuthCodePlaceholder
                          .tr(context),
                      prefixIcon: Icon(
                        Icons.message,
                        color: ColorsAppQy.qyPrimary,
                      ),
                      border: OutlineInputBorder(
                        borderRadius: ThemeDimensions.borderRadiusM,
                        borderSide: BorderSide(
                          color: ColorsAppQy.qyBorderLight,
                        ),
                      ),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: ThemeDimensions.borderRadiusM,
                        borderSide: BorderSide(
                          color: ColorsAppQy.qyBorderLight,
                        ),
                      ),
                      focusedBorder: OutlineInputBorder(
                        borderRadius: ThemeDimensions.borderRadiusM,
                        borderSide: BorderSide(
                          color: ColorsAppQy.qyPrimary,
                          width: 2,
                        ),
                      ),
                    ),
                    validator: (value) {
                      if (!userProvider.validateVerificationCode(value ?? '')) {
                        return QyAppLocalizationKeys.qyAuthCodeLength
                            .tr(context);
                      }
                      return null;
                    },
                  ),
                ),
                SizedBox(width: ThemeDimensions.spacing12),
                PrimaryButton(
                  text: _countdownSeconds > 0
                      ? '$_countdownSeconds${QyAppLocalizationKeys.qyAuthSeconds.tr(context)}'
                      : QyAppLocalizationKeys.qyAuthGetCode.tr(context),
                  onPressed: _countdownSeconds > 0 || _isLoading
                      ? null
                      : () => _sendVerificationCode(userProvider),
                  isFullWidth: false,
                  height: 56,
                  backgroundColor: ColorsAppQy.qyPrimary,
                  foregroundColor: ColorsAppQy.qyTextOnPrimary,
                ),
              ],
            ),
            SizedBox(height: ThemeDimensions.spacing16),
            PrimaryButton(
              text: QyAppLocalizationKeys.qyAuthLoginButton.tr(context),
              onPressed:
                  _isLoading ? null : () => _handlePhoneLogin(userProvider),
              isLoading: _isLoading,
              backgroundColor: ColorsAppQy.qyPrimary,
              foregroundColor: ColorsAppQy.qyTextOnPrimary,
            ),
            SizedBox(height: ThemeDimensions.spacing12),
            TextButton(
              onPressed: () => setState(() => _showPhoneForm = false),
              child: Text(
                QyAppLocalizationKeys.qyCancel.tr(context),
                style: ThemeTextStyles.body1.copyWith(
                  color: ColorsAppQy.qyTextSecondary,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSkipLoginButton(UserProviderAppQy userProvider) {
    return TextButton(
      onPressed: _isLoading ? null : () => _handleSkipLogin(userProvider),
      child: Text(
        '${QyAppLocalizationKeys.qyAuthSkipLogin.tr(context)} (Debug)',
        style: ThemeTextStyles.body2.copyWith(
          color: ColorsAppQy.qyTextSecondary,
        ),
      ),
    );
  }

  Widget _buildBottomSection() {
    return Column(
      children: [
        AgreementCheckbox(
          value: _agreedToTerms,
          onChanged: (value) {
            setState(() => _agreedToTerms = value ?? false);
            _saveSettings();
          },
        ),
        SizedBox(height: ThemeDimensions.spacing16),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            IconButton(
              onPressed: () {},
              icon: Icon(
                Icons.notifications_outlined,
                color: ColorsAppQy.qyTextSecondary,
              ),
            ),
            SizedBox(width: ThemeDimensions.spacing32),
            IconButton(
              onPressed: () {},
              icon: Icon(
                Icons.settings_outlined,
                color: ColorsAppQy.qyTextSecondary,
              ),
            ),
          ],
        ),
      ],
    );
  }

  void _togglePhoneForm() {
    setState(() {
      _showPhoneForm = true;
    });
  }

  Future<void> _sendVerificationCode(UserProviderAppQy userProvider) async {
    if (_formKey.currentState?.validate() ?? false) {
      setState(() => _isLoading = true);

      try {
        final result =
            await userProvider.sendVerificationCode(_phoneController.text);

        if (result.success) {
          _startCountdown();
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text(QyAppLocalizationKeys.qyAuthCodeSent.tr(context)),
                backgroundColor: ColorsAppQy.qySuccess,
              ),
            );
          }
        } else {
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text(
                  (result.errorMessage?.isNotEmpty ?? false)
                      ? result.errorMessage!
                      : QyAppLocalizationKeys.qyAuthCodeSendFailed.tr(context),
                ),
                backgroundColor: ColorsAppQy.qyError,
              ),
            );
          }
        }
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(
                '${QyAppLocalizationKeys.qyAuthCodeSendFailed.tr(context)}: $e',
              ),
              backgroundColor: ColorsAppQy.qyError,
            ),
          );
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

        if (success) {
          if (mounted) {
            Navigator.of(context).pushReplacementNamed('/home');
          }
        } else {
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content:
                    Text(QyAppLocalizationKeys.qyAuthLoginFailed.tr(context)),
                backgroundColor: ColorsAppQy.qyError,
              ),
            );
          }
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

      if (success) {
        if (mounted) {
          Navigator.of(context).pushReplacementNamed('/home');
        }
      } else {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(
                  QyAppLocalizationKeys.qyAuthWechatLoginFailed.tr(context)),
              backgroundColor: ColorsAppQy.qyError,
            ),
          );
        }
      }
    } finally {
      setState(() => _isLoading = false);
    }
  }

  Future<void> _handleSkipLogin(UserProviderAppQy userProvider) async {
    setState(() => _isLoading = true);

    try {
      final success = await userProvider.skipLogin();

      if (success) {
        if (mounted) {
          Navigator.of(context).pushReplacementNamed('/home');
        }
      }
    } finally {
      setState(() => _isLoading = false);
    }
  }
}
