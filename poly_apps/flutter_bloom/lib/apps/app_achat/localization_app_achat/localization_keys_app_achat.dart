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

/// Localization keys for AChat App
/// All keys must have 'achat_' prefix to avoid conflicts with other apps
class AChatLocalizationKeys {
  // App Basic
  static const String appName = 'achat_app_name';
  static const String appDescription = 'achat_app_description';
  static const String title = 'achat_title';
  
  // Home Screen
  static const String homeTitle = 'achat_home_title';
  static const String welcomeTitle = 'achat_welcome_title';
  static const String welcomeDescription = 'achat_welcome_description';
  static const String quickActions = 'achat_quick_actions';
  static const String startChat = 'achat_start_chat';
  
  // Advertisement Popup
  static const String advertisementTitle = 'achat_advertisement_title';
  static const String advertisementSubtitle = 'achat_advertisement_subtitle';
  static const String advertisementDescription = 'achat_advertisement_description';
  static const String advertisementButton = 'achat_advertisement_button';
  static const String advertisementImagePlaceholder = 'achat_advertisement_image_placeholder';
  static const String advertisementClickToClose = 'achat_advertisement_click_to_close';
  
  // Advertisement Announcements
  static const String advertisementAnnouncementsTitle = 'achat_advertisement_announcements_title';
  static const String advertisementAnnouncement1Title = 'achat_advertisement_announcement_1_title';
  static const String advertisementAnnouncement1Content = 'achat_advertisement_announcement_1_content';
  static const String advertisementAnnouncement2Title = 'achat_advertisement_announcement_2_title';
  static const String advertisementAnnouncement2Content = 'achat_advertisement_announcement_2_content';
  static const String advertisementAnnouncement3Title = 'achat_advertisement_announcement_3_title';
  static const String advertisementAnnouncement3Content = 'achat_advertisement_announcement_3_content';
  
  // Common Actions
  static const String home = 'achat_home';
  static const String next = 'achat_next';
  static const String cancel = 'achat_cancel';
  static const String save = 'achat_save';
  static const String delete = 'achat_delete';
  static const String edit = 'achat_edit';
  static const String back = 'achat_back';
  static const String confirm = 'achat_confirm';
  static const String search = 'achat_search';
  static const String searchHint = 'achat_search_hint';
  static const String clear = 'achat_clear';
  static const String share = 'achat_share';
  static const String done = 'achat_done';
  
  // Tab Bar
  static const String tabChat = 'achat_tab_chat';
  static const String tabContacts = 'achat_tab_contacts';
  static const String tabDiscover = 'achat_tab_discover';
  static const String tabMe = 'achat_tab_me';
  
  // Chat Home & Manage Mode
  static const String chatHomeTitle = 'achat_chat_home_title';
  static const String chatHomeSearchHint = 'achat_chat_home_search_hint';
  static const String manageModeMarkRead = 'achat_manage_mode_mark_read';
  static const String manageModeDelete = 'achat_manage_mode_delete';
  static const String manageModeDone = 'achat_manage_mode_done';
  
  // Chat Menu
  static const String menuStartChat = 'achat_menu_start_chat';
  static const String menuNewGroup = 'achat_menu_new_group';
  static const String menuAddFriend = 'achat_menu_add_friend';
  static const String menuScan = 'achat_menu_scan';
  
  // Chat Details
  static const String detailsInputHint = 'achat_details_input_hint';
  static const String detailsSend = 'achat_details_send';
  static const String detailsVoice = 'achat_details_voice';
  static const String detailsMore = 'achat_details_more';
  
  // Chat List
  static const String chatListTitle = 'achat_chat_list_title';
  static const String chatListSearchHint = 'achat_chat_list_search_hint';
  static const String chatListAnnouncement = 'achat_chat_list_announcement';
  
  // Chat List Alt

  
  // Add Contacts
  static const String addContactsTitle = 'achat_add_contacts_title';
  static const String addContactsSearchHint = 'achat_add_contacts_search_hint';
  static const String addContactsEnterpriseCode = 'achat_add_contacts_enterprise_code';
  static const String addContactsEnterpriseCodeDesc = 'achat_add_contacts_enterprise_code_desc';
  static const String addContactsScan = 'achat_add_contacts_scan';
  static const String addContactsScanDesc = 'achat_add_contacts_scan_desc';
  static const String addContactsInvite = 'achat_add_contacts_invite';
  static const String addContactsInviteDesc = 'achat_add_contacts_invite_desc';

  // Contacts
  static const String contactsAddContact = 'achat_contacts_add_contact';
  static const String contactsSearchHint = 'achat_contacts_search_hint';
  static const String contactsEmpty = 'achat_contacts_empty';
  static const String contactsNoSearchResults = 'achat_contacts_no_search_results';
  static const String contactsAddFirst = 'achat_contacts_add_first';
  
  // Create Group
  static const String createGroupTitle = 'achat_create_group_title';
  static const String createGroupNext = 'achat_create_group_next';
  static const String createGroupCancel = 'achat_create_group_cancel';
  static const String createGroupSearchHint = 'achat_create_group_search_hint';
  static const String createGroupSelectTip = 'achat_create_group_select_tip';
  
  // New Chat
  static const String newChatTitle = 'achat_new_chat_title';
  static const String newChatCancel = 'achat_new_chat_cancel';
  static const String newChatSearchHint = 'achat_new_chat_search_hint';
  static const String newChatLastOnline = 'achat_new_chat_last_online';
  
  // App Lock
  static const String appLockTitle = 'achat_app_lock_title';
  static const String appLockLockCode = 'achat_app_lock_lock_code';
  static const String appLockChangeLockCode = 'achat_app_lock_change_lock_code';
  static const String appLockDescription = 'achat_app_lock_description';
  
  // Profile
  static const String profileName = 'achat_profile_name';
  static const String profileId = 'achat_profile_id';
  static const String profileCompleteTip = 'achat_profile_complete_tip';
  static const String profilePrivacy = 'achat_profile_privacy';
  static const String profileNotification = 'achat_profile_notification';
  static const String profileLanguage = 'achat_profile_language';
  static const String profileVersion = 'achat_profile_version';
  
  // QR Profile
  static const String qrProfileName = 'achat_qr_profile_name';
  static const String qrProfileTitle = 'achat_qr_profile_title';
  static const String qrProfileVerified = 'achat_qr_profile_verified';
  static const String qrProfileQrTitle = 'achat_qr_profile_qr_title';
  static const String qrProfileQrTip = 'achat_qr_profile_qr_tip';
  static const String qrProfileSave = 'achat_qr_profile_save';
  static const String qrProfileShare = 'achat_qr_profile_share';
  static const String qrProfileQrPlaceholder = 'achat_qr_profile_qr_placeholder';
  
  // Notification Settings
  static const String notificationTitle = 'achat_notification_title';
  static const String notificationSectionGeneral = 'achat_notification_section_general';
  static const String notificationSectionGroup = 'achat_notification_section_group';
  static const String notificationSectionChannel = 'achat_notification_section_channel';
  static const String notificationSectionApp = 'achat_notification_section_app';
  static const String notificationSectionSetting = 'achat_notification_section_setting';
  static const String notificationSectionUnread = 'achat_notification_section_unread';
  static const String notificationSectionWorktime = 'achat_notification_section_worktime';
  static const String notificationSectionOther = 'achat_notification_section_other';
  static const String notificationShow = 'achat_notification_show';
  static const String notificationShowDesc = 'achat_notification_show_desc';
  static const String notificationPreview = 'achat_notification_preview';
  static const String notificationPreviewDesc = 'achat_notification_preview_desc';
  static const String notificationBanner = 'achat_notification_banner';
  static const String notificationBannerDesc = 'achat_notification_banner_desc';
  static const String notificationSound = 'achat_notification_sound';
  static const String notificationSoundValue = 'achat_notification_sound_value';
  static const String notificationGroupImportant = 'achat_notification_group_important';
  static const String notificationGroupImportantDesc = 'achat_notification_group_important_desc';
  static const String notificationGroupAtme = 'achat_notification_group_atme';
  static const String notificationGroupAtmeDesc = 'achat_notification_group_atme_desc';
  static const String notificationChannelProject = 'achat_notification_channel_project';
  static const String notificationChannelProjectDesc = 'achat_notification_channel_project_desc';
  static const String notificationChannelTask = 'achat_notification_channel_task';
  static const String notificationChannelTaskDesc = 'achat_notification_channel_task_desc';
  static const String notificationAppSound = 'achat_notification_app_sound';
  static const String notificationAppSoundDesc = 'achat_notification_app_sound_desc';
  static const String notificationAppPreview = 'achat_notification_app_preview';
  static const String notificationAppPreviewDesc = 'achat_notification_app_preview_desc';
  static const String notificationUnreadIncludeClosed = 'achat_notification_unread_include_closed';
  static const String notificationUnreadIncludeClosedDesc = 'achat_notification_unread_include_closed_desc';
  static const String notificationUnreadByMessage = 'achat_notification_unread_by_message';
  static const String notificationUnreadByMessageDesc = 'achat_notification_unread_by_message_desc';
  static const String notificationWorktimeNotify = 'achat_notification_worktime_notify';
  static const String notificationWorktimeNotifyDesc = 'achat_notification_worktime_notify_desc';
  static const String notificationWorktimeRange = 'achat_notification_worktime_range';
  static const String notificationOtherNewContact = 'achat_notification_other_new_contact';
  static const String notificationOtherNewContactDesc = 'achat_notification_other_new_contact_desc';

  // Discover
  static const String discoverPopular = 'achat_discover_popular';
  static const String discoverPopularSubtitle = 'achat_discover_popular_subtitle';
  static const String discoverMomentsComingSoon = 'achat_discover_moments_coming_soon';
  static const String discoverChannelsComingSoon = 'achat_discover_channels_coming_soon';
  static const String discoverGamesComingSoon = 'achat_discover_games_coming_soon';
  static const String discoverMiniProgramsComingSoon = 'achat_discover_mini_programs_coming_soon';
  static const String discoverMoreComing = 'achat_discover_more_coming';
  static const String discoverStayTuned = 'achat_discover_stay_tuned';
  static const String notificationOtherPriority = 'achat_notification_other_priority';
  static const String notificationOtherPriorityDesc = 'achat_notification_other_priority_desc';
  static const String notificationFooter = 'achat_notification_footer';
  
  // Privacy & Security Settings
  static const String privacyTitle = 'achat_privacy_title';
  static const String privacySectionAccount = 'achat_privacy_section_account';
  static const String privacyAccountProtect = 'achat_privacy_account_protect';
  static const String privacyAccountProtectDesc = 'achat_privacy_account_protect_desc';
  static const String privacySectionMessage = 'achat_privacy_section_message';
  static const String privacyMessageEncrypt = 'achat_privacy_message_encrypt';
  static const String privacyMessageEncryptDesc = 'achat_privacy_message_encrypt_desc';
  static const String privacySectionAddMethod = 'achat_privacy_section_add_method';
  static const String privacyAllowAddByPhone = 'achat_privacy_allow_add_by_phone';
  static const String privacyAllowAddByPhoneDesc = 'achat_privacy_allow_add_by_phone_desc';
  static const String privacyAllowAddById = 'achat_privacy_allow_add_by_id';
  static const String privacyAllowAddByIdDesc = 'achat_privacy_allow_add_by_id_desc';
  static const String privacySectionManage = 'achat_privacy_section_manage';
  static const String privacyBlacklist = 'achat_privacy_blacklist';
  static const String privacyPrivacyPolicy = 'achat_privacy_privacy_policy';
  static const String privacySecurityTips = 'achat_privacy_security_tips';
  static const String privacySectionSecurity = 'achat_privacy_section_security';
  static const String privacyBlockedUsers = 'achat_privacy_blocked_users';
  static const String privacyLockCode = 'achat_privacy_lock_code';
  static const String privacySecurityTip = 'achat_privacy_security_tip';
  static const String privacySectionPrivacy = 'achat_privacy_section_privacy';
  static const String privacyPhone = 'achat_privacy_phone';
  static const String privacyOnlineStatus = 'achat_privacy_online_status';
  static const String privacyInviteControl = 'achat_privacy_invite_control';
  static const String privacyPrivacyTip = 'achat_privacy_privacy_tip';
  static const String privacySectionAdvanced = 'achat_privacy_section_advanced';
  static const String privacyDeleteAccount = 'achat_privacy_delete_account';
  static const String privacyDataUsage = 'achat_privacy_data_usage';
  static const String privacyEnabled = 'achat_privacy_enabled';
  static const String privacyDisabled = 'achat_privacy_disabled';
  
  // Proxy Settings
  static const String proxyTitle = 'achat_proxy_title';
  static const String proxyUse = 'achat_proxy_use';
  static const String proxyConnection = 'achat_proxy_connection';
  static const String proxyAdd = 'achat_proxy_add';
  static const String proxyCall = 'achat_proxy_call';
  static const String proxyCallDesc = 'achat_proxy_call_desc';
  
  // Language Settings
  static const String languageSettingsTitle = 'achat_language_settings_title';
  
  // Toast Messages
  static const String toastMarkedRead = 'achat_toast_marked_read';
  static const String toastDeleted = 'achat_toast_deleted';
  static const String toastSaved = 'achat_toast_saved';
  static const String toastShared = 'achat_toast_shared';
  static const String toastCopied = 'achat_toast_copied';
  static const String toastError = 'achat_toast_error';
  static const String toastSuccess = 'achat_toast_success';
  
  // Chat Screen Keys
  static const String clearChat = 'achat_clear_chat';
  static const String moreOptions = 'achat_more_options';
  static const String chatCleared = 'achat_chat_cleared';
  static const String exportChat = 'achat_export_chat';
  static const String importChat = 'achat_import_chat';
  static const String searchMessages = 'achat_search_messages';
  static const String chatInfo = 'achat_chat_info';
  static const String searchTerm = 'achat_search_term';
  static const String searchResults = 'achat_search_results';
  static const String noMessagesFound = 'achat_no_messages_found';
  static const String chatInformation = 'achat_chat_information';
  static const String totalMessages = 'achat_total_messages';
  static const String unreadMessages = 'achat_unread_messages';
  static const String chatStatus = 'achat_chat_status';
  static const String lastMessage = 'achat_last_message';
  static const String empty = 'achat_empty';
  static const String active = 'achat_active';
  static const String clearChatConfirm = 'achat_clear_chat_confirm';
  static const String exportedMessages = 'achat_exported_messages';
  static const String importNotImplemented = 'achat_import_not_implemented';
  static const String you = 'achat_you';
  static const String ai = 'achat_ai';
}