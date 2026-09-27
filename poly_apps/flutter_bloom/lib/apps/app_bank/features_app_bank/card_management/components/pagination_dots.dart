import 'package:flutter/material.dart';

class PaginationDots extends StatelessWidget {
  final int currentIndex;
  final int totalCount;
  final double dotSize;
  final double spacing;

  const PaginationDots({
    super.key,
    this.currentIndex = 1,
    this.totalCount = 3,
    this.dotSize = 6,
    this.spacing = 4,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      children: List.generate(
        totalCount,
        (index) => Container(
          width: dotSize,
          height: dotSize,
          margin: EdgeInsets.only(
            right: index < totalCount - 1 ? spacing : 0,
          ),
          decoration: BoxDecoration(
            color: Colors.grey.withOpacity(
              index == currentIndex ? 0.6 : 0.3,
            ),
            shape: BoxShape.circle,
          ),
        ),
      ),
    );
  }
}
