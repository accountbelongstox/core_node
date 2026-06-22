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
import '../../../widgets_app_bank/bank_simple_card.dart';
import '../../../widgets_app_bank/bank_action_button.dart';

class PaymentGovernmentSectionV08 extends StatelessWidget {
  const PaymentGovernmentSectionV08({super.key});

  static const TextStyle _titleStyle = TextStyle(
    fontSize: 18,
    fontWeight: FontWeight.w700,
    color: Colors.black87,
  );

  static const TextStyle _subtitleStyle = TextStyle(
    fontSize: 14,
    fontWeight: FontWeight.w600,
    color: Colors.black87,
  );

  static const TextStyle _descriptionStyle = TextStyle(
    fontSize: 12,
    color: Colors.grey,
  );

  static BoxDecoration get _cardDecoration => BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            Color(0xFFF8FCFF),
            Color(0xFFF9F8F4),
          ],
        ),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(
          color: Colors.white,
          width: 1,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.05),
            spreadRadius: 0,
            blurRadius: 2,
            offset: const Offset(0, 1),
          ),
        ],
      );

  static Widget _buildActionButton() {
    return SizedBox(
      width: 45,
      height: 20,
      child: Center(
        child: BankActionButton(
          text: '去查看',
          backgroundColor: const Color(0xFFF5F5F0),
          textColor: const Color(0xFFFF6B35),
          borderColor: const Color(0xFFFF6B35),
          borderWidth: 1.5,
          padding: const EdgeInsets.symmetric(horizontal: 3, vertical: 2),
          fontSize: 9,
        ),
      ),
    );
  }

  static Widget _buildServiceRow({
    required String title,
    required String description,
  }) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          child: SizedBox(
            height: 40,
            child: Stack(
              clipBehavior: Clip.none,
              children: [
                Positioned.fill(
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(minWidth: 0),
                    child: Padding(
                      padding: const EdgeInsets.only(right: 53),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        mainAxisAlignment: MainAxisAlignment.start,
                        children: [
                          Text(
                            title,
                            style: _subtitleStyle,
                          ),
                          const SizedBox(height: 2),
                          Text(
                            description,
                            style: _descriptionStyle,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
                Positioned(
                  right: 0,
                  top: 0,
                  child: _buildActionButton(),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    return RepaintBoundary(
      child: IntrinsicHeight(
        child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Expanded(
            child: Container(
              margin:
                  const EdgeInsets.only(left: 16, right: 8, top: 8, bottom: 8),
              decoration: _cardDecoration,
              child: BankSimpleCard(
                backgroundColor: Colors.transparent,
                boxShadow: [],
                padding: const EdgeInsets.all(12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.max,
                  children: [
                    const Text(
                      '生活缴费',
                      style: _titleStyle,
                    ),
                    const SizedBox(height: 6),
                    const Text(
                      '轻松缴费 悦享生活',
                      style: _subtitleStyle,
                    ),
                    const SizedBox(height: 2),
                    const Text(
                      '海量缴费等你体验',
                      style: _descriptionStyle,
                    ),
                    const Spacer(),
                    _buildActionButton(),
                  ],
                ),
              ),
            ),
          ),
          Expanded(
            child: Container(
              margin:
                  const EdgeInsets.only(left: 8, right: 16, top: 8, bottom: 8),
              decoration: _cardDecoration,
              child: BankSimpleCard(
                backgroundColor: Colors.transparent,
                boxShadow: [],
                padding: const EdgeInsets.all(12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: Colors.orange,
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: const Text(
                            'V08',
                            style: TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.bold,
                              color: Colors.white,
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        const Expanded(
                          child: Text(
                            '政务服务',
                            style: _titleStyle,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    _buildServiceRow(
                      title: '住房公积金',
                      description: '查询公积金明细',
                    ),
                    const SizedBox(height: 8),
                    _buildServiceRow(
                      title: '电子社保卡',
                      description: '社保卡的电子凭证',
                    ),
                    const SizedBox(height: 8),
                  ],
                ),
              ),
            ),
          ),
        ],
        ),
      ),
    );
  }
}
