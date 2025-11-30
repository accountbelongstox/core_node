/// Word search bar widget
library;

import 'package:flutter/material.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:qyflutter/common/localization/localization_manager.dart';
import 'package:qyflutter/apps/app_qy/resources_app_qy/colors_app_qy.dart';
import '../../../localization_app_qy/localization_keys_app_qy.dart';

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
        gradient: ColorsAppQy.qyFrostGradient,
        borderRadius: BorderRadius.circular(
          _hasFocus ? ThemeDimensions.radiusL : ThemeDimensions.radiusXL,
        ),
        border: Border.all(
          color: ColorsAppQy.qyBorderLight,
        ),
        boxShadow: [
          BoxShadow(
            color: ColorsAppQy.qyShadowMedium,
            blurRadius: _hasFocus ? 20 : 10,
            offset: Offset(0, _hasFocus ? 6 : 3),
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
          style: ThemeTextStyles.bodyMedium.copyWith(
            color: ColorsAppQy.qyTextPrimary,
          ),
          decoration: InputDecoration(
            hintText: QyAppLocalizationKeys.qyWordBookSearchHint.tr(context),
            hintStyle: ThemeTextStyles.bodyMedium.copyWith(
              color: ColorsAppQy.qyTextSecondary.withOpacity(0.6),
            ),
            prefixIcon: Padding(
              padding: EdgeInsets.all(ThemeDimensions.spacing12),
              child: Icon(
                Icons.search,
                color: _hasFocus
                    ? ColorsAppQy.qySecondary
                    : ColorsAppQy.qyTextSecondary,
                size: ThemeDimensions.iconSizeL,
              ),
            ),
            suffixIcon: widget.controller.text.isNotEmpty
                ? IconButton(
                    icon: Icon(
                      Icons.clear,
                      color: ColorsAppQy.qyTextSecondary,
                      size: ThemeDimensions.iconSizeM,
                    ),
                    onPressed: () {
                      widget.controller.clear();
                      setState(() {});
                      widget.onClear?.call();
                    },
                  )
                : null,
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(
                _hasFocus ? ThemeDimensions.radiusL : ThemeDimensions.radiusXL,
              ),
              borderSide: BorderSide.none,
            ),
            filled: true,
            fillColor: Colors.transparent,
            contentPadding: EdgeInsets.symmetric(
              horizontal: ThemeDimensions.spacing16,
              vertical: ThemeDimensions.spacing12,
            ),
          ),
          onChanged: (value) {
            setState(() {});
            widget.onSearch?.call(value);
          },
        ),
      ),
    );
  }
}
