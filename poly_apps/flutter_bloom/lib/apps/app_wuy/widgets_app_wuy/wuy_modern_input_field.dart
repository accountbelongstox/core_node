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
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import '../theme_app_wuy/theme_config_app_wuy.dart';

class WuyModernInputField extends StatefulWidget {
  final String? hintText;
  final String? labelText;
  final TextEditingController? controller;
  final FocusNode? focusNode;
  final TextInputType keyboardType;
  final bool obscureText;
  final bool enabled;
  final int maxLines;
  final IconData? prefixIcon;
  final Widget? suffixIcon;
  final String? Function(String?)? validator;
  final void Function(String)? onChanged;
  final void Function(String)? onSubmitted;
  final TextInputAction? textInputAction;
  final Color? fillColor;
  final double borderRadius;
  final EdgeInsets? contentPadding;

  const WuyModernInputField({
    super.key,
    this.hintText,
    this.labelText,
    this.controller,
    this.focusNode,
    this.keyboardType = TextInputType.text,
    this.obscureText = false,
    this.enabled = true,
    this.maxLines = 1,
    this.prefixIcon,
    this.suffixIcon,
    this.validator,
    this.onChanged,
    this.onSubmitted,
    this.textInputAction,
    this.fillColor,
    this.borderRadius = 12.0,
    this.contentPadding,
  });

  @override
  State<WuyModernInputField> createState() => _WuyModernInputFieldState();
}

class _WuyModernInputFieldState extends State<WuyModernInputField>
    with SingleTickerProviderStateMixin {
  late AnimationController _animationController;
  late Animation<double> _focusAnimation;
  late FocusNode _focusNode;
  bool _isFocused = false;

  @override
  void initState() {
    super.initState();
    _focusNode = widget.focusNode ?? FocusNode();
    _animationController = AnimationController(
      duration: const Duration(milliseconds: 200),
      vsync: this,
    );
    _focusAnimation = Tween<double>(
      begin: 0.0,
      end: 1.0,
    ).animate(CurvedAnimation(
      parent: _animationController,
      curve: Curves.easeInOut,
    ));

    _focusNode.addListener(_onFocusChange);
  }

  @override
  void dispose() {
    if (widget.focusNode == null) {
      _focusNode.dispose();
    }
    _animationController.dispose();
    super.dispose();
  }

  void _onFocusChange() {
    if (!mounted) return;

    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;

      setState(() {
        _isFocused = _focusNode.hasFocus;
      });

      if (_isFocused) {
        _animationController.forward();
      } else {
        _animationController.reverse();
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final fillColor = widget.fillColor ?? (_isFocused 
        ? WuyAppThemeConfig.wuyInputFillFocused 
        : WuyAppThemeConfig.wuyInputFillDefault);
    final borderColor = _isFocused 
        ? WuyAppThemeConfig.wuyInputBorderFocused 
        : WuyAppThemeConfig.wuyInputBorderDefault;

    return AnimatedBuilder(
      animation: _focusAnimation,
      builder: (context, child) {
        return Container(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(widget.borderRadius),
            boxShadow: _isFocused ? [
              BoxShadow(
                color: WuyAppThemeConfig.wuyPrimaryColor.withOpacity(0.3),
                blurRadius: 8,
                offset: const Offset(0, 2),
              ),
            ] : null,
          ),
          child: TextFormField(
            controller: widget.controller,
            focusNode: _focusNode,
            keyboardType: widget.keyboardType,
            obscureText: widget.obscureText,
            enabled: widget.enabled,
            maxLines: widget.maxLines,
            validator: widget.validator,
            onChanged: widget.onChanged,
            onFieldSubmitted: widget.onSubmitted,
            textInputAction: widget.textInputAction,
            style: ThemeTextStyles.inputText.copyWith(
              color: WuyAppThemeConfig.wuyTextPrimary,
              fontSize: 16,
            ),
            decoration: InputDecoration(
              hintText: widget.hintText,
              labelText: widget.labelText,
              hintStyle: ThemeTextStyles.inputPlaceholder.copyWith(
                color: WuyAppThemeConfig.wuyTextHint,
                fontSize: 16,
              ),
              labelStyle: ThemeTextStyles.inputPlaceholder.copyWith(
                color: _isFocused 
                    ? WuyAppThemeConfig.wuyPrimaryColor 
                    : WuyAppThemeConfig.wuyTextSecondary,
                fontSize: 14,
              ),
              prefixIcon: widget.prefixIcon != null
                  ? Icon(
                      widget.prefixIcon,
                      color: _isFocused 
                          ? WuyAppThemeConfig.wuyPrimaryColor 
                          : WuyAppThemeConfig.wuyTextSecondary,
                      size: 20,
                    )
                  : null,
              suffixIcon: widget.suffixIcon,
              filled: true,
              fillColor: fillColor,
              contentPadding: widget.contentPadding ?? const EdgeInsets.symmetric(
                horizontal: 16,
                vertical: 16,
              ),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(widget.borderRadius),
                borderSide: BorderSide(
                  color: borderColor,
                  width: 1.5,
                ),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(widget.borderRadius),
                borderSide: BorderSide(
                  color: borderColor,
                  width: 1.5,
                ),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(widget.borderRadius),
                borderSide: BorderSide(
                  color: WuyAppThemeConfig.wuyPrimaryColor,
                  width: 2.0,
                ),
              ),
              errorBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(widget.borderRadius),
                borderSide: BorderSide(
                  color: WuyAppThemeConfig.wuyErrorColor,
                  width: 1.5,
                ),
              ),
              focusedErrorBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(widget.borderRadius),
                borderSide: BorderSide(
                  color: WuyAppThemeConfig.wuyErrorColor,
                  width: 2.0,
                ),
              ),
              disabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(widget.borderRadius),
                borderSide: BorderSide(
                  color: WuyAppThemeConfig.wuyBorder,
                  width: 1.5,
                ),
              ),
            ),
          ),
        );
      },
    );
  }
}
