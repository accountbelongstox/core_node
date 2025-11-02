import 'package:flutter/material.dart';
import 'package:qyflutter/common/widgets/widgets.dart';
import 'package:qyflutter/common/theme/base/theme_colors.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/apps/app_vipclub/services_app_vipclub/payments_api_service_app_vipclub.dart';

/// Payment Processing Screen
class VipClubPaymentScreen extends StatefulWidget {
  final String? bookingId;
  final String? membershipTier;
  final double amount;
  final String title;
  final String description;

  const VipClubPaymentScreen({
    super.key,
    this.bookingId,
    this.membershipTier,
    required this.amount,
    required this.title,
    required this.description,
  });

  @override
  State<VipClubPaymentScreen> createState() => _VipClubPaymentScreenState();
}

class _VipClubPaymentScreenState extends State<VipClubPaymentScreen> {
  final _paymentsService = VipClubPaymentsApiService();

  String _selectedPaymentMethod = 'stripe';
  String _selectedCurrency = 'USD';
  bool _isProcessing = false;

  final List<Map<String, dynamic>> _paymentMethods = [
    {
      'id': 'stripe',
      'name': 'Credit/Debit Card',
      'icon': Icons.credit_card,
      'description': 'Visa, Mastercard, AmEx',
    },
    {
      'id': 'paypal',
      'name': 'PayPal',
      'icon': Icons.account_balance_wallet,
      'description': 'Pay with your PayPal account',
    },
    {
      'id': 'wechat',
      'name': 'WeChat Pay',
      'icon': Icons.chat,
      'description': 'Scan QR code to pay',
    },
    {
      'id': 'alipay',
      'name': 'Alipay',
      'icon': Icons.payment,
      'description': 'Pay with Alipay',
    },
  ];

  final List<String> _currencies = ['USD', 'EUR', 'GBP', 'CNY'];

  Future<void> _processPayment() async {
    setState(() => _isProcessing = true);

    try {
      // Step 1: Create payment
      final paymentResult = await _paymentsService.createPayment(
        bookingId: widget.bookingId,
        membershipTier: widget.membershipTier,
        amount: widget.amount,
        currency: _selectedCurrency,
        paymentMethod: _selectedPaymentMethod,
      );

      // Step 2: In real app, show payment gateway UI
      // For now, simulate payment confirmation
      await Future.delayed(Duration(seconds: 2));

      final confirmResult = await _paymentsService.confirmPayment(
        paymentId: paymentResult['payment_id'],
        paymentToken: 'mock_token_${DateTime.now().millisecondsSinceEpoch}',
      );

      if (confirmResult['success'] && mounted) {
        showSuccessDialog(
          context: context,
          title: 'Payment Successful',
          message: 'Your payment has been processed successfully.',
          onPressed: () {
            Navigator.pop(context); // Close dialog
            Navigator.pop(context, {
              'success': true,
              'transaction_id': confirmResult['transaction_id'],
              'receipt_url': confirmResult['receipt_url'],
            });
          },
        );
      }
    } catch (e) {
      if (mounted) {
        showErrorDialog(
          context: context,
          title: 'Payment Failed',
          message: e.toString(),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _isProcessing = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: ThemeColors.neutralWhite,
      appBar: AppBar(
        title: Text('Payment'),
        backgroundColor: ThemeColors.primaryBlue,
        foregroundColor: ThemeColors.neutralWhite,
      ),
      body: SingleChildScrollView(
        padding: EdgeInsets.all(ThemeDimensions.defaultPadding),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Payment Summary
            _buildPaymentSummary(),
            SizedBox(height: ThemeDimensions.largePadding),

            // Currency Selection
            ListSectionHeader(title: 'Currency'),
            SizedBox(height: ThemeDimensions.defaultPadding),
            Wrap(
              spacing: ThemeDimensions.smallPadding,
              children: _currencies.map((currency) {
                return SelectableChip(
                  label: currency,
                  isSelected: _selectedCurrency == currency,
                  onTap: () {
                    setState(() => _selectedCurrency = currency);
                  },
                );
              }).toList(),
            ),
            SizedBox(height: ThemeDimensions.largePadding),

            // Payment Method Selection
            ListSectionHeader(title: 'Payment Method'),
            SizedBox(height: ThemeDimensions.defaultPadding),

            ..._paymentMethods.map((method) {
              final isSelected = _selectedPaymentMethod == method['id'];
              return Padding(
                padding:
                    EdgeInsets.only(bottom: ThemeDimensions.smallPadding),
                child: StyledCard(
                  onTap: () {
                    setState(() => _selectedPaymentMethod = method['id']);
                  },
                  backgroundColor: isSelected
                      ? ThemeColors.primaryBlue.withOpacity(0.1)
                      : null,
                  child: ListTile(
                    leading: Container(
                      width: 48,
                      height: 48,
                      decoration: BoxDecoration(
                        color: isSelected
                            ? ThemeColors.primaryBlue
                            : ThemeColors.neutralGrey.withOpacity(0.1),
                        borderRadius: BorderRadius.circular(
                          ThemeDimensions.defaultRadius,
                        ),
                      ),
                      child: Icon(
                        method['icon'],
                        color: isSelected
                            ? ThemeColors.neutralWhite
                            : ThemeColors.neutralGrey,
                      ),
                    ),
                    title: Text(
                      method['name'],
                      style: ThemeTextStyles.bodyLarge.copyWith(
                        fontWeight: isSelected
                            ? FontWeight.bold
                            : FontWeight.normal,
                      ),
                    ),
                    subtitle: Text(method['description']),
                    trailing: isSelected
                        ? Icon(
                            Icons.check_circle,
                            color: ThemeColors.primaryBlue,
                          )
                        : null,
                  ),
                ),
              );
            }).toList(),

            SizedBox(height: ThemeDimensions.largePadding),

            // Security Notice
            InfoCard(
              icon: Icons.security,
              iconColor: ThemeColors.successGreen,
              title: 'Secure Payment',
              description:
                  'Your payment information is encrypted and secure. We never store your card details.',
            ),
            SizedBox(height: ThemeDimensions.hugePadding),

            // Pay Button
            PrimaryButton(
              text: 'Pay ${_getCurrencySymbol(_selectedCurrency)}${widget.amount.toStringAsFixed(2)}',
              onPressed: _processPayment,
              isLoading: _isProcessing,
              isFullWidth: true,
              icon: Icons.lock,
            ),

            SizedBox(height: ThemeDimensions.defaultPadding),

            // Terms
            Text(
              'By proceeding, you agree to our payment terms and conditions. All transactions are secure and encrypted.',
              style: ThemeTextStyles.bodySmall.copyWith(
                color: ThemeColors.neutralGrey,
              ),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPaymentSummary() {
    return GradientCard(
      gradientColors: [ThemeColors.primaryBlue, ThemeColors.accentGold],
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Payment Summary',
            style: ThemeTextStyles.headlineSmall.copyWith(
              color: ThemeColors.neutralWhite,
              fontWeight: FontWeight.bold,
            ),
          ),
          SizedBox(height: ThemeDimensions.defaultPadding),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                widget.title,
                style: ThemeTextStyles.bodyLarge.copyWith(
                  color: ThemeColors.neutralWhite,
                ),
              ),
              Text(
                '${_getCurrencySymbol(_selectedCurrency)}${widget.amount.toStringAsFixed(2)}',
                style: ThemeTextStyles.headlineMedium.copyWith(
                  color: ThemeColors.neutralWhite,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ],
          ),
          if (widget.description.isNotEmpty) ...[
            SizedBox(height: ThemeDimensions.smallPadding),
            Text(
              widget.description,
              style: ThemeTextStyles.bodySmall.copyWith(
                color: ThemeColors.neutralWhite.withOpacity(0.9),
              ),
            ),
          ],
        ],
      ),
    );
  }

  String _getCurrencySymbol(String currency) {
    switch (currency) {
      case 'USD':
        return '\$';
      case 'EUR':
        return '€';
      case 'GBP':
        return '£';
      case 'CNY':
        return '¥';
      default:
        return currency;
    }
  }
}
