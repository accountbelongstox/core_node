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

import 'localization_keys_app_qy.dart';

/// English localization for QY App
class EnAppQy {
  static const Map<String, String> values = {
    // App Identity
    QyAppLocalizationKeys.qyAppName: 'QY App',
    QyAppLocalizationKeys.qyAppDescription:
        'A comprehensive QY learning platform',
    QyAppLocalizationKeys.qyAppSlogan: 'Learn, Build, Grow',
    QyAppLocalizationKeys.qyAppVersion: 'Version 1.0.0',
    QyAppLocalizationKeys.qyAppSettings: 'App Settings',
    QyAppLocalizationKeys.qySloganWords: 'Empower Your Learning Journey',
    QyAppLocalizationKeys.qySloganEyes: 'Keep your eyes on knowledge',
    QyAppLocalizationKeys.qyLetsStart: 'Let\'s Start',
    QyAppLocalizationKeys.qyDoNotHaveAccount: 'Don\'t have an account?',
    QyAppLocalizationKeys.qySignupForFree: 'Sign up for free',
    QyAppLocalizationKeys.qyWelcome: 'Welcome Back',
    QyAppLocalizationKeys.qyGreeting: 'Hello, learner!',
    QyAppLocalizationKeys.qyWelcomeBack: 'Welcome back',
    QyAppLocalizationKeys.qyGuestMode: 'Guest mode',

    // Common Actions
    QyAppLocalizationKeys.qyHome: 'Home',
    QyAppLocalizationKeys.qyMenu: 'Menu',
    QyAppLocalizationKeys.qySocial: 'Social',
    QyAppLocalizationKeys.qySupport: 'Support',
    QyAppLocalizationKeys.qyNext: 'Next',
    QyAppLocalizationKeys.qyPrevious: 'Previous',
    QyAppLocalizationKeys.qySkip: 'Skip',
    QyAppLocalizationKeys.qyCancel: 'Cancel',
    QyAppLocalizationKeys.qyConfirm: 'Confirm',
    QyAppLocalizationKeys.qySave: 'Save',
    QyAppLocalizationKeys.qyDelete: 'Delete',
    QyAppLocalizationKeys.qyEdit: 'Edit',
    QyAppLocalizationKeys.qyBack: 'Back',
    QyAppLocalizationKeys.qyClose: 'Close',
    QyAppLocalizationKeys.qyOk: 'OK',
    QyAppLocalizationKeys.qyYes: 'Yes',
    QyAppLocalizationKeys.qyNo: 'No',
    QyAppLocalizationKeys.qyContinue: 'Continue',
    QyAppLocalizationKeys.qySubmit: 'Submit',
    QyAppLocalizationKeys.qyRetry: 'Retry',
    QyAppLocalizationKeys.qyRefresh: 'Refresh',
    QyAppLocalizationKeys.qySearch: 'Search',
    QyAppLocalizationKeys.qySearchPlaceholder: 'Search...',
    QyAppLocalizationKeys.qyEnterSearchText: 'Enter search text',
    QyAppLocalizationKeys.qyFilter: 'Filter',
    QyAppLocalizationKeys.qySort: 'Sort',
    QyAppLocalizationKeys.qyClear: 'Clear',
    QyAppLocalizationKeys.qyReset: 'Reset',
    QyAppLocalizationKeys.qyTopUp: 'Top up',

    // Status Messages
    QyAppLocalizationKeys.qySuccess: 'Success',
    QyAppLocalizationKeys.qyError: 'Error',
    QyAppLocalizationKeys.qyWarning: 'Warning',
    QyAppLocalizationKeys.qyInfo: 'Information',
    QyAppLocalizationKeys.qyLoading: 'Loading...',
    QyAppLocalizationKeys.qyCompleted: 'Completed',
    QyAppLocalizationKeys.qyPending: 'Pending',
    QyAppLocalizationKeys.qyFailed: 'Failed',
    QyAppLocalizationKeys.qyEnabled: 'Enabled',
    QyAppLocalizationKeys.qyDisabled: 'Disabled',

    // General exercise/learning
    QyAppLocalizationKeys.qyCorrect: 'Correct',
    QyAppLocalizationKeys.qyIncorrect: 'Incorrect',
    QyAppLocalizationKeys.qyCorrectAnswer: 'Correct Answer',
    QyAppLocalizationKeys.qyYourAnswer: 'Your Answer',
    QyAppLocalizationKeys.qyProgress: 'Progress',
    QyAppLocalizationKeys.qySpellingPractice: 'Spelling Practice',
    QyAppLocalizationKeys.qySpellTheWord: 'Spell the Word',
    QyAppLocalizationKeys.qyHint: 'Hint',
    QyAppLocalizationKeys.qyListenAndType: 'Listen and Type',
    QyAppLocalizationKeys.qyTypeHere: 'Type here',
    QyAppLocalizationKeys.qyPlayAgain: 'Play Again',
    QyAppLocalizationKeys.qyWordListeningDictation: 'Word Listening Dictation',
    QyAppLocalizationKeys.qyUnderDevelopment: 'This page is under development',
    QyAppLocalizationKeys.qyPlaying: 'Playing',
    QyAppLocalizationKeys.qyDictationComplete: 'Dictation Complete',
    QyAppLocalizationKeys.qyAccuracy: 'Accuracy',
    QyAppLocalizationKeys.qyPlayAudio: 'Play Audio',
    QyAppLocalizationKeys.qyWrongAnswer: 'Wrong Answer',
    QyAppLocalizationKeys.qyCorrectWord: 'Correct Word',

    // Authentication
    QyAppLocalizationKeys.qySignIn: 'Sign In',
    QyAppLocalizationKeys.qySignUp: 'Sign Up',
    QyAppLocalizationKeys.qySignOut: 'Sign Out',
    QyAppLocalizationKeys.qyLogout: 'Logout',
    QyAppLocalizationKeys.qyLogoutConfirm: 'Are you sure you want to log out?',
    QyAppLocalizationKeys.qyLogoutSuccess:
        'You have been logged out successfully',
    QyAppLocalizationKeys.qyLogoutFailed: 'Logout failed, please try again',
    QyAppLocalizationKeys.qyYesLogout: 'Yes, logout',
    QyAppLocalizationKeys.qyLogin: 'Login',
    QyAppLocalizationKeys.qyLoginFailed: 'Login failed',
    QyAppLocalizationKeys.qyRegister: 'Register',
    QyAppLocalizationKeys.qyRegisterSuccess: 'Registration successful',
    QyAppLocalizationKeys.qyRegisterFailed: 'Registration failed',
    QyAppLocalizationKeys.qyPasswordsDoNotMatch: 'Passwords do not match',
    QyAppLocalizationKeys.qyInvalidRegistrationData:
        'Invalid registration data',
    QyAppLocalizationKeys.qySwitchToRegister: 'Switch to Register',
    QyAppLocalizationKeys.qySwitchToLogin: 'Switch to Login',
    QyAppLocalizationKeys.qyRegisterToContinue: 'Register to continue learning',
    QyAppLocalizationKeys.qyPleaseEnterEmail: 'Please enter email',
    QyAppLocalizationKeys.qyPleaseEnterConfirmPassword:
        'Please enter confirm password',
    QyAppLocalizationKeys.qyForgotPassword: 'Forgot Password',
    QyAppLocalizationKeys.qyResetPassword: 'Reset Password',
    QyAppLocalizationKeys.qyChangePassword: 'Change Password',
    QyAppLocalizationKeys.qyEmail: 'Email',
    QyAppLocalizationKeys.qyPassword: 'Password',
    QyAppLocalizationKeys.qyConfirmPassword: 'Confirm Password',
    QyAppLocalizationKeys.qyUsername: 'Username',
    QyAppLocalizationKeys.qyRememberMe: 'Remember Me',
    QyAppLocalizationKeys.qyCreateAccount: 'Create Account',
    QyAppLocalizationKeys.qyHaveAccount: 'Already have an account?',
    QyAppLocalizationKeys.qyNoAccount: 'Don\'t have an account?',

    // Profile & Settings
    QyAppLocalizationKeys.qyProfile: 'Profile',
    QyAppLocalizationKeys.qyMyProfile: 'My Profile',
    QyAppLocalizationKeys.qyEditProfile: 'Edit Profile',
    QyAppLocalizationKeys.qyPersonalInfo: 'Personal Information',
    QyAppLocalizationKeys.qyFirstName: 'First Name',
    QyAppLocalizationKeys.qyLastName: 'Last Name',
    QyAppLocalizationKeys.qyFullName: 'Full Name',
    QyAppLocalizationKeys.qyPhoneNumber: 'Phone Number',
    QyAppLocalizationKeys.qyAddress: 'Address',
    QyAppLocalizationKeys.qyBirthDate: 'Birth Date',
    QyAppLocalizationKeys.qyGender: 'Gender',
    QyAppLocalizationKeys.qyAvatar: 'Avatar',
    QyAppLocalizationKeys.qyBio: 'Bio',
    QyAppLocalizationKeys.qyProfileFill: 'Fill Your Profile',
    QyAppLocalizationKeys.qyProfileFullName: 'Full Name *',
    QyAppLocalizationKeys.qyProfileEmail: 'Email *',
    QyAppLocalizationKeys.qyProfilePhone: 'Phone Number',
    QyAppLocalizationKeys.qyProfileLocation: 'Location',
    QyAppLocalizationKeys.qyProfileSelectPhoto: 'Select Profile Photo',
    QyAppLocalizationKeys.qyProfileChooseGallery: 'Choose from Gallery',
    QyAppLocalizationKeys.qyProfileTakePhoto: 'Take Photo',
    QyAppLocalizationKeys.qyProfileSaving: 'Saving...',
    QyAppLocalizationKeys.qyProfileContinue: 'Continue',
    QyAppLocalizationKeys.qyProfileEnterFullName: 'Enter your full name',
    QyAppLocalizationKeys.qyProfileEnterEmail: 'Enter your email',
    QyAppLocalizationKeys.qyProfileEnterPhone: 'Enter phone number',
    QyAppLocalizationKeys.qyProfileTellAboutYourself: 'Tell us about yourself',
    QyAppLocalizationKeys.qyProfileCityCountry: 'City, Country',
    QyAppLocalizationKeys.qyProfileDefaultName: 'Adam Smith',
    QyAppLocalizationKeys.qyProfileFollowers: 'Followers',
    QyAppLocalizationKeys.qyProfileFollowing: 'Following',
    QyAppLocalizationKeys.qyProfilePosts: 'Posts',
    QyAppLocalizationKeys.qyInterest: 'Interest',
    QyAppLocalizationKeys.qySettings: 'Settings',
    QyAppLocalizationKeys.qyGeneralSettings: 'General Settings',
    QyAppLocalizationKeys.qyAccountSettings: 'Account Settings',
    QyAppLocalizationKeys.qyPrivacySettings: 'Privacy Settings',
    QyAppLocalizationKeys.qyNotificationSettings: 'Notification Settings',
    QyAppLocalizationKeys.qyLanguageSettings: 'Language Settings',
    QyAppLocalizationKeys.qyThemeSettings: 'Theme Settings',
    QyAppLocalizationKeys.qyReminderSettings: 'Reminder Settings',
    QyAppLocalizationKeys.qyReminderSettingsDesc:
        'Customize study reminders and schedules',
    QyAppLocalizationKeys.qyRecommendSettings: 'Recommendation Settings',
    QyAppLocalizationKeys.qyRecommendSettingsDesc:
        'Smart word suggestions based on your progress',
    QyAppLocalizationKeys.qyOtherSettings: 'Other Settings',
    QyAppLocalizationKeys.qyDisplayMode: 'Display Mode',
    QyAppLocalizationKeys.qyAboutUs: 'About Us',
    QyAppLocalizationKeys.qyCheckForUpdate: 'Check for Updates',
    QyAppLocalizationKeys.qyNetworkDiagnostics: 'Network Diagnostics',
    QyAppLocalizationKeys.qyNetworkStable: 'Network Stable',
    QyAppLocalizationKeys.qyNetworkUnavailable: 'Network Unavailable',
    QyAppLocalizationKeys.qyNetworkUnavailableMessage:
        'Please wait, retrying...',
    QyAppLocalizationKeys.qyNetworkRetrying: 'Retrying...',
    QyAppLocalizationKeys.qyBiometricAuth: 'Biometric Authentication',
    QyAppLocalizationKeys.qyDarkMode: 'Dark Mode',
    QyAppLocalizationKeys.qyLightMode: 'Light Mode',
    QyAppLocalizationKeys.qySystemMode: 'System Mode',
    QyAppLocalizationKeys.qyLanguage: 'Language',
    QyAppLocalizationKeys.qyLanguageEnglish: 'English',
    QyAppLocalizationKeys.qyLanguageChinese: 'Chinese',
    QyAppLocalizationKeys.qyNotifications: 'Notifications',
    QyAppLocalizationKeys.qyPrivacy: 'Privacy',
    QyAppLocalizationKeys.qyPrivacySecurity: 'Privacy & Security',
    QyAppLocalizationKeys.qySecurity: 'Security',
    QyAppLocalizationKeys.qyHelp: 'Help',
    QyAppLocalizationKeys.qyHelpSupport: 'Help & Support',
    QyAppLocalizationKeys.qyAbout: 'About',
    QyAppLocalizationKeys.qyAboutDescription: 'Learn more about the QY App',
    QyAppLocalizationKeys.qyTerms: 'Terms of Service',
    QyAppLocalizationKeys.qyPrivacyPolicy: 'Privacy Policy',
    QyAppLocalizationKeys.qyDisplayLayoutSettings: 'Display layout settings',
    QyAppLocalizationKeys.qyCompatibilitySettings: 'Compatibility settings',

    // Dashboard & Stats
    QyAppLocalizationKeys.qyDashboard: 'Dashboard',
    QyAppLocalizationKeys.qyInbox: 'Inbox',
    QyAppLocalizationKeys.qyMessages: 'Messages',
    QyAppLocalizationKeys.qyChat: 'Chat',
    QyAppLocalizationKeys.qyContacts: 'Contacts',
    QyAppLocalizationKeys.qyFriends: 'Friends',
    QyAppLocalizationKeys.qyGroups: 'Groups',
    QyAppLocalizationKeys.qyFeed: 'Feed',
    QyAppLocalizationKeys.qyNews: 'News',
    QyAppLocalizationKeys.qyEvents: 'Events',
    QyAppLocalizationKeys.qyCalendar: 'Calendar',
    QyAppLocalizationKeys.qyTasks: 'Tasks',
    QyAppLocalizationKeys.qyProjects: 'Projects',
    QyAppLocalizationKeys.qyMyPrayers: 'My Prayers',
    QyAppLocalizationKeys.qyMyDonations: 'My Donations',
    QyAppLocalizationKeys.qyDonationNoDonation: 'You have not a donation',
    QyAppLocalizationKeys.qyDonationMakeNow: 'Make a Donation Now',
    QyAppLocalizationKeys.qyDonationFundRaising: 'fund raising from the',
    QyAppLocalizationKeys.qyDonationDonations: 'Donations',
    QyAppLocalizationKeys.qyDonationDaysLeft: 'days left',
    QyAppLocalizationKeys.qyMyFundraising: 'My Fundraising',
    QyAppLocalizationKeys.qyInviteFriends: 'Invite Friends',
    QyAppLocalizationKeys.qyShareApp: 'Share App',
    QyAppLocalizationKeys.qyHomeTopMenuPrayer: 'Prayer',
    QyAppLocalizationKeys.qyFeature: 'Feature',
    QyAppLocalizationKeys.qyFeaturePreview: 'Preview',
    QyAppLocalizationKeys.qyFeatureComingSoon: 'Coming Soon',
    QyAppLocalizationKeys.qyDisaster: 'Disaster Relief',
    QyAppLocalizationKeys.qyEducation: 'Education',
    QyAppLocalizationKeys.qyEnvironment: 'Environment',
    QyAppLocalizationKeys.qyHumanity: 'Humanitarian',
    QyAppLocalizationKeys.qyMedical: 'Medical Aid',
    QyAppLocalizationKeys.qyOrphanage: 'Orphanage',
    QyAppLocalizationKeys.qyDailyStudyReminder: 'Daily study reminder',
    QyAppLocalizationKeys.qyPersonalizedRecommendations:
        'Personalized recommendation settings',
    QyAppLocalizationKeys.qySyncSettings: 'Sync settings',
    QyAppLocalizationKeys.qyNotLoggedIn: 'Not logged in',
    QyAppLocalizationKeys.qyUser: 'User',
    QyAppLocalizationKeys.qyClearCacheTitle: 'Clear cache',
    QyAppLocalizationKeys.qyClearCacheMessage:
        'Are you sure you want to clear the cache? This will remove {size} MB of data.',
    QyAppLocalizationKeys.qyCacheCleared: 'Cache cleared successfully.',
    QyAppLocalizationKeys.qyHelpCenterInProgress:
        'Help center feature is under development...',

    // Learning statistics
    QyAppLocalizationKeys.qyCommunity: 'Community',
    QyAppLocalizationKeys.qyGlobalSearch: 'Global Search',
    QyAppLocalizationKeys.qyAiSearch: 'AI Search',
    QyAppLocalizationKeys.qyPlaceholderSearchContent: 'Search content...',
    QyAppLocalizationKeys.qyLearningProgress: 'Learning Progress',
    QyAppLocalizationKeys.qyStudyDuration: 'Study Duration',
    QyAppLocalizationKeys.qyAccuracyRate: 'Accuracy Rate',
    QyAppLocalizationKeys.qyReviewCount: 'Review Count',
    QyAppLocalizationKeys.qyWordLearning: 'Word Learning',
    QyAppLocalizationKeys.qyPronunciation: 'Pronunciation',
    QyAppLocalizationKeys.qyUnknown: 'Unknown',
    QyAppLocalizationKeys.qyIAm: 'I am',

    QyAppLocalizationKeys.qyCertificateCenter: 'Certificate Center',
    QyAppLocalizationKeys.qyCertificateCenterSubtitle:
        'View your learning achievements',
    QyAppLocalizationKeys.qyCertificateEarned: 'Earned',
    QyAppLocalizationKeys.qyCertificateInProgress: 'In Progress',
    QyAppLocalizationKeys.qyCertificateTotalPoints: 'Total Points',
    QyAppLocalizationKeys.qyCertificateLocked: 'Locked',
    QyAppLocalizationKeys.qyCertificateUnlocked: 'Unlocked',
    QyAppLocalizationKeys.qyCertificateEarnedDate: 'Earned Date',
    QyAppLocalizationKeys.qyCertificateNumber: 'Certificate No.',
    QyAppLocalizationKeys.qyCertificateIssueDate: 'Issue Date',
    QyAppLocalizationKeys.qyCertificateKeepWorking:
        'Keep working to unlock this certificate!',
    QyAppLocalizationKeys.qyCertificateShareToWechat: 'Share to WeChat',
    QyAppLocalizationKeys.qyCertificateShareToMoments: 'Share to Moments',
    QyAppLocalizationKeys.qyCertificateSaveImage: 'Save Image',
    QyAppLocalizationKeys.qyCertificateCopyLink: 'Copy Link',
    QyAppLocalizationKeys.qyCertificateDownloadInProgress:
        'Certificate download feature is under development...',
    QyAppLocalizationKeys.qyCertificateShareInProgress:
        'Certificate share feature is under development...',
    QyAppLocalizationKeys.qyCertificateDescription:
        'This certificate is issued by the English Learning Platform\n\nThis certifies that the student has completed the relevant learning requirements,\nachieved the corresponding learning standards, and this certificate is issued as encouragement.',
    QyAppLocalizationKeys.qyCertificateLevelBeginner: 'Beginner',
    QyAppLocalizationKeys.qyCertificateLevelIntermediate: 'Intermediate',
    QyAppLocalizationKeys.qyCertificateLevelAdvanced: 'Advanced',
    QyAppLocalizationKeys.qyCertificateLevelExpert: 'Expert',
    QyAppLocalizationKeys.qyCertificateBadgeNewbie: 'Newbie',
    QyAppLocalizationKeys.qyCertificateBadgeDiligent: 'Diligent',
    QyAppLocalizationKeys.qyCertificateBadgePersistent: 'Persistent',
    QyAppLocalizationKeys.qyCertificateBadgePerfectAttendance:
        'Perfect Attendance',
    QyAppLocalizationKeys.qyCertificateBadgeExpert: 'Expert',
    QyAppLocalizationKeys.qyCertificateBadgeExcellent: 'Excellent',

    QyAppLocalizationKeys.qyCertBasicEnglishTitle: 'Basic English Certificate',
    QyAppLocalizationKeys.qyCertBasicEnglishDesc:
        'Complete basic English learning course',
    QyAppLocalizationKeys.qyCertWordMasterTitle: 'Word Master',
    QyAppLocalizationKeys.qyCertWordMasterDesc: 'Master 1000 words in total',
    QyAppLocalizationKeys.qyCertListeningMasterTitle: 'Listening Master',
    QyAppLocalizationKeys.qyCertListeningMasterDesc:
        'Complete listening practice for 30 consecutive days',
    QyAppLocalizationKeys.qyCertPerfectAttendanceTitle:
        'Perfect Attendance Award',
    QyAppLocalizationKeys.qyCertPerfectAttendanceDesc:
        'Study continuously for 90 days without interruption',
    QyAppLocalizationKeys.qyCertVocabularyExpertTitle:
        'Vocabulary Expert Certification',
    QyAppLocalizationKeys.qyCertVocabularyExpertDesc:
        'Master 5000 advanced vocabulary words',
    QyAppLocalizationKeys.qyCertIeltsHighScoreTitle:
        'IELTS High Score Certificate',
    QyAppLocalizationKeys.qyCertIeltsHighScoreDesc: 'IELTS score above 7.5',

    QyAppLocalizationKeys.qyAuthWelcomeMessage: 'Welcome',
    QyAppLocalizationKeys.qyAuthAppSlogan:
        'Shanbay Words - Remember Words, Record Changes',
    QyAppLocalizationKeys.qyAuthPhoneLogin: 'Phone Login',
    QyAppLocalizationKeys.qyAuthWechatLogin: 'WeChat Login',
    QyAppLocalizationKeys.qyAuthQQLogin: 'QQ Login',
    QyAppLocalizationKeys.qyAuthGoogleLogin: 'Google Login',
    QyAppLocalizationKeys.qyAuthGithubLogin: 'Github Login',
    QyAppLocalizationKeys.qyAuthMoreOptions: 'More Options',
    QyAppLocalizationKeys.qyAuthCollapseOptions: 'Collapse',
    QyAppLocalizationKeys.qyAuthPhoneNumber: 'Phone Number',
    QyAppLocalizationKeys.qyAuthPhonePlaceholder: 'Enter phone number',
    QyAppLocalizationKeys.qyAuthVerificationCode: 'Verification Code',
    QyAppLocalizationKeys.qyAuthCodePlaceholder: 'Enter verification code',
    QyAppLocalizationKeys.qyAuthGetCode: 'Get Code',
    QyAppLocalizationKeys.qyAuthResendCode: 'Resend',
    QyAppLocalizationKeys.qyAuthCodeSent: 'Code sent',
    QyAppLocalizationKeys.qyAuthCodeSendFailed: 'Failed to send code',
    QyAppLocalizationKeys.qyAuthLoginButton: 'Login',
    QyAppLocalizationKeys.qyAuthRegisterButton: 'Register',
    QyAppLocalizationKeys.qyAuthLoginSuccess: 'Login successful',
    QyAppLocalizationKeys.qyAuthLoginFailed: 'Login failed',
    QyAppLocalizationKeys.qyAuthRegisterSuccess: 'Registration successful',
    QyAppLocalizationKeys.qyAuthRegisterFailed: 'Registration failed',
    QyAppLocalizationKeys.qyAuthSkipLogin: 'Skip Login',
    QyAppLocalizationKeys.qyAuthGuestMode: 'Guest Mode',
    QyAppLocalizationKeys.qyAuthAgreement: 'User Agreement',
    QyAppLocalizationKeys.qyAuthAgreementPrefix: 'By logging in, you agree to',
    QyAppLocalizationKeys.qyAuthTermsOfService: 'Terms of Service',
    QyAppLocalizationKeys.qyAuthAnd: 'and',
    QyAppLocalizationKeys.qyAuthPrivacyPolicy: 'Privacy Policy',
    QyAppLocalizationKeys.qyAuthMustAgree:
        'Please agree to the user agreement first',
    QyAppLocalizationKeys.qyAuthPhoneInvalid:
        'Please enter a valid phone number',
    QyAppLocalizationKeys.qyAuthCodeInvalid: 'Please enter verification code',
    QyAppLocalizationKeys.qyAuthCodeLength: 'Please enter a 6-digit code',
    QyAppLocalizationKeys.qyAuthSeconds: 'seconds',
    QyAppLocalizationKeys.qyAuthWelcomeTitle: 'Welcome',
    QyAppLocalizationKeys.qyAuthSelectCountry: 'Select Country/Region',
    QyAppLocalizationKeys.qyAuthCountryCode: 'Country Code',
    QyAppLocalizationKeys.qyAuthVerifyPhone: 'Verify Phone',
    QyAppLocalizationKeys.qyAuthVerifyPhoneHint:
        'Enter code to verify your phone',
    QyAppLocalizationKeys.qyAuthForgotPassword: 'Forgot Password',
    QyAppLocalizationKeys.qyAuthResetPassword: 'Reset Password',
    QyAppLocalizationKeys.qyAuthNewPassword: 'New Password',
    QyAppLocalizationKeys.qyAuthConfirmNewPassword: 'Confirm New Password',
    QyAppLocalizationKeys.qyAuthPasswordMismatch: 'Passwords do not match',
    QyAppLocalizationKeys.qyAuthPasswordTooShort:
        'Password must be at least 6 characters',
    QyAppLocalizationKeys.qyAuthCreatePin: 'Create PIN',
    QyAppLocalizationKeys.qyAuthEnterPin: 'Enter PIN',
    QyAppLocalizationKeys.qyAuthConfirmPin: 'Confirm PIN',
    QyAppLocalizationKeys.qyAuthPinMismatch: 'PIN does not match',
    QyAppLocalizationKeys.qyAuthCongratulations: 'Congratulations',
    QyAppLocalizationKeys.qyAuthAccountCreated: 'Account Created',
    QyAppLocalizationKeys.qyAuthAccountCreatedDesc:
        'Your account has been created successfully',
    QyAppLocalizationKeys.qyAuthGetStarted: 'Get Started',
    QyAppLocalizationKeys.qyAuthLoginModeSwitch: 'Switch to Login',
    QyAppLocalizationKeys.qyAuthRegisterModeSwitch: 'Switch to Register',
    QyAppLocalizationKeys.qyAuthWechatLoginFailed: 'WeChat login failed',
    QyAppLocalizationKeys.qyAuthThirdPartyLogin: 'Third-Party Login',
    QyAppLocalizationKeys.qyAuthAppTitle: 'Every word counts here',

    QyAppLocalizationKeys.qySettingsPlayerCompatibility: 'Player compatibility',
    QyAppLocalizationKeys.qySettingsFeedback: 'Feedback',
    QyAppLocalizationKeys.qySettingsFeedbackInProgress:
        'Feedback feature is under development...',
    QyAppLocalizationKeys.qySettingsAboutInProgress:
        'About page feature is under development...',
    QyAppLocalizationKeys.qySettingsTermsInProgress:
        'User agreement feature is under development...',
    QyAppLocalizationKeys.qySettingsPrivacyInProgress:
        'Privacy policy feature is under development...',
    QyAppLocalizationKeys.qySettingsGeneral: 'General Settings',
    QyAppLocalizationKeys.qySettingsLanguage: 'App Language',
    QyAppLocalizationKeys.qySettingsNotifications: 'Notifications',
    QyAppLocalizationKeys.qySettingsAbout: 'About',
    QyAppLocalizationKeys.qyDisplay: 'Display',
    QyAppLocalizationKeys.qyAudioVoice: 'Audio & Voice',
    QyAppLocalizationKeys.qyTtsSettings: 'TTS Settings',
    QyAppLocalizationKeys.qyMyAccount: 'My Account',
    QyAppLocalizationKeys.qyLearningLanguages: 'Learning Languages',
    QyAppLocalizationKeys.qyVocabularyCollections: 'Vocabulary Collections',
    QyAppLocalizationKeys.qyManageWordLibraries: 'Manage your word libraries',
    QyAppLocalizationKeys.qyLearningStats: 'Learning Stats',
    QyAppLocalizationKeys.qyWordsLearned: 'words learned',
    QyAppLocalizationKeys.qyQuickSettings: 'Quick Settings',
    QyAppLocalizationKeys.qyAutoPlayAudio: 'Auto Play Audio',
    QyAppLocalizationKeys.qyAnimations: 'Animations',
    QyAppLocalizationKeys.qyHapticFeedback: 'Haptic Feedback',
    QyAppLocalizationKeys.qyDataStorage: 'Data & Storage',
    QyAppLocalizationKeys.qySyncData: 'Sync Data',
    QyAppLocalizationKeys.qyLastSynced: 'Last synced: Just now',
    QyAppLocalizationKeys.qyClearCache: 'Clear Cache',
    QyAppLocalizationKeys.qyExportData: 'Export Data',
    QyAppLocalizationKeys.qyBackupLearningData: 'Backup your learning data',
    QyAppLocalizationKeys.qyRestoreDefaultSettings: 'Restore default settings',
    QyAppLocalizationKeys.qyAreYouSureReset:
        'Are you sure you want to reset all settings to defaults?',
    QyAppLocalizationKeys.qySettingsResetDefaults: 'Settings reset to defaults',
    QyAppLocalizationKeys.qyLoginToUnlock: 'Login to Unlock More Features',
    QyAppLocalizationKeys.qyFaqsSupport: 'FAQs and support',
    QyAppLocalizationKeys.qyHowWeProtectData: 'How we protect your data',
    QyAppLocalizationKeys.qyTermsConditions: 'Terms and conditions',
    QyAppLocalizationKeys.qySignOutAccount: 'Sign out from your account',

    QyAppLocalizationKeys.qySettingsDailyReminder: 'Daily reminder',
    QyAppLocalizationKeys.qySettingsEnableDailyReminder:
        'Enable daily reminder',
    QyAppLocalizationKeys.qySettingsEnableDailyReminderSubtitle:
        'Daily study reminder at fixed time',
    QyAppLocalizationKeys.qySettingsReminderTime: 'Reminder time',
    QyAppLocalizationKeys.qySettingsVibrationReminder: 'Vibration reminder',
    QyAppLocalizationKeys.qySettingsVibrationReminderSubtitle:
        'Vibrate on study reminder',
    QyAppLocalizationKeys.qySettingsSoundReminder: 'Sound reminder',
    QyAppLocalizationKeys.qySettingsSoundReminderSubtitle:
        'Play sound on study reminder',
    QyAppLocalizationKeys.qySettingsReminderDate: 'Reminder date',
    QyAppLocalizationKeys.qySettingsRemindEveryday: 'Remind every day',
    QyAppLocalizationKeys.qySettingsWeekdayMonday: 'Mon',
    QyAppLocalizationKeys.qySettingsWeekdayTuesday: 'Tue',
    QyAppLocalizationKeys.qySettingsWeekdayWednesday: 'Wed',
    QyAppLocalizationKeys.qySettingsWeekdayThursday: 'Thu',
    QyAppLocalizationKeys.qySettingsWeekdayFriday: 'Fri',
    QyAppLocalizationKeys.qySettingsWeekdaySaturday: 'Sat',
    QyAppLocalizationKeys.qySettingsWeekdaySunday: 'Sun',

    QyAppLocalizationKeys.qySettingsFontSettings: 'Font settings',
    QyAppLocalizationKeys.qySettingsFont: 'Font',
    QyAppLocalizationKeys.qySettingsAppearanceSettings: 'Appearance settings',
    QyAppLocalizationKeys.qySettingsInterfaceLayout: 'Interface layout',
    QyAppLocalizationKeys.qySettingsStandardMode: 'Standard mode',
    QyAppLocalizationKeys.qySettingsAccessibility: 'Accessibility',
    QyAppLocalizationKeys.qySettingsHighContrast: 'High contrast',
    QyAppLocalizationKeys.qySettingsHighContrastSubtitle:
        'Improve contrast between text and background',
    QyAppLocalizationKeys.qySettingsLargeFontMode: 'Large font mode',
    QyAppLocalizationKeys.qySettingsLargeFontModeSubtitle:
        'Suitable for users with poor vision',
    QyAppLocalizationKeys.qySettingsSelectFont: 'Select font',
    QyAppLocalizationKeys.qySettingsLayoutInProgress:
        'Layout settings feature is under development...',

    QyAppLocalizationKeys.qySettingsModify: 'Modify',
    QyAppLocalizationKeys.qySettingsRebind: 'Rebind',
    QyAppLocalizationKeys.qySettingsBind: 'Bind',
    QyAppLocalizationKeys.qySettingsAccountBinding: 'Account binding',
    QyAppLocalizationKeys.qySettingsPhone: 'Phone',
    QyAppLocalizationKeys.qySettingsNotBound: 'Not bound',
    QyAppLocalizationKeys.qySettingsWechat: 'WeChat',
    QyAppLocalizationKeys.qySettingsWeibo: 'Weibo',
    QyAppLocalizationKeys.qySettingsQQ: 'QQ',
    QyAppLocalizationKeys.qySettingsAccountDeletion: 'Account deletion',
    QyAppLocalizationKeys.qySettingsAccountDeletionSubtitle:
        'Delete all data, permanent deletion',
    QyAppLocalizationKeys.qySettingsDeleteAccount: 'Delete',
    QyAppLocalizationKeys.qySettingsChangeUsername: 'Change username',
    QyAppLocalizationKeys.qySettingsEnterNewUsername: 'Enter new username',
    QyAppLocalizationKeys.qySettingsUsernameUpdated: 'Username updated',
    QyAppLocalizationKeys.qySettingsChangePasswordTitle: 'Change password',
    QyAppLocalizationKeys.qySettingsEnterNewPassword: 'Enter new password',
    QyAppLocalizationKeys.qySettingsConfirmNewPassword: 'Confirm new password',
    QyAppLocalizationKeys.qySettingsPasswordUpdated: 'Password updated',
    QyAppLocalizationKeys.qySettingsPhoneBinding: 'Phone binding',
    QyAppLocalizationKeys.qySettingsPhoneBindingInProgress:
        'Phone binding feature is under development...',
    QyAppLocalizationKeys.qySettingsWechatBinding: 'WeChat binding',
    QyAppLocalizationKeys.qySettingsWechatBindingInProgress:
        'WeChat binding feature is under development...',
    QyAppLocalizationKeys.qySettingsWeiboBinding: 'Weibo binding',
    QyAppLocalizationKeys.qySettingsWeiboBindingInProgress:
        'Weibo binding feature is under development...',
    QyAppLocalizationKeys.qySettingsQQBinding: 'QQ binding',
    QyAppLocalizationKeys.qySettingsQQBindingInProgress:
        'QQ binding feature is under development...',
    QyAppLocalizationKeys.qySettingsDeletionWarning:
        'Warning: This operation is irreversible!',
    QyAppLocalizationKeys.qySettingsAfterDeletion: 'After account deletion:',
    QyAppLocalizationKeys.qySettingsDeletionDataLoss:
        'All learning data will be permanently deleted',
    QyAppLocalizationKeys.qySettingsDeletionCourseLoss:
        'Purchased courses and services will be unavailable',
    QyAppLocalizationKeys.qySettingsDeletionAccountClear:
        'Account information will be completely cleared',
    QyAppLocalizationKeys.qySettingsConfirmDeletion:
        'Are you sure you want to delete your account?',
    QyAppLocalizationKeys.qySettingsFinalConfirmation: 'Final confirmation',
    QyAppLocalizationKeys.qySettingsFinalConfirmationMessage:
        'Please confirm again: Do you really want to permanently delete your account?',
    QyAppLocalizationKeys.qySettingsLetMeThink: 'Let me think again',
    QyAppLocalizationKeys.qySettingsAccountDeletionInProgress:
        'Account deletion feature is under development...',

    QyAppLocalizationKeys.qySettingsSmartRecommendation: 'Smart recommendation',
    QyAppLocalizationKeys.qySettingsAutoRecommend: 'Auto recommend',
    QyAppLocalizationKeys.qySettingsAutoRecommendSubtitle:
        'Recommend words based on learning history',
    QyAppLocalizationKeys.qySettingsDifficulty: 'Difficulty',
    QyAppLocalizationKeys.qySettingsDifficultySettings: 'Difficulty settings',
    QyAppLocalizationKeys.qySettingsDifficultyBeginner: 'Beginner',
    QyAppLocalizationKeys.qySettingsDifficultyIntermediate: 'Intermediate',
    QyAppLocalizationKeys.qySettingsDifficultyAdvanced: 'Advanced',
    QyAppLocalizationKeys.qySettingsDifficultyExpert: 'Expert',
    QyAppLocalizationKeys.qySettingsInterestTags: 'Interest tags',
    QyAppLocalizationKeys.qySettingsInterestTagsSelected:
        '{count} interest tags selected',
    QyAppLocalizationKeys.qySettingsRecommendationFrequency:
        'Recommendation frequency',
    QyAppLocalizationKeys.qySettingsRecommendationStrength:
        'Recommendation strength',
    QyAppLocalizationKeys.qySettingsSelectDifficulty: 'Select difficulty',
    QyAppLocalizationKeys.qySettingsDifficultyBeginnerDesc:
        'Suitable for beginners, basic vocabulary',
    QyAppLocalizationKeys.qySettingsDifficultyIntermediateDesc:
        'Suitable for learners with some foundation',
    QyAppLocalizationKeys.qySettingsDifficultyAdvancedDesc:
        'Suitable for advanced learners, professional vocabulary',
    QyAppLocalizationKeys.qySettingsDifficultyExpertDesc:
        'Suitable for expert learners, academic vocabulary',

    // Word Book Module
    QyAppLocalizationKeys.qyWordBook: 'Word Book',
    QyAppLocalizationKeys.qyWordBookTitle: 'Curated Word Book',
    QyAppLocalizationKeys.qyWords: 'words',
    QyAppLocalizationKeys.qyCorpus: 'Corpus',
    QyAppLocalizationKeys.qyWordBookExampleSentence: 'Example',
    QyAppLocalizationKeys.qyWordBookPronunciation: 'Pronunciation',
    QyAppLocalizationKeys.qyWordBookMastered: 'Mastered',
    QyAppLocalizationKeys.qyWordBookMasteryLevel: 'Mastery Level',
    QyAppLocalizationKeys.qyWordBookNewWord: 'New',
    QyAppLocalizationKeys.qyWordBookLearning: 'Learning',
    QyAppLocalizationKeys.qyWordBookAll: 'All',
    QyAppLocalizationKeys.qyWordBookStatsTitle: 'Learning overview',
    QyAppLocalizationKeys.qyWordBookWordCount: 'All words',
    QyAppLocalizationKeys.qyWordBookLearningCount: 'Learning',
    QyAppLocalizationKeys.qyWordBookNewCount: 'New words',
    QyAppLocalizationKeys.qyWordBookMasteredCount: 'Mastered',
    QyAppLocalizationKeys.qyWordBookSearchHint: 'Search words or meanings',
    QyAppLocalizationKeys.qyWordBookLoading:
        'Loading your personalized vocabulary...',
    QyAppLocalizationKeys.qyWordBookNoWords:
        'No words match your filters right now',
    QyAppLocalizationKeys.qyWordBookAddToNew: 'Add to new words',
    QyAppLocalizationKeys.qyWordBookAddToMastered: 'Mark as mastered',
    QyAppLocalizationKeys.qyWordBookRemoveFromBook: 'Remove from word book',
    QyAppLocalizationKeys.qyWordBookFilterTitle: 'Smart search filters',
    QyAppLocalizationKeys.qyWordBookFilterAll: 'Clear search & reset filters',
    QyAppLocalizationKeys.qyWordBookFilterWithinBook: 'Search within this book',
    QyAppLocalizationKeys.qyWordBookSnackPlay:
        'Playing pronunciation for {word}',
    QyAppLocalizationKeys.qyWordBookSnackLearned: '{word} marked as mastered',
    QyAppLocalizationKeys.qyWordBookSnackAdded: '{word} moved to new words',
    QyAppLocalizationKeys.qyWordBookSnackRemoved:
        '{word} removed from your word book',
    QyAppLocalizationKeys.qyNoWordBooks: 'No Word Books',
    QyAppLocalizationKeys.qyPlayingAudio: 'Playing Audio',
    QyAppLocalizationKeys.qyExcellent: 'Excellent',
    QyAppLocalizationKeys.qyGoodJob: 'Good Job',
    QyAppLocalizationKeys.qyKeepPracticing: 'Keep Practicing',
    QyAppLocalizationKeys.qyYourScore: 'Your Score',
    QyAppLocalizationKeys.qyDictation: 'Dictation',
    QyAppLocalizationKeys.qyListenAndWrite: 'Listen and Write',
    QyAppLocalizationKeys.qyTypeWhatYouHear: 'Type What You Hear',
    QyAppLocalizationKeys.qyEnterSentence: 'Enter Sentence',
    QyAppLocalizationKeys.qyFinish: 'Finish',
    QyAppLocalizationKeys.qyCheck: 'Check',
    QyAppLocalizationKeys.qyExit: 'Exit',
    QyAppLocalizationKeys.qyWordTest: 'Word Test',
    QyAppLocalizationKeys.qyFlashcards: 'Flashcards',
    QyAppLocalizationKeys.qyTapToFlip: 'Tap to Flip',
    QyAppLocalizationKeys.qyDefinition: 'Definition',
    QyAppLocalizationKeys.qyExamples: 'Examples',
    QyAppLocalizationKeys.qySynonyms: 'Synonyms',
    QyAppLocalizationKeys.qyFlip: 'Flip',
    QyAppLocalizationKeys.qyMarkedAsKnown: 'Marked as Known',
    QyAppLocalizationKeys.qyMarkedForReview: 'Marked for Review',
    QyAppLocalizationKeys.qyReviewComplete: 'Review Complete',
    QyAppLocalizationKeys.qyReviewed: 'Reviewed',
    QyAppLocalizationKeys.qyWordReview: 'Word Review',
    QyAppLocalizationKeys.qyTapToHide: 'Tap to Hide',
    QyAppLocalizationKeys.qyTapToReveal: 'Tap to Reveal',
    QyAppLocalizationKeys.qyMasteryLevel: 'Mastery Level',
    QyAppLocalizationKeys.qyLastReviewed: 'Last Reviewed',
    QyAppLocalizationKeys.qyNeedReview: 'Need Review',
    QyAppLocalizationKeys.qyKnown: 'Known',
    QyAppLocalizationKeys.qyHideDefinition: 'Hide Definition',
    QyAppLocalizationKeys.qyShowDefinition: 'Show Definition',

    // Word Listening Module
    QyAppLocalizationKeys.qyListeningPlay: 'Play',
    QyAppLocalizationKeys.qyListeningStop: 'Stop',
    QyAppLocalizationKeys.qyListeningLoop: 'Loop',
    QyAppLocalizationKeys.qyListeningOn: 'On',
    QyAppLocalizationKeys.qyListeningOff: 'Off',
    QyAppLocalizationKeys.qyListeningSpeedSlow: 'Slow',
    QyAppLocalizationKeys.qyListeningSpeedNormal: 'Normal',
    QyAppLocalizationKeys.qyListeningSpeedFast: 'Fast',
    QyAppLocalizationKeys.qyListeningCategoryDaily: 'Daily Vocabulary',
    QyAppLocalizationKeys.qyListeningCategoryDailyDesc:
        'Basic daily expressions',
    QyAppLocalizationKeys.qyListeningCategoryBusiness: 'Business English',
    QyAppLocalizationKeys.qyListeningCategoryBusinessDesc:
        'Workplace business vocabulary',
    QyAppLocalizationKeys.qyListeningCategoryAcademic: 'Academic Vocabulary',
    QyAppLocalizationKeys.qyListeningCategoryAcademicDesc:
        'Academic terminology',
    QyAppLocalizationKeys.qyListeningCategoryTravel: 'Travel English',
    QyAppLocalizationKeys.qyListeningCategoryTravelDesc:
        'Travel communication vocabulary',
    QyAppLocalizationKeys.qyListeningCategoryTech: 'Tech Vocabulary',
    QyAppLocalizationKeys.qyListeningCategoryTechDesc:
        'Science and technology terms',
    QyAppLocalizationKeys.qyListeningCategoryMedical: 'Medical Vocabulary',
    QyAppLocalizationKeys.qyListeningCategoryMedicalDesc:
        'Medical health terminology',
    QyAppLocalizationKeys.qyListeningDictationBeginner: 'Beginner Dictation',
    QyAppLocalizationKeys.qyListeningDictationBeginnerDesc:
        'Basic vocabulary, slow playback',
    QyAppLocalizationKeys.qyListeningDictationIntermediate:
        'Intermediate Dictation',
    QyAppLocalizationKeys.qyListeningDictationIntermediateDesc:
        'Common vocabulary, standard speed',
    QyAppLocalizationKeys.qyListeningDictationAdvanced: 'Advanced Dictation',
    QyAppLocalizationKeys.qyListeningDictationAdvancedDesc:
        'Professional vocabulary, fast playback',
    QyAppLocalizationKeys.qyListeningDictationExpert: 'Expert Dictation',
    QyAppLocalizationKeys.qyListeningDictationExpertDesc:
        'Complex sentences, native speed',
    QyAppLocalizationKeys.qyListeningDictation: 'Word Dictation',
    QyAppLocalizationKeys.qyListeningDictationTitle: 'Dictation Training',
    QyAppLocalizationKeys.qyListeningDictationDesc:
        'Improve spelling and listening skills through dictation',
    QyAppLocalizationKeys.qyListeningQuestionNumber:
        'Question {index} / {total}',
    QyAppLocalizationKeys.qyListeningAccuracy: 'Accuracy',
    QyAppLocalizationKeys.qyListeningProgress: 'Practice Progress',
    QyAppLocalizationKeys.qyListeningPlayWord: 'Play Word',
    QyAppLocalizationKeys.qyListeningStopPlay: 'Stop Playback',
    QyAppLocalizationKeys.qyListeningPlayCount: 'Play Count',
    QyAppLocalizationKeys.qyListeningEnterWord: 'Enter the word you heard',
    QyAppLocalizationKeys.qyListeningInputPlaceholder: 'Type word here...',
    QyAppLocalizationKeys.qyListeningSubmitAnswer: 'Submit Answer',
    QyAppLocalizationKeys.qyListeningHint: 'Hint',
    QyAppLocalizationKeys.qyListeningHintMessage:
        'Hint: Word starts with "{letter}", {length} letters total',
    QyAppLocalizationKeys.qyListeningCorrect: 'Correct!',
    QyAppLocalizationKeys.qyListeningIncorrect: 'Incorrect',
    QyAppLocalizationKeys.qyListeningCorrectAnswer: 'Correct Answer',
    QyAppLocalizationKeys.qyListeningMeaning: 'Meaning',
    QyAppLocalizationKeys.qyListeningExample: 'Example',
    QyAppLocalizationKeys.qyListeningPrevious: 'Previous',
    QyAppLocalizationKeys.qyListeningNext: 'Next',
    QyAppLocalizationKeys.qyListeningComplete: 'Complete',
    QyAppLocalizationKeys.qyListeningPracticeComplete: 'Practice Complete!',
    QyAppLocalizationKeys.qyListeningCorrectAnswers: 'Correct Answers',
    QyAppLocalizationKeys.qyListeningTodayListening: 'Today\'s Listening',
    QyAppLocalizationKeys.qyListeningLearnedWords: 'Words Learned',
    QyAppLocalizationKeys.qyListeningStreakDays: 'Streak Days',
    QyAppLocalizationKeys.qyListeningTodayPractice: 'Today\'s Practice',
    QyAppLocalizationKeys.qyListeningWeekPractice: 'Week Practice',
    QyAppLocalizationKeys.qyListeningTotalTime: 'Total Practice Time',
    QyAppLocalizationKeys.qyListeningContinuousDays: 'Continuous Days',
    QyAppLocalizationKeys.qyListeningDailyAverage: 'Daily Average',
    QyAppLocalizationKeys.qyListeningFreeTitle: 'Free Listening',
    QyAppLocalizationKeys.qyListeningFreeDesc:
        'Choose category, practice freely',
    QyAppLocalizationKeys.qyListeningSpeed: 'Playback Speed',
    QyAppLocalizationKeys.qyListeningCurrentWord: 'Current Word',
    QyAppLocalizationKeys.qyListeningNextWordTip: 'Switch to next word',
    QyAppLocalizationKeys.qyListeningStats: 'Listening Stats',
    QyAppLocalizationKeys.qyListeningAddToVocab: 'Add to Vocabulary',
    QyAppLocalizationKeys.qyListeningPracticing: 'Practicing',
    QyAppLocalizationKeys.qyListeningMastered: 'Mastered',
    QyAppLocalizationKeys.qyListeningAccuracyRate: 'Accuracy Rate',
    QyAppLocalizationKeys.qyListeningDictationTraining: 'Dictation Training',
    QyAppLocalizationKeys.qyListeningDictationTrainingDesc:
        'Improve spelling through listening',
    QyAppLocalizationKeys.qyListeningWordCount: '{count} words',
    QyAppLocalizationKeys.qyListeningUnlockAfterCurrentLevel:
        'Unlock after completing current level',
    QyAppLocalizationKeys.qyListeningDictationHelp: 'Dictation Help',
    QyAppLocalizationKeys.qyListeningHelpHowToPractice: 'How to Practice',
    QyAppLocalizationKeys.qyListeningHelpPracticeSteps:
        '1. Listen to the word\n2. Type what you heard\n3. Check your answer',
    QyAppLocalizationKeys.qyListeningHelpTipsContent:
        '• Pay attention to pronunciation\n• Practice daily for best results',
    QyAppLocalizationKeys.qyListeningDailyChallengeInDev:
        'Daily Challenge feature coming soon...',
    QyAppLocalizationKeys.qyListeningDailyChallenge: 'Daily Challenge',
    QyAppLocalizationKeys.qyListeningUnlockTip:
        'Unlock after completing current level',
    QyAppLocalizationKeys.qyListeningHelp: 'Dictation Training Help',
    QyAppLocalizationKeys.qyListeningHelpContent:
        '1. Choose appropriate difficulty level\n2. Click play button to hear word pronunciation\n3. Spell the word you heard in the input box\n4. Submit answer to view result',
    QyAppLocalizationKeys.qyListeningHelpTips:
        '• Can replay word pronunciation\n• Pay attention to capitalization\n• Can use hint function\n• Daily practice yields better results',
    QyAppLocalizationKeys.qyListeningGotIt: 'Got it',
    QyAppLocalizationKeys.qyListeningDailyChallengeComingSoon:
        'Daily challenge feature coming soon...',
    QyAppLocalizationKeys.qyListeningSelectCategory:
        'Select vocabulary category to start listening practice',
    QyAppLocalizationKeys.qyListeningPlaylist: 'Playlist',
    QyAppLocalizationKeys.qyListeningMinutes: 'minutes',
    QyAppLocalizationKeys.qyListeningDays: 'days',
    QyAppLocalizationKeys.qyListeningClickToPlay: 'Click to play audio',
    QyAppLocalizationKeys.qyListeningWriteWord: 'Write the word',
    QyAppLocalizationKeys.qyListeningInputWord: 'Enter the word you heard',
    QyAppLocalizationKeys.qyListeningPreviousAttempts: 'Previous attempts',
    QyAppLocalizationKeys.qyListeningHintShown: 'Hint shown',
    QyAppLocalizationKeys.qyListeningShowHint: 'Show hint',
    QyAppLocalizationKeys.qyListeningCheckAnswer: 'Check answer',
    QyAppLocalizationKeys.qyListeningReplay: 'Replay',
    QyAppLocalizationKeys.qyListeningEasy: 'Easy',
    QyAppLocalizationKeys.qyListeningMedium: 'Medium',
    QyAppLocalizationKeys.qyListeningHard: 'Hard',
    QyAppLocalizationKeys.qyListeningUnknown: 'Unknown',

    // Expert Dictation Level 3
    QyAppLocalizationKeys.qyListeningDictationExpertTitle: 'Expert Dictation',
    QyAppLocalizationKeys.qyListeningExpertProgress: 'Progress',
    QyAppLocalizationKeys.qyListeningStreak: 'Streak',
    QyAppLocalizationKeys.qyListeningAttempts: 'Attempts',
    QyAppLocalizationKeys.qyListeningLevel: 'Level',
    QyAppLocalizationKeys.qyListeningExpert: 'Expert',
    QyAppLocalizationKeys.qyListeningExpertLevel: 'Expert Level',
    QyAppLocalizationKeys.qyListeningExamples: 'Examples',
    QyAppLocalizationKeys.qyListeningPlayingExpert: 'Playing Expert Audio',
    QyAppLocalizationKeys.qyListeningClickExpert:
        'Click to play expert pronunciation',
    QyAppLocalizationKeys.qyListeningEnterExpert: 'Enter the word',
    QyAppLocalizationKeys.qyListeningInputExpert: 'Input the word you heard',
    QyAppLocalizationKeys.qyListeningAttemptHistory: 'Attempt History',
    QyAppLocalizationKeys.qyListeningWordPhenomenalMeaning:
        'Extraordinary, amazing',
    QyAppLocalizationKeys.qyListeningWordConscientiousMeaning:
        'Conscientious, diligent',
    QyAppLocalizationKeys.qyListeningWordUnprecedentedMeaning:
        'Unprecedented, unprecedented',
    QyAppLocalizationKeys.qyListeningWordEntrepreneurialMeaning:
        'Entrepreneurial, business-oriented',
    QyAppLocalizationKeys.qyListeningWordSophisticatedMeaning:
        'Sophisticated, complex, worldly',
    QyAppLocalizationKeys.qyListeningPlayingExpertAudio:
        'Playing expert pronunciation: {word}',
    QyAppLocalizationKeys.qyListeningCorrectAnswerLabel: 'Correct Answer',
    QyAppLocalizationKeys.qyListeningExpertCertified:
        'Expert Certification Passed!',
    QyAppLocalizationKeys.qyListeningChallengeComplete: 'Challenge Complete!',
    QyAppLocalizationKeys.qyListeningFinalAccuracy: 'Final Accuracy',
    QyAppLocalizationKeys.qyListeningCorrectWords: 'Correct Words',
    QyAppLocalizationKeys.qyListeningMaxStreak: 'Max Streak',
    QyAppLocalizationKeys.qyListeningPhonetic: 'Phonetic',
    QyAppLocalizationKeys.qyListeningVerifyAnswer: 'Verify Answer',
    QyAppLocalizationKeys.qyListeningSkip: 'Skip',
    QyAppLocalizationKeys.qyListeningStreakSuccess: 'Streak Success!',
    QyAppLocalizationKeys.qyListeningWordAppleMeaning: 'Apple',
    QyAppLocalizationKeys.qyListeningWordBeautifulMeaning: 'Beautiful',
    QyAppLocalizationKeys.qyListeningWordComputerMeaning: 'Computer',
    QyAppLocalizationKeys.qyListeningWordEducationMeaning: 'Education',
    QyAppLocalizationKeys.qyListeningWordFriendshipMeaning: 'Friendship',
    QyAppLocalizationKeys.qyListeningWordMagnificentMeaning:
        'Magnificent, splendid',
    QyAppLocalizationKeys.qyListeningWordExtraordinaryMeaning:
        'Extraordinary, special',
    QyAppLocalizationKeys.qyListeningWordAccomplishmentMeaning:
        'Achievement, completion',
    QyAppLocalizationKeys.qyListeningWordEnvironmentalMeaning: 'Environmental',
    QyAppLocalizationKeys.qyListeningWordRevolutionaryMeaning:
        'Revolutionary, innovative',
    QyAppLocalizationKeys.qyListeningSlow: 'Slow',
    QyAppLocalizationKeys.qyListeningNormal: 'Normal',
    QyAppLocalizationKeys.qyListeningFast: 'Fast',
    QyAppLocalizationKeys.qyListeningAnswerCorrect: 'Correct!',
    QyAppLocalizationKeys.qyListeningAnswerIncorrect: 'Incorrect',
    QyAppLocalizationKeys.qyListeningCorrectAnswerIs: 'Correct Answer:',
    QyAppLocalizationKeys.qyListeningContinue: 'Continue',
    QyAppLocalizationKeys.qyListeningRetry: 'Retry',
    QyAppLocalizationKeys.qyListeningDone: 'Done',
    QyAppLocalizationKeys.qyListeningTotalAttempts: 'Total Attempts:',
    QyAppLocalizationKeys.qyListeningPlayingAudio: 'Playing:',

    // Word Listening - Sleep Mode
    QyAppLocalizationKeys.qyListeningSleepTitle: 'Sleep Listening',
    QyAppLocalizationKeys.qyListeningSleepSubtitle:
        'Soothing words for better sleep',
    QyAppLocalizationKeys.qyListeningSleepCategorySoothing: 'Soothing Words',
    QyAppLocalizationKeys.qyListeningSleepCategoryNature: 'Nature Words',
    QyAppLocalizationKeys.qyListeningSleepCategoryStory: 'Story Words',
    QyAppLocalizationKeys.qyListeningSleepCategoryPoetry: 'Poetry Words',
    QyAppLocalizationKeys.qyListeningSleepCategoryMeditation:
        'Meditation Words',
    QyAppLocalizationKeys.qyListeningSleepSelectCategory:
        'Select Vocabulary Category',
    QyAppLocalizationKeys.qyListeningSleepDuration: 'Play Duration',
    QyAppLocalizationKeys.qyListeningSleepMinutes: '{minutes} minutes',
    QyAppLocalizationKeys.qyListeningSleepTipsTitle: 'Sleep Tips',
    QyAppLocalizationKeys.qyListeningSleepTip1:
        '• Avoid electronic devices 1 hour before bed',
    QyAppLocalizationKeys.qyListeningSleepTip2:
        '• Keep bedroom temperature between 18-22°C',
    QyAppLocalizationKeys.qyListeningSleepTip3: '• Use soft background music',
    QyAppLocalizationKeys.qyListeningSleepTip4:
        '• Adjust screen brightness to minimum',
    QyAppLocalizationKeys.qyListeningSleepStart: 'Start Sleep Listening',
    QyAppLocalizationKeys.qyListeningSleepPlaying: 'Playing soothing words...',
    QyAppLocalizationKeys.qyListeningSleepRemainingTime:
        'Remaining time: {time}',
    QyAppLocalizationKeys.qyListeningSleepProgress: 'Play Progress',
    QyAppLocalizationKeys.qyListeningSleepEnd: 'End Sleep Mode',
    QyAppLocalizationKeys.qyListeningSleepPrevious: 'Previous word',
    QyAppLocalizationKeys.qyListeningSleepNext: 'Next word',
    QyAppLocalizationKeys.qyListeningSleepEndTitle: 'Sleep Mode Ended',
    QyAppLocalizationKeys.qyListeningSleepEndMessage:
        'Hope you had a good sleep!\nPlayed {minutes} minutes of soothing words.',
    QyAppLocalizationKeys.qyListeningSleepContinue: 'Continue Listening',

    // Courses
    QyAppLocalizationKeys.qyCoursesTitle: 'Course Center',
    QyAppLocalizationKeys.qyCoursesFeatured: 'Featured Courses',
    QyAppLocalizationKeys.qyCoursesCategories: 'Course Categories',
    QyAppLocalizationKeys.qyCoursesTagline:
        'Professional Teachers • Systematic Learning',
    QyAppLocalizationKeys.qyCoursesCount: '{count} courses',
    QyAppLocalizationKeys.qyCoursesInDev: '{name} feature in development...',
    QyAppLocalizationKeys.qyCourseHotCategoriesTitle: 'Hot Categories',
    QyAppLocalizationKeys.qyCourseCategoryCet: 'CET-4/6',
    QyAppLocalizationKeys.qyCourseCategoryPostgraduate: 'Postgraduate Exam',
    QyAppLocalizationKeys.qyCourseCategoryOral: 'Practical Speaking',
    QyAppLocalizationKeys.qyCourseCategoryPython: 'Python',
    QyAppLocalizationKeys.qyCourseCategoryReading: 'Reading',
    QyAppLocalizationKeys.qyCourseCategoryCollege: 'College Prep',
    QyAppLocalizationKeys.qyCourseLearningFocusTitle: 'Learning Focus',
    QyAppLocalizationKeys.qyCourseFocusEfficientTitle: 'High-efficiency Prep',
    QyAppLocalizationKeys.qyCourseFocusEfficientSubtitle: '6-week sprint plan',
    QyAppLocalizationKeys.qyCourseFocusDailyTitle: 'Daily Conversation',
    QyAppLocalizationKeys.qyCourseFocusDailySubtitle:
        'Authentic expression set',
    QyAppLocalizationKeys.qyCourseFocusCareerTitle: 'Career Advancement',
    QyAppLocalizationKeys.qyCourseFocusCareerSubtitle:
        'Business writing & presenting',
    QyAppLocalizationKeys.qyCourseVipLabel: 'VIP Annual Pass',
    QyAppLocalizationKeys.qyCourseVipHeadline:
        'Career Boost: From Beginner to Pro',
    QyAppLocalizationKeys.qyCourseVipSubhead:
        'Business speaking plan • Best price of the year',
    QyAppLocalizationKeys.qyCourseVipBenefit1:
        'Best annual price • includes Qianyu VIP annual pass',
    QyAppLocalizationKeys.qyCourseVipBenefit2:
        'Covers Vocabulary / Reading / Listening & Speaking / Postgraduate',
    QyAppLocalizationKeys.qyCourseVipBenefit3:
        'AI learning path • Study anytime, anywhere',
    QyAppLocalizationKeys.qyCourseVipCta: 'Activate Now',
    QyAppLocalizationKeys.qyCoursePlanBadgeAdvanced: 'Advanced Plan',
    QyAppLocalizationKeys.qyCoursePlanBadgeFlagship: 'Flagship Course',
    QyAppLocalizationKeys.qyCoursePlanTitleCareerUpgrade:
        'Career Boost: From Beginner to Expert',
    QyAppLocalizationKeys.qyCoursePlanDescriptionCareerUpgrade:
        'Master business communication, meeting delivery, and project reporting step by step.',
    QyAppLocalizationKeys.qyCoursePlanDuration12Weeks: '12 weeks',
    QyAppLocalizationKeys.qyCoursePlanTitleBusinessCommunication:
        'Business Speaking Program',
    QyAppLocalizationKeys.qyCoursePlanDescriptionBusinessCommunication:
        'Immerse yourself in real scenarios to strengthen practical dialogue.',
    QyAppLocalizationKeys.qyCoursePlanDuration24Lessons: '24 lessons',
    QyAppLocalizationKeys.qyCoursePlanActionExperience: 'Experience Now',
    QyAppLocalizationKeys.qyCoursePlanActionDetails: 'View Details',
    QyAppLocalizationKeys.qyCoursePlanActionStart: 'Start Now',
    QyAppLocalizationKeys.qyCourseOpening: 'Opening course',
    QyAppLocalizationKeys.qyCourseVipSnackbar:
        'VIP annual pass benefits are loading...',
    QyAppLocalizationKeys.qyCoursePythonZoneTitle: 'Python Learning Hub',
    QyAppLocalizationKeys.qyCourseDigitalSkill: 'Digital-age core skill',
    QyAppLocalizationKeys.qyCoursePythonPathTitle:
        'Python Full-stack Learning Path',
    QyAppLocalizationKeys.qyCoursePythonPathDescription:
        '21-day foundation, 14-day advance, data analysis and case practice in one track.',
    QyAppLocalizationKeys.qyCourseBadgeIntro: 'Beginner',
    QyAppLocalizationKeys.qyCourseBadgeIntermediate: 'Intermediate',
    QyAppLocalizationKeys.qyCourseBadgePopular: 'Popular',
    QyAppLocalizationKeys.qyCourseBadgePractical: 'Practical',
    QyAppLocalizationKeys.qyCourseVipFreeTag: 'VIP annual pass included',
    QyAppLocalizationKeys.qyCoursePythonIntroTitle: 'Python 21-day Foundation',
    QyAppLocalizationKeys.qyCoursePythonIntroSubtitle:
        'Beyond English—learn the language of the future',
    QyAppLocalizationKeys.qyCoursePythonAdvanceTitle: 'Python 14-day Advance',
    QyAppLocalizationKeys.qyCoursePythonAdvanceSubtitle:
        'Level up your skills quickly',
    QyAppLocalizationKeys.qyCoursePythonDataTitle: 'Python Data Analysis',
    QyAppLocalizationKeys.qyCoursePythonDataSubtitle:
        'Use code to empower data and efficiency',
    QyAppLocalizationKeys.qyCoursePythonCasesTitle: 'Data Analysis Case Lab',
    QyAppLocalizationKeys.qyCoursePythonCasesSubtitle:
        'Data mindset + three essential analysis tools',
    QyAppLocalizationKeys.qyCourseExperienceZoneTitle: 'Experience Zone',
    QyAppLocalizationKeys.qyCourseVipExperienceSubtitle:
        'Best price of the year • Includes Qianyu VIP annual pass',
    QyAppLocalizationKeys.qyCourseVipCoverage:
        'Enjoy full access to Vocabulary, Reading, Listening & Speaking, and Postgraduate content.',
    QyAppLocalizationKeys.qyCoursePlanCategoryIelts: 'IELTS',
    QyAppLocalizationKeys.qyCoursePlanCategoryGaokao: 'College Entrance',
    QyAppLocalizationKeys.qyCoursePlanCategoryMiddle: 'Junior/Middle Exams',
    QyAppLocalizationKeys.qyCoursePlanAllSkillTagline:
        'All-round skills · Listening · Speaking · Reading · Writing',
    QyAppLocalizationKeys.qyCoursePlanAllSkillDescription:
        'Weekly modules with live evaluation and personalised review.',
    QyAppLocalizationKeys.qyCoursePlanClassicTitle: 'Classic Reading Intensive',
    QyAppLocalizationKeys.qyCoursePlanClassicName:
        '7-day English Originals Starter Plan',
    QyAppLocalizationKeys.qyCoursePlanClassicStats: '31k learners · 7 days',
    QyAppLocalizationKeys.qyCoursePlanOralTitle: 'Authentic Oral Practice',
    QyAppLocalizationKeys.qyCoursePlanOralName: '7-day Everyday English Plan',
    QyAppLocalizationKeys.qyCoursePlanOralStats: '12k learners · 7 days',
    QyAppLocalizationKeys.qyCoursePlanReadingTitle: 'Reading & Writing Booster',
    QyAppLocalizationKeys.qyCoursePlanViewMore: 'View More',
    QyAppLocalizationKeys.qyCoursePlanTextbookSync: 'Textbook Sync',
    QyAppLocalizationKeys.qyCoursePlanTextbookTitle:
        'Yilin Grade 7 Extension (Semester 1)',
    QyAppLocalizationKeys.qyCoursePlanReadingBrand: 'Qianyu Reading',
    QyAppLocalizationKeys.qyCoursePlanFurtherStudy:
        'Further Study companion reader',
    QyAppLocalizationKeys.qyCoursePlanTextbookGrade: 'Yilin Grade 7',
    QyAppLocalizationKeys.qyCoursePlanMoreComing: 'More plans coming soon',

    // Course Detail
    QyAppLocalizationKeys.qyCourseContinue: 'Continue Learning',
    QyAppLocalizationKeys.qyCourseContinueCoding: 'Continue Coding',
    QyAppLocalizationKeys.qyCourseOverview: 'Overview',
    QyAppLocalizationKeys.qyCourseLessons: 'Lessons',
    QyAppLocalizationKeys.qyCourseProjects: 'Projects',
    QyAppLocalizationKeys.qyCourseProgress: 'Progress',
    QyAppLocalizationKeys.qyOverview: 'Overview',
    QyAppLocalizationKeys.qyCurriculum: 'Curriculum',
    QyAppLocalizationKeys.qyReviews: 'Reviews',
    QyAppLocalizationKeys.qyUserReviews: 'User Reviews',
    QyAppLocalizationKeys.qyAboutCourse: 'About Course',
    QyAppLocalizationKeys.qyInstructor: 'Instructor',
    QyAppLocalizationKeys.qyLevel: 'Level',
    QyAppLocalizationKeys.qyDuration: 'Duration',
    QyAppLocalizationKeys.qyPrice: 'Price',
    QyAppLocalizationKeys.qyEnrolled: 'Enrolled',
    QyAppLocalizationKeys.qyEnrollNow: 'Enroll Now',
    QyAppLocalizationKeys.qyCourseEnrolled: 'Enrolled in Course',
    QyAppLocalizationKeys.qyCourseUnenrolled: 'Not Enrolled',
    QyAppLocalizationKeys.qyLessonComplete: 'Lesson Complete',
    QyAppLocalizationKeys.qyCongratulations: 'Congratulations',
    QyAppLocalizationKeys.qySection: 'Section',
    QyAppLocalizationKeys.qyPause: 'Pause',
    QyAppLocalizationKeys.qyPlay: 'Play',
    QyAppLocalizationKeys.qyQuestions: 'Questions',
    QyAppLocalizationKeys.qyStartQuiz: 'Start Quiz',
    QyAppLocalizationKeys.qyOverallProgress: 'Overall Progress',
    QyAppLocalizationKeys.qyLessonsCompleted: 'Lessons Completed',
    QyAppLocalizationKeys.qyRemaining: 'Remaining',
    QyAppLocalizationKeys.qyAvgScore: 'Average Score',
    QyAppLocalizationKeys.qyChapters: 'Chapters',
    QyAppLocalizationKeys.qyLessons: 'Lessons',
    QyAppLocalizationKeys.qyHelpful: 'Helpful',
    QyAppLocalizationKeys.qySearchCourses: 'Search Courses',
    QyAppLocalizationKeys.qyBusiness: 'Business',
    QyAppLocalizationKeys.qyTestPrep: 'Test Prep',
    QyAppLocalizationKeys.qyGeneral: 'General',
    QyAppLocalizationKeys.qyAcademic: 'Academic',
    QyAppLocalizationKeys.qyRecentSearches: 'Recent Searches',
    QyAppLocalizationKeys.qyPopularSearches: 'Popular Searches',
    QyAppLocalizationKeys.qyDownloading: 'Downloading',
    QyAppLocalizationKeys.qySharing: 'Sharing',
    QyAppLocalizationKeys.qyCertificate: 'Certificate',
    QyAppLocalizationKeys.qyCertificateOfCompletion:
        'Certificate of Completion',
    QyAppLocalizationKeys.qyThisCertifies: 'This Certifies That',
    QyAppLocalizationKeys.qyHasSuccessfullyCompleted:
        'Has Successfully Completed',
    QyAppLocalizationKeys.qyCompletionDate: 'Completion Date',
    QyAppLocalizationKeys.qyFinalScore: 'Final Score',
    QyAppLocalizationKeys.qyVerifiedCertificate: 'Verified Certificate',
    QyAppLocalizationKeys.qyCertificateId: 'Certificate ID',
    QyAppLocalizationKeys.qyIssued: 'Issued',
    QyAppLocalizationKeys.qyStatus: 'Status',
    QyAppLocalizationKeys.qyValid: 'Valid',
    QyAppLocalizationKeys.qyPrint: 'Print',
    QyAppLocalizationKeys.qyCourseLearningProgress:
        'Programming Learning Progress',
    QyAppLocalizationKeys.qyCourseCompletedLessons:
        'Completed {completed}/{total} lessons',
    QyAppLocalizationKeys.qyCourseConsecutiveDays: 'Streak {days} days',
    QyAppLocalizationKeys.qyCourseProjectsCompleted:
        'Completed {count} projects',
    QyAppLocalizationKeys.qyCourseLinesOfCode: 'Coded {lines} lines',
    QyAppLocalizationKeys.qyCourseInfo: 'Course Information',
    QyAppLocalizationKeys.qyCourseDuration: 'Course Duration',
    QyAppLocalizationKeys.qyCourseCodePractice: 'Code Practice',
    QyAppLocalizationKeys.qyCourseDifficultyProgression:
        'Difficulty Progression',
    QyAppLocalizationKeys.qyCourseRating: 'Course Rating',
    QyAppLocalizationKeys.qyCourseFeatures: 'Course Features',
    QyAppLocalizationKeys.qyCourseInstructor: 'Instructor',
    QyAppLocalizationKeys.qyCourseLearningPath: 'Learning Path',
    QyAppLocalizationKeys.qyCourseCurriculum: 'Curriculum',
    QyAppLocalizationKeys.qyCourseWeek: 'Week {week}',
    QyAppLocalizationKeys.qyCourseModule: 'Module',
    QyAppLocalizationKeys.qyCourseCompleted: 'Completed',
    QyAppLocalizationKeys.qyCourseInProgress: 'In Progress',
    QyAppLocalizationKeys.qyCourseLocked: 'Locked',
    QyAppLocalizationKeys.qyCourseStart: 'Start Learning',
    QyAppLocalizationKeys.qyCourseResume: 'Resume Learning',

    // Common
    QyAppLocalizationKeys.qyCommonOk: 'OK',
    QyAppLocalizationKeys.qyCommonGotIt: 'Got it',

    // Home Page
    QyAppLocalizationKeys.qyHomeStudy: 'Study',
    QyAppLocalizationKeys.qyHomeCourse: 'Course',
    QyAppLocalizationKeys.qyHomeAi: 'AI Study',
    QyAppLocalizationKeys.qyHomeDiscover: 'Discover',
    QyAppLocalizationKeys.qyHomeProfile: 'Me',
    QyAppLocalizationKeys.qyHomeMoreFeatures: 'More Features',
    QyAppLocalizationKeys.qyHomeConsolidate: 'Consolidate',
    QyAppLocalizationKeys.qyHomeWordTest: 'Word Test',
    QyAppLocalizationKeys.qyHomePortableListening: 'Portable Listening',
    QyAppLocalizationKeys.qyHomePhrase: 'Phrase',
    QyAppLocalizationKeys.qyHomeSpeedReview: 'Speed Review',
    QyAppLocalizationKeys.qyHomeExtension: 'Extension',
    QyAppLocalizationKeys.qyHomeReading: 'Reading',
    QyAppLocalizationKeys.qyHomeListeningSpeaking: 'Listening & Speaking',
    QyAppLocalizationKeys.qyHomeLearnSettings: 'Learn Settings',
    QyAppLocalizationKeys.qyHomeLearnData: 'Learn Data',
    QyAppLocalizationKeys.qyHomeWatchImpact: 'Watch the Impact',
    QyAppLocalizationKeys.qyHomeLearned: 'Learned',
    QyAppLocalizationKeys.qyHomeWordsTotal: 'words',
    QyAppLocalizationKeys.qyHomeNewWords: 'New Words',
    QyAppLocalizationKeys.qyHomeReviewWords: 'Review Words',
    QyAppLocalizationKeys.qyHomeStartLearning: 'Start Learning',
    QyAppLocalizationKeys.qyHomeCheckInDays: 'Check-in Days',
    QyAppLocalizationKeys.qyHomeBadges: 'Badges',

    // Login Page
    QyAppLocalizationKeys.qyLoginSlogan1: 'Every word',
    QyAppLocalizationKeys.qyLoginSlogan2: 'counts here',
    QyAppLocalizationKeys.qyLoginPhoneNumber: 'Phone Number',
    QyAppLocalizationKeys.qyLoginByPhone: 'Login with Phone',
    QyAppLocalizationKeys.qyLoginByWechat: 'WeChat Login',
    QyAppLocalizationKeys.qyLoginByAccount: 'Account Login',
    QyAppLocalizationKeys.qyLoginByWeibo: 'Weibo',
    QyAppLocalizationKeys.qyLoginRememberWords: 'Remember Words',
    QyAppLocalizationKeys.qyLoginRecordChange: 'Record Change',
    QyAppLocalizationKeys.qyPleaseEnterPhone: 'Please enter phone number',
    QyAppLocalizationKeys.qyPleaseAgreeTerms: 'Please agree to terms',
    QyAppLocalizationKeys.qyPleaseCompleteForm: 'Please complete the form',
    QyAppLocalizationKeys.qyEnterPhone: 'Enter phone number',
    QyAppLocalizationKeys.qyEnterCode: 'Enter verification code',
    QyAppLocalizationKeys.qySendCode: 'Send Code',
    QyAppLocalizationKeys.qyAgreeToTermsPrefix: 'I agree to ',
    QyAppLocalizationKeys.qyUserAgreement: 'User Agreement',
    QyAppLocalizationKeys.qyAnd: ' and ',
    QyAppLocalizationKeys.qyGetCode: 'Get Code',
    QyAppLocalizationKeys.qyOtherLoginMethods: 'Other Login Methods',
    QyAppLocalizationKeys.qyVerificationCode: 'Verification Code',
    QyAppLocalizationKeys.qyLoginToContinue: 'Login to continue learning',
    QyAppLocalizationKeys.qyLoginWithUsername: 'Login with Username',
    QyAppLocalizationKeys.qyLoginWithPhone: 'Login with Phone',
    QyAppLocalizationKeys.qyAgreeToTermsAndPrivacy:
        'I agree to the Terms and Privacy Policy',
    QyAppLocalizationKeys.qyPleaseAgreeToTerms:
        'Please agree to the terms and privacy policy',
    QyAppLocalizationKeys.qyPleaseEnterPhoneAndCode:
        'Please enter phone number and verification code',
    QyAppLocalizationKeys.qyPleaseEnterUsernameAndPassword:
        'Please enter username and password',
    QyAppLocalizationKeys.qyFailedToSendCode: 'Failed to send code',
    QyAppLocalizationKeys.qyWechat: 'WeChat',
    QyAppLocalizationKeys.qyQyAccount: 'QY Account',
    QyAppLocalizationKeys.qyWeibo: 'Weibo',

    // Common
    QyAppLocalizationKeys.qyGuest: 'Guest',
    QyAppLocalizationKeys.qySearching: 'Searching',
    QyAppLocalizationKeys.qyCourse: 'Course',
    QyAppLocalizationKeys.qyViewAll: 'View All',

    // Course Categories
    QyAppLocalizationKeys.qyCourseCategoryFeatured: 'Featured',
    QyAppLocalizationKeys.qyCourseCategoryIelts: 'IELTS',
    QyAppLocalizationKeys.qyCourseCategoryGaokao: 'Gaokao',
    QyAppLocalizationKeys.qyCourseCategoryMiddle: 'Middle School',

    // Course Details
    QyAppLocalizationKeys.qyTodayFeatured: 'Today\'s Featured',
    QyAppLocalizationKeys.qyUpdatedDaily: 'Updated Daily',
    QyAppLocalizationKeys.qyCourseFeaturedTitle1:
        'The World\'s Most Dangerous Pizza',
    QyAppLocalizationKeys.qyCourseFeaturedTitle2:
        'Taizhou stuns Nantong to win...',
    QyAppLocalizationKeys.qyCourseListening: 'Listening',
    QyAppLocalizationKeys.qyCourseLevelIntermediate: 'Intermediate',
    QyAppLocalizationKeys.qyCourseFood: 'Food',
    QyAppLocalizationKeys.qyCourseReading: 'Reading',
    QyAppLocalizationKeys.qyCourseLevelBeginner: 'Beginner',
    QyAppLocalizationKeys.qyRecommendedCourses: 'Recommended Courses',
    QyAppLocalizationKeys.qyExclusivePlans: 'Exclusive Plans',
    QyAppLocalizationKeys.qyStartLearning: 'Start Learning',
    QyAppLocalizationKeys.qyContinueLearning: 'Continue Learning',
    QyAppLocalizationKeys.qyPlanName: 'Plan Name',
    QyAppLocalizationKeys.qyPlanDescription: 'Plan Description',
    QyAppLocalizationKeys.qyLessonCompleted: 'Lesson Completed',
    QyAppLocalizationKeys.qyTotalLessons: 'Total Lessons',
    QyAppLocalizationKeys.qyFreeLesson: 'Free',
    QyAppLocalizationKeys.qyPremiumLesson: 'Premium',

    // Course Plans
    QyAppLocalizationKeys.qyViewPlans: 'View Plans',
    QyAppLocalizationKeys.qyVipPromotionTitle: 'VIP Promotion',
    QyAppLocalizationKeys.qyVipYearCard: 'Annual VIP',
    QyAppLocalizationKeys.qyVipBenefits: 'VIP Benefits',
    QyAppLocalizationKeys.qyActivateNow: 'Activate Now',
    QyAppLocalizationKeys.qyLearningPlans: 'Learning Plans',
    QyAppLocalizationKeys.qyNoPlansYet: 'No Plans Yet',
    QyAppLocalizationKeys.qyCreateFirstPlan: 'Create First Plan',
    QyAppLocalizationKeys.qySelectGoal: 'Select Goal',
    QyAppLocalizationKeys.qySelectTime: 'Select Time',
    QyAppLocalizationKeys.qySelectCourse: 'Select Course',
    QyAppLocalizationKeys.qyDiscoverPerfectPlan: 'Discover Your Perfect Plan',
    QyAppLocalizationKeys.qyNoPlans: 'No Plans',
    QyAppLocalizationKeys.qyAllPlans: 'All Plans',
    QyAppLocalizationKeys.qyJoined: 'Joined',
    QyAppLocalizationKeys.qyJoinPlan: 'Join Plan',

    // Word Learning
    QyAppLocalizationKeys.qyGeneralSearch: 'General Search',
    QyAppLocalizationKeys.qyBookSearch: 'Book Search',
    QyAppLocalizationKeys.qyTotal: 'Total',
    QyAppLocalizationKeys.qyLearned: 'Learned',
    QyAppLocalizationKeys.qyStarting: 'Starting',
    QyAppLocalizationKeys.qyWordNewWordBook: 'New Word Book',
    QyAppLocalizationKeys.qyWordProgress: 'Word Progress',
    QyAppLocalizationKeys.qyWordPaused: 'Paused',
    QyAppLocalizationKeys.qyWordResume: 'Resume',
    QyAppLocalizationKeys.qyWordPause: 'Pause',
    QyAppLocalizationKeys.qyWordCompleted: 'Completed',
    QyAppLocalizationKeys.qyWordUnlocked: 'Unlocked',
    QyAppLocalizationKeys.qyWordLocked: 'Locked',
    QyAppLocalizationKeys.qyWordBookDesc: 'Word Book Description',
    QyAppLocalizationKeys.qyWordBookWordResilientMeaning:
        'Able to recover quickly from difficult conditions.',
    QyAppLocalizationKeys.qyWordBookWordResilientExample:
        'She stays resilient no matter how tough the challenge becomes.',
    QyAppLocalizationKeys.qyWordBookWordParadigmMeaning:
        'A standard example or pattern for something.',
    QyAppLocalizationKeys.qyWordBookWordParadigmExample:
        'The team is shifting the entire business paradigm this year.',
    QyAppLocalizationKeys.qyWordBookWordEphemeralMeaning:
        'Lasting for a very short time.',
    QyAppLocalizationKeys.qyWordBookWordEphemeralExample:
        'Cherry blossoms are beautiful yet ephemeral.',
    QyAppLocalizationKeys.qyWordBookWordUbiquitousMeaning:
        'Present, appearing, or found everywhere.',
    QyAppLocalizationKeys.qyWordBookWordUbiquitousExample:
        'Smartphones have become ubiquitous across the world.',
    QyAppLocalizationKeys.qyWordBookWordMeticulousMeaning:
        'Showing great attention to detail; very careful and precise.',
    QyAppLocalizationKeys.qyWordBookWordMeticulousExample:
        'Her meticulous notes make every project easier.',
    QyAppLocalizationKeys.qyWordBookWordSerendipityMeaning:
        'The chance occurrence of fortunate discoveries.',
    QyAppLocalizationKeys.qyWordBookWordSerendipityExample:
        'It was pure serendipity that led them to the solution.',
    QyAppLocalizationKeys.qyWordVocabulary: 'Vocabulary',

    // Word Listening AI Explain
    QyAppLocalizationKeys.qyListeningAIExplainTitle: 'AI Explanation',
    QyAppLocalizationKeys.qyListeningAIAnalyzing: 'AI is analyzing...',
    QyAppLocalizationKeys.qyListeningAIAnalysis: 'AI Analysis',
    QyAppLocalizationKeys.qyListeningEtymology: 'Etymology',
    QyAppLocalizationKeys.qyListeningSynonyms: 'Synonyms',
    QyAppLocalizationKeys.qyListeningAntonyms: 'Antonyms',
    QyAppLocalizationKeys.qyListeningCollocations: 'Collocations',
    QyAppLocalizationKeys.qyListeningStartPractice: 'Start Practice',
    QyAppLocalizationKeys.qyListeningBackToStudy: 'Back to Study',
    QyAppLocalizationKeys.qyListeningShareInDev:
        'Share feature is under development',
    QyAppLocalizationKeys.qyListeningPracticeInDev:
        'Practice feature is under development',

    // IELTS Course Detail
    QyAppLocalizationKeys.qyIeltsCourseInfo: 'Course Information',
    QyAppLocalizationKeys.qyIeltsCourseDuration: 'Duration',
    QyAppLocalizationKeys.qyIeltsCourseLessons: 'Lessons',
    QyAppLocalizationKeys.qyIeltsCourseLevel: 'Level',
    QyAppLocalizationKeys.qyIeltsCourseRating: 'Rating',
    QyAppLocalizationKeys.qyIeltsCourseFeatures: 'Course Features',
    QyAppLocalizationKeys.qyIeltsCourseInstructor: 'Instructor',
    QyAppLocalizationKeys.qyIeltsCourseInstructorDesc:
        'Senior IELTS Training Expert\n10 years of teaching experience',
    QyAppLocalizationKeys.qyIeltsCourseOutline: 'Course Outline',
    QyAppLocalizationKeys.qyIeltsCourseContent: 'Course Content',
    QyAppLocalizationKeys.qyIeltsLessonListening: 'Listening Training',
    QyAppLocalizationKeys.qyIeltsLessonReading: 'Reading Comprehension',
    QyAppLocalizationKeys.qyIeltsLessonWriting: 'Writing Skills',
    QyAppLocalizationKeys.qyIeltsLessonSpeaking: 'Speaking Practice',
    QyAppLocalizationKeys.qyIeltsLessonCompleted:
        'Completed {completed}/{total} lessons',
    QyAppLocalizationKeys.qyIeltsPracticeAndTest: 'Practice & Tests',
    QyAppLocalizationKeys.qyIeltsPracticeMockTest: 'Mock Test',
    QyAppLocalizationKeys.qyIeltsPracticeMockTestDesc:
        'Complete IELTS mock exam',
    QyAppLocalizationKeys.qyIeltsPracticeMockTestDuration: '2 hours 45 minutes',
    QyAppLocalizationKeys.qyIeltsPracticeSkill: 'Skill Practice',
    QyAppLocalizationKeys.qyIeltsPracticeSkillDesc:
        'Targeted skill reinforcement',
    QyAppLocalizationKeys.qyIeltsPracticeSkillDuration: '30-60 minutes',
    QyAppLocalizationKeys.qyIeltsPracticePastPapers: 'Past Papers',
    QyAppLocalizationKeys.qyIeltsPracticePastPapersDesc:
        'Selected past exam questions',
    QyAppLocalizationKeys.qyIeltsPracticePastPapersDuration: '45-90 minutes',
    QyAppLocalizationKeys.qyIeltsPracticeSpeaking: 'Speaking Practice',
    QyAppLocalizationKeys.qyIeltsPracticeSpeakingDesc:
        'AI-powered speaking dialogue',
    QyAppLocalizationKeys.qyIeltsPracticeSpeakingDuration: '15-30 minutes',
    QyAppLocalizationKeys.qyIeltsLearningStats: 'Learning Statistics',
    QyAppLocalizationKeys.qyIeltsStudyDays: 'Study Days',
    QyAppLocalizationKeys.qyIeltsCompletedLessons: 'Completed Lessons',
    QyAppLocalizationKeys.qyIeltsPracticeHours: 'Practice Hours',
    QyAppLocalizationKeys.qyIeltsAverageScore: 'Average Score',
    QyAppLocalizationKeys.qyIeltsProgressTrend: 'Learning Progress Trend',
    QyAppLocalizationKeys.qyIeltsProgressChartPlaceholder:
        '📊 Learning Progress Chart\n(Chart library integration needed)',
    QyAppLocalizationKeys.qyIeltsAchievements: 'Achievements',
    QyAppLocalizationKeys.qyIeltsAchievementStreak7: '7-Day Study Streak',
    QyAppLocalizationKeys.qyIeltsAchievementFirstTest:
        'First Mock Test Completed',
    QyAppLocalizationKeys.qyIeltsAchievementListeningBreakthrough:
        'Listening Skill Breakthrough',
    QyAppLocalizationKeys.qyIeltsAchievementPerfectScore:
        'Perfect Score Achievement',

    // Python Course Detail
    QyAppLocalizationKeys.qyPythonModuleBasics: 'Python Basics',
    QyAppLocalizationKeys.qyPythonModuleBasicsDesc:
        'Variables, data types, control flow',
    QyAppLocalizationKeys.qyPythonModuleOOP: 'Object-Oriented Programming',
    QyAppLocalizationKeys.qyPythonModuleOOPDesc:
        'Classes, objects, inheritance, polymorphism',
    QyAppLocalizationKeys.qyPythonModuleWeb: 'Web Development Frameworks',
    QyAppLocalizationKeys.qyPythonModuleWebDesc: 'Django, Flask, FastAPI',
    QyAppLocalizationKeys.qyPythonModuleDataAnalysis:
        'Data Analysis & Visualization',
    QyAppLocalizationKeys.qyPythonModuleDataAnalysisDesc:
        'NumPy, Pandas, Matplotlib',
    QyAppLocalizationKeys.qyPythonModuleML: 'Machine Learning Introduction',
    QyAppLocalizationKeys.qyPythonModuleMLDesc:
        'Scikit-learn, TensorFlow basics',
    QyAppLocalizationKeys.qyPythonModuleProject: 'Project Practice',
    QyAppLocalizationKeys.qyPythonModuleProjectDesc:
        'Complete project development workflow',
    QyAppLocalizationKeys.qyPythonModuleDuration2Weeks: '2 weeks',
    QyAppLocalizationKeys.qyPythonModuleDuration2_5Weeks: '2.5 weeks',
    QyAppLocalizationKeys.qyPythonModuleDuration3Weeks: '3 weeks',
    QyAppLocalizationKeys.qyPythonModuleDuration3_5Weeks: '3.5 weeks',
    QyAppLocalizationKeys.qyPythonModuleDuration4Weeks: '4 weeks',
    QyAppLocalizationKeys.qyPythonProjects: 'Programming Projects',
    QyAppLocalizationKeys.qyPythonProjectTodo: 'Todo Application',
    QyAppLocalizationKeys.qyPythonProjectDashboard:
        'Data Visualization Dashboard',
    QyAppLocalizationKeys.qyPythonProjectScraper: 'Web Scraper',
    QyAppLocalizationKeys.qyPythonProjectScraperDesc:
        'Scrape e-commerce website data and analyze',
    QyAppLocalizationKeys.qyPythonProjectBlog: 'Blog Website',
    QyAppLocalizationKeys.qyPythonProjectML:
        'Machine Learning Prediction Model',
    QyAppLocalizationKeys.qyPythonProjectMLDesc:
        'Regression analysis project for house price prediction',
    QyAppLocalizationKeys.qyPythonDifficultyBeginner: 'Beginner',
    QyAppLocalizationKeys.qyPythonDifficultyIntermediate: 'Intermediate',
    QyAppLocalizationKeys.qyPythonDifficultyAdvanced: 'Advanced',
    QyAppLocalizationKeys.qyPythonStatusCompleted: 'Completed',
    QyAppLocalizationKeys.qyPythonStatusInProgress: 'In Progress',
    QyAppLocalizationKeys.qyPythonStatusLocked: 'Locked',
    QyAppLocalizationKeys.qyPythonCodingStats: 'Coding Statistics',
    QyAppLocalizationKeys.qyPythonCodingDays: 'Coding Days',
    QyAppLocalizationKeys.qyPythonCompletedProjects: 'Completed Projects',
    QyAppLocalizationKeys.qyPythonLinesOfCode: 'Lines of Code',
    QyAppLocalizationKeys.qyPythonPracticeHours: 'Practice Hours',
    QyAppLocalizationKeys.qyPythonCodingActivity: 'Coding Activity',
    QyAppLocalizationKeys.qyPythonCodingActivityChart:
        '📈 Coding Activity Chart\n(Shows daily coding time and commit count)',
    QyAppLocalizationKeys.qyPythonSkillsProgress: 'Skills Progress',
    QyAppLocalizationKeys.qyPythonSkillBasics: 'Python Basics',
    QyAppLocalizationKeys.qyPythonSkillOOP: 'Object-Oriented',
    QyAppLocalizationKeys.qyPythonSkillWeb: 'Web Development',
    QyAppLocalizationKeys.qyPythonSkillDataAnalysis: 'Data Analysis',
    QyAppLocalizationKeys.qyPythonSkillML: 'Machine Learning',

    // Route Navigation Example
    QyAppLocalizationKeys.qyRouteNavigationExample: 'Route Navigation Example',
    QyAppLocalizationKeys.qyRouteKeysManagement: 'Route Keys Management',
    QyAppLocalizationKeys.qyRouteKeysManagementDesc:
        'Route keys are defined directly in the route provider files, eliminating the need to maintain separate constant files. This approach ensures that route definitions and their keys are always in sync.',
    QyAppLocalizationKeys.qyAppRoutes: 'QY App Routes',
    QyAppLocalizationKeys.qyRouteHomeDesc: 'Main landing page of the QY app',
    QyAppLocalizationKeys.qyRouteProfileDesc: 'User profile management page',
    QyAppLocalizationKeys.qyRouteSettingsDesc:
        'Application settings and preferences',
    QyAppLocalizationKeys.qyRouteDashboardDesc:
        'Analytics and overview dashboard',
    QyAppLocalizationKeys.qyRouteBenefitsTitle: 'Benefits of This Approach',
    QyAppLocalizationKeys.qyRouteBenefitsContent:
        '• Route keys and definitions are in the same file\n• No need to maintain separate constant files\n• Easier to modify routes without opening multiple files\n• Reduced chance of inconsistencies\n• Better code organization and maintainability',
    QyAppLocalizationKeys.qyGo: 'Go',

    // Word Listening Audio Items
    QyAppLocalizationKeys.qyListeningWordResilientMeaning:
        'Resilient; able to recover quickly',
    QyAppLocalizationKeys.qyListeningWordResilientExample:
        'She\'s a resilient person who bounces back from adversity.',
    QyAppLocalizationKeys.qyListeningWordParadigmMeaning: 'Paradigm; pattern',
    QyAppLocalizationKeys.qyListeningWordParadigmExample:
        'The company is shifting its business paradigm.',
    QyAppLocalizationKeys.qyListeningWordEphemeralMeaning:
        'Ephemeral; transient; short-lived',
    QyAppLocalizationKeys.qyListeningWordEphemeralExample:
        'The beauty of cherry blossoms is ephemeral.',
    QyAppLocalizationKeys.qyListeningWordUbiquitousMeaning:
        'Ubiquitous; present everywhere',
    QyAppLocalizationKeys.qyListeningWordUbiquitousExample:
        'Smartphones have become ubiquitous in modern society.',
    QyAppLocalizationKeys.qyListeningWordMeticulousMeaning:
        'Meticulous; very careful and precise',
    QyAppLocalizationKeys.qyListeningWordMeticulousExample:
        'She is meticulous in her research and documentation.',
    QyAppLocalizationKeys.qyListeningWordSerendipityMeaning:
        'Serendipity; the occurrence of pleasant discoveries by accident',
    QyAppLocalizationKeys.qyListeningWordSerendipityExample:
        'It was pure serendipity that led to their discovery.',
    QyAppLocalizationKeys.qyListeningWordSimpleMeaning:
        'Simple; plain; uncomplicated',
    QyAppLocalizationKeys.qyListeningWordSimpleExample:
        'The solution is quite simple.',

    // Course Plan Data
    QyAppLocalizationKeys.qyCoursePlan7DayReadingTitle:
        '7-Day English Reading Starter Plan',
    QyAppLocalizationKeys.qyCoursePlan7DayReadingSubtitle:
        'Read Original Classics',
    QyAppLocalizationKeys.qyCoursePlan7DayReadingDesc:
        'Master English reading skills through 7 days of systematic learning',
    QyAppLocalizationKeys.qyCoursePlan7DaySpeakingTitle:
        '7-Day Daily English Plan',
    QyAppLocalizationKeys.qyCoursePlan7DaySpeakingSubtitle:
        'Build Authentic Speaking Skills',
    QyAppLocalizationKeys.qyCoursePlan7DaySpeakingDesc:
        'Learn daily English conversations and practical expressions',

    // Word Book Data
    QyAppLocalizationKeys.qyWordBookCoca20000: 'COCA Corpus 20000',
    QyAppLocalizationKeys.qyWordBookCoca20000Desc:
        'High-frequency vocabulary from the Corpus of Contemporary American English',
    QyAppLocalizationKeys.qyWordBookIelts: 'IELTS Vocabulary',
    QyAppLocalizationKeys.qyWordBookIeltsDesc: 'IELTS core vocabulary',
    QyAppLocalizationKeys.qyWordBookCet46: 'CET-4/6 Vocabulary',
    QyAppLocalizationKeys.qyWordBookCet46Desc: 'CET-4/6 core vocabulary',
    QyAppLocalizationKeys.qyWordBookDefault: 'Default Word Book',

    // More Features
    QyAppLocalizationKeys.qyLearningTools: 'Learning Tools',
    QyAppLocalizationKeys.qyVocabularyTest: 'Vocabulary Test',
    QyAppLocalizationKeys.qyVocabularyTestDesc: 'Test your vocabulary mastery',
    QyAppLocalizationKeys.qyPronunciationPractice: 'Pronunciation Practice',
    QyAppLocalizationKeys.qyPronunciationPracticeDesc:
        'AI-powered pronunciation correction',
    QyAppLocalizationKeys.qyGrammarPractice: 'Grammar Practice',
    QyAppLocalizationKeys.qyGrammarPracticeDesc: 'Grammar rules and exercises',
    QyAppLocalizationKeys.qyWritingAssistant: 'Writing Assistant',
    QyAppLocalizationKeys.qyWritingAssistantDesc:
        'AI-assisted writing optimization',
    QyAppLocalizationKeys.qyPersonalizedFeatures: 'Personalized Features',
    QyAppLocalizationKeys.qyStudyPlan: 'Study Plan',
    QyAppLocalizationKeys.qyStudyPlanDesc:
        'Customize personalized learning path',
    QyAppLocalizationKeys.qyLearningReport: 'Learning Report',
    QyAppLocalizationKeys.qyLearningReportDesc:
        'Detailed learning data analysis',
    QyAppLocalizationKeys.qyGoalSetting: 'Goal Setting',
    QyAppLocalizationKeys.qyGoalSettingDesc: 'Set learning goals and reminders',
    QyAppLocalizationKeys.qyLearningCommunity: 'Learning Community',
    QyAppLocalizationKeys.qyLearningCommunityDesc:
        'Exchange and share with classmates',
    QyAppLocalizationKeys.qyEntertainmentFeatures: 'Entertainment Features',
    QyAppLocalizationKeys.qyWordGames: 'Word Games',
    QyAppLocalizationKeys.qyWordGamesDesc: 'Fun word memory games',
    QyAppLocalizationKeys.qyChallenge: 'Challenge',
    QyAppLocalizationKeys.qyChallengeDesc: 'Compete with other users',
    QyAppLocalizationKeys.qyAchievementsSystem: 'Achievements System',
    QyAppLocalizationKeys.qyAchievementsSystemDesc:
        'Unlock learning achievement badges',
    QyAppLocalizationKeys.qyLeaderboard: 'Leaderboard',
    QyAppLocalizationKeys.qyLeaderboardDesc: 'Global learning rankings',
    QyAppLocalizationKeys.qyRankings: 'Rankings',
    QyAppLocalizationKeys.qyWeek: 'Week',
    QyAppLocalizationKeys.qyMonth: 'Month',
    QyAppLocalizationKeys.qyAllTime: 'All Time',
    QyAppLocalizationKeys.qyYourRank: 'Your Rank',
    QyAppLocalizationKeys.qyCurrentStreak: 'Current Streak',
    QyAppLocalizationKeys.qyKeepItUp: 'Keep it up!',
    QyAppLocalizationKeys.qyLongestStreak: 'Longest Streak',
    QyAppLocalizationKeys.qyActivityCalendar: 'Activity Calendar',
    QyAppLocalizationKeys.qyStudied: 'Studied',
    QyAppLocalizationKeys.qyNoActivity: 'No Activity',
    QyAppLocalizationKeys.qyStreakTips: 'Streak Tips',
    QyAppLocalizationKeys.qyTip1: 'Study every day to maintain your streak',
    QyAppLocalizationKeys.qyTip2: 'Set reminders to help you remember',
    QyAppLocalizationKeys.qyTip3: 'Even 5 minutes counts!',
    QyAppLocalizationKeys.qyCheckinChallenge: 'Check-in Challenge',
    QyAppLocalizationKeys.qyCheckinChallengeDesc: 'Daily learning challenges',
    QyAppLocalizationKeys.qyRewards: 'Rewards',
    QyAppLocalizationKeys.qyRewardsDesc: 'Claim your benefits',
    QyAppLocalizationKeys.qyTopics: 'Topics',
    QyAppLocalizationKeys.qyTopicsDesc: 'Join discussions',
    QyAppLocalizationKeys.qyDiscoverLearning: 'Discover Learning',
    QyAppLocalizationKeys.qyConnectMillionsLearners: 'Connect with millions of learners worldwide',
    QyAppLocalizationKeys.qyExploreCommunityFeatures: 'Explore community features',
    QyAppLocalizationKeys.qyProfessionalTools: 'Professional Tools',
    QyAppLocalizationKeys.qyDictionaryQuery: 'Dictionary Query',
    QyAppLocalizationKeys.qyDictionaryQueryDesc: 'Powerful dictionary tool',
    QyAppLocalizationKeys.qyTranslationTool: 'Translation Tool',
    QyAppLocalizationKeys.qyTranslationToolDesc:
        'Fast Chinese-English translation',
    QyAppLocalizationKeys.qyGrammarChecker: 'Grammar Checker',
    QyAppLocalizationKeys.qyGrammarCheckerDesc: 'Intelligent grammar checker',
    QyAppLocalizationKeys.qyVoiceAssistant: 'Voice Assistant',
    QyAppLocalizationKeys.qyVoiceAssistantDesc: 'AI voice learning assistant',
    QyAppLocalizationKeys.qyMoreFeaturesSubtitle:
        'Explore more learning features',
    QyAppLocalizationKeys.qyOpeningFeature: 'Opening',
    QyAppLocalizationKeys.qyFeatureNotAvailable:
        'This feature is not yet available, please stay tuned',
    QyAppLocalizationKeys.qyClickToSearchFeatures:
        'Click to search related features',

    // Inbox
    QyAppLocalizationKeys.qyUnreadMessages: 'unread messages',
    QyAppLocalizationKeys.qyLearningAssistant: 'Learning Assistant',
    QyAppLocalizationKeys.qyVocabularyLearningCompleted:
        'Today\'s vocabulary learning is completed, keep it up!',
    QyAppLocalizationKeys.qyMinutesAgo2: '2 minutes ago',
    QyAppLocalizationKeys.qyEnglishCornerGroup: 'English Corner Group',
    QyAppLocalizationKeys.qyJohnGrammarQuestion:
        'John: What do you think about this grammar point?',
    QyAppLocalizationKeys.qyMinutesAgo15: '15 minutes ago',
    QyAppLocalizationKeys.qyLucy: 'Lucy',
    QyAppLocalizationKeys.qySeeYouTomorrow: 'Okay, see you tomorrow!',
    QyAppLocalizationKeys.qyHoursAgo1: '1 hour ago',
    QyAppLocalizationKeys.qySystemNotification: 'System Notification',
    QyAppLocalizationKeys.qyNewAchievementBadge:
        'You have earned a new learning achievement badge!',
    QyAppLocalizationKeys.qyHoursAgo2: '2 hours ago',
    QyAppLocalizationKeys.qyStudyReminder: 'Study Reminder',
    QyAppLocalizationKeys.qyReviewTodayWords: 'Time to review today\'s words',
    QyAppLocalizationKeys.qyHoursAgo3: '3 hours ago',
    QyAppLocalizationKeys.qyNoGroupChats: 'No group chats',
    QyAppLocalizationKeys.qyJoinOrCreateGroup:
        'Join or create a study group to start discussion',
    QyAppLocalizationKeys.qyNoNotifications: 'No notifications',
    QyAppLocalizationKeys.qyNotificationsWillShowHere:
        'System notifications and reminders will be displayed here',
    QyAppLocalizationKeys.qyStartNewConversation: 'Start New Conversation',
    QyAppLocalizationKeys.qyPrivateChat: 'Private Chat',
    QyAppLocalizationKeys.qyChatWithSingleStudent:
        'Chat with a single classmate',
    QyAppLocalizationKeys.qyGroupChat: 'Group Chat',
    QyAppLocalizationKeys.qyAiAssistant: 'AI Assistant',
    QyAppLocalizationKeys.qyGetLearningAdvice:
        'Get learning suggestions and help',
    QyAppLocalizationKeys.qyAllMessagesMarkedAsRead:
        'All messages marked as read',

    // Weekdays
    QyAppLocalizationKeys.qyWeek: 'Week',
    QyAppLocalizationKeys.qySunday: 'Sun',
    QyAppLocalizationKeys.qyMonday: 'Mon',
    QyAppLocalizationKeys.qyTuesday: 'Tue',
    QyAppLocalizationKeys.qyWednesday: 'Wed',
    QyAppLocalizationKeys.qyThursday: 'Thu',
    QyAppLocalizationKeys.qyFriday: 'Fri',
    QyAppLocalizationKeys.qySaturday: 'Sat',
    QyAppLocalizationKeys.qyWordTask: 'Word Task',

    // Course Service Data
    QyAppLocalizationKeys.qyCourseIeltsDuration: '12 weeks',
    QyAppLocalizationKeys.qyCoursePythonDuration: '16 weeks',
    QyAppLocalizationKeys.qyCourseIeltsMasterTitle: 'IELTS Master Preparation',
    QyAppLocalizationKeys.qyCourseIeltsMasterSubtitle:
        'Comprehensive IELTS exam preparation course',
    QyAppLocalizationKeys.qyCourseIeltsMasterDescription:
        'Intensive IELTS preparation course designed for the exam, covering comprehensive training in listening, speaking, reading, and writing',
    QyAppLocalizationKeys.qyCourseIeltsFeature1:
        'Four-skill specialized training',
    QyAppLocalizationKeys.qyCourseIeltsFeature2:
        'Real exam practice and mock tests',
    QyAppLocalizationKeys.qyCourseIeltsFeature3:
        'One-on-one tutoring with expert teachers',
    QyAppLocalizationKeys.qyCourseIeltsFeature4: 'Customized learning plans',
    QyAppLocalizationKeys.qyCourseIeltsFeature5: 'Real-time progress tracking',
    QyAppLocalizationKeys.qyCourseIeltsFeature6: 'AI intelligent assessment',
    QyAppLocalizationKeys.qyCourseIeltsTopic1: 'IELTS speaking techniques',
    QyAppLocalizationKeys.qyCourseIeltsTopic2:
        'Writing structure and expression',
    QyAppLocalizationKeys.qyCourseIeltsTopic3:
        'Reading comprehension strategies',
    QyAppLocalizationKeys.qyCourseIeltsTopic4: 'Listening skills improvement',
    QyAppLocalizationKeys.qyCourseIeltsTopic5:
        'Vocabulary and grammar reinforcement',
    QyAppLocalizationKeys.qyCourseIeltsTopic6: 'Exam techniques and strategies',
    QyAppLocalizationKeys.qyCoursePythonMasterTitle:
        'Python Programming Masterclass',
    QyAppLocalizationKeys.qyCoursePythonMasterSubtitle:
        'Complete learning path from zero to professional developer',
    QyAppLocalizationKeys.qyCoursePythonMasterDescription:
        'Systematic Python programming learning covering basic syntax, web development, data analysis, artificial intelligence and other core areas',
    QyAppLocalizationKeys.qyCoursePythonFeature1: 'Project-driven learning',
    QyAppLocalizationKeys.qyCoursePythonFeature2: 'Hands-on code practice',
    QyAppLocalizationKeys.qyCoursePythonFeature3: 'Mentor code review',
    QyAppLocalizationKeys.qyCoursePythonFeature4: 'Portfolio guidance',
    QyAppLocalizationKeys.qyCoursePythonFeature5: 'Job recommendation service',
    QyAppLocalizationKeys.qyCoursePythonFeature6: 'Community learning support',
    QyAppLocalizationKeys.qyCoursePythonTopic1: 'Python basic syntax',
    QyAppLocalizationKeys.qyCoursePythonTopic2: 'Object-oriented programming',
    QyAppLocalizationKeys.qyCoursePythonTopic3: 'Web development frameworks',
    QyAppLocalizationKeys.qyCoursePythonTopic4:
        'Data analysis and visualization',
    QyAppLocalizationKeys.qyCoursePythonTopic5: 'Machine learning introduction',
    QyAppLocalizationKeys.qyCoursePythonTopic6: 'Project practice exercises',
    QyAppLocalizationKeys.qyCourseDuration3Weeks: '3 weeks',
    QyAppLocalizationKeys.qyCourseDuration2_5Weeks: '2.5 weeks',
    QyAppLocalizationKeys.qyCourseDuration4Weeks: '4 weeks',
    QyAppLocalizationKeys.qyCourseDuration2Weeks: '2 weeks',
    QyAppLocalizationKeys.qyCourseDuration3_5Weeks: '3.5 weeks',
    QyAppLocalizationKeys.qyCourseDifficultyBeginner: 'Beginner',
    QyAppLocalizationKeys.qyCourseDifficultyIntermediate: 'Intermediate',
    QyAppLocalizationKeys.qyCourseDifficultyAdvanced: 'Advanced',
    QyAppLocalizationKeys.qyCourseIeltsModuleListeningTitle:
        'Listening Training',
    QyAppLocalizationKeys.qyCourseIeltsModuleListeningSubtitle:
        'IELTS listening skill enhancement',
    QyAppLocalizationKeys.qyCourseIeltsModuleListeningDescription:
        'Master listening techniques and strategies through extensive real exam practice',
    QyAppLocalizationKeys.qyCourseIeltsModuleReadingTitle:
        'Reading Comprehension',
    QyAppLocalizationKeys.qyCourseIeltsModuleReadingSubtitle:
        'IELTS reading technique reinforcement',
    QyAppLocalizationKeys.qyCourseIeltsModuleReadingDescription:
        'Improve reading speed and comprehension, master question-solving techniques',
    QyAppLocalizationKeys.qyCourseIeltsModuleWritingTitle: 'Writing Skills',
    QyAppLocalizationKeys.qyCourseIeltsModuleWritingSubtitle:
        'IELTS writing structure training',
    QyAppLocalizationKeys.qyCourseIeltsModuleWritingDescription:
        'Learn writing structure and expression techniques to improve writing quality',
    QyAppLocalizationKeys.qyCourseIeltsModuleSpeakingTitle:
        'Speaking Expression',
    QyAppLocalizationKeys.qyCourseIeltsModuleSpeakingSubtitle:
        'IELTS speaking ability development',
    QyAppLocalizationKeys.qyCourseIeltsModuleSpeakingDescription:
        'Enhance speaking fluency and expression ability, prepare for speaking exam',
    QyAppLocalizationKeys.qyCoursePythonModuleBasicsTitle:
        'Python Basics Introduction',
    QyAppLocalizationKeys.qyCoursePythonModuleBasicsSubtitle:
        'Variables, data types, control flow',
    QyAppLocalizationKeys.qyCoursePythonModuleBasicsDescription:
        'Learn Python basic syntax and programming concepts',
    QyAppLocalizationKeys.qyCoursePythonModuleOOPTitle:
        'Object-Oriented Programming',
    QyAppLocalizationKeys.qyCoursePythonModuleOOPSubtitle:
        'Classes, objects, inheritance, polymorphism',
    QyAppLocalizationKeys.qyCoursePythonModuleOOPDescription:
        'Deeply understand object-oriented programming concepts',
    QyAppLocalizationKeys.qyCoursePythonModuleWebTitle:
        'Web Development Frameworks',
    QyAppLocalizationKeys.qyCoursePythonModuleWebSubtitle:
        'Django, Flask, FastAPI',
    QyAppLocalizationKeys.qyCoursePythonModuleWebDescription:
        'Learn mainstream Python web development frameworks',
    QyAppLocalizationKeys.qyCoursePythonModuleDataTitle:
        'Data Analysis and Visualization',
    QyAppLocalizationKeys.qyCoursePythonModuleDataSubtitle:
        'NumPy, Pandas, Matplotlib',
    QyAppLocalizationKeys.qyCoursePythonModuleDataDescription:
        'Master data analysis tools and visualization techniques',
    QyAppLocalizationKeys.qyCoursePythonModuleMLTitle:
        'Machine Learning Introduction',
    QyAppLocalizationKeys.qyCoursePythonModuleMLSubtitle:
        'Scikit-learn, TensorFlow basics',
    QyAppLocalizationKeys.qyCoursePythonModuleMLDescription:
        'Enter the field of artificial intelligence and machine learning',
    QyAppLocalizationKeys.qyCoursePythonModuleProjectsTitle: 'Project Practice',
    QyAppLocalizationKeys.qyCoursePythonModuleProjectsSubtitle:
        'Complete project development process',
    QyAppLocalizationKeys.qyCoursePythonModuleProjectsDescription:
        'Comprehensively apply learned knowledge to complete real projects',
    QyAppLocalizationKeys.qyCourseIeltsProjectMockTest1Title:
        'Full Mock Test #1',
    QyAppLocalizationKeys.qyCourseIeltsProjectMockTest1Subtitle:
        'Complete IELTS exam simulation',
    QyAppLocalizationKeys.qyCourseIeltsProjectMockTest1Description:
        'Complete simulation following real exam time and process',
    QyAppLocalizationKeys.qyCourseIeltsProjectSpeakingPracticeTitle:
        'Speaking Topic Practice',
    QyAppLocalizationKeys.qyCourseIeltsProjectSpeakingPracticeSubtitle:
        'Common speaking topic preparation',
    QyAppLocalizationKeys.qyCourseIeltsProjectSpeakingPracticeDescription:
        'Practice and prepare for high-frequency speaking topics',
    QyAppLocalizationKeys.qyCourseMockTest: 'Mock Test',
    QyAppLocalizationKeys.qyCourseSpeakingPractice: 'Speaking Practice',
    QyAppLocalizationKeys.qyPythonProjectTodoApp: 'Todo Application',
    QyAppLocalizationKeys.qyPythonProjectTodoAppDesc:
        'Web application built with Flask',
    QyAppLocalizationKeys.qyPythonProjectTodoAppDescription:
        'Create a fully functional todo management application',
    QyAppLocalizationKeys.qyPythonProjectDataViz:
        'Data Visualization Dashboard',
    QyAppLocalizationKeys.qyPythonProjectDataVizDesc:
        'Analyze sales data using Pandas and Matplotlib',
    QyAppLocalizationKeys.qyPythonProjectDataVizDescription:
        'Build an interactive data analysis dashboard',
    QyAppLocalizationKeys.qyPythonProjectWebScraper: 'Web Scraper Tool',
    QyAppLocalizationKeys.qyPythonProjectWebScraperDesc:
        'Scrape e-commerce website data and analyze',
    QyAppLocalizationKeys.qyPythonProjectWebScraperDescription:
        'Develop web data collection and analysis tool',
    QyAppLocalizationKeys.qyPythonProjectBlogDesc:
        'Django full-stack web development project',
    QyAppLocalizationKeys.qyPythonProjectBlogDescription:
        'Build a fully functional blog platform',
    QyAppLocalizationKeys.qyPythonProjectMLPredict:
        'Machine Learning Predictor',
    QyAppLocalizationKeys.qyPythonProjectMLPredictDesc:
        'Regression analysis project for house price prediction',
    QyAppLocalizationKeys.qyPythonProjectMLPredictDescription:
        'Apply machine learning algorithms to solve real problems',

    // Inbox Dashboard
    QyAppLocalizationKeys.qyInboxUserDating: 'Dating',
    QyAppLocalizationKeys.qyInboxUserArrell: 'Arrell Steward',
    QyAppLocalizationKeys.qyInboxUserJene: 'Jene Cooper',
    QyAppLocalizationKeys.qyInboxUserEleanor: 'Eleanor Pena',
    QyAppLocalizationKeys.qyInboxMessageDonation: 'I Know a donation..',
    QyAppLocalizationKeys.qyInboxMessageDatingApp: 'Ai Dating App',

    // Dictionary Recommendation
    QyAppLocalizationKeys.qyDictionaryCategoryAcademic: 'Academic',
    QyAppLocalizationKeys.qyDictionaryCategoryGeneral: 'General',
    QyAppLocalizationKeys.qyDictionaryCategoryBusiness: 'Business',
    QyAppLocalizationKeys.qyDictionaryCategoryMedical: 'Medical',
    QyAppLocalizationKeys.qyDictionaryCategoryTechnical: 'Technical',
    QyAppLocalizationKeys.qyDictionaryDifficultyBeginner: 'Beginner',
    QyAppLocalizationKeys.qyDictionaryDifficultyIntermediate: 'Intermediate',
    QyAppLocalizationKeys.qyDictionaryDifficultyAdvanced: 'Advanced',
    QyAppLocalizationKeys.qyDictionaryRemove: 'Remove',
    QyAppLocalizationKeys.qyDictionaryAddToLibrary: 'Add to Library',
    QyAppLocalizationKeys.qyDictionaryWords: 'Words',
    QyAppLocalizationKeys.qyDictionaryLikes: 'Likes',
    QyAppLocalizationKeys.qyDictionaryDifficulty: 'Difficulty',
    QyAppLocalizationKeys.qyDictionaryDetails: 'Details',
    QyAppLocalizationKeys.qyDictionaryAdded: 'Added',
    QyAppLocalizationKeys.qyDictionaryTagVocabulary: 'vocabulary',
    QyAppLocalizationKeys.qyDictionaryTagAdvanced: 'advanced',
    QyAppLocalizationKeys.qyDictionaryTagAcademic: 'academic',
    QyAppLocalizationKeys.qyDictionaryTagGeneral: 'general',
    QyAppLocalizationKeys.qyDictionaryTagBeginner: 'beginner',
    QyAppLocalizationKeys.qyDictionaryTagModern: 'modern',
    QyAppLocalizationKeys.qyDictionaryTagIntermediate: 'intermediate',
    QyAppLocalizationKeys.qyInboxMessageAmazing: 'This is amazing',
    QyAppLocalizationKeys.qyInboxTime0910: '09.10',
    QyAppLocalizationKeys.qyInboxTime2025: '20.25',
    QyAppLocalizationKeys.qyInboxTime830: '8.30',
    QyAppLocalizationKeys.qyInboxTime0555: '05.55',
  };

  /// Get locales for runCommonApp
  static List<Map<String, String>> get locales => [values];
}
