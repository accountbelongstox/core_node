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

// Migrated from lib/helper/price_converter_helper.dart
// This file provides price conversion utilities for the application

import 'dart:math';

class PriceConverter {
  /// Convert price to formatted string with currency symbol
  static String convertPrice(
    double price, {
    String currencySymbol = '\$',
    int decimalPlaces = 2,
    bool showSymbol = true,
    bool showThousandsSeparator = true,
  }) {
    if (price.isNaN || price.isInfinite) {
      return '${showSymbol ? currencySymbol : ''}0.00';
    }

    final formattedPrice = price.toStringAsFixed(decimalPlaces);
    final parts = formattedPrice.split('.');
    
    String integerPart = parts[0];
    String decimalPart = parts.length > 1 ? parts[1] : '';

    // Add thousands separator
    if (showThousandsSeparator && integerPart.length > 3) {
      integerPart = _addThousandsSeparator(integerPart);
    }

    String result = integerPart;
    if (decimalPlaces > 0 && decimalPart.isNotEmpty) {
      result += '.$decimalPart';
    }

    return showSymbol ? '$currencySymbol$result' : result;
  }

  /// Convert price with different currency formats
  static String convertPriceWithCurrency(
    double price,
    String currencyCode, {
    int decimalPlaces = 2,
    bool showThousandsSeparator = true,
  }) {
    final currencySymbol = getCurrencySymbol(currencyCode);
    return convertPrice(
      price,
      currencySymbol: currencySymbol,
      decimalPlaces: decimalPlaces,
      showThousandsSeparator: showThousandsSeparator,
    );
  }

  /// Get currency symbol from currency code
  static String getCurrencySymbol(String currencyCode) {
    switch (currencyCode.toUpperCase()) {
      case 'USD':
        return '\$';
      case 'EUR':
        return '€';
      case 'GBP':
        return '£';
      case 'JPY':
        return '¥';
      case 'CNY':
        return '¥';
      case 'KRW':
        return '₩';
      case 'INR':
        return '₹';
      case 'RUB':
        return '₽';
      case 'BRL':
        return 'R\$';
      case 'CAD':
        return 'C\$';
      case 'AUD':
        return 'A\$';
      case 'CHF':
        return 'CHF';
      case 'SEK':
        return 'kr';
      case 'NOK':
        return 'kr';
      case 'DKK':
        return 'kr';
      case 'PLN':
        return 'zł';
      case 'CZK':
        return 'Kč';
      case 'HUF':
        return 'Ft';
      case 'TRY':
        return '₺';
      case 'ZAR':
        return 'R';
      case 'MXN':
        return '\$';
      case 'ARS':
        return '\$';
      case 'CLP':
        return '\$';
      case 'COP':
        return '\$';
      case 'PEN':
        return 'S/';
      case 'UYU':
        return '\$U';
      case 'THB':
        return '฿';
      case 'VND':
        return '₫';
      case 'IDR':
        return 'Rp';
      case 'MYR':
        return 'RM';
      case 'SGD':
        return 'S\$';
      case 'PHP':
        return '₱';
      case 'HKD':
        return 'HK\$';
      case 'TWD':
        return 'NT\$';
      case 'NZD':
        return 'NZ\$';
      case 'EGP':
        return 'E£';
      case 'SAR':
        return 'SR';
      case 'AED':
        return 'د.إ';
      case 'QAR':
        return 'QR';
      case 'KWD':
        return 'KD';
      case 'BHD':
        return 'BD';
      case 'OMR':
        return 'RO';
      case 'JOD':
        return 'JD';
      case 'LBP':
        return 'L£';
      case 'ILS':
        return '₪';
      default:
        return currencyCode;
    }
  }

  /// Add thousands separator to number string
  static String _addThousandsSeparator(String number, {String separator = ','}) {
    final reversed = number.split('').reversed.toList();
    final result = <String>[];
    
    for (int i = 0; i < reversed.length; i++) {
      if (i > 0 && i % 3 == 0) {
        result.add(separator);
      }
      result.add(reversed[i]);
    }
    
    return result.reversed.join('');
  }

  /// Convert between currencies (requires exchange rates)
  static double convertCurrency(
    double amount,
    double exchangeRate,
  ) {
    return amount * exchangeRate;
  }

  /// Calculate discount amount
  static double calculateDiscount(
    double originalPrice,
    double discountPercentage,
  ) {
    return originalPrice * (discountPercentage / 100);
  }

  /// Calculate discounted price
  static double calculateDiscountedPrice(
    double originalPrice,
    double discountPercentage,
  ) {
    final discountAmount = calculateDiscount(originalPrice, discountPercentage);
    return originalPrice - discountAmount;
  }

  /// Calculate tax amount
  static double calculateTax(
    double price,
    double taxPercentage,
  ) {
    return price * (taxPercentage / 100);
  }

  /// Calculate price with tax
  static double calculatePriceWithTax(
    double price,
    double taxPercentage,
  ) {
    final taxAmount = calculateTax(price, taxPercentage);
    return price + taxAmount;
  }

  /// Calculate tip amount
  static double calculateTip(
    double billAmount,
    double tipPercentage,
  ) {
    return billAmount * (tipPercentage / 100);
  }

  /// Calculate total with tip
  static double calculateTotalWithTip(
    double billAmount,
    double tipPercentage,
  ) {
    final tipAmount = calculateTip(billAmount, tipPercentage);
    return billAmount + tipAmount;
  }

  /// Round price to nearest cent
  static double roundToNearestCent(double price) {
    return (price * 100).round() / 100;
  }

  /// Round price up to nearest cent
  static double roundUpToNearestCent(double price) {
    return (price * 100).ceil() / 100;
  }

  /// Round price down to nearest cent
  static double roundDownToNearestCent(double price) {
    return (price * 100).floor() / 100;
  }

  /// Format price range
  static String formatPriceRange(
    double minPrice,
    double maxPrice, {
    String currencySymbol = '\$',
    int decimalPlaces = 2,
    String separator = ' - ',
  }) {
    final minFormatted = convertPrice(
      minPrice,
      currencySymbol: currencySymbol,
      decimalPlaces: decimalPlaces,
    );
    final maxFormatted = convertPrice(
      maxPrice,
      currencySymbol: currencySymbol,
      decimalPlaces: decimalPlaces,
    );
    
    return '$minFormatted$separator$maxFormatted';
  }

  /// Parse price from string
  static double? parsePrice(String priceString) {
    if (priceString.isEmpty) return null;
    
    // Remove currency symbols and separators
    String cleanString = priceString
        .replaceAll(RegExp(r'[^\d.,\-]'), '')
        .replaceAll(',', '');
    
    try {
      return double.parse(cleanString);
    } catch (e) {
      return null;
    }
  }

  /// Check if price is valid
  static bool isValidPrice(double price) {
    return !price.isNaN && !price.isInfinite && price >= 0;
  }

  /// Compare prices with tolerance
  static bool arePricesEqual(
    double price1,
    double price2, {
    double tolerance = 0.01,
  }) {
    return (price1 - price2).abs() <= tolerance;
  }

  /// Get price difference
  static double getPriceDifference(double price1, double price2) {
    return price1 - price2;
  }

  /// Get price difference percentage
  static double getPriceDifferencePercentage(double oldPrice, double newPrice) {
    if (oldPrice == 0) return 0;
    return ((newPrice - oldPrice) / oldPrice) * 100;
  }

  /// Format percentage
  static String formatPercentage(
    double percentage, {
    int decimalPlaces = 1,
    bool showSign = false,
  }) {
    final formatted = percentage.toStringAsFixed(decimalPlaces);
    final sign = showSign && percentage > 0 ? '+' : '';
    return '$sign$formatted%';
  }

  /// Calculate compound interest
  static double calculateCompoundInterest(
    double principal,
    double rate,
    int periods,
    int compoundingFrequency,
  ) {
    final ratePerPeriod = rate / compoundingFrequency;
    final totalPeriods = periods * compoundingFrequency;
    return principal * pow(1 + ratePerPeriod, totalPeriods);
  }

  /// Calculate simple interest
  static double calculateSimpleInterest(
    double principal,
    double rate,
    int periods,
  ) {
    return principal * (1 + rate * periods);
  }

  /// Calculate monthly payment for loan
  static double calculateMonthlyPayment(
    double principal,
    double annualRate,
    int months,
  ) {
    if (annualRate == 0) return principal / months;
    
    final monthlyRate = annualRate / 12;
    final numerator = principal * monthlyRate * pow(1 + monthlyRate, months);
    final denominator = pow(1 + monthlyRate, months) - 1;
    
    return numerator / denominator;
  }

  /// Format large numbers with abbreviations
  static String formatLargeNumber(
    double number, {
    int decimalPlaces = 1,
    String currencySymbol = '',
  }) {
    if (number.abs() >= 1000000000) {
      return '$currencySymbol${(number / 1000000000).toStringAsFixed(decimalPlaces)}B';
    } else if (number.abs() >= 1000000) {
      return '$currencySymbol${(number / 1000000).toStringAsFixed(decimalPlaces)}M';
    } else if (number.abs() >= 1000) {
      return '$currencySymbol${(number / 1000).toStringAsFixed(decimalPlaces)}K';
    } else {
      return '$currencySymbol${number.toStringAsFixed(decimalPlaces)}';
    }
  }
}
