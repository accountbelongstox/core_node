// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\\..\\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

import 'package:flutter/material.dart';

class SlideToStartButton extends StatefulWidget {
  final VoidCallback onSlideComplete;
  final String text;

  const SlideToStartButton({
    Key? key,
    required this.onSlideComplete,
    required this.text,
  }) : super(key: key);

  @override
  State<SlideToStartButton> createState() => _SlideToStartButtonState();
}

class _SlideToStartButtonState extends State<SlideToStartButton> {
  double _dragValue = 0.0;
  bool _isDragging = false;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    return LayoutBuilder(
      builder: (context, constraints) {
        final buttonWidth = constraints.maxWidth;
        final slideWidth = buttonWidth - 72; // 减去滑块宽度和边距

        return Container(
          height: 56,
          width: double.infinity,
          decoration: BoxDecoration(
            color: isDark
                ? theme.colorScheme.primaryContainer
                : theme.colorScheme.primary,
            borderRadius: BorderRadius.circular(28),
          ),
          child: Stack(
            children: [
              AnimatedContainer(
                duration: const Duration(milliseconds: 100),
                width: buttonWidth * _dragValue,
                decoration: BoxDecoration(
                  color: isDark
                      ? theme.colorScheme.secondaryContainer
                      : theme.colorScheme.secondary,
                  borderRadius: BorderRadius.circular(28),
                ),
              ),
              Center(
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(
                      widget.text,
                      style: theme.textTheme.titleMedium?.copyWith(
                        color: isDark
                            ? theme.colorScheme.onPrimaryContainer
                            : theme.colorScheme.onPrimary,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Text(
                      '>>>',
                      style: theme.textTheme.titleMedium?.copyWith(
                        color: isDark
                            ? theme.colorScheme.onPrimaryContainer
                            : theme.colorScheme.onPrimary,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
              Positioned(
                left: 4 + slideWidth * _dragValue,
                top: 4,
                child: GestureDetector(
                  onHorizontalDragStart: (_) {
                    setState(() => _isDragging = true);
                  },
                  onHorizontalDragUpdate: (details) {
                    setState(() {
                      _dragValue += details.delta.dx / slideWidth;
                      _dragValue = _dragValue.clamp(0.0, 1.0);
                    });
                  },
                  onHorizontalDragEnd: (_) {
                    setState(() => _isDragging = false);
                    if (_dragValue > 0.9) {
                      _dragValue = 1.0;
                      widget.onSlideComplete();
                    } else {
                      setState(() => _dragValue = 0.0);
                    }
                  },
                  child: Container(
                    width: 48,
                    height: 48,
                    decoration: BoxDecoration(
                      color: theme.colorScheme.surface,
                      shape: BoxShape.circle,
                      boxShadow: [
                        BoxShadow(
                          color: theme.shadowColor.withOpacity(0.1),
                          blurRadius: 8,
                          offset: const Offset(0, 2),
                        ),
                      ],
                    ),
                    child: Center(
                      child: Icon(
                        Icons.arrow_forward,
                        color: isDark
                            ? theme.colorScheme.primary
                            : theme.colorScheme.primary,
                        size: 24,
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}
