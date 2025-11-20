// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATLY COMPLY WITH THESE RULES:
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

class WuyGradientButton extends StatefulWidget {
  final String text;
  final VoidCallback? onPressed;
  final bool isLoading;
  final double? width;
  final double height;
  final double borderRadius;
  final List<Color>? gradientColors;
  final Color? backgroundColor;
  final Color? textColor;
  final double? fontSize;
  final FontWeight? fontWeight;
  final EdgeInsets? padding;
  final IconData? icon;
  final bool enabled;

  const WuyGradientButton({
    super.key,
    required this.text,
    this.onPressed,
    this.isLoading = false,
    this.width,
    this.height = 50.0,
    this.borderRadius = 12.0,
    this.gradientColors,
    this.backgroundColor,
    this.textColor,
    this.fontSize,
    this.fontWeight,
    this.padding,
    this.icon,
    this.enabled = true,
  });

  @override
  State<WuyGradientButton> createState() => _WuyGradientButtonState();
}

class _WuyGradientButtonState extends State<WuyGradientButton>
    with SingleTickerProviderStateMixin {
  late AnimationController _animationController;
  late Animation<double> _scaleAnimation;

  @override
  void initState() {
    super.initState();
    _animationController = AnimationController(
      duration: const Duration(milliseconds: 150),
      vsync: this,
    );
    _scaleAnimation = Tween<double>(
      begin: 1.0,
      end: 0.95,
    ).animate(CurvedAnimation(
      parent: _animationController,
      curve: Curves.easeInOut,
    ));
  }

  @override
  void dispose() {
    _animationController.dispose();
    super.dispose();
  }

  void _handleTapDown(TapDownDetails details) {
    if (widget.enabled && !widget.isLoading) {
      _animationController.forward();
    }
  }

  void _handleTapUp(TapUpDetails details) {
    _animationController.reverse();
  }

  void _handleTapCancel() {
    _animationController.reverse();
  }

  @override
  Widget build(BuildContext context) {
    final isEnabled = widget.enabled && !widget.isLoading && widget.onPressed != null;
    
    // Default gradient colors based on design - blue + colorful gradient
    final defaultGradientColors = widget.gradientColors ?? (isEnabled 
        ? WuyAppThemeConfig.wuyButtonGradientEnabled.colors
        : WuyAppThemeConfig.wuyButtonGradientDisabled.colors);

    return GestureDetector(
      onTapDown: _handleTapDown,
      onTapUp: _handleTapUp,
      onTapCancel: _handleTapCancel,
      onTap: isEnabled ? widget.onPressed : null,
      child: AnimatedBuilder(
        animation: _scaleAnimation,
        builder: (context, child) {
          return Transform.scale(
            scale: _scaleAnimation.value,
            child: Container(
              width: widget.width ?? double.infinity,
              height: widget.height,
              decoration: BoxDecoration(
                gradient: isEnabled 
                    ? (widget.gradientColors != null 
                        ? LinearGradient(
                            colors: widget.gradientColors!,
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                          )
                        : WuyAppThemeConfig.wuyButtonGradientEnabled)
                    : WuyAppThemeConfig.wuyButtonGradientDisabled,
                borderRadius: BorderRadius.circular(widget.borderRadius),
                boxShadow: isEnabled ? [
                  BoxShadow(
                    color: defaultGradientColors.first.withOpacity(0.3),
                    blurRadius: 8,
                    offset: const Offset(0, 4),
                  ),
                ] : null,
              ),
              child: Material(
                color: Colors.transparent,
                child: InkWell(
                  borderRadius: BorderRadius.circular(widget.borderRadius),
                  onTap: isEnabled ? widget.onPressed : null,
                  child: Container(
                    padding: widget.padding ?? const EdgeInsets.symmetric(
                      horizontal: 24,
                      vertical: 12,
                    ),
                    child: Center(
                      child: widget.isLoading
                          ? SizedBox(
                              width: 20,
                              height: 20,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                valueColor: AlwaysStoppedAnimation<Color>(
                                  widget.textColor ?? WuyAppThemeConfig.wuyTextPrimary,
                                ),
                              ),
                            )
                          : Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                if (widget.icon != null) ...[
                                  Icon(
                                    widget.icon,
                                    color: widget.textColor ?? WuyAppThemeConfig.wuyTextPrimary,
                                    size: widget.fontSize ?? 16,
                                  ),
                                  const SizedBox(width: 8),
                                ],
                                Text(
                                  widget.text,
                                  style: ThemeTextStyles.buttonMedium.copyWith(
                                    color: widget.textColor ?? WuyAppThemeConfig.wuyTextPrimary,
                                    fontSize: widget.fontSize ?? 16,
                                    fontWeight: widget.fontWeight ?? FontWeight.w600,
                                  ),
                                ),
                              ],
                            ),
                    ),
                  ),
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}
