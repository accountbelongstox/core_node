library;

import 'package:flutter/material.dart';
import '../../../../../../../common/theme/app_theme.dart';
import '../../../../../../resources_app_qy/colors_app_qy.dart';
import '../../../../../../common/theme/base/theme_dimensions.dart';

class WordSearchBar extends StatelessWidget {
  final TextEditingController controller;
  final Function(String) onSearch;
  final VoidCallback onClear;

  const WordSearchBar({
    super.key,
    required this.controller,
    required this.onSearch,
    required this.onClear,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: ColorsAppQy.qyTextOnPrimary,
        borderRadius: BorderRadius.circular(ThemeDimensions.radiusL),
        boxShadow: [
          BoxShadow(
            color: ColorsAppQy.qyShadowLight,
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: TextField(
        controller: controller,
        onChanged: onSearch,
        decoration: InputDecoration(
          hintText: 'Search words...',
          prefixIcon: const Icon(Icons.search, color: AppTheme.primaryGreen),
          suffixIcon: controller.text.isNotEmpty
              ? IconButton(
                  icon: const Icon(Icons.clear, color: AppTheme.textSecondary),
                  onPressed: () {
                    controller.clear();
                    onClear();
                  },
                )
              : null,
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(ThemeDimensions.radiusL),
            borderSide: BorderSide.none,
          ),
          filled: true,
          fillColor: ColorsAppQy.qyTextOnPrimary,
        ),
      ),
    );
  }
}
