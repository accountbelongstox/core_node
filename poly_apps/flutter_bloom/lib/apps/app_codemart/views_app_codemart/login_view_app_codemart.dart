import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../localization_app_codemart/localization_keys_app_codemart.dart';
import '../main_app_codemart.dart';
import '../models_app_codemart/user_model_app_codemart.dart';
import '../router_app_codemart/router_app_codemart.dart';
import '../services_app_codemart/auth_api_service_app_codemart.dart';

class LoginViewAppCodemart extends StatefulWidget {
  const LoginViewAppCodemart({super.key});

  @override
  State<LoginViewAppCodemart> createState() => _LoginViewAppCodemartState();
}

class _LoginViewAppCodemartState extends State<LoginViewAppCodemart> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _isLoading = false;
  bool _obscurePassword = true;

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _handleLogin() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _isLoading = true);

    try {
      final authService = context.read<AuthApiServiceAppCodemart>();
      final response = await authService.login(
        email: _emailController.text.trim(),
        password: _passwordController.text,
      );

      if (!mounted) return;

      if (response.success && response.data != null) {
        final userModel = context.read<UserModelAppCodemart>();
        final data = response.data!;
        userModel.login(
          data['user'] as Map<String, dynamic>,
          data['token'] as String,
          data['developer'] as Map<String, dynamic>?,
          data['client'] as Map<String, dynamic>?,
        );

        RouterAppCodemart.goToHome(context);
      } else {
        _showError(response.message ?? 'Login failed');
      }
    } catch (e) {
      _showError('Login error: $e');
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  void _showError(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: Colors.red,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(context.tr(LocalizationKeysAppCodemart.codemartLogin)),
      ),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Form(
              key: _formKey,
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // Logo/Title
                  Icon(
                    Icons.code,
                    size: 80,
                    color: Theme.of(context).colorScheme.primary,
                  ),
                  const SizedBox(height: 16),
                  Text(
                    context.tr(LocalizationKeysAppCodemart.codemartAppName),
                    style: Theme.of(context).textTheme.headlineMedium,
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 48),

                  // Email field
                  TextFormField(
                    controller: _emailController,
                    keyboardType: TextInputType.emailAddress,
                    decoration: InputDecoration(
                      labelText: context.tr(LocalizationKeysAppCodemart.codemartEmail),
                      prefixIcon: const Icon(Icons.email),
                    ),
                    validator: (value) {
                      if (value == null || value.isEmpty) {
                        return context.tr(LocalizationKeysAppCodemart.codemartPleaseEnterEmail);
                      }
                      if (!value.contains('@')) {
                        return context.tr(LocalizationKeysAppCodemart.codemartPleaseEnterValidEmail);
                      }
                      return null;
                    },
                  ),
                  const SizedBox(height: 16),

                  // Password field
                  TextFormField(
                    controller: _passwordController,
                    obscureText: _obscurePassword,
                    decoration: InputDecoration(
                      labelText: context.tr(LocalizationKeysAppCodemart.codemartPassword),
                      prefixIcon: const Icon(Icons.lock),
                      suffixIcon: IconButton(
                        icon: Icon(
                          _obscurePassword ? Icons.visibility : Icons.visibility_off,
                        ),
                        onPressed: () {
                          setState(() => _obscurePassword = !_obscurePassword);
                        },
                      ),
                    ),
                    validator: (value) {
                      if (value == null || value.isEmpty) {
                        return context.tr(LocalizationKeysAppCodemart.codemartPleaseEnterPassword);
                      }
                      if (value.length < 6) {
                        return context.tr(LocalizationKeysAppCodemart.codemartPasswordMinLength);
                      }
                      return null;
                    },
                  ),
                  const SizedBox(height: 24),

                  // Login button
                  FilledButton(
                    onPressed: _isLoading ? null : _handleLogin,
                    child: _isLoading
                        ? const SizedBox(
                            height: 20,
                            width: 20,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : Text(context.tr(LocalizationKeysAppCodemart.codemartLogin)),
                  ),
                  const SizedBox(height: 16),

                  // Register link
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(context.tr(LocalizationKeysAppCodemart.codemartDontHaveAccount)),
                      TextButton(
                        onPressed: () => RouterAppCodemart.goToRegister(context),
                        child: Text(
                          context.tr(LocalizationKeysAppCodemart.codemartRegister),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
