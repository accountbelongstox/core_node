import 'package:flutter/material.dart';

class SectionGrid extends StatelessWidget {
  final int crossAxisCount;
  final List<Widget> children;
  final double childAspectRatio;
  final double mainAxisSpacing;
  final double crossAxisSpacing;

  const SectionGrid({
    super.key,
    required this.crossAxisCount,
    required this.children,
    this.childAspectRatio = 1.0,
    this.mainAxisSpacing = 8,
    this.crossAxisSpacing = 8,
  });

  @override
  Widget build(BuildContext context) {
    return GridView.count(
      crossAxisCount: crossAxisCount,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      mainAxisSpacing: mainAxisSpacing,
      crossAxisSpacing: crossAxisSpacing,
      childAspectRatio: childAspectRatio,
      children: children,
    );
  }
}
