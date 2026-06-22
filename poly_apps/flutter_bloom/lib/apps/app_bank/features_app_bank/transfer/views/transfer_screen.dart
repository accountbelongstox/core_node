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
import 'package:qyflutter/common/theme/base/theme_colors.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import '../../../config_app_bank/bank_text_styles.dart';

/// Bank Transfer Screen
/// Allows users to transfer money between accounts or to other people
class BankTransferScreen extends StatefulWidget {
  const BankTransferScreen({super.key});

  @override
  State<BankTransferScreen> createState() => _BankTransferScreenState();
}

class _BankTransferScreenState extends State<BankTransferScreen> {
  final GlobalKey<FormState> _formKey = GlobalKey<FormState>();
  final TextEditingController _amountController = TextEditingController();
  final TextEditingController _recipientController = TextEditingController();
  final TextEditingController _memoController = TextEditingController();

  String _selectedFromAccount = 'Checking Account - ****1234';
  String _selectedTransferType = 'To Contact';
  bool _isLoading = false;

  final List<String> _accounts = [
    'Checking Account - ****1234',
    'Savings Account - ****5678',
  ];

  final List<String> _transferTypes = [
    'To Contact',
    'To Bank Account',
    'Between My Accounts',
  ];

  final List<RecentContact> _recentContacts = [
    RecentContact(name: 'John Smith', email: 'john@email.com', avatar: '👨'),
    RecentContact(name: 'Sarah Johnson', email: 'sarah@email.com', avatar: '👩'),
    RecentContact(name: 'Mike Wilson', email: 'mike@email.com', avatar: '👤'),
  ];

  @override
  void dispose() {
    _amountController.dispose();
    _recipientController.dispose();
    _memoController.dispose();
    super.dispose();
  }

  Future<void> _handleTransfer() async {
    if (_formKey.currentState!.validate()) {
      setState(() {
        _isLoading = true;
      });

      // Simulate API call
      await Future.delayed(const Duration(seconds: 2));

      if (mounted) {
        setState(() {
          _isLoading = false;
        });

        // Show success dialog
        _showSuccessDialog();
      }
    }
  }

  void _showSuccessDialog() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(BankConstants.borderRadius),
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(
              Icons.check_circle,
              color: Colors.green,
              size: 64,
            ),
            const SizedBox(height: 16),
            Text(
              'Transfer Successful',
              style: BankTextStyles.headingMedium.copyWith(
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'Your transfer of \$${_amountController.text} has been completed.',
              style: BankTextStyles.bodyMedium,
              textAlign: TextAlign.center,
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () {
              Navigator.of(context).pop();
              Navigator.of(context).pop();
            },
            child: const Text('Done'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Transfer Money'),
        backgroundColor: ThemeColors.primaryColor,
        foregroundColor: Colors.white,
        elevation: 0,
      ),
      body: Form(
        key: _formKey,
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(ThemeDimensions.paddingMedium),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // From Account Selection
              Text(
                'From Account',
                style: BankTextStyles.bodyLarge.copyWith(
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: ThemeDimensions.spacingSmall),
              DropdownButtonFormField<String>(
                value: _selectedFromAccount,
                decoration: InputDecoration(
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                  prefixIcon: const Icon(Icons.account_balance_wallet),
                ),
                items: _accounts.map((account) {
                  return DropdownMenuItem(
                    value: account,
                    child: Text(account),
                  );
                }).toList(),
                onChanged: (value) {
                  setState(() {
                    _selectedFromAccount = value!;
                  });
                },
              ),

              const SizedBox(height: ThemeDimensions.spacingLarge),

              // Transfer Type Selection
              Text(
                'Transfer Type',
                style: BankTextStyles.bodyLarge.copyWith(
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: ThemeDimensions.spacingSmall),
              DropdownButtonFormField<String>(
                value: _selectedTransferType,
                decoration: InputDecoration(
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                  prefixIcon: const Icon(Icons.swap_horiz),
                ),
                items: _transferTypes.map((type) {
                  return DropdownMenuItem(
                    value: type,
                    child: Text(type),
                  );
                }).toList(),
                onChanged: (value) {
                  setState(() {
                    _selectedTransferType = value!;
                  });
                },
              ),

              const SizedBox(height: ThemeDimensions.spacingLarge),

              // Recent Contacts (if transfer to contact is selected)
              if (_selectedTransferType == 'To Contact') ...[
                Text(
                  'Recent Contacts',
                  style: BankTextStyles.bodyLarge.copyWith(
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: ThemeDimensions.spacingSmall),
                SizedBox(
                  height: 100,
                  child: ListView.builder(
                    scrollDirection: Axis.horizontal,
                    itemCount: _recentContacts.length,
                    itemBuilder: (context, index) {
                      final contact = _recentContacts[index];
                      return GestureDetector(
                        onTap: () {
                          _recipientController.text = contact.email;
                        },
                        child: Container(
                          width: 80,
                          margin: const EdgeInsets.only(right: 12),
                          child: Column(
                            children: [
                              CircleAvatar(
                                radius: 30,
                                backgroundColor: ThemeColors.primaryColor.withOpacity(0.1),
                                child: Text(
                                  contact.avatar,
                                  style: const TextStyle(fontSize: 24),
                                ),
                              ),
                              const SizedBox(height: 8),
                              Text(
                                contact.name.split(' ')[0],
                                style: BankTextStyles.bodySmall,
                                textAlign: TextAlign.center,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
                ),
                const SizedBox(height: ThemeDimensions.spacingLarge),
              ],

              // Recipient Field
              Text(
                _selectedTransferType == 'To Contact'
                    ? 'Recipient Email'
                    : _selectedTransferType == 'To Bank Account'
                        ? 'Account Number'
                        : 'To Account',
                style: BankTextStyles.bodyLarge.copyWith(
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: ThemeDimensions.spacingSmall),
              TextFormField(
                controller: _recipientController,
                decoration: InputDecoration(
                  hintText: _selectedTransferType == 'To Contact'
                      ? 'Enter email address'
                      : _selectedTransferType == 'To Bank Account'
                          ? 'Enter account number'
                          : 'Select account',
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                  prefixIcon: Icon(
                    _selectedTransferType == 'To Contact'
                        ? Icons.email
                        : Icons.account_balance,
                  ),
                ),
                validator: (value) {
                  if (value?.isEmpty ?? true) {
                    return 'Please enter recipient information';
                  }
                  return null;
                },
              ),

              const SizedBox(height: ThemeDimensions.spacingLarge),

              // Amount Field
              Text(
                'Amount',
                style: BankTextStyles.bodyLarge.copyWith(
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: ThemeDimensions.spacingSmall),
              TextFormField(
                controller: _amountController,
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                decoration: InputDecoration(
                  hintText: '0.00',
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                  prefixIcon: const Icon(Icons.attach_money),
                  suffixText: 'USD',
                ),
                validator: (value) {
                  if (value?.isEmpty ?? true) {
                    return 'Please enter amount';
                  }
                  final amount = double.tryParse(value!);
                  if (amount == null || amount <= 0) {
                    return 'Please enter a valid amount';
                  }
                  if (amount > 5000) {
                    return 'Amount exceeds daily limit';
                  }
                  return null;
                },
              ),

              const SizedBox(height: ThemeDimensions.spacingLarge),

              // Memo Field
              Text(
                'Memo (Optional)',
                style: BankTextStyles.bodyLarge.copyWith(
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: ThemeDimensions.spacingSmall),
              TextFormField(
                controller: _memoController,
                decoration: InputDecoration(
                  hintText: 'Add a note',
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                  prefixIcon: const Icon(Icons.note_outlined),
                ),
                maxLines: 2,
              ),

              const SizedBox(height: ThemeDimensions.spacingXLarge),

              // Transfer Button
              SizedBox(
                width: double.infinity,
                height: 56,
                child: ElevatedButton(
                  onPressed: _isLoading ? null : _handleTransfer,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: ThemeColors.primaryColor,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  child: _isLoading
                      ? const CircularProgressIndicator(color: Colors.white)
                      : Text(
                          'Transfer Money',
                          style: ThemeTextStyles.buttonText,
                        ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class RecentContact {
  final String name;
  final String email;
  final String avatar;

  RecentContact({
    required this.name,
    required this.email,
    required this.avatar,
  });
}