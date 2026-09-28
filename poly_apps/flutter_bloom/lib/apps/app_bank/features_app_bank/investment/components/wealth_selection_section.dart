import 'package:flutter/material.dart';
import 'package:qyflutter/apps/app_bank/config_app_bank/constants.dart';
import '../../../widgets_app_bank/bank_loading_dialog.dart';
import 'product_card.dart';

class WealthSelectionSection extends StatelessWidget {
  final TabController tabController;
  final List<List<ProductCardData>> tabProducts;

  const WealthSelectionSection({
    super.key,
    required this.tabController,
    required this.tabProducts,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.all(16),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(BankConstants.borderRadius),
        border: Border.all(
          color: Colors.white.withOpacity(0.8),
          width: 1.5,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.white.withOpacity(0.9),
            spreadRadius: 2.0,
            blurRadius: 12.0,
            offset: const Offset(0, 0),
          ),
          BoxShadow(
            color: Colors.black.withOpacity(0.04),
            spreadRadius: 0,
            blurRadius: 8.0,
            offset: const Offset(0, 6),
          ),
          BoxShadow(
            color: Colors.black.withOpacity(0.02),
            spreadRadius: 0,
            blurRadius: 4.0,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Padding(
            padding: const EdgeInsets.only(left: 4, bottom: 12),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  '财富优选',
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w900,
                    color: Colors.black,
                  ),
                ),
                GestureDetector(
                  onTap: () {
                    BankLoadingDialog.show(context, title: '我的关注');
                  },
                  child: const Row(
                    children: [
                      Icon(
                        Icons.favorite_border,
                        size: 16,
                        color: Colors.grey,
                      ),
                      SizedBox(width: 4),
                      Text(
                        '我的关注',
                        style: TextStyle(
                          fontSize: 14,
                          color: Colors.grey,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          TabBar(
            controller: tabController,
            isScrollable: true,
            labelColor: Colors.black,
            unselectedLabelColor: Colors.grey,
            indicatorColor: Colors.transparent,
            dividerColor: Colors.transparent,
            indicator: const BoxDecoration(),
            indicatorSize: TabBarIndicatorSize.tab,
            labelStyle: const TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w600,
            ),
            unselectedLabelStyle: const TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.normal,
            ),
            tabs: const [
              Tab(text: '多享系列'),
              Tab(text: '零钱管理'),
              Tab(text: '稳健投资'),
              Tab(text: '追求回报'),
              Tab(text: '保险'),
            ],
          ),
          Transform.translate(
            offset: const Offset(0, -20),
            child: SizedBox(
              height: 280,
              child: TabBarView(
                controller: tabController,
                children: tabProducts.map((products) {
                  return ProductCardsGrid(products: products);
                }).toList(),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
