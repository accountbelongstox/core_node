// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

class BankCardModel {
  final String cardNumber;
  final String cardType;
  final double balance;
  final String currency;
  final String? cardName;
  final DateTime? openedAt;

  const BankCardModel({
    required this.cardNumber,
    required this.cardType,
    required this.balance,
    this.currency = 'CNY',
    this.cardName,
    this.openedAt,
  });

  String get maskedCardNumber {
    if (cardNumber.length <= 4) return cardNumber;
    final lastFour = cardNumber.substring(cardNumber.length - 4);
    return '**** **** **** $lastFour';
  }

  String get formattedBalance {
    return '¥ ${balance.toStringAsFixed(2)}';
  }

  Map<String, dynamic> toMap() {
    return {
      'card_number': cardNumber,
      'card_type': cardType,
      'balance': balance,
      'currency': currency,
      'card_name': cardName,
      'opened_at': openedAt?.toIso8601String(),
    };
  }

  factory BankCardModel.fromMap(Map<String, dynamic> map) {
    return BankCardModel(
      cardNumber: map['card_number']?.toString() ?? '',
      cardType: map['card_type']?.toString() ?? '',
      balance:
          map['balance'] != null ? (map['balance'] as num).toDouble() : 0.0,
      currency: map['currency']?.toString() ?? 'CNY',
      cardName: map['card_name']?.toString(),
      openedAt: map['opened_at'] != null && map['opened_at'] != 'null'
          ? DateTime.tryParse(map['opened_at'].toString())
          : null,
    );
  }

  BankCardModel copyWith({
    String? cardNumber,
    String? cardType,
    double? balance,
    String? currency,
    String? cardName,
    DateTime? openedAt,
  }) {
    return BankCardModel(
      cardNumber: cardNumber ?? this.cardNumber,
      cardType: cardType ?? this.cardType,
      balance: balance ?? this.balance,
      currency: currency ?? this.currency,
      cardName: cardName ?? this.cardName,
      openedAt: openedAt ?? this.openedAt,
    );
  }
}
