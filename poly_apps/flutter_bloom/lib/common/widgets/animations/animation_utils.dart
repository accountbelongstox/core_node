/// Animation utilities and reusable animated widgets
library;

import 'package:flutter/material.dart';
import '../../theme/app_theme.dart';

/// Utility class for common animations
class AnimationUtils {
  /// Fade in animation with optional slide
  static Widget fadeInWithSlide(
    Widget child, {
    Duration duration = ComponentStyles.normalDuration,
    Offset begin = const Offset(0, 0.3),
    Curve curve = ComponentStyles.primaryCurve,
  }) {
    return TweenAnimationBuilder<double>(
      duration: duration,
      tween: Tween(begin: 0.0, end: 1.0),
      curve: curve,
      builder: (context, value, child) {
        return Opacity(
          opacity: value,
          child: Transform.translate(
            offset: begin * (1 - value),
            child: child,
          ),
        );
      },
      child: child,
    );
  }

  /// Scale animation on tap
  static Widget scaleOnTap({
    required Widget child,
    required VoidCallback onTap,
    double scale = 0.95,
    Duration duration = ComponentStyles.fastDuration,
  }) {
    return GestureDetector(
      onTapDown: (_) => _animateScale(child, scale, duration),
      onTapUp: (_) => _animateScale(child, 1.0, duration),
      onTapCancel: () => _animateScale(child, 1.0, duration),
      onTap: onTap,
      child: AnimatedScale(
        scale: 1.0,
        duration: duration,
        curve: ComponentStyles.secondaryCurve,
        child: child,
      ),
    );
  }

  /// Shimmer loading effect
  static Widget shimmer({
    required Widget child,
    Color? baseColor,
    Color? highlightColor,
    Duration duration = const Duration(milliseconds: 1500),
  }) {
    return _Shimmer(
      baseColor: baseColor ?? Colors.grey.shade300,
      highlightColor: highlightColor ?? Colors.grey.shade100,
      duration: duration,
      child: child,
    );
  }

  /// Staggered animation for list items
  static Widget staggeredAnimation({
    required Widget child,
    required int index,
    Duration staggerDelay = const Duration(milliseconds: 100),
    Duration duration = ComponentStyles.normalDuration,
  }) {
    return TweenAnimationBuilder<double>(
      duration: duration,
      tween: Tween(begin: 0.0, end: 1.0),
      curve: ComponentStyles.primaryCurve,
      builder: (context, value, child) {
        final delay = staggerDelay * index;
        return FutureBuilder(
          future: Future.delayed(delay),
          builder: (context, snapshot) {
            if (snapshot.connectionState == ConnectionState.done) {
              return Opacity(
                opacity: value,
                child: Transform.translate(
                  offset: Offset(0, 20 * (1 - value)),
                  child: child,
                ),
              );
            }
            return const SizedBox.shrink();
          },
        );
      },
      child: child,
    );
  }

  /// Pulse animation for highlighting
  static Widget pulse({
    required Widget child,
    Duration duration = const Duration(milliseconds: 1000),
    double minScale = 0.95,
    double maxScale = 1.05,
  }) {
    return TweenAnimationBuilder<double>(
      duration: duration,
      tween: Tween(begin: minScale, end: maxScale),
      builder: (context, value, child) {
        return Transform.scale(
          scale: value,
          child: child,
        );
      },
      child: child,
    );
  }

  /// Slide in from different directions
  static Widget slideInFrom({
    required Widget child,
    required SlideDirection direction,
    Duration duration = ComponentStyles.normalDuration,
    double distance = 100.0,
  }) {
    Offset begin;
    switch (direction) {
      case SlideDirection.left:
        begin = Offset(-distance, 0);
        break;
      case SlideDirection.right:
        begin = Offset(distance, 0);
        break;
      case SlideDirection.top:
        begin = Offset(0, -distance);
        break;
      case SlideDirection.bottom:
        begin = Offset(0, distance);
        break;
    }

    return TweenAnimationBuilder<Offset>(
      duration: duration,
      tween: Tween(begin: begin, end: Offset.zero),
      curve: ComponentStyles.primaryCurve,
      builder: (context, value, child) {
        return Transform.translate(
          offset: value,
          child: child,
        );
      },
      child: child,
    );
  }

  static void _animateScale(Widget child, double scale, Duration duration) {
    // This would need to be implemented with proper state management
    // For now, it's a placeholder for the concept
  }
}

/// Directions for slide animations
enum SlideDirection { left, right, top, bottom }

/// Shimmer effect implementation
class _Shimmer extends StatefulWidget {
  final Widget child;
  final Color baseColor;
  final Color highlightColor;
  final Duration duration;

  const _Shimmer({
    required this.child,
    required this.baseColor,
    required this.highlightColor,
    required this.duration,
  });

  @override
  State<_Shimmer> createState() => _ShimmerState();
}

class _ShimmerState extends State<_Shimmer>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _animation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      duration: widget.duration,
      vsync: this,
    );
    _animation = Tween<double>(
      begin: -2.0,
      end: 2.0,
    ).animate(CurvedAnimation(
      parent: _controller,
      curve: Curves.easeInOut,
    ));
    _controller.repeat();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _animation,
      builder: (context, child) {
        return ShaderMask(
          shaderCallback: (bounds) {
            return LinearGradient(
              begin: Alignment(-1.0 + _animation.value, 0.0),
              end: Alignment(1.0 + _animation.value, 0.0),
              colors: [
                widget.baseColor,
                widget.highlightColor,
                widget.baseColor,
              ],
              stops: const [0.0, 0.5, 1.0],
            ).createShader(bounds);
          },
          child: widget.child,
        );
      },
    );
  }
}

/// Bouncing button with enhanced animations
class BouncingButton extends StatefulWidget {
  final Widget child;
  final VoidCallback? onPressed;
  final Duration? duration;
  final double? scale;

  const BouncingButton({
    super.key,
    required this.child,
    this.onPressed,
    this.duration,
    this.scale,
  });

  @override
  State<BouncingButton> createState() => _BouncingButtonState();
}

class _BouncingButtonState extends State<BouncingButton>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _scaleAnimation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      duration: widget.duration ?? ComponentStyles.fastDuration,
      vsync: this,
    );
    _scaleAnimation = Tween<double>(
      begin: 1.0,
      end: widget.scale ?? 0.9,
    ).animate(CurvedAnimation(
      parent: _controller,
      curve: ComponentStyles.primaryCurve,
    ));
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _onTapDown(TapDownDetails details) {
    _controller.forward();
  }

  void _onTapUp(TapUpDetails details) {
    _controller.reverse();
    widget.onPressed?.call();
  }

  void _onTapCancel() {
    _controller.reverse();
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTapDown: _onTapDown,
      onTapUp: _onTapUp,
      onTapCancel: _onTapCancel,
      child: AnimatedBuilder(
        animation: _scaleAnimation,
        builder: (context, child) {
          return Transform.scale(
            scale: _scaleAnimation.value,
            child: widget.child,
          );
        },
      ),
    );
  }
}

/// Animated container with color transitions
class AnimatedColorContainer extends StatefulWidget {
  final Widget child;
  final Color? color;
  final Decoration? decoration;
  final Duration? duration;
  final Curve? curve;
  final double? width;
  final double? height;
  final EdgeInsetsGeometry? margin;
  final EdgeInsetsGeometry? padding;

  const AnimatedColorContainer({
    super.key,
    required this.child,
    this.color,
    this.decoration,
    this.duration,
    this.curve,
    this.width,
    this.height,
    this.margin,
    this.padding,
  });

  @override
  State<AnimatedColorContainer> createState() => _AnimatedColorContainerState();
}

class _AnimatedColorContainerState extends State<AnimatedColorContainer> {
  Color _currentColor = Colors.transparent;
  Decoration? _currentDecoration;

  @override
  void initState() {
    super.initState();
    _currentColor = widget.color ?? Colors.transparent;
    _currentDecoration = widget.decoration;
  }

  @override
  void didUpdateWidget(AnimatedColorContainer oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.color != oldWidget.color) {
      setState(() {
        _currentColor = widget.color ?? Colors.transparent;
      });
    }
    if (widget.decoration != oldWidget.decoration) {
      setState(() {
        _currentDecoration = widget.decoration;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedContainer(
      duration: widget.duration ?? ComponentStyles.normalDuration,
      curve: widget.curve ?? ComponentStyles.primaryCurve,
      width: widget.width,
      height: widget.height,
      margin: widget.margin,
      padding: widget.padding,
      decoration: _currentDecoration ??
          BoxDecoration(
            color: _currentColor,
            borderRadius: BorderRadius.circular(ComponentStyles.radiusMedium),
          ),
      child: widget.child,
    );
  }
}