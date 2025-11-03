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
    LocalizationKeysAppWuy.wuyHomeDescription:
        'This is a test page for the Wuy application.',
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
    LocalizationKeysAppWuy.wuyValidationInvalidEmail:
        'Please enter a valid email address',
    LocalizationKeysAppWuy.wuyValidationPasswordTooShort:
        'Password must be at least 8 characters',
    LocalizationKeysAppWuy.wuyValidationPasswordsNoMatch:
        'Passwords do not match',

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
    LocalizationKeysAppWuy.wuyAboutAppInfo: 'App Information',
    LocalizationKeysAppWuy.wuyAboutVersionInfo:
        'View latest version information',
    LocalizationKeysAppWuy.wuyAboutFeatureInfo: 'Learn about main features',

    // History related
    LocalizationKeysAppWuy.wuyHistoryTitle: 'History Tracking',
    LocalizationKeysAppWuy.wuyHistoryActivity: 'Activity History',
    LocalizationKeysAppWuy.wuyHistoryLogin: 'Login',
    LocalizationKeysAppWuy.wuyHistorySuccess: 'Success',
    LocalizationKeysAppWuy.wuyHistoryAction: 'Action',
    LocalizationKeysAppWuy.wuyHistoryMessage: 'Message',
    LocalizationKeysAppWuy.wuyHistoryUpdate: 'Update',
    LocalizationKeysAppWuy.wuyHistoryProtectFuture: 'Carefully Guarding Your Future',
    LocalizationKeysAppWuy.wuyHistoryNoLocationHistory: 'No location history',
    LocalizationKeysAppWuy.wuyHistoryTrajectory: 'Trajectory',

    // Network related
    LocalizationKeysAppWuy.wuyNetworkTitle: 'Network Records',
    LocalizationKeysAppWuy.wuyNetworkActivity: 'Network Activity',
    LocalizationKeysAppWuy.wuyNetworkSuccess: 'Success',
    LocalizationKeysAppWuy.wuyNetworkError: 'Error',
    LocalizationKeysAppWuy.wuyNetworkPending: 'Pending',
    LocalizationKeysAppWuy.wuyNetworkConnectedWifi: 'Connected to WiFi',
    LocalizationKeysAppWuy.wuyNetworkConnectedWifiWith: 'Connected WiFi',
    LocalizationKeysAppWuy.wuyNetworkConnectedMobile: 'Connected to Mobile Network',
    LocalizationKeysAppWuy.wuyNetworkChange: 'Network change',
    LocalizationKeysAppWuy.wuyNetworkNoRecords: 'No network records',

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
    LocalizationKeysAppWuy.wuyAuthAlreadyHaveAccount:
        'Already have an account?',
    LocalizationKeysAppWuy.wuyAuthDontHaveAccount: 'Don\'t have an account?',
    LocalizationKeysAppWuy.wuyAlreadyHaveAccount: 'Already have an account?',
    LocalizationKeysAppWuy.wuyNeedAccount: 'Need an account?',

    // Login Entry Page
    LocalizationKeysAppWuy.wuyAppName: 'AnWuYou',
    LocalizationKeysAppWuy.wuyAppSlogan: 'Carefully Guarding for You',
    LocalizationKeysAppWuy.wuyPhoneLoginRegister: 'Phone Login/Register',
    LocalizationKeysAppWuy.wuyUserAgreement:
        'Registration means agreeing to the User Service and Privacy Agreement',
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
    LocalizationKeysAppWuy.wuyMapCenterLocation: 'Centered on current location',
    LocalizationKeysAppWuy.wuyMapStyleTitle: 'Map Style',
    LocalizationKeysAppWuy.wuyMapStyleNormal: 'Normal',
    LocalizationKeysAppWuy.wuyMapStyleSatellite: 'Satellite',
    LocalizationKeysAppWuy.wuyMapStyleDark: 'Dark',
    LocalizationKeysAppWuy.wuyMapStyleLight: 'Light',
    LocalizationKeysAppWuy.wuyMapStyleTraffic: 'Traffic',
    LocalizationKeysAppWuy.wuyMapZoomIn: 'Zoom In',
    LocalizationKeysAppWuy.wuyMapZoomOut: 'Zoom Out',
    LocalizationKeysAppWuy.wuyMapMarkerTapped: 'marker tapped',
    LocalizationKeysAppWuy.wuyMapBeijing: 'Beijing',
    LocalizationKeysAppWuy.wuyMapCapitalOfChina: 'Capital of China',
    LocalizationKeysAppWuy.wuyMapSteps: 'Steps',
    LocalizationKeysAppWuy.wuyMapHeartRate: 'Heart Rate',
    LocalizationKeysAppWuy.wuyMapTemperature: 'Temperature',
    LocalizationKeysAppWuy.wuyMapCalories: 'Calories',

    // Profile screen
    LocalizationKeysAppWuy.wuyProfileUsername: 'Username',
    LocalizationKeysAppWuy.wuyProfileEmail: 'Email',
    LocalizationKeysAppWuy.wuyProfilePhone: 'Phone',
    LocalizationKeysAppWuy.wuyProfileEditProfile: 'Edit Profile',
    LocalizationKeysAppWuy.wuyProfileChangePassword: 'Change Password',
    LocalizationKeysAppWuy.wuyProfileNotificationSettings:
        'Notification Settings',
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
    LocalizationKeysAppWuy.wuyRegisterEnterConfirmPassword:
        'Enter your password again',
    LocalizationKeysAppWuy.wuyRegisterAgreeTerms:
        'I agree to the Terms of Service and Privacy Policy',
    LocalizationKeysAppWuy.wuyRegisterCreateAccount: 'Create Account',
    LocalizationKeysAppWuy.wuyRegisterAlreadyHaveAccount:
        'Already have an account?',
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
    LocalizationKeysAppWuy.wuyAddFriendSearchHint:
        'Enter friend\'s phone or username',
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
    LocalizationKeysAppWuy.wuyMessagePersonalInfoUpdated:
        'Personal information updated successfully!',
    LocalizationKeysAppWuy.wuyMessageFriendAdded: 'Friend added successfully!',
    LocalizationKeysAppWuy.wuyMessageEnterPhoneFirst:
        'Please enter your phone number first',
    LocalizationKeysAppWuy.wuyMessageVerificationCodeSent:
        'Verification code sent to {phone}',
    LocalizationKeysAppWuy.wuyMessageRegistrationSuccessful:
        'Registration successful!',
    LocalizationKeysAppWuy.wuyMessageFeatureComingSoon:
        'Feature information coming soon!',
    LocalizationKeysAppWuy.wuyMessageVersionComingSoon:
        'Version information coming soon!',
    LocalizationKeysAppWuy.wuyMessageLoginFailed: 'Login failed: {error}',
    LocalizationKeysAppWuy.wuyMessageLoginSuccessOffline:
        'Login successful (offline mode)',
    LocalizationKeysAppWuy.wuyMessageApiKeyNotConfigured:
        'Backend API key not configured, using non-API mode',

    // Debug messages
    LocalizationKeysAppWuy.wuyDebugLoginError: 'Login error',
    LocalizationKeysAppWuy.wuyDebugRegistrationError: 'Registration error',
    LocalizationKeysAppWuy.wuyDebugVerificationCodeError:
        'Verification code error',
    LocalizationKeysAppWuy.wuyDebugLogoutError: 'Logout error',
    LocalizationKeysAppWuy.wuyDebugGetFriendsError: 'Get friends error',
    LocalizationKeysAppWuy.wuyDebugGetChatMessagesError:
        'Get chat messages error',
    LocalizationKeysAppWuy.wuyDebugGetLocationError: 'Get location error',
    LocalizationKeysAppWuy.wuyDebugUpdateProfileError: 'Update profile error',
    LocalizationKeysAppWuy.wuyDebugLoadUserDataError: 'Load user data error',
    LocalizationKeysAppWuy.wuyDebugAuthStateValidationFailed:
        'Auth state validation failed',
    LocalizationKeysAppWuy.wuyDebugAuthStateError: 'Auth state error',
    LocalizationKeysAppWuy.wuyDebugStorageError: 'Storage error',
    LocalizationKeysAppWuy.wuyDebugStorageNotInitialized:
        'Storage not initialized',
    LocalizationKeysAppWuy.wuyDebugUserNotFound: 'User not found',
    LocalizationKeysAppWuy.wuyDebugCannotUpdateProfile:
        'Cannot update profile, no current user',
    LocalizationKeysAppWuy.wuyDebugNoAuthStateFound:
        'No auth state found in storage',
    LocalizationKeysAppWuy.wuyDebugErrorLoadingAuthState:
        'Error loading auth state',
    LocalizationKeysAppWuy.wuyDebugErrorSettingUser: 'Error setting user',
    LocalizationKeysAppWuy.wuyDebugErrorClearingAuth: 'Error clearing auth',
    LocalizationKeysAppWuy.wuyDebugErrorInAuthCheck: 'Error in auth check',
    LocalizationKeysAppWuy.wuyDebugLoginSuccessNoUser:
        'Login success but no user found',
    LocalizationKeysAppWuy.wuyDebugErrorInLoginSuccess:
        'Error in login success',
    LocalizationKeysAppWuy.wuyDebugFallbackNavigation: 'Fallback navigation',
    LocalizationKeysAppWuy.wuyDebugRedirectingToHome: 'Redirecting to home',
    LocalizationKeysAppWuy.wuyDebugCheckingAuthState: 'Checking auth state',
    LocalizationKeysAppWuy.wuyDebugFinalAuthCheck: 'Final auth check result',
    LocalizationKeysAppWuy.wuyDebugLoginSuccess: 'Login success',
    LocalizationKeysAppWuy.wuyDebugNavigatingToHome: 'Navigating to home',
    LocalizationKeysAppWuy.wuyDebugUserAuthenticated: 'User authenticated',
    LocalizationKeysAppWuy.wuyDebugUserNotAuthenticated:
        'User not authenticated',
    LocalizationKeysAppWuy.wuyDebugAuthCleared: 'Auth cleared',
    LocalizationKeysAppWuy.wuyDebugLogoutHandled: 'Logout handled',
    LocalizationKeysAppWuy.wuyDebugLoginSuccessHandled: 'Login success handled',
    LocalizationKeysAppWuy.wuyDebugAuthStateLoaded:
        'Auth state loaded from storage',
    LocalizationKeysAppWuy.wuyDebugUserDataLoaded:
        'User data loaded successfully',
    LocalizationKeysAppWuy.wuyDebugUserDataCleared: 'User data cleared',
    LocalizationKeysAppWuy.wuyDebugUserSaved: 'User saved successfully',
    LocalizationKeysAppWuy.wuyDebugUserUpdated: 'User updated successfully',
    LocalizationKeysAppWuy.wuyDebugUserDeleted: 'User deleted successfully',
    LocalizationKeysAppWuy.wuyDebugStorageInitialized:
        'Storage initialized successfully',
    LocalizationKeysAppWuy.wuyDebugStorageInitError:
        'Storage initialization error',
    LocalizationKeysAppWuy.wuyDebugStorageInitFailed:
        'Storage initialization failed',
    LocalizationKeysAppWuy.wuyDebugSaveUserError: 'Save user error',
    LocalizationKeysAppWuy.wuyDebugGetUserError: 'Get user error',
    LocalizationKeysAppWuy.wuyDebugUpdateUserError: 'Update user error',
    LocalizationKeysAppWuy.wuyDebugDeleteUserError: 'Delete user error',
    LocalizationKeysAppWuy.wuyDebugFakeDataEnabled:
        'Fake data generation enabled',
    LocalizationKeysAppWuy.wuyDebugFakeDataDisabled:
        'Fake data generation disabled',
    LocalizationKeysAppWuy.wuyDebugUsingFakeData: 'Using fake data',
    LocalizationKeysAppWuy.wuyDebugLoadedFromFakeData: 'Loaded from fake data',
    LocalizationKeysAppWuy.wuyDebugLoadedFromApi: 'Loaded from API',
    LocalizationKeysAppWuy.wuyDebugProfileUpdated: 'Profile updated',
    LocalizationKeysAppWuy.wuyDebugProfileUpdatedViaApi:
        'Profile updated via API',
    LocalizationKeysAppWuy.wuyDebugSyncedWithAuth:
        'Synced with auth state manager',
    LocalizationKeysAppWuy.wuyDebugClearedUser: 'Cleared user',
    LocalizationKeysAppWuy.wuyDebugRealLogoutFailed:
        'Real logout API call failed',
    LocalizationKeysAppWuy.wuyDebugGetInitialRoute: 'Get initial route',

    // About screen specific
    LocalizationKeysAppWuy.wuyAboutAppName: 'AnWuYou',
    LocalizationKeysAppWuy.wuyAboutAppNameEn: 'An Wu You',
    LocalizationKeysAppWuy.wuyAboutVersion: 'Version',
    LocalizationKeysAppWuy.wuyAboutBuild: 'Build',
    LocalizationKeysAppWuy.wuyAboutDeveloper: 'Developer',
    LocalizationKeysAppWuy.wuyAboutPlatform: 'Platform',
    LocalizationKeysAppWuy.wuyAboutLicense: 'License',
    LocalizationKeysAppWuy.wuyAboutVersionValue: '1.0.0',
    LocalizationKeysAppWuy.wuyAboutBuildValue: '2025.01.08',
    LocalizationKeysAppWuy.wuyAboutDeveloperValue: 'Wuy Team',
    LocalizationKeysAppWuy.wuyAboutPlatformValue: 'Flutter',
    LocalizationKeysAppWuy.wuyAboutLicenseValue: 'MIT',

    // Validation messages
    LocalizationKeysAppWuy.wuyValidationPhoneInvalid:
        'Please enter a valid phone number',
    LocalizationKeysAppWuy.wuyValidationPhoneRequired:
        'Phone number is required',
    LocalizationKeysAppWuy.wuyValidationPhoneFormat:
        'Please enter a valid phone number format',

    // Search screen specific
    LocalizationKeysAppWuy.wuySearchSampleUser1: 'Little Flying Hero',
    LocalizationKeysAppWuy.wuySearchSampleUser1Bio:
        'The weather is really nice today',
    LocalizationKeysAppWuy.wuySearchSampleUser2: 'Sunny Day',
    LocalizationKeysAppWuy.wuySearchSampleUser2Bio:
        'Love life, enjoy every day',

    // Settings screen specific (additional keys)
    LocalizationKeysAppWuy.wuySettingsDarkModeDescription: 'Enable dark theme',
    LocalizationKeysAppWuy.wuySettingsPushNotifications: 'Push Notifications',
    LocalizationKeysAppWuy.wuySettingsPushNotificationsDescription:
        'Receive push notifications',
    LocalizationKeysAppWuy.wuySettingsBiometricLogin: 'Biometric Login',
    LocalizationKeysAppWuy.wuySettingsBiometricLoginDescription:
        'Use fingerprint or face ID',
    LocalizationKeysAppWuy.wuySettingsChangePassword: 'Change Password',
    LocalizationKeysAppWuy.wuySettingsChangePasswordDescription:
        'Update your password',
    LocalizationKeysAppWuy.wuySettingsVersion: 'Version',
    LocalizationKeysAppWuy.wuySettingsVersionValue: '1.0.0',
    LocalizationKeysAppWuy.wuySettingsTermsOfService: 'Terms of Service',
    LocalizationKeysAppWuy.wuySettingsTermsOfServiceDescription:
        'Read our terms',
    LocalizationKeysAppWuy.wuySettingsPrivacyPolicy: 'Privacy Policy',
    LocalizationKeysAppWuy.wuySettingsPrivacyPolicyDescription:
        'Read our privacy policy',
    LocalizationKeysAppWuy.wuySettingsLanguageEnglish: 'English',
    LocalizationKeysAppWuy.wuySettingsLanguageChinese: '中文',

    // Add friend screen specific
    LocalizationKeysAppWuy.wuyAddFriendEnterNickname:
        'Enter friend\'s nickname',
    LocalizationKeysAppWuy.wuyAddFriendEnterGender:
        'Enter gender (Male/Female)',
    LocalizationKeysAppWuy.wuyAddFriendEnterAge: 'Enter age',
    LocalizationKeysAppWuy.wuyAddFriendEnterHeight: 'Enter height in cm',
    LocalizationKeysAppWuy.wuyAddFriendEnterWeight: 'Enter weight in kg',

    // Register screen specific
    LocalizationKeysAppWuy.wuyRegisterEnterPhone: 'Enter your phone number',
    LocalizationKeysAppWuy.wuyRegisterEnterVerificationCode:
        'Enter verification code',

    // Social login messages
    LocalizationKeysAppWuy.wuyMessageWeChatApiConnecting:
        'WeChat login API is being integrated',
    LocalizationKeysAppWuy.wuyMessageQQApiConnecting:
        'QQ login API is being integrated',
    LocalizationKeysAppWuy.wuyMessageDingTalkApiConnecting:
        'DingTalk login API is being integrated',
    LocalizationKeysAppWuy.wuyMessageRecommendPhoneLogin:
        'We recommend using phone number login',

    // Missing translations
    LocalizationKeysAppWuy.wuyVerificationCode: 'Verification Code',
    LocalizationKeysAppWuy.wuyGetCode: 'Get Code',
    LocalizationKeysAppWuy.wuyRegisterLogin: 'Register/Login',
    LocalizationKeysAppWuy.wuyLogin: 'Login',
    LocalizationKeysAppWuy.wuyValidationVerificationRequired:
        'Please enter verification code',
    LocalizationKeysAppWuy.wuyValidationVerificationFormat:
        'Invalid verification code format',
    LocalizationKeysAppWuy.wuyAgreementText: 'Registration means agreeing to',
    LocalizationKeysAppWuy.wuyAnd: 'and',
    LocalizationKeysAppWuy.wuyPrivacyPolicy: 'Privacy Policy',
    LocalizationKeysAppWuy.wuyMessageSendCodeFailed:
        'Failed to send verification code',
    LocalizationKeysAppWuy.wuyMessageSendCodeError:
        'Error sending verification code',
    LocalizationKeysAppWuy.wuyMessageOperationFailed: 'Operation failed',

    // Network records screen specific
    LocalizationKeysAppWuy.wuyNetworkLoginAccount: 'Login to account',
    LocalizationKeysAppWuy.wuyNetworkLoginSuccess: 'Login successful',
    LocalizationKeysAppWuy.wuyNetworkConnectWifi: 'Connected to WiFi network',
    LocalizationKeysAppWuy.wuyNetworkMobileConnection:
        'Mobile network connection',
    LocalizationKeysAppWuy.wuyNetworkRequestTimeout: 'Network request timeout',

    // Dashboard screen specific
    LocalizationKeysAppWuy.wuyDashboardWelcome: 'Welcome back!',
    LocalizationKeysAppWuy.wuyDashboardOverviewText:
        'Here\'s your dashboard overview',
    LocalizationKeysAppWuy.wuyDashboardQuickStats: 'Quick Stats',
    LocalizationKeysAppWuy.wuyDashboardTotalUsers: 'Total Users',
    LocalizationKeysAppWuy.wuyDashboardActiveSessions: 'Active Sessions',
    LocalizationKeysAppWuy.wuyDashboardMessages: 'Messages',
    LocalizationKeysAppWuy.wuyDashboardTasks: 'Tasks',
    LocalizationKeysAppWuy.wuyDashboardNewUserRegistered:
        'New user registered',
    LocalizationKeysAppWuy.wuyDashboardSystemUpdateCompleted:
        'System update completed',
    LocalizationKeysAppWuy.wuyDashboardNewMessageReceived:
        'New message received',
    LocalizationKeysAppWuy.wuyDashboardTaskCompleted: 'Task completed',
    LocalizationKeysAppWuy.wuyDashboardReportGenerated: 'Report generated',
    LocalizationKeysAppWuy.wuyDashboardMinutesAgo: '{count} minutes ago',
    LocalizationKeysAppWuy.wuyDashboardHourAgo: '1 hour ago',
    LocalizationKeysAppWuy.wuyDashboardHoursAgo: '{count} hours ago',
    LocalizationKeysAppWuy.wuyDashboardDayAgo: '1 day ago',

    // Settings screen extended
    LocalizationKeysAppWuy.wuySettingsAppearance: 'Appearance',
    LocalizationKeysAppWuy.wuySettingsLanguageSection: 'Language',
    LocalizationKeysAppWuy.wuySettingsSocial: 'Social',
    LocalizationKeysAppWuy.wuySettingsMessaging: 'Messaging',
    LocalizationKeysAppWuy.wuySettingsPerformance: 'Performance',
    LocalizationKeysAppWuy.wuySettingsResetTitle: 'Reset Settings',
    LocalizationKeysAppWuy.wuySettingsResetConfirm:
        'Are you sure you want to reset all settings to default values?',
    LocalizationKeysAppWuy.wuySettingsResetSuccess:
        'Settings have been reset to defaults',
    LocalizationKeysAppWuy.wuySettingsResetToDefaults: 'Reset to Defaults',

    // Common buttons
    LocalizationKeysAppWuy.wuyButtonCancel: 'Cancel',
    LocalizationKeysAppWuy.wuyButtonReset: 'Reset',
    LocalizationKeysAppWuy.wuyButtonSave: 'Save',
    LocalizationKeysAppWuy.wuyButtonConfirm: 'Confirm',
  };
}

/// Alias for compatibility with locales provider
class EnAppWuy {
  static Map<String, dynamic> get locales => WuyEnTranslations.translations;
}
