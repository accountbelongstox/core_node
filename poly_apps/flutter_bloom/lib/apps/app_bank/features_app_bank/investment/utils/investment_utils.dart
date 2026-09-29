import 'package:flutter/material.dart';

class InvestmentUtils {
  static IconData getInvestmentIcon(String symbol) {
    switch (symbol) {
      case 'TGF':
        return Icons.computer;
      case 'SPY':
        return Icons.trending_up;
      case 'BIF':
        return Icons.account_balance;
      case 'EM':
        return Icons.public;
      case 'GOLD':
        return Icons.star;
      default:
        return Icons.pie_chart;
    }
  }

  static Color getRiskLevelColor(String riskLevel) {
    switch (riskLevel.toLowerCase()) {
      case 'low':
        return Colors.green;
      case 'medium':
        return Colors.orange;
      case 'high':
        return Colors.red;
      default:
        return Colors.grey;
    }
  }
}
