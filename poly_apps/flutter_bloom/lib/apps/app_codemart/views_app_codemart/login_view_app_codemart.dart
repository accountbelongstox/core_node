import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:qyflutter/common/localization/localization_manager.dart';

import '../config_app_codemart/debug_config_app_codemart.dart';
import '../localization_app_codemart/localization_keys_app_codemart.dart';
import '../models_app_codemart/app_data_center_app_codemart.dart';
import '../resources_app_codemart/colors_app_codemart.dart';
import '../resources_app_codemart/components_app_codemart.dart';
import '../resources_app_codemart/text_styles_app_codemart.dart';
import '../router_app_codemart/router_app_codemart.dart';
import '../services_app_codemart/auth_api_service_app_codemart.dart';

class LoginViewAppCodemart extends StatefulWidget {
  const LoginViewAppCodemart({super.key});

  @override
  State<LoginViewAppCodemart> createState() => _LoginViewAppCodemartState();
}

class _LoginViewAppCodemartState extends State<LoginViewAppCodemart> {
  final GlobalKey<FormState> _formKey = GlobalKey<FormState>();
  final TextEditingController _emailController = TextEditingController();
  final TextEditingController _passwordController = TextEditingController();
  bool _isLoading = false;
  bool _obscurePassword = true;
  UserModeType _selectedUserMode = UserModeType.developer;

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

    setState(() {
      _isLoading = true;
    });

    try {
      final AppDataCenterAppCodemart dataCenter = AppDataCenterAppCodemart();

      if (DebugConfigAppCodemart.isDebugMode) {
        await dataCenter.debugLogin(
          _emailController.text.trim(),
          _passwordController.text,
          _selectedUserMode,
        );

        if (!mounted) {
          return;
        }

        if (dataCenter.isLoggedIn && dataCenter.userProfile != null) {
          _showSuccess('Debug login successful as ${_selectedUserMode.name}');
          await Future<void>.delayed(const Duration(milliseconds: 120));
          if (mounted) {
            RouterAppCodemart.goToHome(context);
          }
        } else {
          _showError('Login state verification failed');
        }
      } else {
        final AuthApiServiceAppCodemart authService = context.read<AuthApiServiceAppCodemart>();
        final response = await authService.login(
          email: _emailController.text.trim(),
          password: _passwordController.text,
        );

        if (!mounted) {
          return;
        }

        if (response.success && response.data != null) {
          final Map<String, dynamic> data = response.data! as Map<String, dynamic>;
          await dataCenter.login(
            data['user'] as Map<String, dynamic>,
            data['token'] as String,
            data['developer'] as Map<String, dynamic>?,
            data['client'] as Map<String, dynamic>?,
          );
          RouterAppCodemart.goToHome(context);
        } else {
          _showError(response.message ?? 'Login failed');
        }
      }
    } catch (e) {
      _showError('Login error: $e');
    } finally {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return CodemartBackground(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
      child: Scaffold(
        backgroundColor: Colors.transparent,
        appBar: AppBar(
          title: Text(LocalizationKeysAppCodemart.codemartLogin.tr(context)),
          backgroundColor: Colors.transparent,
        ),
        body: Center(
          child: SingleChildScrollView(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 1100),
              child: LayoutBuilder(
                builder: (BuildContext context, BoxConstraints constraints) {
                  final bool showSidePanel = constraints.maxWidth > 900;
                  final Widget heroPanel = _buildHeroPanel(context);
                  final Widget formPanel = _buildFormCard(context);

                  if (showSidePanel) {
                    return Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: <Widget>[
                        Expanded(child: heroPanel),
                        const SizedBox(width: 32),
                        Expanded(child: formPanel),
                      ],
                    );
                  }

                  return Column(
                    children: <Widget>[
                      heroPanel,
                      const SizedBox(height: 24),
                      formPanel,
                    ],
                  );
                },
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildHeroPanel(BuildContext context) {
    return CodemartGlassCard(
      gradient: CodemartColors.buildGradient(
        CodemartColors.heroGradient,
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
      ),
      showBorder: false,
      padding: const EdgeInsets.all(32),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          if (DebugConfigAppCodemart.isDebugMode)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
              decoration: BoxDecoration(
                color: Colors.black.withOpacity(0.25),
                borderRadius: BorderRadius.circular(30),
                border: Border.all(color: Colors.white24),
              ),
              child: Text(
                LocalizationKeysAppCodemart.codemartLoginDebugBanner.tr(context),
                style: CodemartTextStyles.bodyMuted.copyWith(color: CodemartColors.textPrimary),
              ),
            ),
          if (DebugConfigAppCodemart.isDebugMode) const SizedBox(height: 16),
          Text(
            LocalizationKeysAppCodemart.codemartLoginHeroTitle.tr(context),
            style: CodemartTextStyles.heroTitle,
          ),
          const SizedBox(height: 12),
          Text(
            LocalizationKeysAppCodemart.codemartLoginHeroSubtitle.tr(context),
            style: CodemartTextStyles.heroSubtitle,
          ),
          const SizedBox(height: 32),
          _HeroPoint(
            icon: Icons.timeline_outlined,
            label: LocalizationKeysAppCodemart.codemartLoginFeatureDelivery.tr(context),
          ),
          const SizedBox(height: 16),
          _HeroPoint(
            icon: Icons.verified_outlined,
            label: LocalizationKeysAppCodemart.codemartLoginFeatureEscrow.tr(context),
          ),
          const SizedBox(height: 16),
          _HeroPoint(
            icon: Icons.sensors_outlined,
            label: LocalizationKeysAppCodemart.codemartLoginFeatureRealtime.tr(context),
          ),
        ],
      ),
    );
  }

  Widget _buildFormCard(BuildContext context) {
    return CodemartGlassCard(
      padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 32),
      child: Form(
        key: _formKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Text(
              LocalizationKeysAppCodemart.codemartWelcome.tr(context),
              style: CodemartTextStyles.sectionTitle,
            ),
            const SizedBox(height: 32),
            TextFormField(
              controller: _emailController,
              decoration: InputDecoration(
                labelText: LocalizationKeysAppCodemart.codemartEmail.tr(context),
              ),
              validator: (String? value) {
                if (value == null || value.isEmpty) {
                  return LocalizationKeysAppCodemart.codemartPleaseEnterEmail.tr(context);
                }
                if (!value.contains('@')) {
                  return LocalizationKeysAppCodemart.codemartPleaseEnterValidEmail.tr(context);
                }
                return null;
              },
            ),
            const SizedBox(height: 20),
            TextFormField(
              controller: _passwordController,
              obscureText: _obscurePassword,
              decoration: InputDecoration(
                labelText: LocalizationKeysAppCodemart.codemartPassword.tr(context),
                suffixIcon: IconButton(
                  icon: Icon(_obscurePassword ? Icons.visibility_outlined : Icons.visibility_off_outlined),
                  onPressed: () {
                    setState(() {
                      _obscurePassword = !_obscurePassword;
                    });
                  },
                ),
              ),
              validator: (String? value) {
                if (value == null || value.isEmpty) {
                  return LocalizationKeysAppCodemart.codemartPleaseEnterPassword.tr(context);
                }
                if (value.length < 6) {
                  return LocalizationKeysAppCodemart.codemartPasswordMinLength.tr(context);
                }
                return null;
              },
            ),
            if (DebugConfigAppCodemart.isDebugMode) ...<Widget>[
              const SizedBox(height: 24),
              Text(
                LocalizationKeysAppCodemart.codemartUser.tr(context),
                style: CodemartTextStyles.sectionTitle.copyWith(fontSize: 16),
              ),
              const SizedBox(height: 12),
              CodemartSelectableTile(
                selected: _selectedUserMode == UserModeType.developer,
                icon: Icons.auto_awesome,
                title: LocalizationKeysAppCodemart.codemartDeveloper.tr(context),
                subtitle: LocalizationKeysAppCodemart.codemartModeDeveloperSubtitle.tr(context),
                onTap: () {
                  setState(() {
                    _selectedUserMode = UserModeType.developer;
                  });
                },
              ),
              const SizedBox(height: 12),
              CodemartSelectableTile(
                selected: _selectedUserMode == UserModeType.client,
                icon: Icons.business_center_outlined,
                title: LocalizationKeysAppCodemart.codemartClient.tr(context),
                subtitle: LocalizationKeysAppCodemart.codemartModeClientSubtitle.tr(context),
                onTap: () {
                  setState(() {
                    _selectedUserMode = UserModeType.client;
                  });
                },
              ),
            ],
            const SizedBox(height: 24),
            CodemartGlowButton(
              label: LocalizationKeysAppCodemart.codemartLogin.tr(context),
              icon: Icons.arrow_forward_rounded,
              loading: _isLoading,
              enabled: !_isLoading,
              onTap: _handleLogin,
            ),
            const SizedBox(height: 20),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: <Widget>[
                Text(LocalizationKeysAppCodemart.codemartDontHaveAccount.tr(context)),
                TextButton(
                  onPressed: () => RouterAppCodemart.goToRegister(context),
                  child: Text(LocalizationKeysAppCodemart.codemartRegister.tr(context)),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  void _showError(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: CodemartColors.danger,
      ),
    );
  }

  void _showSuccess(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: CodemartColors.success,
      ),
    );
  }
}

class _HeroPoint extends StatelessWidget {
  final IconData icon;
  final String label;

  const _HeroPoint({
    required this.icon,
    required this.label,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Container(
          height: 38,
          width: 38,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: Colors.white.withOpacity(0.15),
          ),
          child: Icon(icon, color: CodemartColors.textPrimary),
        ),
        const SizedBox(width: 14),
        Expanded(
          child: Text(
            label,
            style: CodemartTextStyles.body.copyWith(color: CodemartColors.textPrimary),
          ),
        ),
      ],
    );
  }
}
