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

import 'package:flutter/material.dart';

/// Bank App Gradient Styles
/// 
/// This file contains all gradient styles for the bank application.
/// Gradients are organized by category and follow the naming convention:
/// - bank_[category]_[description]_gradient
/// 
/// USAGE:
/// ```dart
/// Container(
///   decoration: BoxDecoration(
///     gradient: BankGradients.bankFunctionSectionGradient,
///   ),
/// )
/// ```
class BankGradients {
  // Private constructor to prevent instantiation
  BankGradients._();

  // Function Section Gradients
  static const LinearGradient bankFunctionSectionGradient = LinearGradient(
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
    colors: [
      Color(0xFFCCEBFF), // Light blue
      Color(0xFFFFFFFF), // White
    ],
  );

  // Header Background Gradients
  static const LinearGradient bankHeaderGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [
      Color(0xFF1976D2), // Primary blue
      Color(0xFF42A5F5), // Light blue
    ],
  );

  // Card Background Gradients
  static const LinearGradient bankCardGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [
      Color(0xFFF5F5F5), // Light gray
      Color(0xFFFFFFFF), // White
    ],
  );

  // Button Gradients
  static const LinearGradient bankButtonGradient = LinearGradient(
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
    colors: [
      Color(0xFF2196F3), // Blue
      Color(0xFF1976D2), // Darker blue
    ],
  );

  // All gradients list for easy iteration
  static const List<LinearGradient> allGradients = [
    bankFunctionSectionGradient,
    bankHeaderGradient,
    bankCardGradient,
    bankButtonGradient,
  ];

  // Function section specific gradients
  static const List<LinearGradient> functionSectionGradients = [
    bankFunctionSectionGradient,
  ];
}
