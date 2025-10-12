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

/// Phone number validation utilities for the application
class PhoneChecker {
  // Chinese mobile phone number pattern
  static const String _chineseMobilePattern = r'^1[3-9]\d{9}$';
  
  // International phone number pattern (basic)
  static const String _internationalPattern = r'^\+?[1-9]\d{1,14}$';
  
  static final RegExp _chineseMobileRegExp = RegExp(_chineseMobilePattern);
  static final RegExp _internationalRegExp = RegExp(_internationalPattern);

  /// Check if phone number is valid (Chinese mobile)
  static bool isValidChineseMobile(String phone) {
    if (phone.isEmpty) return false;
    final cleanPhone = _cleanPhoneNumber(phone);
    return _chineseMobileRegExp.hasMatch(cleanPhone);
  }

  /// Check if phone number is valid (international)
  static bool isValidInternational(String phone) {
    if (phone.isEmpty) return false;
    final cleanPhone = _cleanPhoneNumber(phone);
    return _internationalRegExp.hasMatch(cleanPhone);
  }

  /// Check if phone number is valid (any format)
  static bool isValidPhone(String phone) {
    return isValidChineseMobile(phone) || isValidInternational(phone);
  }

  /// Validate phone number and return error message if invalid
  static String? validatePhone(String phone) {
    if (phone.isEmpty) {
      return 'Phone number is required';
    }
    
    if (!isValidPhone(phone)) {
      return 'Please enter a valid phone number';
    }
    
    return null;
  }

  /// Clean phone number (remove spaces, dashes, parentheses)
  static String _cleanPhoneNumber(String phone) {
    return phone.replaceAll(RegExp(r'[\s\-\(\)]'), '');
  }

  /// Format phone number for display
  static String formatPhone(String phone) {
    final cleanPhone = _cleanPhoneNumber(phone);
    
    if (isValidChineseMobile(cleanPhone)) {
      // Format Chinese mobile: 138****8888
      if (cleanPhone.length == 11) {
        return '${cleanPhone.substring(0, 3)}****${cleanPhone.substring(7)}';
      }
    }
    
    return cleanPhone;
  }

  /// Get phone number type
  static PhoneType getPhoneType(String phone) {
    final cleanPhone = _cleanPhoneNumber(phone);
    
    if (isValidChineseMobile(cleanPhone)) {
      return PhoneType.chineseMobile;
    } else if (isValidInternational(cleanPhone)) {
      return PhoneType.international;
    } else {
      return PhoneType.invalid;
    }
  }

  /// Check if phone number is from specific carrier (Chinese)
  static bool isFromCarrier(String phone, ChineseCarrier carrier) {
    if (!isValidChineseMobile(phone)) return false;
    
    final cleanPhone = _cleanPhoneNumber(phone);
    final prefix = cleanPhone.substring(0, 3);
    
    switch (carrier) {
      case ChineseCarrier.chinaMobile:
        return ['134', '135', '136', '137', '138', '139', '150', '151', '152', '157', '158', '159', '182', '183', '184', '187', '188', '198'].contains(prefix);
      case ChineseCarrier.chinaUnicom:
        return ['130', '131', '132', '155', '156', '185', '186', '176'].contains(prefix);
      case ChineseCarrier.chinaTelecom:
        return ['133', '153', '180', '181', '189', '177'].contains(prefix);
      case ChineseCarrier.chinaBroadcast:
        return ['192'].contains(prefix);
      case ChineseCarrier.virtual:
        return ['170', '171'].contains(prefix);
    }
  }

  /// Normalize phone number
  static String normalizePhone(String phone) {
    return _cleanPhoneNumber(phone);
  }

  /// Check if phone number contains suspicious patterns
  static bool isSuspicious(String phone) {
    if (!isValidPhone(phone)) return true;
    
    final cleanPhone = _cleanPhoneNumber(phone);
    
    // Check for repeated digits
    if (RegExp(r'(\d)\1{4,}').hasMatch(cleanPhone)) {
      return true;
    }
    
    // Check for sequential digits
    if (_isSequential(cleanPhone)) {
      return true;
    }
    
    return false;
  }

  /// Check if phone number has sequential digits
  static bool _isSequential(String phone) {
    if (phone.length < 4) return false;
    
    for (int i = 0; i < phone.length - 3; i++) {
      final digits = phone.substring(i, i + 4);
      if (_isDigitSequence(digits)) {
        return true;
      }
    }
    
    return false;
  }

  /// Check if 4 digits form a sequence
  static bool _isDigitSequence(String digits) {
    if (digits.length != 4) return false;
    
    final nums = digits.split('').map(int.parse).toList();
    
    // Check ascending sequence
    bool ascending = true;
    for (int i = 1; i < nums.length; i++) {
      if (nums[i] != nums[i-1] + 1) {
        ascending = false;
        break;
      }
    }
    
    // Check descending sequence
    bool descending = true;
    for (int i = 1; i < nums.length; i++) {
      if (nums[i] != nums[i-1] - 1) {
        descending = false;
        break;
      }
    }
    
    return ascending || descending;
  }

  /// Validate multiple phone numbers
  static Map<String, bool> validateMultiplePhones(List<String> phones) {
    final results = <String, bool>{};
    for (final phone in phones) {
      results[phone] = isValidPhone(phone);
    }
    return results;
  }

  /// Check if phone list contains duplicates
  static bool hasDuplicates(List<String> phones) {
    final normalizedPhones = phones.map(normalizePhone).toSet();
    return normalizedPhones.length != phones.length;
  }

  /// Remove duplicate phones from list
  static List<String> removeDuplicates(List<String> phones) {
    final seen = <String>{};
    final result = <String>[];
    
    for (final phone in phones) {
      final normalized = normalizePhone(phone);
      if (!seen.contains(normalized)) {
        seen.add(normalized);
        result.add(phone);
      }
    }
    
    return result;
  }

  /// Filter valid phones from a list
  static List<String> filterValidPhones(List<String> phones) {
    return phones.where(isValidPhone).toList();
  }

  /// Generate phone suggestions for typos
  static List<String> getSuggestions(String phone) {
    if (isValidPhone(phone)) return [];
    
    final suggestions = <String>[];
    final cleanPhone = _cleanPhoneNumber(phone);
    
    // If it's close to a valid Chinese mobile number
    if (cleanPhone.length >= 10 && cleanPhone.length <= 12) {
      if (cleanPhone.startsWith('1') && cleanPhone.length == 10) {
        // Missing one digit
        suggestions.add('1$cleanPhone');
      } else if (cleanPhone.startsWith('1') && cleanPhone.length == 12) {
        // Extra digit
        suggestions.add(cleanPhone.substring(0, 11));
      }
    }
    
    return suggestions;
  }
}

/// Phone number types
enum PhoneType {
  chineseMobile,
  international,
  invalid,
}

/// Chinese mobile carriers
enum ChineseCarrier {
  chinaMobile,
  chinaUnicom,
  chinaTelecom,
  chinaBroadcast,
  virtual,
}
