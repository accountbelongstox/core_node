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

class WuyAddFriendScreen extends StatefulWidget {
  const WuyAddFriendScreen({super.key});

  @override
  State<WuyAddFriendScreen> createState() => _WuyAddFriendScreenState();
}

class _WuyAddFriendScreenState extends State<WuyAddFriendScreen> {
  final _formKey = GlobalKey<FormState>();
  final _nicknameController = TextEditingController();
  final _genderController = TextEditingController();
  final _ageController = TextEditingController();
  final _heightController = TextEditingController();
  final _weightController = TextEditingController();
  bool _isLoading = false;

  @override
  void dispose() {
    _nicknameController.dispose();
    _genderController.dispose();
    _ageController.dispose();
    _heightController.dispose();
    _weightController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: ThemeColors.lightBackground,
      appBar: AppBar(
        title: Text(
          'Add Friend',
          style: ThemeTextStyles.displayMedium,
        ),
        backgroundColor: ThemeColors.primary,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Colors.white),
          onPressed: () => context.go(WuyAppRouter.routeFriends),
        ),
      ),
      body: SingleChildScrollView(
        padding: EdgeInsets.all(ThemeDimensions.defaultPadding),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              _buildProfileSection(),
              SizedBox(height: ThemeDimensions.spacingLarge),
              _buildFormSection(),
              SizedBox(height: ThemeDimensions.spacingLarge),
              _buildAddButton(),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildProfileSection() {
    return Card(
      elevation: 4,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(ThemeDimensions.borderRadiusLarge),
      ),
      child: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              Colors.orange.shade400,
              Colors.red.shade400,
            ],
          ),
          borderRadius: BorderRadius.circular(ThemeDimensions.borderRadiusLarge),
        ),
        padding: EdgeInsets.all(ThemeDimensions.defaultPadding),
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
              '小飞侠',
              style: ThemeTextStyles.title2.copyWith(
                color: Colors.white,
                fontWeight: FontWeight.bold,
              ),
            ),
            Text(
              'openAI',
              style: ThemeTextStyles.bodyLarge.copyWith(
                color: Colors.white.withOpacity(0.9),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildFormSection() {
    return Card(
      elevation: 2,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(ThemeDimensions.borderRadiusMedium),
      ),
      child: Padding(
        padding: EdgeInsets.all(ThemeDimensions.defaultPadding),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Friend Information',
              style: ThemeTextStyles.title3,
            ),
            SizedBox(height: ThemeDimensions.spacingLarge),
            _buildNicknameField(),
            SizedBox(height: ThemeDimensions.spacingMedium),
            _buildGenderField(),
            SizedBox(height: ThemeDimensions.spacingMedium),
            _buildAgeField(),
            SizedBox(height: ThemeDimensions.spacingMedium),
            _buildHeightField(),
            SizedBox(height: ThemeDimensions.spacingMedium),
            _buildWeightField(),
          ],
        ),
      ),
    );
  }

  Widget _buildNicknameField() {
    return TextFormField(
      controller: _nicknameController,
      decoration: InputDecoration(
        labelText: 'Nickname',
        hintText: 'Enter friend\'s nickname',
        prefixIcon: Icon(Icons.person_outline, color: ThemeColors.primary),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(ThemeDimensions.borderRadiusMedium),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(ThemeDimensions.borderRadiusMedium),
          borderSide: BorderSide(color: ThemeColors.primary, width: 2),
        ),
      ),
      validator: (value) {
        if (value == null || value.isEmpty) {
          return 'Please enter a nickname';
        }
        return null;
      },
    );
  }

  Widget _buildGenderField() {
    return TextFormField(
      controller: _genderController,
      decoration: InputDecoration(
        labelText: 'Gender',
        hintText: 'Enter gender (Male/Female)',
        prefixIcon: Icon(Icons.wc, color: ThemeColors.primary),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(ThemeDimensions.borderRadiusMedium),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(ThemeDimensions.borderRadiusMedium),
          borderSide: BorderSide(color: ThemeColors.primary, width: 2),
        ),
      ),
      validator: (value) {
        if (value == null || value.isEmpty) {
          return 'Please enter gender';
        }
        return null;
      },
    );
  }

  Widget _buildAgeField() {
    return TextFormField(
      controller: _ageController,
      keyboardType: TextInputType.number,
      decoration: InputDecoration(
        labelText: 'Age',
        hintText: 'Enter age',
        prefixIcon: Icon(Icons.cake, color: ThemeColors.primary),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(ThemeDimensions.borderRadiusMedium),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(ThemeDimensions.borderRadiusMedium),
          borderSide: BorderSide(color: ThemeColors.primary, width: 2),
        ),
      ),
      validator: (value) {
        if (value == null || value.isEmpty) {
          return 'Please enter age';
        }
        final age = int.tryParse(value);
        if (age == null || age < 1 || age > 120) {
          return 'Please enter a valid age';
        }
        return null;
      },
    );
  }

  Widget _buildHeightField() {
    return TextFormField(
      controller: _heightController,
      keyboardType: TextInputType.number,
      decoration: InputDecoration(
        labelText: 'Height (cm)',
        hintText: 'Enter height in cm',
        prefixIcon: Icon(Icons.height, color: ThemeColors.primary),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(ThemeDimensions.borderRadiusMedium),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(ThemeDimensions.borderRadiusMedium),
          borderSide: BorderSide(color: ThemeColors.primary, width: 2),
        ),
      ),
      validator: (value) {
        if (value == null || value.isEmpty) {
          return 'Please enter height';
        }
        final height = double.tryParse(value);
        if (height == null || height < 50 || height > 250) {
          return 'Please enter a valid height';
        }
        return null;
      },
    );
  }

  Widget _buildWeightField() {
    return TextFormField(
      controller: _weightController,
      keyboardType: TextInputType.number,
      decoration: InputDecoration(
        labelText: 'Weight (kg)',
        hintText: 'Enter weight in kg',
        prefixIcon: Icon(Icons.monitor_weight, color: ThemeColors.primary),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(ThemeDimensions.borderRadiusMedium),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(ThemeDimensions.borderRadiusMedium),
          borderSide: BorderSide(color: ThemeColors.primary, width: 2),
        ),
      ),
      validator: (value) {
        if (value == null || value.isEmpty) {
          return 'Please enter weight';
        }
        final weight = double.tryParse(value);
        if (weight == null || weight < 20 || weight > 300) {
          return 'Please enter a valid weight';
        }
        return null;
      },
    );
  }

  Widget _buildAddButton() {
    return ElevatedButton(
      onPressed: _isLoading ? null : _handleAddFriend,
      style: ElevatedButton.styleFrom(
        backgroundColor: Colors.green,
        minimumSize: Size(double.infinity, 50),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(ThemeDimensions.borderRadiusMedium),
        ),
      ),
      child: _isLoading
          ? CircularProgressIndicator(
              valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
            )
          : Text(
              'Add Friend',
              style: ThemeTextStyles.buttonLarge,
            ),
    );
  }

  void _handleAddFriend() async {
    if (_formKey.currentState!.validate()) {
      setState(() {
        _isLoading = true;
      });

      // Simulate adding friend
      await Future.delayed(const Duration(seconds: 2));

      setState(() {
        _isLoading = false;
      });

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Friend added successfully!')),
        );
        context.go(WuyAppRouter.routeFriends);
      }
    }
  }
}
