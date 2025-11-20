// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\\..\\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

import 'package:go_router/go_router.dart';
import 'package:qyflutter/apps/app_example/features_app_example/authentication/views/forgot_screen.dart';
import 'package:qyflutter/apps/app_example/features_app_example/authentication/views/resetpassword_screen.dart';
import 'package:qyflutter/apps/app_example/features_app_example/authentication/views/signin_up_screen.dart';
import 'package:qyflutter/apps/app_example/features_app_example/authentication/views/verify_screen.dart';
import 'package:qyflutter/apps/app_example/features_app_example/dashboard/views/dashboard_screen.dart';
import 'package:qyflutter/apps/app_example/features_app_example/donation/views/donation_all_screen.dart';
import 'package:qyflutter/apps/app_example/features_app_example/donation/views/donation_screen.dart';
import 'package:qyflutter/apps/app_example/features_app_example/fundraising/views/fundrasing_screen.dart';
import 'package:qyflutter/apps/app_example/features_app_example/comming/coming_screen.dart';
import 'package:qyflutter/apps/app_example/features_app_example/home/views/urgent_fundraising.dart';
import 'package:qyflutter/apps/app_example/features_app_example/home/views/watch_impact.dart';
import 'package:qyflutter/apps/app_example/features_app_example/inbox/views/chat_screen.dart';
import 'package:qyflutter/apps/app_example/features_app_example/onbording/views/onbording_screen.dart';
import 'package:qyflutter/apps/app_example/features_app_example/authentication/views/congratulation_screen.dart';
import 'package:qyflutter/apps/app_example/features_app_example/home/views/prayer_screen.dart';
import 'package:qyflutter/apps/app_example/features_app_example/about/about_screen.dart';
import 'package:qyflutter/apps/app_example/features_app_example/profile/views/edit_profile.dart';
import 'package:qyflutter/apps/app_example/features_app_example/setting/views/help_screen.dart';
import 'package:qyflutter/apps/app_example/features_app_example/invite_friend/invite_friend_screen.dart';
import 'package:qyflutter/apps/app_example/features_app_example/setting/views/notification_setting.dart';
import 'package:qyflutter/apps/app_example/features_app_example/setting/views/security_screen.dart';
import 'package:qyflutter/apps/app_example/features_app_example/help/views/about_us_screen.dart';
import 'package:qyflutter/apps/app_example/features_app_example/help/views/contact_screen.dart';
import 'package:qyflutter/apps/app_example/features_app_example/help/views/fqa_screen.dart';
import 'package:qyflutter/apps/app_example/features_app_example/help/views/privacy_policy.dart';
import 'package:qyflutter/apps/app_example/features_app_example/help/views/themes_conditions.dart';
import 'package:qyflutter/apps/app_example/features_app_example/profile_two/views/profile_two_screen.dart';
import 'package:qyflutter/apps/app_example/features_app_example/setting/views/setting_screen_view.dart';
import 'package:qyflutter/apps/app_example/features_app_example/top_menu/top_menu.dart';
import 'package:qyflutter/apps/app_example/features_app_example/bookmark/bookmark_screen.dart';
import 'package:qyflutter/apps/app_example/features_app_example/profile_two/views/wallet_center_screen.dart';
import 'package:qyflutter/apps/app_example/features_app_example/social_feed/views/social_feed_screen.dart';
import 'package:qyflutter/apps/app_example/features_app_example/splash/views/splash_screen.dart';
import 'package:qyflutter/apps/app_example/features_app_example/home_login/views/home_login_view.dart';

class RouterQy {
  static const String qySplash = '/qy_splash';
  static const String qyInitial = '/qy_initial';
  static const String qyHome = '/qy_home';
  static const String qySignup = '/qy_signup';
  static const String qyOnboarding = '/qy_onboarding';
  static const String qySigning = '/qy_signing';
  static const String qyForgot = '/qy_forgot';
  static const String qyVerify = '/qy_verify';
  static const String qyReset = '/qy_reset';
  static const String qyCongratulations = '/qy_congratulations';
  static const String qyHomescreen = '/qy_homescreen';
  static const String qyProfile = '/qy_profile';
  static const String qyChat = '/qy_chat';
  static const String qyAbout = '/qy_about';
  static const String qyFundraising = '/qy_fundraising';
  static const String qyPrayer = '/qy_prayer';
  static const String qyDonation = '/qy_donation';
  static const String qyAlldonation = '/qy_alldonation';
  static const String qyProfileSetting = '/qy_profileSetting';
  static const String qyEditProfile = '/qy_editProfile';
  static const String qyNotificationSettings = '/qy_notificationSettings';
  static const String qySecuritySettings = '/qy_securitySettings';
  static const String qyHelp = '/qy_help';
  static const String qyInviteFriends = '/qy_inviteFriends';
  static const String qyWatchImpact = "/qy_watchImpact";
  static const String qyComingEnd = "/qy_comingEnd";
  static const String qyUrgentFundraising = "/qy_urgentFundraising";
  static const String qyFqa = "/qy_fqa";
  static const String qyContactUS = "/qy_contactUS";
  static const String qyTermsConditions = "/qy_termsConditions";
  static const String qyPrivacyPolicy = "/qy_privacyPolicy";
  static const String qyAboutUs = "/qy_aboutUs";
  static const String qyProfileTwo = '/qy_profile-two';
  static const String qyBookmark = '/qy_bookmark';
  static const String qyWalletCenter = '/qy_wallet-center';
  static const String qyTopMenu = '/qy_top-menu';
  static const String qySettingView = '/qy_setting_view';
  static const String qyTopViewMenu = '/qy_top-view-menu';
  static const String qySocialFeed = '/qy_social-feed';
  static const String qyHomeLogin = '/qy_home_login';

  static String qyFqaRequest() => qyFqa;
  static String qyContactRequest() => qyContactUS;
  static String qyTermsConditionsRequest() => qyTermsConditions;
  static String qyPrivacyPolicyRequest() => qyPrivacyPolicy;
  static String qyAboutUsRequest() => qyAboutUs;

  static String qyGetInitialRoute() => qyInitial;
  static String qyGetSplashRoute() => qySplash;
  static String qyGetHomeRoute() => qyHome;
  static String qySignUpScreen() => qySignup;
  static String qySigningRoute() => qySigning;
  static String qyGetOnboardingRoute() => qyOnboarding;
  static String qyForgotRoute() => qyForgot;
  static String qyVerifyRoute() => qyVerify;
  static String qyResetRoute() => qyReset;
  static String qyCongratulationRoute() => qyCongratulations;
  static String qyHomeScreenRoute() => qyHomescreen;
  static String qyEditProfileRoute() => qyEditProfile;
  static String qyChatRoute() => qyChat;
  static String qyAboutRoute() => qyAbout;

  static String qyFundraisingRoute() => qyFundraising;
  static String qyPrayerRoute() => qyPrayer;
  static String qyDonationRoute() => qyDonation;
  static String qyAlldonationRoute() => qyAlldonation;
  static String qyUrgentFundraisingRoute() => qyUrgentFundraising;

  static String qyNotificationsRoute() => qyNotificationSettings;
  static String qyProfileSettingRoute() => qyProfileSetting;
  static String qySecuritySettingsRoute() => qySecuritySettings;
  static String qyEdit() => qyEditProfile;
  static String qyHelpRoute() => qyHelp;
  static String qyInviteFriendsRoute() => qyInviteFriends;
  static String qyWatchImpactRoute() => qyWatchImpact;
  static String qyComingRoute() => qyComingEnd;
  static String qyFqaRoute() => qyFqa;
  static String qySettingViewRoute() => qySettingView;
  static String qyProfileTwoRoute() => qyProfileTwo;
  static String qyTopViewMenuRoute() => qyTopViewMenu;
  static String qyWalletCenterRoute() => qyWalletCenter;
  static String qySocialFeedRoute() => qySocialFeed;
  static String qyHomeLoginRoute() => qyHomeLogin;

  // Route list
  static final List<GoRoute> routes = [
    GoRoute(
      path: qyHome,
      builder: (context, state) => const DashboardScreen(),
    ),
    GoRoute(
      path: qyInitial,
      builder: (context, state) => const SplashScreen(),
    ),
    GoRoute(
      path: qySplash,
      builder: (context, state) => const SplashScreen(),
    ),
    GoRoute(
      path: qyOnboarding,
      builder: (context, state) => const OnbordingView(),
    ),
    GoRoute(
      path: qySignup,
      builder: (context, state) => const SignInUpScreenView(),
    ),
    GoRoute(
      path: qySigning,
      builder: (context, state) => const SignInUpScreenView(),
    ),
    GoRoute(
      path: qyForgot,
      builder: (context, state) => const ForgotScreenView(),
    ),
    GoRoute(
      path: qyVerify,
      builder: (context, state) => const VerifyScreenView(),
    ),
    GoRoute(
      path: qyReset,
      builder: (context, state) => const ResetPasswordView(),
    ),
    GoRoute(
      path: qyProfile,
      builder: (context, state) => const CongratulationScreen(),
    ),
    GoRoute(
      path: qyChat,
      builder: (context, state) => const ChatScreenView(),
    ),
    GoRoute(
      path: qyAbout,
      builder: (context, state) => const AboutScreenView(),
    ),
    GoRoute(
      path: qyFundraising,
      builder: (context, state) => const FundrasingScreenView(),
    ),
    GoRoute(
      path: qyPrayer,
      builder: (context, state) => const PrayerScreen(),
    ),
    GoRoute(
      path: qyDonation,
      builder: (context, state) => const DonationScreenView(),
    ),
    GoRoute(
      path: qyWatchImpact,
      builder: (context, state) => const WatchTheImpactScreen(),
    ),
    GoRoute(
      path: qyComingEnd,
      builder: (context, state) => const ComingEndScree(),
    ),
    GoRoute(
      path: qyAlldonation,
      builder: (context, state) => const MyDonationAllScreen(),
    ),
    GoRoute(
      path: qyUrgentFundraising,
      builder: (context, state) => const UrgentFundraisingScreenView(),
    ),
    GoRoute(
      path: qyEditProfile,
      builder: (context, state) => ProfileEditScreenView(),
    ),
    GoRoute(
      path: qyNotificationSettings,
      builder: (context, state) => const NotificationSettingScreen(),
    ),
    GoRoute(
      path: qySecuritySettings,
      builder: (context, state) => const SecuritySettingScreen(),
    ),
    GoRoute(
      path: qyHelp,
      builder: (context, state) => HelpScreenView(),
    ),
    GoRoute(
      path: qyInviteFriends,
      builder: (context, state) => const InvitedFriendScreen(),
    ),
    GoRoute(
      path: qyAboutUs,
      builder: (context, state) => const AboutUsScreenView(),
    ),
    GoRoute(
      path: qyTermsConditions,
      builder: (context, state) => const TermsEndConditionScreenView(),
    ),
    GoRoute(
      path: qyPrivacyPolicy,
      builder: (context, state) => const PrivacyScreenView(),
    ),
    GoRoute(
      path: qyFqa,
      builder: (context, state) => const FqaScreenView(),
    ),
    GoRoute(
      path: qyContactUS,
      builder: (context, state) => const ContactScreenView(),
    ),
    GoRoute(
      path: qyProfileTwo,
      builder: (context, state) => const ProfileTwoScreen(),
    ),
    GoRoute(
      path: qyWalletCenter,
      builder: (context, state) => const WalletCenterScreen(),
    ),
    GoRoute(
      path: qySettingView,
      builder: (context, state) => SettingScreenView(),
    ),
    GoRoute(
      path: qyTopViewMenu,
      builder: (context, state) => TopDropdownMenu(
        onClose: () => context.pop(),
      ),
    ),
    GoRoute(
      path: qyBookmark,
      builder: (context, state) => BookMarkScreenView(),
    ),
    GoRoute(
      path: qySocialFeed,
      builder: (context, state) => const SocialFeedScreen(),
    ),
    GoRoute(
      path: qyHomeLogin,
      builder: (context, state) => const HomeLoginView(),
    ),
  ];
}
