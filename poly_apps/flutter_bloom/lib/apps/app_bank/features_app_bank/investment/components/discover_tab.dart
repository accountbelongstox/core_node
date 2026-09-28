import 'package:flutter/material.dart';
import 'package:qyflutter/apps/app_bank/config_app_bank/constants.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import '../models/investment_product.dart';
import '../utils/investment_utils.dart';

class DiscoverTab extends StatelessWidget {
  final List<InvestmentProduct> recommendedProducts;
  final Function(InvestmentProduct) onProductTap;

  const DiscoverTab({
    super.key,
    required this.recommendedProducts,
    required this.onProductTap,
  });

  @override
  Widget build(BuildContext context) {
    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: recommendedProducts.length + 1,
      itemBuilder: (context, index) {
        if (index == 0) {
          return Container(
            margin: const EdgeInsets.only(bottom: 20),
            child: Text(
              'Recommended for You',
              style: ThemeTextStyles.headingLarge.copyWith(
                fontWeight: FontWeight.bold,
              ),
            ),
          );
        }

        final product = recommendedProducts[index - 1];
        final riskColor = InvestmentUtils.getRiskLevelColor(product.riskLevel);

        return Container(
          margin: const EdgeInsets.only(bottom: 16),
          child: Card(
            elevation: 2,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(BankConstants.borderRadius),
            ),
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Expanded(
                        child: Text(
                          product.name,
                          style: ThemeTextStyles.headingSmall.copyWith(
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: riskColor.withOpacity(0.1),
                          borderRadius:
                              BorderRadius.circular(BankConstants.borderRadius),
                        ),
                        child: Text(
                          product.riskLevel,
                          style: TextStyle(
                            color: riskColor,
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Text(
                    product.category,
                    style: ThemeTextStyles.bodySmall.copyWith(
                      color: Colors.grey[600],
                    ),
                  ),
                  const SizedBox(height: 12),
                  Text(
                    product.description,
                    style: ThemeTextStyles.bodyMedium,
                  ),
                  const SizedBox(height: 16),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Expected Return',
                            style: ThemeTextStyles.bodySmall.copyWith(
                              color: Colors.grey[600],
                            ),
                          ),
                          Text(
                            product.expectedReturn,
                            style: ThemeTextStyles.bodyLarge.copyWith(
                              color: Colors.green,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ],
                      ),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Min Investment',
                            style: ThemeTextStyles.bodySmall.copyWith(
                              color: Colors.grey[600],
                            ),
                          ),
                          Text(
                            '\$${product.minInvestment}',
                            style: ThemeTextStyles.bodyLarge.copyWith(
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ],
                      ),
                      Row(
                        children: [
                          const Icon(
                            Icons.star,
                            color: Colors.amber,
                            size: 16,
                          ),
                          const SizedBox(width: 4),
                          Text(
                            product.rating.toString(),
                            style: ThemeTextStyles.bodyMedium.copyWith(
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      onPressed: () => onProductTap(product),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF4A90E2),
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(
                          borderRadius:
                              BorderRadius.circular(BankConstants.borderRadius),
                        ),
                      ),
                      child: const Text('Learn More'),
                    ),
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }
}
