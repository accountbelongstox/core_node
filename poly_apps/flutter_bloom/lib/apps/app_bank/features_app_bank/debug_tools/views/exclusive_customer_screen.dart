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

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:qyflutter/common/utils/device_utils.dart';
import 'package:qyflutter/apps/app_bank/config_app_bank/constants.dart';
import '../../../managers_app_bank/license_registration_manager.dart';

class ExclusiveCustomerScreen extends StatefulWidget {
  const ExclusiveCustomerScreen({super.key});

  @override
  State<ExclusiveCustomerScreen> createState() => _ExclusiveCustomerScreenState();
}

class _ExclusiveCustomerScreenState extends State<ExclusiveCustomerScreen> {
  final TextEditingController _registrationCodeController = TextEditingController();
  final TextEditingController _superPasswordController = TextEditingController();
  final TextEditingController _targetMachineCodeController = TextEditingController();
  final TextEditingController _generatedCodeController = TextEditingController();
  
  String? _errorMessage;
  bool _isGenerating = false;
  bool _hasGeneratedCode = false;
  final LicenseRegistrationManager _licenseManager = LicenseRegistrationManager();
  bool _isSuperUser = false;
  String _selectedDurationType = 'Y'; // 'Y' for year, 'L' for lifetime

  @override
  void initState() {
    super.initState();
    _isSuperUser = _licenseManager.isSuperUser;
  }

  Future<void> _generateRegistrationCode() async {
    setState(() {
      _errorMessage = null;
      _isGenerating = true;
      _hasGeneratedCode = false;
      _generatedCodeController.clear();
    });

    try {
      final targetMachineCode = _targetMachineCodeController.text.trim().toUpperCase();

      // Only require super password if not a super user
      if (!_isSuperUser) {
        final superPassword = _superPasswordController.text.trim();

        if (superPassword.isEmpty) {
          setState(() {
            _errorMessage = '请输入超级密码';
            _isGenerating = false;
          });
          return;
        }

        if (!DeviceUtils.validateDeveloperPassword(superPassword)) {
          setState(() {
            _errorMessage = '超级密码错误';
            _isGenerating = false;
          });
          return;
        }
      }

      if (targetMachineCode.isEmpty) {
        setState(() {
          _errorMessage = '请输入目标机器码';
          _isGenerating = false;
        });
        return;
      }

      if (targetMachineCode.length != 16) {
        setState(() {
          _errorMessage = '机器码必须是16位';
          _isGenerating = false;
        });
        return;
      }

      final registrationTime = DateTime.now();
      final generatedCode = DeviceUtils.generateRegistrationCodeWithTime(
        targetMachineCode,
        registrationTime,
        _selectedDurationType,
      );

      setState(() {
        _generatedCodeController.text = generatedCode;
        _hasGeneratedCode = true;
        _isGenerating = false;
      });
    } catch (e) {
      setState(() {
        _errorMessage = '生成注册码失败: $e';
        _isGenerating = false;
      });
    }
  }

  void _copyGeneratedCode() {
    final code = _generatedCodeController.text;
    if (code.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('没有可复制的注册码')),
      );
      return;
    }

    Clipboard.setData(ClipboardData(text: code));
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('注册码已复制到剪贴板')),
    );
  }


  @override
  void dispose() {
    _registrationCodeController.dispose();
    _superPasswordController.dispose();
    _targetMachineCodeController.dispose();
    _generatedCodeController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('生成注册码'),
        backgroundColor: const Color(0xFF74B9FF),
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Colors.white),
          onPressed: () => context.pop(),
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (_isSuperUser) _buildSuperUserBadge(),
            const SizedBox(height: 16),
            _buildInputSection(),
            const SizedBox(height: 24),
            if (_errorMessage != null) _buildErrorMessage(),
            const SizedBox(height: 24),
            _buildGenerateButton(),
            const SizedBox(height: 24),
            if (_hasGeneratedCode) _buildGeneratedCodeSection(),
          ],
        ),
      ),
    );
  }

  Widget _buildSuperUserBadge() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.amber.shade50,
        borderRadius: BorderRadius.circular(BankConstants.borderRadius),
        border: Border.all(color: Colors.amber.shade200),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            decoration: BoxDecoration(
              color: Colors.amber,
              borderRadius: BorderRadius.circular(BankConstants.borderRadius),
            ),
            child: const Text(
              '超级用户',
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w600,
                color: Colors.white,
              ),
            ),
          ),
          const SizedBox(width: 12),
          const Expanded(
            child: Text(
              '您拥有生成注册码的权限，无需输入超级密码',
              style: TextStyle(
                fontSize: 14,
                color: Colors.black87,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildInputSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _buildTextField(
          controller: _targetMachineCodeController,
          label: '目标机器码',
          hint: '输入要生成注册码的机器码（16位）',
          obscureText: false,
          textCapitalization: TextCapitalization.characters,
        ),
        const SizedBox(height: 16),
        _buildDurationTypeSelector(),
        const SizedBox(height: 16),
        // Only show super password field if not a super user
        if (!_isSuperUser) ...[
          _buildTextField(
            controller: _superPasswordController,
            label: '超级密码',
            hint: '请输入超级密码',
            obscureText: true,
          ),
          const SizedBox(height: 16),
        ],
        _buildTextField(
          controller: _registrationCodeController,
          label: '注册码（可选）',
          hint: '输入当前机器的注册码进行验证',
          obscureText: false,
        ),
      ],
    );
  }

  Widget _buildDurationTypeSelector() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          '注册码类型',
          style: TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w500,
            color: Colors.black87,
          ),
        ),
        const SizedBox(height: 8),
        Row(
          children: [
            Expanded(
              child: RadioListTile<String>(
                title: const Text('年（1年有效期）'),
                value: 'Y',
                groupValue: _selectedDurationType,
                onChanged: (value) {
                  setState(() {
                    _selectedDurationType = value!;
                  });
                },
                contentPadding: EdgeInsets.zero,
                dense: true,
              ),
            ),
            Expanded(
              child: RadioListTile<String>(
                title: const Text('永久'),
                value: 'L',
                groupValue: _selectedDurationType,
                onChanged: (value) {
                  setState(() {
                    _selectedDurationType = value!;
                  });
                },
                contentPadding: EdgeInsets.zero,
                dense: true,
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildTextField({
    required TextEditingController controller,
    required String label,
    required String hint,
    required bool obscureText,
    TextCapitalization textCapitalization = TextCapitalization.none,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w500,
            color: Colors.black87,
          ),
        ),
        const SizedBox(height: 8),
        TextField(
          controller: controller,
          obscureText: obscureText,
          textCapitalization: textCapitalization,
          decoration: InputDecoration(
            hintText: hint,
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(BankConstants.borderRadius),
            ),
            contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          ),
        ),
      ],
    );
  }

  Widget _buildErrorMessage() {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.red.shade50,
        borderRadius: BorderRadius.circular(BankConstants.borderRadius),
        border: Border.all(color: Colors.red.shade200),
      ),
      child: Row(
        children: [
          const Icon(Icons.error_outline, color: Colors.red, size: 20),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              _errorMessage!,
              style: const TextStyle(color: Colors.red, fontSize: 14),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildGenerateButton() {
    return ElevatedButton(
      onPressed: _isGenerating ? null : _generateRegistrationCode,
      style: ElevatedButton.styleFrom(
        backgroundColor: const Color(0xFF74B9FF),
        foregroundColor: Colors.white,
        padding: const EdgeInsets.symmetric(vertical: 16),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(BankConstants.borderRadius),
        ),
      ),
      child: _isGenerating
          ? const SizedBox(
              height: 20,
              width: 20,
              child: CircularProgressIndicator(
                strokeWidth: 2,
                valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
              ),
            )
          : const Text(
              '生成注册码',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
            ),
    );
  }

  Widget _buildGeneratedCodeSection() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.green.shade50,
        borderRadius: BorderRadius.circular(BankConstants.borderRadius),
        border: Border.all(color: Colors.green.shade200),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            '生成的注册码',
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w600,
              color: Colors.black87,
            ),
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: GestureDetector(
                  onLongPress: _copyGeneratedCode,
                  child: TextField(
                    controller: _generatedCodeController,
                    readOnly: true,
                    enableInteractiveSelection: true,
                    style: const TextStyle(
                      fontSize: 14,
                      fontFamily: 'monospace',
                      color: Colors.black87,
                    ),
                    decoration: InputDecoration(
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(BankConstants.borderRadius),
                      ),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      filled: true,
                      fillColor: Colors.white,
                      hintText: '长按或点击复制按钮复制注册码',
                      hintStyle: TextStyle(
                        fontSize: 12,
                        color: Colors.grey[400],
                      ),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              ElevatedButton.icon(
                onPressed: _copyGeneratedCode,
                icon: const Icon(Icons.copy, size: 18),
                label: const Text('复制'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.green,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
