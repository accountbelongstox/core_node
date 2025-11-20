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

class SegmentedButton extends StatefulWidget {
  final String leftText;
  final String rightText;
  final Function()? onLeftTap;
  final Function()? onRightTap;
  final bool initialLeftSelected;

  const SegmentedButton({
    super.key,
    required this.leftText,
    required this.rightText,
    this.onLeftTap,
    this.onRightTap,
    this.initialLeftSelected = true,
  });

  @override
  State<SegmentedButton> createState() => _SegmentedButtonState();
}

class _SegmentedButtonState extends State<SegmentedButton> {
  late bool _isLeftSelected;

  @override
  void initState() {
    super.initState();
    _isLeftSelected = widget.initialLeftSelected;
  }

  void _onTapLeft() {
    if (!_isLeftSelected) {
      setState(() => _isLeftSelected = true);
      widget.onLeftTap?.call();
    } else {
      widget.onLeftTap?.call();
    }
  }

  void _onTapRight() {
    if (_isLeftSelected) {
      setState(() => _isLeftSelected = false);
      widget.onRightTap?.call();
    } else {
      widget.onRightTap?.call();
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Container(
      height: 48,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(24),
        color: Colors.transparent,
      ),
      child: Stack(
        children: [
          // 底层按钮
          Row(
            children: [
              Expanded(
                child: Container(
                  margin: const EdgeInsets.all(2),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(22),
                    color: !_isLeftSelected
                        ? theme.colorScheme.primary.withOpacity(0.1)
                        : Colors.transparent,
                  ),
                  child: _buildButton(
                    text: widget.leftText,
                    isSelected: _isLeftSelected,
                    onTap: _onTapLeft,
                    theme: theme,
                  ),
                ),
              ),
              Expanded(
                child: Container(
                  margin: const EdgeInsets.all(2),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(22),
                    color: !_isLeftSelected
                        ? Colors.transparent
                        : theme.colorScheme.primary.withOpacity(0.1),
                  ),
                  child: _buildButton(
                    text: widget.rightText,
                    isSelected: !_isLeftSelected,
                    onTap: _onTapRight,
                    theme: theme,
                  ),
                ),
              ),
            ],
          ),
          // 选中的按钮
          AnimatedPositioned(
            duration: const Duration(milliseconds: 200),
            left: _isLeftSelected ? 2 : null,
            right: !_isLeftSelected ? 2 : null,
            top: 2,
            bottom: 2,
            width: (MediaQuery.of(context).size.width - 40) / 2 - 4,
            child: Container(
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(22),
                color: theme.colorScheme.primary,
              ),
              child: Center(
                child: Text(
                  _isLeftSelected ? widget.leftText : widget.rightText,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildButton({
    required String text,
    required bool isSelected,
    required VoidCallback onTap,
    required ThemeData theme,
  }) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(22),
        child: Container(
          alignment: Alignment.center,
          child: Text(
            text,
            style: TextStyle(
              color: isSelected
                  ? Colors.transparent // 选中时文字透明，因为会被上层覆盖
                  : theme.colorScheme.onSurface.withOpacity(0.7),
              fontSize: 16,
              fontWeight: FontWeight.normal,
            ),
          ),
        ),
      ),
    );
  }
}
