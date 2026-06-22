/// Payment Model for VIP Club
class VipClubPaymentModel {
  final String id;
  final String userId;
  final String? bookingId;
  final double amount;
  final String currency;
  final String paymentMethod;
  final String paymentStatus;
  final String? transactionId;
  final String? receiptUrl;
  final DateTime createdAt;
  final DateTime? paidAt;

  VipClubPaymentModel({
    required this.id,
    required this.userId,
    this.bookingId,
    required this.amount,
    this.currency = 'USD',
    required this.paymentMethod,
    required this.paymentStatus,
    this.transactionId,
    this.receiptUrl,
    required this.createdAt,
    this.paidAt,
  });

  /// Create from JSON
  factory VipClubPaymentModel.fromJson(Map<String, dynamic> json) {
    return VipClubPaymentModel(
      id: json['id']?.toString() ?? '',
      userId: json['user_id']?.toString() ?? json['userId']?.toString() ?? '',
      bookingId: json['booking_id']?.toString() ?? json['bookingId']?.toString(),
      amount: (json['amount'] ?? 0).toDouble(),
      currency: json['currency']?.toString() ?? 'USD',
      paymentMethod: json['payment_method']?.toString() ??
                     json['paymentMethod']?.toString() ?? '',
      paymentStatus: json['payment_status']?.toString() ??
                     json['paymentStatus']?.toString() ?? 'pending',
      transactionId: json['transaction_id']?.toString() ??
                     json['transactionId']?.toString(),
      receiptUrl: json['receipt_url']?.toString() ??
                  json['receiptUrl']?.toString(),
      createdAt: json['created_at'] != null
          ? DateTime.parse(json['created_at'].toString())
          : json['createdAt'] != null
              ? DateTime.parse(json['createdAt'].toString())
              : DateTime.now(),
      paidAt: json['paid_at'] != null
          ? DateTime.parse(json['paid_at'].toString())
          : json['paidAt'] != null
              ? DateTime.parse(json['paidAt'].toString())
              : null,
    );
  }

  /// Convert to JSON
  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'user_id': userId,
      if (bookingId != null) 'booking_id': bookingId,
      'amount': amount,
      'currency': currency,
      'payment_method': paymentMethod,
      'payment_status': paymentStatus,
      if (transactionId != null) 'transaction_id': transactionId,
      if (receiptUrl != null) 'receipt_url': receiptUrl,
      'created_at': createdAt.toIso8601String(),
      if (paidAt != null) 'paid_at': paidAt!.toIso8601String(),
    };
  }

  /// Copy with
  VipClubPaymentModel copyWith({
    String? id,
    String? userId,
    String? bookingId,
    double? amount,
    String? currency,
    String? paymentMethod,
    String? paymentStatus,
    String? transactionId,
    String? receiptUrl,
    DateTime? createdAt,
    DateTime? paidAt,
  }) {
    return VipClubPaymentModel(
      id: id ?? this.id,
      userId: userId ?? this.userId,
      bookingId: bookingId ?? this.bookingId,
      amount: amount ?? this.amount,
      currency: currency ?? this.currency,
      paymentMethod: paymentMethod ?? this.paymentMethod,
      paymentStatus: paymentStatus ?? this.paymentStatus,
      transactionId: transactionId ?? this.transactionId,
      receiptUrl: receiptUrl ?? this.receiptUrl,
      createdAt: createdAt ?? this.createdAt,
      paidAt: paidAt ?? this.paidAt,
    );
  }

  /// Check if payment is completed
  bool get isCompleted => paymentStatus == PaymentStatus.completed.value;

  /// Check if payment is pending
  bool get isPending => paymentStatus == PaymentStatus.pending.value;

  /// Check if payment failed
  bool get isFailed => paymentStatus == PaymentStatus.failed.value;

  /// Check if payment is processing
  bool get isProcessing => paymentStatus == PaymentStatus.processing.value;

  /// Get formatted amount with currency
  String get formattedAmount {
    final currencySymbols = {
      'USD': '\$',
      'EUR': '€',
      'GBP': '£',
      'CNY': '¥',
      'JPY': '¥',
    };

    final symbol = currencySymbols[currency.toUpperCase()] ?? currency;
    return '$symbol${amount.toStringAsFixed(2)}';
  }

  /// Get payment method display name
  String get paymentMethodDisplay {
    switch (paymentMethod.toLowerCase()) {
      case 'stripe':
        return 'Credit Card (Stripe)';
      case 'paypal':
        return 'PayPal';
      case 'wechat':
        return 'WeChat Pay';
      case 'alipay':
        return 'Alipay';
      case 'credit_card':
        return 'Credit Card';
      default:
        return paymentMethod;
    }
  }

  /// Get payment status display name
  String get paymentStatusDisplay {
    switch (paymentStatus.toLowerCase()) {
      case 'pending':
        return 'Pending';
      case 'processing':
        return 'Processing';
      case 'completed':
        return 'Completed';
      case 'failed':
        return 'Failed';
      case 'refunded':
        return 'Refunded';
      default:
        return paymentStatus;
    }
  }

  @override
  String toString() {
    return 'VipClubPaymentModel(id: $id, amount: $formattedAmount, status: $paymentStatus)';
  }
}

/// Payment method enum
enum PaymentMethod {
  stripe,
  paypal,
  wechat,
  alipay,
  creditCard,
}

extension PaymentMethodExtension on PaymentMethod {
  String get value {
    switch (this) {
      case PaymentMethod.stripe:
        return 'stripe';
      case PaymentMethod.paypal:
        return 'paypal';
      case PaymentMethod.wechat:
        return 'wechat';
      case PaymentMethod.alipay:
        return 'alipay';
      case PaymentMethod.creditCard:
        return 'credit_card';
    }
  }

  String get displayName {
    switch (this) {
      case PaymentMethod.stripe:
        return 'Credit Card (Stripe)';
      case PaymentMethod.paypal:
        return 'PayPal';
      case PaymentMethod.wechat:
        return 'WeChat Pay';
      case PaymentMethod.alipay:
        return 'Alipay';
      case PaymentMethod.creditCard:
        return 'Credit Card';
    }
  }
}

/// Payment status enum
enum PaymentStatus {
  pending,
  processing,
  completed,
  failed,
  refunded,
}

extension PaymentStatusExtension on PaymentStatus {
  String get value {
    switch (this) {
      case PaymentStatus.pending:
        return 'pending';
      case PaymentStatus.processing:
        return 'processing';
      case PaymentStatus.completed:
        return 'completed';
      case PaymentStatus.failed:
        return 'failed';
      case PaymentStatus.refunded:
        return 'refunded';
    }
  }

  String get displayName {
    switch (this) {
      case PaymentStatus.pending:
        return 'Pending';
      case PaymentStatus.processing:
        return 'Processing';
      case PaymentStatus.completed:
        return 'Completed';
      case PaymentStatus.failed:
        return 'Failed';
      case PaymentStatus.refunded:
        return 'Refunded';
    }
  }
}

/// Receipt model
class VipClubReceiptModel {
  final String id;
  final String paymentId;
  final String userId;
  final double amount;
  final String currency;
  final String paymentMethod;
  final DateTime paidAt;
  final String? bookingId;
  final Map<String, dynamic> details;

  VipClubReceiptModel({
    required this.id,
    required this.paymentId,
    required this.userId,
    required this.amount,
    required this.currency,
    required this.paymentMethod,
    required this.paidAt,
    this.bookingId,
    this.details = const {},
  });

  factory VipClubReceiptModel.fromJson(Map<String, dynamic> json) {
    return VipClubReceiptModel(
      id: json['id']?.toString() ?? '',
      paymentId: json['payment_id']?.toString() ?? json['paymentId']?.toString() ?? '',
      userId: json['user_id']?.toString() ?? json['userId']?.toString() ?? '',
      amount: (json['amount'] ?? 0).toDouble(),
      currency: json['currency']?.toString() ?? 'USD',
      paymentMethod: json['payment_method']?.toString() ??
                     json['paymentMethod']?.toString() ?? '',
      paidAt: json['paid_at'] != null
          ? DateTime.parse(json['paid_at'].toString())
          : json['paidAt'] != null
              ? DateTime.parse(json['paidAt'].toString())
              : DateTime.now(),
      bookingId: json['booking_id']?.toString() ?? json['bookingId']?.toString(),
      details: json['details'] ?? {},
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'payment_id': paymentId,
      'user_id': userId,
      'amount': amount,
      'currency': currency,
      'payment_method': paymentMethod,
      'paid_at': paidAt.toIso8601String(),
      if (bookingId != null) 'booking_id': bookingId,
      'details': details,
    };
  }

  String get formattedAmount {
    final currencySymbols = {
      'USD': '\$',
      'EUR': '€',
      'GBP': '£',
      'CNY': '¥',
      'JPY': '¥',
    };

    final symbol = currencySymbols[currency.toUpperCase()] ?? currency;
    return '$symbol${amount.toStringAsFixed(2)}';
  }

  String get paymentMethodDisplay {
    switch (paymentMethod.toLowerCase()) {
      case 'stripe':
        return 'Credit Card (Stripe)';
      case 'paypal':
        return 'PayPal';
      case 'wechat':
        return 'WeChat Pay';
      case 'alipay':
        return 'Alipay';
      case 'credit_card':
        return 'Credit Card';
      default:
        return paymentMethod;
    }
  }
}
