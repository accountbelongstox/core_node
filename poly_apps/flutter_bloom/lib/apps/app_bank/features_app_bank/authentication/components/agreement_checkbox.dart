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

class AgreementCheckbox extends StatelessWidget {
  final bool agreedToTerms;
  final ValueChanged<bool> onChanged;

  const AgreementCheckbox({
    super.key,
    required this.agreedToTerms,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        GestureDetector(
          onTap: () {
            onChanged(!agreedToTerms);
          },
          child: Container(
            width: 20,
            height: 20,
            margin: const EdgeInsets.only(top: 2, right: 8),
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: agreedToTerms ? const Color(0xFF1890FF) : Colors.transparent,
              border: Border.all(
                color: Colors.grey,
                width: 1,
              ),
            ),
            child: agreedToTerms
                ? const Icon(
                    Icons.check,
                    size: 14,
                    color: Colors.white,
                  )
                : null,
          ),
        ),
        Expanded(
          child: GestureDetector(
            onTap: () {
              onChanged(!agreedToTerms);
            },
            child: Text.rich(
              TextSpan(
                style: const TextStyle(
                  fontSize: 12,
                  color: Colors.grey,
                  height: 1.4,
                ),
                children: [
                  const TextSpan(text: '本人已认真阅读并同意'),
                  TextSpan(
                    text: '《中国建设银行股份有限公司电子银行个人客户服务协议》',
                    style: const TextStyle(
                      color: Color(0xFF1890FF),
                    ),
                  ),
                  const TextSpan(text: '、'),
                  TextSpan(
                    text: '《中国建设银行股份有限公司个人信息保护政策》',
                    style: const TextStyle(
                      color: Color(0xFF1890FF),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }
}
