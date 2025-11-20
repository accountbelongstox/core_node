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

// Migrated from lib/helper/email_checker_helper.dart
// This file provides email validation utilities for the application

class EmailChecker {
  static const String _emailPattern = 
      r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$';
  
  static final RegExp _emailRegExp = RegExp(_emailPattern);

  /// Check if email is valid
  static bool isValidEmail(String email) {
    if (email.isEmpty) return false;
    return _emailRegExp.hasMatch(email.trim());
  }

  /// Validate email and return error message if invalid
  static String? validateEmail(String email) {
    if (email.isEmpty) {
      return 'Email is required';
    }
    
    if (!isValidEmail(email)) {
      return 'Please enter a valid email address';
    }
    
    return null;
  }

  /// Check if email domain is valid
  static bool isValidDomain(String email) {
    if (!isValidEmail(email)) return false;
    
    final domain = email.split('@').last;
    return domain.contains('.') && domain.length > 3;
  }

  /// Extract domain from email
  static String? getDomain(String email) {
    if (!isValidEmail(email)) return null;
    return email.split('@').last;
  }

  /// Extract username from email
  static String? getUsername(String email) {
    if (!isValidEmail(email)) return null;
    return email.split('@').first;
  }

  /// Check if email is from a specific domain
  static bool isFromDomain(String email, String domain) {
    final emailDomain = getDomain(email);
    return emailDomain?.toLowerCase() == domain.toLowerCase();
  }

  /// Check if email is from common email providers
  static bool isFromCommonProvider(String email) {
    final commonProviders = [
      'gmail.com',
      'yahoo.com',
      'hotmail.com',
      'outlook.com',
      'icloud.com',
      'aol.com',
      'live.com',
      'msn.com',
    ];
    
    final domain = getDomain(email);
    if (domain == null) return false;
    
    return commonProviders.contains(domain.toLowerCase());
  }

  /// Normalize email (lowercase and trim)
  static String normalizeEmail(String email) {
    return email.trim().toLowerCase();
  }

  /// Check if email contains suspicious patterns
  static bool isSuspicious(String email) {
    if (!isValidEmail(email)) return true;
    
    final suspiciousPatterns = [
      RegExp(r'[0-9]{10,}'), // Too many consecutive numbers
      RegExp(r'[a-zA-Z]{1}[0-9]{8,}'), // Single letter followed by many numbers
      RegExp(r'\.{2,}'), // Multiple consecutive dots
      RegExp(r'[+]{2,}'), // Multiple consecutive plus signs
    ];
    
    return suspiciousPatterns.any((pattern) => pattern.hasMatch(email));
  }

  /// Generate email suggestions for typos
  static List<String> getSuggestions(String email) {
    if (isValidEmail(email)) return [];
    
    final suggestions = <String>[];
    final commonDomains = [
      'gmail.com',
      'yahoo.com',
      'hotmail.com',
      'outlook.com',
    ];
    
    if (email.contains('@')) {
      final parts = email.split('@');
      if (parts.length == 2) {
        final username = parts[0];
        final domain = parts[1];
        
        // Suggest common domains if domain is close
        for (final commonDomain in commonDomains) {
          if (_isCloseString(domain, commonDomain)) {
            suggestions.add('$username@$commonDomain');
          }
        }
      }
    }
    
    return suggestions;
  }

  /// Check if two strings are similar (simple Levenshtein-like check)
  static bool _isCloseString(String s1, String s2) {
    if ((s1.length - s2.length).abs() > 2) return false;
    
    int differences = 0;
    final minLength = s1.length < s2.length ? s1.length : s2.length;
    
    for (int i = 0; i < minLength; i++) {
      if (s1[i] != s2[i]) {
        differences++;
        if (differences > 2) return false;
      }
    }
    
    return differences <= 2;
  }

  /// Validate multiple emails
  static Map<String, bool> validateMultipleEmails(List<String> emails) {
    final results = <String, bool>{};
    for (final email in emails) {
      results[email] = isValidEmail(email);
    }
    return results;
  }

  /// Check if email list contains duplicates
  static bool hasDuplicates(List<String> emails) {
    final normalizedEmails = emails.map(normalizeEmail).toSet();
    return normalizedEmails.length != emails.length;
  }

  /// Remove duplicate emails from list
  static List<String> removeDuplicates(List<String> emails) {
    final seen = <String>{};
    final result = <String>[];
    
    for (final email in emails) {
      final normalized = normalizeEmail(email);
      if (!seen.contains(normalized)) {
        seen.add(normalized);
        result.add(email);
      }
    }
    
    return result;
  }

  /// Filter valid emails from a list
  static List<String> filterValidEmails(List<String> emails) {
    return emails.where(isValidEmail).toList();
  }

  /// Check if email matches a pattern
  static bool matchesPattern(String email, String pattern) {
    try {
      final regExp = RegExp(pattern);
      return regExp.hasMatch(email);
    } catch (e) {
      return false;
    }
  }
}
