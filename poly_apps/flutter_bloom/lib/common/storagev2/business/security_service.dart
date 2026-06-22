// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

import 'dart:convert';
import 'dart:math';
import '../models/storage_result.dart';
import '../interfaces/encryption_service_interface.dart';

/// Security service for data protection and validation
class SecurityService {
  final EncryptionService? _encryptionService;
  
  SecurityService({EncryptionService? encryptionService})
      : _encryptionService = encryptionService;
  
  /// Hash a password using simple hash (for demo purposes)
  Future<StorageResult<String>> hashPassword(String password) async {
    try {
      if (password.isEmpty) {
        return StorageError.withCode(
          'INVALID_PASSWORD',
          'Password cannot be empty',
        );
      }
      
      // Simple hash implementation (in production, use proper hashing like bcrypt)
      final bytes = utf8.encode(password);
      final hash = bytes.fold(0, (prev, element) => prev + element);
      final hashedPassword = hash.toString();
      
      return StorageSuccess(hashedPassword);
    } catch (e) {
      return StorageError.fromException(
        e is Exception ? e : Exception(e.toString()),
        message: 'Failed to hash password',
      );
    }
  }
  
  /// Verify password against hash
  Future<StorageResult<bool>> verifyPassword(String password, String hash) async {
    try {
      final hashResult = await hashPassword(password);
      if (hashResult is StorageError) {
        return hashResult;
      }
      
      return StorageSuccess(hashResult.data == hash);
    } catch (e) {
      return StorageError.fromException(
        e is Exception ? e : Exception(e.toString()),
        message: 'Failed to verify password',
      );
    }
  }
  
  /// Generate secure random token
  Future<StorageResult<String>> generateToken({int length = 32}) async {
    try {
      final random = Random.secure();
      const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      final token = List.generate(length, (index) => chars[random.nextInt(chars.length)]).join();
      
      return StorageSuccess(token);
    } catch (e) {
      return StorageError.fromException(
        e is Exception ? e : Exception(e.toString()),
        message: 'Failed to generate token',
      );
    }
  }
  
  /// Encrypt sensitive data
  Future<StorageResult<String>> encryptData(String data) async {
    try {
      if (_encryptionService == null) {
        return StorageError.withCode(
          'ENCRYPTION_NOT_AVAILABLE',
          'Encryption service not available',
        );
      }
      
      return await _encryptionService.encrypt(data);
    } catch (e) {
      return StorageError.fromException(
        e is Exception ? e : Exception(e.toString()),
        message: 'Failed to encrypt data',
      );
    }
  }
  
  /// Decrypt sensitive data
  Future<StorageResult<String>> decryptData(String encryptedData) async {
    try {
      if (_encryptionService == null) {
        return StorageError.withCode(
          'ENCRYPTION_NOT_AVAILABLE',
          'Encryption service not available',
        );
      }
      
      return await _encryptionService.decrypt(encryptedData);
    } catch (e) {
      return StorageError.fromException(
        e is Exception ? e : Exception(e.toString()),
        message: 'Failed to decrypt data',
      );
    }
  }
  
  /// Validate data integrity
  Future<StorageResult<bool>> validateDataIntegrity(String data, String checksum) async {
    try {
      final calculatedChecksum = _calculateChecksum(data);
      return StorageSuccess(calculatedChecksum == checksum);
    } catch (e) {
      return StorageError.fromException(
        e is Exception ? e : Exception(e.toString()),
        message: 'Failed to validate data integrity',
      );
    }
  }
  
  /// Calculate checksum for data
  Future<StorageResult<String>> calculateChecksum(String data) async {
    try {
      final checksum = _calculateChecksum(data);
      return StorageSuccess(checksum);
    } catch (e) {
      return StorageError.fromException(
        e is Exception ? e : Exception(e.toString()),
        message: 'Failed to calculate checksum',
      );
    }
  }
  
  /// Sanitize input data
  Future<StorageResult<String>> sanitizeInput(String input) async {
    try {
      // Remove potentially dangerous characters
      final sanitized = input
          .replaceAll(RegExp(r'''[<>"'\\]'''), '')
          .replaceAll(RegExp(r'[\x00-\x1F\x7F]'), '')
          .trim();
      
      return StorageSuccess(sanitized);
    } catch (e) {
      return StorageError.fromException(
        e is Exception ? e : Exception(e.toString()),
        message: 'Failed to sanitize input',
      );
    }
  }
  
  /// Validate email format
  Future<StorageResult<bool>> validateEmail(String email) async {
    try {
      final emailRegex = RegExp(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$');
      return StorageSuccess(emailRegex.hasMatch(email));
    } catch (e) {
      return StorageError.fromException(
        e is Exception ? e : Exception(e.toString()),
        message: 'Failed to validate email',
      );
    }
  }
  
  /// Validate password strength
  Future<StorageResult<Map<String, dynamic>>> validatePasswordStrength(String password) async {
    try {
      final hasMinLength = password.length >= 8;
      final hasUpperCase = password.contains(RegExp(r'[A-Z]'));
      final hasLowerCase = password.contains(RegExp(r'[a-z]'));
      final hasNumbers = password.contains(RegExp(r'[0-9]'));
      final hasSpecialChar = password.contains(RegExp(r'[!@#$%^&*(),.?":{}|<>]'));
      
      final score = [hasMinLength, hasUpperCase, hasLowerCase, hasNumbers, hasSpecialChar]
          .where((condition) => condition)
          .length;
      
      String strength;
      if (score < 3) {
        strength = 'weak';
      } else if (score < 5) {
        strength = 'medium';
      } else {
        strength = 'strong';
      }
      
      return StorageSuccess({
        'isValid': score >= 3,
        'strength': strength,
        'score': score,
        'requirements': {
          'minLength': hasMinLength,
          'hasUpperCase': hasUpperCase,
          'hasLowerCase': hasLowerCase,
          'hasNumbers': hasNumbers,
          'hasSpecialChar': hasSpecialChar,
        },
      });
    } catch (e) {
      return StorageError.fromException(
        e is Exception ? e : Exception(e.toString()),
        message: 'Failed to validate password strength',
      );
    }
  }
  
  /// Generate secure random bytes
  Future<StorageResult<List<int>>> generateRandomBytes(int length) async {
    try {
      final random = Random.secure();
      final bytes = List.generate(length, (index) => random.nextInt(256));
      return StorageSuccess(bytes);
    } catch (e) {
      return StorageError.fromException(
        e is Exception ? e : Exception(e.toString()),
        message: 'Failed to generate random bytes',
      );
    }
  }
  
  /// Simple checksum calculation
  String _calculateChecksum(String data) {
    final bytes = utf8.encode(data);
    final hash = bytes.fold(0, (prev, element) => prev + element);
    return hash.toRadixString(16);
  }
}
