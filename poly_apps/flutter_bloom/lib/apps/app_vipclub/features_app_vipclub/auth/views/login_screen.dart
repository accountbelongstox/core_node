import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:go_router/go_router.dart';
import 'package:qyflutter/common/theme/base/theme_colors.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/apps/app_vipclub/features_app_vipclub/auth/controllers/auth_controller.dart';
import 'package:qyflutter/apps/app_vipclub/router_app_vipclub/router_app_vipclub.dart';
import 'package:qyflutter/apps/app_vipclub/localization_app_vipclub/localization_keys_app_vipclub.dart';

class VipClubLoginScreen extends StatefulWidget {
  const VipClubLoginScreen({super.key});

  @override
  State<VipClubLoginScreen> createState() => _VipClubLoginScreenState();
}

class _VipClubLoginScreenState extends State<VipClubLoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _obscurePassword = true;

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _handleLogin() async {
    if (!_formKey.currentState!.validate()) {
      return;
    }

    final authController = context.read<VipClubAuthController>();
    final success = await authController.login(
      email: _emailController.text.trim(),
      password: _passwordController.text,
    );

    if (success && mounted) {
      context.go(VipClubRoutes.home);
    } else if (mounted && authController.errorMessage != null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(authController.errorMessage!),
          backgroundColor: ThemeColors.errorRed,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: SingleChildScrollView(
          child: Padding(
            padding: EdgeInsets.all(ThemeDimensions.hugePadding),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                SizedBox(height: ThemeDimensions.hugePadding),
                _buildHeader(),
                SizedBox(height: ThemeDimensions.hugePadding),
                _buildLoginForm(),
                SizedBox(height: ThemeDimensions.largePadding),
                _buildLoginButton(),
                SizedBox(height: ThemeDimensions.defaultPadding),
                _buildForgotPassword(),
                SizedBox(height: ThemeDimensions.hugePadding),
                _buildDivider(),
                SizedBox(height: ThemeDimensions.largePadding),
                _buildRegisterPrompt(),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildHeader() {
    return Column(
      children: [
        Icon(
          Icons.stars,
          size: 80,
          color: ThemeColors.primaryBlue,
        ),
        SizedBox(height: ThemeDimensions.defaultPadding),
        Text(
          'VIP Club',
          style: ThemeTextStyles.displayLarge.copyWith(
            color: ThemeColors.primaryBlue,
            fontWeight: FontWeight.bold,
          ),
        ),
        SizedBox(height: ThemeDimensions.tinyPadding),
        Text(
          'Welcome Back',
          style: ThemeTextStyles.bodyLarge.copyWith(
            color: ThemeColors.neutralGrey,
          ),
        ),
      ],
    );
  }

  Widget _buildLoginForm() {
    return Form(
      key: _formKey,
      child: Column(
        children: [
          TextFormField(
            controller: _emailController,
            keyboardType: TextInputType.emailAddress,
            decoration: InputDecoration(
              labelText: 'Email',
              hintText: 'Enter your email',
              prefixIcon: Icon(Icons.email_outlined),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(
                  ThemeDimensions.defaultRadius,
                ),
              ),
            ),
            validator: (value) {
              if (value == null || value.isEmpty) {
                return 'Please enter your email';
              }
              if (!value.contains('@')) {
                return 'Please enter a valid email';
              }
              return null;
            },
          ),
          SizedBox(height: ThemeDimensions.defaultPadding),
          TextFormField(
            controller: _passwordController,
            obscureText: _obscurePassword,
            decoration: InputDecoration(
              labelText: 'Password',
              hintText: 'Enter your password',
              prefixIcon: Icon(Icons.lock_outlined),
              suffixIcon: IconButton(
                icon: Icon(
                  _obscurePassword ? Icons.visibility_off : Icons.visibility,
                ),
                onPressed: () {
                  setState(() {
                    _obscurePassword = !_obscurePassword;
                  });
                },
              ),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(
                  ThemeDimensions.defaultRadius,
                ),
              ),
            ),
            validator: (value) {
              if (value == null || value.isEmpty) {
                return 'Please enter your password';
              }
              if (value.length < 6) {
                return 'Password must be at least 6 characters';
              }
              return null;
            },
          ),
        ],
      ),
    );
  }

  Widget _buildLoginButton() {
    return Consumer<VipClubAuthController>(
      builder: (context, authController, child) {
        return SizedBox(
          height: 56,
          child: ElevatedButton(
            onPressed: authController.isLoading ? null : _handleLogin,
            style: ElevatedButton.styleFrom(
              backgroundColor: ThemeColors.primaryBlue,
              foregroundColor: ThemeColors.neutralWhite,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(
                  ThemeDimensions.defaultRadius,
                ),
              ),
            ),
            child: authController.isLoading
                ? SizedBox(
                    height: 24,
                    width: 24,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      valueColor: AlwaysStoppedAnimation<Color>(
                        ThemeColors.neutralWhite,
                      ),
                    ),
                  )
                : Text(
                    'Login',
                    style: ThemeTextStyles.bodyLarge.copyWith(
                      fontWeight: FontWeight.bold,
                    ),
                  ),
          ),
        );
      },
    );
  }

  Widget _buildForgotPassword() {
    return Align(
      alignment: Alignment.centerRight,
      child: TextButton(
        onPressed: () {},
        child: Text(
          'Forgot Password?',
          style: ThemeTextStyles.bodyMedium.copyWith(
            color: ThemeColors.primaryBlue,
          ),
        ),
      ),
    );
  }

  Widget _buildDivider() {
    return Row(
      children: [
        Expanded(
          child: Divider(
            color: ThemeColors.neutralGrey.withOpacity(0.5),
          ),
        ),
        Padding(
          padding: EdgeInsets.symmetric(
            horizontal: ThemeDimensions.defaultPadding,
          ),
          child: Text(
            'OR',
            style: ThemeTextStyles.bodyMedium.copyWith(
              color: ThemeColors.neutralGrey,
            ),
          ),
        ),
        Expanded(
          child: Divider(
            color: ThemeColors.neutralGrey.withOpacity(0.5),
          ),
        ),
      ],
    );
  }

  Widget _buildRegisterPrompt() {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Text(
          "Don't have an account? ",
          style: ThemeTextStyles.bodyMedium.copyWith(
            color: ThemeColors.neutralGrey,
          ),
        ),
        TextButton(
          onPressed: () {
            context.push(VipClubRoutes.register);
          },
          child: Text(
            'Register',
            style: ThemeTextStyles.bodyMedium.copyWith(
              color: ThemeColors.primaryBlue,
              fontWeight: FontWeight.bold,
            ),
          ),
        ),
      ],
    );
  }
}
