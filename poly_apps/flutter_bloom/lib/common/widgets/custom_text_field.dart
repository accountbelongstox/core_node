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

import 'package:country_code_picker/country_code_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:qyflutter/common/controller/settings_controller.dart';
import 'package:qyflutter/common/widgets/country_picker.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';

class CustomTextField extends StatefulWidget {
  final String? hintText;
  final TextEditingController? controller;
  final FocusNode? focusNode;
  final FocusNode? nextFocus;
  final TextInputType inputType;
  final TextInputAction inputAction;
  final bool isPassword;
  final bool isAmount;
  final Function(String text)? onChanged;
  final bool isEnabled;
  final int maxLines;
  final TextCapitalization capitalization;
  final double borderRadius;
  final String? prefixIcon;
  final bool showBorder;
  final String? countryDialCode;
  final double prefixHeight;
  final bool showCountryCode;
  final Function(CountryCode countryCode)? onCountryChanged;

  const CustomTextField({
    super.key,
    this.hintText = 'Write something...',
    this.controller,
    this.focusNode,
    this.nextFocus,
    this.isEnabled = true,
    this.inputType = TextInputType.text,
    this.inputAction = TextInputAction.next,
    this.maxLines = 1,
    this.onChanged,
    this.prefixIcon,
    this.capitalization = TextCapitalization.none,
    this.isPassword = false,
    this.isAmount = false,
    this.borderRadius = 50,
    this.showBorder = false,
    this.prefixHeight = 50,
    this.countryDialCode,
    this.onCountryChanged,
    this.showCountryCode = true,
  });
  @override
  State<CustomTextField> createState() => _CustomTextFieldState();
}

class _CustomTextFieldState extends State<CustomTextField> {
  bool _obscureText = true;

  @override
  Widget build(BuildContext context) {
    ThemeDimensions.refresh(context);
    final settingsController = Provider.of<SettingsController>(context);
    final isLtr = settingsController.isLtr;

    return TextField(
      maxLines: widget.maxLines,
      controller: widget.controller,
      focusNode: widget.focusNode,
      style: ThemeTextStyles.textRegular.copyWith(fontSize: ThemeDimensions.fontSizeLarge),
      textInputAction: widget.inputAction,
      keyboardType: (widget.isAmount || widget.inputType == TextInputType.phone)
          ? const TextInputType.numberWithOptions(
              signed: false,
              decimal: true,
            )
          : widget.inputType,
      cursorColor: Theme.of(context).primaryColor,
      textCapitalization: widget.capitalization,
      enabled: widget.isEnabled,
      autofocus: false,
      autofillHints: widget.inputType == TextInputType.name
          ? [AutofillHints.name]
          : widget.inputType == TextInputType.emailAddress
              ? [AutofillHints.email]
              : widget.inputType == TextInputType.phone
                  ? [AutofillHints.telephoneNumber]
                  : widget.inputType == TextInputType.streetAddress
                      ? [AutofillHints.fullStreetAddress]
                      : widget.inputType == TextInputType.url
                          ? [AutofillHints.url]
                          : widget.inputType == TextInputType.visiblePassword
                              ? [AutofillHints.password]
                              : null,
      obscureText: widget.isPassword ? _obscureText : false,
      inputFormatters: widget.inputType == TextInputType.phone
          ? <TextInputFormatter>[
              FilteringTextInputFormatter.allow(RegExp(r'[0-9+]'))
            ]
          : widget.isAmount
              ? [FilteringTextInputFormatter.allow(RegExp(r'[0-9.]'))]
              : null,
      decoration: InputDecoration(
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(widget.borderRadius),
          borderSide: BorderSide(
              width: widget.showBorder ? 0.5 : 0.5,
              color: Theme.of(context).colorScheme.tertiary),
        ),
        disabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(widget.borderRadius),
          borderSide: BorderSide(
              width: widget.showBorder ? 0.5 : 0.5,
              color: Theme.of(context).hintColor),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(widget.borderRadius),
          borderSide: BorderSide(
              width: widget.showBorder ? 0.5 : 0.5,
              color: Theme.of(context).primaryColor),
        ),
        hintText: widget.hintText,
        fillColor: Theme.of(context).cardColor,
        hintStyle: ThemeTextStyles.textRegular.copyWith(
            fontSize: ThemeDimensions.fontSizeSmall,
            color: Theme.of(context).hintColor),
        filled: true,
        contentPadding: EdgeInsets.symmetric(
            horizontal: ThemeDimensions.paddingSizeExtraSmall,
            vertical: widget.isEnabled ? 0 : 13),
        prefixIcon: widget.prefixIcon != null
            ? Container(
                margin: EdgeInsets.only(
                    right: isLtr ? 10 : 0, left: isLtr ? 5 : 10),
                width: widget.prefixHeight,
                padding: const EdgeInsets.all(1),
                decoration: BoxDecoration(
                  color: Theme.of(context).primaryColor.withAlpha(102),
                  borderRadius: BorderRadius.only(
                    topRight: isLtr
                        ? const Radius.circular(0)
                        : Radius.circular(widget.borderRadius),
                    bottomRight: isLtr
                        ? const Radius.circular(0)
                        : Radius.circular(widget.borderRadius),
                    topLeft: isLtr
                        ? Radius.circular(widget.borderRadius)
                        : const Radius.circular(0),
                    bottomLeft: isLtr
                        ? Radius.circular(widget.borderRadius)
                        : const Radius.circular(0),
                  ),
                ),
                child: Center(
                    child:
                        Image.asset(widget.prefixIcon!, height: 20, width: 20)),
              )
            : SizedBox(
                width: widget.showCountryCode ? 125 : 80,
                child: Row(
                  children: [
                    Container(
                        width: 70,
                        height: 50,
                        decoration: BoxDecoration(
                          color: Theme.of(context).primaryColor.withAlpha(102),
                          borderRadius: BorderRadius.only(
                            topRight: isLtr
                                ? const Radius.circular(0)
                                : Radius.circular(widget.borderRadius),
                            bottomRight: isLtr
                                ? const Radius.circular(0)
                                : Radius.circular(widget.borderRadius),
                            topLeft: isLtr
                                ? Radius.circular(widget.borderRadius)
                                : const Radius.circular(0),
                            bottomLeft: isLtr
                                ? Radius.circular(widget.borderRadius)
                                : const Radius.circular(0),
                          ),
                        ),
                        margin: EdgeInsets.only(
                            right: isLtr ? 10 : 0, left: isLtr ? 0 : 10),
                        padding: EdgeInsets.only(
                            left: isLtr ? 15 : 0, right: isLtr ? 0 : 15),
                        child: Center(
                          child: CodePickerWidget(
                            padding: EdgeInsets.zero,
                            flagWidth: 0,
                            onChanged: widget.onCountryChanged,
                            initialSelection: widget.countryDialCode,
                            favorite: [
                              widget.countryDialCode != null
                                  ? widget.countryDialCode!
                                  : 'BD'
                            ],
                            showDropDownButton: true,
                            showCountryOnly: true,
                            showOnlyCountryWhenClosed: true,
                            showFlagDialog: true,
                            hideMainText: true,
                            showFlagMain: true,
                            dialogBackgroundColor: Theme.of(context).cardColor,
                            barrierColor:
                                MediaQuery.of(context).platformBrightness ==
                                        Brightness.dark
                                    ? Colors.black.withAlpha(102)
                                    : null,
                            textStyle: ThemeTextStyles.textRegular.copyWith(
                              fontSize: ThemeDimensions.fontSizeDefault,
                              color:
                                  Theme.of(context).textTheme.bodyLarge!.color,
                            ),
                          ),
                        )),
                    if (widget.showCountryCode)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 2.0),
                        child: Text(
                          widget.countryDialCode ?? '',
                          style: ThemeTextStyles.textRegular.copyWith(
                              fontSize: ThemeDimensions.fontSizeDefault),
                        ),
                      ),
                  ],
                ),
              ),
        suffixIcon: widget.isPassword
            ? Padding(
                padding: const EdgeInsets.only(right: 5),
                child: IconButton(
                  icon: Icon(
                    _obscureText ? Icons.visibility_off : Icons.visibility,
                    color: Theme.of(context).hintColor.withAlpha(102),
                  ),
                  onPressed: _toggle,
                ),
              )
            : null,
      ),
      onSubmitted: (text) => widget.nextFocus != null
          ? FocusScope.of(context).requestFocus(widget.nextFocus)
          : null,
      onChanged: widget.onChanged,
    );
  }

  void _toggle() {
    setState(() {
      _obscureText = !_obscureText;
    });
  }
}
