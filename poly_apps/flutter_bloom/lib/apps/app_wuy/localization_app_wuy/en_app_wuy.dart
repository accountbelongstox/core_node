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

import 'localization_keys_app_wuy.dart';

/// English translations for Wuy App
/// All keys must match LocalizationKeysAppWuy constants
class WuyEnTranslations {
  static const Map<String, String> translations = {
    LocalizationKeysAppWuy.wuyHomeTitle: 'Wuy Test App',
    LocalizationKeysAppWuy.wuyHomeWelcome: 'Welcome to Wuy App',
    LocalizationKeysAppWuy.wuyHomeDescription: 'This is a test page for the Wuy application.',
    LocalizationKeysAppWuy.wuyHomeTestButton: 'Test Button',

    LocalizationKeysAppWuy.wuyMenuHome: 'Home',
    LocalizationKeysAppWuy.wuyMenuProfile: 'Profile',
    LocalizationKeysAppWuy.wuyMenuSettings: 'Settings',
    LocalizationKeysAppWuy.wuyMenuNotifications: 'Notifications',
    LocalizationKeysAppWuy.wuyMenuMessages: 'Messages',
    LocalizationKeysAppWuy.wuyMenuSearch: 'Search',

    LocalizationKeysAppWuy.wuyActionSave: 'Save',
    LocalizationKeysAppWuy.wuyActionCancel: 'Cancel',
    LocalizationKeysAppWuy.wuyActionDelete: 'Delete',
    LocalizationKeysAppWuy.wuyActionEdit: 'Edit',
    LocalizationKeysAppWuy.wuyActionConfirm: 'Confirm',
    LocalizationKeysAppWuy.wuyActionBack: 'Back',

    LocalizationKeysAppWuy.wuyStatusLoading: 'Loading...',
    LocalizationKeysAppWuy.wuyStatusSuccess: 'Success!',
    LocalizationKeysAppWuy.wuyStatusError: 'An error occurred',
    LocalizationKeysAppWuy.wuyStatusNoData: 'No data available',

    LocalizationKeysAppWuy.wuyValidationRequired: 'This field is required',
    LocalizationKeysAppWuy.wuyValidationInvalidEmail: 'Please enter a valid email address',
    LocalizationKeysAppWuy.wuyValidationPasswordTooShort: 'Password must be at least 8 characters',
    LocalizationKeysAppWuy.wuyValidationPasswordsNoMatch: 'Passwords do not match',

    // Friends related
    LocalizationKeysAppWuy.wuyFriendsTitle: 'Friends & Groups',
    LocalizationKeysAppWuy.wuyFriendsSearch: 'Search Friends',
    LocalizationKeysAppWuy.wuyFriendsNoFriends: 'No Friends',
    LocalizationKeysAppWuy.wuyFriendsAddFriend: 'Add Friend',
    LocalizationKeysAppWuy.wuyFriendsOnline: 'Online',
    LocalizationKeysAppWuy.wuyFriendsOffline: 'Offline',

    // Chat related
    LocalizationKeysAppWuy.wuyChatTitle: 'Chat',
    LocalizationKeysAppWuy.wuyChatTypeMessage: 'Type a message...',
    LocalizationKeysAppWuy.wuyChatSend: 'Send',
    LocalizationKeysAppWuy.wuyChatSending: 'Sending',
    LocalizationKeysAppWuy.wuyChatSent: 'Sent',
    LocalizationKeysAppWuy.wuyChatRead: 'Read',

    // Search related
    LocalizationKeysAppWuy.wuySearchTitle: 'Search Friends',
    LocalizationKeysAppWuy.wuySearchName: 'Name',
    LocalizationKeysAppWuy.wuySearchSignature: 'Signature',
    LocalizationKeysAppWuy.wuySearchPhone: 'Phone Number',
    LocalizationKeysAppWuy.wuySearchGender: 'Gender',
    LocalizationKeysAppWuy.wuySearchMale: 'Male',
    LocalizationKeysAppWuy.wuySearchFemale: 'Female',
    LocalizationKeysAppWuy.wuySearchReset: 'Reset',
    LocalizationKeysAppWuy.wuySearchNoResults: 'No friends found',

    // Profile related
    LocalizationKeysAppWuy.wuyProfileTitle: 'Profile',
    LocalizationKeysAppWuy.wuyProfilePersonalInfo: 'Personal Information',
    LocalizationKeysAppWuy.wuyProfileAbout: 'About Us',
    LocalizationKeysAppWuy.wuyProfileEdit: 'Edit',
    LocalizationKeysAppWuy.wuyProfileSave: 'Save',
    LocalizationKeysAppWuy.wuyProfileSignOut: 'Sign Out',

    // About related
    LocalizationKeysAppWuy.wuyAboutTitle: 'About Us',
    LocalizationKeysAppWuy.wuyAboutFeatures: 'Features',
    LocalizationKeysAppWuy.wuyAboutVersion: 'Version Update',
    LocalizationKeysAppWuy.wuyAboutAppInfo: 'App Information',
    LocalizationKeysAppWuy.wuyAboutVersionInfo: 'View latest version information',
    LocalizationKeysAppWuy.wuyAboutFeatureInfo: 'Learn about main features',

    // History related
    LocalizationKeysAppWuy.wuyHistoryTitle: 'History Tracking',
    LocalizationKeysAppWuy.wuyHistoryActivity: 'Activity History',
    LocalizationKeysAppWuy.wuyHistoryLogin: 'Login',
    LocalizationKeysAppWuy.wuyHistorySuccess: 'Success',
    LocalizationKeysAppWuy.wuyHistoryAction: 'Action',
    LocalizationKeysAppWuy.wuyHistoryMessage: 'Message',
    LocalizationKeysAppWuy.wuyHistoryUpdate: 'Update',

    // Network related
    LocalizationKeysAppWuy.wuyNetworkTitle: 'Network Records',
    LocalizationKeysAppWuy.wuyNetworkActivity: 'Network Activity',
    LocalizationKeysAppWuy.wuyNetworkSuccess: 'Success',
    LocalizationKeysAppWuy.wuyNetworkError: 'Error',
    LocalizationKeysAppWuy.wuyNetworkPending: 'Pending',

    // Map related
    LocalizationKeysAppWuy.wuyMapTitle: 'Map',
    LocalizationKeysAppWuy.wuyMapLocation: 'Location',
    LocalizationKeysAppWuy.wuyMapSearch: 'Search',

    // Authentication related
    LocalizationKeysAppWuy.wuyAuthLogin: 'Login',
    LocalizationKeysAppWuy.wuyAuthRegister: 'Register',
    LocalizationKeysAppWuy.wuyAuthEmail: 'Email',
    LocalizationKeysAppWuy.wuyAuthPassword: 'Password',
    LocalizationKeysAppWuy.wuyAuthConfirmPassword: 'Confirm Password',
    LocalizationKeysAppWuy.wuyAuthPhone: 'Phone Number',
    LocalizationKeysAppWuy.wuyAuthForgotPassword: 'Forgot Password?',
    LocalizationKeysAppWuy.wuyAuthSignIn: 'Sign In',
    LocalizationKeysAppWuy.wuyAuthSignUp: 'Sign Up',
    LocalizationKeysAppWuy.wuyAuthAlreadyHaveAccount: 'Already have an account?',
    LocalizationKeysAppWuy.wuyAuthDontHaveAccount: 'Don\'t have an account?',
    
    // Login Entry Page
    LocalizationKeysAppWuy.wuyAppName: 'AnWuYou',
    LocalizationKeysAppWuy.wuyAppSlogan: 'Carefully Guarding for You',
    LocalizationKeysAppWuy.wuyPhoneLoginRegister: 'Phone Login/Register',
    LocalizationKeysAppWuy.wuyUserAgreement: 'Registration means agreeing to the User Service and Privacy Agreement',
    LocalizationKeysAppWuy.wuyOtherLoginMethods: 'Other Login Methods',
    LocalizationKeysAppWuy.wuyWeChatLogin: 'WeChat Login',
    LocalizationKeysAppWuy.wuyQQLogin: 'QQ Login',
    LocalizationKeysAppWuy.wuyAlipayLogin: 'Alipay Login',
    
    // Phone Login Page
    LocalizationKeysAppWuy.wuyPhoneLoginTitle: 'Login/Register',
    LocalizationKeysAppWuy.wuyEnterPhoneNumber: 'Please enter phone number',
    LocalizationKeysAppWuy.wuyEnterPassword: 'Please enter password',
    LocalizationKeysAppWuy.wuyLoginButton: 'Login',
    LocalizationKeysAppWuy.wuyRegisterButton: 'Register',

    // Common actions
    LocalizationKeysAppWuy.wuyCommonOk: 'OK',
    LocalizationKeysAppWuy.wuyCommonCancel: 'Cancel',
    LocalizationKeysAppWuy.wuyCommonYes: 'Yes',
    LocalizationKeysAppWuy.wuyCommonNo: 'No',
    LocalizationKeysAppWuy.wuyCommonClose: 'Close',
    LocalizationKeysAppWuy.wuyCommonDone: 'Done',
    LocalizationKeysAppWuy.wuyCommonNext: 'Next',
    LocalizationKeysAppWuy.wuyCommonPrevious: 'Previous',
    LocalizationKeysAppWuy.wuyCommonRefresh: 'Refresh',
    LocalizationKeysAppWuy.wuyCommonRetry: 'Retry',

    // Splash screen
    LocalizationKeysAppWuy.wuySplashTitle: 'AnWuYou',
    LocalizationKeysAppWuy.wuySplashSubtitle: 'Carefully Guarding for You',

    // Home screen
    LocalizationKeysAppWuy.wuyHomeFeatures: 'Features',
    LocalizationKeysAppWuy.wuyHomeProfile: 'Profile',
    LocalizationKeysAppWuy.wuyHomeSettings: 'Settings',
    LocalizationKeysAppWuy.wuyHomeDashboard: 'Dashboard',
    LocalizationKeysAppWuy.wuyHomeViewProfile: 'View and edit your profile',
    LocalizationKeysAppWuy.wuyHomeConfigureSettings: 'Configure app settings',
    LocalizationKeysAppWuy.wuyHomeViewDashboard: 'View your dashboard',

    // Map screen
    LocalizationKeysAppWuy.wuyMapCurrentLocation: 'Current Location',
    LocalizationKeysAppWuy.wuyMapFriendLocation: 'Friend Location',
    LocalizationKeysAppWuy.wuyMapViewDetails: 'View Details',
    LocalizationKeysAppWuy.wuyMapFriends: 'Friends',
    LocalizationKeysAppWuy.wuyMapMine: 'Mine',

    // Profile screen
    LocalizationKeysAppWuy.wuyProfileUsername: 'Username',
    LocalizationKeysAppWuy.wuyProfileEmail: 'Email',
    LocalizationKeysAppWuy.wuyProfilePhone: 'Phone',
    LocalizationKeysAppWuy.wuyProfileEditProfile: 'Edit Profile',
    LocalizationKeysAppWuy.wuyProfileChangePassword: 'Change Password',
    LocalizationKeysAppWuy.wuyProfileNotificationSettings: 'Notification Settings',
    LocalizationKeysAppWuy.wuyProfilePrivacySettings: 'Privacy Settings',
    LocalizationKeysAppWuy.wuyProfileHelpSupport: 'Help & Support',
    LocalizationKeysAppWuy.wuyProfileTermsOfService: 'Terms of Service',
    LocalizationKeysAppWuy.wuyProfilePrivacyPolicy: 'Privacy Policy',
    LocalizationKeysAppWuy.wuyProfileLogout: 'Logout',
    LocalizationKeysAppWuy.wuyProfileMemberSince: 'Member Since',

    // Login screen
    LocalizationKeysAppWuy.wuyLoginTitle: 'Login',
    LocalizationKeysAppWuy.wuyLoginSubtitle: 'Welcome Back',
    LocalizationKeysAppWuy.wuyLoginEmail: 'Email',
    LocalizationKeysAppWuy.wuyLoginEnterEmail: 'Enter your email',
    LocalizationKeysAppWuy.wuyLoginPassword: 'Password',
    LocalizationKeysAppWuy.wuyLoginEnterPassword: 'Enter your password',
    LocalizationKeysAppWuy.wuyLoginRememberMe: 'Remember Me',
    LocalizationKeysAppWuy.wuyLoginForgotPassword: 'Forgot Password?',
    LocalizationKeysAppWuy.wuyLoginSignIn: 'Sign In',
    LocalizationKeysAppWuy.wuyLoginDontHaveAccount: 'Don\'t have an account?',
    LocalizationKeysAppWuy.wuyLoginSignUp: 'Sign Up',
    LocalizationKeysAppWuy.wuyLoginOr: 'Or',
    LocalizationKeysAppWuy.wuyLoginWithGoogle: 'Login with Google',
    LocalizationKeysAppWuy.wuyLoginWithFacebook: 'Login with Facebook',

    // Register screen
    LocalizationKeysAppWuy.wuyRegisterTitle: 'Register',
    LocalizationKeysAppWuy.wuyRegisterSubtitle: 'Create New Account',
    LocalizationKeysAppWuy.wuyRegisterFullName: 'Full Name',
    LocalizationKeysAppWuy.wuyRegisterEnterFullName: 'Enter your full name',
    LocalizationKeysAppWuy.wuyRegisterEmail: 'Email',
    LocalizationKeysAppWuy.wuyRegisterEnterEmail: 'Enter your email',
    LocalizationKeysAppWuy.wuyRegisterPassword: 'Password',
    LocalizationKeysAppWuy.wuyRegisterEnterPassword: 'Enter your password',
    LocalizationKeysAppWuy.wuyRegisterConfirmPassword: 'Confirm Password',
    LocalizationKeysAppWuy.wuyRegisterEnterConfirmPassword: 'Enter your password again',
    LocalizationKeysAppWuy.wuyRegisterAgreeTerms: 'I agree to the Terms of Service and Privacy Policy',
    LocalizationKeysAppWuy.wuyRegisterCreateAccount: 'Create Account',
    LocalizationKeysAppWuy.wuyRegisterAlreadyHaveAccount: 'Already have an account?',
    LocalizationKeysAppWuy.wuyRegisterSignIn: 'Sign In',

    // Chat screen
    LocalizationKeysAppWuy.wuyChatOnline: 'Online',
    LocalizationKeysAppWuy.wuyChatLastSeen: 'Last Seen',
    LocalizationKeysAppWuy.wuyChatTyping: 'Typing...',
    LocalizationKeysAppWuy.wuyChatImage: 'Image',
    LocalizationKeysAppWuy.wuyChatFile: 'File',
    LocalizationKeysAppWuy.wuyChatVoice: 'Voice',
    LocalizationKeysAppWuy.wuyChatVideo: 'Video',

    // Friend info screen
    LocalizationKeysAppWuy.wuyFriendInfoTitle: 'Friend Info',
    LocalizationKeysAppWuy.wuyFriendInfoPersonalInfo: 'Personal Info',
    LocalizationKeysAppWuy.wuyFriendInfoContactInfo: 'Contact Info',
    LocalizationKeysAppWuy.wuyFriendInfoActivity: 'Activity',
    LocalizationKeysAppWuy.wuyFriendInfoHistoryTracks: 'History Tracks',
    LocalizationKeysAppWuy.wuyFriendInfoNetworkRecords: 'Network Records',
    LocalizationKeysAppWuy.wuyFriendInfoSendMessage: 'Send Message',
    LocalizationKeysAppWuy.wuyFriendInfoCall: 'Call',
    LocalizationKeysAppWuy.wuyFriendInfoVideoCall: 'Video Call',

    // Add friend screen
    LocalizationKeysAppWuy.wuyAddFriendTitle: 'Add Friend',
    LocalizationKeysAppWuy.wuyAddFriendSearch: 'Search',
    LocalizationKeysAppWuy.wuyAddFriendSearchHint: 'Enter friend\'s phone or username',
    LocalizationKeysAppWuy.wuyAddFriendResults: 'Search Results',
    LocalizationKeysAppWuy.wuyAddFriendNoResults: 'No friends found',
    LocalizationKeysAppWuy.wuyAddFriendAdd: 'Add',
    LocalizationKeysAppWuy.wuyAddFriendAdded: 'Added',
    LocalizationKeysAppWuy.wuyAddFriendPending: 'Pending',

    // Settings screen
    LocalizationKeysAppWuy.wuySettingsTitle: 'Settings',
    LocalizationKeysAppWuy.wuySettingsGeneral: 'General',
    LocalizationKeysAppWuy.wuySettingsNotifications: 'Notifications',
    LocalizationKeysAppWuy.wuySettingsPrivacy: 'Privacy',
    LocalizationKeysAppWuy.wuySettingsSecurity: 'Security',
    LocalizationKeysAppWuy.wuySettingsAbout: 'About',
    LocalizationKeysAppWuy.wuySettingsLanguage: 'Language',
    LocalizationKeysAppWuy.wuySettingsTheme: 'Theme',
    LocalizationKeysAppWuy.wuySettingsDarkMode: 'Dark Mode',
    LocalizationKeysAppWuy.wuySettingsLightMode: 'Light Mode',
    LocalizationKeysAppWuy.wuySettingsSystemMode: 'System',

    // Dashboard screen
    LocalizationKeysAppWuy.wuyDashboardTitle: 'Dashboard',
    LocalizationKeysAppWuy.wuyDashboardOverview: 'Overview',
    LocalizationKeysAppWuy.wuyDashboardStats: 'Statistics',
    LocalizationKeysAppWuy.wuyDashboardRecentActivity: 'Recent Activity',
    LocalizationKeysAppWuy.wuyDashboardQuickActions: 'Quick Actions',

    // Messages
    LocalizationKeysAppWuy.wuyMessagePersonalInfoUpdated: 'Personal information updated successfully!',
    LocalizationKeysAppWuy.wuyMessageFriendAdded: 'Friend added successfully!',
    LocalizationKeysAppWuy.wuyMessageEnterPhoneFirst: 'Please enter your phone number first',
    LocalizationKeysAppWuy.wuyMessageVerificationCodeSent: 'Verification code sent to {phone}',
    LocalizationKeysAppWuy.wuyMessageRegistrationSuccessful: 'Registration successful!',
    LocalizationKeysAppWuy.wuyMessageFeatureComingSoon: 'Feature information coming soon!',
    LocalizationKeysAppWuy.wuyMessageVersionComingSoon: 'Version information coming soon!',
    LocalizationKeysAppWuy.wuyMessageLoginFailed: 'Login failed: {error}',
    LocalizationKeysAppWuy.wuyMessageLoginSuccessOffline: 'Login successful (offline mode)',
  };
}

/// Alias for compatibility with locales provider
class EnAppWuy {
  static Map<String, dynamic> get locales => WuyEnTranslations.translations;
}
