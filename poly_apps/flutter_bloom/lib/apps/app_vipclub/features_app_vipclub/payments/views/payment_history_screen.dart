import 'package:flutter/material.dart';
import 'package:qyflutter/common/widgets/widgets.dart';
import 'package:qyflutter/common/theme/base/theme_colors.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/apps/app_vipclub/models_app_vipclub/payment_model_app_vipclub.dart';
import 'package:qyflutter/apps/app_vipclub/services_app_vipclub/payments_api_service_app_vipclub.dart';

/// Payment History Screen
class VipClubPaymentHistoryScreen extends StatefulWidget {
  const VipClubPaymentHistoryScreen({super.key});

  @override
  State<VipClubPaymentHistoryScreen> createState() =>
      _VipClubPaymentHistoryScreenState();
}

class _VipClubPaymentHistoryScreenState
    extends State<VipClubPaymentHistoryScreen> {
  final _paymentsService = VipClubPaymentsApiService();

  List<VipClubPaymentModel> _payments = [];
  bool _isLoading = true;
  String? _error;
  int _currentPage = 1;
  int _totalPayments = 0;

  @override
  void initState() {
    super.initState();
    _loadPayments();
  }

  Future<void> _loadPayments() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final result = await _paymentsService.getPaymentHistory(
        page: _currentPage,
        limit: 20,
      );

      setState(() {
        _payments = result['payments'];
        _totalPayments = result['total'];
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _error = e.toString();
        _isLoading = false;
      });
    }
  }

  Future<void> _viewReceipt(VipClubPaymentModel payment) async {
    if (!payment.isCompleted || payment.receiptUrl == null) {
      showCustomSnackbar(
        context: context,
        message: 'Receipt not available',
        type: SnackbarType.warning,
      );
      return;
    }

    try {
      final receipt = await _paymentsService.getReceipt(payment.id);

      // Show receipt dialog
      showDialog(
        context: context,
        builder: (context) => _buildReceiptDialog(receipt),
      );
    } catch (e) {
      showErrorDialog(
        context: context,
        title: 'Failed to Load Receipt',
        message: e.toString(),
      );
    }
  }

  Widget _buildReceiptDialog(VipClubReceiptModel receipt) {
    return AlertDialog(
      title: Text('Payment Receipt'),
      content: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            _buildReceiptRow('Receipt ID', receipt.id),
            _buildReceiptRow('Payment ID', receipt.paymentId),
            _buildReceiptRow('Amount', receipt.formattedAmount),
            _buildReceiptRow('Method', receipt.paymentMethodDisplay),
            _buildReceiptRow(
              'Date',
              '${receipt.paidAt.year}-${receipt.paidAt.month.toString().padLeft(2, '0')}-${receipt.paidAt.day.toString().padLeft(2, '0')}',
            ),
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: Text('Close'),
        ),
        ElevatedButton(
          onPressed: () {
            // Download receipt
            showCustomSnackbar(
              context: context,
              message: 'Download functionality coming soon',
              type: SnackbarType.info,
            );
          },
          child: Text('Download'),
        ),
      ],
    );
  }

  Widget _buildReceiptRow(String label, String value) {
    return Padding(
      padding: EdgeInsets.symmetric(vertical: ThemeDimensions.smallPadding),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: ThemeTextStyles.bodyMedium.copyWith(
              color: ThemeColors.neutralGrey,
            ),
          ),
          Text(
            value,
            style: ThemeTextStyles.bodyMedium.copyWith(
              fontWeight: FontWeight.bold,
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: ThemeColors.neutralWhite,
      appBar: AppBar(
        title: Text('Payment History'),
        backgroundColor: ThemeColors.primaryBlue,
        foregroundColor: ThemeColors.neutralWhite,
      ),
      body: _buildBody(),
    );
  }

  Widget _buildBody() {
    if (_isLoading) {
      return LoadingState(message: 'Loading payment history...');
    }

    if (_error != null) {
      return ErrorState(
        title: 'Failed to Load',
        message: _error!,
        onRetry: _loadPayments,
      );
    }

    if (_payments.isEmpty) {
      return EmptyState(
        title: 'No Payments Yet',
        message: 'Your payment history will appear here',
        icon: Icons.receipt_long,
      );
    }

    return RefreshIndicator(
      onRefresh: _loadPayments,
      child: ListView.separated(
        padding: EdgeInsets.all(ThemeDimensions.defaultPadding),
        itemCount: _payments.length,
        separatorBuilder: (context, index) =>
            SizedBox(height: ThemeDimensions.defaultPadding),
        itemBuilder: (context, index) {
          final payment = _payments[index];
          return _buildPaymentCard(payment);
        },
      ),
    );
  }

  Widget _buildPaymentCard(VipClubPaymentModel payment) {
    Color statusColor;
    IconData statusIcon;

    if (payment.isCompleted) {
      statusColor = ThemeColors.successGreen;
      statusIcon = Icons.check_circle;
    } else if (payment.isFailed) {
      statusColor = ThemeColors.errorRed;
      statusIcon = Icons.error;
    } else if (payment.isProcessing) {
      statusColor = ThemeColors.warningYellow;
      statusIcon = Icons.hourglass_empty;
    } else {
      statusColor = ThemeColors.neutralGrey;
      statusIcon = Icons.schedule;
    }

    return StyledCard(
      onTap: () => _viewReceipt(payment),
      child: Padding(
        padding: EdgeInsets.all(ThemeDimensions.defaultPadding),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header with amount and status
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  payment.formattedAmount,
                  style: ThemeTextStyles.headlineSmall.copyWith(
                    fontWeight: FontWeight.bold,
                    color: ThemeColors.primaryBlue,
                  ),
                ),
                StatusBadge(
                  text: payment.paymentStatusDisplay,
                  backgroundColor: statusColor,
                  icon: statusIcon,
                ),
              ],
            ),
            SizedBox(height: ThemeDimensions.smallPadding),

            // Payment Method
            Row(
              children: [
                Icon(
                  Icons.payment,
                  size: 16,
                  color: ThemeColors.neutralGrey,
                ),
                SizedBox(width: ThemeDimensions.tinyPadding),
                Text(
                  payment.paymentMethodDisplay,
                  style: ThemeTextStyles.bodyMedium.copyWith(
                    color: ThemeColors.neutralGrey,
                  ),
                ),
              ],
            ),
            SizedBox(height: ThemeDimensions.tinyPadding),

            // Date
            Row(
              children: [
                Icon(
                  Icons.access_time,
                  size: 16,
                  color: ThemeColors.neutralGrey,
                ),
                SizedBox(width: ThemeDimensions.tinyPadding),
                Text(
                  '${payment.createdAt.year}-${payment.createdAt.month.toString().padLeft(2, '0')}-${payment.createdAt.day.toString().padLeft(2, '0')} ${payment.createdAt.hour.toString().padLeft(2, '0')}:${payment.createdAt.minute.toString().padLeft(2, '0')}',
                  style: ThemeTextStyles.bodySmall.copyWith(
                    color: ThemeColors.neutralGrey,
                  ),
                ),
              ],
            ),

            // Transaction ID
            if (payment.transactionId != null) ...[
              SizedBox(height: ThemeDimensions.tinyPadding),
              Row(
                children: [
                  Icon(
                    Icons.confirmation_number,
                    size: 16,
                    color: ThemeColors.neutralGrey,
                  ),
                  SizedBox(width: ThemeDimensions.tinyPadding),
                  Expanded(
                    child: Text(
                      'Transaction: ${payment.transactionId}',
                      style: ThemeTextStyles.bodySmall.copyWith(
                        color: ThemeColors.neutralGrey,
                      ),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ],
              ),
            ],

            // Receipt Button
            if (payment.isCompleted && payment.receiptUrl != null) ...[
              SizedBox(height: ThemeDimensions.defaultPadding),
              SecondaryButton(
                text: 'View Receipt',
                onPressed: () => _viewReceipt(payment),
                icon: Icons.receipt,
                isFullWidth: true,
              ),
            ],
          ],
        ),
      ),
    );
  }
}
