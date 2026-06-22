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
import '../models/investment_product.dart';
import '../components/quick_action_button.dart';
import '../components/holdings_tab.dart';
import '../components/discover_tab.dart';
import '../components/performance_tab.dart';
import '../components/detail_card.dart';
import '../dialogs/investment_dialogs.dart';

/// Enhanced Investment Screen
/// Modern investment dashboard with portfolio overview, market trends, and product recommendations
class BankInvestmentScreenEnhanced extends StatefulWidget {
  const BankInvestmentScreenEnhanced({super.key});

  @override
  State<BankInvestmentScreenEnhanced> createState() =>
      _BankInvestmentScreenEnhancedState();
}

class _BankInvestmentScreenEnhancedState
    extends State<BankInvestmentScreenEnhanced> with TickerProviderStateMixin {
  late TabController _tabController;
  final ScrollController _scrollController = ScrollController();

  final double _totalPortfolioValue = 25750.80;
  final double _todaysChange = 342.15;
  final double _todaysChangePercent = 1.35;

  final List<InvestmentHolding> _holdings = [
    InvestmentHolding(
      name: 'Tech Growth Fund',
      symbol: 'TGF',
      currentValue: 8500.00,
      investedAmount: 8000.00,
      change: 500.00,
      changePercent: 6.25,
      color: const Color(0xFF4A90E2),
    ),
    InvestmentHolding(
      name: 'S&P 500 ETF',
      symbol: 'SPY',
      currentValue: 6200.50,
      investedAmount: 6000.00,
      change: 200.50,
      changePercent: 3.34,
      color: const Color(0xFF27AE60),
    ),
    InvestmentHolding(
      name: 'Bond Index Fund',
      symbol: 'BIF',
      currentValue: 4950.30,
      investedAmount: 5000.00,
      change: -49.70,
      changePercent: -0.99,
      color: const Color(0xFFE67E22),
    ),
    InvestmentHolding(
      name: 'Emerging Markets',
      symbol: 'EM',
      currentValue: 3100.00,
      investedAmount: 3200.00,
      change: -100.00,
      changePercent: -3.13,
      color: const Color(0xFFE74C3C),
    ),
    InvestmentHolding(
      name: 'Gold ETF',
      symbol: 'GOLD',
      currentValue: 3000.00,
      investedAmount: 2800.00,
      change: 200.00,
      changePercent: 7.14,
      color: const Color(0xFFFFD700),
    ),
  ];

  final List<InvestmentProduct> _recommendedProducts = [
    InvestmentProduct(
      name: 'AI Technology Fund',
      category: 'Growth',
      riskLevel: 'High',
      expectedReturn: '12-15%',
      minInvestment: 1000,
      description:
          'Invest in the future of artificial intelligence and machine learning companies.',
      rating: 4.5,
    ),
    InvestmentProduct(
      name: 'Sustainable Energy ETF',
      category: 'ESG',
      riskLevel: 'Medium',
      expectedReturn: '8-12%',
      minInvestment: 500,
      description: 'Clean energy and sustainable technology investments.',
      rating: 4.2,
    ),
    InvestmentProduct(
      name: 'Dividend Aristocrats',
      category: 'Income',
      riskLevel: 'Low',
      expectedReturn: '4-6%',
      minInvestment: 250,
      description: 'Stable dividend-paying companies with consistent growth.',
      rating: 4.0,
    ),
  ];

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8F9FA),
      body: NestedScrollView(
        controller: _scrollController,
        headerSliverBuilder: (context, innerBoxIsScrolled) {
          return [
            SliverAppBar(
              expandedHeight: 280,
              floating: false,
              pinned: true,
              backgroundColor: const Color(0xFF4A90E2),
              flexibleSpace: FlexibleSpaceBar(
                background: Container(
                  decoration: const BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                      colors: [
                        Color(0xFF4A90E2),
                        Color(0xFF357ABD),
                      ],
                    ),
                  ),
                  child: SafeArea(
                    child: Padding(
                      padding: const EdgeInsets.all(20),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          // Header
                          Row(
                            children: [
                              IconButton(
                                onPressed: () => Navigator.of(context).pop(),
                                icon: const Icon(Icons.arrow_back,
                                    color: Colors.white),
                              ),
                              const Expanded(
                                child: Text(
                                  'Investment Portfolio',
                                  style: TextStyle(
                                    color: Colors.white,
                                    fontSize: 20,
                                    fontWeight: FontWeight.bold,
                                  ),
                                  textAlign: TextAlign.center,
                                ),
                              ),
                              IconButton(
                                onPressed: () {},
                                icon: const Icon(Icons.notifications_outlined,
                                    color: Colors.white),
                              ),
                            ],
                          ),

                          const SizedBox(height: 20),

                          // Portfolio Value
                          Center(
                            child: Column(
                              children: [
                                Text(
                                  'Total Portfolio Value',
                                  style: TextStyle(
                                    color: Colors.white.withOpacity(0.8),
                                    fontSize: 16,
                                  ),
                                ),
                                const SizedBox(height: 8),
                                Text(
                                  '\$${_totalPortfolioValue.toStringAsFixed(2)}',
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontSize: 36,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                                const SizedBox(height: 8),
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: [
                                    Icon(
                                      _todaysChange >= 0
                                          ? Icons.trending_up
                                          : Icons.trending_down,
                                      color: _todaysChange >= 0
                                          ? Colors.green
                                          : Colors.red,
                                      size: 20,
                                    ),
                                    const SizedBox(width: 4),
                                    Text(
                                      '${_todaysChange >= 0 ? '+' : ''}\$${_todaysChange.toStringAsFixed(2)} (${_todaysChangePercent.toStringAsFixed(2)}%)',
                                      style: TextStyle(
                                        color: _todaysChange >= 0
                                            ? Colors.green
                                            : Colors.red,
                                        fontSize: 16,
                                        fontWeight: FontWeight.w600,
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  'Today\'s Change',
                                  style: TextStyle(
                                    color: Colors.white.withOpacity(0.7),
                                    fontSize: 12,
                                  ),
                                ),
                              ],
                            ),
                          ),

                          const SizedBox(height: 30),

                          // Quick Actions
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                            children: [
                              QuickActionButton(
                                icon: Icons.add_circle_outline,
                                label: 'Invest',
                                onTap: () =>
                                    InvestmentDialogs.showInvestDialog(context),
                              ),
                              QuickActionButton(
                                icon: Icons.remove_circle_outline,
                                label: 'Withdraw',
                                onTap: () =>
                                    InvestmentDialogs.showWithdrawDialog(
                                        context),
                              ),
                              QuickActionButton(
                                icon: Icons.pie_chart_outline,
                                label: 'Rebalance',
                                onTap: () =>
                                    InvestmentDialogs.showRebalanceDialog(
                                        context),
                              ),
                              QuickActionButton(
                                icon: Icons.analytics_outlined,
                                label: 'Reports',
                                onTap: () {},
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ];
        },
        body: Column(
          children: [
            // Tab Bar
            Container(
              color: Colors.white,
              child: TabBar(
                controller: _tabController,
                labelColor: const Color(0xFF4A90E2),
                unselectedLabelColor: Colors.grey,
                indicatorColor: const Color(0xFF4A90E2),
                tabs: const [
                  Tab(text: 'Holdings'),
                  Tab(text: 'Discover'),
                  Tab(text: 'Performance'),
                ],
              ),
            ),

            // Tab Content
            Expanded(
              child: TabBarView(
                controller: _tabController,
                children: [
                  HoldingsTab(
                    holdings: _holdings,
                    totalPortfolioValue: _totalPortfolioValue,
                    onHoldingTap: _showHoldingDetails,
                  ),
                  DiscoverTab(
                    recommendedProducts: _recommendedProducts,
                    onProductTap: _showInvestmentDetails,
                  ),
                  const PerformanceTab(),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _showHoldingDetails(InvestmentHolding holding) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(
            top: Radius.circular(BankConstants.borderRadius)),
      ),
      builder: (context) => DraggableScrollableSheet(
        initialChildSize: 0.7,
        maxChildSize: 0.9,
        minChildSize: 0.5,
        builder: (context, scrollController) => Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                holding.name,
                style: ThemeTextStyles.headingLarge.copyWith(
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                holding.symbol,
                style: ThemeTextStyles.bodyLarge.copyWith(
                  color: Colors.grey[600],
                ),
              ),
              const SizedBox(height: 20),
              Row(
                children: [
                  Expanded(
                    child: DetailCard(
                      title: 'Current Value',
                      value: '\$${holding.currentValue.toStringAsFixed(2)}',
                      color: Colors.blue,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: DetailCard(
                      title: 'Total Return',
                      value:
                          '${holding.change >= 0 ? '+' : ''}\$${holding.change.toStringAsFixed(2)}',
                      color: holding.change >= 0 ? Colors.green : Colors.red,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 20),
              Row(
                children: [
                  Expanded(
                    child: ElevatedButton(
                      onPressed: () => Navigator.of(context).pop(),
                      child: const Text('Buy More'),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: OutlinedButton(
                      onPressed: () => Navigator.of(context).pop(),
                      child: const Text('Sell'),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _showInvestmentDetails(InvestmentProduct product) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(product.name),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Category: ${product.category}'),
            const SizedBox(height: 8),
            Text('Risk Level: ${product.riskLevel}'),
            const SizedBox(height: 8),
            Text('Expected Return: ${product.expectedReturn}'),
            const SizedBox(height: 8),
            Text('Min Investment: \$${product.minInvestment}'),
            const SizedBox(height: 12),
            Text(product.description),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Close'),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.of(context).pop();
              InvestmentDialogs.showInvestDialog(context);
            },
            child: const Text('Invest Now'),
          ),
        ],
      ),
    );
  }
}
