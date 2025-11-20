import 'package:flutter/material.dart';

/// Waterfall Grid Widget
/// Creates a Pinterest-style masonry/waterfall layout for dictionary cards
class WaterfallGrid extends StatelessWidget {
  final List<Widget> children;
  final int crossAxisCount;
  final double mainAxisSpacing;
  final double crossAxisSpacing;
  final EdgeInsetsGeometry? padding;

  const WaterfallGrid({
    Key? key,
    required this.children,
    this.crossAxisCount = 2,
    this.mainAxisSpacing = 16.0,
    this.crossAxisSpacing = 16.0,
    this.padding,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: padding ?? const EdgeInsets.all(16.0),
      child: LayoutBuilder(
        builder: (context, constraints) {
          // Calculate column width
          final totalHorizontalSpacing = crossAxisSpacing * (crossAxisCount - 1);
          final horizontalPadding = (padding?.horizontal ?? 0);
          final availableWidth = constraints.maxWidth - totalHorizontalSpacing - horizontalPadding;
          final columnWidth = availableWidth / crossAxisCount;

          // Create columns
          final columns = List<List<Widget>>.generate(crossAxisCount, (_) => []);
          final columnHeights = List<double>.filled(crossAxisCount, 0);

          // Distribute children across columns
          for (int i = 0; i < children.length; i++) {
            final child = children[i];

            // Find shortest column
            int shortestColumnIndex = 0;
            double shortestHeight = columnHeights[0];
            for (int j = 1; j < crossAxisCount; j++) {
              if (columnHeights[j] < shortestHeight) {
                shortestHeight = columnHeights[j];
                shortestColumnIndex = j;
              }
            }

            // Add to shortest column
            columns[shortestColumnIndex].add(child);

            // Update height (approximate - in real implementation would need to measure)
            // Assuming average card height of 300
            columnHeights[shortestColumnIndex] += 300 + mainAxisSpacing;
          }

          return Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: List.generate(crossAxisCount, (columnIndex) {
              return Expanded(
                child: Padding(
                  padding: EdgeInsets.only(
                    left: columnIndex > 0 ? crossAxisSpacing / 2 : 0,
                    right: columnIndex < crossAxisCount - 1 ? crossAxisSpacing / 2 : 0,
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: List.generate(columns[columnIndex].length, (itemIndex) {
                      return Padding(
                        padding: EdgeInsets.only(
                          bottom: itemIndex < columns[columnIndex].length - 1 ? mainAxisSpacing : 0,
                        ),
                        child: columns[columnIndex][itemIndex],
                      );
                    }),
                  ),
                ),
              );
            }),
          );
        },
      ),
    );
  }
}

/// Waterfall Grid with ListView
/// Better for scrollable content with many items
class WaterfallGridView extends StatefulWidget {
  final List<Widget> children;
  final int crossAxisCount;
  final double mainAxisSpacing;
  final double crossAxisSpacing;
  final EdgeInsetsGeometry? padding;
  final ScrollController? controller;
  final ScrollPhysics? physics;

  const WaterfallGridView({
    Key? key,
    required this.children,
    this.crossAxisCount = 2,
    this.mainAxisSpacing = 16.0,
    this.crossAxisSpacing = 16.0,
    this.padding,
    this.controller,
    this.physics,
  }) : super(key: key);

  @override
  State<WaterfallGridView> createState() => _WaterfallGridViewState();
}

class _WaterfallGridViewState extends State<WaterfallGridView> {
  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      controller: widget.controller,
      physics: widget.physics ?? const BouncingScrollPhysics(),
      child: WaterfallGrid(
        crossAxisCount: widget.crossAxisCount,
        mainAxisSpacing: widget.mainAxisSpacing,
        crossAxisSpacing: widget.crossAxisSpacing,
        padding: widget.padding,
        children: widget.children,
      ),
    );
  }
}

/// Responsive Waterfall Grid
/// Automatically adjusts column count based on screen width
class ResponsiveWaterfallGrid extends StatelessWidget {
  final List<Widget> children;
  final double mainAxisSpacing;
  final double crossAxisSpacing;
  final EdgeInsetsGeometry? padding;
  final ScrollController? controller;
  final ScrollPhysics? physics;

  // Breakpoints for responsive design
  final double smallScreenBreakpoint;
  final double mediumScreenBreakpoint;
  final double largeScreenBreakpoint;

  const ResponsiveWaterfallGrid({
    Key? key,
    required this.children,
    this.mainAxisSpacing = 16.0,
    this.crossAxisSpacing = 16.0,
    this.padding,
    this.controller,
    this.physics,
    this.smallScreenBreakpoint = 600,
    this.mediumScreenBreakpoint = 900,
    this.largeScreenBreakpoint = 1200,
  }) : super(key: key);

  int _getCrossAxisCount(double width) {
    if (width < smallScreenBreakpoint) {
      return 2; // Mobile
    } else if (width < mediumScreenBreakpoint) {
      return 3; // Tablet portrait
    } else if (width < largeScreenBreakpoint) {
      return 4; // Tablet landscape
    } else {
      return 5; // Desktop
    }
  }

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final crossAxisCount = _getCrossAxisCount(constraints.maxWidth);

        return WaterfallGridView(
          crossAxisCount: crossAxisCount,
          mainAxisSpacing: mainAxisSpacing,
          crossAxisSpacing: crossAxisSpacing,
          padding: padding,
          controller: controller,
          physics: physics,
          children: children,
        );
      },
    );
  }
}
