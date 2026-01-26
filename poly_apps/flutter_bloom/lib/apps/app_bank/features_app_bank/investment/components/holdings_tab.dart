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
import 'package:qyflutter/apps/app_bank/config_app_bank/constants.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import '../models/investment_holding.dart';
import '../utils/investment_utils.dart';
import 'portfolio_summary_card.dart';

class HoldingsTab extends StatelessWidget {
  final List<InvestmentHolding> holdings;
  final double totalPortfolioValue;
  final Function(InvestmentHolding) onHoldingTap;

  const HoldingsTab({
    super.key,
    required this.holdings,
    required this.totalPortfolioValue,
    required this.onHoldingTap,
  });

  @override
  Widget build(BuildContext context) {
    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: holdings.length + 1,
      itemBuilder: (context, index) {
        if (index == 0) {
          return PortfolioSummaryCard(
            holdings: holdings,
            totalPortfolioValue: totalPortfolioValue,
          );
        }

        final holding = holdings[index - 1];
        return Container(
          margin: const EdgeInsets.only(bottom: 12),
          child: Card(
            elevation: 2,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(BankConstants.borderRadius),
            ),
            child: ListTile(
              contentPadding: const EdgeInsets.all(16),
              leading: Container(
                width: 50,
                height: 50,
                decoration: BoxDecoration(
                  color: holding.color.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(BankConstants.borderRadius),
                ),
                child: Icon(
                  InvestmentUtils.getInvestmentIcon(holding.symbol),
                  color: holding.color,
                  size: 28,
                ),
              ),
              title: Text(
                holding.name,
                style: ThemeTextStyles.bodyLarge.copyWith(
                  fontWeight: FontWeight.w600,
                ),
              ),
              subtitle: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const SizedBox(height: 4),
                  Text(
                    holding.symbol,
                    style: ThemeTextStyles.bodySmall.copyWith(
                      color: Colors.grey[600],
                    ),
                  ),
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      Icon(
                        holding.change >= 0
                            ? Icons.trending_up
                            : Icons.trending_down,
                        size: 16,
                        color: holding.change >= 0 ? Colors.green : Colors.red,
                      ),
                      const SizedBox(width: 4),
                      Text(
                        '${holding.change >= 0 ? '+' : ''}\$${holding.change.toStringAsFixed(2)} (${holding.changePercent.toStringAsFixed(2)}%)',
                        style: TextStyle(
                          color: holding.change >= 0 ? Colors.green : Colors.red,
                          fontSize: 12,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
              trailing: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(
                    '\$${holding.currentValue.toStringAsFixed(2)}',
                    style: ThemeTextStyles.bodyLarge.copyWith(
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Invested: \$${holding.investedAmount.toStringAsFixed(0)}',
                    style: ThemeTextStyles.bodySmall.copyWith(
                      color: Colors.grey[600],
                    ),
                  ),
                ],
              ),
              onTap: () => onHoldingTap(holding),
            ),
          ),
        );
      },
    );
  }
}
