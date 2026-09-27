import 'package:flutter/material.dart';
import 'package:get/get.dart';

class CustomSearchInput extends StatelessWidget {
  final String search_placeholder;
  final bool isButtonRight;
  final double borderWidth;
  final Color? borderColor;
  final Color? textColor;
  final Color? backgroundColor;
  final VoidCallback? onTap;
  final ValueChanged<String>? onChanged;
  final TextEditingController? controller;
  final double? height;

  const CustomSearchInput({
    super.key,
    this.search_placeholder = 'Search',
    this.isButtonRight = true,
    this.borderWidth = 2.0,
    this.borderColor,
    this.textColor,
    this.backgroundColor,
    this.onTap,
    this.onChanged,
    this.controller,
    this.height,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final finalTextColor = textColor ?? theme.colorScheme.onSurface;
    final finalBorderColor = borderColor ?? theme.colorScheme.primary;
    final finalBackgroundColor = backgroundColor != null
        ? backgroundColor!.withOpacity(0.0)
        : Colors.transparent;

    return Container(
      height: height ?? 48,
      decoration: BoxDecoration(
        color: finalBackgroundColor,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(
          color: finalBorderColor,
          width: borderWidth,
        ),
      ),
      child: Row(
        children: [
          if (!isButtonRight) _buildSearchButton(finalBorderColor),
          Expanded(
            child: TextField(
              controller: controller,
              onChanged: onChanged,
              style: TextStyle(color: finalTextColor),
              decoration: InputDecoration(
                isDense: true,
                hintText: search_placeholder.tr,
                hintStyle: TextStyle(
                  color: finalTextColor.withOpacity(0.5),
                  fontSize: 14,
                ),
                enabledBorder: InputBorder.none,
                focusedBorder: InputBorder.none,
                border: InputBorder.none,
                contentPadding: const EdgeInsets.symmetric(
                  horizontal: 16,
                  vertical: 8,
                ),
                fillColor: Colors.transparent,
                filled: true,
              ),
            ),
          ),
          if (isButtonRight) _buildSearchButton(finalBorderColor),
        ],
      ),
    );
  }

  Widget _buildSearchButton(Color iconColor) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(24),
        child: Container(
          width: 40,
          height: 40,
          alignment: Alignment.center,
          child: Icon(
            Icons.search,
            color: iconColor,
            size: 20,
          ),
        ),
      ),
    );
  }
}
