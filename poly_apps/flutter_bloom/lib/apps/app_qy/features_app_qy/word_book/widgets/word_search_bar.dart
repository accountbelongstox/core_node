/// Word search bar widget
library;

import 'package:flutter/material.dart';
import '../../../../../../../common/i18n/i18n_service.dart';
import '../../../../../../../common/theme/app_theme.dart';

class WordSearchBar extends StatefulWidget {
  final TextEditingController controller;
  final Function(String)? onSearch;
  final Function()? onClear;

  const WordSearchBar({
    super.key,
    required this.controller,
    this.onSearch,
    this.onClear,
  });

  @override
  State<WordSearchBar> createState() => _WordSearchBarState();
}

class _WordSearchBarState extends State<WordSearchBar> {
  bool _hasFocus = false;

  @override
  Widget build(BuildContext context) {
    return AnimatedContainer(
      duration: const Duration(milliseconds: 200),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(_hasFocus ? 16 : 25),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(_hasFocus ? 0.1 : 0.05),
            blurRadius: _hasFocus ? 15 : 10,
            offset: const Offset(0, _hasFocus ? 4 : 2),
          ),
        ],
      ),
      child: FocusScope(
        onFocusChange: (hasFocus) {
          setState(() {
            _hasFocus = hasFocus;
          });
        },
        child: TextField(
          controller: widget.controller,
          autofocus: false,
          style: const TextStyle(
            fontSize: 16,
            color: AppTheme.textPrimary,
          ),
          decoration: InputDecoration(
            hintText: 'wordBook.searchHint'.tr,
            hintStyle: TextStyle(
              color: Colors.grey[400],
              fontSize: 16,
            ),
            prefixIcon: Container(
              padding: const EdgeInsets.all(12),
              child: Icon(
                Icons.search,
                color: _hasFocus ? AppTheme.primaryGreen : Colors.grey[400],
                size: 24,
              ),
            ),
            suffixIcon: widget.controller.text.isNotEmpty
                ? IconButton(
                    icon: Icon(
                      Icons.clear,
                      color: Colors.grey[400],
                      size: 20,
                    ),
                    onPressed: () {
                      widget.controller.clear();
                      widget.onClear?.call();
                    },
                  )
                : null,
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(_hasFocus ? 16 : 25),
              borderSide: BorderSide.none,
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(25),
              borderSide: BorderSide.none,
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(16),
              borderSide: BorderSide(
                color: AppTheme.primaryGreen.withOpacity(0.3),
                width: 2,
              ),
            ),
            filled: true,
            fillColor: Colors.transparent,
            contentPadding: const EdgeInsets.symmetric(
              horizontal: 16,
              vertical: 14,
            ),
          ),
          onChanged: widget.onSearch,
        ),
      ),
    );
  }
}