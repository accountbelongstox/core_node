import 'package:flutter/material.dart';
import '../../localization_app_codemart/localization_keys_app_codemart.dart';
import '../../main_app_codemart.dart';
import 'package:qyflutter/common/localization/localization_manager.dart';

class WalletViewAppCodemart extends StatefulWidget {
  const WalletViewAppCodemart({super.key});

  @override
  State<WalletViewAppCodemart> createState() => _WalletViewAppCodemartState();
}

class _WalletViewAppCodemartState extends State<WalletViewAppCodemart>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;

  // Mock data
  final double _balance = 5420.50;
  final double _earnings = 12340.00;
  final List<Map<String, dynamic>> _transactions = [
    {
      'id': 1,
      'type': 'deposit',
      'amount': 500.00,
      'date': '2025-11-01',
      'description': 'Project payment received',
    },
    {
      'id': 2,
      'type': 'withdrawal',
      'amount': -200.00,
      'date': '2025-10-28',
      'description': 'Withdrawal to bank',
    },
    {
      'id': 3,
      'type': 'deposit',
      'amount': 1000.00,
      'date': '2025-10-25',
      'description': 'Task completion bonus',
    },
  ];

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(LocalizationKeysAppCodemart.codemartWallet.tr(context)),
        bottom: TabBar(
          controller: _tabController,
          tabs: [
            Tab(text: LocalizationKeysAppCodemart.codemartBalance.tr(context)),
            Tab(text: LocalizationKeysAppCodemart.codemartTransactions.tr(context)),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          _buildBalanceTab(),
          _buildTransactionsTab(),
        ],
      ),
    );
  }

  Widget _buildBalanceTab() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Balance card
          Card(
            color: Theme.of(context).colorScheme.primaryContainer,
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                children: [
                  Text(
                    LocalizationKeysAppCodemart.codemartBalance.tr(context),
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  const SizedBox(height: 8),
                  Text(
                    '\$${_balance.toStringAsFixed(2)}',
                    style: Theme.of(context).textTheme.displaySmall?.copyWith(
                          fontWeight: FontWeight.bold,
                        ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),

          // Earnings card
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        LocalizationKeysAppCodemart.codemartEarnings.tr(context),
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                      const SizedBox(height: 4),
                      const Text('Total lifetime earnings'),
                    ],
                  ),
                  Text(
                    '\$${_earnings.toStringAsFixed(2)}',
                    style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                          color: Colors.green,
                          fontWeight: FontWeight.bold,
                        ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 24),

          // Action buttons
          Row(
            children: [
              Expanded(
                child: FilledButton.icon(
                  onPressed: () {
                    // TODO: Show deposit dialog
                  },
                  icon: const Icon(Icons.add),
                  label: const Text('Deposit'),
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () {
                    // TODO: Show withdrawal dialog
                  },
                  icon: const Icon(Icons.remove),
                  label: const Text('Withdraw'),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildTransactionsTab() {
    return _transactions.isEmpty
        ? Center(
            child: Text(LocalizationKeysAppCodemart.codemartNoData.tr(context)),
          )
        : ListView.builder(
            padding: const EdgeInsets.all(16),
            itemCount: _transactions.length,
            itemBuilder: (context, index) {
              final transaction = _transactions[index];
              final isDeposit = transaction['type'] == 'deposit';
              final amount = transaction['amount'] as double;

              return Card(
                margin: const EdgeInsets.only(bottom: 12),
                child: ListTile(
                  leading: CircleAvatar(
                    backgroundColor: isDeposit
                        ? Colors.green.withOpacity(0.2)
                        : Colors.red.withOpacity(0.2),
                    child: Icon(
                      isDeposit ? Icons.arrow_downward : Icons.arrow_upward,
                      color: isDeposit ? Colors.green : Colors.red,
                    ),
                  ),
                  title: Text(transaction['description']),
                  subtitle: Text(transaction['date']),
                  trailing: Text(
                    '${amount > 0 ? '+' : ''}\$${amount.abs().toStringAsFixed(2)}',
                    style: TextStyle(
                      color: isDeposit ? Colors.green : Colors.red,
                      fontWeight: FontWeight.bold,
                      fontSize: 16,
                    ),
                  ),
                ),
              );
            },
          );
  }
}
