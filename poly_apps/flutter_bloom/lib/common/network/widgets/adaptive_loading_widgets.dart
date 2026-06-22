import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../ui/global_loading_system.dart';

/// Adaptive loading overlay that automatically adapts to different scenarios
class AdaptiveLoadingOverlay extends StatelessWidget {
  final Widget child;
  final bool showWhen;
  final String? message;
  final LoadingStyle? style;
  final LoadingConfig? config;

  const AdaptiveLoadingOverlay({
    super.key,
    required this.child,
    this.showWhen = false,
    this.message,
    this.style,
    this.config,
  });

  @override
  Widget build(BuildContext context) {
    return Consumer<GlobalLoadingSystem>(
      builder: (context, loadingSystem, _) {
        final isLoading = showWhen || loadingSystem.isGlobalLoading;

        return Stack(
          children: [
            child,
            if (isLoading)
              AdaptiveLoadingIndicator(
                message: message ?? loadingSystem.currentMessage,
                style: style ?? loadingSystem.currentStyle,
                config: config ?? LoadingConfig.overlay(),
              ),
          ],
        );
      },
    );
  }
}

/// Main adaptive loading indicator that chooses the best display method
class AdaptiveLoadingIndicator extends StatelessWidget {
  final String? message;
  final LoadingStyle style;
  final LoadingConfig config;
  final double? progress;

  const AdaptiveLoadingIndicator({
    super.key,
    this.message,
    this.style = LoadingStyle.circular,
    this.config = const LoadingConfig(),
    this.progress,
  });

  @override
  Widget build(BuildContext context) {
    return Consumer<GlobalLoadingSystem>(
      builder: (context, loadingSystem, _) {
        final theme = loadingSystem.theme;

        switch (style) {
          case LoadingStyle.circular:
            return _buildCircularLoading(context, theme);
          case LoadingStyle.linear:
            return _buildLinearLoading(context, theme);
          case LoadingStyle.progress:
            return _buildProgressLoading(context, theme);
          case LoadingStyle.skeleton:
            return _buildSkeletonLoading(context, theme);
          case LoadingStyle.shimmer:
            return _buildShimmerLoading(context, theme);
          case LoadingStyle.dots:
            return _buildDotsLoading(context, theme);
          case LoadingStyle.pulse:
            return _buildPulseLoading(context, theme);
          case LoadingStyle.fileOperation:
            return _buildFileOperationLoading(context, theme);
          case LoadingStyle.custom:
            return _buildCustomLoading(context, theme);
        }
      },
    );
  }

  Widget _buildCircularLoading(BuildContext context, LoadingTheme theme) {
    return Container(
      color: config.backgroundColor ?? theme.backgroundColor.withOpacity(0.8),
      child: Center(
        child: Container(
          padding: config.padding ?? const EdgeInsets.all(24),
          decoration: BoxDecoration(
            color: theme.backgroundColor,
            borderRadius: config.borderRadius ?? BorderRadius.circular(12),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(0.1),
                blurRadius: 10,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              SizedBox(
                width: theme.indicatorSize,
                height: theme.indicatorSize,
                child: CircularProgressIndicator(
                  color: config.foregroundColor ?? theme.primaryColor,
                  strokeWidth: theme.strokeWidth,
                ),
              ),
              if (config.showMessage && message != null) ...[
                const SizedBox(height: 16),
                Text(
                  message!,
                  style: theme.textStyle,
                  textAlign: TextAlign.center,
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildLinearLoading(BuildContext context, LoadingTheme theme) {
    return Positioned(
      top: 0,
      left: 0,
      right: 0,
      child: LinearProgressIndicator(
        color: config.foregroundColor ?? theme.progressColor,
        backgroundColor: theme.backgroundColor.withOpacity(0.3),
        value: progress,
      ),
    );
  }

  Widget _buildProgressLoading(BuildContext context, LoadingTheme theme) {
    final progressValue = progress ?? 0.0;
    final percentage = (progressValue * 100).round();

    return Container(
      color: config.backgroundColor ?? theme.backgroundColor.withOpacity(0.8),
      child: Center(
        child: Container(
          padding: config.padding ?? const EdgeInsets.all(24),
          decoration: BoxDecoration(
            color: theme.backgroundColor,
            borderRadius: config.borderRadius ?? BorderRadius.circular(12),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(0.1),
                blurRadius: 10,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              SizedBox(
                width: theme.indicatorSize * 2,
                height: theme.indicatorSize * 2,
                child: Stack(
                  children: [
                    CircularProgressIndicator(
                      value: progressValue,
                      color: config.foregroundColor ?? theme.progressColor,
                      strokeWidth: theme.strokeWidth,
                    ),
                    Positioned.fill(
                      child: Center(
                        child: Text(
                          '$percentage%',
                          style: theme.textStyle.copyWith(
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              if (config.showMessage && message != null) ...[
                const SizedBox(height: 16),
                Text(
                  message!,
                  style: theme.textStyle,
                  textAlign: TextAlign.center,
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildSkeletonLoading(BuildContext context, LoadingTheme theme) {
    final itemCount = config.customData?['itemCount'] ?? 5;

    return Container(
      color: config.backgroundColor ?? Colors.transparent,
      child: ListView.builder(
        itemCount: itemCount,
        padding: const EdgeInsets.all(16),
        itemBuilder: (context, index) => SkeletonItem(theme: theme),
      ),
    );
  }

  Widget _buildShimmerLoading(BuildContext context, LoadingTheme theme) {
    return ShimmerEffect(
      baseColor: theme.backgroundColor,
      highlightColor: theme.primaryColor.withOpacity(0.1),
      child: Container(
        width: double.infinity,
        height: 200,
        color: Colors.white,
      ),
    );
  }

  Widget _buildDotsLoading(BuildContext context, LoadingTheme theme) {
    return Container(
      color: config.backgroundColor ?? theme.backgroundColor.withOpacity(0.8),
      child: Center(
        child: Container(
          padding: config.padding ?? const EdgeInsets.all(24),
          decoration: BoxDecoration(
            color: theme.backgroundColor,
            borderRadius: config.borderRadius ?? BorderRadius.circular(12),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              DotsIndicator(
                color: config.foregroundColor ?? theme.primaryColor,
                size: theme.indicatorSize / 2,
              ),
              if (config.showMessage && message != null) ...[
                const SizedBox(height: 16),
                Text(
                  message!,
                  style: theme.textStyle,
                  textAlign: TextAlign.center,
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildPulseLoading(BuildContext context, LoadingTheme theme) {
    return Container(
      color: config.backgroundColor ?? theme.backgroundColor.withOpacity(0.8),
      child: Center(
        child: PulseIndicator(
          color: config.foregroundColor ?? theme.primaryColor,
          size: theme.indicatorSize,
        ),
      ),
    );
  }

  Widget _buildFileOperationLoading(BuildContext context, LoadingTheme theme) {
    return Container(
      color: config.backgroundColor ?? theme.backgroundColor.withOpacity(0.8),
      child: Center(
        child: Container(
          padding: config.padding ?? const EdgeInsets.all(24),
          decoration: BoxDecoration(
            color: theme.backgroundColor,
            borderRadius: config.borderRadius ?? BorderRadius.circular(12),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(0.1),
                blurRadius: 10,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                Icons.cloud_upload,
                size: theme.indicatorSize,
                color: config.foregroundColor ?? theme.primaryColor,
              ),
              const SizedBox(height: 16),
              SizedBox(
                width: 200,
                child: LinearProgressIndicator(
                  value: progress,
                  color: config.foregroundColor ?? theme.progressColor,
                  backgroundColor: theme.backgroundColor.withOpacity(0.3),
                ),
              ),
              if (config.showMessage && message != null) ...[
                const SizedBox(height: 16),
                Text(
                  message!,
                  style: theme.textStyle,
                  textAlign: TextAlign.center,
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildCustomLoading(BuildContext context, LoadingTheme theme) {
    // Custom loading can be implemented based on specific needs
    return _buildCircularLoading(context, theme);
  }
}

/// Contextual loading widget for specific UI components
class ContextualLoadingWidget extends StatelessWidget {
  final String context;
  final Widget child;
  final Widget? loadingWidget;
  final bool showOverlay;

  const ContextualLoadingWidget({
    super.key,
    required this.context,
    required this.child,
    this.loadingWidget,
    this.showOverlay = true,
  });

  @override
  Widget build(BuildContext context) {
    return Consumer<GlobalLoadingSystem>(
      builder: (context, loadingSystem, _) {
        final isLoading = loadingSystem.isContextLoading(this.context);
        final config = loadingSystem.getLoadingConfig(this.context);
        final progress = loadingSystem.getProgress(this.context);
        final message = loadingSystem.getStatusMessage(this.context);

        if (!isLoading) return child;

        if (showOverlay) {
          return Stack(
            children: [
              child,
              loadingWidget ??
                  AdaptiveLoadingIndicator(
                    style: LoadingStyle.circular,
                    config: config ?? LoadingConfig.overlay(),
                    progress: progress,
                    message: message,
                  ),
            ],
          );
        }

        return loadingWidget ??
            AdaptiveLoadingIndicator(
              style: LoadingStyle.circular,
              config: config ?? LoadingConfig.inline(),
              progress: progress,
              message: message,
            );
      },
    );
  }
}

/// Smart loading button that shows loading state when pressed
class SmartLoadingButton extends StatefulWidget {
  final VoidCallback? onPressed;
  final Future<void> Function()? onPressedAsync;
  final Widget child;
  final LoadingStyle loadingStyle;
  final bool disabled;
  final String? loadingMessage;

  const SmartLoadingButton({
    super.key,
    this.onPressed,
    this.onPressedAsync,
    required this.child,
    this.loadingStyle = LoadingStyle.circular,
    this.disabled = false,
    this.loadingMessage,
  });

  @override
  State<SmartLoadingButton> createState() => _SmartLoadingButtonState();
}

class _SmartLoadingButtonState extends State<SmartLoadingButton> {
  bool _isLoading = false;

  @override
  Widget build(BuildContext context) {
    return ElevatedButton(
      onPressed: widget.disabled || _isLoading ? null : _handlePress,
      child: _isLoading
          ? SizedBox(
              width: 20,
              height: 20,
              child: CircularProgressIndicator(
                strokeWidth: 2,
                color: Theme.of(context).colorScheme.onPrimary,
              ),
            )
          : widget.child,
    );
  }

  void _handlePress() async {
    if (widget.onPressedAsync != null) {
      setState(() => _isLoading = true);

      try {
        await widget.onPressedAsync!();
      } finally {
        if (mounted) {
          setState(() => _isLoading = false);
        }
      }
    } else {
      widget.onPressed?.call();
    }
  }
}

/// Skeleton loading item for lists
class SkeletonItem extends StatelessWidget {
  final LoadingTheme theme;

  const SkeletonItem({super.key, required this.theme});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      child: Row(
        children: [
          SkeletonBox(
            width: 50,
            height: 50,
            borderRadius: BorderRadius.circular(25),
            theme: theme,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SkeletonBox(
                  width: double.infinity,
                  height: 16,
                  theme: theme,
                ),
                const SizedBox(height: 8),
                SkeletonBox(
                  width: 200,
                  height: 12,
                  theme: theme,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Individual skeleton box
class SkeletonBox extends StatelessWidget {
  final double width;
  final double height;
  final BorderRadius? borderRadius;
  final LoadingTheme theme;

  const SkeletonBox({
    super.key,
    required this.width,
    required this.height,
    this.borderRadius,
    required this.theme,
  });

  @override
  Widget build(BuildContext context) {
    return ShimmerEffect(
      baseColor: theme.backgroundColor,
      highlightColor: theme.primaryColor.withOpacity(0.1),
      child: Container(
        width: width,
        height: height,
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: borderRadius ?? BorderRadius.circular(4),
        ),
      ),
    );
  }
}

/// Shimmer effect widget
class ShimmerEffect extends StatefulWidget {
  final Widget child;
  final Color baseColor;
  final Color highlightColor;
  final Duration period;

  const ShimmerEffect({
    super.key,
    required this.child,
    required this.baseColor,
    required this.highlightColor,
    this.period = const Duration(milliseconds: 1500),
  });

  @override
  State<ShimmerEffect> createState() => _ShimmerEffectState();
}

class _ShimmerEffectState extends State<ShimmerEffect>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _animation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(duration: widget.period, vsync: this);
    _animation = Tween<double>(begin: -1.0, end: 2.0).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeInOutSine),
    );
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
              begin: Alignment.centerLeft,
              end: Alignment.centerRight,
              colors: [
                widget.baseColor,
                widget.highlightColor,
                widget.baseColor,
              ],
              stops: [
                _animation.value - 0.3,
                _animation.value,
                _animation.value + 0.3,
              ],
            ).createShader(bounds);
          },
          child: widget.child,
        );
      },
    );
  }
}

/// Animated dots indicator
class DotsIndicator extends StatefulWidget {
  final Color color;
  final double size;
  final int dotCount;

  const DotsIndicator({
    super.key,
    required this.color,
    this.size = 8.0,
    this.dotCount = 3,
  });

  @override
  State<DotsIndicator> createState() => _DotsIndicatorState();
}

class _DotsIndicatorState extends State<DotsIndicator>
    with TickerProviderStateMixin {
  late List<AnimationController> _controllers;
  late List<Animation<double>> _animations;

  @override
  void initState() {
    super.initState();
    _controllers = List.generate(
      widget.dotCount,
      (index) => AnimationController(
        duration: const Duration(milliseconds: 600),
        vsync: this,
      ),
    );

    _animations = _controllers.map((controller) {
      return Tween<double>(begin: 0.4, end: 1.0).animate(
        CurvedAnimation(parent: controller, curve: Curves.easeInOut),
      );
    }).toList();

    _startAnimations();
  }

  void _startAnimations() async {
    for (int i = 0; i < _controllers.length; i++) {
      await Future.delayed(Duration(milliseconds: i * 200));
      if (mounted) {
        _controllers[i].repeat(reverse: true);
      }
    }
  }

  @override
  void dispose() {
    for (final controller in _controllers) {
      controller.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: List.generate(widget.dotCount, (index) {
        return AnimatedBuilder(
          animation: _animations[index],
          builder: (context, child) {
            return Container(
              margin: EdgeInsets.symmetric(horizontal: widget.size * 0.2),
              width: widget.size,
              height: widget.size,
              decoration: BoxDecoration(
                color: widget.color.withOpacity(_animations[index].value),
                shape: BoxShape.circle,
              ),
            );
          },
        );
      }),
    );
  }
}

/// Pulse indicator
class PulseIndicator extends StatefulWidget {
  final Color color;
  final double size;

  const PulseIndicator({
    super.key,
    required this.color,
    this.size = 40.0,
  });

  @override
  State<PulseIndicator> createState() => _PulseIndicatorState();
}

class _PulseIndicatorState extends State<PulseIndicator>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _scaleAnimation;
  late Animation<double> _opacityAnimation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      duration: const Duration(seconds: 1),
      vsync: this,
    );

    _scaleAnimation = Tween<double>(begin: 0.8, end: 1.2).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeInOut),
    );

    _opacityAnimation = Tween<double>(begin: 1.0, end: 0.3).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeInOut),
    );

    _controller.repeat(reverse: true);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, child) {
        return Transform.scale(
          scale: _scaleAnimation.value,
          child: Container(
            width: widget.size,
            height: widget.size,
            decoration: BoxDecoration(
              color: widget.color.withOpacity(_opacityAnimation.value),
              shape: BoxShape.circle,
            ),
          ),
        );
      },
    );
  }
}

/// Loading state builder for complex scenarios
class LoadingStateBuilder extends StatelessWidget {
  final String context;
  final Widget Function(BuildContext context, LoadingUIState state, dynamic data) builder;

  const LoadingStateBuilder({
    super.key,
    required this.context,
    required this.builder,
  });

  @override
  Widget build(BuildContext context) {
    return Consumer<GlobalLoadingSystem>(
      builder: (context, loadingSystem, _) {
        final state = loadingSystem.getContextualState(this.context);
        final data = {
          'progress': loadingSystem.getProgress(this.context),
          'message': loadingSystem.getStatusMessage(this.context),
          'config': loadingSystem.getLoadingConfig(this.context),
        };

        return builder(context, state, data);
      },
    );
  }
}

/// Extension for quick loading widget access
extension AdaptiveLoadingExtension on Widget {
  Widget withLoading({
    required bool showWhen,
    String? message,
    LoadingStyle style = LoadingStyle.circular,
    LoadingConfig? config,
  }) {
    return AdaptiveLoadingOverlay(
      showWhen: showWhen,
      message: message,
      style: style,
      config: config,
      child: this,
    );
  }

  Widget withContextualLoading(String context) {
    return ContextualLoadingWidget(
      context: context,
      child: this,
    );
  }
}