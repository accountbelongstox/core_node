import 'package:flutter/material.dart';

enum CardType { debit, credit }

class BankCard {
  final String cardNumber;
  final String cardHolder;
  final String expiryDate;
  final CardType cardType;
  final String bank;
  final double balance;
  final double? creditLimit;
  final List<Color> gradient;
  bool isActive;

  BankCard({
    required this.cardNumber,
    required this.cardHolder,
    required this.expiryDate,
    required this.cardType,
    required this.bank,
    required this.balance,
    this.creditLimit,
    required this.gradient,
    this.isActive = true,
  });
}
