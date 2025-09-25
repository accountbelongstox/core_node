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

/// AChat App Images Assets
/// Provides image asset definitions for the AChat app following the standard pattern
/// All image keys must have 'achat_' prefix as per specification
class AChatAppAssetsImages {
  static const String _base = 'assets/apps/app_achat/images';
  static const String _extra = 'assets/.extra_achat/images';

  static const String achat_one = '$_base/one.jpg';
  static const String achat_splash = '$_base/splash.png';
  static const String achat_empty = '$_base/empty.png';
  static const String achat_error = '$_base/error.png';
  static const String achat_launch = '$_base/launch.jpg';

  static const String achat_moments_banner = '$_base/moments_banner.png';
  static const String achat_channels_banner = '$_base/channels_banner.png';
  static const String achat_games_banner = '$_base/games_banner.png';
  static const String achat_mini_programs_banner = '$_base/mini_programs_banner.png';
  static const String achat_news_banner = '$_base/news_banner.png';
  static const String achat_shopping_banner = '$_base/shopping_banner.png';
  static const String achat_services_banner = '$_base/services_banner.png';
  static const String achat_entertainment_banner = '$_base/entertainment_banner.png';

  static const String achat_ai_assistant_banner = '$_base/ai_assistant_banner.png';
  static const String achat_bot_avatar = '$_base/bot_avatar.png';
  static const String achat_smart_reply_demo = '$_base/smart_reply_demo.png';
  static const String achat_translate_demo = '$_base/translate_demo.png';
  static const String achat_voice_to_text_demo = '$_base/voice_to_text_demo.png';

  static const String achat_chat_background = '$_base/chat_background.png';
  static const String achat_chat_bubble_user = '$_base/chat_bubble_user.png';
  static const String achat_chat_bubble_other = '$_base/chat_bubble_other.png';
  static const String achat_chat_bubble_system = '$_base/chat_bubble_system.png';
  static const String achat_typing_indicator = '$_base/typing_indicator.png';
  static const String achat_voice_message_wave = '$_base/voice_message_wave.png';

  static const String achat_camera_placeholder = '$_base/camera_placeholder.png';
  static const String achat_gallery_placeholder = '$_base/gallery_placeholder.png';
  static const String achat_document_placeholder = '$_base/document_placeholder.png';
  static const String achat_location_map = '$_base/location_map.png';
  static const String achat_sticker_placeholder = '$_base/sticker_placeholder.png';
  static const String achat_gif_placeholder = '$_base/gif_placeholder.png';

  static const String achat_default_avatar = '$_base/default_avatar.png';
  static const String achat_profile_background = '$_base/profile_background.png';
  static const String achat_cover_photo = '$_base/cover_photo.png';
  static const String achat_qr_code = '$_base/qr_code.png';

  static const String achat_gradient_background = '$_base/gradient_background.png';
  static const String achat_pattern_background = '$_base/pattern_background.png';
  static const String achat_card_background = '$_base/card_background.png';
  static const String achat_button_background = '$_base/button_background.png';

  static const String achat_ad_home = '$_extra/ad_home.png';

  static const String achat_online_status = '$_base/online_status.png';
  static const String achat_offline_status = '$_base/offline_status.png';
  static const String achat_typing_status = '$_base/typing_status.png';
  static const String achat_read_status = '$_base/read_status.png';
  static const String achat_unread_badge = '$_base/unread_badge.png';
  static const String achat_muted_icon = '$_base/muted_icon.png';
  static const String achat_pinned_icon = '$_base/pinned_icon.png';
  static const String achat_starred_icon = '$_base/starred_icon.png';
  static const String achat_loading = '$_base/loading.png';

  static const String achat_settings_background = '$_base/settings_background.png';
  static const String achat_notification_settings = '$_base/notification_settings.png';
  static const String achat_privacy_settings = '$_base/privacy_settings.png';
  static const String achat_security_settings = '$_base/security_settings.png';
  static const String achat_storage_settings = '$_base/storage_settings.png';

  static const String achat_onboarding_1 = '$_base/onboarding_1.png';
  static const String achat_onboarding_2 = '$_base/onboarding_2.png';
  static const String achat_onboarding_3 = '$_base/onboarding_3.png';
  static const String achat_tutorial_step_1 = '$_base/tutorial_step_1.png';
  static const String achat_tutorial_step_2 = '$_base/tutorial_step_2.png';
  static const String achat_tutorial_step_3 = '$_base/tutorial_step_3.png';

  static const String achat_image_placeholder = '$_base/image_placeholder.png';
  static const String achat_video_placeholder = '$_base/video_placeholder.png';
  static const String achat_audio_placeholder = '$_base/audio_placeholder.png';
  static const String achat_file_placeholder = '$_base/file_placeholder.png';
  static const String achat_contact_placeholder = '$_base/contact_placeholder.png';

  static const String achat_divider_line = '$_base/divider_line.png';
  static const String achat_shadow_overlay = '$_base/shadow_overlay.png';
  static const String achat_highlight_effect = '$_base/highlight_effect.png';
  static const String achat_border_frame = '$_base/border_frame.png';

  /// Get all AChat app images as a map
  static Map<String, String> getAllImages() {
    return {
      'achat_one': achat_one,
      'achat_splash': achat_splash,
      'achat_empty': achat_empty,
      'achat_error': achat_error,
      'achat_launch': achat_launch,
      'achat_moments_banner': achat_moments_banner,
      'achat_channels_banner': achat_channels_banner,
      'achat_games_banner': achat_games_banner,
      'achat_mini_programs_banner': achat_mini_programs_banner,
      'achat_news_banner': achat_news_banner,
      'achat_shopping_banner': achat_shopping_banner,
      'achat_services_banner': achat_services_banner,
      'achat_entertainment_banner': achat_entertainment_banner,
      'achat_ai_assistant_banner': achat_ai_assistant_banner,
      'achat_bot_avatar': achat_bot_avatar,
      'achat_smart_reply_demo': achat_smart_reply_demo,
      'achat_translate_demo': achat_translate_demo,
      'achat_voice_to_text_demo': achat_voice_to_text_demo,
      'achat_chat_background': achat_chat_background,
      'achat_chat_bubble_user': achat_chat_bubble_user,
      'achat_chat_bubble_other': achat_chat_bubble_other,
      'achat_chat_bubble_system': achat_chat_bubble_system,
      'achat_typing_indicator': achat_typing_indicator,
      'achat_voice_message_wave': achat_voice_message_wave,
      'achat_camera_placeholder': achat_camera_placeholder,
      'achat_gallery_placeholder': achat_gallery_placeholder,
      'achat_document_placeholder': achat_document_placeholder,
      'achat_location_map': achat_location_map,
      'achat_sticker_placeholder': achat_sticker_placeholder,
      'achat_gif_placeholder': achat_gif_placeholder,
      'achat_default_avatar': achat_default_avatar,
      'achat_profile_background': achat_profile_background,
      'achat_cover_photo': achat_cover_photo,
      'achat_qr_code': achat_qr_code,
      'achat_gradient_background': achat_gradient_background,
      'achat_pattern_background': achat_pattern_background,
      'achat_card_background': achat_card_background,
      'achat_button_background': achat_button_background,
      'achat_ad_home': achat_ad_home,
      'achat_online_status': achat_online_status,
      'achat_offline_status': achat_offline_status,
      'achat_typing_status': achat_typing_status,
      'achat_read_status': achat_read_status,
      'achat_unread_badge': achat_unread_badge,
      'achat_muted_icon': achat_muted_icon,
      'achat_pinned_icon': achat_pinned_icon,
      'achat_starred_icon': achat_starred_icon,
      'achat_loading': achat_loading,
      'achat_settings_background': achat_settings_background,
      'achat_notification_settings': achat_notification_settings,
      'achat_privacy_settings': achat_privacy_settings,
      'achat_security_settings': achat_security_settings,
      'achat_storage_settings': achat_storage_settings,
      'achat_onboarding_1': achat_onboarding_1,
      'achat_onboarding_2': achat_onboarding_2,
      'achat_onboarding_3': achat_onboarding_3,
      'achat_tutorial_step_1': achat_tutorial_step_1,
      'achat_tutorial_step_2': achat_tutorial_step_2,
      'achat_tutorial_step_3': achat_tutorial_step_3,
      'achat_image_placeholder': achat_image_placeholder,
      'achat_video_placeholder': achat_video_placeholder,
      'achat_audio_placeholder': achat_audio_placeholder,
      'achat_file_placeholder': achat_file_placeholder,
      'achat_contact_placeholder': achat_contact_placeholder,
      'achat_divider_line': achat_divider_line,
      'achat_shadow_overlay': achat_shadow_overlay,
      'achat_highlight_effect': achat_highlight_effect,
      'achat_border_frame': achat_border_frame,
    };
  }

  /// Get specific image by key
  static String? getImage(String key) {
    return getAllImages()[key];
  }
}
