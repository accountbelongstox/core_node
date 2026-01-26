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
import 'package:provider/provider.dart';
import 'package:qyflutter/apps/app_bank/config_app_bank/constants.dart';
import '../../../providers_app_bank/bank_user_provider.dart';
import '../../../widgets_app_bank/bank_rotating_search_hint.dart';

class LifeTopHeader extends StatelessWidget {
  const LifeTopHeader({super.key});

  @override
  Widget build(BuildContext context) {
    return Consumer<BankUserProvider>(
      builder: (context, provider, child) {
        final city = provider.globalData?.city ?? provider.user?.city ?? '北京';
        return SafeArea(
          bottom: false,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: Row(
              children: [
                Row(
                  children: [
                    const Icon(Icons.location_on,
                        size: 18, color: Colors.black87),
                    const SizedBox(width: 4),
                    Text(
                      city,
                      style: const TextStyle(
                        fontSize: 14,
                        color: Colors.black87,
                      ),
                    ),
                  ],
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: BankRotatingSearchHint(
                    pageType: BankPageType.life,
                    textColor: Colors.grey,
                    fontSize: 14,
                    backgroundColor: Colors.grey[100],
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                    prefixIcon: Icon(Icons.search, color: Colors.grey[600], size: 20),
                    suffixIcon: Icon(Icons.mic, color: Colors.grey[600], size: 20),
                  ),
                ),
                const SizedBox(width: 12),
                Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.headset_mic, color: Colors.black87, size: 24),
                    const SizedBox(height: 2),
                    const Text(
                      '客服',
                      style: TextStyle(
                        fontSize: 12,
                        color: Colors.black87,
                      ),
                    ),
                  ],
                ),
                const SizedBox(width: 12),
                Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.description, color: Colors.black87, size: 24),
                    const SizedBox(height: 2),
                    const Text(
                      '订单',
                      style: TextStyle(
                        fontSize: 12,
                        color: Colors.black87,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}
