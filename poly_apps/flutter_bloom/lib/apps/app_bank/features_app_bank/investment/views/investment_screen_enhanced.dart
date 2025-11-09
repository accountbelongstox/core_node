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
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';

/// Enhanced Investment Screen
/// Modern investment dashboard with portfolio overview, market trends, and product recommendations
class BankInvestmentScreenEnhanced extends StatefulWidget {
  const BankInvestmentScreenEnhanced({super.key});

  @override
  State<BankInvestmentScreenEnhanced> createState() => _BankInvestmentScreenEnhancedState();
}

class _BankInvestmentScreenEnhancedState extends State<BankInvestmentScreenEnhanced>
    with TickerProviderStateMixin {
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
      description: 'Invest in the future of artificial intelligence and machine learning companies.',
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
                                icon: const Icon(Icons.arrow_back, color: Colors.white),
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
                                icon: const Icon(Icons.notifications_outlined, color: Colors.white),
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
                                      _todaysChange >= 0 ? Icons.trending_up : Icons.trending_down,
                                      color: _todaysChange >= 0 ? Colors.green : Colors.red,
                                      size: 20,
                                    ),
                                    const SizedBox(width: 4),
                                    Text(
                                      '${_todaysChange >= 0 ? '+' : ''}\$${_todaysChange.toStringAsFixed(2)} (${_todaysChangePercent.toStringAsFixed(2)}%)',
                                      style: TextStyle(
                                        color: _todaysChange >= 0 ? Colors.green : Colors.red,
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
                              _buildQuickActionButton(
                                icon: Icons.add_circle_outline,
                                label: 'Invest',
                                onTap: () => _showInvestDialog(),
                              ),
                              _buildQuickActionButton(
                                icon: Icons.remove_circle_outline,
                                label: 'Withdraw',
                                onTap: () => _showWithdrawDialog(),
                              ),
                              _buildQuickActionButton(
                                icon: Icons.pie_chart_outline,
                                label: 'Rebalance',
                                onTap: () => _showRebalanceDialog(),
                              ),
                              _buildQuickActionButton(
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
                  _buildHoldingsTab(),
                  _buildDiscoverTab(),
                  _buildPerformanceTab(),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildQuickActionButton({
    required IconData icon,
    required String label,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Column(
        children: [
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: Colors.white.withOpacity(0.2),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(
              icon,
              color: Colors.white,
              size: 24,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            label,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 12,
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildHoldingsTab() {
    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: _holdings.length + 1,
      itemBuilder: (context, index) {
        if (index == 0) {
          return _buildPortfolioSummaryCard();
        }

        final holding = _holdings[index - 1];
        return Container(
          margin: const EdgeInsets.only(bottom: 12),
          child: Card(
            elevation: 2,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
            ),
            child: ListTile(
              contentPadding: const EdgeInsets.all(16),
              leading: Container(
                width: 50,
                height: 50,
                decoration: BoxDecoration(
                  color: holding.color.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(
                  _getInvestmentIcon(holding.symbol),
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
                        holding.change >= 0 ? Icons.trending_up : Icons.trending_down,
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
              onTap: () => _showHoldingDetails(holding),
            ),
          ),
        );
      },
    );
  }

  Widget _buildPortfolioSummaryCard() {
    return Container(
      margin: const EdgeInsets.only(bottom: 20),
      child: Card(
        elevation: 4,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
        ),
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Portfolio Distribution',
                style: ThemeTextStyles.headingMedium.copyWith(
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 16),
              SizedBox(
                height: 200,
                child: Row(
                  children: [
                    // Pie Chart Placeholder
                    Expanded(
                      flex: 2,
                      child: Container(
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: Colors.grey[100],
                        ),
                        child: const Center(
                          child: Text(
                            'Portfolio\nChart',
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              color: Colors.grey,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 20),
                    // Legend
                    Expanded(
                      flex: 3,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: _holdings.take(5).map((holding) {
                          final percentage = (holding.currentValue / _totalPortfolioValue * 100);
                          return Padding(
                            padding: const EdgeInsets.symmetric(vertical: 4),
                            child: Row(
                              children: [
                                Container(
                                  width: 12,
                                  height: 12,
                                  decoration: BoxDecoration(
                                    color: holding.color,
                                    shape: BoxShape.circle,
                                  ),
                                ),
                                const SizedBox(width: 8),
                                Expanded(
                                  child: Text(
                                    holding.symbol,
                                    style: ThemeTextStyles.bodySmall,
                                  ),
                                ),
                                Text(
                                  '${percentage.toStringAsFixed(1)}%',
                                  style: ThemeTextStyles.bodySmall.copyWith(
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ],
                            ),
                          );
                        }).toList(),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildDiscoverTab() {
    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: _recommendedProducts.length + 1,
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

        final product = _recommendedProducts[index - 1];
        return Container(
          margin: const EdgeInsets.only(bottom: 16),
          child: Card(
            elevation: 2,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(16),
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
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: _getRiskLevelColor(product.riskLevel).withOpacity(0.1),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Text(
                          product.riskLevel,
                          style: TextStyle(
                            color: _getRiskLevelColor(product.riskLevel),
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
                          Icon(
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
                      onPressed: () => _showInvestmentDetails(product),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF4A90E2),
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
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

  Widget _buildPerformanceTab() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Performance Overview',
            style: ThemeTextStyles.headingLarge.copyWith(
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 20),
          Card(
            elevation: 2,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(16),
            ),
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                children: [
                  _buildPerformanceMetric('1 Day', '+1.35%', Colors.green),
                  const Divider(),
                  _buildPerformanceMetric('1 Week', '+3.42%', Colors.green),
                  const Divider(),
                  _buildPerformanceMetric('1 Month', '+8.75%', Colors.green),
                  const Divider(),
                  _buildPerformanceMetric('3 Months', '+15.20%', Colors.green),
                  const Divider(),
                  _buildPerformanceMetric('1 Year', '+28.45%', Colors.green),
                  const Divider(),
                  _buildPerformanceMetric('All Time', '+42.33%', Colors.green),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPerformanceMetric(String period, String performance, Color color) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            period,
            style: ThemeTextStyles.bodyMedium,
          ),
          Text(
            performance,
            style: ThemeTextStyles.bodyMedium.copyWith(
              color: color,
              fontWeight: FontWeight.bold,
            ),
          ),
        ],
      ),
    );
  }

  IconData _getInvestmentIcon(String symbol) {
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

  Color _getRiskLevelColor(String riskLevel) {
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

  void _showHoldingDetails(InvestmentHolding holding) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
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
                    child: _buildDetailCard(
                      'Current Value',
                      '\$${holding.currentValue.toStringAsFixed(2)}',
                      Colors.blue,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _buildDetailCard(
                      'Total Return',
                      '${holding.change >= 0 ? '+' : ''}\$${holding.change.toStringAsFixed(2)}',
                      holding.change >= 0 ? Colors.green : Colors.red,
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

  Widget _buildDetailCard(String title, String value, Color color) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: color.withOpacity(0.1),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: ThemeTextStyles.bodySmall.copyWith(
              color: Colors.grey[600],
            ),
          ),
          const SizedBox(height: 8),
          Text(
            value,
            style: ThemeTextStyles.headingSmall.copyWith(
              color: color,
              fontWeight: FontWeight.bold,
            ),
          ),
        ],
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
              _showInvestDialog();
            },
            child: const Text('Invest Now'),
          ),
        ],
      ),
    );
  }

  void _showInvestDialog() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Invest'),
        content: const Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              decoration: InputDecoration(
                labelText: 'Investment Amount',
                prefixText: '\$',
                border: OutlineInputBorder(),
              ),
              keyboardType: TextInputType.number,
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.of(context).pop();
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Investment order placed successfully!')),
              );
            },
            child: const Text('Invest'),
          ),
        ],
      ),
    );
  }

  void _showWithdrawDialog() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Withdraw'),
        content: const Text('Select investment to withdraw from:'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Continue'),
          ),
        ],
      ),
    );
  }

  void _showRebalanceDialog() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Rebalance Portfolio'),
        content: const Text('This will automatically rebalance your portfolio according to your risk profile.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Rebalance'),
          ),
        ],
      ),
    );
  }
}

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

class InvestmentProduct {
  final String name;
  final String category;
  final String riskLevel;
  final String expectedReturn;
  final int minInvestment;
  final String description;
  final double rating;

  InvestmentProduct({
    required this.name,
    required this.category,
    required this.riskLevel,
    required this.expectedReturn,
    required this.minInvestment,
    required this.description,
    required this.rating,
  });
}