import 'package:flutter/material.dart';

class InvestmentHolding {
  final String name;
  final String symbol;
  final double currentValue;
  final double investedAmount;
  final double change;
  final double changePercent;
  final Color color;

  InvestmentHolding({
    required this.name,
    required this.symbol,
    required this.currentValue,
    required this.investedAmount,
    required this.change,
    required this.changePercent,
    required this.color,
  });
}
