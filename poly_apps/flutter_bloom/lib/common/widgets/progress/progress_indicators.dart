import 'package:flutter/material.dart';
import 'package:qyflutter/common/theme/base/theme_colors.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';

/// Custom linear progress indicator with label
class LabeledLinearProgress extends StatelessWidget {
  final double value;
  final String? label;
  final Color? progressColor;
  final Color? backgroundColor;
  final double? height;
  final bool showPercentage;

  const LabeledLinearProgress({
    super.key,
    required this.value,
    this.label,
    this.progressColor,
    this.backgroundColor,
    this.height,
    this.showPercentage = true,
  });

  @override
  Widget build(BuildContext context) {
    final barHeight = height ?? 8.0;
    final percentage = (value * 100).toInt();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (label != null || showPercentage)
          Padding(
            padding: EdgeInsets.only(bottom: ThemeDimensions.tinyPadding),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                if (label != null)
                  Text(
                    label!,
                    style: ThemeTextStyles.bodyMedium.copyWith(
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                if (showPercentage)
                  Text(
                    '$percentage%',
                    style: ThemeTextStyles.bodySmall.copyWith(
                      color: progressColor ?? ThemeColors.primaryBlue,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
              ],
            ),
          ),
        ClipRRect(
          borderRadius: BorderRadius.circular(barHeight / 2),
          child: LinearProgressIndicator(
            value: value,
            minHeight: barHeight,
            backgroundColor: backgroundColor ??
                ThemeColors.neutralGrey.withOpacity(0.2),
            valueColor: AlwaysStoppedAnimation<Color>(
              progressColor ?? ThemeColors.primaryBlue,
            ),
          ),
        ),
      ],
    );
  }
}

/// Gradient progress bar
class GradientProgressBar extends StatelessWidget {
  final double value;
  final List<Color>? gradientColors;
  final Color? backgroundColor;
  final double? height;
  final BorderRadius? borderRadius;

  const GradientProgressBar({
    super.key,
    required this.value,
    this.gradientColors,
    this.backgroundColor,
    this.height,
    this.borderRadius,
  });

  @override
  Widget build(BuildContext context) {
    final barHeight = height ?? 8.0;
    final colors = gradientColors ?? [
      ThemeColors.primaryBlue,
      ThemeColors.accentPurple,
    ];

    return Container(
      height: barHeight,
      decoration: BoxDecoration(
        color: backgroundColor ?? ThemeColors.neutralGrey.withOpacity(0.2),
        borderRadius: borderRadius ?? BorderRadius.circular(barHeight / 2),
      ),
      child: FractionallySizedBox(
        alignment: Alignment.centerLeft,
        widthFactor: value,
        child: Container(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              colors: colors,
              begin: Alignment.centerLeft,
              end: Alignment.centerRight,
            ),
            borderRadius: borderRadius ?? BorderRadius.circular(barHeight / 2),
          ),
        ),
      ),
    );
  }
}

/// Circular progress with percentage
class CircularProgressWithLabel extends StatelessWidget {
  final double value;
  final double? size;
  final double? strokeWidth;
  final Color? progressColor;
  final Color? backgroundColor;
  final Widget? centerWidget;
  final bool showPercentage;

  const CircularProgressWithLabel({
    super.key,
    required this.value,
    this.size,
    this.strokeWidth,
    this.progressColor,
    this.backgroundColor,
    this.centerWidget,
    this.showPercentage = true,
  });

  @override
  Widget build(BuildContext context) {
    final circleSize = size ?? 100.0;
    final lineWidth = strokeWidth ?? 8.0;
    final percentage = (value * 100).toInt();

    return SizedBox(
      width: circleSize,
      height: circleSize,
      child: Stack(
        alignment: Alignment.center,
        children: [
          SizedBox(
            width: circleSize,
            height: circleSize,
            child: CircularProgressIndicator(
              value: value,
              strokeWidth: lineWidth,
              backgroundColor: backgroundColor ??
                  ThemeColors.neutralGrey.withOpacity(0.2),
              valueColor: AlwaysStoppedAnimation<Color>(
                progressColor ?? ThemeColors.primaryBlue,
              ),
            ),
          ),
          centerWidget ??
              (showPercentage
                  ? Text(
                      '$percentage%',
                      style: ThemeTextStyles.headlineMedium.copyWith(
                        fontWeight: FontWeight.bold,
                        color: progressColor ?? ThemeColors.primaryBlue,
                      ),
                    )
                  : SizedBox.shrink()),
        ],
      ),
    );
  }
}

/// Step progress indicator
class StepProgressIndicator extends StatelessWidget {
  final int totalSteps;
  final int currentStep;
  final Color? activeColor;
  final Color? inactiveColor;
  final double? size;

  const StepProgressIndicator({
    super.key,
    required this.totalSteps,
    required this.currentStep,
    this.activeColor,
    this.inactiveColor,
    this.size,
  });

  @override
  Widget build(BuildContext context) {
    final stepSize = size ?? 32.0;
    final active = activeColor ?? ThemeColors.primaryBlue;
    final inactive = inactiveColor ?? ThemeColors.neutralGrey.withOpacity(0.3);

    return Row(
      children: List.generate(totalSteps, (index) {
        final isActive = index < currentStep;
        final isLast = index == totalSteps - 1;

        return Expanded(
          child: Row(
            children: [
              Container(
                width: stepSize,
                height: stepSize,
                decoration: BoxDecoration(
                  color: isActive ? active : inactive,
                  shape: BoxShape.circle,
                  border: Border.all(
                    color: isActive ? active : inactive,
                    width: 2,
                  ),
                ),
                child: Center(
                  child: isActive
                      ? Icon(
                          Icons.check,
                          color: ThemeColors.neutralWhite,
                          size: stepSize * 0.6,
                        )
                      : Text(
                          '${index + 1}',
                          style: ThemeTextStyles.bodySmall.copyWith(
                            color: ThemeColors.neutralGrey,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                ),
              ),
              if (!isLast)
                Expanded(
                  child: Container(
                    height: 2,
                    color: isActive ? active : inactive,
                  ),
                ),
            ],
          ),
        );
      }),
    );
  }
}

/// Shimmer loading effect
class ShimmerLoading extends StatefulWidget {
  final Widget child;
  final bool isLoading;
  final Color? baseColor;
  final Color? highlightColor;

  const ShimmerLoading({
    super.key,
    required this.child,
    this.isLoading = true,
    this.baseColor,
    this.highlightColor,
  });

  @override
  State<ShimmerLoading> createState() => _ShimmerLoadingState();
}

class _ShimmerLoadingState extends State<ShimmerLoading>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: Duration(milliseconds: 1500),
    )..repeat();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (!widget.isLoading) {
      return widget.child;
    }

    final baseColor = widget.baseColor ??
        ThemeColors.neutralGrey.withOpacity(0.3);
    final highlightColor = widget.highlightColor ??
        ThemeColors.neutralGrey.withOpacity(0.1);

    return AnimatedBuilder(
      animation: _controller,
      builder: (context, child) {
        return ShaderMask(
          shaderCallback: (bounds) {
            return LinearGradient(
              colors: [baseColor, highlightColor, baseColor],
              stops: [
                _controller.value - 0.3,
                _controller.value,
                _controller.value + 0.3,
              ],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ).createShader(bounds);
          },
          child: widget.child,
        );
      },
    );
  }
}

/// Dots loading indicator
class DotsLoadingIndicator extends StatefulWidget {
  final Color? color;
  final double? size;

  const DotsLoadingIndicator({
    super.key,
    this.color,
    this.size,
  });

  @override
  State<DotsLoadingIndicator> createState() => _DotsLoadingIndicatorState();
}

class _DotsLoadingIndicatorState extends State<DotsLoadingIndicator>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: Duration(milliseconds: 1200),
    )..repeat();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final dotColor = widget.color ?? ThemeColors.primaryBlue;
    final dotSize = widget.size ?? 10.0;

    return AnimatedBuilder(
      animation: _controller,
      builder: (context, child) {
        return Row(
          mainAxisSize: MainAxisSize.min,
          children: List.generate(3, (index) {
            final delay = index * 0.2;
            final scale = ((_controller.value - delay) % 1.0) < 0.5
                ? 1.0 + ((_controller.value - delay) % 0.5) * 2
                : 2.0 - ((_controller.value - delay) % 0.5) * 2;

            return Padding(
              padding: EdgeInsets.symmetric(
                horizontal: ThemeDimensions.tinyPadding,
              ),
              child: Transform.scale(
                scale: scale,
                child: Container(
                  width: dotSize,
                  height: dotSize,
                  decoration: BoxDecoration(
                    color: dotColor,
                    shape: BoxShape.circle,
                  ),
                ),
              ),
            );
          }),
        );
      },
    );
  }
}
