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

// Text processing utilities for the application

class TextUtils {
  /// Check if string is null or empty
  static bool isEmpty(String? text) {
    return text == null || text.isEmpty;
  }

  /// Check if string is not null and not empty
  static bool isNotEmpty(String? text) {
    return text != null && text.isNotEmpty;
  }

  /// Check if string is null, empty, or only whitespace
  static bool isBlank(String? text) {
    return text == null || text.trim().isEmpty;
  }

  /// Check if string is not blank
  static bool isNotBlank(String? text) {
    return text != null && text.trim().isNotEmpty;
  }

  /// Capitalize first letter of string
  static String capitalize(String text) {
    if (isEmpty(text)) return text;
    return text[0].toUpperCase() + text.substring(1).toLowerCase();
  }

  /// Capitalize first letter of each word
  static String capitalizeWords(String text) {
    if (isEmpty(text)) return text;
    return text.split(' ').map(capitalize).join(' ');
  }

  /// Convert to camelCase
  static String toCamelCase(String text) {
    if (isEmpty(text)) return text;
    final words = text.split(RegExp(r'[\s_-]+'));
    if (words.isEmpty) return text;
    
    final first = words.first.toLowerCase();
    final rest = words.skip(1).map(capitalize);
    return first + rest.join('');
  }

  /// Convert to PascalCase
  static String toPascalCase(String text) {
    if (isEmpty(text)) return text;
    return text.split(RegExp(r'[\s_-]+'))
        .map(capitalize)
        .join('');
  }

  /// Convert to snake_case
  static String toSnakeCase(String text) {
    if (isEmpty(text)) return text;
    return text
        .replaceAllMapped(RegExp(r'[A-Z]'), (match) => '_${match.group(0)!.toLowerCase()}')
        .replaceAll(RegExp(r'[\s-]+'), '_')
        .replaceAll(RegExp(r'^_'), '')
        .toLowerCase();
  }

  /// Convert to kebab-case
  static String toKebabCase(String text) {
    if (isEmpty(text)) return text;
    return text
        .replaceAllMapped(RegExp(r'[A-Z]'), (match) => '-${match.group(0)!.toLowerCase()}')
        .replaceAll(RegExp(r'[\s_]+'), '-')
        .replaceAll(RegExp(r'^-'), '')
        .toLowerCase();
  }

  /// Truncate string to specified length
  static String truncate(String text, int maxLength, {String suffix = '...'}) {
    if (isEmpty(text) || text.length <= maxLength) return text;
    return text.substring(0, maxLength - suffix.length) + suffix;
  }

  /// Truncate string by words
  static String truncateWords(String text, int maxWords, {String suffix = '...'}) {
    if (isEmpty(text)) return text;
    final words = text.split(' ');
    if (words.length <= maxWords) return text;
    return words.take(maxWords).join(' ') + suffix;
  }

  /// Remove extra whitespace
  static String cleanWhitespace(String text) {
    if (isEmpty(text)) return text;
    return text.replaceAll(RegExp(r'\s+'), ' ').trim();
  }

  /// Remove all whitespace
  static String removeWhitespace(String text) {
    if (isEmpty(text)) return text;
    return text.replaceAll(RegExp(r'\s'), '');
  }

  /// Count words in text
  static int countWords(String text) {
    if (isEmpty(text)) return 0;
    return text.trim().split(RegExp(r'\s+')).length;
  }

  /// Count characters (excluding whitespace)
  static int countCharacters(String text, {bool includeSpaces = true}) {
    if (isEmpty(text)) return 0;
    return includeSpaces ? text.length : removeWhitespace(text).length;
  }

  /// Count lines in text
  static int countLines(String text) {
    if (isEmpty(text)) return 0;
    return text.split('\n').length;
  }

  /// Extract numbers from text
  static List<String> extractNumbers(String text) {
    if (isEmpty(text)) return [];
    return RegExp(r'\d+').allMatches(text)
        .map((match) => match.group(0)!)
        .toList();
  }

  /// Extract emails from text
  static List<String> extractEmails(String text) {
    if (isEmpty(text)) return [];
    final emailRegex = RegExp(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b');
    return emailRegex.allMatches(text)
        .map((match) => match.group(0)!)
        .toList();
  }

  /// Extract URLs from text
  static List<String> extractUrls(String text) {
    if (isEmpty(text)) return [];
    final urlRegex = RegExp(r'https?://[^\s]+');
    return urlRegex.allMatches(text)
        .map((match) => match.group(0)!)
        .toList();
  }

  /// Extract phone numbers from text
  static List<String> extractPhoneNumbers(String text) {
    if (isEmpty(text)) return [];
    final phoneRegex = RegExp(r'[\+]?[1-9]?[\d\s\-\(\)]{7,15}');
    return phoneRegex.allMatches(text)
        .map((match) => match.group(0)!)
        .toList();
  }

  /// Check if text contains only letters
  static bool isAlpha(String text) {
    if (isEmpty(text)) return false;
    return RegExp(r'^[a-zA-Z]+$').hasMatch(text);
  }

  /// Check if text contains only numbers
  static bool isNumeric(String text) {
    if (isEmpty(text)) return false;
    return RegExp(r'^[0-9]+$').hasMatch(text);
  }

  /// Check if text contains only letters and numbers
  static bool isAlphanumeric(String text) {
    if (isEmpty(text)) return false;
    return RegExp(r'^[a-zA-Z0-9]+$').hasMatch(text);
  }

  /// Check if text is a valid email
  static bool isEmail(String text) {
    if (isEmpty(text)) return false;
    return RegExp(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$').hasMatch(text);
  }

  /// Check if text is a valid URL
  static bool isUrl(String text) {
    if (isEmpty(text)) return false;
    return RegExp(r'^https?://[^\s]+$').hasMatch(text);
  }

  /// Check if text is a valid phone number
  static bool isPhoneNumber(String text) {
    if (isEmpty(text)) return false;
    return RegExp(r'^[\+]?[1-9]?[\d\s\-\(\)]{7,15}$').hasMatch(text);
  }

  /// Remove HTML tags from text
  static String removeHtmlTags(String text) {
    if (isEmpty(text)) return text;
    return text.replaceAll(RegExp(r'<[^>]*>'), '');
  }

  /// Escape HTML characters
  static String escapeHtml(String text) {
    if (isEmpty(text)) return text;
    return text
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#x27;');
  }

  /// Unescape HTML characters
  static String unescapeHtml(String text) {
    if (isEmpty(text)) return text;
    return text
        .replaceAll('&amp;', '&')
        .replaceAll('&lt;', '<')
        .replaceAll('&gt;', '>')
        .replaceAll('&quot;', '"')
        .replaceAll('&#x27;', "'");
  }

  /// Generate random string
  static String generateRandomString(int length, {bool includeNumbers = true, bool includeSymbols = false}) {
    const letters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const numbers = '0123456789';
    const symbols = '!@#\$%^&*()_+-=[]{}|;:,.<>?';
    
    String chars = letters;
    if (includeNumbers) chars += numbers;
    if (includeSymbols) chars += symbols;
    
    final random = DateTime.now().millisecondsSinceEpoch;
    String result = '';
    
    for (int i = 0; i < length; i++) {
      result += chars[(random + i) % chars.length];
    }
    
    return result;
  }

  /// Calculate Levenshtein distance between two strings
  static int levenshteinDistance(String s1, String s2) {
    if (s1 == s2) return 0;
    if (s1.isEmpty) return s2.length;
    if (s2.isEmpty) return s1.length;
    
    final matrix = List.generate(s1.length + 1, 
        (i) => List.generate(s2.length + 1, (j) => 0));
    
    for (int i = 0; i <= s1.length; i++) {
      matrix[i][0] = i;
    }
    
    for (int j = 0; j <= s2.length; j++) {
      matrix[0][j] = j;
    }
    
    for (int i = 1; i <= s1.length; i++) {
      for (int j = 1; j <= s2.length; j++) {
        final cost = s1[i - 1] == s2[j - 1] ? 0 : 1;
        matrix[i][j] = [
          matrix[i - 1][j] + 1,      // deletion
          matrix[i][j - 1] + 1,      // insertion
          matrix[i - 1][j - 1] + cost // substitution
        ].reduce((a, b) => a < b ? a : b);
      }
    }
    
    return matrix[s1.length][s2.length];
  }

  /// Calculate similarity percentage between two strings
  static double similarity(String s1, String s2) {
    if (s1 == s2) return 1.0;
    if (s1.isEmpty || s2.isEmpty) return 0.0;
    
    final distance = levenshteinDistance(s1, s2);
    final maxLength = s1.length > s2.length ? s1.length : s2.length;
    
    return 1.0 - (distance / maxLength);
  }

  /// Check if strings are similar (above threshold)
  static bool areSimilar(String s1, String s2, {double threshold = 0.8}) {
    return similarity(s1, s2) >= threshold;
  }

  /// Reverse string
  static String reverse(String text) {
    if (isEmpty(text)) return text;
    return text.split('').reversed.join('');
  }

  /// Check if string is palindrome
  static bool isPalindrome(String text) {
    if (isEmpty(text)) return false;
    final cleaned = text.toLowerCase().replaceAll(RegExp(r'[^a-z0-9]'), '');
    return cleaned == reverse(cleaned);
  }

  /// Mask string (e.g., for passwords or sensitive data)
  static String mask(String text, {String maskChar = '*', int visibleStart = 0, int visibleEnd = 0}) {
    if (isEmpty(text)) return text;
    if (visibleStart + visibleEnd >= text.length) return text;
    
    final start = text.substring(0, visibleStart);
    final end = text.substring(text.length - visibleEnd);
    final middle = maskChar * (text.length - visibleStart - visibleEnd);
    
    return start + middle + end;
  }

  /// Format text as initials
  static String getInitials(String text, {int maxInitials = 2}) {
    if (isEmpty(text)) return '';
    final words = text.trim().split(RegExp(r'\s+'));
    return words
        .take(maxInitials)
        .map((word) => word.isNotEmpty ? word[0].toUpperCase() : '')
        .join('');
  }

  /// Wrap text to specified line length
  static String wrapText(String text, int lineLength) {
    if (isEmpty(text) || lineLength <= 0) return text;
    
    final words = text.split(' ');
    final lines = <String>[];
    String currentLine = '';
    
    for (final word in words) {
      if (currentLine.isEmpty) {
        currentLine = word;
      } else if (currentLine.length + word.length + 1 <= lineLength) {
        currentLine += ' $word';
      } else {
        lines.add(currentLine);
        currentLine = word;
      }
    }
    
    if (currentLine.isNotEmpty) {
      lines.add(currentLine);
    }
    
    return lines.join('\n');
  }
}
