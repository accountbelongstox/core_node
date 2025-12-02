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

/// QY App specific localization keys
/// All keys must have 'qy_' prefix to indicate they are app-specific
class QyAppLocalizationKeys {
  static const String qyAppName = 'qy_app_name';
  static const String qyAppDescription = 'qy_app_description';
  static const String qyAppSlogan = 'qy_app_slogan';
  static const String qyAppVersion = 'qy_app_version';
  static const String qyAppSettings = 'qy_app_settings';
  static const String qySloganWords = 'qy_slogan_words';
  static const String qySloganEyes = 'qy_slogan_eyes';
  static const String qyLetsStart = 'qy_lets_start';
  static const String qyDoNotHaveAccount = 'qy_do_not_have_account';
  static const String qySignupForFree = 'qy_signup_for_free';
  static const String qyWelcome = 'qy_welcome';
  static const String qyGreeting = 'qy_greeting';
  static const String qyWelcomeBack = 'qy_welcome_back';
  static const String qyGuestMode = 'qy_guest_mode';

  static const String qyHome = 'qy_home';
  static const String qyMenu = 'qy_menu';
  static const String qySocial = 'qy_social';
  static const String qySupport = 'qy_support';
  static const String qyNext = 'qy_next';
  static const String qyPrevious = 'qy_previous';
  static const String qySkip = 'qy_skip';
  static const String qyCancel = 'qy_cancel';
  static const String qyConfirm = 'qy_confirm';
  static const String qySave = 'qy_save';
  static const String qyDelete = 'qy_delete';
  static const String qyCommonCancel = 'qy_common_cancel';
  static const String qyCommonSave = 'qy_common_save';
  static const String qyCommonDelete = 'qy_common_delete';
  static const String qyEdit = 'qy_edit';
  static const String qyBack = 'qy_back';
  static const String qyClose = 'qy_close';
  static const String qyOk = 'qy_ok';
  static const String qyYes = 'qy_yes';
  static const String qyNo = 'qy_no';
  static const String qyContinue = 'qy_continue';
  static const String qySubmit = 'qy_submit';
  static const String qyRetry = 'qy_retry';
  static const String qyRefresh = 'qy_refresh';
  static const String qySearch = 'qy_search';
  static const String qyFilter = 'qy_filter';
  static const String qySort = 'qy_sort';
  static const String qyClear = 'qy_clear';
  static const String qyReset = 'qy_reset';
  static const String qySearchPlaceholder = 'qy_search_placeholder';
  static const String qyEnterSearchText = 'qy_enter_search_text';
  static const String qyTopUp = 'qy_top_up';

  static const String qySuccess = 'qy_success';
  static const String qyError = 'qy_error';
  static const String qyWarning = 'qy_warning';
  static const String qyInfo = 'qy_info';
  static const String qyLoading = 'qy_loading';
  static const String qyCompleted = 'qy_completed';
  static const String qyPending = 'qy_pending';
  static const String qyFailed = 'qy_failed';
  static const String qyEnabled = 'qy_enabled';
  static const String qyDisabled = 'qy_disabled';

  // General exercise/learning keys
  static const String qyCorrect = 'qy_correct';
  static const String qyIncorrect = 'qy_incorrect';
  static const String qyCorrectAnswer = 'qy_correct_answer';
  static const String qyYourAnswer = 'qy_your_answer';
  static const String qyProgress = 'qy_progress';
  static const String qySpellingPractice = 'qy_spelling_practice';
  static const String qySpellTheWord = 'qy_spell_the_word';
  static const String qyHint = 'qy_hint';
  static const String qyListenAndType = 'qy_listen_and_type';
  static const String qyTypeHere = 'qy_type_here';
  static const String qyPlayAgain = 'qy_play_again';
  static const String qyWordListeningDictation = 'qy_word_listening_dictation';
  static const String qyUnderDevelopment = 'qy_under_development';
  static const String qyPlaying = 'qy_playing';
  static const String qyDictationComplete = 'qy_dictation_complete';
  static const String qyAccuracy = 'qy_accuracy';
  static const String qyPlayAudio = 'qy_play_audio';
  static const String qyWrongAnswer = 'qy_wrong_answer';
  static const String qyCorrectWord = 'qy_correct_word';
  static const String qyAiExplain = 'qy_ai_explain';
  static const String qyAskQuestion = 'qy_ask_question';

  static const String qySignIn = 'qy_sign_in';
  static const String qySignUp = 'qy_sign_up';
  static const String qySignOut = 'qy_sign_out';
  static const String qyLogout = 'qy_logout';
  static const String qyLogoutConfirm = 'qy_logout_confirm';
  static const String qyLogoutSuccess = 'qy_logout_success';
  static const String qyLogoutFailed = 'qy_logout_failed';
  static const String qyYesLogout = 'qy_yes_logout';
  static const String qyLogin = 'qy_login';
  static const String qyLoginFailed = 'qy_login_failed';
  static const String qyRegister = 'qy_register';
  static const String qyRegisterSuccess = 'qy_register_success';
  static const String qyRegisterFailed = 'qy_register_failed';
  static const String qyPasswordsDoNotMatch = 'qy_passwords_do_not_match';
  static const String qyInvalidRegistrationData =
      'qy_invalid_registration_data';
  static const String qySwitchToRegister = 'qy_switch_to_register';
  static const String qySwitchToLogin = 'qy_switch_to_login';
  static const String qyRegisterToContinue = 'qy_register_to_continue';
  static const String qyPleaseEnterEmail = 'qy_please_enter_email';
  static const String qyPleaseEnterConfirmPassword =
      'qy_please_enter_confirm_password';
  static const String qyForgotPassword = 'qy_forgot_password';
  static const String qyResetPassword = 'qy_reset_password';
  static const String qyChangePassword = 'qy_change_password';
  static const String qyEmail = 'qy_email';
  static const String qyPassword = 'qy_password';
  static const String qyConfirmPassword = 'qy_confirm_password';
  static const String qyUsername = 'qy_username';
  static const String qyRememberMe = 'qy_remember_me';
  static const String qyCreateAccount = 'qy_create_account';
  static const String qyHaveAccount = 'qy_have_account';
  static const String qyNoAccount = 'qy_no_account';

  static const String qyProfile = 'qy_profile';
  static const String qyMyProfile = 'qy_my_profile';
  static const String qyEditProfile = 'qy_edit_profile';
  static const String qyPersonalInfo = 'qy_personal_info';
  static const String qyFirstName = 'qy_first_name';
  static const String qyLastName = 'qy_last_name';
  static const String qyFullName = 'qy_full_name';
  static const String qyPhoneNumber = 'qy_phone_number';
  static const String qyAddress = 'qy_address';
  static const String qyBirthDate = 'qy_birth_date';
  static const String qyGender = 'qy_gender';
  static const String qyAvatar = 'qy_avatar';
  static const String qyBio = 'qy_bio';
  static const String qyProfileFill = 'qy_profile_fill';
  static const String qyProfileFullName = 'qy_profile_full_name';
  static const String qyProfileEmail = 'qy_profile_email';
  static const String qyProfilePhone = 'qy_profile_phone';
  static const String qyProfileLocation = 'qy_profile_location';
  static const String qyProfileSelectPhoto = 'qy_profile_select_photo';
  static const String qyProfileChooseGallery = 'qy_profile_choose_gallery';
  static const String qyProfileTakePhoto = 'qy_profile_take_photo';
  static const String qyProfileSaving = 'qy_profile_saving';
  static const String qyProfileContinue = 'qy_profile_continue';
  static const String qyProfileEnterFullName = 'qy_profile_enter_full_name';
  static const String qyProfileEnterEmail = 'qy_profile_enter_email';
  static const String qyProfileEnterPhone = 'qy_profile_enter_phone';
  static const String qyProfileTellAboutYourself =
      'qy_profile_tell_about_yourself';
  static const String qyProfileCityCountry = 'qy_profile_city_country';
  static const String qyProfileDefaultName = 'qy_profile_default_name';
  static const String qyProfileFollowers = 'qy_profile_followers';
  static const String qyProfileFollowing = 'qy_profile_following';
  static const String qyProfilePosts = 'qy_profile_posts';
  static const String qyInterest = 'qy_interest';

  static const String qySettings = 'qy_settings';
  static const String qyGeneralSettings = 'qy_general_settings';
  static const String qyAccountSettings = 'qy_account_settings';
  static const String qyPrivacySettings = 'qy_privacy_settings';
  static const String qyNotificationSettings = 'qy_notification_settings';
  static const String qyLanguageSettings = 'qy_language_settings';
  static const String qyThemeSettings = 'qy_theme_settings';
  static const String qyReminderSettings = 'qy_reminder_settings';
  static const String qyReminderSettingsDesc = 'qy_reminder_settings_desc';
  static const String qyRecommendSettings = 'qy_recommend_settings';
  static const String qyRecommendSettingsDesc = 'qy_recommend_settings_desc';
  static const String qyOtherSettings = 'qy_other_settings';
  static const String qySettingsLanguage = 'qy_settings_language';
  static const String qySettingsTheme = 'qy_settings_theme';
  static const String qySettingsThemeAuto = 'qy_settings_theme_auto';
  static const String qySettingsThemeLight = 'qy_settings_theme_light';
  static const String qySettingsThemeDark = 'qy_settings_theme_dark';
  static const String qySettingsThemeDescription =
      'qy_settings_theme_description';
  static const String qySettingsThemePreview = 'qy_settings_theme_preview';
  static const String qySettingsThemePreviewText =
      'qy_settings_theme_preview_text';
  static const String qySettingsThemePreviewBackground =
      'qy_settings_theme_preview_background';
  static const String qySettingsThemePreviewButton =
      'qy_settings_theme_preview_button';
  static const String qySettingsDailyGoal = 'qy_settings_daily_goal';
  static const String qySettingsGeneral = 'qy_settings_general';
  static const String qySettingsLearning = 'qy_settings_learning';
  static const String qySettingsAutoPlayAudio = 'qy_settings_auto_play_audio';
  static const String qySettingsShowTranslation =
      'qy_settings_show_translation';
  static const String qySettingsNotifications = 'qy_settings_notifications';
  static const String qySettingsEnableNotifications =
      'qy_settings_enable_notifications';
  static const String qySettingsSound = 'qy_settings_sound';
  static const String qySettingsVibration = 'qy_settings_vibration';
  static const String qySettingsReminder = 'qy_settings_reminder';
  static const String qySettingsWeekendReminder =
      'qy_settings_weekend_reminder';
  static const String qySettingsWeekendReminderDescription =
      'qy_settings_weekend_reminder_description';
  static const String qySettingsOther = 'qy_settings_other';
  static const String qySettingsAbout = 'qy_settings_about';
  static const String qySettingsReset = 'qy_settings_reset';
  static const String qySettingsResetConfirm = 'qy_settings_reset_confirm';
  static const String qySettingsResetSuccess = 'qy_settings_reset_success';
  static const String qySettingsPrivacy = 'qy_settings_privacy';
  static const String qySettingsAccount = 'qy_settings_account';
  static const String qySettingsAccountInfo = 'qy_settings_account_info';
  static const String qySettingsAccountNickname =
      'qy_settings_account_nickname';
  static const String qySettingsAccountPhone = 'qy_settings_account_phone';
  static const String qySettingsAccountEmail = 'qy_settings_account_email';
  static const String qySettingsAccountSecurity =
      'qy_settings_account_security';
  static const String qySettingsAccountChangePassword =
      'qy_settings_account_change_password';
  static const String qySettingsAccountOldPassword =
      'qy_settings_account_old_password';
  static const String qySettingsAccountNewPassword =
      'qy_settings_account_new_password';
  static const String qySettingsAccountConfirmPassword =
      'qy_settings_account_confirm_password';
  static const String qySettingsAccountPasswordChanged =
      'qy_settings_account_password_changed';
  static const String qySettingsAccountPasswordMismatch =
      'qy_settings_account_password_mismatch';
  static const String qySettingsAccountTwoFactor =
      'qy_settings_account_two_factor';
  static const String qySettingsAccountTwoFactorDisabled =
      'qy_settings_account_two_factor_disabled';
  static const String qySettingsAccountDangerZone =
      'qy_settings_account_danger_zone';
  static const String qySettingsAccountDelete = 'qy_settings_account_delete';
  static const String qySettingsAccountDeleteDescription =
      'qy_settings_account_delete_description';
  static const String qySettingsAccountDeleteTitle =
      'qy_settings_account_delete_title';
  static const String qySettingsAccountDeleteWarning =
      'qy_settings_account_delete_warning';
  static const String qySettingsAccountUpdateSuccess =
      'qy_settings_account_update_success';
  static const String qyDisplayMode = 'qy_display_mode';
  static const String qyDisplay = 'qy_display';
  static const String qyAudioVoice = 'qy_audio_voice';
  static const String qyTtsSettings = 'qy_tts_settings';
  static const String qyMyAccount = 'qy_my_account';
  static const String qyLearningLanguages = 'qy_learning_languages';
  static const String qyVocabularyCollections = 'qy_vocabulary_collections';
  static const String qyManageWordLibraries = 'qy_manage_word_libraries';
  static const String qyLearningStats = 'qy_learning_stats';
  static const String qyWordsLearned = 'qy_words_learned';
  static const String qyQuickSettings = 'qy_quick_settings';
  static const String qyAutoPlayAudio = 'qy_auto_play_audio';
  static const String qyAnimations = 'qy_animations';
  static const String qyHapticFeedback = 'qy_haptic_feedback';
  static const String qyDataStorage = 'qy_data_storage';
  static const String qySyncData = 'qy_sync_data';
  static const String qyLastSynced = 'qy_last_synced';
  static const String qyClearCache = 'qy_clear_cache';
  static const String qyExportData = 'qy_export_data';
  static const String qyBackupLearningData = 'qy_backup_learning_data';
  static const String qyRestoreDefaultSettings = 'qy_restore_default_settings';
  static const String qyAreYouSureReset = 'qy_are_you_sure_reset';
  static const String qySettingsResetDefaults = 'qy_settings_reset_defaults';
  static const String qyLoginToUnlock = 'qy_login_to_unlock';
  static const String qyHelpCenter = 'qy_help_center';
  static const String qyFaqsSupport = 'qy_faqs_support';
  static const String qyHowWeProtectData = 'qy_how_we_protect_data';
  static const String qyTermsConditions = 'qy_terms_conditions';
  static const String qySignOutAccount = 'qy_sign_out_account';
  static const String qyAboutUs = 'qy_about_us';
  static const String qyCheckForUpdate = 'qy_check_for_update';
  static const String qyNetworkDiagnostics = 'qy_network_diagnostics';
  static const String qyBiometricAuth = 'qy_biometric_auth';
  static const String qyDarkMode = 'qy_dark_mode';
  static const String qyLightMode = 'qy_light_mode';
  static const String qySystemMode = 'qy_system_mode';
  static const String qyLanguage = 'qy_language';
  static const String qyNotifications = 'qy_notifications';
  static const String qyPrivacy = 'qy_privacy';
  static const String qyPrivacySecurity = 'qy_privacy_security';
  static const String qySecurity = 'qy_security';
  static const String qyHelp = 'qy_help';
  static const String qyHelpSupport = 'qy_help_support';
  static const String qyAbout = 'qy_about';
  static const String qyAboutDescription = 'qy_about_description';
  static const String qyAboutTagline = 'qy_about_tagline';
  static const String qyAboutVersion = 'qy_about_version';
  static const String qyAboutAppName = 'qy_about_app_name';
  static const String qyAboutAppSlogan = 'qy_about_app_slogan';
  static const String qyAboutPartners = 'qy_about_partners';
  static const String qyAboutOpenSource = 'qy_about_open_source';
  static const String qyAboutLegalInfo = 'qy_about_legal_info';
  static const String qyAboutIcpNumber = 'qy_about_icp_number';
  static const String qyAboutUserAgreement = 'qy_about_user_agreement';
  static const String qyAboutPrivacyPolicy = 'qy_about_privacy_policy';
  static const String qyAboutUserAgreementContent = 'qy_about_user_agreement_content';
  static const String qyAboutPrivacyPolicyContent = 'qy_about_privacy_policy_content';
  static const String qyAboutCannotOpenUrl = 'qy_about_cannot_open_url';
  static const String qyAboutPartnerOxford = 'qy_about_partner_oxford';
  static const String qyAboutPartnerOxfordDesc = 'qy_about_partner_oxford_desc';
  static const String qyAboutPartnerCollins = 'qy_about_partner_collins';
  static const String qyAboutPartnerCollinsDesc = 'qy_about_partner_collins_desc';
  static const String qyAboutOpenSourceRxJava = 'qy_about_open_source_rxjava';
  static const String qyAboutOpenSourceRxJavaDesc = 'qy_about_open_source_rxjava_desc';
  static const String qyAboutOpenSourceRetrofit = 'qy_about_open_source_retrofit';
  static const String qyAboutOpenSourceRetrofitDesc = 'qy_about_open_source_retrofit_desc';
  static const String qyAboutOpenSourceRxLifecycle = 'qy_about_open_source_rxlifecycle';
  static const String qyAboutOpenSourceRxLifecycleDesc = 'qy_about_open_source_rxlifecycle_desc';
  static const String qyAboutBuild = 'qy_about_build';
  static const String qyAboutLastUpdate = 'qy_about_last_update';
  static const String qyAboutFeatures = 'qy_about_features';
  static const String qyAboutTeam = 'qy_about_team';
  static const String qyAboutLinks = 'qy_about_links';
  static const String qyAboutWebsite = 'qy_about_website';
  static const String qyAboutContact = 'qy_about_contact';
  static const String qyAboutFeedback = 'qy_about_feedback';
  static const String qyAboutReportIssue = 'qy_about_report_issue';
  static const String qyAboutLegal = 'qy_about_legal';
  static const String qyAboutTerms = 'qy_about_terms';
  static const String qyAboutLicense = 'qy_about_license';
  static const String qyTerms = 'qy_terms';
  static const String qyPrivacyPolicy = 'qy_privacy_policy';
  static const String qyLanguageEnglish = 'qy_language_english';
  static const String qyLanguageChinese = 'qy_language_chinese';
  static const String qyWechatNickname = 'qy_wechat_nickname';
  static const String qySettingsCenter = 'qy_settings_center';
  static const String qyLatestVersion = 'qy_latest_version';
  static const String qyNetworkStable = 'qy_network_stable';
  static const String qyNetworkUnavailable = 'qy_network_unavailable';
  static const String qyNetworkUnavailableMessage =
      'qy_network_unavailable_message';
  static const String qyNetworkRetrying = 'qy_network_retrying';
  static const String qyNightModeEnabled = 'qy_night_mode_enabled';
  static const String qyNormalMode = 'qy_normal_mode';
  static const String qyNormalModeProtectEyes = 'qy_normal_mode_protect_eyes';
  static const String qyNightModeTip = 'qy_night_mode_tip';
  static const String qyDisplayLayoutSettings = 'qy_display_layout_settings';
  static const String qyCompatibilitySettings = 'qy_compatibility_settings';
  static const String qyDailyStudyReminder = 'qy_daily_study_reminder';
  static const String qyPersonalizedRecommendations =
      'qy_personalized_recommendations';
  static const String qySyncSettings = 'qy_sync_settings';
  static const String qyNotLoggedIn = 'qy_not_logged_in';
  static const String qyUser = 'qy_user';
  static const String qyClearCacheTitle = 'qy_clear_cache_title';
  static const String qyClearCacheMessage = 'qy_clear_cache_message';
  static const String qyCacheCleared = 'qy_cache_cleared';
  static const String qyHelpCenterInProgress = 'qy_help_center_in_progress';

  static const String qyDashboard = 'qy_dashboard';
  static const String qyInbox = 'qy_inbox';
  static const String qyMessages = 'qy_messages';
  static const String qyChat = 'qy_chat';
  static const String qyContacts = 'qy_contacts';
  static const String qyFriends = 'qy_friends';
  static const String qyGroups = 'qy_groups';
  static const String qyFeed = 'qy_feed';
  static const String qyNews = 'qy_news';
  static const String qyEvents = 'qy_events';
  static const String qyCalendar = 'qy_calendar';
  static const String qyTasks = 'qy_tasks';
  static const String qyTaskCompleted = 'qy_task_completed';
  static const String qyDailyTasks = 'qy_daily_tasks';
  static const String qyTodayProgress = 'qy_today_progress';
  static const String qyPoints = 'qy_points';
  static const String qyProjects = 'qy_projects';
  static const String qyMyPrayers = 'qy_my_prayers';
  static const String qyMyDonations = 'qy_my_donations';
  static const String qyDonationNoDonation = 'qy_donation_no_donation';
  static const String qyDonationMakeNow = 'qy_donation_make_now';
  static const String qyDonationFundRaising = 'qy_donation_fund_raising';
  static const String qyDonationDonations = 'qy_donation_donations';
  static const String qyDonationDaysLeft = 'qy_donation_days_left';
  static const String qyMyFundraising = 'qy_my_fundraising';
  static const String qyInviteFriends = 'qy_invite_friends';
  static const String qyShareApp = 'qy_share_app';
  static const String qyFeature = 'qy_feature';
  static const String qyFeaturePreview = 'qy_feature_preview';
  static const String qyFeatureComingSoon = 'qy_feature_coming_soon';
  static const String qyDisaster = 'qy_disaster';
  static const String qyEducation = 'qy_education';
  static const String qyEnvironment = 'qy_environment';
  static const String qyHumanity = 'qy_humanity';
  static const String qyMedical = 'qy_medical';
  static const String qyOrphanage = 'qy_orphanage';
  static const String qyHomeTopMenuPrayer = 'qy_home_top_menu_prayer';

  static const String qyTitle = 'qy_title';
  static const String qyDescription = 'qy_description';
  static const String qyContent = 'qy_content';
  static const String qyCategory = 'qy_category';
  static const String qyTag = 'qy_tag';
  static const String qyTags = 'qy_tags';
  static const String qyDate = 'qy_date';
  static const String qyTime = 'qy_time';
  static const String qyDateTime = 'qy_date_time';
  static const String qyAuthor = 'qy_author';
  static const String qyCreatedAt = 'qy_created_at';
  static const String qyUpdatedAt = 'qy_updated_at';
  static const String qyPublishedAt = 'qy_published_at';

  static const String qyCreate = 'qy_create';
  static const String qyUpdate = 'qy_update';
  static const String qyView = 'qy_view';
  static const String qyShare = 'qy_share';
  static const String qyBookmarks = 'qy_bookmarks';
  static const String qyLike = 'qy_like';
  static const String qyComment = 'qy_comment';
  static const String qyFollow = 'qy_follow';
  static const String qyUnfollow = 'qy_unfollow';
  static const String qyBlock = 'qy_block';
  static const String qyUnblock = 'qy_unblock';
  static const String qyReport = 'qy_report';
  static const String qyDownload = 'qy_download';
  static const String qyUpload = 'qy_upload';
  static const String qyExport = 'qy_export';
  static const String qyImport = 'qy_import';

  static const String qyValidationRequired = 'qy_validation_required';
  static const String qyValidationEmailInvalid = 'qy_validation_email_invalid';
  static const String qyValidationPasswordShort =
      'qy_validation_password_short';
  static const String qyValidationPasswordWeak = 'qy_validation_password_weak';
  static const String qyValidationPasswordMismatch =
      'qy_validation_password_mismatch';
  static const String qyValidationPhoneInvalid = 'qy_validation_phone_invalid';
  static const String qyValidationUrlInvalid = 'qy_validation_url_invalid';
  static const String qyValidationNumberInvalid =
      'qy_validation_number_invalid';
  static const String qyValidationDateInvalid = 'qy_validation_date_invalid';
  static const String qyValidationMinLength = 'qy_validation_min_length';
  static const String qyValidationMaxLength = 'qy_validation_max_length';

  static const String qyErrorNetwork = 'qy_error_network';
  static const String qyErrorServer = 'qy_error_server';
  static const String qyErrorUnknown = 'qy_error_unknown';
  static const String qyErrorTimeout = 'qy_error_timeout';
  static const String qyErrorPermission = 'qy_error_permission';
  static const String qyErrorNotFound = 'qy_error_not_found';
  static const String qyErrorUnauthorized = 'qy_error_unauthorized';
  static const String qyErrorForbidden = 'qy_error_forbidden';
  static const String qyErrorFileUpload = 'qy_error_file_upload';
  static const String qyErrorInvalidFormat = 'qy_error_invalid_format';
  static const String qyErrorSizeExceeded = 'qy_error_size_exceeded';
  static const String qyErrorSessionExpired = 'qy_error_session_expired';

  static const String qySuccessLogin = 'qy_success_login';
  static const String qySuccessLogout = 'qy_success_logout';
  static const String qySuccessRegister = 'qy_success_register';
  static const String qySuccessPasswordReset = 'qy_success_password_reset';
  static const String qySuccessProfileUpdate = 'qy_success_profile_update';
  static const String qySuccessSettingsSaved = 'qy_success_settings_saved';
  static const String qySuccessFileUpload = 'qy_success_file_upload';
  static const String qySuccessDataExport = 'qy_success_data_export';
  static const String qySuccessDataImport = 'qy_success_data_import';

  static const String qyTimeNow = 'qy_time_now';
  static const String qyTimeToday = 'qy_time_today';
  static const String qyTimeYesterday = 'qy_time_yesterday';
  static const String qyTimeTomorrow = 'qy_time_tomorrow';
  static const String qyTimeThisWeek = 'qy_time_this_week';
  static const String qyTimeLastWeek = 'qy_time_last_week';
  static const String qyTimeNextWeek = 'qy_time_next_week';
  static const String qyTimeThisMonth = 'qy_time_this_month';
  static const String qyTimeLastMonth = 'qy_time_last_month';
  static const String qyTimeNextMonth = 'qy_time_next_month';
  static const String qyTimeThisYear = 'qy_time_this_year';
  static const String qyTimeLastYear = 'qy_time_last_year';
  static const String qyTimeNextYear = 'qy_time_next_year';

  static const String qyPlaceholderSearch = 'qy_placeholder_search';
  static const String qyPlaceholderEmail = 'qy_placeholder_email';
  static const String qyPlaceholderPassword = 'qy_placeholder_password';
  static const String qyPlaceholderName = 'qy_placeholder_name';
  static const String qyPlaceholderMessage = 'qy_placeholder_message';
  static const String qyPlaceholderComment = 'qy_placeholder_comment';
  static const String qyPlaceholderDescription = 'qy_placeholder_description';
  static const String qyPlaceholderTitle = 'qy_placeholder_title';

  static const String qyUnitBytes = 'qy_unit_bytes';
  static const String qyUnitKB = 'qy_unit_kb';
  static const String qyUnitMB = 'qy_unit_mb';
  static const String qyUnitGB = 'qy_unit_gb';
  static const String qyUnitSeconds = 'qy_unit_seconds';
  static const String qyUnitMinutes = 'qy_unit_minutes';
  static const String qyUnitHours = 'qy_unit_hours';
  static const String qyUnitDays = 'qy_unit_days';
  static const String qyUnitWeeks = 'qy_unit_weeks';
  static const String qyUnitMonths = 'qy_unit_months';
  static const String qyUnitYears = 'qy_unit_years';

  static const String qySocialShare = 'qy_social_share';
  static const String qySocialLike = 'qy_social_like';
  static const String qySocialComment = 'qy_social_comment';
  static const String qySocialFollow = 'qy_social_follow';
  static const String qySocialFriend = 'qy_social_friend';
  static const String qySocialGroup = 'qy_social_group';
  static const String qySocialPost = 'qy_social_post';
  static const String qySocialStory = 'qy_social_story';
  static const String qySocialEvent = 'qy_social_event';
  static const String qySocialInvite = 'qy_social_invite';
  static const String qyCheckInSuccess = 'qy_check_in_success';
  static const String qyConsecutiveDays = 'qy_consecutive_days';
  static const String qyTotalCheckInDays = 'qy_total_check_in_days';
  static const String qyBonusPoints = 'qy_bonus_points';
  static const String qyCheckInChallenge = 'qy_check_in_challenge';
  static const String qyCheckedInToday = 'qy_checked_in_today';
  static const String qyCheckInNow = 'qy_check_in_now';
  static const String qyCheckIn = 'qy_check_in';
  static const String qyTotalDays = 'qy_total_days';
  static const String qyCheckInHistory = 'qy_check_in_history';
  static const String qyActiveChallenges = 'qy_active_challenges';
  static const String qyDays = 'qy_days';
  static const String qyMessageCenter = 'qy_message_center';
  static const String qyUnreadMessages = 'qy_unread_messages';
  static const String qyLearningAssistant = 'qy_learning_assistant';
  static const String qyVocabularyLearningCompleted =
      'qy_vocabulary_learning_completed';
  static const String qyMinutesAgo2 = 'qy_minutes_ago_2';
  static const String qyEnglishCornerGroup = 'qy_english_corner_group';
  static const String qyJohnGrammarQuestion = 'qy_john_grammar_question';
  static const String qyMinutesAgo15 = 'qy_minutes_ago_15';
  static const String qyLucy = 'qy_lucy';
  static const String qySeeYouTomorrow = 'qy_see_you_tomorrow';
  static const String qyHoursAgo1 = 'qy_hours_ago_1';
  static const String qySystemNotification = 'qy_system_notification';
  static const String qyNewAchievementBadge = 'qy_new_achievement_badge';
  static const String qyHoursAgo2 = 'qy_hours_ago_2';
  static const String qyStudyReminder = 'qy_study_reminder';
  static const String qyReviewTodayWords = 'qy_review_today_words';
  static const String qyHoursAgo3 = 'qy_hours_ago_3';
  static const String qyNoGroupChats = 'qy_no_group_chats';
  static const String qyJoinOrCreateGroup = 'qy_join_or_create_group';
  static const String qyNoNotifications = 'qy_no_notifications';
  static const String qyNotificationsWillShowHere =
      'qy_notifications_will_show_here';
  static const String qyStartNewConversation = 'qy_start_new_conversation';
  static const String qyPrivateChat = 'qy_private_chat';
  static const String qyChatWithSingleStudent = 'qy_chat_with_single_student';
  static const String qyGroupChat = 'qy_group_chat';
  static const String qyAiAssistant = 'qy_ai_assistant';
  static const String qyGetLearningAdvice = 'qy_get_learning_advice';
  static const String qyAllMessagesMarkedAsRead =
      'qy_all_messages_marked_as_read';
  static const String qyMarkAllAsRead = 'qy_mark_all_as_read';
  static const String qyMarkAllAsReadConfirm = 'qy_mark_all_as_read_confirm';
  static const String qyNoMessages = 'qy_no_messages';

  static const String qyLearning = 'qy_learning';
  static const String qyStatistics = 'qy_statistics';
  static const String qyStatisticsDesc = 'qy_statistics_desc';
  static const String qyPhrasePractice = 'qy_phrase_practice';
  static const String qyPhrasePracticeDesc = 'qy_phrase_practice_desc';
  static const String qySpeedReview = 'qy_speed_review';
  static const String qySpeedReviewDesc = 'qy_speed_review_desc';
  static const String qyReading = 'qy_reading';
  static const String qyReadingDesc = 'qy_reading_desc';
  static const String qySpeaking = 'qy_speaking';
  static const String qySpeakingDesc = 'qy_speaking_desc';
  static const String qyVideoCourses = 'qy_video_courses';
  static const String qyVideoCoursesDesc = 'qy_video_courses_desc';
  static const String qyTranslation = 'qy_translation';
  static const String qyTranslationDesc = 'qy_translation_desc';
  static const String qyDictionary = 'qy_dictionary';
  static const String qyDictionaryDesc = 'qy_dictionary_desc';
  static const String qyFavorites = 'qy_favorites';
  static const String qyFavoritesDesc = 'qy_favorites_desc';
  static const String qyLearningHistory = 'qy_learning_history';
  static const String qyLearningHistoryDesc = 'qy_learning_history_desc';
  static const String qyAchievements = 'qy_achievements';
  static const String qyUnlockedAchievements = 'qy_unlocked_achievements';
  static const String qyLockedAchievements = 'qy_locked_achievements';
  static const String qyAchievementsUnlocked = 'qy_achievements_unlocked';
  static const String qyUnlocked = 'qy_unlocked';
  static const String qyComplete = 'qy_complete';
  static const String qyAll = 'qy_all';
  static const String qyStreak = 'qy_streak';
  static const String qyTest = 'qy_test';
  static const String qySpecial = 'qy_special';
  static const String qyScore = 'qy_score';
  static const String qyCommunity = 'qy_community';
  static const String qyGlobalSearch = 'qy_global_search';
  static const String qyAiSearch = 'qy_ai_search';
  static const String qyPlaceholderSearchContent =
      'qy_placeholder_search_content';
  static const String qyLearningProgress = 'qy_learning_progress';
  static const String qyStudyDuration = 'qy_study_duration';
  static const String qyAccuracyRate = 'qy_accuracy_rate';
  static const String qyReviewCount = 'qy_review_count';
  static const String qyIAm = 'qy_i_am';
  static const String qyWordLearning = 'qy_word_learning';
  static const String qyPronunciation = 'qy_pronunciation';
  static const String qyUnknown = 'qy_unknown';
  static const String qyLastWord = 'qy_last_word';
  static const String qyLastWordMessage = 'qy_last_word_message';
  static const String qyLearningProgressReset = 'qy_learning_progress_reset';
  static const String qyLearningProgressResetMessage = 'qy_learning_progress_reset_message';
  static const String qyNotice = 'qy_notice';

  static const String qyCertificateCenter = 'qy_certificate_center';
  static const String qyCertificateCenterSubtitle =
      'qy_certificate_center_subtitle';
  static const String qyCertificates = 'qy_certificates';
  static const String qyNoCertificates = 'qy_no_certificates';
  static const String qyNoCertificatesDescription =
      'qy_no_certificates_description';
  static const String qyCertificateEarned = 'qy_certificate_earned';
  static const String qyCertificateInProgress = 'qy_certificate_in_progress';
  static const String qyCertificateTotalPoints = 'qy_certificate_total_points';
  static const String qyCertificateLocked = 'qy_certificate_locked';
  static const String qyCertificateUnlocked = 'qy_certificate_unlocked';
  static const String qyCertificateEarnedDate = 'qy_certificate_earned_date';
  static const String qyCertificateNumber = 'qy_certificate_number';
  static const String qyCertificateIssueDate = 'qy_certificate_issue_date';
  static const String qyCertificateKeepWorking = 'qy_certificate_keep_working';
  static const String qyCertificateShareToWechat =
      'qy_certificate_share_to_wechat';
  static const String qyCertificateShareToMoments =
      'qy_certificate_share_to_moments';
  static const String qyCertificateSaveImage = 'qy_certificate_save_image';
  static const String qyCertificateCopyLink = 'qy_certificate_copy_link';
  static const String qyCertificateDownloadInProgress =
      'qy_certificate_download_in_progress';
  static const String qyCertificateShareInProgress =
      'qy_certificate_share_in_progress';
  static const String qyCertificateDescription = 'qy_certificate_description';
  static const String qyCertificateLevelBeginner =
      'qy_certificate_level_beginner';
  static const String qyCertificateLevelIntermediate =
      'qy_certificate_level_intermediate';
  static const String qyCertificateLevelAdvanced =
      'qy_certificate_level_advanced';
  static const String qyCertificateLevelExpert = 'qy_certificate_level_expert';
  static const String qyCertificateBadgeNewbie = 'qy_certificate_badge_newbie';
  static const String qyCertificateBadgeDiligent =
      'qy_certificate_badge_diligent';
  static const String qyCertificateBadgePersistent =
      'qy_certificate_badge_persistent';
  static const String qyCertificateBadgePerfectAttendance =
      'qy_certificate_badge_perfect_attendance';
  static const String qyCertificateBadgeExpert = 'qy_certificate_badge_expert';
  static const String qyCertificateBadgeExcellent =
      'qy_certificate_badge_excellent';

  static const String qyCertBasicEnglishTitle = 'qy_cert_basic_english_title';
  static const String qyCertBasicEnglishDesc = 'qy_cert_basic_english_desc';
  static const String qyCertWordMasterTitle = 'qy_cert_word_master_title';
  static const String qyCertWordMasterDesc = 'qy_cert_word_master_desc';
  static const String qyCertListeningMasterTitle =
      'qy_cert_listening_master_title';
  static const String qyCertListeningMasterDesc =
      'qy_cert_listening_master_desc';
  static const String qyCertPerfectAttendanceTitle =
      'qy_cert_perfect_attendance_title';
  static const String qyCertPerfectAttendanceDesc =
      'qy_cert_perfect_attendance_desc';
  static const String qyCertVocabularyExpertTitle =
      'qy_cert_vocabulary_expert_title';
  static const String qyCertVocabularyExpertDesc =
      'qy_cert_vocabulary_expert_desc';
  static const String qyCertIeltsHighScoreTitle =
      'qy_cert_ielts_high_score_title';
  static const String qyCertIeltsHighScoreDesc =
      'qy_cert_ielts_high_score_desc';

  static const String qyAuthWelcomeMessage = 'qy_auth_welcome_message';
  static const String qyAuthAppSlogan = 'qy_auth_app_slogan';
  static const String qyAuthPhoneLogin = 'qy_auth_phone_login';
  static const String qyAuthWechatLogin = 'qy_auth_wechat_login';
  static const String qyAuthQQLogin = 'qy_auth_qq_login';
  static const String qyAuthGoogleLogin = 'qy_auth_google_login';
  static const String qyAuthGithubLogin = 'qy_auth_github_login';
  static const String qyAuthMoreOptions = 'qy_auth_more_options';
  static const String qyAuthCollapseOptions = 'qy_auth_collapse_options';
  static const String qyAuthPhoneNumber = 'qy_auth_phone_number';
  static const String qyAuthPhonePlaceholder = 'qy_auth_phone_placeholder';
  static const String qyAuthVerificationCode = 'qy_auth_verification_code';
  static const String qyAuthCodePlaceholder = 'qy_auth_code_placeholder';
  static const String qyAuthGetCode = 'qy_auth_get_code';
  static const String qyAuthResendCode = 'qy_auth_resend_code';
  static const String qyAuthCodeSent = 'qy_auth_code_sent';
  static const String qyAuthCodeSendFailed = 'qy_auth_code_send_failed';
  static const String qyAuthLoginButton = 'qy_auth_login_button';
  static const String qyAuthRegisterButton = 'qy_auth_register_button';
  static const String qyAuthLoginSuccess = 'qy_auth_login_success';
  static const String qyAuthLoginFailed = 'qy_auth_login_failed';
  static const String qyAuthRegisterSuccess = 'qy_auth_register_success';
  static const String qyAuthRegisterFailed = 'qy_auth_register_failed';
  static const String qyAuthSkipLogin = 'qy_auth_skip_login';
  static const String qyAuthGuestMode = 'qy_auth_guest_mode';
  static const String qyAuthAgreement = 'qy_auth_agreement';
  static const String qyAuthAgreementPrefix = 'qy_auth_agreement_prefix';
  static const String qyAuthTermsOfService = 'qy_auth_terms_of_service';
  static const String qyAuthAnd = 'qy_auth_and';
  static const String qyAuthPrivacyPolicy = 'qy_auth_privacy_policy';
  static const String qyAuthMustAgree = 'qy_auth_must_agree';
  static const String qyAuthPhoneInvalid = 'qy_auth_phone_invalid';
  static const String qyAuthCodeInvalid = 'qy_auth_code_invalid';
  static const String qyAuthCodeLength = 'qy_auth_code_length';
  static const String qyAuthSeconds = 'qy_auth_seconds';
  static const String qyAuthWelcomeTitle = 'qy_auth_welcome_title';
  static const String qyAuthSelectCountry = 'qy_auth_select_country';
  static const String qyAuthCountryCode = 'qy_auth_country_code';
  static const String qyAuthVerifyPhone = 'qy_auth_verify_phone';
  static const String qyAuthVerifyPhoneHint = 'qy_auth_verify_phone_hint';
  static const String qyAuthForgotPassword = 'qy_auth_forgot_password';
  static const String qyAuthResetPassword = 'qy_auth_reset_password';
  static const String qyAuthNewPassword = 'qy_auth_new_password';
  static const String qyAuthConfirmNewPassword = 'qy_auth_confirm_new_password';
  static const String qyAuthPasswordMismatch = 'qy_auth_password_mismatch';
  static const String qyAuthPasswordTooShort = 'qy_auth_password_too_short';
  static const String qyAuthCreatePin = 'qy_auth_create_pin';
  static const String qyAuthEnterPin = 'qy_auth_enter_pin';
  static const String qyAuthConfirmPin = 'qy_auth_confirm_pin';
  static const String qyAuthPinMismatch = 'qy_auth_pin_mismatch';
  static const String qyAuthAppTitle = 'qy_auth_app_title';
  static const String qyAuthWechatLoginFailed = 'qy_auth_wechat_login_failed';
  static const String qyAuthCongratulations = 'qy_auth_congratulations';
  static const String qyAuthAccountCreated = 'qy_auth_account_created';
  static const String qyAuthAccountCreatedDesc = 'qy_auth_account_created_desc';
  static const String qyAuthGetStarted = 'qy_auth_get_started';
  static const String qyAuthLoginModeSwitch = 'qy_auth_login_mode_switch';
  static const String qyAuthRegisterModeSwitch = 'qy_auth_register_mode_switch';
  static const String qyAuthThirdPartyLogin = 'qy_auth_third_party_login';

  static const String qySettingsPlayerCompatibility =
      'qy_settings_player_compatibility';
  static const String qySettingsFeedback = 'qy_settings_feedback';
  static const String qySettingsFeedbackInProgress =
      'qy_settings_feedback_in_progress';
  static const String qySettingsAboutInProgress =
      'qy_settings_about_in_progress';
  static const String qySettingsTermsInProgress =
      'qy_settings_terms_in_progress';
  static const String qySettingsPrivacyInProgress =
      'qy_settings_privacy_in_progress';

  static const String qySettingsDailyReminder = 'qy_settings_daily_reminder';
  static const String qySettingsEnableDailyReminder =
      'qy_settings_enable_daily_reminder';
  static const String qySettingsEnableDailyReminderSubtitle =
      'qy_settings_enable_daily_reminder_subtitle';
  static const String qySettingsReminderTime = 'qy_settings_reminder_time';
  static const String qySettingsVibrationReminder =
      'qy_settings_vibration_reminder';
  static const String qySettingsVibrationReminderSubtitle =
      'qy_settings_vibration_reminder_subtitle';
  static const String qySettingsSoundReminder = 'qy_settings_sound_reminder';
  static const String qySettingsSoundReminderSubtitle =
      'qy_settings_sound_reminder_subtitle';
  static const String qySettingsReminderDate = 'qy_settings_reminder_date';
  static const String qySettingsRemindEveryday = 'qy_settings_remind_everyday';
  static const String qySettingsWeekdayMonday = 'qy_settings_weekday_monday';
  static const String qySettingsWeekdayTuesday = 'qy_settings_weekday_tuesday';
  static const String qySettingsWeekdayWednesday =
      'qy_settings_weekday_wednesday';
  static const String qySettingsWeekdayThursday =
      'qy_settings_weekday_thursday';
  static const String qySettingsWeekdayFriday = 'qy_settings_weekday_friday';
  static const String qySettingsWeekdaySaturday =
      'qy_settings_weekday_saturday';
  static const String qySettingsWeekdaySunday = 'qy_settings_weekday_sunday';
  static const String qySettingsReminderMorning =
      'qy_settings_reminder_morning';
  static const String qySettingsReminderAfternoon =
      'qy_settings_reminder_afternoon';
  static const String qySettingsReminderEvening =
      'qy_settings_reminder_evening';
  static const String qySettingsReminderNight = 'qy_settings_reminder_night';
  static const String qySettingsReminderChangeTime =
      'qy_settings_reminder_change_time';
  static const String qySettingsReminderQuickSelect =
      'qy_settings_reminder_quick_select';
  static const String qySettingsReminderInfo = 'qy_settings_reminder_info';
  static const String qySettingsReminderInfoDetails =
      'qy_settings_reminder_info_details';

  static const String qySettingsFontSettings = 'qy_settings_font_settings';
  static const String qySettingsFont = 'qy_settings_font';
  static const String qySettingsAppearanceSettings =
      'qy_settings_appearance_settings';
  static const String qySettingsInterfaceLayout =
      'qy_settings_interface_layout';
  static const String qySettingsStandardMode = 'qy_settings_standard_mode';
  static const String qySettingsAccessibility = 'qy_settings_accessibility';
  static const String qySettingsHighContrast = 'qy_settings_high_contrast';
  static const String qySettingsHighContrastSubtitle =
      'qy_settings_high_contrast_subtitle';
  static const String qySettingsLargeFontMode = 'qy_settings_large_font_mode';
  static const String qySettingsLargeFontModeSubtitle =
      'qy_settings_large_font_mode_subtitle';
  static const String qySettingsSelectFont = 'qy_settings_select_font';
  static const String qySettingsLayoutInProgress =
      'qy_settings_layout_in_progress';

  static const String qySettingsModify = 'qy_settings_modify';
  static const String qySettingsRebind = 'qy_settings_rebind';
  static const String qySettingsBind = 'qy_settings_bind';
  static const String qySettingsAccountBinding = 'qy_settings_account_binding';
  static const String qySettingsPhone = 'qy_settings_phone';
  static const String qySettingsNotBound = 'qy_settings_not_bound';
  static const String qySettingsWechat = 'qy_settings_wechat';
  static const String qySettingsWeibo = 'qy_settings_weibo';
  static const String qySettingsQQ = 'qy_settings_qq';
  static const String qySettingsAccountDeletion =
      'qy_settings_account_deletion';
  static const String qySettingsAccountDeletionSubtitle =
      'qy_settings_account_deletion_subtitle';
  static const String qySettingsDeleteAccount = 'qy_settings_delete_account';
  static const String qySettingsChangeUsername = 'qy_settings_change_username';
  static const String qySettingsEnterNewUsername =
      'qy_settings_enter_new_username';
  static const String qySettingsUsernameUpdated =
      'qy_settings_username_updated';
  static const String qySettingsChangePasswordTitle =
      'qy_settings_change_password_title';
  static const String qySettingsEnterNewPassword =
      'qy_settings_enter_new_password';
  static const String qySettingsConfirmNewPassword =
      'qy_settings_confirm_new_password';
  static const String qySettingsPasswordUpdated =
      'qy_settings_password_updated';
  static const String qySettingsPhoneBinding = 'qy_settings_phone_binding';
  static const String qySettingsPhoneBindingInProgress =
      'qy_settings_phone_binding_in_progress';
  static const String qySettingsWechatBinding = 'qy_settings_wechat_binding';
  static const String qySettingsWechatBindingInProgress =
      'qy_settings_wechat_binding_in_progress';
  static const String qySettingsWeiboBinding = 'qy_settings_weibo_binding';
  static const String qySettingsWeiboBindingInProgress =
      'qy_settings_weibo_binding_in_progress';
  static const String qySettingsQQBinding = 'qy_settings_qq_binding';
  static const String qySettingsQQBindingInProgress =
      'qy_settings_qq_binding_in_progress';
  static const String qySettingsDeletionWarning =
      'qy_settings_deletion_warning';
  static const String qySettingsAfterDeletion = 'qy_settings_after_deletion';
  static const String qySettingsDeletionDataLoss =
      'qy_settings_deletion_data_loss';
  static const String qySettingsDeletionCourseLoss =
      'qy_settings_deletion_course_loss';
  static const String qySettingsDeletionAccountClear =
      'qy_settings_deletion_account_clear';
  static const String qySettingsConfirmDeletion =
      'qy_settings_confirm_deletion';
  static const String qySettingsFinalConfirmation =
      'qy_settings_final_confirmation';
  static const String qySettingsFinalConfirmationMessage =
      'qy_settings_final_confirmation_message';
  static const String qySettingsLetMeThink = 'qy_settings_let_me_think';
  static const String qySettingsAccountDeletionInProgress =
      'qy_settings_account_deletion_in_progress';

  static const String qySettingsSmartRecommendation =
      'qy_settings_smart_recommendation';
  static const String qySettingsAutoRecommend = 'qy_settings_auto_recommend';
  static const String qySettingsAutoRecommendSubtitle =
      'qy_settings_auto_recommend_subtitle';
  static const String qySettingsRecommend = 'qy_settings_recommend';
  static const String qySettingsRecommendWords = 'qy_settings_recommend_words';
  static const String qySettingsRecommendProgress =
      'qy_settings_recommend_progress';
  static const String qySettingsRecommendProgressDescription =
      'qy_settings_recommend_progress_description';
  static const String qySettingsRecommendDifficulty =
      'qy_settings_recommend_difficulty';
  static const String qySettingsRecommendDifficultyDescription =
      'qy_settings_recommend_difficulty_description';
  static const String qySettingsRecommendSimilar =
      'qy_settings_recommend_similar';
  static const String qySettingsRecommendSimilarDescription =
      'qy_settings_recommend_similar_description';
  static const String qySettingsRecommendErrors =
      'qy_settings_recommend_errors';
  static const String qySettingsRecommendErrorsDescription =
      'qy_settings_recommend_errors_description';
  static const String qySettingsRecommendContent =
      'qy_settings_recommend_content';
  static const String qySettingsRecommendTrending =
      'qy_settings_recommend_trending';
  static const String qySettingsRecommendTrendingDescription =
      'qy_settings_recommend_trending_description';
  static const String qySettingsRecommendPersonalized =
      'qy_settings_recommend_personalized';
  static const String qySettingsRecommendPersonalizedDescription =
      'qy_settings_recommend_personalized_description';
  static const String qySettingsRecommendInfo = 'qy_settings_recommend_info';
  static const String qySettingsRecommendInfoDescription =
      'qy_settings_recommend_info_description';
  static const String qySettingsRecommendReset = 'qy_settings_recommend_reset';
  static const String qySettingsRecommendResetDefaults =
      'qy_settings_recommend_reset_defaults';
  static const String qySettingsDifficulty = 'qy_settings_difficulty';
  static const String qySettingsDifficultySettings =
      'qy_settings_difficulty_settings';
  static const String qySettingsDifficultyBeginner =
      'qy_settings_difficulty_beginner';
  static const String qySettingsDifficultyIntermediate =
      'qy_settings_difficulty_intermediate';
  static const String qySettingsDifficultyAdvanced =
      'qy_settings_difficulty_advanced';
  static const String qySettingsDifficultyExpert =
      'qy_settings_difficulty_expert';
  static const String qySettingsInterestTags = 'qy_settings_interest_tags';
  static const String qySettingsInterestTagsSelected =
      'qy_settings_interest_tags_selected';
  static const String qySettingsRecommendationFrequency =
      'qy_settings_recommendation_frequency';
  static const String qySettingsRecommendationStrength =
      'qy_settings_recommendation_strength';
  static const String qySettingsSelectDifficulty =
      'qy_settings_select_difficulty';
  static const String qySettingsDifficultyBeginnerDesc =
      'qy_settings_difficulty_beginner_desc';
  static const String qySettingsDifficultyIntermediateDesc =
      'qy_settings_difficulty_intermediate_desc';
  static const String qySettingsDifficultyAdvancedDesc =
      'qy_settings_difficulty_advanced_desc';
  static const String qySettingsDifficultyExpertDesc =
      'qy_settings_difficulty_expert_desc';

  // Word Book Module
  static const String qyWordBook = 'qy_word_book';
  static const String qyWordBookTitle = 'qy_word_book_title';
  static const String qyWords = 'qy_words';
  static const String qyCorpus = 'qy_corpus';
  static const String qyWordBookExampleSentence =
      'qy_word_book_example_sentence';
  static const String qyWordBookPronunciation = 'qy_word_book_pronunciation';
  static const String qyWordBookMastered = 'qy_word_book_mastered';
  static const String qyWordBookMasteryLevel = 'qy_word_book_mastery_level';
  static const String qyWordBookNewWord = 'qy_word_book_new_word';
  static const String qyWordBookLearning = 'qy_word_book_learning';
  static const String qyWordBookAll = 'qy_word_book_all';
  static const String qyWordBookStatsTitle = 'qy_word_book_stats_title';
  static const String qyWordBookWordCount = 'qy_word_book_word_count';
  static const String qyWordBookLearningCount = 'qy_word_book_learning_count';
  static const String qyWordBookNewCount = 'qy_word_book_new_count';
  static const String qyWordBookMasteredCount = 'qy_word_book_mastered_count';
  static const String qyWordBookSearchHint = 'qy_word_book_search_hint';
  static const String qyWordBookLoading = 'qy_word_book_loading';
  static const String qyWordBookNoWords = 'qy_word_book_no_words';
  static const String qyWordBookAddToNew = 'qy_word_book_add_to_new';
  static const String qyWordBookAddToMastered = 'qy_word_book_add_to_mastered';
  static const String qyWordBookRemoveFromBook =
      'qy_word_book_remove_from_book';
  static const String qyWordBookFilterTitle = 'qy_word_book_filter_title';
  static const String qyWordBookFilterAll = 'qy_word_book_filter_all';
  static const String qyWordBookFilterWithinBook =
      'qy_word_book_filter_within_book';
  static const String qyWordBookSnackPlay = 'qy_word_book_snack_play';
  static const String qyWordBookSnackLearned = 'qy_word_book_snack_learned';
  static const String qyWordBookSnackAdded = 'qy_word_book_snack_added';
  static const String qyWordBookSnackRemoved = 'qy_word_book_snack_removed';
  static const String qyNoWordBooks = 'qy_no_word_books';
  static const String qyPlayingAudio = 'qy_playing_audio';
  static const String qyExcellent = 'qy_excellent';
  static const String qyGoodJob = 'qy_good_job';
  static const String qyKeepPracticing = 'qy_keep_practicing';
  static const String qyYourScore = 'qy_your_score';
  static const String qyDictation = 'qy_dictation';
  static const String qyListenAndWrite = 'qy_listen_and_write';
  static const String qyTypeWhatYouHear = 'qy_type_what_you_hear';
  static const String qyEnterSentence = 'qy_enter_sentence';
  static const String qyFinish = 'qy_finish';
  static const String qyCheck = 'qy_check';
  static const String qyExit = 'qy_exit';
  static const String qyWordTest = 'qy_word_test';
  static const String qyWordTestDesc = 'qy_word_test_desc';
  static const String qyFlashcards = 'qy_flashcards';
  static const String qyTapToFlip = 'qy_tap_to_flip';
  static const String qyDefinition = 'qy_definition';
  static const String qyExamples = 'qy_examples';
  static const String qySynonyms = 'qy_synonyms';
  static const String qyFlip = 'qy_flip';
  static const String qyMarkedAsKnown = 'qy_marked_as_known';
  static const String qyMarkedForReview = 'qy_marked_for_review';
  static const String qyReviewComplete = 'qy_review_complete';
  static const String qyReviewed = 'qy_reviewed';
  static const String qyWordReview = 'qy_word_review';
  static const String qyTapToHide = 'qy_tap_to_hide';
  static const String qyTapToReveal = 'qy_tap_to_reveal';
  static const String qyMasteryLevel = 'qy_mastery_level';
  static const String qyLastReviewed = 'qy_last_reviewed';
  static const String qyNeedReview = 'qy_need_review';
  static const String qyKnown = 'qy_known';
  static const String qyHideDefinition = 'qy_hide_definition';
  static const String qyShowDefinition = 'qy_show_definition';

  // Word Listening Module
  static const String qyWordListening = 'qy_word_listening';
  static const String qyWordListeningDesc = 'qy_word_listening_desc';
  static const String qyWordDictation = 'qy_word_dictation';
  static const String qyWordWordBook = 'qy_word_word_book';
  static const String qyWordTodayNew = 'qy_word_today_new';
  static const String qyWordFreeMode = 'qy_word_free_mode';
  static const String qyWordFreeModeDesc = 'qy_word_free_mode_desc';
  static const String qyWordListeningExpired = 'qy_word_listening_expired';
  static const String qyJoinMembershipDesc = 'qy_join_membership_desc';
  static const String qyJoinMembership = 'qy_join_membership';
  static const String qyWordSleepMode = 'qy_word_sleep_mode';
  static const String qyWordSleepModeDesc = 'qy_word_sleep_mode_desc';
  static const String qyListeningPlay = 'qy_listening_play';
  static const String qyListeningStop = 'qy_listening_stop';
  static const String qyListeningLoop = 'qy_listening_loop';
  static const String qyListeningOn = 'qy_listening_on';
  static const String qyListeningOff = 'qy_listening_off';
  static const String qyListeningSpeedSlow = 'qy_listening_speed_slow';
  static const String qyListeningSpeedNormal = 'qy_listening_speed_normal';
  static const String qyListeningSpeedFast = 'qy_listening_speed_fast';
  static const String qyListeningCategoryDaily = 'qy_listening_category_daily';
  static const String qyListeningCategoryDailyDesc =
      'qy_listening_category_daily_desc';
  static const String qyListeningCategoryBusiness =
      'qy_listening_category_business';
  static const String qyListeningCategoryBusinessDesc =
      'qy_listening_category_business_desc';
  static const String qyListeningCategoryAcademic =
      'qy_listening_category_academic';
  static const String qyListeningCategoryAcademicDesc =
      'qy_listening_category_academic_desc';
  static const String qyListeningCategoryTravel =
      'qy_listening_category_travel';
  static const String qyListeningCategoryTravelDesc =
      'qy_listening_category_travel_desc';
  static const String qyListeningCategoryTech = 'qy_listening_category_tech';
  static const String qyListeningCategoryTechDesc =
      'qy_listening_category_tech_desc';
  static const String qyListeningCategoryMedical =
      'qy_listening_category_medical';
  static const String qyListeningCategoryMedicalDesc =
      'qy_listening_category_medical_desc';
  static const String qyListeningDictationBeginner =
      'qy_listening_dictation_beginner';
  static const String qyListeningDictationBeginnerDesc =
      'qy_listening_dictation_beginner_desc';
  static const String qyListeningDictationIntermediate =
      'qy_listening_dictation_intermediate';
  static const String qyListeningDictationIntermediateDesc =
      'qy_listening_dictation_intermediate_desc';
  static const String qyListeningDictationAdvanced =
      'qy_listening_dictation_advanced';
  static const String qyListeningDictationAdvancedDesc =
      'qy_listening_dictation_advanced_desc';
  static const String qyListeningDictationExpert =
      'qy_listening_dictation_expert';
  static const String qyListeningDictationExpertDesc =
      'qy_listening_dictation_expert_desc';
  static const String qyListeningDictation = 'qy_listening_dictation';
  static const String qyListeningDictationTitle =
      'qy_listening_dictation_title';
  static const String qyListeningDictationDesc = 'qy_listening_dictation_desc';
  static const String qyListeningQuestionNumber =
      'qy_listening_question_number';
  static const String qyListeningAccuracy = 'qy_listening_accuracy';
  static const String qyListeningProgress = 'qy_listening_progress';
  static const String qyListeningPlayWord = 'qy_listening_play_word';
  static const String qyListeningStopPlay = 'qy_listening_stop_play';
  static const String qyListeningPlayCount = 'qy_listening_play_count';
  static const String qyListeningEnterWord = 'qy_listening_enter_word';
  static const String qyListeningInputPlaceholder =
      'qy_listening_input_placeholder';
  static const String qyListeningSubmitAnswer = 'qy_listening_submit_answer';
  static const String qyListeningHint = 'qy_listening_hint';
  static const String qyListeningHintMessage = 'qy_listening_hint_message';
  static const String qyListeningCorrect = 'qy_listening_correct';
  static const String qyListeningIncorrect = 'qy_listening_incorrect';
  static const String qyListeningCorrectAnswer = 'qy_listening_correct_answer';
  static const String qyListeningMeaning = 'qy_listening_meaning';
  static const String qyListeningExample = 'qy_listening_example';
  static const String qyListeningExampleText = 'qy_listening_example_text';
  static const String qyListeningPrevious = 'qy_listening_previous';
  static const String qyListeningNext = 'qy_listening_next';
  static const String qyListeningComplete = 'qy_listening_complete';
  static const String qyListeningPracticeComplete =
      'qy_listening_practice_complete';
  static const String qyListeningCorrectAnswers =
      'qy_listening_correct_answers';
  static const String qyListeningTodayListening =
      'qy_listening_today_listening';
  static const String qyListeningLearnedWords = 'qy_listening_learned_words';
  static const String qyListeningStreakDays = 'qy_listening_streak_days';
  static const String qyListeningTodayPractice = 'qy_listening_today_practice';
  static const String qyListeningWeekPractice = 'qy_listening_week_practice';
  static const String qyListeningTotalTime = 'qy_listening_total_time';
  static const String qyListeningContinuousDays =
      'qy_listening_continuous_days';
  static const String qyListeningDailyAverage = 'qy_listening_daily_average';
  static const String qyListeningFreeTitle = 'qy_listening_free_title';
  static const String qyListeningFreeDesc = 'qy_listening_free_desc';
  static const String qyListeningSpeed = 'qy_listening_speed';
  static const String qyListeningCurrentWord = 'qy_listening_current_word';
  static const String qyListeningNextWordTip = 'qy_listening_next_word_tip';
  static const String qyListeningStats = 'qy_listening_stats';
  static const String qyListeningAddToVocab = 'qy_listening_add_to_vocab';
  static const String qyListeningPracticing = 'qy_listening_practicing';
  static const String qyListeningMastered = 'qy_listening_mastered';
  static const String qyListeningAccuracyRate = 'qy_listening_accuracy_rate';
  static const String qyListeningDictationTraining =
      'qy_listening_dictation_training';
  static const String qyListeningDictationTrainingDesc =
      'qy_listening_dictation_training_desc';
  static const String qyListeningWordCount = 'qy_listening_word_count';
  static const String qyListeningUnlockAfterCurrentLevel =
      'qy_listening_unlock_after_current_level';
  static const String qyListeningDictationHelp = 'qy_listening_dictation_help';
  static const String qyListeningHelpHowToPractice =
      'qy_listening_help_how_to_practice';
  static const String qyListeningHelpPracticeSteps =
      'qy_listening_help_practice_steps';
  static const String qyListeningHelpTipsContent =
      'qy_listening_help_tips_content';
  static const String qyListeningDailyChallengeInDev =
      'qy_listening_daily_challenge_in_dev';
  static const String qyListeningDailyChallenge =
      'qy_listening_daily_challenge';
  static const String qyListeningUnlockTip = 'qy_listening_unlock_tip';
  static const String qyListeningHelp = 'qy_listening_help';
  static const String qyListeningHelpContent = 'qy_listening_help_content';
  static const String qyListeningHelpTips = 'qy_listening_help_tips';
  static const String qyListeningGotIt = 'qy_listening_got_it';
  static const String qyListeningDailyChallengeComingSoon =
      'qy_listening_daily_challenge_coming_soon';
  static const String qyListeningSelectCategory =
      'qy_listening_select_category';
  static const String qyListeningPlaylist = 'qy_listening_playlist';
  static const String qyListeningMinutes = 'qy_listening_minutes';
  static const String qyListeningDays = 'qy_listening_days';
  static const String qyListeningShuffle = 'qy_listening_shuffle';
  static const String qyListeningSettings = 'qy_listening_settings';
  static const String qyListeningPlaying = 'qy_listening_playing';
  static const String qyListeningPaused = 'qy_listening_paused';
  static const String qyListeningClickToPlay = 'qy_listening_click_to_play';
  static const String qyListeningWriteWord = 'qy_listening_write_word';
  static const String qyListeningInputWord = 'qy_listening_input_word';
  static const String qyListeningPreviousAttempts =
      'qy_listening_previous_attempts';
  static const String qyListeningHintShown = 'qy_listening_hint_shown';
  static const String qyListeningShowHint = 'qy_listening_show_hint';
  static const String qyListeningCheckAnswer = 'qy_listening_check_answer';
  static const String qyListeningReplay = 'qy_listening_replay';
  static const String qyListeningEasy = 'qy_listening_easy';
  static const String qyListeningMedium = 'qy_listening_medium';
  static const String qyListeningHard = 'qy_listening_hard';
  static const String qyListeningUnknown = 'qy_listening_unknown';

  // Word Listening - Sleep Mode
  static const String qyListeningSleepTitle = 'qy_listening_sleep_title';
  static const String qyListeningSleepSubtitle = 'qy_listening_sleep_subtitle';
  static const String qyListeningSleepCategorySoothing =
      'qy_listening_sleep_category_soothing';
  static const String qyListeningSleepCategoryNature =
      'qy_listening_sleep_category_nature';
  static const String qyListeningSleepCategoryStory =
      'qy_listening_sleep_category_story';
  static const String qyListeningSleepCategoryPoetry =
      'qy_listening_sleep_category_poetry';
  static const String qyListeningSleepCategoryMeditation =
      'qy_listening_sleep_category_meditation';
  static const String qyListeningSleepSelectCategory =
      'qy_listening_sleep_select_category';
  static const String qyListeningSleepDuration = 'qy_listening_sleep_duration';
  static const String qyListeningSleepMinutes = 'qy_listening_sleep_minutes';
  static const String qyListeningSleepTipsTitle =
      'qy_listening_sleep_tips_title';
  static const String qyListeningSleepTip1 = 'qy_listening_sleep_tip1';
  static const String qyListeningSleepTip2 = 'qy_listening_sleep_tip2';
  static const String qyListeningSleepTip3 = 'qy_listening_sleep_tip3';
  static const String qyListeningSleepTip4 = 'qy_listening_sleep_tip4';
  static const String qyListeningSleepStart = 'qy_listening_sleep_start';
  static const String qyListeningSleepPlaying = 'qy_listening_sleep_playing';
  static const String qyListeningSleepRemainingTime =
      'qy_listening_sleep_remaining_time';
  static const String qyListeningSleepProgress = 'qy_listening_sleep_progress';
  static const String qyListeningSleepEnd = 'qy_listening_sleep_end';
  static const String qyListeningSleepPrevious = 'qy_listening_sleep_previous';
  static const String qyListeningSleepNext = 'qy_listening_sleep_next';
  static const String qyListeningSleepEndTitle = 'qy_listening_sleep_end_title';
  static const String qyListeningSleepEndMessage =
      'qy_listening_sleep_end_message';
  static const String qyListeningSleepContinue = 'qy_listening_sleep_continue';

  // Expert Dictation Level 3 specific keys
  static const String qyListeningDictationExpertTitle =
      'qy_listening_dictation_expert_title';
  static const String qyListeningExpertProgress =
      'qy_listening_expert_progress';
  static const String qyListeningStreak = 'qy_listening_streak';
  static const String qyListeningAttempts = 'qy_listening_attempts';
  static const String qyListeningLevel = 'qy_listening_level';
  static const String qyListeningExpert = 'qy_listening_expert';
  static const String qyListeningExpertLevel = 'qy_listening_expert_level';
  static const String qyListeningExamples = 'qy_listening_examples';
  static const String qyListeningPlayingExpert = 'qy_listening_playing_expert';
  static const String qyListeningClickExpert = 'qy_listening_click_expert';
  static const String qyListeningEnterExpert = 'qy_listening_enter_expert';
  static const String qyListeningInputExpert = 'qy_listening_input_expert';
  static const String qyListeningAttemptHistory =
      'qy_listening_attempt_history';
  static const String qyListeningWordPhenomenalMeaning =
      'qy_listening_word_phenomenal_meaning';
  static const String qyListeningWordConscientiousMeaning =
      'qy_listening_word_conscientious_meaning';
  static const String qyListeningWordUnprecedentedMeaning =
      'qy_listening_word_unprecedented_meaning';
  static const String qyListeningWordEntrepreneurialMeaning =
      'qy_listening_word_entrepreneurial_meaning';
  static const String qyListeningWordSophisticatedMeaning =
      'qy_listening_word_sophisticated_meaning';
  static const String qyListeningPlayingExpertAudio =
      'qy_listening_playing_expert_audio';
  static const String qyListeningCorrectAnswerLabel =
      'qy_listening_correct_answer_label';
  static const String qyListeningExpertCertified =
      'qy_listening_expert_certified';
  static const String qyListeningChallengeComplete =
      'qy_listening_challenge_complete';
  static const String qyListeningFinalAccuracy = 'qy_listening_final_accuracy';
  static const String qyListeningCorrectWords = 'qy_listening_correct_words';
  static const String qyListeningMaxStreak = 'qy_listening_max_streak';
  static const String qyListeningPhonetic = 'qy_listening_phonetic';
  static const String qyListeningVerifyAnswer = 'qy_listening_verify_answer';
  static const String qyListeningSkip = 'qy_listening_skip';
  static const String qyListeningStreakSuccess = 'qy_listening_streak_success';
  static const String qyListeningWordAppleMeaning =
      'qy_listening_word_apple_meaning';
  static const String qyListeningWordBeautifulMeaning =
      'qy_listening_word_beautiful_meaning';
  static const String qyListeningWordComputerMeaning =
      'qy_listening_word_computer_meaning';
  static const String qyListeningWordEducationMeaning =
      'qy_listening_word_education_meaning';
  static const String qyListeningWordFriendshipMeaning =
      'qy_listening_word_friendship_meaning';
  static const String qyListeningWordMagnificentMeaning =
      'qy_listening_word_magnificent_meaning';
  static const String qyListeningWordExtraordinaryMeaning =
      'qy_listening_word_extraordinary_meaning';
  static const String qyListeningWordAccomplishmentMeaning =
      'qy_listening_word_accomplishment_meaning';
  static const String qyListeningWordEnvironmentalMeaning =
      'qy_listening_word_environmental_meaning';
  static const String qyListeningWordRevolutionaryMeaning =
      'qy_listening_word_revolutionary_meaning';
  static const String qyListeningSlow = 'qy_listening_slow';
  static const String qyListeningNormal = 'qy_listening_normal';
  static const String qyListeningFast = 'qy_listening_fast';
  static const String qyListeningAnswerCorrect = 'qy_listening_answer_correct';
  static const String qyListeningAnswerIncorrect =
      'qy_listening_answer_incorrect';
  static const String qyListeningCorrectAnswerIs =
      'qy_listening_correct_answer_is';
  static const String qyListeningContinue = 'qy_listening_continue';
  static const String qyListeningRetry = 'qy_listening_retry';
  static const String qyListeningDone = 'qy_listening_done';
  static const String qyListeningTotalAttempts = 'qy_listening_total_attempts';
  static const String qyListeningPlayingAudio = 'qy_listening_playing_audio';
  static const String qyExpertLevel = 'qy_expert_level';

  // Courses
  static const String qyCoursesTitle = 'qy_courses_title';
  static const String qyCoursesFeatured = 'qy_courses_featured';
  static const String qyCoursesCategories = 'qy_courses_categories';
  static const String qyCoursesTagline = 'qy_courses_tagline';
  static const String qyCoursesCount = 'qy_courses_count';
  static const String qyCoursesInDev = 'qy_courses_in_dev';
  static const String qyCourseHotCategoriesTitle =
      'qy_course_hot_categories_title';
  static const String qyCourseCategoryCet = 'qy_course_category_cet';
  static const String qyCourseCategoryPostgraduate =
      'qy_course_category_postgraduate';
  static const String qyCourseCategoryOral = 'qy_course_category_oral';
  static const String qyCourseCategoryPython = 'qy_course_category_python';
  static const String qyCourseCategoryReading = 'qy_course_category_reading';
  static const String qyCourseCategoryCollege = 'qy_course_category_college';
  static const String qyCourseLearningFocusTitle =
      'qy_course_learning_focus_title';
  static const String qyCourseFocusEfficientTitle =
      'qy_course_focus_efficient_title';
  static const String qyCourseFocusEfficientSubtitle =
      'qy_course_focus_efficient_subtitle';
  static const String qyCourseFocusDailyTitle = 'qy_course_focus_daily_title';
  static const String qyCourseFocusDailySubtitle =
      'qy_course_focus_daily_subtitle';
  static const String qyCourseFocusCareerTitle = 'qy_course_focus_career_title';
  static const String qyCourseFocusCareerSubtitle =
      'qy_course_focus_career_subtitle';
  static const String qyCourseVipLabel = 'qy_course_vip_label';
  static const String qyCourseVipHeadline = 'qy_course_vip_headline';
  static const String qyCourseVipSubhead = 'qy_course_vip_subhead';
  static const String qyCourseVipBenefit1 = 'qy_course_vip_benefit_1';
  static const String qyCourseVipBenefit2 = 'qy_course_vip_benefit_2';
  static const String qyCourseVipBenefit3 = 'qy_course_vip_benefit_3';
  static const String qyCourseVipCta = 'qy_course_vip_cta';
  static const String qyCoursePlanBadgeAdvanced =
      'qy_course_plan_badge_advanced';
  static const String qyCoursePlanBadgeFlagship =
      'qy_course_plan_badge_flagship';
  static const String qyCourseFeaturedTitle1 = 'qy_course_featured_title_1';
  static const String qyCourseFeaturedTitle2 = 'qy_course_featured_title_2';
  static const String qyCoursePlanTitleCareerUpgrade =
      'qy_course_plan_title_career_upgrade';
  static const String qyCoursePlanDescriptionCareerUpgrade =
      'qy_course_plan_description_career_upgrade';
  static const String qyCoursePlanDuration12Weeks =
      'qy_course_plan_duration_12_weeks';
  static const String qyCoursePlanTitleBusinessCommunication =
      'qy_course_plan_title_business_communication';
  static const String qyCoursePlanDescriptionBusinessCommunication =
      'qy_course_plan_description_business_communication';
  static const String qyCoursePlanDuration24Lessons =
      'qy_course_plan_duration_24_lessons';
  static const String qyCoursePlanActionExperience =
      'qy_course_plan_action_experience';
  static const String qyCoursePlanActionDetails =
      'qy_course_plan_action_details';
  static const String qyCoursePlanActionStart = 'qy_course_plan_action_start';
  static const String qyCourseOpening = 'qy_course_opening';
  static const String qyCourseVipSnackbar = 'qy_course_vip_snackbar';
  static const String qyCoursePythonZoneTitle = 'qy_course_python_zone_title';
  static const String qyCourseDigitalSkill = 'qy_course_digital_skill';
  static const String qyCoursePythonPathTitle = 'qy_course_python_path_title';
  static const String qyCoursePythonPathDescription =
      'qy_course_python_path_description';
  static const String qyCourseBadgeIntro = 'qy_course_badge_intro';
  static const String qyCourseBadgeIntermediate =
      'qy_course_badge_intermediate';
  static const String qyCourseBadgePopular = 'qy_course_badge_popular';
  static const String qyCourseBadgePractical = 'qy_course_badge_practical';
  static const String qyCourseVipFreeTag = 'qy_course_vip_free_tag';
  static const String qyCoursePythonIntroTitle = 'qy_course_python_intro_title';
  static const String qyCoursePythonIntroSubtitle =
      'qy_course_python_intro_subtitle';
  static const String qyCoursePythonAdvanceTitle =
      'qy_course_python_advance_title';
  static const String qyCoursePythonAdvanceSubtitle =
      'qy_course_python_advance_subtitle';
  static const String qyCoursePythonDataTitle = 'qy_course_python_data_title';
  static const String qyCoursePythonDataSubtitle =
      'qy_course_python_data_subtitle';
  static const String qyCoursePythonCasesTitle = 'qy_course_python_cases_title';
  static const String qyCoursePythonCasesSubtitle =
      'qy_course_python_cases_subtitle';
  static const String qyCourseExperienceZoneTitle =
      'qy_course_experience_zone_title';
  static const String qyCourseVipExperienceSubtitle =
      'qy_course_vip_experience_subtitle';
  static const String qyCourseVipCoverage = 'qy_course_vip_coverage';
  static const String qyCoursePlanCategoryIelts =
      'qy_course_plan_category_ielts';
  static const String qyCoursePlanCategoryGaokao =
      'qy_course_plan_category_gaokao';
  static const String qyCoursePlanCategoryMiddle =
      'qy_course_plan_category_middle';
  static const String qyCoursePlanAllSkillTagline =
      'qy_course_plan_all_skill_tagline';
  static const String qyCoursePlanAllSkillDescription =
      'qy_course_plan_all_skill_description';
  static const String qyCoursePlanClassicTitle = 'qy_course_plan_classic_title';
  static const String qyCoursePlanClassicName = 'qy_course_plan_classic_name';
  static const String qyCoursePlanClassicStats = 'qy_course_plan_classic_stats';
  static const String qyCoursePlanOralTitle = 'qy_course_plan_oral_title';
  static const String qyCoursePlanOralName = 'qy_course_plan_oral_name';
  static const String qyCoursePlanOralStats = 'qy_course_plan_oral_stats';
  static const String qyCoursePlanReadingTitle = 'qy_course_plan_reading_title';
  static const String qyCoursePlanViewMore = 'qy_course_plan_view_more';
  static const String qyCoursePlanTextbookSync = 'qy_course_plan_textbook_sync';
  static const String qyCoursePlanTextbookTitle =
      'qy_course_plan_textbook_title';
  static const String qyCoursePlanReadingBrand = 'qy_course_plan_reading_brand';
  static const String qyCoursePlanFurtherStudy = 'qy_course_plan_further_study';
  static const String qyCoursePlanTextbookGrade =
      'qy_course_plan_textbook_grade';
  static const String qyCoursePlanMoreComing = 'qy_course_plan_more_coming';

  // Course Detail
  static const String qyCourseContinue = 'qy_course_continue';
  static const String qyCourseContinueCoding = 'qy_course_continue_coding';
  static const String qyCourseIelts = 'qy_course_ielts';
  static const String qyCourseIeltsDuration = 'qy_course_ielts_duration';
  static const String qyCoursePython = 'qy_course_python';
  static const String qyCoursePythonDesc = 'qy_course_python_desc';
  static const String qyCoursePythonDuration = 'qy_course_python_duration';
  static const String qyCourseIeltsDesc = 'qy_course_ielts_desc';
  static const String qyCourseMockTest = 'qy_course_mock_test';
  static const String qyCourseSpeakingPractice = 'qy_course_speaking_practice';
  static const String qyCourseIeltsMasterTitle = 'qy_course_ielts_master_title';
  static const String qyCourseIeltsMasterSubtitle =
      'qy_course_ielts_master_subtitle';
  static const String qyCourseIeltsMasterDescription =
      'qy_course_ielts_master_description';
  static const String qyCourseIeltsFeature1 = 'qy_course_ielts_feature_1';
  static const String qyCourseIeltsFeature2 = 'qy_course_ielts_feature_2';
  static const String qyCourseIeltsFeature3 = 'qy_course_ielts_feature_3';
  static const String qyCourseIeltsFeature4 = 'qy_course_ielts_feature_4';
  static const String qyCourseIeltsFeature5 = 'qy_course_ielts_feature_5';
  static const String qyCourseIeltsFeature6 = 'qy_course_ielts_feature_6';
  static const String qyCourseIeltsTopic1 = 'qy_course_ielts_topic_1';
  static const String qyCourseIeltsTopic2 = 'qy_course_ielts_topic_2';
  static const String qyCourseIeltsTopic3 = 'qy_course_ielts_topic_3';
  static const String qyCourseIeltsTopic4 = 'qy_course_ielts_topic_4';
  static const String qyCourseIeltsTopic5 = 'qy_course_ielts_topic_5';
  static const String qyCourseIeltsTopic6 = 'qy_course_ielts_topic_6';
  static const String qyCoursePythonMasterTitle =
      'qy_course_python_master_title';
  static const String qyCoursePythonMasterSubtitle =
      'qy_course_python_master_subtitle';
  static const String qyCoursePythonMasterDescription =
      'qy_course_python_master_description';
  static const String qyCoursePythonFeature1 = 'qy_course_python_feature_1';
  static const String qyCoursePythonFeature2 = 'qy_course_python_feature_2';
  static const String qyCoursePythonFeature3 = 'qy_course_python_feature_3';
  static const String qyCoursePythonFeature4 = 'qy_course_python_feature_4';
  static const String qyCoursePythonFeature5 = 'qy_course_python_feature_5';
  static const String qyCoursePythonFeature6 = 'qy_course_python_feature_6';
  static const String qyCoursePythonTopic1 = 'qy_course_python_topic_1';
  static const String qyCoursePythonTopic2 = 'qy_course_python_topic_2';
  static const String qyCoursePythonTopic3 = 'qy_course_python_topic_3';
  static const String qyCoursePythonTopic4 = 'qy_course_python_topic_4';
  static const String qyCoursePythonTopic5 = 'qy_course_python_topic_5';
  static const String qyCoursePythonTopic6 = 'qy_course_python_topic_6';
  static const String qyIeltsFourSkills = 'qy_ielts_four_skills';
  static const String qyIeltsPracticeTests = 'qy_ielts_practice_tests';
  static const String qyIeltsOneOnOne = 'qy_ielts_one_on_one';
  static const String qyIeltsCustomPlan = 'qy_ielts_custom_plan';
  static const String qyIeltsProgressTracking = 'qy_ielts_progress_tracking';
  static const String qyIeltsAIAssessment = 'qy_ielts_ai_assessment';
  static const String qyIeltsSpeaking = 'qy_ielts_speaking';
  static const String qyIeltsWriting = 'qy_ielts_writing';
  static const String qyIeltsReading = 'qy_ielts_reading';
  static const String qyIeltsListening = 'qy_ielts_listening';
  static const String qyIeltsVocabulary = 'qy_ielts_vocabulary';
  static const String qyIeltsTestTips = 'qy_ielts_test_tips';
  static const String qyPractice = 'qy_practice';
  static const String qyProjectDriven = 'qy_project_driven';
  static const String qyCodePractice = 'qy_code_practice';
  static const String qyCodeReview = 'qy_code_review';
  static const String qyPortfolioGuide = 'qy_portfolio_guide';
  static const String qyJobRecommendation = 'qy_job_recommendation';
  static const String qyCommunitySupport = 'qy_community_support';
  static const String qyPythonBasics = 'qy_python_basics';
  static const String qyOOP = 'qy_oop';
  static const String qyWebFramework = 'qy_web_framework';
  static const String qyDataAnalysis = 'qy_data_analysis';
  static const String qyMachineLearning = 'qy_machine_learning';
  static const String qyProjectPractice = 'qy_project_practice';
  static const String qyCourseOverview = 'qy_course_overview';
  static const String qyCourseLessons = 'qy_course_lessons';
  static const String qyCourseProjects = 'qy_course_projects';
  static const String qyCourseProgress = 'qy_course_progress';
  static const String qyOverview = 'qy_overview';
  static const String qyCurriculum = 'qy_curriculum';
  static const String qyReviews = 'qy_reviews';
  static const String qyUserReviews = 'qy_user_reviews';
  static const String qyAboutCourse = 'qy_about_course';
  static const String qyInstructor = 'qy_instructor';
  static const String qyLevel = 'qy_level';
  static const String qyDuration = 'qy_duration';
  static const String qyPrice = 'qy_price';
  static const String qyEnrolled = 'qy_enrolled';
  static const String qyEnrollNow = 'qy_enroll_now';
  static const String qyCourseEnrolled = 'qy_course_enrolled';
  static const String qyCourseUnenrolled = 'qy_course_unenrolled';
  static const String qyLessonComplete = 'qy_lesson_complete';
  static const String qyCongratulations = 'qy_congratulations';
  static const String qySection = 'qy_section';
  static const String qyPause = 'qy_pause';
  static const String qyPlay = 'qy_play';
  static const String qyQuestions = 'qy_questions';
  static const String qyStartQuiz = 'qy_start_quiz';
  static const String qyOverallProgress = 'qy_overall_progress';
  static const String qyLessonsCompleted = 'qy_lessons_completed';
  static const String qyRemaining = 'qy_remaining';
  static const String qyAvgScore = 'qy_avg_score';
  static const String qyChapters = 'qy_chapters';

  // IELTS Course Detail
  static const String qyIeltsCourseInfo = 'qy_ielts_course_info';
  static const String qyIeltsCourseDuration = 'qy_ielts_course_duration';
  static const String qyIeltsCourseLessons = 'qy_ielts_course_lessons';
  static const String qyIeltsCourseLevel = 'qy_ielts_course_level';
  static const String qyIeltsCourseRating = 'qy_ielts_course_rating';
  static const String qyIeltsCourseFeatures = 'qy_ielts_course_features';
  static const String qyIeltsCourseInstructor = 'qy_ielts_course_instructor';
  static const String qyIeltsCourseInstructorDesc =
      'qy_ielts_course_instructor_desc';
  static const String qyIeltsCourseOutline = 'qy_ielts_course_outline';
  static const String qyIeltsCourseContent = 'qy_ielts_course_content';
  static const String qyIeltsLessonListening = 'qy_ielts_lesson_listening';
  static const String qyIeltsLessonReading = 'qy_ielts_lesson_reading';
  static const String qyIeltsLessonWriting = 'qy_ielts_lesson_writing';
  static const String qyIeltsLessonSpeaking = 'qy_ielts_lesson_speaking';
  static const String qyIeltsLessonCompleted = 'qy_ielts_lesson_completed';
  static const String qyIeltsPracticeAndTest = 'qy_ielts_practice_and_test';
  static const String qyIeltsPracticeMockTest = 'qy_ielts_practice_mock_test';
  static const String qyIeltsPracticeMockTestDesc =
      'qy_ielts_practice_mock_test_desc';
  static const String qyIeltsPracticeMockTestDuration =
      'qy_ielts_practice_mock_test_duration';
  static const String qyIeltsPracticeSkill = 'qy_ielts_practice_skill';
  static const String qyIeltsPracticeSkillDesc = 'qy_ielts_practice_skill_desc';
  static const String qyIeltsPracticeSkillDuration =
      'qy_ielts_practice_skill_duration';
  static const String qyIeltsPracticePastPapers =
      'qy_ielts_practice_past_papers';
  static const String qyIeltsPracticePastPapersDesc =
      'qy_ielts_practice_past_papers_desc';
  static const String qyIeltsPracticePastPapersDuration =
      'qy_ielts_practice_past_papers_duration';
  static const String qyIeltsPracticeSpeaking = 'qy_ielts_practice_speaking';
  static const String qyIeltsPracticeSpeakingDesc =
      'qy_ielts_practice_speaking_desc';
  static const String qyIeltsPracticeSpeakingDuration =
      'qy_ielts_practice_speaking_duration';
  static const String qyIeltsLearningStats = 'qy_ielts_learning_stats';
  static const String qyIeltsStudyDays = 'qy_ielts_study_days';
  static const String qyIeltsCompletedLessons = 'qy_ielts_completed_lessons';
  static const String qyIeltsPracticeHours = 'qy_ielts_practice_hours';
  static const String qyIeltsAverageScore = 'qy_ielts_average_score';
  static const String qyIeltsProgressTrend = 'qy_ielts_progress_trend';
  static const String qyIeltsProgressChartPlaceholder =
      'qy_ielts_progress_chart_placeholder';
  static const String qyIeltsAchievements = 'qy_ielts_achievements';
  static const String qyIeltsAchievementStreak7 =
      'qy_ielts_achievement_streak_7';
  static const String qyIeltsAchievementFirstTest =
      'qy_ielts_achievement_first_test';
  static const String qyIeltsAchievementListeningBreakthrough =
      'qy_ielts_achievement_listening_breakthrough';
  static const String qyIeltsAchievementPerfectScore =
      'qy_ielts_achievement_perfect_score';

  // Python Course Detail
  static const String qyPythonModuleBasics = 'qy_python_module_basics';
  static const String qyPythonModuleBasicsDesc = 'qy_python_module_basics_desc';
  static const String qyPythonModuleOOP = 'qy_python_module_oop';
  static const String qyPythonModuleOOPDesc = 'qy_python_module_oop_desc';
  static const String qyPythonModuleWeb = 'qy_python_module_web';
  static const String qyPythonModuleWebDesc = 'qy_python_module_web_desc';
  static const String qyPythonModuleDataAnalysis =
      'qy_python_module_data_analysis';
  static const String qyPythonModuleDataAnalysisDesc =
      'qy_python_module_data_analysis_desc';
  static const String qyPythonModuleML = 'qy_python_module_ml';
  static const String qyPythonModuleMLDesc = 'qy_python_module_ml_desc';
  static const String qyPythonModuleProject = 'qy_python_module_project';
  static const String qyPythonModuleProjectDesc =
      'qy_python_module_project_desc';
  static const String qyPythonModuleDuration2Weeks =
      'qy_python_module_duration_2_weeks';
  static const String qyPythonModuleDuration2_5Weeks =
      'qy_python_module_duration_2_5_weeks';
  static const String qyPythonModuleDuration3Weeks =
      'qy_python_module_duration_3_weeks';
  static const String qyPythonModuleDuration3_5Weeks =
      'qy_python_module_duration_3_5_weeks';
  static const String qyPythonModuleDuration4Weeks =
      'qy_python_module_duration_4_weeks';
  static const String qyPythonProjects = 'qy_python_projects';
  static const String qyPythonProjectTodo = 'qy_python_project_todo';
  static const String qyPythonProjectTodoApp = 'qy_python_project_todo_app';
  static const String qyPythonProjectTodoAppDesc =
      'qy_python_project_todo_app_desc';
  static const String qyPythonProjectDashboard = 'qy_python_project_dashboard';
  static const String qyPythonProjectDataViz = 'qy_python_project_data_viz';
  static const String qyPythonProjectDataVizDesc =
      'qy_python_project_data_viz_desc';
  static const String qyPythonProjectScraper = 'qy_python_project_scraper';
  static const String qyPythonProjectWebScraper =
      'qy_python_project_web_scraper';
  static const String qyPythonProjectWebScraperDesc =
      'qy_python_project_web_scraper_desc';
  static const String qyPythonProjectScraperDesc =
      'qy_python_project_scraper_desc';
  static const String qyPythonProjectBlog = 'qy_python_project_blog';
  static const String qyPythonProjectBlogDesc = 'qy_python_project_blog_desc';
  static const String qyPythonProjectML = 'qy_python_project_ml';
  static const String qyPythonProjectMLPredict = 'qy_python_project_ml_predict';
  static const String qyPythonProjectMLPredictDesc =
      'qy_python_project_ml_predict_desc';
  static const String qyPythonProjectMLDesc = 'qy_python_project_ml_desc';
  static const String qyPythonDifficultyBeginner =
      'qy_python_difficulty_beginner';
  static const String qyPythonDifficultyIntermediate =
      'qy_python_difficulty_intermediate';
  static const String qyPythonDifficultyAdvanced =
      'qy_python_difficulty_advanced';
  static const String qyPythonStatusCompleted = 'qy_python_status_completed';
  static const String qyPythonStatusInProgress = 'qy_python_status_in_progress';
  static const String qyPythonStatusLocked = 'qy_python_status_locked';
  static const String qyPythonCodingStats = 'qy_python_coding_stats';
  static const String qyPythonCodingDays = 'qy_python_coding_days';
  static const String qyPythonCompletedProjects =
      'qy_python_completed_projects';
  static const String qyPythonLinesOfCode = 'qy_python_lines_of_code';
  static const String qyPythonPracticeHours = 'qy_python_practice_hours';
  static const String qyPythonCodingActivity = 'qy_python_coding_activity';
  static const String qyPythonCodingActivityChart =
      'qy_python_coding_activity_chart';
  static const String qyPythonSkillsProgress = 'qy_python_skills_progress';
  static const String qyPythonSkillBasics = 'qy_python_skill_basics';
  static const String qyPythonSkillOOP = 'qy_python_skill_oop';
  static const String qyPythonSkillWeb = 'qy_python_skill_web';
  static const String qyPythonSkillDataAnalysis =
      'qy_python_skill_data_analysis';
  static const String qyPythonSkillML = 'qy_python_skill_ml';

  // Route Navigation Example
  static const String qyRouteNavigationExample = 'qy_route_navigation_example';
  static const String qyRouteKeysManagement = 'qy_route_keys_management';
  static const String qyRouteKeysManagementDesc =
      'qy_route_keys_management_desc';
  static const String qyAppRoutes = 'qy_app_routes';
  static const String qyRouteHomeDesc = 'qy_route_home_desc';
  static const String qyRouteProfileDesc = 'qy_route_profile_desc';
  static const String qyRouteSettingsDesc = 'qy_route_settings_desc';
  static const String qyRouteDashboardDesc = 'qy_route_dashboard_desc';
  static const String qyRouteBenefitsTitle = 'qy_route_benefits_title';
  static const String qyRouteBenefitsContent = 'qy_route_benefits_content';
  static const String qyGo = 'qy_go';

  // Word Listening Audio Items
  static const String qyListeningWordResilientMeaning =
      'qy_listening_word_resilient_meaning';
  static const String qyListeningWordResilientExample =
      'qy_listening_word_resilient_example';
  static const String qyListeningWordParadigmMeaning =
      'qy_listening_word_paradigm_meaning';
  static const String qyListeningWordParadigmExample =
      'qy_listening_word_paradigm_example';
  static const String qyListeningWordEphemeralMeaning =
      'qy_listening_word_ephemeral_meaning';
  static const String qyListeningWordEphemeralExample =
      'qy_listening_word_ephemeral_example';
  static const String qyListeningWordUbiquitousMeaning =
      'qy_listening_word_ubiquitous_meaning';
  static const String qyListeningWordUbiquitousExample =
      'qy_listening_word_ubiquitous_example';
  static const String qyListeningWordMeticulousMeaning =
      'qy_listening_word_meticulous_meaning';
  static const String qyListeningWordMeticulousExample =
      'qy_listening_word_meticulous_example';
  static const String qyListeningWordSerendipityMeaning =
      'qy_listening_word_serendipity_meaning';
  static const String qyListeningWordSerendipityExample =
      'qy_listening_word_serendipity_example';
  static const String qyListeningWordSimpleMeaning =
      'qy_listening_word_simple_meaning';
  static const String qyListeningWordSimpleExample =
      'qy_listening_word_simple_example';
  static const String qyLessons = 'qy_lessons';
  static const String qyHelpful = 'qy_helpful';
  static const String qySearchCourses = 'qy_search_courses';
  static const String qyBusiness = 'qy_business';
  static const String qyTestPrep = 'qy_test_prep';
  static const String qyGeneral = 'qy_general';
  static const String qyAcademic = 'qy_academic';
  static const String qyRecentSearches = 'qy_recent_searches';
  static const String qyPopularSearches = 'qy_popular_searches';
  static const String qyDownloading = 'qy_downloading';
  static const String qySharing = 'qy_sharing';
  static const String qyCertificate = 'qy_certificate';
  static const String qyCertificateOfCompletion =
      'qy_certificate_of_completion';
  static const String qyThisCertifies = 'qy_this_certifies';
  static const String qyHasSuccessfullyCompleted =
      'qy_has_successfully_completed';
  static const String qyCompletionDate = 'qy_completion_date';
  static const String qyFinalScore = 'qy_final_score';
  static const String qyVerifiedCertificate = 'qy_verified_certificate';
  static const String qyCertificateId = 'qy_certificate_id';
  static const String qyIssued = 'qy_issued';
  static const String qyStatus = 'qy_status';
  static const String qyValid = 'qy_valid';
  static const String qyPrint = 'qy_print';
  static const String qyCourseLearningProgress = 'qy_course_learning_progress';
  static const String qyCourseCompletedLessons = 'qy_course_completed_lessons';
  static const String qyCourseConsecutiveDays = 'qy_course_consecutive_days';
  static const String qyCourseProjectsCompleted =
      'qy_course_projects_completed';
  static const String qyCourseLinesOfCode = 'qy_course_lines_of_code';
  static const String qyCourseInfo = 'qy_course_info';
  static const String qyCourseDuration = 'qy_course_duration';
  static const String qyCourseDuration12Weeks = 'qy_course_duration_12_weeks';
  static const String qyCourseDuration16Weeks = 'qy_course_duration_16_weeks';
  static const String qyCourseDuration3Weeks = 'qy_course_duration_3_weeks';
  static const String qyCourseDuration2_5Weeks = 'qy_course_duration_2_5_weeks';
  static const String qyCourseDuration4Weeks = 'qy_course_duration_4_weeks';
  static const String qyCourseDuration2Weeks = 'qy_course_duration_2_weeks';
  static const String qyCourseDuration3_5Weeks = 'qy_course_duration_3_5_weeks';
  static const String qyCourseCodePractice = 'qy_course_code_practice';
  static const String qyCourseDifficultyBeginner =
      'qy_course_difficulty_beginner';
  static const String qyCourseDifficultyIntermediate =
      'qy_course_difficulty_intermediate';
  static const String qyCourseDifficultyAdvanced =
      'qy_course_difficulty_advanced';
  static const String qyCourseDifficultyProgression =
      'qy_course_difficulty_progression';
  static const String qyCourseIeltsModuleListeningTitle =
      'qy_course_ielts_module_listening_title';
  static const String qyCourseIeltsModuleListeningSubtitle =
      'qy_course_ielts_module_listening_subtitle';
  static const String qyCourseIeltsModuleListeningDescription =
      'qy_course_ielts_module_listening_description';
  static const String qyCourseIeltsModuleReadingTitle =
      'qy_course_ielts_module_reading_title';
  static const String qyCourseIeltsModuleReadingSubtitle =
      'qy_course_ielts_module_reading_subtitle';
  static const String qyCourseIeltsModuleReadingDescription =
      'qy_course_ielts_module_reading_description';
  static const String qyCourseIeltsModuleWritingTitle =
      'qy_course_ielts_module_writing_title';
  static const String qyCourseIeltsModuleWritingSubtitle =
      'qy_course_ielts_module_writing_subtitle';
  static const String qyCourseIeltsModuleWritingDescription =
      'qy_course_ielts_module_writing_description';
  static const String qyCourseIeltsModuleSpeakingTitle =
      'qy_course_ielts_module_speaking_title';
  static const String qyCourseIeltsModuleSpeakingSubtitle =
      'qy_course_ielts_module_speaking_subtitle';
  static const String qyCourseIeltsModuleSpeakingDescription =
      'qy_course_ielts_module_speaking_description';
  static const String qyCoursePythonModuleBasicsTitle =
      'qy_course_python_module_basics_title';
  static const String qyCoursePythonModuleBasicsSubtitle =
      'qy_course_python_module_basics_subtitle';
  static const String qyCoursePythonModuleBasicsDescription =
      'qy_course_python_module_basics_description';
  static const String qyCoursePythonModuleOOPTitle =
      'qy_course_python_module_oop_title';
  static const String qyCoursePythonModuleOOPSubtitle =
      'qy_course_python_module_oop_subtitle';
  static const String qyCoursePythonModuleOOPDescription =
      'qy_course_python_module_oop_description';
  static const String qyCoursePythonModuleWebTitle =
      'qy_course_python_module_web_title';
  static const String qyCoursePythonModuleWebSubtitle =
      'qy_course_python_module_web_subtitle';
  static const String qyCoursePythonModuleWebDescription =
      'qy_course_python_module_web_description';
  static const String qyCoursePythonModuleDataTitle =
      'qy_course_python_module_data_title';
  static const String qyCoursePythonModuleDataSubtitle =
      'qy_course_python_module_data_subtitle';
  static const String qyCoursePythonModuleDataDescription =
      'qy_course_python_module_data_description';
  static const String qyCoursePythonModuleMLTitle =
      'qy_course_python_module_ml_title';
  static const String qyCoursePythonModuleMLSubtitle =
      'qy_course_python_module_ml_subtitle';
  static const String qyCoursePythonModuleMLDescription =
      'qy_course_python_module_ml_description';
  static const String qyCoursePythonModuleProjectsTitle =
      'qy_course_python_module_projects_title';
  static const String qyCoursePythonModuleProjectsSubtitle =
      'qy_course_python_module_projects_subtitle';
  static const String qyCoursePythonModuleProjectsDescription =
      'qy_course_python_module_projects_description';
  static const String qyCourseIeltsProjectMockTest1Title =
      'qy_course_ielts_project_mock_test_1_title';
  static const String qyCourseIeltsProjectMockTest1Subtitle =
      'qy_course_ielts_project_mock_test_1_subtitle';
  static const String qyCourseIeltsProjectMockTest1Description =
      'qy_course_ielts_project_mock_test_1_description';
  static const String qyCourseIeltsProjectSpeakingPracticeTitle =
      'qy_course_ielts_project_speaking_practice_title';
  static const String qyCourseIeltsProjectSpeakingPracticeSubtitle =
      'qy_course_ielts_project_speaking_practice_subtitle';
  static const String qyCourseIeltsProjectSpeakingPracticeDescription =
      'qy_course_ielts_project_speaking_practice_description';
  static const String qyPythonProjectTodoAppDescription =
      'qy_python_project_todo_app_description';
  static const String qyPythonProjectDataVizDescription =
      'qy_python_project_data_viz_description';
  static const String qyPythonProjectWebScraperDescription =
      'qy_python_project_web_scraper_description';
  static const String qyPythonProjectBlogDescription =
      'qy_python_project_blog_description';
  static const String qyPythonProjectMLPredictDescription =
      'qy_python_project_ml_predict_description';
  static const String qyCourseRating = 'qy_course_rating';
  static const String qyCourseFeatures = 'qy_course_features';
  static const String qyCourseInstructor = 'qy_course_instructor';
  static const String qyCourseLearningPath = 'qy_course_learning_path';
  static const String qyCourseCurriculum = 'qy_course_curriculum';
  static const String qyCourseWeek = 'qy_course_week';
  static const String qyCourseModule = 'qy_course_module';
  static const String qyCourseCompleted = 'qy_course_completed';
  static const String qyCourseInProgress = 'qy_course_in_progress';
  static const String qyCourseLocked = 'qy_course_locked';
  static const String qyCourseStart = 'qy_course_start';
  static const String qyCourseResume = 'qy_course_resume';

  // Common
  static const String qyCommonOk = 'qy_common_ok';
  static const String qyCommonGotIt = 'qy_common_got_it';

  // Home Page
  static const String qyHomeStudy = 'qy_home_study';
  static const String qyHomeCourse = 'qy_home_course';
  static const String qyHomeAi = 'qy_home_ai';
  static const String qyHomeDiscover = 'qy_home_discover';
  static const String qyHomeProfile = 'qy_home_profile';
  static const String qyHomeMoreFeatures = 'qy_home_more_features';
  static const String qyMoreFeatures = 'qy_more_features';
  static const String qyMoreFeaturesTools = 'qy_more_features_tools';
  static const String qyMoreFeaturesToolsDescription =
      'qy_more_features_tools_description';
  static const String qyComingSoon = 'qy_coming_soon';
  static const String qyHomeConsolidate = 'qy_home_consolidate';
  static const String qyHomeConsolidateDescription =
      'qy_home_consolidate_description';
  static const String qyHomeExtensionDescription =
      'qy_home_extension_description';
  static const String qyHomeWordTest = 'qy_home_word_test';
  static const String qyHomePortableListening = 'qy_home_portable_listening';
  static const String qyHomePhrase = 'qy_home_phrase';
  static const String qyHomeSpeedReview = 'qy_home_speed_review';
  static const String qyHomeExtension = 'qy_home_extension';
  static const String qyHomeReading = 'qy_home_reading';
  static const String qyHomeListeningSpeaking = 'qy_home_listening_speaking';
  static const String qyHomeLearnSettings = 'qy_home_learn_settings';
  static const String qyHomeLearnData = 'qy_home_learn_data';
  static const String qyHomeWatchImpact = 'qy_home_watch_impact';
  static const String qyHomeLearned = 'qy_home_learned';
  static const String qyHomeWordsTotal = 'qy_home_words_total';
  static const String qyHomeNewWords = 'qy_home_new_words';
  static const String qyHomeReviewWords = 'qy_home_review_words';
  static const String qyHomeStartLearning = 'qy_home_start_learning';
  static const String qyHomeCheckInDays = 'qy_home_check_in_days';
  static const String qyHomeBadges = 'qy_home_badges';

  // Login Page
  static const String qyLoginSlogan1 = 'qy_login_slogan_1';
  static const String qyLoginSlogan2 = 'qy_login_slogan_2';
  static const String qyLoginPhoneNumber = 'qy_login_phone_number';
  static const String qyLoginByPhone = 'qy_login_by_phone';
  static const String qyLoginByWechat = 'qy_login_by_wechat';
  static const String qyLoginByAccount = 'qy_login_by_account';
  static const String qyLoginByWeibo = 'qy_login_by_weibo';
  static const String qyLoginRememberWords = 'qy_login_remember_words';
  static const String qyLoginRecordChange = 'qy_login_record_change';
  static const String qyPleaseEnterPhone = 'qy_please_enter_phone';
  static const String qyPleaseAgreeTerms = 'qy_please_agree_terms';
  static const String qyPleaseCompleteForm = 'qy_please_complete_form';
  static const String qyEnterPhone = 'qy_enter_phone';
  static const String qyEnterCode = 'qy_enter_code';
  static const String qySendCode = 'qy_send_code';
  static const String qyAgreeToTermsPrefix = 'qy_agree_to_terms_prefix';
  static const String qyVerificationCode = 'qy_verification_code';
  static const String qyLoginToContinue = 'qy_login_to_continue';
  static const String qyLoginWithUsername = 'qy_login_with_username';
  static const String qyLoginWithPhone = 'qy_login_with_phone';
  static const String qyAgreeToTermsAndPrivacy =
      'qy_agree_to_terms_and_privacy';
  static const String qyPleaseAgreeToTerms = 'qy_please_agree_to_terms';
  static const String qyPleaseEnterPhoneAndCode =
      'qy_please_enter_phone_and_code';
  static const String qyPleaseEnterUsernameAndPassword =
      'qy_please_enter_username_and_password';
  static const String qyFailedToSendCode = 'qy_failed_to_send_code';
  static const String qyUserAgreement = 'qy_user_agreement';
  static const String qyAnd = 'qy_and';
  static const String qyAgreementPrefix = 'qy_agreement_prefix';
  static const String qyWechatLogin = 'qy_wechat_login';
  static const String qyPhoneLogin = 'qy_phone_login';
  static const String qyGetCode = 'qy_get_code';
  static const String qyOtherLoginMethods = 'qy_other_login_methods';
  static const String qyWechat = 'qy_wechat';
  static const String qyQyAccount = 'qy_qy_account';
  static const String qyWeibo = 'qy_weibo';

  // Common
  static const String qyGuest = 'qy_guest';
  static const String qySearching = 'qy_searching';
  static const String qyCourse = 'qy_course';
  static const String qyViewAll = 'qy_view_all';

  // Course Categories
  static const String qyCourseCategoryFeatured = 'qy_course_category_featured';
  static const String qyCourseCategoryIelts = 'qy_course_category_ielts';
  static const String qyCourseCategoryGaokao = 'qy_course_category_gaokao';
  static const String qyCourseCategoryMiddle = 'qy_course_category_middle';

  // Course Details
  static const String qyTodayFeatured = 'qy_today_featured';
  static const String qyUpdatedDaily = 'qy_updated_daily';
  static const String qyCourseListening = 'qy_course_listening';
  static const String qyCourseLevelIntermediate =
      'qy_course_level_intermediate';
  static const String qyCourseFood = 'qy_course_food';
  static const String qyCourseReading = 'qy_course_reading';
  static const String qyCourseLevelBeginner = 'qy_course_level_beginner';
  static const String qyRecommendedCourses = 'qy_recommended_courses';
  static const String qyExclusivePlans = 'qy_exclusive_plans';
  static const String qyStartLearning = 'qy_start_learning';
  static const String qyContinueLearning = 'qy_continue_learning';
  static const String qyPlanName = 'qy_plan_name';
  static const String qyPlanDescription = 'qy_plan_description';
  static const String qyLessonCompleted = 'qy_lesson_completed';
  static const String qyTotalLessons = 'qy_total_lessons';
  static const String qyFreeLesson = 'qy_free_lesson';
  static const String qyPremiumLesson = 'qy_premium_lesson';

  // Help Center
  static const String qyBrowseTopics = 'qy_browse_topics';
  static const String qyFrequentlyAsked = 'qy_frequently_asked';
  static const String qySearchHelp = 'qy_search_help';
  static const String qyLiveChat = 'qy_live_chat';
  static const String qyEmailUs = 'qy_email_us';

  // Image View
  static const String qyImageView = 'qy_image_view';
  static const String qyImageViewDesc = 'qy_image_view_desc';

  // Course Plans & VIP
  static const String qyViewPlans = 'qy_view_plans';
  static const String qyVipPromotionTitle = 'qy_vip_promotion_title';
  static const String qyVipYearCard = 'qy_vip_year_card';
  static const String qyVipBenefits = 'qy_vip_benefits';
  static const String qyActivateNow = 'qy_activate_now';
  static const String qyLearningPlans = 'qy_learning_plans';
  static const String qyNoPlansYet = 'qy_no_plans_yet';
  static const String qyCreateFirstPlan = 'qy_create_first_plan';
  static const String qySelectGoal = 'qy_select_goal';
  static const String qySelectTime = 'qy_select_time';
  static const String qySelectCourse = 'qy_select_course';
  static const String qyDiscoverPerfectPlan = 'qy_discover_perfect_plan';
  static const String qyNoPlans = 'qy_no_plans';
  static const String qyAllPlans = 'qy_all_plans';
  static const String qyJoined = 'qy_joined';
  static const String qyJoinPlan = 'qy_join_plan';

  // Word Learning & Search
  static const String qyGeneralSearch = 'qy_general_search';
  static const String qyBookSearch = 'qy_book_search';
  static const String qyTotal = 'qy_total';
  static const String qyLearned = 'qy_learned';
  static const String qyStarting = 'qy_starting';
  static const String qyWordNewWordBook = 'qy_word_new_word_book';
  static const String qyWordProgress = 'qy_word_progress';
  static const String qyWordPaused = 'qy_word_paused';
  static const String qyWordResume = 'qy_word_resume';
  static const String qyWordPause = 'qy_word_pause';
  static const String qyWordCompleted = 'qy_word_completed';
  static const String qyWordUnlocked = 'qy_word_unlocked';
  static const String qyWordLocked = 'qy_word_locked';
  static const String qyWordBookDesc = 'qy_word_book_desc';
  static const String qyWordBookWordResilientMeaning =
      'qy_word_book_word_resilient_meaning';
  static const String qyWordBookWordResilientExample =
      'qy_word_book_word_resilient_example';
  static const String qyWordBookWordParadigmMeaning =
      'qy_word_book_word_paradigm_meaning';
  static const String qyWordBookWordParadigmExample =
      'qy_word_book_word_paradigm_example';
  static const String qyWordBookWordEphemeralMeaning =
      'qy_word_book_word_ephemeral_meaning';
  static const String qyWordBookWordEphemeralExample =
      'qy_word_book_word_ephemeral_example';
  static const String qyWordBookWordUbiquitousMeaning =
      'qy_word_book_word_ubiquitous_meaning';
  static const String qyWordBookWordUbiquitousExample =
      'qy_word_book_word_ubiquitous_example';
  static const String qyWordBookWordMeticulousMeaning =
      'qy_word_book_word_meticulous_meaning';
  static const String qyWordBookWordMeticulousExample =
      'qy_word_book_word_meticulous_example';
  static const String qyWordBookWordSerendipityMeaning =
      'qy_word_book_word_serendipity_meaning';
  static const String qyWordBookWordSerendipityExample =
      'qy_word_book_word_serendipity_example';
  static const String qyWordVocabulary = 'qy_word_vocabulary';

  // Course Plan Data
  static const String qyCoursePlan7DayReadingTitle =
      'qy_course_plan_7day_reading_title';
  static const String qyCoursePlan7DayReadingSubtitle =
      'qy_course_plan_7day_reading_subtitle';
  static const String qyCoursePlan7DayReadingDesc =
      'qy_course_plan_7day_reading_desc';
  static const String qyCoursePlan7DaySpeakingTitle =
      'qy_course_plan_7day_speaking_title';
  static const String qyCoursePlan7DaySpeakingSubtitle =
      'qy_course_plan_7day_speaking_subtitle';
  static const String qyCoursePlan7DaySpeakingDesc =
      'qy_course_plan_7day_speaking_desc';

  // Word Book Data
  static const String qyWordBookCoca20000 = 'qy_word_book_coca_20000';
  static const String qyWordBookCoca20000Desc = 'qy_word_book_coca_20000_desc';
  static const String qyWordBookIelts = 'qy_word_book_ielts';
  static const String qyWordBookIeltsDesc = 'qy_word_book_ielts_desc';
  static const String qyWordBookCet46 = 'qy_word_book_cet_46';
  static const String qyWordBookCet46Desc = 'qy_word_book_cet_46_desc';
  static const String qyWordBookDefault = 'qy_word_book_default';

  // More Features
  static const String qyLearningTools = 'qy_learning_tools';
  static const String qyVocabularyTest = 'qy_vocabulary_test';
  static const String qyVocabularyTestDesc = 'qy_vocabulary_test_desc';
  static const String qyPronunciationPractice = 'qy_pronunciation_practice';
  static const String qyPronunciationPracticeDesc =
      'qy_pronunciation_practice_desc';
  static const String qyGrammarPractice = 'qy_grammar_practice';
  static const String qyGrammarPracticeDesc = 'qy_grammar_practice_desc';
  static const String qyWritingAssistant = 'qy_writing_assistant';
  static const String qyWritingAssistantDesc = 'qy_writing_assistant_desc';
  static const String qyPersonalizedFeatures = 'qy_personalized_features';
  static const String qyStudyPlan = 'qy_study_plan';
  static const String qyStudyPlanDesc = 'qy_study_plan_desc';
  static const String qyLearningReport = 'qy_learning_report';
  static const String qyLearningReportDesc = 'qy_learning_report_desc';
  static const String qyGoalSetting = 'qy_goal_setting';
  static const String qyGoalSettingDesc = 'qy_goal_setting_desc';
  static const String qyLearningCommunity = 'qy_learning_community';
  static const String qyLearningCommunityDesc = 'qy_learning_community_desc';
  static const String qyEntertainmentFeatures = 'qy_entertainment_features';
  static const String qyWordGames = 'qy_word_games';
  static const String qyWordGamesDesc = 'qy_word_games_desc';
  static const String qyChallenge = 'qy_challenge';
  static const String qyChallengeDesc = 'qy_challenge_desc';
  static const String qyAchievementsSystem = 'qy_achievements_system';
  static const String qyAchievementsSystemDesc = 'qy_achievements_system_desc';
  static const String qyLeaderboard = 'qy_leaderboard';
  static const String qyLeaderboardDesc = 'qy_leaderboard_desc';
  static const String qyRankings = 'qy_rankings';
  static const String qyWeek = 'qy_week';
  static const String qyMonth = 'qy_month';
  static const String qyAllTime = 'qy_all_time';
  static const String qyYourRank = 'qy_your_rank';
  static const String qyCurrentStreak = 'qy_current_streak';
  static const String qyKeepItUp = 'qy_keep_it_up';
  static const String qyLongestStreak = 'qy_longest_streak';
  static const String qyActivityCalendar = 'qy_activity_calendar';
  static const String qyStudied = 'qy_studied';
  static const String qyNoActivity = 'qy_no_activity';
  static const String qyStreakTips = 'qy_streak_tips';
  static const String qyTip1 = 'qy_tip1';
  static const String qyTip2 = 'qy_tip2';
  static const String qyTip3 = 'qy_tip3';
  static const String qyProfessionalTools = 'qy_professional_tools';
  static const String qyDictionaryQuery = 'qy_dictionary_query';
  static const String qyDictionaryQueryDesc = 'qy_dictionary_query_desc';
  static const String qyTranslationTool = 'qy_translation_tool';
  static const String qyTranslationToolDesc = 'qy_translation_tool_desc';
  static const String qyGrammarChecker = 'qy_grammar_checker';
  static const String qyGrammarCheckerDesc = 'qy_grammar_checker_desc';
  static const String qyVoiceAssistant = 'qy_voice_assistant';
  static const String qyVoiceAssistantDesc = 'qy_voice_assistant_desc';
  static const String qyMoreFeaturesSubtitle = 'qy_more_features_subtitle';
  static const String qyOpeningFeature = 'qy_opening_feature';
  static const String qyFeatureNotAvailable = 'qy_feature_not_available';
  static const String qyClickToSearchFeatures = 'qy_click_to_search_features';
  
  // AI Study Features
  static const String qyAiWordExplanation = 'qy_ai_word_explanation';
  static const String qyAiWordExplanationDesc = 'qy_ai_word_explanation_desc';
  static const String qyAiSmartRecommendations = 'qy_ai_smart_recommendations';
  static const String qyAiSmartRecommendationsDesc = 'qy_ai_smart_recommendations_desc';
  static const String qyAiLearningAnalytics = 'qy_ai_learning_analytics';
  static const String qyAiLearningAnalyticsDesc = 'qy_ai_learning_analytics_desc';
  static const String qyAiTutor = 'qy_ai_tutor';
  static const String qyAiTutorDesc = 'qy_ai_tutor_desc';
  static const String qyAiSmartQuiz = 'qy_ai_smart_quiz';
  static const String qyAiSmartQuizDesc = 'qy_ai_smart_quiz_desc';
  static const String qyAiStudyPlan = 'qy_ai_study_plan';
  static const String qyAiStudyPlanDesc = 'qy_ai_study_plan_desc';
  static const String qyAiLearningAssistant = 'qy_ai_learning_assistant';
  static const String qyAiLearningAssistantDesc = 'qy_ai_learning_assistant_desc';
  static const String qyAiPoweredFeatures = 'qy_ai_powered_features';
  static const String qyAiPoweredFeaturesDesc = 'qy_ai_powered_features_desc';
  static const String qyAiProTip = 'qy_ai_pro_tip';
  static const String qyAiProTipDesc = 'qy_ai_pro_tip_desc';
  static const String qyAiBadgeNew = 'qy_ai_badge_new';
  static const String qyAiBadgeBeta = 'qy_ai_badge_beta';
  static const String qyAiUsers = 'qy_ai_users';
  static const String qyAiAccuracy = 'qy_ai_accuracy';
  static const String qyAiAvailable = 'qy_ai_available';
  static const String qyCheckinChallenge = 'qy_checkin_challenge';
  static const String qyCheckinChallengeDesc = 'qy_checkin_challenge_desc';
  static const String qyCheckinStreak = 'qy_checkin_streak';
  static const String qyCheckinConsecutiveDays = 'qy_checkin_consecutive_days';
  static const String qyCheckinFlowers = 'qy_checkin_flowers';
  static const String qyCheckinVouchers = 'qy_checkin_vouchers';
  static const String qyCheckinFindPartner = 'qy_checkin_find_partner';
  static const String qyCheckinNewChallengeStarted = 'qy_checkin_new_challenge_started';
  static const String qyCheckinCollectBadges = 'qy_checkin_collect_badges';
  static const String qyCheckinDailyCheckin = 'qy_checkin_daily_checkin';
  static const String qyCheckinClickToCheckin = 'qy_checkin_click_to_checkin';
  static const String qyCheckinCheckedIn = 'qy_checkin_checked_in';
  static const String qyCheckinDay = 'qy_checkin_day';
  static const String qyCheckinFlowersX = 'qy_checkin_flowers_x';
  static const String qyCheckinShareCheckinImage = 'qy_checkin_share_checkin_image';
  static const String qyCheckinShareGinsengSoup = 'qy_checkin_share_ginseng_soup';
  static const String qyCheckinShareGinsengSoupDesc = 'qy_checkin_share_ginseng_soup_desc';
  static const String qyCheckinShareTravelBear = 'qy_checkin_share_travel_bear';
  static const String qyCheckinShareTravelBearDesc = 'qy_checkin_share_travel_bear_desc';
  static const String qyCheckinGoShare = 'qy_checkin_go_share';
  static const String qyCheckinGoToLottery = 'qy_checkin_go_to_lottery';
  static const String qyCheckinUseVouchers = 'qy_checkin_use_vouchers';
  static const String qyCheckinLotteryNow = 'qy_checkin_lottery_now';
  static const String qyCheckinLotterySystem = 'qy_checkin_lottery_system';
  static const String qyCheckinCurrentVouchers = 'qy_checkin_current_vouchers';
  static const String qyCheckinVoucherConversion = 'qy_checkin_voucher_conversion';
  static const String qyCheckinVoucherRequired = 'qy_checkin_voucher_required';
  static const String qyCheckinCheckinSuccess = 'qy_checkin_checkin_success';
  static const String qyCheckinGotFlowers = 'qy_checkin_got_flowers';
  static const String qyCheckinShareImage = 'qy_checkin_share_image';
  static const String qyCheckinShareFeatureInDev = 'qy_checkin_share_feature_in_dev';
  static const String qyCheckinFlowerToVoucher = 'qy_checkin_flower_to_voucher';
  static const String qyRewards = 'qy_rewards';
  static const String qyRewardsDesc = 'qy_rewards_desc';
  static const String qyTopics = 'qy_topics';
  static const String qyTopicsDesc = 'qy_topics_desc';
  static const String qyDiscoverLearning = 'qy_discover_learning';
  static const String qyConnectMillionsLearners = 'qy_connect_millions_learners';
  static const String qyExploreCommunityFeatures = 'qy_explore_community_features';

  // Word Listening AI Explain
  static const String qyListeningAIExplainTitle =
      'qy_listening_ai_explain_title';
  static const String qyListeningAIAnalyzing = 'qy_listening_ai_analyzing';
  static const String qyListeningAIAnalysis = 'qy_listening_ai_analysis';
  static const String qyListeningEtymology = 'qy_listening_etymology';
  static const String qyListeningSynonyms = 'qy_listening_synonyms';
  static const String qyListeningAntonyms = 'qy_listening_antonyms';
  static const String qyListeningCollocations = 'qy_listening_collocations';
  static const String qyListeningStartPractice = 'qy_listening_start_practice';
  static const String qyListeningBackToStudy = 'qy_listening_back_to_study';
  static const String qyListeningShareInDev = 'qy_listening_share_in_dev';
  static const String qyListeningPracticeInDev = 'qy_listening_practice_in_dev';

  // Weekdays
  static const String qySunday = 'qy_sunday';
  static const String qyMonday = 'qy_monday';
  static const String qyTuesday = 'qy_tuesday';
  static const String qyWednesday = 'qy_wednesday';
  static const String qyThursday = 'qy_thursday';
  static const String qyFriday = 'qy_friday';
  static const String qySaturday = 'qy_saturday';
  static const String qyWordTask = 'qy_word_task';

  // Inbox Dashboard
  static const String qyInboxUserDating = 'qy_inbox_user_dating';
  static const String qyInboxUserArrell = 'qy_inbox_user_arrell';
  static const String qyInboxUserJene = 'qy_inbox_user_jene';
  static const String qyInboxUserEleanor = 'qy_inbox_user_eleanor';
  static const String qyInboxMessageDonation = 'qy_inbox_message_donation';
  static const String qyInboxMessageDatingApp = 'qy_inbox_message_dating_app';

  // Dictionary Recommendation
  static const String qyDictionaryCategoryAcademic =
      'qy_dictionary_category_academic';
  static const String qyDictionaryCategoryGeneral =
      'qy_dictionary_category_general';
  static const String qyDictionaryCategoryBusiness =
      'qy_dictionary_category_business';
  static const String qyDictionaryCategoryMedical =
      'qy_dictionary_category_medical';
  static const String qyDictionaryCategoryTechnical =
      'qy_dictionary_category_technical';
  static const String qyDictionaryDifficultyBeginner =
      'qy_dictionary_difficulty_beginner';
  static const String qyDictionaryDifficultyIntermediate =
      'qy_dictionary_difficulty_intermediate';
  static const String qyDictionaryDifficultyAdvanced =
      'qy_dictionary_difficulty_advanced';
  static const String qyDictionaryRemove = 'qy_dictionary_remove';
  static const String qyDictionaryAddToLibrary = 'qy_dictionary_add_to_library';
  static const String qyDictionaryWords = 'qy_dictionary_words';
  static const String qyDictionaryLikes = 'qy_dictionary_likes';
  static const String qyDictionaryDifficulty = 'qy_dictionary_difficulty';
  static const String qyDictionaryDetails = 'qy_dictionary_details';
  static const String qyDictionaryAdded = 'qy_dictionary_added';
  static const String qyDictionaryTagVocabulary =
      'qy_dictionary_tag_vocabulary';
  static const String qyDictionaryTagAdvanced = 'qy_dictionary_tag_advanced';
  static const String qyDictionaryTagAcademic = 'qy_dictionary_tag_academic';
  static const String qyDictionaryTagGeneral = 'qy_dictionary_tag_general';
  static const String qyDictionaryTagBeginner = 'qy_dictionary_tag_beginner';
  static const String qyDictionaryTagModern = 'qy_dictionary_tag_modern';
  static const String qyDictionaryTagIntermediate =
      'qy_dictionary_tag_intermediate';
  static const String qyInboxMessageAmazing = 'qy_inbox_message_amazing';
  static const String qyInboxTime0910 = 'qy_inbox_time_0910';
  static const String qyInboxTime2025 = 'qy_inbox_time_2025';
  static const String qyInboxTime830 = 'qy_inbox_time_830';
  static const String qyInboxTime0555 = 'qy_inbox_time_0555';

  // Language Codes
  static const String qyLanguageCodeZh = 'zh';
  static const String qyLanguageCodeEn = 'en';

  // App Information
  static const String qyAppIcpLicense = 'qy_app_icp_license';
  static const String qyAppAboutDescription = 'qy_app_about_description';
}
