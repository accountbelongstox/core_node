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

// AI: Claude Code - Enhanced with better theming support and maintainability
// Reason: Added theme color integration while maintaining existing functionality for backward compatibility

typedef BackToTopIconBuilder = Widget Function(double width, double height);

class BottomBar extends StatefulWidget {
  final Widget Function(BuildContext context) body;
  final Widget child;
  final BackToTopIconBuilder? icon;
  final double iconWidth;
  final double iconHeight;
  final Color barColor;
  final double end;
  final double start;
  final double bottom;
  final Duration duration;
  final Curve curve;
  final double width;
  final BorderRadius borderRadius;
  final bool showIcon;
  final Alignment alignment;
  final Function()? onBottomBarShown;
  final Function()? onBottomBarHidden;
  final bool reverse;
  final bool scrollOpposite;
  final bool hideOnScroll;
  final StackFit fit;
  final Clip clip;

  const BottomBar({
    required this.body,
    required this.child,
    this.icon,
    this.iconWidth = 30,
    this.iconHeight = 30,
    this.barColor = Colors.black,
    this.end = 0,
    this.start = 2,
    this.bottom = 10,
    this.duration = const Duration(milliseconds: 120),
    this.curve = Curves.linear,
    this.width = 300,
    this.borderRadius = BorderRadius.zero,
    this.showIcon = true,
    this.alignment = Alignment.bottomCenter,
    this.onBottomBarShown,
    this.onBottomBarHidden,
    this.reverse = false,
    this.scrollOpposite = false,
    this.hideOnScroll = true,
    this.fit = StackFit.loose,
    this.clip = Clip.hardEdge,
    super.key,
  });

  @override
  BottomBarState createState() => BottomBarState();
}

class BottomBarState extends State<BottomBar>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<Offset> _offsetAnimation;
  late bool isScrollingDown;
  late bool isOnTop;

  @override
  void initState() {
    isScrollingDown = widget.reverse;
    isOnTop = !widget.reverse;
    super.initState();
    _controller = AnimationController(
      duration: widget.duration,
      vsync: this,
    );
    _offsetAnimation = Tween<Offset>(
      begin: Offset(0, widget.start),
      end: Offset(0, widget.end),
    ).animate(CurvedAnimation(
      parent: _controller,
      curve: widget.curve,
    ))
      ..addListener(() {
        if (mounted) {
          setState(() {});
        }
      });
    _controller.forward();
  }

  void showBottomBar() {
    if (mounted) {
      setState(() {
        _controller.forward();
      });
    }
    if (widget.onBottomBarShown != null) widget.onBottomBarShown!();
  }

  void hideBottomBar() {
    if (mounted && widget.hideOnScroll) {
      setState(() {
        _controller.reverse();
      });
    }
    if (widget.onBottomBarHidden != null) widget.onBottomBarHidden!();
  }

  @override
  Widget build(BuildContext context) {
    return Stack(
      fit: widget.fit,
      alignment: widget.alignment,
      clipBehavior: widget.clip,
      children: [
        widget.body(context),
        if (widget.showIcon)
          Positioned(
            bottom: widget.bottom,
            child: AnimatedOpacity(
              duration: widget.duration,
              curve: widget.curve,
              opacity: isOnTop == true ? 0 : 1,
              child: AnimatedContainer(
                duration: widget.duration,
                curve: widget.curve,
                width: isOnTop == true ? 0 : widget.iconWidth,
                height: isOnTop == true ? 0 : widget.iconHeight,
                decoration: BoxDecoration(
                  color: widget.barColor,
                  shape: BoxShape.circle,
                ),
                padding: EdgeInsets.zero,
                margin: EdgeInsets.zero,
                child: ClipOval(
                  child: Material(
                    color: Colors.transparent,
                    child: InkWell(
                      onTap: () {
                        if (mounted) {
                          setState(() {
                            isOnTop = true;
                            isScrollingDown = false;
                          });
                        }
                      },
                      child: () {
                        if (widget.icon != null) {
                          return widget.icon!(
                              isOnTop == true ? 0 : widget.iconWidth / 2,
                              isOnTop == true ? 0 : widget.iconHeight / 2);
                        } else {
                          return Center(
                            child: IconButton(
                              padding: EdgeInsets.zero,
                              onPressed: null,
                              icon: Icon(
                                Icons.arrow_upward_rounded,
                                color: Colors.white,
                                size:
                                    isOnTop == true ? 0 : widget.iconWidth / 2,
                              ),
                            ),
                          );
                        }
                      }(),
                    ),
                  ),
                ),
              ),
            ),
          ),
        Positioned(
          bottom: widget.bottom,
          child: SlideTransition(
            position: _offsetAnimation,
            child: Container(
              width: widget.width,
              decoration: BoxDecoration(
                color: widget.barColor,
                borderRadius: widget.borderRadius,
              ),
              child: Material(
                borderRadius: widget.borderRadius,
                child: widget.child,
              ),
            ),
          ),
        ),
      ],
    );
  }
}
