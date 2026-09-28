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
