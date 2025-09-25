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
import 'package:flutter/services.dart';
import '../../../config_app_bank/bank_text_styles.dart';

/// Account Detail Screen - Shows detailed balance and transaction information
/// Features balance visibility toggle, quick actions, and recent transactions
class BankAccountDetailScreen extends StatefulWidget {
  final String accountType;
  final String accountNumber;
  final double balance;

  const BankAccountDetailScreen({
    super.key,
    this.accountType = 'Checking Account',
    this.accountNumber = '****1234',
    this.balance = 12459.50,
  });

  @override
  State<BankAccountDetailScreen> createState() => _BankAccountDetailScreenState();
}

class _BankAccountDetailScreenState extends State<BankAccountDetailScreen> {
  bool _isBalanceVisible = true;
  bool _showCardNumber = false;

  final List<TransactionDetail> _recentTransactions = [
    TransactionDetail(
      title: 'Salary Deposit',
      subtitle: 'Company ABC Ltd',
      amount: 3500.00,
      date: DateTime.now().subtract(const Duration(hours: 8)),
      type: TransactionType.credit,
      status: 'Completed',
      reference: 'TXN20250919001',
    ),
    TransactionDetail(
      title: 'Online Purchase',
      subtitle: 'Amazon.com',
      amount: -89.99,
      date: DateTime.now().subtract(const Duration(hours: 12)),
      type: TransactionType.debit,
      status: 'Completed',
      reference: 'TXN20250919002',
    ),
    TransactionDetail(
      title: 'ATM Withdrawal',
      subtitle: 'ATM Location: Main Street',
      amount: -200.00,
      date: DateTime.now().subtract(const Duration(days: 1)),
      type: TransactionType.withdrawal,
      status: 'Completed',
      reference: 'TXN20250918003',
    ),
    TransactionDetail(
      title: 'Transfer to John Doe',
      subtitle: 'Personal transfer',
      amount: -250.00,
      date: DateTime.now().subtract(const Duration(days: 2)),
      type: TransactionType.transfer,
      status: 'Completed',
      reference: 'TXN20250917004',
    ),
    TransactionDetail(
      title: 'Interest Payment',
      subtitle: 'Quarterly interest',
      amount: 45.75,
      date: DateTime.now().subtract(const Duration(days: 3)),
      type: TransactionType.credit,
      status: 'Completed',
      reference: 'TXN20250916005',
    ),
  ];

  void _toggleBalanceVisibility() {
    setState(() {
      _isBalanceVisible = !_isBalanceVisible;
    });
  }

  void _copyAccountNumber() {
    Clipboard.setData(ClipboardData(text: '1234567890123456'));
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Account number copied to clipboard'),
        duration: Duration(seconds: 2),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [
              Color(0xFF4A90E2),
              Color(0xFF357ABD),
            ],
          ),
        ),
        child: SafeArea(
          child: Column(
            children: [
              // Custom App Bar
              _buildAppBar(),

              // Account Card
              _buildAccountCard(),

              // Quick Actions
              _buildQuickActions(),

              // Transactions Section
              Expanded(
                child: _buildTransactionsList(),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildAppBar() {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Row(
        children: [
          IconButton(
            onPressed: () => Navigator.of(context).pop(),
            icon: const Icon(Icons.arrow_back, color: Colors.white),
          ),
          Expanded(
            child: Text(
              widget.accountType,
              style: BankTextStyles.headingMedium.copyWith(
                color: Colors.white,
                fontWeight: FontWeight.w600,
              ),
              textAlign: TextAlign.center,
            ),
          ),
          IconButton(
            onPressed: () {},
            icon: const Icon(Icons.more_vert, color: Colors.white),
          ),
        ],
      ),
    );
  }

  Widget _buildAccountCard() {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: Card(
        elevation: 8,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20),
        ),
        child: Container(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(20),
            gradient: const LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [
                Color(0xFF2C3E50),
                Color(0xFF34495E),
              ],
            ),
          ),
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Bank Name and Card Type
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'Flutter Bank',
                    style: BankTextStyles.bodyMedium.copyWith(
                      color: Colors.white.withOpacity(0.8),
                      letterSpacing: 1.2,
                    ),
                  ),
                  Text(
                    widget.accountType.toUpperCase(),
                    style: BankTextStyles.bodySmall.copyWith(
                      color: Colors.white.withOpacity(0.8),
                      fontWeight: FontWeight.bold,
                      letterSpacing: 1.5,
                    ),
                  ),
                ],
              ),

              const SizedBox(height: 24),

              // Card Number
              GestureDetector(
                onTap: () {
                  setState(() {
                    _showCardNumber = !_showCardNumber;
                  });
                },
                child: Row(
                  children: [
                    Text(
                      _showCardNumber ? '1234 5678 9012 3456' : '•••• •••• •••• 3456',
                      style: BankTextStyles.headingMedium.copyWith(
                        color: Colors.white,
                        letterSpacing: 2.0,
                        fontWeight: FontWeight.w300,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Icon(
                      _showCardNumber ? Icons.visibility : Icons.visibility_off,
                      color: Colors.white.withOpacity(0.7),
                      size: 20,
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 24),

              // Balance and Actions
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Available Balance',
                        style: BankTextStyles.bodySmall.copyWith(
                          color: Colors.white.withOpacity(0.8),
                        ),
                      ),
                      const SizedBox(height: 4),
                      Row(
                        children: [
                          Text(
                            _isBalanceVisible
                                ? '\$${widget.balance.toStringAsFixed(2)}'
                                : '••••••••',
                            style: BankTextStyles.headingLarge.copyWith(
                              color: Colors.white,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          const SizedBox(width: 8),
                          GestureDetector(
                            onTap: _toggleBalanceVisibility,
                            child: Icon(
                              _isBalanceVisible ? Icons.visibility : Icons.visibility_off,
                              color: Colors.white.withOpacity(0.7),
                              size: 20,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),

                  // Copy Account Number
                  GestureDetector(
                    onTap: _copyAccountNumber,
                    child: Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: Colors.white.withOpacity(0.2),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: const Icon(
                        Icons.copy,
                        color: Colors.white,
                        size: 20,
                      ),
                    ),
                  ),
                ],
              ),

              const SizedBox(height: 16),

              // Account Status
              Row(
                children: [
                  Container(
                    width: 8,
                    height: 8,
                    decoration: const BoxDecoration(
                      color: Colors.green,
                      shape: BoxShape.circle,
                    ),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    'Active Account',
                    style: BankTextStyles.bodySmall.copyWith(
                      color: Colors.green,
                      fontWeight: FontWeight.w500,
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

  Widget _buildQuickActions() {
    return Container(
      margin: const EdgeInsets.all(16),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.1),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceAround,
        children: [
          _buildActionButton(
            icon: Icons.send,
            label: 'Transfer',
            color: const Color(0xFF4A90E2),
            onTap: () {},
          ),
          _buildActionButton(
            icon: Icons.payment,
            label: 'Pay Bills',
            color: const Color(0xFF27AE60),
            onTap: () {},
          ),
          _buildActionButton(
            icon: Icons.download,
            label: 'Statement',
            color: const Color(0xFFE67E22),
            onTap: () {},
          ),
          _buildActionButton(
            icon: Icons.block,
            label: 'Block Card',
            color: const Color(0xFFE74C3C),
            onTap: () {},
          ),
        ],
      ),
    );
  }

  Widget _buildActionButton({
    required IconData icon,
    required String label,
    required Color color,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Column(
        children: [
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: color.withOpacity(0.1),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(
              icon,
              color: color,
              size: 24,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            label,
            style: BankTextStyles.bodySmall.copyWith(
              color: const Color(0xFF2C3E50),
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTransactionsList() {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16),
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.only(
          topLeft: Radius.circular(20),
          topRight: Radius.circular(20),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header
          Padding(
            padding: const EdgeInsets.all(20),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'Recent Transactions',
                  style: BankTextStyles.headingMedium.copyWith(
                    color: const Color(0xFF2C3E50),
                    fontWeight: FontWeight.bold,
                  ),
                ),
                TextButton(
                  onPressed: () {},
                  child: Text(
                    'View All',
                    style: BankTextStyles.bodyMedium.copyWith(
                      color: const Color(0xFF4A90E2),
                    ),
                  ),
                ),
              ],
            ),
          ),

          // Transactions List
          Expanded(
            child: ListView.separated(
              padding: const EdgeInsets.only(bottom: 20),
              itemCount: _recentTransactions.length,
              separatorBuilder: (context, index) => const Divider(
                height: 1,
                indent: 70,
              ),
              itemBuilder: (context, index) {
                final transaction = _recentTransactions[index];
                return _buildTransactionItem(transaction);
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTransactionItem(TransactionDetail transaction) {
    final IconData iconData;
    final Color iconColor;

    switch (transaction.type) {
      case TransactionType.credit:
        iconData = Icons.add_circle;
        iconColor = Colors.green;
        break;
      case TransactionType.debit:
        iconData = Icons.shopping_cart;
        iconColor = Colors.orange;
        break;
      case TransactionType.transfer:
        iconData = Icons.send;
        iconColor = Colors.blue;
        break;
      case TransactionType.withdrawal:
        iconData = Icons.local_atm;
        iconColor = Colors.red;
        break;
    }

    return ListTile(
      contentPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
      leading: CircleAvatar(
        backgroundColor: iconColor.withOpacity(0.1),
        child: Icon(
          iconData,
          color: iconColor,
          size: 24,
        ),
      ),
      title: Text(
        transaction.title,
        style: BankTextStyles.bodyLarge.copyWith(
          fontWeight: FontWeight.w600,
        ),
      ),
      subtitle: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SizedBox(height: 2),
          Text(
            transaction.subtitle,
            style: BankTextStyles.bodySmall.copyWith(
              color: Colors.grey[600],
            ),
          ),
          const SizedBox(height: 2),
          Text(
            transaction.reference,
            style: BankTextStyles.bodySmall.copyWith(
              color: Colors.grey[500],
              fontSize: 11,
            ),
          ),
        ],
      ),
      trailing: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          Text(
            '${transaction.amount > 0 ? '+' : ''}\$${transaction.amount.abs().toStringAsFixed(2)}',
            style: BankTextStyles.bodyLarge.copyWith(
              color: transaction.amount > 0 ? Colors.green : Colors.red,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            _formatDate(transaction.date),
            style: BankTextStyles.bodySmall.copyWith(
              color: Colors.grey[500],
            ),
          ),
          const SizedBox(height: 2),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
            decoration: BoxDecoration(
              color: Colors.green.withOpacity(0.1),
              borderRadius: BorderRadius.circular(4),
            ),
            child: Text(
              transaction.status,
              style: BankTextStyles.bodySmall.copyWith(
                color: Colors.green,
                fontSize: 10,
              ),
            ),
          ),
        ],
      ),
    );
  }

  String _formatDate(DateTime date) {
    final now = DateTime.now();
    final difference = now.difference(date);

    if (difference.inDays == 0) {
      return '${date.hour}:${date.minute.toString().padLeft(2, '0')}';
    } else if (difference.inDays == 1) {
      return 'Yesterday';
    } else if (difference.inDays < 7) {
      return '${difference.inDays}d ago';
    } else {
      return '${date.day}/${date.month}';
    }
  }
}

enum TransactionType { credit, debit, transfer, withdrawal }

class TransactionDetail {
  final String title;
  final String subtitle;
  final double amount;
  final DateTime date;
  final TransactionType type;
  final String status;
  final String reference;

  TransactionDetail({
    required this.title,
    required this.subtitle,
    required this.amount,
    required this.date,
    required this.type,
    required this.status,
    required this.reference,
  });
}