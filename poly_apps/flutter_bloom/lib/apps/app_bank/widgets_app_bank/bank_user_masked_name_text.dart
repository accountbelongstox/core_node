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

import 'package:characters/characters.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers_app_bank/bank_user_provider.dart';

class BankUserMaskedNameText extends StatelessWidget {
  final TextStyle? style;
  final String fallbackText;
  final TextOverflow overflow;
  final int? maxLines;

  const BankUserMaskedNameText({
    super.key,
    required this.fallbackText,
    this.style,
    this.overflow = TextOverflow.ellipsis,
    this.maxLines = 1,
  });

  String _maskKeepLastChar(String input) {
    final characters = input.characters;
    final length = characters.length;
    if (length <= 1) return input;
    final last = characters.last;
    return ('*' * (length - 1)) + last;
  }

  String _resolveRawName(BankUserProvider provider) {
    final fromGlobalFullName = provider.globalData?.fullName;
    final fromUserFullName = provider.user?.fullName;
    final fromUserName = provider.user?.name;
    final fromUserMaskedName = provider.user?.maskedName;

    final candidates = <String?>[
      fromGlobalFullName,
      fromUserFullName,
      fromUserName,
      fromUserMaskedName,
    ];

    for (final c in candidates) {
      final v = c?.trim();
      if (v != null && v.isNotEmpty) {
        return v;
      }
    }
    return fallbackText;
  }

  @override
  Widget build(BuildContext context) {
    return Consumer<BankUserProvider>(
      builder: (context, provider, child) {
        final raw = _resolveRawName(provider);
        final masked = _maskKeepLastChar(raw);
        return Text(
          masked,
          style: style,
          overflow: overflow,
          maxLines: maxLines,
        );
      },
    );
  }
}
