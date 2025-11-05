/// Login screen for app_qy
/// Features phone number and WeChat authentication options
library;

import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import '../../../../../common/auth_v2/auth_v2.dart';
import '../../../provider_app_qy/user_provider_app_qy.dart';
import '../widgets/phone_login_button.dart';
import '../widgets/wechat_login_button.dart';
import '../widgets/agreement_checkbox.dart';

class LoginScreenAppQy extends StatefulWidget {
  const LoginScreenAppQy({super.key});

  @override
  State<LoginScreenAppQy> createState() => _LoginScreenAppQyState();
}

class _LoginScreenAppQyState extends State<LoginScreenAppQy> {
  final _formKey = GlobalKey<FormState>();
  final _phoneController = TextEditingController();
  final _codeController = TextEditingController();
  bool _showPhoneForm = false;
  bool _agreedToTerms = false;
  bool _isLoading = false;
  Timer? _resendTimer;
  int _countdownSeconds = 0;

  @override
  void initState() {
    super.initState();
    _initializeAuth();
  }

  @override
  void dispose() {
    _phoneController.dispose();
    _codeController.dispose();
    _resendTimer?.cancel();
    super.dispose();
  }

  Future<void> _initializeAuth() async {
    final userProvider = Provider.of<UserProviderAppQy>(context, listen: false);
    await userProvider.initializeAuth();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      body: SafeArea(
        child: Consumer<UserProviderAppQy>(
          builder: (context, userProvider, child) {
            return SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 32.0),
              child: Column(
                children: [
                  const SizedBox(height: 80),
                  _buildAppIcon(),
                  const SizedBox(height: 16),
                  _buildAppTitle(),
                  const SizedBox(height: 8),
                  _buildAppSubtitle(),
                  const SizedBox(height: 60),
                  if (_showPhoneForm) ...[
                    _buildPhoneForm(userProvider),
                    const SizedBox(height: 24),
                  ] else ...[
                    _buildLoginButtons(userProvider),
                    const SizedBox(height: 32),
                  ],
                  _buildBottomSection(),
                  const SizedBox(height: 20),
                ],
              ),
            );
          },
        ),
      ),
    );
  }

  Widget _buildAppIcon() {
    return Container(
      width: 100,
      height: 100,
      decoration: BoxDecoration(
        color: const Color(0xFF4CAF50),
        borderRadius: BorderRadius.circular(24),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.1),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: const Icon(
        Icons.auto_stories,
        size: 50,
        color: Colors.white,
      ),
    );
  }

  Widget _buildAppTitle() {
    return const Text(
      'Every word counts here',
      style: TextStyle(
        fontSize: 24,
        fontWeight: FontWeight.w600,
        color: Colors.black87,
      ),
    );
  }

  Widget _buildAppSubtitle() {
    return const Text(
      '扇贝单词 记住单词，记录改变',
      style: TextStyle(
        fontSize: 16,
        color: Colors.grey,
      ),
    );
  }

  Widget _buildLoginButtons(UserProviderAppQy userProvider) {
    return Column(
      children: [
        PhoneLoginButton(
          onPressed: _agreedToTerms && !_isLoading
              ? () => _togglePhoneForm()
              : null,
        ),
        const SizedBox(height: 16),
        WeChatLoginButton(
          onPressed: _agreedToTerms && !_isLoading
              ? () => _handleWeChatLogin(userProvider)
              : null,
        ),
        const SizedBox(height: 24),
        _buildSkipLoginButton(userProvider),
      ],
    );
  }

  Widget _buildPhoneForm(UserProviderAppQy userProvider) {
    return Form(
      key: _formKey,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          TextFormField(
            controller: _phoneController,
            keyboardType: TextInputType.phone,
            decoration: const InputDecoration(
              labelText: '手机号',
              hintText: '请输入手机号',
              prefixIcon: Icon(Icons.phone),
              border: OutlineInputBorder(),
            ),
            validator: (value) {
              if (!userProvider.validatePhoneNumber(value ?? '')) {
                return '请输入有效的手机号';
              }
              return null;
            },
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: TextFormField(
                  controller: _codeController,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(
                    labelText: '验证码',
                    hintText: '请输入验证码',
                    prefixIcon: Icon(Icons.message),
                    border: OutlineInputBorder(),
                  ),
                  validator: (value) {
                    if (!userProvider.validateVerificationCode(value ?? '')) {
                      return '请输入6位数字验证码';
                    }
                    return null;
                  },
                ),
              ),
              const SizedBox(width: 12),
              ElevatedButton(
                onPressed: _countdownSeconds > 0 || _isLoading
                    ? null
                    : () => _sendVerificationCode(userProvider),
                child: Text(
                  _countdownSeconds > 0
                      ? '$_countdownSeconds秒'
                      : '获取验证码',
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          ElevatedButton(
            onPressed: _isLoading ? null : () => _handlePhoneLogin(userProvider),
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF4CAF50),
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(vertical: 16),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(8),
              ),
            ),
            child: _isLoading
                ? const SizedBox(
                    height: 20,
                    width: 20,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                    ),
                  )
                : const Text('登录'),
          ),
          const SizedBox(height: 12),
          TextButton(
            onPressed: () => setState(() => _showPhoneForm = false),
            child: const Text('返回'),
          ),
        ],
      ),
    );
  }

  Widget _buildSkipLoginButton(UserProviderAppQy userProvider) {
    return TextButton(
      onPressed: _isLoading ? null : () => _handleSkipLogin(userProvider),
      child: const Text(
        '跳过登录 (Debug)',
        style: TextStyle(
          color: Colors.grey,
          fontSize: 14,
        ),
      ),
    );
  }

  Widget _buildBottomSection() {
    return Column(
      children: [
        AgreementCheckbox(
          value: _agreedToTerms,
          onChanged: (value) => setState(() => _agreedToTerms = value ?? false),
        ),
        const SizedBox(height: 16),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            IconButton(
              onPressed: () {},
              icon: const Icon(Icons.notifications_outlined),
              color: Colors.grey[600],
            ),
            const SizedBox(width: 32),
            IconButton(
              onPressed: () {},
              icon: const Icon(Icons.settings_outlined),
              color: Colors.grey[600],
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
        final result = await userProvider.sendVerificationCode(_phoneController.text);

        if (result.success) {
          _startCountdown();
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('验证码已发送')),
            );
          }
        } else {
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: Text(result.errorMessage ?? '发送验证码失败')),
            );
          }
        }
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('发送验证码错误: $e')),
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
              const SnackBar(content: Text('登录失败')),
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
            const SnackBar(content: Text('微信登录失败')),
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