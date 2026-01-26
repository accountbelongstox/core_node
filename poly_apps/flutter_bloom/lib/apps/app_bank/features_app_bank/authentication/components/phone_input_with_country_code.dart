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

class PhoneInputWithCountryCode extends StatefulWidget {
  final TextEditingController phoneController;
  final String countryCode;
  final ValueChanged<String> onCountryCodeChanged;
  final FormFieldValidator<String>? validator;

  const PhoneInputWithCountryCode({
    super.key,
    required this.phoneController,
    required this.countryCode,
    required this.onCountryCodeChanged,
    this.validator,
  });

  @override
  State<PhoneInputWithCountryCode> createState() =>
      _PhoneInputWithCountryCodeState();
}

class _PhoneInputWithCountryCodeState extends State<PhoneInputWithCountryCode> {
  String? _errorText;

  @override
  void initState() {
    super.initState();
    widget.phoneController.addListener(_validateInput);
  }

  @override
  void dispose() {
    widget.phoneController.removeListener(_validateInput);
    super.dispose();
  }

  void _validateInput() {
    final value = widget.phoneController.text;
    String? error;
    
    if (widget.validator != null) {
      error = widget.validator!(value);
    }
    
    if (_errorText != error) {
      setState(() {
        _errorText = error;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            GestureDetector(
              onTap: () {
                showDialog(
                  context: context,
                  builder: (context) => AlertDialog(
                    title: const Text('选择国家/地区'),
                    content: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        ListTile(
                          title: const Text('+86 中国'),
                          leading: widget.countryCode == '+86'
                              ? const Icon(Icons.check, color: Color(0xFF1890FF))
                              : const SizedBox(width: 24),
                          onTap: () {
                            widget.onCountryCodeChanged('+86');
                            Navigator.pop(context);
                          },
                        ),
                        ListTile(
                          title: const Text('+852 香港'),
                          leading: widget.countryCode == '+852'
                              ? const Icon(Icons.check, color: Color(0xFF1890FF))
                              : const SizedBox(width: 24),
                          onTap: () {
                            widget.onCountryCodeChanged('+852');
                            Navigator.pop(context);
                          },
                        ),
                        ListTile(
                          title: const Text('+853 澳门'),
                          leading: widget.countryCode == '+853'
                              ? const Icon(Icons.check, color: Color(0xFF1890FF))
                              : const SizedBox(width: 24),
                          onTap: () {
                            widget.onCountryCodeChanged('+853');
                            Navigator.pop(context);
                          },
                        ),
                      ],
                    ),
                  ),
                );
              },
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 16),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      widget.countryCode,
                      style: const TextStyle(
                        fontSize: 16,
                        color: Colors.black87,
                      ),
                    ),
                    const SizedBox(width: 4),
                    const Icon(Icons.arrow_drop_down, color: Colors.grey),
                  ],
                ),
              ),
            ),
            Expanded(
              child: TextFormField(
                controller: widget.phoneController,
                keyboardType: TextInputType.phone,
                decoration: const InputDecoration(
                  hintText: '输入手机号码',
                  border: InputBorder.none,
                  enabledBorder: InputBorder.none,
                  focusedBorder: InputBorder.none,
                  errorBorder: InputBorder.none,
                  focusedErrorBorder: InputBorder.none,
                  filled: false,
                  fillColor: Colors.transparent,
                  contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 16),
                  errorStyle: TextStyle(height: 0, fontSize: 0),
                ),
                style: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                  color: Colors.black87,
                ),
                cursorColor: Colors.black87,
                cursorRadius: const Radius.circular(1),
                validator: widget.validator,
              ),
            ),
          ],
        ),
        Container(
          height: 1,
          color: Colors.grey,
          margin: const EdgeInsets.only(top: 0),
        ),
        if (_errorText != null && _errorText!.isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(top: 4, left: 12),
            child: Text(
              _errorText!,
              style: const TextStyle(
                fontSize: 12,
                color: Colors.red,
              ),
            ),
          ),
      ],
    );
  }
}
