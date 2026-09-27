import 'package:flutter/material.dart';
import 'section_header.dart';

class SectionContainer extends StatelessWidget {
  final String? title;
  final String? moreText;
  final VoidCallback? onMoreTap;
  final List<Widget> children;
  final EdgeInsets? margin;

  const SectionContainer({
    super.key,
    this.title,
    this.moreText,
    this.onMoreTap,
    required this.children,
    this.margin,
  });

  @override
  Widget build(BuildContext context) {
    final List<Widget> sectionChildren = [];

    if (title != null) {
      sectionChildren.add(
        SectionHeader(
          title: title!,
          moreText: moreText,
          onMoreTap: onMoreTap,
        ),
      );
      sectionChildren.add(const SizedBox(height: 12));
    }

    sectionChildren.addAll(children);

    return Container(
      margin: margin ?? const EdgeInsets.fromLTRB(16, 16, 16, 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: sectionChildren,
      ),
    );
  }
}
