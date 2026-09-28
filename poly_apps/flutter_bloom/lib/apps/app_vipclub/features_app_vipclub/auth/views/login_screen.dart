import 'dart:async';
import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import 'package:provider/provider.dart';
import 'package:go_router/go_router.dart';
import 'package:qyflutter/common/theme/base/theme_colors.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/apps/app_vipclub/features_app_vipclub/auth/controllers/auth_controller.dart';
import 'package:qyflutter/apps/app_vipclub/controller_app_vipclub/settings_controller_app_vipclub.dart';
import 'package:qyflutter/apps/app_vipclub/router_app_vipclub/router_app_vipclub.dart';
import 'package:qyflutter/apps/app_vipclub/localization_app_vipclub/localization_keys_app_vipclub.dart';
import 'package:qyflutter/common/localization/localization_manager.dart';
import 'package:qyflutter/apps/app_vipclub/resources_app_vipclub/assets_images_app_vipclub.dart';
import 'package:qyflutter/apps/app_vipclub/services_app_vipclub/vipclub_auth_adapter.dart';
import 'package:qyflutter/common/auth_v2/auth_v2.dart';
import 'package:qyflutter/common/widgets/custom_button.dart';

enum LoginMethod {
  usernamePassword,
  phone,
}

class VipClubLoginScreen extends StatefulWidget {
  const VipClubLoginScreen({super.key});

  @override
  State<VipClubLoginScreen> createState() => _VipClubLoginScreenState();
}

class _VipClubLoginScreenState extends State<VipClubLoginScreen>
    with SingleTickerProviderStateMixin {
  final _formKey = GlobalKey<FormState>();
  final _usernameController = TextEditingController();
  final _passwordController = TextEditingController();
  final _phoneController = TextEditingController();
  final _codeController = TextEditingController();

  bool _obscurePassword = true;
  LoginMethod _selectedMethod = LoginMethod.usernamePassword;
  bool _rememberMe = false;

  late PageController _backgroundController;
  late AnimationController _fadeController;
  Timer? _backgroundTimer;
  int _currentBgIndex = 0;

  final List<String> _backgroundImages = [
    VipClubAssetsImages.getPath(VipClubAssetsImages.vipclubLoginBg1),
    VipClubAssetsImages.getPath(VipClubAssetsImages.vipclubLoginBg2),
  ];

  late VipClubAuthAdapter _authAdapter;

  @override
  void initState() {
    super.initState();
    _authAdapter = VipClubAuthAdapter();
    _backgroundController = PageController();
    _fadeController = AnimationController(
      duration: const Duration(milliseconds: 1000),
      vsync: this,
    );
    _startBackgroundSlider();
    _fadeController.forward();
  }

  @override
  void dispose() {
    _backgroundTimer?.cancel();
    _backgroundController.dispose();
    _fadeController.dispose();
    _usernameController.dispose();
    _passwordController.dispose();
    _phoneController.dispose();
    _codeController.dispose();
    super.dispose();
  }

  void _startBackgroundSlider() {
    _backgroundTimer = Timer.periodic(const Duration(seconds: 5), (timer) {
      if (mounted && _backgroundImages.isNotEmpty) {
        _currentBgIndex = (_currentBgIndex + 1) % _backgroundImages.length;
        _backgroundController.animateToPage(
          _currentBgIndex,
          duration: const Duration(milliseconds: 800),
          curve: Curves.easeInOut,
        );
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Stack(
        children: [
          _buildAnimatedBackground(),
          _buildContent(),
        ],
      ),
    );
  }

  Widget _buildAnimatedBackground() {
    return Stack(
      children: [
        PageView.builder(
          controller: _backgroundController,
          physics: const NeverScrollableScrollPhysics(),
          itemCount: _backgroundImages.length,
          itemBuilder: (context, index) {
            return Image.asset(
              _backgroundImages[index],
              fit: BoxFit.cover,
              width: double.infinity,
              height: double.infinity,
              errorBuilder: (context, error, stackTrace) {
                return Container(
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                      colors: [
                        ThemeColors.primaryBlue,
                        ThemeColors.primaryBlue.withOpacity(0.7),
                      ],
                    ),
                  ),
                );
              },
            );
          },
        ),
        BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 3.0, sigmaY: 3.0),
          child: Container(
            color: Colors.black.withOpacity(0.3),
          ),
        ),
      ],
    );
  }

  Widget _buildContent() {
    return SafeArea(
      child: Center(
        child: SingleChildScrollView(
          child: Padding(
            padding: EdgeInsets.all(ThemeDimensions.largePadding),
            child: FadeTransition(
              opacity: _fadeController,
              child: Container(
                constraints: const BoxConstraints(maxWidth: 500),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(ThemeDimensions.largeRadius),
                  child: BackdropFilter(
                    filter: ImageFilter.blur(sigmaX: 10.0, sigmaY: 10.0),
                    child: Container(
                      decoration: BoxDecoration(
                        color: Colors.white.withOpacity(0.9),
                        borderRadius: BorderRadius.circular(ThemeDimensions.largeRadius),
                        border: Border.all(
                          color: Colors.white.withOpacity(0.3),
                          width: 1.5,
                        ),
                      ),
                      padding: EdgeInsets.all(ThemeDimensions.hugePadding),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          _buildLogo(),
                          SizedBox(height: ThemeDimensions.hugePadding),
                          _buildMethodSelector(),
                          SizedBox(height: ThemeDimensions.largePadding),
                          _buildLoginForm(),
                          SizedBox(height: ThemeDimensions.largePadding),
                          _buildSocialLogin(),
                          SizedBox(height: ThemeDimensions.defaultPadding),
                          _buildFooterActions(),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildLogo() {
    return Column(
      children: [
        Container(
          padding: EdgeInsets.all(ThemeDimensions.defaultPadding),
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            gradient: LinearGradient(
              colors: [
                ThemeColors.primaryBlue,
                ThemeColors.primaryBlue.withOpacity(0.7),
              ],
            ),
          ),
          child: Icon(
            Icons.stars,
            size: 48,
            color: ThemeColors.neutralWhite,
          ),
        ),
        SizedBox(height: ThemeDimensions.defaultPadding),
        Text(
          'VIP CLUB',
          style: ThemeTextStyles.displaySmall.copyWith(
            fontWeight: FontWeight.bold,
            color: ThemeColors.primaryBlue,
          ),
        ),
        SizedBox(height: ThemeDimensions.tinyPadding),
        Text(
          VipClubTextKeys.vipclubLoginWelcome.tr(context),
          style: ThemeTextStyles.bodyMedium.copyWith(
            color: ThemeColors.neutralGrey,
          ),
        ),
      ],
    );
  }

  Widget _buildMethodSelector() {
    return Container(
      decoration: BoxDecoration(
        color: ThemeColors.neutralLightGrey.withOpacity(0.5),
        borderRadius: BorderRadius.circular(ThemeDimensions.defaultRadius),
      ),
      child: Row(
        children: [
          _buildMethodButton(
            LoginMethod.usernamePassword,
            Icons.person,
            VipClubTextKeys.vipclubLoginAccount.tr(context),
          ),
          _buildMethodButton(
            LoginMethod.phone,
            Icons.phone,
            VipClubTextKeys.vipclubLoginPhone.tr(context),
          ),
        ],
      ),
    );
  }

  Widget _buildMethodButton(LoginMethod method, IconData icon, String label) {
    final isSelected = _selectedMethod == method;
    return Expanded(
      child: GestureDetector(
        onTap: () {
          setState(() {
            _selectedMethod = method;
          });
        },
        child: Container(
          padding: EdgeInsets.symmetric(
            vertical: ThemeDimensions.defaultPadding,
          ),
          decoration: BoxDecoration(
            color: isSelected
                ? ThemeColors.primaryBlue
                : Colors.transparent,
            borderRadius: BorderRadius.circular(ThemeDimensions.defaultRadius),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                icon,
                size: 20,
                color: isSelected
                    ? ThemeColors.neutralWhite
                    : ThemeColors.neutralGrey,
              ),
              SizedBox(width: ThemeDimensions.smallPadding),
              Text(
                label,
                style: ThemeTextStyles.bodyMedium.copyWith(
                  color: isSelected
                      ? ThemeColors.neutralWhite
                      : ThemeColors.neutralGrey,
                  fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildLoginForm() {
    return Form(
      key: _formKey,
      child: Column(
        children: [
          if (_selectedMethod == LoginMethod.usernamePassword) ...[
            _buildUsernamePasswordForm(),
          ] else if (_selectedMethod == LoginMethod.phone) ...[
            _buildPhoneForm(),
          ],
        ],
      ),
    );
  }

  Widget _buildUsernamePasswordForm() {
    return Column(
      children: [
        TextFormField(
          controller: _usernameController,
          decoration: InputDecoration(
            labelText: VipClubTextKeys.vipclubLoginUsername.tr(context),
            prefixIcon: const Icon(Icons.person_outline),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(ThemeDimensions.defaultRadius),
            ),
            filled: true,
            fillColor: Colors.white,
          ),
          validator: (value) {
            if (value == null || value.isEmpty) {
              return VipClubTextKeys.vipclubLoginUsernameRequired.tr(context);
            }
            return null;
          },
        ),
        SizedBox(height: ThemeDimensions.defaultPadding),
        TextFormField(
          controller: _passwordController,
          obscureText: _obscurePassword,
          decoration: InputDecoration(
            labelText: VipClubTextKeys.vipclubLoginPassword.tr(context),
            prefixIcon: const Icon(Icons.lock_outline),
            suffixIcon: IconButton(
              icon: Icon(
                _obscurePassword ? Icons.visibility : Icons.visibility_off,
              ),
              onPressed: () {
                setState(() {
                  _obscurePassword = !_obscurePassword;
                });
              },
            ),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(ThemeDimensions.defaultRadius),
            ),
            filled: true,
            fillColor: Colors.white,
          ),
          validator: (value) {
            if (value == null || value.isEmpty) {
              return VipClubTextKeys.vipclubLoginPasswordRequired.tr(context);
            }
            return null;
          },
        ),
        SizedBox(height: ThemeDimensions.defaultPadding),
        Row(
          children: [
            Checkbox(
              value: _rememberMe,
              onChanged: (value) {
                setState(() {
                  _rememberMe = value ?? false;
                });
              },
              activeColor: ThemeColors.primaryBlue,
            ),
            Text(
              VipClubTextKeys.vipclubLoginRememberMe.tr(context),
              style: ThemeTextStyles.bodySmall,
            ),
            const Spacer(),
            TextButton(
              onPressed: () {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                    content: Text('Forgot password feature coming soon'),
                  ),
                );
              },
              child: Text(
                VipClubTextKeys.vipclubLoginForgotPassword.tr(context),
                style: ThemeTextStyles.bodySmall.copyWith(
                  color: ThemeColors.primaryBlue,
                ),
              ),
            ),
          ],
        ),
        SizedBox(height: ThemeDimensions.defaultPadding),
        SizedBox(
          width: double.infinity,
          height: 50,
          child: ElevatedButton(
            onPressed: _handleLogin,
            style: ElevatedButton.styleFrom(
              backgroundColor: ThemeColors.primaryBlue,
              foregroundColor: ThemeColors.neutralWhite,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(ThemeDimensions.defaultRadius),
              ),
            ),
            child: Consumer<VipClubAuthController>(
              builder: (context, authController, child) {
                if (authController.isLoading) {
                  return SizedBox(
                    height: 24,
                    width: 24,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      valueColor: AlwaysStoppedAnimation<Color>(
                        ThemeColors.neutralWhite,
                      ),
                    ),
                  );
                }
                return Text(
                  VipClubTextKeys.vipclubLogin.tr(context),
                  style: ThemeTextStyles.bodyLarge.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
                );
              },
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildPhoneForm() {
    return Column(
      children: [
        TextFormField(
          controller: _phoneController,
          keyboardType: TextInputType.phone,
          decoration: InputDecoration(
            labelText: VipClubTextKeys.vipclubLoginPhoneNumber.tr(context),
            prefixIcon: const Icon(Icons.phone_outlined),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(ThemeDimensions.defaultRadius),
            ),
            filled: true,
            fillColor: Colors.white,
          ),
          validator: (value) {
            if (value == null || value.isEmpty) {
              return 'Please enter phone number';
            }
            return null;
          },
        ),
        SizedBox(height: ThemeDimensions.defaultPadding),
        Row(
          children: [
            Expanded(
              child: TextFormField(
                controller: _codeController,
                keyboardType: TextInputType.number,
                decoration: InputDecoration(
                  labelText: VipClubTextKeys.vipclubLoginVerificationCode.tr(context),
                  prefixIcon: const Icon(Icons.sms_outlined),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(ThemeDimensions.defaultRadius),
                  ),
                  filled: true,
                  fillColor: Colors.white,
                ),
                validator: (value) {
                  if (value == null || value.isEmpty) {
                    return 'Please enter code';
                  }
                  return null;
                },
              ),
            ),
            SizedBox(width: ThemeDimensions.defaultPadding),
            ElevatedButton(
              onPressed: _sendVerificationCode,
              style: ElevatedButton.styleFrom(
                backgroundColor: ThemeColors.primaryBlue.withOpacity(0.1),
                foregroundColor: ThemeColors.primaryBlue,
                padding: EdgeInsets.symmetric(
                  horizontal: ThemeDimensions.defaultPadding,
                  vertical: ThemeDimensions.largePadding,
                ),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(ThemeDimensions.defaultRadius),
                ),
              ),
              child: const Text('Send Code'),
            ),
          ],
        ),
        SizedBox(height: ThemeDimensions.largePadding),
        SizedBox(
          width: double.infinity,
          height: 50,
          child: ElevatedButton(
            onPressed: _handlePhoneLogin,
            style: ElevatedButton.styleFrom(
              backgroundColor: ThemeColors.primaryBlue,
              foregroundColor: ThemeColors.neutralWhite,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(ThemeDimensions.defaultRadius),
              ),
            ),
            child: Text(
              VipClubTextKeys.vipclubLogin.tr(context),
              style: ThemeTextStyles.bodyLarge.copyWith(
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildSocialLogin() {
    return Column(
      children: [
        Row(
          children: [
            const Expanded(child: Divider()),
            Padding(
              padding: EdgeInsets.symmetric(horizontal: ThemeDimensions.defaultPadding),
              child: Text(
                VipClubTextKeys.vipclubLoginOr.tr(context),
                style: ThemeTextStyles.bodySmall.copyWith(
                  color: ThemeColors.neutralGrey,
                ),
              ),
            ),
            const Expanded(child: Divider()),
          ],
        ),
        SizedBox(height: ThemeDimensions.defaultPadding),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            _buildSocialButton(
              icon: Icons.wechat,
              label: VipClubTextKeys.vipclubLoginWechat.tr(context),
              color: const Color(0xFF09BB07),
              onTap: _handleWeChatLogin,
            ),
            SizedBox(width: ThemeDimensions.defaultPadding),
            _buildSocialButton(
              icon: Icons.g_mobiledata,
              label: VipClubTextKeys.vipclubLoginGoogle.tr(context),
              color: const Color(0xFF4285F4),
              onTap: _handleGoogleLogin,
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildSocialButton({
    required IconData icon,
    required String label,
    required Color color,
    required VoidCallback onTap,
  }) {
    return Expanded(
      child: OutlinedButton(
        onPressed: onTap,
        style: OutlinedButton.styleFrom(
          side: BorderSide(color: color),
          padding: EdgeInsets.symmetric(
            vertical: ThemeDimensions.defaultPadding,
          ),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(ThemeDimensions.defaultRadius),
          ),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, color: color, size: 24),
            SizedBox(width: ThemeDimensions.smallPadding),
            Flexible(
              child: Text(
                label,
                style: ThemeTextStyles.bodyMedium.copyWith(
                  color: color,
                ),
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildFooterActions() {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Text(
          VipClubTextKeys.vipclubLoginNoAccount.tr(context),
          style: ThemeTextStyles.bodySmall.copyWith(
            color: ThemeColors.neutralGrey,
          ),
        ),
        TextButton(
          onPressed: () {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                content: Text('Registration feature coming soon'),
              ),
            );
          },
          child: Text(
            VipClubTextKeys.vipclubLoginRegister.tr(context),
            style: ThemeTextStyles.bodySmall.copyWith(
              color: ThemeColors.primaryBlue,
              fontWeight: FontWeight.bold,
            ),
          ),
        ),
      ],
    );
  }

  Future<void> _handleLogin() async {
    if (!_formKey.currentState!.validate()) {
      return;
    }

    final authController = context.read<VipClubAuthController>();
    final settingsController = context.read<VipClubSettingsController>();

    if (settingsController.debugMode &&
        _usernameController.text == 'wtwsl' &&
        _passwordController.text == 'wtwsl') {
      await _mockDebugLogin(authController);
      return;
    }

    final success = await authController.login(
      email: _usernameController.text,
      password: _passwordController.text,
    );

    if (!mounted) return;

    if (success) {
      context.go(VipClubRoutes.home);
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(authController.errorMessage ?? 'Login failed'),
          backgroundColor: ThemeColors.errorRed,
        ),
      );
    }
  }

  Future<void> _mockDebugLogin(VipClubAuthController authController) async {
    await authController.mockDebugLogin('wtwsl');

    if (!mounted) return;

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: const Text('Debug mode: Logged in as wtwsl'),
        backgroundColor: ThemeColors.successGreen,
      ),
    );

    context.go(VipClubRoutes.home);
  }

  Future<void> _handlePhoneLogin() async {
    if (!_formKey.currentState!.validate()) {
      return;
    }

    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Phone login feature coming soon'),
      ),
    );
  }

  void _sendVerificationCode() async {
    if (_phoneController.text.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please enter phone number first'),
        ),
      );
      return;
    }

    // Check if phone authentication is available
    final isAvailable = await _authAdapter.isProviderAvailable(AuthProvider.phone);

    if (!isAvailable) {
      if (mounted) {
        _showPlatformMessage(
          _authAdapter.getUnsupportedProviderMessage(AuthProvider.phone),
        );
      }
      return;
    }

    // Send verification code
    final result = await _authAdapter.sendPhoneVerificationCode(
      _phoneController.text,
      countryCode: '+86',
    );

    if (mounted) {
      if (result.success) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Verification code sent to ${_phoneController.text}'),
            backgroundColor: Colors.green,
          ),
        );
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(result.errorMessage ?? 'Failed to send code'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  void _handleWeChatLogin() async {
    final isAvailable = await _authAdapter.isProviderAvailable(AuthProvider.wechat);

    if (!isAvailable) {
      _showPlatformMessage(
        _authAdapter.getUnsupportedProviderMessage(AuthProvider.wechat),
      );
      return;
    }

    // Show loading indicator
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Row(
            children: [
              SizedBox(
                width: 20,
                height: 20,
                child: CircularProgressIndicator(strokeWidth: 2),
              ),
              SizedBox(width: 12),
              Text('Connecting to WeChat...'),
            ],
          ),
          duration: Duration(seconds: 2),
        ),
      );
    }

    final result = await _authAdapter.authenticateWithWeChat();

    if (mounted) {
      ScaffoldMessenger.of(context).hideCurrentSnackBar();

      if (result.success && result.user != null) {
        // Convert to VipClub user and login
        final vipClubUser = _authAdapter.convertAuthUserToVipClubUser(result.user!);
        final authController = Provider.of<VipClubAuthController>(context, listen: false);
        // TODO: Update to use the converted user
        _navigateToHome();
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(result.errorMessage ?? 'WeChat login failed'),
            backgroundColor: Colors.orange,
          ),
        );
      }
    }
  }

  void _handleGoogleLogin() async {
    final isAvailable = await _authAdapter.isProviderAvailable(AuthProvider.google);

    if (!isAvailable) {
      _showPlatformMessage(
        _authAdapter.getUnsupportedProviderMessage(AuthProvider.google),
      );
      return;
    }

    // Show loading indicator
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Row(
            children: [
              SizedBox(
                width: 20,
                height: 20,
                child: CircularProgressIndicator(strokeWidth: 2),
              ),
              SizedBox(width: 12),
              Text('Connecting to Google...'),
            ],
          ),
          duration: Duration(seconds: 2),
        ),
      );
    }

    final result = await _authAdapter.authenticateWithGoogle();

    if (mounted) {
      ScaffoldMessenger.of(context).hideCurrentSnackBar();

      if (result.success && result.user != null) {
        // Convert to VipClub user and login
        final vipClubUser = _authAdapter.convertAuthUserToVipClubUser(result.user!);
        final authController = Provider.of<VipClubAuthController>(context, listen: false);
        // TODO: Update to use the converted user
        _navigateToHome();
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(result.errorMessage ?? 'Google login failed'),
            backgroundColor: Colors.orange,
          ),
        );
      }
    }
  }

  void _showPlatformMessage(String message) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Row(
          children: [
            Icon(
              kIsWeb ? Icons.web : Icons.phone_android,
              color: ThemeColors.primaryBlue,
            ),
            const SizedBox(width: 8),
            const Text('Platform Info'),
          ],
        ),
        content: Text(message),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('OK'),
          ),
        ],
      ),
    );
  }

  void _navigateToHome() {
    if (mounted) {
      context.go(VipClubRoutes.home);
    }
  }
}
