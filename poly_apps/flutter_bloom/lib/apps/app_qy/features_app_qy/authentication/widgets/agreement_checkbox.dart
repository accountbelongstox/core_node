/// Agreement checkbox widget for terms and privacy
library agreement_checkbox;

import 'package:flutter/material.dart';

class AgreementCheckbox extends StatefulWidget {
  final bool value;
  final ValueChanged<bool>? onChanged;

  const AgreementCheckbox({
    super.key,
    required this.value,
    this.onChanged,
  });

  @override
  State<AgreementCheckbox> createState() => _AgreementCheckboxState();
}

class _AgreementCheckboxState extends State<AgreementCheckbox> {
  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Transform.scale(
          scale: 0.9,
          child: Checkbox(
            value: widget.value,
            onChanged: (value) => widget.onChanged?.call(value ?? false),
            materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
            activeColor: const Color(0xFF4CAF50),
          ),
        ),
        const SizedBox(width: 4),
        Expanded(
          child: RichText(
            text: TextSpan(
              style: const TextStyle(
                fontSize: 12,
                color: Colors.grey,
                height: 1.4,
              ),
              children: [
                const TextSpan(text: '我已阅读并同意'),
                WidgetSpan(
                  child: GestureDetector(
                    onTap: () {
                      // TODO: Show terms of service
                    },
                    child: const Text(
                      '《用户协议》',
                      style: TextStyle(
                        color: Color(0xFF4CAF50),
                        decoration: TextDecoration.underline,
                      ),
                    ),
                  ),
                ),
                const TextSpan(text: '和'),
                WidgetSpan(
                  child: GestureDetector(
                    onTap: () {
                      // TODO: Show privacy policy
                    },
                    child: const Text(
                      '《隐私政策》',
                      style: TextStyle(
                        color: Color(0xFF4CAF50),
                        decoration: TextDecoration.underline,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}