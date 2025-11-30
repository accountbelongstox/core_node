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

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../config_app_bank/constants.dart';
import '../features_app_bank/splash/views/splash_screen.dart';
import '../features_app_bank/onboarding/views/onboarding_screen.dart';
import '../features_app_bank/authentication/views/authentication_screen.dart';
import '../features_app_bank/dashboard/views/dashboard_screen.dart';
import '../features_app_bank/account_overview/views/account_overview_screen.dart';
import '../features_app_bank/transfer/views/transfer_screen.dart';
import '../features_app_bank/payment/views/payment_screen.dart';
import '../features_app_bank/transaction_history/views/transaction_history_screen.dart';
import '../features_app_bank/card_management/views/card_management_screen.dart';
import '../features_app_bank/investment/views/investment_screen.dart';
import '../features_app_bank/loan/views/loan_screen.dart';
import '../features_app_bank/security/views/security_screen.dart';
import '../features_app_bank/profile/views/profile_screen.dart';
import '../features_app_bank/help/views/help_screen.dart';
import '../features_app_bank/life/views/life_screen.dart';
import '../features_app_bank/settings/views/settings_screen.dart';
import '../features_app_bank/debug/views/exclusive_customer_screen.dart';
import '../features_app_bank/debug/views/debug_settings_screen.dart';
import '../features_app_bank/debug/views/developer_feedback_screen.dart';
import '../features_app_bank/debug/views/developer_tools_screen.dart';

/// Bank App Router Configuration
/// Defines all routes and navigation for the Bank application
class BankAppRouter {
  static const String routeHome = BankConstants.routeDashboard;
  static const String routeSplash = BankConstants.routeSplash;
  static const String routeOnboarding = BankConstants.routeOnboarding;
  static const String routeAuthentication = BankConstants.routeAuthentication;
  static const String routeDashboard = BankConstants.routeDashboard;
  static const String routeAccountOverview = BankConstants.routeAccountOverview;
  static const String routeTransfer = BankConstants.routeTransfer;
  static const String routePayment = BankConstants.routePayment;
  static const String routeTransactionHistory = BankConstants.routeTransactionHistory;
  static const String routeCardManagement = BankConstants.routeCardManagement;
  static const String routeInvestment = BankConstants.routeInvestment;
  static const String routeLoan = BankConstants.routeLoan;
  static const String routeSecurity = BankConstants.routeSecurity;
  static const String routeProfile = BankConstants.routeProfile;
  static const String routeHelp = BankConstants.routeHelp;
  static const String routeLife = BankConstants.routeLife;
  static const String routeSettings = BankConstants.routeSettings;
  static const String routeExclusiveCustomer = BankConstants.routeExclusiveCustomer;
  static const String routeDebugSettings = BankConstants.routeDebugSettings;
  static const String routeDeveloperFeedback = BankConstants.routeDeveloperFeedback;
  static const String routeDeveloperTools = BankConstants.routeDeveloperTools;

  /// Get all route paths for debugging/validation
  static List<String> getAllRoutePaths() {
    return [
      routeSplash,
      routeOnboarding,
      routeAuthentication,
      routeDashboard,
      routeAccountOverview,
      routeTransfer,
      routePayment,
      routeTransactionHistory,
      routeCardManagement,
      routeInvestment,
      routeLoan,
      routeSecurity,
      routeProfile,
      routeHelp,
    ];
  }

  /// Get route display names for debugging/showcase
  static Map<String, String> getRouteDisplayNames() {
    return {
      routeSplash: 'Bank Splash',
      routeOnboarding: 'Bank Onboarding',
      routeAuthentication: 'Bank Authentication',
      routeDashboard: 'Bank Dashboard',
      routeAccountOverview: 'Account Overview',
      routeTransfer: 'Transfer Money',
      routePayment: 'Make Payment',
      routeTransactionHistory: 'Transaction History',
      routeCardManagement: 'Card Management',
      routeInvestment: 'Investment',
      routeLoan: 'Loan Services',
      routeSecurity: 'Security Settings',
      routeProfile: 'Profile',
      routeHelp: 'Help & Support',
    };
  }

  /// Get app router information
  static Map<String, dynamic> getRouterInfo() {
    return {
      'appId': 'bank',
      'appName': 'Bank',
      'namespace': '/bank',
      'defaultRoute': routeDashboard,
      'homeRoute': routeDashboard,
      'totalRoutes': getAllRoutePaths().length,
      'routePaths': getAllRoutePaths(),
      'routeNames': getRouteDisplayNames(),
    };
  }

  /// Validate if a route path exists
  static bool isValidRoute(String path) {
    return getAllRoutePaths().contains(path);
  }

  /// Get default route for app initialization
  static String getDefaultRoute() => routeDashboard;
  
  /// Get home route for navigation
  static String getHomeRoute() => routeDashboard;

  /// Creates and returns the GoRouter instance for Bank app
  static GoRouter createRouter() {
    return GoRouter(
      initialLocation: routeDashboard,
      routes: [
        // Splash Screen
        GoRoute(
          path: routeSplash,
          name: 'bank_splash',
          builder: (context, state) => const BankSplashScreen(),
        ),

        // Onboarding Screen
        GoRoute(
          path: routeOnboarding,
          name: 'bank_onboarding',
          builder: (context, state) => const BankOnboardingScreen(),
        ),

        // Authentication Screen
        GoRoute(
          path: routeAuthentication,
          name: 'bank_authentication',
          builder: (context, state) => const BankAuthenticationScreen(),
        ),

        // Dashboard Screen (Main Home)
        GoRoute(
          path: routeDashboard,
          name: 'bank_dashboard',
          builder: (context, state) => const BankDashboardScreen(),
        ),

        // Account Overview Screen
        GoRoute(
          path: routeAccountOverview,
          name: 'bank_account_overview',
          builder: (context, state) => const BankAccountOverviewScreen(),
        ),

        // Transfer Screen
        GoRoute(
          path: routeTransfer,
          name: 'bank_transfer',
          builder: (context, state) => const BankTransferScreen(),
        ),

        // Payment Screen
        GoRoute(
          path: routePayment,
          name: 'bank_payment',
          builder: (context, state) => const BankPaymentScreen(),
        ),

        // Transaction History Screen
        GoRoute(
          path: routeTransactionHistory,
          name: 'bank_transaction_history',
          builder: (context, state) => const BankTransactionHistoryScreen(),
        ),

        // Card Management Screen
        GoRoute(
          path: routeCardManagement,
          name: 'bank_card_management',
          builder: (context, state) => const BankCardManagementScreen(),
        ),

        // Investment Screen
        GoRoute(
          path: routeInvestment,
          name: 'bank_investment',
          builder: (context, state) => const BankInvestmentScreen(),
        ),

        // Loan Screen
        GoRoute(
          path: routeLoan,
          name: 'bank_loan',
          builder: (context, state) => const BankLoanScreen(),
        ),

        // Security Screen
        GoRoute(
          path: routeSecurity,
          name: 'bank_security',
          builder: (context, state) => const BankSecurityScreen(),
        ),

        // Profile Screen
        GoRoute(
          path: routeProfile,
          name: 'bank_profile',
          builder: (context, state) => const BankProfileScreen(),
        ),

        // Life Services Screen
        GoRoute(
          path: routeLife,
          name: 'bank_life',
          builder: (context, state) => const BankLifeScreen(),
        ),

        // Help Screen
        GoRoute(
          path: routeHelp,
          name: 'bank_help',
          builder: (context, state) => const BankHelpScreen(),
        ),

        // Settings Screen
        GoRoute(
          path: routeSettings,
          name: 'bank_settings',
          builder: (context, state) => const SettingsScreen(),
        ),

        // Exclusive Customer Screen
        GoRoute(
          path: routeExclusiveCustomer,
          name: 'bank_exclusive_customer',
          builder: (context, state) => const ExclusiveCustomerScreen(),
        ),

        // Debug Settings Screen
        GoRoute(
          path: routeDebugSettings,
          name: 'bank_debug_settings',
          builder: (context, state) => const DebugSettingsScreen(),
        ),

        // Developer Feedback Screen
        GoRoute(
          path: routeDeveloperFeedback,
          name: 'bank_developer_feedback',
          builder: (context, state) => const DeveloperFeedbackScreen(),
        ),

        // Developer Tools Screen
        GoRoute(
          path: routeDeveloperTools,
          name: 'bank_developer_tools',
          builder: (context, state) => const DeveloperToolsScreen(),
        ),
      ],
      errorBuilder: (context, state) => Scaffold(
        appBar: AppBar(
          title: const Text('Page Not Found'),
        ),
        body: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(
                Icons.error_outline,
                size: 64,
                color: Colors.red,
              ),
              const SizedBox(height: 16),
              Text(
                'Page not found: ${state.matchedLocation}',
                style: const TextStyle(fontSize: 18),
              ),
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: () => context.go(routeDashboard),
                child: const Text('Go to Dashboard'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}