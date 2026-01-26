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
import '../../../resources_app_bank/assets_images_app_bank.dart';

class UserInfoSection extends StatelessWidget {
  final String? savedPhone;

  const UserInfoSection({
    super.key,
    this.savedPhone,
  });

  String _getGreeting() {
    final hour = DateTime.now().hour;
    if (hour >= 6 && hour < 12) {
      return '上午好！';
    } else if (hour >= 12 && hour < 18) {
      return '下午好！';
    } else if (hour >= 18 && hour < 22) {
      return '晚上好！';
    } else {
      return '晚上好！';
    }
  }

  String _maskPhone(String phone) {
    if (phone.length < 11) return phone;
    return '${phone.substring(0, 4)}***${phone.substring(7)}';
  }

  @override
  Widget build(BuildContext context) {
    final displayPhone = savedPhone != null && savedPhone!.isNotEmpty
        ? _maskPhone(savedPhone!)
        : null;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        Center(
          child: Container(
            width: 50,
            height: 50,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: Colors.grey[300],
            ),
            child: Center(
              child: Image.asset(
                BankImages.defaultUserAvatar,
                width: 30,
                height: 30,
                fit: BoxFit.cover,
                errorBuilder: (context, error, stackTrace) {
                  return const Icon(Icons.person, size: 24, color: Colors.grey);
                },
              ),
            ),
          ),
        ),
        const SizedBox(height: 20),
        if (displayPhone != null)
          Center(
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  displayPhone,
                  style: const TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w600,
                    color: Colors.black87,
                  ),
                ),
                const SizedBox(width: 8),
                Text(
                  _getGreeting(),
                  style: const TextStyle(
                    fontSize: 16,
                    color: Colors.black87,
                  ),
                ),
              ],
            ),
          ),
      ],
    );
  }
}
