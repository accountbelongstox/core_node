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
import 'package:go_router/go_router.dart';
import 'package:qyflutter/common/theme/base/theme_colors.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import '../../../router_app_wuy/router_app_wuy.dart';

class WuyPersonalInfoScreen extends StatefulWidget {
  const WuyPersonalInfoScreen({super.key});

  @override
  State<WuyPersonalInfoScreen> createState() => _WuyPersonalInfoScreenState();
}

class _WuyPersonalInfoScreenState extends State<WuyPersonalInfoScreen> {
  final _formKey = GlobalKey<FormState>();
  final _nicknameController = TextEditingController(text: '小飞侠');
  final _signatureController = TextEditingController(text: '守护的未来');
  final _phoneController = TextEditingController(text: '138****8000');
  final _birthdayController = TextEditingController(text: '1990-01-01');
  final _addressController = TextEditingController(text: '北京市朝阳区');
  final _emailController = TextEditingController(text: 'user@example.com');
  final _idController = TextEditingController(text: '110101199001011234');
  
  String _selectedGender = '男';
  bool _isEditing = false;

  @override
  void dispose() {
    _nicknameController.dispose();
    _signatureController.dispose();
    _phoneController.dispose();
    _birthdayController.dispose();
    _addressController.dispose();
    _emailController.dispose();
    _idController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: ThemeColors.lightBackground,
      appBar: AppBar(
        title: Text(
          'Personal Information',
          style: ThemeTextStyles.displayMedium,
        ),
        backgroundColor: ThemeColors.primary,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Colors.white),
          onPressed: () => context.go(WuyAppRouter.routeProfile),
        ),
        actions: [
          TextButton(
            onPressed: _toggleEdit,
            child: Text(
              _isEditing ? 'Save' : 'Edit',
              style: ThemeTextStyles.bodyMedium.copyWith(
                color: Colors.white,
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
        ],
      ),
      body: SingleChildScrollView(
        child: Column(
          children: [
            _buildHeaderSection(),
            _buildFormSection(),
          ],
        ),
      ),
    );
  }

  Widget _buildHeaderSection() {
    return Container(
      width: double.infinity,
      height: 200,
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [
            Colors.green.shade400,
            Colors.green.shade600,
          ],
        ),
      ),
      child: Stack(
        children: [
          Positioned(
            top: 50,
            left: 0,
            right: 0,
            child: Column(
              children: [
                CircleAvatar(
                  radius: 50,
                  backgroundColor: Colors.white.withOpacity(0.2),
                  child: Icon(
                    Icons.person,
                    size: 50,
                    color: Colors.white,
                  ),
                ),
                SizedBox(height: ThemeDimensions.spacingMedium),
                Text(
                  'Personal Information',
                  style: ThemeTextStyles.title2.copyWith(
                    color: Colors.white,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFormSection() {
    return Container(
      margin: EdgeInsets.all(ThemeDimensions.defaultPadding),
      padding: EdgeInsets.all(ThemeDimensions.defaultPadding),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(ThemeDimensions.borderRadiusMedium),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.1),
            blurRadius: 10,
            offset: Offset(0, 2),
          ),
        ],
      ),
      child: Form(
        key: _formKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _buildInfoField('昵称', _nicknameController, Icons.person_outline),
            _buildInfoField('个性签名', _signatureController, Icons.edit),
            _buildGenderField(),
            _buildInfoField('手机号', _phoneController, Icons.phone),
            _buildInfoField('出生日期', _birthdayController, Icons.cake),
            _buildInfoField('居住地址', _addressController, Icons.location_on),
            _buildInfoField('邮箱', _emailController, Icons.email),
            _buildInfoField('身份证号码', _idController, Icons.credit_card),
          ],
        ),
      ),
    );
  }

  Widget _buildInfoField(String label, TextEditingController controller, IconData icon) {
    return Padding(
      padding: EdgeInsets.only(bottom: ThemeDimensions.spacingMedium),
      child: TextFormField(
        controller: controller,
        enabled: _isEditing,
        decoration: InputDecoration(
          labelText: label,
          prefixIcon: Icon(icon, color: ThemeColors.primary),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(ThemeDimensions.borderRadiusMedium),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(ThemeDimensions.borderRadiusMedium),
            borderSide: BorderSide(color: ThemeColors.primary, width: 2),
          ),
          filled: !_isEditing,
          fillColor: _isEditing ? null : Colors.grey.shade100,
        ),
        validator: (value) {
          if (value == null || value.isEmpty) {
            return 'Please enter $label';
          }
          return null;
        },
      ),
    );
  }

  Widget _buildGenderField() {
    return Padding(
      padding: EdgeInsets.only(bottom: ThemeDimensions.spacingMedium),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            '性别',
            style: ThemeTextStyles.bodyMedium.copyWith(
              color: ThemeColors.textSecondary,
            ),
          ),
          SizedBox(height: ThemeDimensions.spacingSmall),
          Row(
            children: [
              Expanded(
                child: RadioListTile<String>(
                  title: Text('男'),
                  value: '男',
                  groupValue: _selectedGender,
                  onChanged: _isEditing ? (value) {
                    setState(() {
                      _selectedGender = value!;
                    });
                  } : null,
                ),
              ),
              Expanded(
                child: RadioListTile<String>(
                  title: Text('女'),
                  value: '女',
                  groupValue: _selectedGender,
                  onChanged: _isEditing ? (value) {
                    setState(() {
                      _selectedGender = value!;
                    });
                  } : null,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  void _toggleEdit() {
    setState(() {
      _isEditing = !_isEditing;
    });

    if (!_isEditing) {
      // Save changes
      if (_formKey.currentState!.validate()) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Personal information updated successfully!')),
        );
      }
    }
  }
}
