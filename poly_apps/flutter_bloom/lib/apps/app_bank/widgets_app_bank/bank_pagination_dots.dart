import 'package:flutter/material.dart';

class BankPaginationDots extends StatelessWidget {
  final int currentIndex;
  final int totalCount;
  final double dotSize;
  final double spacing;

  const BankPaginationDots({
    super.key,
    this.currentIndex = 1,
    this.totalCount = 3,
    this.dotSize = 6,
    this.spacing = 4,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: List.generate(
        totalCount,
        (index) => Container(
          width: index == currentIndex ? dotSize * 1.5 : dotSize,
          height: dotSize,
          margin: EdgeInsets.only(
            right: index < totalCount - 1 ? spacing : 0,
          ),
          decoration: BoxDecoration(
            color: index == currentIndex 
                ? const Color(0xFFFF6B35)
                : Colors.grey.withOpacity(0.5),
            shape: BoxShape.circle,
          ),
        ),
      ),
    );
  }
}
