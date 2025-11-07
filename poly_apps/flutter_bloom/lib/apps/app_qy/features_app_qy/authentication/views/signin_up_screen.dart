// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\\..\\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

// ============================================================================
// [DEPRECATED - MS] This screen is deprecated and should not be used
// ============================================================================
// This old screen has been replaced by refactored MVC architecture screens.
// Please use the refactored screens located in:
//   - features_app_qy/auth/views/login_phone_screen_refactored_app_qy.dart
// This file is kept for reference only and is not connected to the app routes.
// ============================================================================

import 'package:flutter/material.dart';
import 'package:qyflutter/common/widgets/custom_text_field.dart';
import 'package:qyflutter/common/widgets/custom_gradient_text.dart';
import 'package:qyflutter/common/widgets/outelineborder.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/common/assets/common_assets_icons.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:qyflutter/common/theme/base/theme_colors.dart';
import 'package:qyflutter/apps/app_qy/controller_app_qy/auth_controller_app_qy.dart';
import 'package:qyflutter/apps/app_qy/model_app_qy/user_model.dart';
import 'dart:convert';
import 'dart:developer';
import 'package:qyflutter/common/utils/database/cache_operations.dart';
// DataStatus functionality removed - using storage directly
import 'package:qyflutter/common/localization/localization_manager.dart';
import 'package:provider/provider.dart';
import 'package:qyflutter/common/provider_status/user_provider.dart';
import 'package:go_router/go_router.dart';
import 'package:qyflutter/apps/app_qy/features_app_qy/authentication/actions/auth_actions.dart';
import 'package:qyflutter/apps/app_qy/router_app_qy/routes_provider_app_qy.dart';
import 'package:qyflutter/apps/app_qy/localization_app_qy/localization_keys_app_qy.dart';

// 自定义分段按钮组件
class SegmentedButton extends StatefulWidget {
  final String leftText;
  final String rightText;
  final Color? leftBackgroundColor;
  final Color? rightBackgroundColor;
  final Color? leftTextColor;
  final Color? rightTextColor;
  final Function()? onLeftTap;
  final Function()? onRightTap;
  final bool initialLeftSelected;

  const SegmentedButton({
    super.key,
    required this.leftText,
    required this.rightText,
    this.leftBackgroundColor,
    this.rightBackgroundColor,
    this.leftTextColor,
    this.rightTextColor,
    this.onLeftTap,
    this.onRightTap,
    this.initialLeftSelected = true,
  });

  @override
  State<SegmentedButton> createState() => _SegmentedButtonState();
}

class _SegmentedButtonState extends State<SegmentedButton> {
  late bool _isLeftSelected;

  @override
  void initState() {
    super.initState();
    _isLeftSelected = widget.initialLeftSelected;
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Container(
      height: 48, // 增加高度以匹配设计
      width: double.infinity, // 让按钮占满宽度
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(24),
        color: theme.colorScheme.surface, // 使用暗色主题的表面色
      ),
      child: Row(
        children: [
          _buildSegment(
            text: widget.leftText,
            isSelected: _isLeftSelected,
            backgroundColor: theme.colorScheme.primary, // 使用主色调（紫色）
            textColor: _isLeftSelected
                ? theme.colorScheme.onPrimary
                : theme.colorScheme.onSurface,
            onTap: () {
              if (!_isLeftSelected) {
                setState(() => _isLeftSelected = true);
                widget.onLeftTap?.call();
              } else {
                widget.onLeftTap?.call();
              }
            },
            isLeft: true,
          ),
          _buildSegment(
            text: widget.rightText,
            isSelected: !_isLeftSelected,
            backgroundColor: theme.colorScheme.primary, // 使用主色调（紫色）
            textColor: !_isLeftSelected
                ? theme.colorScheme.onPrimary
                : theme.colorScheme.onSurface,
            onTap: () {
              if (_isLeftSelected) {
                setState(() => _isLeftSelected = false);
                widget.onRightTap?.call();
              } else {
                widget.onRightTap?.call();
              }
            },
            isLeft: false,
          ),
        ],
      ),
    );
  }

  Widget _buildSegment({
    required String text,
    required bool isSelected,
    required Color backgroundColor,
    required Color textColor,
    required VoidCallback onTap,
    required bool isLeft,
  }) {
    return Expanded(
      child: GestureDetector(
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          decoration: BoxDecoration(
            color: isSelected ? backgroundColor : ThemeColors.transparent,
            borderRadius: BorderRadius.horizontal(
              left: Radius.circular(isLeft ? 24 : 0),
              right: Radius.circular(!isLeft ? 24 : 0),
            ),
          ),
          child: Center(
            child: Text(
              text,
              style: TextStyle(
                color: textColor,
                fontSize: 16, // 增大字体大小
                fontWeight: isSelected ? FontWeight.w600 : FontWeight.w400,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class SignInUpScreenView extends StatefulWidget {
  const SignInUpScreenView({super.key});
  @override
  State<SignInUpScreenView> createState() => _SignInUpScreenViewState();
}

class _SignInUpScreenViewState extends State<SignInUpScreenView> {
  bool? checked = false;
  final TextEditingController _emailController = TextEditingController();
  final TextEditingController _passwordController = TextEditingController();
  final TextEditingController _confirmPasswordController =
      TextEditingController();
  final TextEditingController _usernameController = TextEditingController();
  String? _infoMessage;
  bool _isError = false;
  bool _rememberMe = false;
  bool _isSignIn = true; // 控制是否为登录模式

  @override
  void initState() {
    super.initState();
    _loadSavedCredentials();
  }

  Future<void> _loadSavedCredentials() async {
    try {
      final savedDataStr = CacheOperations.get<String>('remember_me');
      if (savedDataStr != null) {
        final savedData = json.decode(savedDataStr) as Map<String, dynamic>;
        if (savedData['enabled'] == true) {
          setState(() {
            _emailController.text = savedData['username'] ?? '';
            _passwordController.text = savedData['password'] ?? '';
            _rememberMe = true;
            checked = true;
          });
        }
      } else {
        log('No saved credentials found');
      }
    } catch (e) {
      log('Error loading saved credentials: $e');
    }
  }

  Future<void> _saveCredentials() async {
    try {
      if (_rememberMe) {
        final credentialsJson = json.encode({
          'enabled': true,
          'username': _emailController.text,
          'password': _passwordController.text,
        });
        CacheOperations.set('remember_me', credentialsJson);
      } else {
        // await CacheOperations.delete('remember_me');
      }
    } catch (e) {
      debugPrint('Error saving credentials: $e');
    }
  }

  void _handleLogin() async {
    final username = _emailController.text.trim();
    final password = _passwordController.text;
    final userProvider = Provider.of<BaseUserProvider>(context, listen: false);

    // Validate input
    if (username.isEmpty || username.length < 3) {
      if (mounted) {
        setState(() {
          _infoMessage = 'validation.username_required'.tr(context);
          _isError = true;
        });
      }
      return;
    }

    if (password.isEmpty || password.length < 6) {
      if (mounted) {
        setState(() {
          _infoMessage = 'validation.password_required'.tr(context);
          _isError = true;
        });
      }
      return;
    }

    final AuthControllerAppQy authController = AuthControllerAppQy(context);

    try {
      // Update remember me state before login
      _rememberMe = checked ?? false;

      final response = await authController.login(
        username,
        password,
        checked ?? false,
      );

      if (response.isSuccess) {
        // Save credentials first if remember me is checked
        await _saveCredentials();

        // Create user model from response
        final userData = response.data!['user'] as Map<String, dynamic>;
        final user = UserModel.fromJson(userData);
        user.token = response.data!['token'];
        user.tokenType = response.data!['token_type'];
        user.expiration = response.data!['expiration']?.toString();

        // Update user provider
        userProvider.setUser(user);

        if (mounted) {
          setState(() {
            _infoMessage = 'login.success'.tr(context);
            _isError = false;
          });

          // Navigate after a brief delay
          await Future.delayed(const Duration(milliseconds: 100));

          if (mounted) {
            context.pushReplacement(QyAppRoutesProvider.routeHome);
          }
        }
      } else {
        if (mounted) {
          setState(() {
            _infoMessage = response.message ?? 'login.failed'.tr(context);
            _isError = true;
          });
        }
      }
    } catch (e) {
      debugPrint('Error logging in: $e');
      if (mounted) {
        setState(() {
          _infoMessage = 'login.error'.tr(context);
          _isError = true;
        });
      }
    }
  }

  void _handleSignUp() async {
    final username = _usernameController.text.trim();
    final email = _emailController.text.trim();
    final password = _passwordController.text;
    final confirmPassword = _confirmPasswordController.text;

    // 验证输入
    if (username.isEmpty) {
      setState(() {
        _infoMessage = 'Please enter username';
        _isError = true;
      });
      return;
    }

    if (email.isEmpty || !email.contains('@')) {
      setState(() {
        _infoMessage = 'validation.email_invalid'.tr(context);
        _isError = true;
      });
      return;
    }

    if (password.isEmpty || password.length < 6) {
      setState(() {
        _infoMessage = 'validation.password_required'.tr(context);
        _isError = true;
      });
      return;
    }

    if (password != confirmPassword) {
      setState(() {
        _infoMessage = 'Passwords do not match';
        _isError = true;
      });
      return;
    }

    final AuthControllerAppQy authController = AuthControllerAppQy(context);

    try {
      final response = await authController.register(
        email: email,
        password: password,
        username: username,
      );

      if (response.statusCode == 200) {
        setState(() {
          _infoMessage = 'signup.success'.tr(context);
          _isError = false;
        });

        // 注册成功后延迟跳转
        await Future.delayed(const Duration(milliseconds: 100));
        if (mounted) {
          context.pushReplacement(QyAppRoutesProvider.routeCongratulations);
        }
      } else {
        setState(() {
          _infoMessage = response.message ?? 'signup.failed'.tr(context);
          _isError = true;
        });
      }
    } catch (e) {
      debugPrint('Error signing up: $e');
      setState(() {
        _infoMessage = 'signup.error'.tr(context);
        _isError = true;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final userProvider = Provider.of<BaseUserProvider>(context);
    final theme = Theme.of(context);

    return Scaffold(
      backgroundColor: Theme.of(context).cardColor,
      appBar: AppBar(
        backgroundColor: ThemeColors.transparent,
        elevation: 0,
        leading: IconButton(
          icon: Icon(
            Icons.arrow_back_ios,
            color: Theme.of(context).colorScheme.onSurface,
          ),
          onPressed: () {
            context.pushReplacement(QyAppRoutesProvider.routeHome);
          },
        ),
      ),
      body: Column(
        children: [
          Expanded(
            child: SingleChildScrollView(
              child: Padding(
                padding: const EdgeInsets.all(ThemeDimensions.paddingSizeDefault),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    const SizedBox(height: ThemeDimensions.paddingSizeDefault),
                    Container(
                      height: 160, // 固定容器高度，确保足够容纳放大后的图标
                      alignment: Alignment.center,
                      child: CircleAvatar(
                        radius: _isSignIn
                            ? ThemeDimensions.radiusBig
                            : ThemeDimensions.radiusBig * 2,
                        backgroundColor: _isSignIn
                            ? Theme.of(context).colorScheme.surfaceTint
                            : ThemeColors.transparent,
                        child: _isSignIn
                            ? _buildSafeImage(CommonAssetsIcons.splashLogo)
                            : _buildSafeImage(CommonAssetsIcons.logoReal),
                      ),
                    ),
                    CustomGradientText(
                      text: QyAppLocalizationKeys.qyWelcome.tr(context),
                      fontSize: ThemeDimensions.fontSizeOverOverOverExtraLarge,
                      gradientStyleIndex: 4,
                      style: ThemeTextStyles.textSemiBold,
                    ),
                    const SizedBox(height: ThemeDimensions.paddingSizeDefault),
                    AnimatedContainer(
                      duration: const Duration(milliseconds: 1000),
                      curve: Curves.easeInOutCubic,
                      height: _isSignIn ? 180 : 360,
                      child: SingleChildScrollView(
                        physics: const NeverScrollableScrollPhysics(),
                        child: AnimatedSwitcher(
                          duration: const Duration(milliseconds: 800),
                          transitionBuilder:
                              (Widget child, Animation<double> animation) {
                            return FadeTransition(
                              opacity: animation,
                              child: SlideTransition(
                                position: Tween<Offset>(
                                  begin: const Offset(0.0, 0.2),
                                  end: Offset.zero,
                                ).animate(CurvedAnimation(
                                  parent: animation,
                                  curve: Curves.easeOutCubic,
                                )),
                                child: child,
                              ),
                            );
                          },
                          child: _isSignIn
                              ? _buildLoginForm()
                              : _buildSignUpForm(),
                        ),
                      ),
                    ),
                    if (_isSignIn) ...[
                      Row(
                        mainAxisAlignment: MainAxisAlignment.start,
                        children: [
                          Checkbox(
                              value: checked,
                              activeColor:
                                  Theme.of(context).colorScheme.surfaceTint,
                              focusColor: Theme.of(context).hintColor,
                              tristate: true,
                              checkColor: Theme.of(context).cardColor,
                              onChanged: (newBool) {
                                setState(() {
                                  checked = newBool;
                                });
                              }),
                          Text(QyAppLocalizationKeys.qyRememberMe.tr(context),
                              style: ThemeTextStyles.textMedium.copyWith(
                                color: Theme.of(context).colorScheme.onSurface,
                              )),
                        ],
                      ),
                      const SizedBox(height: ThemeDimensions.paddingSize),
                      InkWell(
                          onTap: () {
                            context.pushReplacement(QyAppRoutesProvider.routeForgot);
                          },
                          child: Text(QyAppLocalizationKeys.qyForgotPassword.tr(context),
                              style: ThemeTextStyles.textMedium.copyWith(
                                  color: Theme.of(context)
                                      .colorScheme
                                      .surfaceTint))),
                    ],
                    const SizedBox(height: ThemeDimensions.paddingSizeDefault),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 20),
                      child: SegmentedButton(
                        leftText: QyAppLocalizationKeys.qySignIn.tr(context),
                        rightText: QyAppLocalizationKeys.qySignUp.tr(context),
                        initialLeftSelected: _isSignIn,
                        onLeftTap: () {
                          if (!_isSignIn) {
                            setState(() {
                              _isSignIn = true;
                              _infoMessage = null;
                              _isError = false;
                              _emailController.clear();
                              _passwordController.clear();
                              _confirmPasswordController.clear();
                              _usernameController.clear();
                            });
                          } else {
                            AuthActions.handleLogin(
                              context,
                              username: _usernameController.text.trim(),
                              password: _passwordController.text,
                              rememberMe: checked ?? false,
                              onResult: (message, isError) {
                                setState(() {
                                  _infoMessage = message;
                                  _isError = isError;
                                });
                              },
                            );
                          }
                        },
                        onRightTap: () {
                          if (_isSignIn) {
                            setState(() {
                              _isSignIn = false;
                              _infoMessage = null;
                              _isError = false;
                              _emailController.clear();
                              _passwordController.clear();
                              _confirmPasswordController.clear();
                              _usernameController.clear();
                            });
                          } else {
                            AuthActions.handleSignUp(
                              context,
                              username: _usernameController.text.trim(),
                              password: _passwordController.text,
                              confirmPassword: _confirmPasswordController.text,
                              onResult: (message, isError) {
                                setState(() {
                                  _infoMessage = message;
                                  _isError = isError;
                                });
                              },
                            );
                          }
                        },
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          Container(
            padding: const EdgeInsets.all(ThemeDimensions.paddingSizeDefault),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Padding(
                  padding: const EdgeInsets.symmetric(
                      vertical: ThemeDimensions.paddingSizeDefault),
                  child: Text(
                    "continue_with".tr(context),
                    style: ThemeTextStyles.textMedium,
                  ),
                ),
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    CustomCircular(
                      height: ThemeDimensions.outlineHeight,
                      width: ThemeDimensions.outlineWidth,
                      outlineColor: Theme.of(context).colorScheme.surfaceTint,
                      radius: ThemeDimensions.roadArrowHeight,
                      widget: Padding(
                        padding: const EdgeInsets.all(ThemeDimensions.paddingSize),
                        child: _buildSafeImage(CommonAssetsIcons.wechat,
                            fit: BoxFit.cover),
                      ),
                    ),
                    Padding(
                      padding: EdgeInsets.symmetric(
                        vertical: ThemeDimensions.paddingSize,
                        horizontal: ThemeDimensions.paddingSizeOver,
                      ),
                      child: CustomCircular(
                        height: ThemeDimensions.outlineHeight,
                        width: ThemeDimensions.outlineWidth,
                        outlineColor: Theme.of(context).hintColor,
                        radius: ThemeDimensions.roadArrowHeight,
                        widget: Padding(
                          padding: const EdgeInsets.all(ThemeDimensions.paddingSize),
                          child: _buildSafeImage(CommonAssetsIcons.github),
                        ),
                      ),
                    ),
                    CustomCircular(
                      radius: ThemeDimensions.roadArrowHeight,
                      height: ThemeDimensions.outlineHeight,
                      width: ThemeDimensions.outlineWidth,
                      outlineColor: Theme.of(context).hintColor,
                      widget: Padding(
                        padding: const EdgeInsets.all(ThemeDimensions.paddingSize),
                        child: _buildSafeImage(CommonAssetsIcons.weibo,
                            fit: BoxFit.cover),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: ThemeDimensions.paddingSizeDefault),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSafeImage(String assetPath, {BoxFit fit = BoxFit.contain}) {
    try {
      return Image.asset(
        assetPath,
        fit: fit,
        errorBuilder: (context, error, stackTrace) {
          log('Error loading image $assetPath: $error');
          return Icon(
            Icons.image_not_supported_outlined,
            color: Theme.of(context).colorScheme.onSurface.withOpacity(0.5),
          );
        },
      );
    } catch (e) {
      log('Exception while loading image $assetPath: $e');
      return Icon(
        Icons.broken_image_outlined,
        color: Theme.of(context).colorScheme.onSurface.withOpacity(0.5),
      );
    }
  }

  Widget _buildLoginForm() {
    return Column(
      key: const ValueKey<String>('login_form'),
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(left: ThemeDimensions.paddingSize),
          child: Text("username".tr(context)),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(vertical: ThemeDimensions.paddingSize),
          child: CustomTextField(
            controller: _emailController,
            showCountryCode: false,
            countryDialCode: AutofillHints.username,
            inputType: TextInputType.text,
            prefixIcon: CommonAssetsIcons.username,
            hintText: "username".tr(context),
          ),
        ),
        Padding(
          padding: const EdgeInsets.only(left: ThemeDimensions.paddingSize),
          child: Text("password".tr(context)),
        ),
        const SizedBox(height: ThemeDimensions.paddingSizeSmall),
        CustomTextField(
          controller: _passwordController,
          prefixIcon: CommonAssetsIcons.password,
          showBorder: false,
          hintText: "password_hint".tr(context),
          isPassword: true,
        ),
      ],
    );
  }

  Widget _buildSignUpForm() {
    return Column(
      key: const ValueKey<String>('signup_form'),
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(left: ThemeDimensions.paddingSize),
          child: Text("Username"),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(vertical: ThemeDimensions.paddingSize),
          child: CustomTextField(
            controller: _usernameController,
            showCountryCode: false,
            inputType: TextInputType.text,
            prefixIcon: CommonAssetsIcons.username,
            hintText: "Enter username",
          ),
        ),
        Padding(
          padding: const EdgeInsets.only(left: ThemeDimensions.paddingSize),
          child: Text("password".tr(context)),
        ),
        const SizedBox(height: ThemeDimensions.paddingSizeSmall),
        CustomTextField(
          controller: _passwordController,
          prefixIcon: CommonAssetsIcons.password,
          showBorder: false,
          hintText: "password_hint".tr(context),
          isPassword: true,
        ),
        const SizedBox(height: ThemeDimensions.paddingSizeDefault),
        Padding(
          padding: const EdgeInsets.only(left: ThemeDimensions.paddingSize),
          child: Text("Confirm Password"),
        ),
        const SizedBox(height: ThemeDimensions.paddingSizeSmall),
        CustomTextField(
          controller: _confirmPasswordController,
          prefixIcon: CommonAssetsIcons.password,
          showBorder: false,
          hintText: "Confirm your password",
          isPassword: true,
        ),
      ],
    );
  }
}
