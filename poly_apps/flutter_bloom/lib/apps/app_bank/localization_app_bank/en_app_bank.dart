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

import 'localization_keys_app_bank.dart';

/// English localization for Bank App
class EnAppBank {
  static const Map<String, String> locales = {
    // App Title and Branding
    BankLocalizationKeys.bankAppName: 'Flutter Bank',
    BankLocalizationKeys.bankAppTagline: 'Your Trusted Financial Partner',
    BankLocalizationKeys.bankWelcomeMessage: 'Good Morning',

    // Authentication
    BankLocalizationKeys.bankLogin: 'Login',
    BankLocalizationKeys.bankRegister: 'Register',
    BankLocalizationKeys.bankEmail: 'Email',
    BankLocalizationKeys.bankPassword: 'Password',
    BankLocalizationKeys.bankConfirmPassword: 'Confirm Password',
    BankLocalizationKeys.bankFirstName: 'First Name',
    BankLocalizationKeys.bankLastName: 'Last Name',
    BankLocalizationKeys.bankForgotPassword: 'Forgot Password?',
    BankLocalizationKeys.bankBiometricLogin: 'Login with Biometrics',

    // Dashboard
    BankLocalizationKeys.bankDashboard: 'Dashboard',
    BankLocalizationKeys.bankTotalBalance: 'Total Balance',
    BankLocalizationKeys.bankChecking: 'Checking',
    BankLocalizationKeys.bankSavings: 'Savings',
    BankLocalizationKeys.bankQuickActions: 'Quick Actions',
    BankLocalizationKeys.bankRecentTransactions: 'Recent Transactions',

    // Navigation
    BankLocalizationKeys.bankHome: 'Home',
    BankLocalizationKeys.bankAccounts: 'Accounts',
    BankLocalizationKeys.bankTransfer: 'Transfer',
    BankLocalizationKeys.bankPayment: 'Pay Bills',
    BankLocalizationKeys.bankCards: 'Cards',
    BankLocalizationKeys.bankInvestment: 'Invest',
    BankLocalizationKeys.bankLoan: 'Loans',
    BankLocalizationKeys.bankSecurity: 'Security',
    BankLocalizationKeys.bankProfile: 'Profile',
    BankLocalizationKeys.bankHelp: 'Help',
    BankLocalizationKeys.bankHistory: 'History',

    // Transaction Types
    BankLocalizationKeys.bankTransactionTypeCredit: 'Credit',
    BankLocalizationKeys.bankTransactionTypeDebit: 'Debit',
    BankLocalizationKeys.bankTransactionTypeTransfer: 'Transfer',
    BankLocalizationKeys.bankTransactionTypePayment: 'Payment',

    // Common Actions
    BankLocalizationKeys.bankSend: 'Send',
    BankLocalizationKeys.bankReceive: 'Receive',
    BankLocalizationKeys.bankNext: 'Next',
    BankLocalizationKeys.bankBack: 'Back',
    BankLocalizationKeys.bankCancel: 'Cancel',
    BankLocalizationKeys.bankConfirm: 'Confirm',
    BankLocalizationKeys.bankSave: 'Save',
    BankLocalizationKeys.bankEdit: 'Edit',
    BankLocalizationKeys.bankDelete: 'Delete',
    BankLocalizationKeys.bankDone: 'Done',
    BankLocalizationKeys.bankContinue: 'Continue',
    BankLocalizationKeys.bankSkip: 'Skip',
    BankLocalizationKeys.bankGetStarted: 'Get Started',

    // Status Messages
    BankLocalizationKeys.bankSuccess: 'Success',
    BankLocalizationKeys.bankError: 'Error',
    BankLocalizationKeys.bankLoading: 'Loading...',
    BankLocalizationKeys.bankNoData: 'No data available',
    BankLocalizationKeys.bankNetworkError: 'Network connection error',
    BankLocalizationKeys.bankSessionExpired: 'Session expired',

    // Security Features
    BankLocalizationKeys.bankSecureBanking: 'Secure Banking',
    BankLocalizationKeys.bankQuickTransfers: 'Quick Transfers',
    BankLocalizationKeys.bankSmartInvestments: 'Smart Investments',
    BankLocalizationKeys.bankDigitalCards: 'Digital Cards',

    // Amounts and Currency
    BankLocalizationKeys.bankAmount: 'Amount',
    BankLocalizationKeys.bankBalance: 'Balance',
    BankLocalizationKeys.bankCurrency: 'Currency',
    BankLocalizationKeys.bankLimit: 'Limit',
    BankLocalizationKeys.bankFee: 'Fee',

    // Time and Dates
    BankLocalizationKeys.bankToday: 'Today',
    BankLocalizationKeys.bankYesterday: 'Yesterday',
    BankLocalizationKeys.bankThisWeek: 'This Week',
    BankLocalizationKeys.bankThisMonth: 'This Month',
    BankLocalizationKeys.bankLastMonth: 'Last Month',

    // Settings and Preferences
    BankLocalizationKeys.bankSettings: 'Settings',
    BankLocalizationKeys.bankNotifications: 'Notifications',
    BankLocalizationKeys.bankLanguage: 'Language',
    BankLocalizationKeys.bankTheme: 'Theme',
    BankLocalizationKeys.bankPrivacy: 'Privacy',
    BankLocalizationKeys.bankTermsOfService: 'Terms of Service',
  };
}