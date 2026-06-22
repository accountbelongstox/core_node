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

class SwipeableWidget extends StatefulWidget {
  /// The `Widget` on which we want to detect the swipe movement.
  final Widget child;

  /// The Height of the widget that will be drawn, required.
  final double height;

  /// The `VoidCallback` that will be called once a swipe with certain percentage is detected.
  final VoidCallback onSwipeCallback;

  final SwipeValueCallBack onSwipeValueCallback;

  /// The decimal percentage of swiping in order for the callbacks to get called, defaults to 0.75 (75%) of the total width of the children.
  final double swipePercentageNeeded;

  final bool isActive;

  const SwipeableWidget(
      {super.key,
        required this.child,
        required this.height,
        required this.onSwipeCallback,
        required this.onSwipeValueCallback,
        required this.isActive,
        this.swipePercentageNeeded = 0.75})
      : assert(swipePercentageNeeded <= 1.0);

  @override
  SwipeableWidgetState createState() => SwipeableWidgetState();
}

class SwipeableWidgetState extends State<SwipeableWidget>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;

  var _dxStartPosition = 0.0;
  var _dxEndsPosition = 0.0;

  @override
  void initState() {
    super.initState();

    _controller = AnimationController(
        vsync: this, duration: const Duration(milliseconds: 300))
      ..addListener(() {
        setState(() {});
      });

    _controller.value = 1.0;
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
        onPanStart: (details) {
          setState(() {
            _dxStartPosition = details.localPosition.dx;
          });
        },
        onPanUpdate: (details) {
          if (widget.isActive) {
            final widgetSize = context.size!.width;

            final minimumXToStartSwiping = widgetSize * 0.25;
            if (_dxStartPosition <= minimumXToStartSwiping) {
              setState(() {
                _dxEndsPosition = details.localPosition.dx;
              });
// 76 + 4 + 4 = 84
              final widgetSize = context.size!.width;
              final swipeValue = 40.0 / widgetSize;
              final lastSize = widgetSize;
              final val = 1 - ((details.localPosition.dx) / lastSize);
              _controller.value = val < swipeValue ? swipeValue : val;
              widget.onSwipeValueCallback(_controller.value - swipeValue);
            }
          }
        },
        onPanEnd: (details) async {
          if (widget.isActive) {
            final delta = _dxEndsPosition - _dxStartPosition;
            final widgetSize = context.size!.width;
            var deltaNeededToBeSwiped =
                widgetSize * widget.swipePercentageNeeded;
            deltaNeededToBeSwiped -= 40.0;
            final swipeValue = 40.0 / widgetSize;
            if (delta > deltaNeededToBeSwiped) {
              _controller.animateTo(swipeValue,
                  duration: const Duration(milliseconds: 300),
                  curve: Curves.fastOutSlowIn);
              widget.onSwipeCallback();
            } else {
              _controller.animateTo(1.0,
                  duration: const Duration(milliseconds: 300),
                  curve: Curves.fastOutSlowIn);
              widget.onSwipeValueCallback(1.0);
            }
          }
        },
        child: SizedBox(
          height: widget.height,
          child: Align(
            alignment: Alignment.centerRight,
            child: FractionallySizedBox(
              widthFactor: _controller.value,
              heightFactor: 1.0,
              child: widget.child,
            ),
          ),
        ));
  }
}

typedef SwipeValueCallBack = Function(double value);
