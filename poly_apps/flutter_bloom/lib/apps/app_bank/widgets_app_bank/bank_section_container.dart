import 'package:flutter/material.dart';
import 'bank_section_header.dart';

class BankSectionContainer extends StatelessWidget {
  final String? title;
  final String? moreText;
  final VoidCallback? onMoreTap;
  final List<Widget> children;
  final EdgeInsets? margin;
  final double titleFontSize;
  final FontWeight titleFontWeight;
  final Color titleColor;

  const BankSectionContainer({
    super.key,
    this.title,
    this.moreText,
    this.onMoreTap,
    required this.children,
    this.margin,
    this.titleFontSize = 20,
    this.titleFontWeight = FontWeight.bold,
    this.titleColor = Colors.black87,
  });

  @override
  Widget build(BuildContext context) {
    final List<Widget> sectionChildren = [];

    if (title != null) {
      sectionChildren.add(
        BankSectionHeader(
          title: title!,
          moreText: moreText,
          onMoreTap: onMoreTap,
          titleFontSize: titleFontSize,
          titleFontWeight: titleFontWeight,
          titleColor: titleColor,
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
