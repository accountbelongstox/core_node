import 'package:flutter/material.dart';
import 'package:qyflutter/common/theme/base/theme_colors.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';

/// Styled text field with custom design
class StyledTextField extends StatelessWidget {
  final TextEditingController? controller;
  final String? labelText;
  final String? hintText;
  final String? helperText;
  final IconData? prefixIcon;
  final Widget? suffixIcon;
  final bool obscureText;
  final TextInputType? keyboardType;
  final String? Function(String?)? validator;
  final void Function(String)? onChanged;
  final int? maxLines;
  final int? maxLength;
  final bool enabled;
  final bool readOnly;
  final VoidCallback? onTap;

  const StyledTextField({
    super.key,
    this.controller,
    this.labelText,
    this.hintText,
    this.helperText,
    this.prefixIcon,
    this.suffixIcon,
    this.obscureText = false,
    this.keyboardType,
    this.validator,
    this.onChanged,
    this.maxLines = 1,
    this.maxLength,
    this.enabled = true,
    this.readOnly = false,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return TextFormField(
      controller: controller,
      obscureText: obscureText,
      keyboardType: keyboardType,
      validator: validator,
      onChanged: onChanged,
      maxLines: maxLines,
      maxLength: maxLength,
      enabled: enabled,
      readOnly: readOnly,
      onTap: onTap,
      style: ThemeTextStyles.bodyMedium,
      decoration: InputDecoration(
        labelText: labelText,
        hintText: hintText,
        helperText: helperText,
        prefixIcon: prefixIcon != null ? Icon(prefixIcon) : null,
        suffixIcon: suffixIcon,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(ThemeDimensions.defaultRadius),
          borderSide: BorderSide(
            color: ThemeColors.neutralGrey.withOpacity(0.3),
          ),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(ThemeDimensions.defaultRadius),
          borderSide: BorderSide(
            color: ThemeColors.neutralGrey.withOpacity(0.3),
          ),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(ThemeDimensions.defaultRadius),
          borderSide: BorderSide(
            color: ThemeColors.primaryBlue,
            width: 2,
          ),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(ThemeDimensions.defaultRadius),
          borderSide: BorderSide(
            color: ThemeColors.errorRed,
            width: 2,
          ),
        ),
        focusedErrorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(ThemeDimensions.defaultRadius),
          borderSide: BorderSide(
            color: ThemeColors.errorRed,
            width: 2,
          ),
        ),
        filled: !enabled,
        fillColor: enabled ? null : ThemeColors.neutralGrey.withOpacity(0.1),
      ),
    );
  }
}

/// Search field with search icon
class SearchField extends StatelessWidget {
  final TextEditingController? controller;
  final String? hintText;
  final void Function(String)? onChanged;
  final VoidCallback? onClear;
  final bool showClearButton;

  const SearchField({
    super.key,
    this.controller,
    this.hintText,
    this.onChanged,
    this.onClear,
    this.showClearButton = true,
  });

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: controller,
      onChanged: onChanged,
      style: ThemeTextStyles.bodyMedium,
      decoration: InputDecoration(
        hintText: hintText ?? 'Search...',
        prefixIcon: Icon(
          Icons.search,
          color: ThemeColors.neutralGrey,
        ),
        suffixIcon: showClearButton && controller?.text.isNotEmpty == true
            ? IconButton(
                icon: Icon(
                  Icons.clear,
                  color: ThemeColors.neutralGrey,
                ),
                onPressed: () {
                  controller?.clear();
                  onClear?.call();
                },
              )
            : null,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(ThemeDimensions.largeRadius),
          borderSide: BorderSide.none,
        ),
        filled: true,
        fillColor: ThemeColors.neutralGrey.withOpacity(0.1),
        contentPadding: EdgeInsets.symmetric(
          horizontal: ThemeDimensions.defaultPadding,
          vertical: ThemeDimensions.smallPadding,
        ),
      ),
    );
  }
}

/// Password field with visibility toggle
class PasswordField extends StatefulWidget {
  final TextEditingController? controller;
  final String? labelText;
  final String? hintText;
  final String? Function(String?)? validator;
  final void Function(String)? onChanged;

  const PasswordField({
    super.key,
    this.controller,
    this.labelText,
    this.hintText,
    this.validator,
    this.onChanged,
  });

  @override
  State<PasswordField> createState() => _PasswordFieldState();
}

class _PasswordFieldState extends State<PasswordField> {
  bool _obscureText = true;

  @override
  Widget build(BuildContext context) {
    return StyledTextField(
      controller: widget.controller,
      labelText: widget.labelText ?? 'Password',
      hintText: widget.hintText ?? 'Enter your password',
      prefixIcon: Icons.lock_outlined,
      obscureText: _obscureText,
      validator: widget.validator,
      onChanged: widget.onChanged,
      suffixIcon: IconButton(
        icon: Icon(
          _obscureText ? Icons.visibility_off : Icons.visibility,
          color: ThemeColors.neutralGrey,
        ),
        onPressed: () {
          setState(() {
            _obscureText = !_obscureText;
          });
        },
      ),
    );
  }
}

/// Email field with validation
class EmailField extends StatelessWidget {
  final TextEditingController? controller;
  final String? labelText;
  final String? hintText;
  final void Function(String)? onChanged;

  const EmailField({
    super.key,
    this.controller,
    this.labelText,
    this.hintText,
    this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return StyledTextField(
      controller: controller,
      labelText: labelText ?? 'Email',
      hintText: hintText ?? 'Enter your email',
      prefixIcon: Icons.email_outlined,
      keyboardType: TextInputType.emailAddress,
      onChanged: onChanged,
      validator: (value) {
        if (value == null || value.isEmpty) {
          return 'Please enter your email';
        }
        if (!value.contains('@')) {
          return 'Please enter a valid email';
        }
        return null;
      },
    );
  }
}

/// Phone field with validation
class PhoneField extends StatelessWidget {
  final TextEditingController? controller;
  final String? labelText;
  final String? hintText;
  final void Function(String)? onChanged;

  const PhoneField({
    super.key,
    this.controller,
    this.labelText,
    this.hintText,
    this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return StyledTextField(
      controller: controller,
      labelText: labelText ?? 'Phone',
      hintText: hintText ?? 'Enter your phone number',
      prefixIcon: Icons.phone_outlined,
      keyboardType: TextInputType.phone,
      onChanged: onChanged,
      validator: (value) {
        if (value == null || value.isEmpty) {
          return 'Please enter your phone number';
        }
        return null;
      },
    );
  }
}

/// Multi-line text area
class TextAreaField extends StatelessWidget {
  final TextEditingController? controller;
  final String? labelText;
  final String? hintText;
  final int? maxLines;
  final int? maxLength;
  final String? Function(String?)? validator;
  final void Function(String)? onChanged;

  const TextAreaField({
    super.key,
    this.controller,
    this.labelText,
    this.hintText,
    this.maxLines = 4,
    this.maxLength,
    this.validator,
    this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return StyledTextField(
      controller: controller,
      labelText: labelText,
      hintText: hintText,
      maxLines: maxLines,
      maxLength: maxLength,
      validator: validator,
      onChanged: onChanged,
    );
  }
}
