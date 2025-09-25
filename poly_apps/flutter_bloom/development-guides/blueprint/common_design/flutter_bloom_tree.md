<!-- ### AI SPECIAL ATTENTION RULES START ### -->
<!-- When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES: -->
<!-- - Write all code in English only. -->
<!-- - Never execute, create, or modify test code. -->
<!-- - Never create or update documentation (*.md). -->
<!-- - Never write summaries during development or thinking process. -->
<!-- 5. Declare all variables at the beginning of the file. -->
<!-- 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\\..\\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path). -->
<!-- 7. Do not modify these rules. -->
<!-- VIOLATION OF THESE RULES IS STRICTLY PROHIBITED -->
<!-- ### AI SPECIAL ATTENTION RULES END ### -->

# Directory Tree: flutter_bloom

**Path:** `D:\programing\core_node\poly_apps\flutter_bloom`

```
flutter_bloom/E
├── assets/
│   ├── achat_icons/
│   ├── achat_images/
│   ├── achat_launch/
│   │   └── background.jpg
│   ├── common_icons/
│   ├── common_images/
│   ├── common_launch/
│   │   ├── dark_launch.jpg
│   │   └── light_launch.jpg
│   ├── dev_icons/
│   ├── dev_images/
│   ├── dev_launch/
│   │   └── luanch.jpg
│   ├── font/
│   │   ├── 4 .ttf files
│   │   └── 4 .otf files
│   ├── qy_icons/
│   │   ├── 55 .png files
│   │   └── 6 .jpg files
│   ├── qy_images/
│   │   ├── 30 .jpg files
│   │   ├── Flood.png
│   │   ├── poor4.png
│   │   ├── user.png
│   │   ├── child1.jpeg
│   │   ├── funrasing1.jpeg
│   │   └── student2.jpeg
│   ├── qy_launch/
│   │   ├── id_ed25519.pub
│   │   ├── background.jpg
│   │   ├── light_launch_1.jpg
│   │   ├── dark_launch.png
│   │   └── light_launch.png
│   ├── wuy_icons/
│   │   └── logo.png
│   ├── wuy_images/
│   └── wuy_launch/
│       └── luanch.jpg
├── development-guides/
│   └── FLUTTER_GUIDE_THIS_FILE_NO_AI_EDIT.md
├── docs/
│   ├── flutter_localization.md
│   ├── flutter_native_splash_doc.md
│   └── state_management.md
├── lib/
│   ├── app_achat/
│   │   ├── feature_achat/
│   │   │   ├── add_contacts/
│   │   │   │   ├── domain/
│   │   │   │   │   ├── model/
│   │   │   │   │   │   └── contact_option_model.dart
│   │   │   │   │   └── service/
│   │   │   │   │       └── add_contacts_service.dart
│   │   │   │   ├── view/
│   │   │   │   │   └── add_contacts_screen.dart
│   │   │   │   └── widgets/
│   │   │   │       └── add_contacts_widgets.dart
│   │   │   ├── app_lock/
│   │   │   │   ├── domain/
│   │   │   │   │   ├── model/
│   │   │   │   │   │   └── app_lock_model.dart
│   │   │   │   │   └── service/
│   │   │   │   │       └── app_lock_service.dart
│   │   │   │   ├── view/
│   │   │   │   │   └── app_lock_screen.dart
│   │   │   │   └── widgets/
│   │   │   │       └── app_lock_widgets.dart
│   │   │   ├── chat_details/
│   │   │   │   ├── domain/
│   │   │   │   │   ├── model/
│   │   │   │   │   │   └── chat_message_model.dart
│   │   │   │   │   └── service/
│   │   │   │   │       └── chat_details_service.dart
│   │   │   │   ├── view/
│   │   │   │   │   └── chat_details_screen.dart
│   │   │   │   └── widgets/
│   │   │   │       ├── chat_details_app_bar.dart
│   │   │   │       └── chat_details_widgets.dart
│   │   │   ├── chat_home/
│   │   │   │   ├── domain/
│   │   │   │   │   ├── model/
│   │   │   │   │   │   └── chat_item_model.dart
│   │   │   │   │   └── service/
│   │   │   │   │       └── chat_home_service.dart
│   │   │   │   ├── view/
│   │   │   │   │   └── chat_home_screen.dart
│   │   │   │   └── widgets/
│   │   │   │       ├── chat_home_app_bar.dart
│   │   │   │       ├── chat_home_menu.dart
│   │   │   │       └── chat_home_widgets.dart
│   │   │   ├── chat_list/
│   │   │   │   ├── domain/
│   │   │   │   │   ├── model/
│   │   │   │   │   │   └── chat_list_model.dart
│   │   │   │   │   └── service/
│   │   │   │   │       └── chat_list_service.dart
│   │   │   │   ├── view/
│   │   │   │   │   └── chat_list_screen.dart
│   │   │   │   └── widgets/
│   │   │   │       ├── chat_list_appbar.dart
│   │   │   │       ├── chat_list_item.dart
│   │   │   │       └── chat_search_bar.dart
│   │   │   ├── chat_list_alt/
│   │   │   │   ├── domain/
│   │   │   │   │   ├── model/
│   │   │   │   │   │   └── chat_model.dart
│   │   │   │   │   └── service/
│   │   │   │   │       └── chat_service.dart
│   │   │   │   ├── view/
│   │   │   │   │   └── chat_list_alt_screen.dart
│   │   │   │   └── widgets/
│   │   │   │       ├── app_bar_widget.dart
│   │   │   │       ├── bottom_bar_widget.dart
│   │   │   │       └── chat_list_widgets.dart
│   │   │   ├── common_widgets/
│   │   │   │   ├── back_appbar/
│   │   │   │   │   └── back_appbar_widget.dart
│   │   │   │   └── bottom_tabs/
│   │   │   │       └── bottom_tabs_widget.dart
│   │   │   ├── create_group/
│   │   │   │   ├── domain/
│   │   │   │   │   ├── model/
│   │   │   │   │   │   └── contact_model.dart
│   │   │   │   │   └── service/
│   │   │   │   │       └── contact_service.dart
│   │   │   │   ├── view/
│   │   │   │   │   └── create_group_screen.dart
│   │   │   │   └── widgets/
│   │   │   │       ├── contact_list.dart
│   │   │   │       ├── create_group_appbar.dart
│   │   │   │       └── search_bar.dart
│   │   │   ├── group_chat/
│   │   │   │   ├── domain/
│   │   │   │   │   ├── model/
│   │   │   │   │   │   └── chat_message_model.dart
│   │   │   │   │   └── service/
│   │   │   │   │       └── chat_service.dart
│   │   │   │   ├── view/
│   │   │   │   │   └── group_chat_screen.dart
│   │   │   │   └── widgets/
│   │   │   │       ├── chat_input_bar.dart
│   │   │   │       ├── chat_message_list.dart
│   │   │   │       └── group_chat_appbar.dart
│   │   │   ├── home/
│   │   │   │   └── view/
│   │   │   │       └── home_screen.dart
│   │   │   ├── language_settings/
│   │   │   │   ├── domain/
│   │   │   │   │   ├── model/
│   │   │   │   │   │   └── language_settings_model.dart
│   │   │   │   │   └── service/
│   │   │   │   │       └── language_settings_service.dart
│   │   │   │   ├── view/
│   │   │   │   │   └── language_settings_screen.dart
│   │   │   │   └── widgets/
│   │   │   │       └── language_settings_list.dart
│   │   │   ├── new_chat/
│   │   │   │   ├── domain/
│   │   │   │   │   ├── model/
│   │   │   │   │   │   └── new_chat_model.dart
│   │   │   │   │   └── service/
│   │   │   │   │       └── new_chat_service.dart
│   │   │   │   ├── view/
│   │   │   │   │   └── new_chat_screen.dart
│   │   │   │   └── widgets/
│   │   │   │       ├── new_chat_bottom_bar.dart
│   │   │   │       ├── new_chat_list.dart
│   │   │   │       └── new_chat_search.dart
│   │   │   ├── notification_setting/
│   │   │   │   ├── domain/
│   │   │   │   │   ├── model/
│   │   │   │   │   │   └── notification_setting_model.dart
│   │   │   │   │   └── service/
│   │   │   │   │       └── notification_setting_service.dart
│   │   │   │   ├── view/
│   │   │   │   │   └── notification_setting_screen.dart
│   │   │   │   └── widgets/
│   │   │   │       └── notification_setting_list.dart
│   │   │   ├── privacy_security/
│   │   │   │   ├── domain/
│   │   │   │   │   ├── model/
│   │   │   │   │   │   └── privacy_security_model.dart
│   │   │   │   │   └── service/
│   │   │   │   │       └── privacy_security_service.dart
│   │   │   │   ├── view/
│   │   │   │   │   └── privacy_security_screen.dart
│   │   │   │   └── widgets/
│   │   │   │       └── privacy_security_list.dart
│   │   │   ├── profile/
│   │   │   │   ├── domain/
│   │   │   │   │   ├── model/
│   │   │   │   │   │   └── profile_model.dart
│   │   │   │   │   └── service/
│   │   │   │   │       └── profile_service.dart
│   │   │   │   ├── view/
│   │   │   │   │   └── profile_screen.dart
│   │   │   │   └── widgets/
│   │   │   │       ├── profile_header.dart
│   │   │   │       └── profile_menu.dart
│   │   │   ├── proxy_settings/
│   │   │   │   ├── domain/
│   │   │   │   │   ├── model/
│   │   │   │   │   │   └── proxy_settings_model.dart
│   │   │   │   │   └── service/
│   │   │   │   │       └── proxy_settings_service.dart
│   │   │   │   ├── view/
│   │   │   │   │   └── proxy_settings_screen.dart
│   │   │   │   └── widgets/
│   │   │   │       └── proxy_settings_list.dart
│   │   │   └── qr_profile/
│   │   │       ├── domain/
│   │   │       │   ├── model/
│   │   │       │   │   └── qr_profile_model.dart
│   │   │       │   └── service/
│   │   │       │       └── qr_profile_service.dart
│   │   │       ├── view/
│   │   │       │   └── qr_profile_screen.dart
│   │   │       └── widgets/
│   │   │           ├── qr_profile_actions.dart
│   │   │           └── qr_profile_content.dart
│   │   ├── feature_achat_bak/
│   │   │   └── home/
│   │   │       └── view/
│   │   │           └── home_screen.dart
│   │   ├── localization/
│   │   │   ├── en.dart
│   │   │   └── zh.dart
│   │   ├── localization_bak/
│   │   │   ├── en.dart
│   │   │   └── zh.dart
│   │   ├── router_achat/
│   │   │   └── router_achat.dart
│   │   └── router_achat_bak/
│   │       └── router_achat.dart
│   ├── app_dev/
│   │   ├── feature_dev/
│   │   │   └── home/
│   │   │       └── view/
│   │   │           ├── home_screen.bak.dart
│   │   │           └── home_screen.dart
│   │   ├── localization/
│   │   │   ├── en.dart
│   │   │   └── zh.dart
│   │   └── router_dev/
│   │       └── router_dev.dart
│   ├── app_qy/
│   │   ├── controller/
│   │   │   ├── auth_controller.dart
│   │   │   ├── settings_controller.dart
│   │   │   └── splash_controller.dart
│   │   ├── localization/
│   │   │   ├── en.dart
│   │   │   └── zh.dart
│   │   ├── qy_feature/
│   │   │   ├── about/
│   │   │   │   ├── actions/
│   │   │   │   └── about_screen.dart
│   │   │   ├── authentication/
│   │   │   │   ├── actions/
│   │   │   │   │   └── auth_actions.dart
│   │   │   │   └── view/
│   │   │   │       ├── congratulation_screen.dart
│   │   │   │       ├── create_pin_screen.dart
│   │   │   │       ├── forgot_screen.dart
│   │   │   │       ├── resetpassword_screen.dart
│   │   │   │       ├── select_country.dart
│   │   │   │       ├── signin_up_screen.dart
│   │   │   │       ├── verify_screen.dart
│   │   │   │       └── welcom_screen.dart
│   │   │   ├── bookmark/
│   │   │   │   ├── actions/
│   │   │   │   └── bookmark_screen.dart
│   │   │   ├── comming/
│   │   │   │   ├── actions/
│   │   │   │   └── coming_screen.dart
│   │   │   ├── common_widgets/
│   │   │   │   ├── bar_menu/
│   │   │   │   │   ├── home_bar.dart
│   │   │   │   │   └── home_bottom_navigation.dart
│   │   │   │   ├── home_widget/
│   │   │   │   │   ├── tab_widget.dart
│   │   │   │   │   └── top_section.dart
│   │   │   │   └── settings_item/
│   │   │   │       ├── settings_arrow_item.dart
│   │   │   │       ├── settings_badge_item.dart
│   │   │   │       ├── settings_dropdown_item.dart
│   │   │   │       ├── settings_group.dart
│   │   │   │       └── settings_switch_item.dart
│   │   │   ├── dashboard/
│   │   │   │   ├── actions/
│   │   │   │   ├── models/
│   │   │   │   │   └── navigation_model.dart
│   │   │   │   ├── view/
│   │   │   │   │   ├── dashboard_screen.dart
│   │   │   │   │   └── inbox_screen.dart
│   │   │   │   └── widgets/
│   │   │   │       └── appbar.dart
│   │   │   ├── donation/
│   │   │   │   ├── actions/
│   │   │   │   ├── domain/
│   │   │   │   │   └── model/
│   │   │   │   │       └── doantion_model.dart
│   │   │   │   └── view/
│   │   │   │       ├── donation_all_screen.dart
│   │   │   │       └── donation_screen.dart
│   │   │   ├── fundraising/
│   │   │   │   ├── actions/
│   │   │   │   ├── domain/
│   │   │   │   │   └── model/
│   │   │   │   │       ├── activity_model.dart
│   │   │   │   │       ├── fundraising_model.dart
│   │   │   │   │       └── my_fundraising_model.dart
│   │   │   │   ├── view/
│   │   │   │   │   ├── activity_screen.dart
│   │   │   │   │   ├── create_new_fundraising.dart
│   │   │   │   │   ├── edit_fundaising.dart
│   │   │   │   │   ├── fundraising_ditails.dart
│   │   │   │   │   ├── fundrasing.dart
│   │   │   │   │   ├── fundrasing_screen.dart
│   │   │   │   │   └── my_fudrasing_screen.dart
│   │   │   │   └── widget/
│   │   │   │       ├── card_widget.dart
│   │   │   │       └── create_fundraisig_image_widget.dart
│   │   │   ├── help/
│   │   │   │   ├── actions/
│   │   │   │   ├── model/
│   │   │   │   │   └── help_data_model.dart
│   │   │   │   ├── view/
│   │   │   │   │   ├── about_us_screen.dart
│   │   │   │   │   ├── contact_screen.dart
│   │   │   │   │   ├── fqa_screen.dart
│   │   │   │   │   ├── privacy_policy.dart
│   │   │   │   │   └── themes_conditions.dart
│   │   │   │   └── widgets/
│   │   │   │       └── fqa_widet.dart
│   │   │   ├── home/
│   │   │   │   ├── actions/
│   │   │   │   ├── domain/
│   │   │   │   │   ├── model/
│   │   │   │   │   │   ├── all_screen_model.dart
│   │   │   │   │   │   ├── banner_model.dart
│   │   │   │   │   │   ├── comingto_model.dart
│   │   │   │   │   │   ├── fund_rising_model.dart
│   │   │   │   │   │   ├── medical_model.dart
│   │   │   │   │   │   ├── notification_model.dart
│   │   │   │   │   │   ├── prayer_model.dart
│   │   │   │   │   │   ├── urgetnt_fundrasing_model.dart
│   │   │   │   │   │   └── wacth_impact_model.dart
│   │   │   │   │   └── service/
│   │   │   │   │       ├── banner_service.dart
│   │   │   │   │       ├── home_service_interface.dart
│   │   │   │   │       └── product_service.dart
│   │   │   │   ├── view/
│   │   │   │   │   ├── home_screen.dart
│   │   │   │   │   ├── play_video_screen.dart
│   │   │   │   │   ├── prayer_screen.dart
│   │   │   │   │   ├── urgent_fundraising.dart
│   │   │   │   │   └── watch_impact.dart
│   │   │   │   └── widget/
│   │   │   │       ├── actions_widget.dart
│   │   │   │       ├── all_screen.dart
│   │   │   │       ├── banner_widget.dart
│   │   │   │       ├── coming_list.dart
│   │   │   │       ├── coming_widget.dart
│   │   │   │       ├── disaster_screen.dart
│   │   │   │       ├── education_screen.dart
│   │   │   │       ├── fund_rising_listview.dart
│   │   │   │       ├── fund_rising_widget.dart
│   │   │   │       ├── health_screen.dart
│   │   │   │       ├── home_title.dart
│   │   │   │       ├── logined_func_widget.dart
│   │   │   │       ├── logined_wordgroup_widget.dart
│   │   │   │       ├── medical_screen.dart
│   │   │   │       ├── prayer_listview.dart
│   │   │   │       ├── prayer_widget.dart
│   │   │   │       ├── prayerfrom_pepole.dart
│   │   │   │       ├── urgent_fund_rising_widget.dart
│   │   │   │       ├── urgentfunding_widget.dart
│   │   │   │       ├── watch_impact_list.dart
│   │   │   │       └── watch_impact_widget.dart
│   │   │   ├── home_login/
│   │   │   │   ├── view/
│   │   │   │   │   └── home_login_view.dart
│   │   │   │   └── widget/
│   │   │   │       └── home_login_widget.dart
│   │   │   ├── inbox/
│   │   │   │   ├── actions/
│   │   │   │   ├── domain/
│   │   │   │   │   └── model/
│   │   │   │   │       └── inbox_model.dart
│   │   │   │   └── view/
│   │   │   │       └── chat_screen.dart
│   │   │   ├── interest/
│   │   │   │   ├── actions/
│   │   │   │   └── select_interest.dart
│   │   │   ├── invite_friend/
│   │   │   │   ├── actions/
│   │   │   │   └── invite_friend_screen.dart
│   │   │   ├── language/
│   │   │   │   ├── actions/
│   │   │   │   └── language_selector.dart
│   │   │   ├── notification/
│   │   │   │   ├── actions/
│   │   │   │   └── notificaiton_screen.dart
│   │   │   ├── onbording/
│   │   │   │   ├── actions/
│   │   │   │   ├── controller/
│   │   │   │   │   └── home_controller.dart
│   │   │   │   ├── model/
│   │   │   │   │   └── on_boarding_model.dart
│   │   │   │   └── view/
│   │   │   │       └── onbording_screen.dart
│   │   │   ├── prayer/
│   │   │   │   ├── actions/
│   │   │   │   └── prayer_screen.dart
│   │   │   ├── profile/
│   │   │   │   ├── actions/
│   │   │   │   ├── controller/
│   │   │   │   │   └── profile_controller.dart
│   │   │   │   ├── domain/
│   │   │   │   │   ├── model/
│   │   │   │   │   │   ├── about_model.dart
│   │   │   │   │   │   ├── profile_model.dart
│   │   │   │   │   │   └── select_insterest_model.dart
│   │   │   │   │   └── service/
│   │   │   │   │       ├── profile_service.dart
│   │   │   │   │       └── profile_servise_interface.dart
│   │   │   │   └── view/
│   │   │   │       ├── edit_profile.dart
│   │   │   │       ├── profile_screen.dart
│   │   │   │       └── profile_view_screen.dart
│   │   │   ├── profile_two/
│   │   │   │   ├── actions/
│   │   │   │   ├── view/
│   │   │   │   │   ├── add_card_screen.dart
│   │   │   │   │   ├── profile_two_screen.dart
│   │   │   │   │   ├── set_withdraw_mail_screen.dart
│   │   │   │   │   ├── top_up_screen.dart
│   │   │   │   │   ├── topup_method_screen.dart
│   │   │   │   │   ├── wallet_center_screen.dart
│   │   │   │   │   └── withdraw_screen.dart
│   │   │   │   └── widget/
│   │   │   │       ├── interest_widget.dart
│   │   │   │       ├── setting_widget.dart
│   │   │   │       └── top_card_widget.dart
│   │   │   ├── search/
│   │   │   │   ├── actions/
│   │   │   │   └── search_screen.dart
│   │   │   ├── setting/
│   │   │   │   ├── actions/
│   │   │   │   ├── domain/
│   │   │   │   │   └── model/
│   │   │   │   │       └── invite_friend_model.dart
│   │   │   │   ├── view/
│   │   │   │   │   ├── help_screen.dart
│   │   │   │   │   ├── notification_setting.dart
│   │   │   │   │   ├── security_screen.dart
│   │   │   │   │   └── setting_screen_view.dart
│   │   │   │   └── widgets/
│   │   │   │       ├── card_widget.dart
│   │   │   │       └── notification_setting_widget.dart
│   │   │   ├── social_feed/
│   │   │   │   ├── model/
│   │   │   │   │   └── post_model.dart
│   │   │   │   ├── view/
│   │   │   │   │   └── social_feed_screen.dart
│   │   │   │   └── widget/
│   │   │   │       ├── feed_header.dart
│   │   │   │       └── post_card.dart
│   │   │   ├── splash/
│   │   │   │   ├── actions/
│   │   │   │   ├── view/
│   │   │   │   │   └── splash_screen.dart
│   │   │   │   └── widgets/
│   │   │   │       └── slide_to_start_button.dart
│   │   │   ├── tab/
│   │   │   │   ├── actions/
│   │   │   │   └── view/
│   │   │   │       ├── all_screen.dart
│   │   │   │       └── medical_screen.dart
│   │   │   ├── top_menu/
│   │   │   │   ├── actions/
│   │   │   │   ├── widgets/
│   │   │   │   │   ├── custom_icon_label.dart
│   │   │   │   │   └── custom_icon_label_group.dart
│   │   │   │   └── top_menu.dart
│   │   │   ├── word_card/
│   │   │   │   ├── actions/
│   │   │   │   ├── controller/
│   │   │   │   │   └── word_card_controller.dart
│   │   │   │   ├── models/
│   │   │   │   │   ├── word_card_model.dart
│   │   │   │   │   ├── word_card_model.g.dart
│   │   │   │   │   └── word_model.dart
│   │   │   │   └── view/
│   │   │   │       └── word_card_screen.dart
│   │   │   └── word_cards/
│   │   │       ├── actions/
│   │   │       ├── types/
│   │   │       │   └── words_types.dart
│   │   │       └── view/
│   │   │           └── word_cards_screen.dart
│   │   ├── qy_router/
│   │   │   └── router_qy.dart
│   │   └── resources/
│   │       ├── icon_images/
│   │       │   ├── assets_icons.dart
│   │       │   ├── assets_images.dart
│   │       │   └── assets_light_background.dart
│   │       └── styles/
│   │           ├── app_colors.dart
│   │           ├── app_text_styles.dart
│   │           └── assets_dark_background.dart
│   ├── app_wuy/
│   │   ├── feature_wuy/
│   │   │   └── home/
│   │   │       └── view/
│   │   │           └── home_screen.dart
│   │   ├── localization/
│   │   │   ├── en.dart
│   │   │   └── zh.dart
│   │   └── router_wuy/
│   │       └── router_wuy.dart
│   ├── apps/
│   ├── common/
│   │   ├── constants/
│   │   │   └── app_constants.dart
│   │   ├── iframe/
│   │   │   └── iframe_listner.dart
│   │   ├── model/
│   │   │   ├── config_model.dart
│   │   │   ├── messages.dart
│   │   │   ├── user_model.dart
│   │   │   └── word_list_types.dart
│   │   ├── network/
│   │   │   ├── api_checker.dart
│   │   │   ├── api_client.dart
│   │   │   ├── api_group.dart
│   │   │   ├── error_response.dart
│   │   │   ├── laravel_apis.dart
│   │   │   └── laravel_auth_apis.dart
│   │   ├── provider/
│   │   │   ├── app_assets.dart
│   │   │   ├── prefs.dart
│   │   │   ├── screen_size_provider.dart
│   │   │   └── user_provider.dart
│   │   ├── repo/
│   │   │   └── splash_repo.dart
│   │   ├── storage/
│   │   │   └── app_storage.dart
│   │   └── widgets/
│   │       ├── custom_swipable_button/
│   │       │   ├── swipeable_button_view.dart
│   │       │   └── swipeable_widget.dart
│   │       ├── animated_custom_dialog.dart
│   │       ├── config.dart
│   │       ├── confirmation_dialog.dart
│   │       ├── country_picker.dart
│   │       ├── custom_app_bar.dart
│   │       ├── custom_bottom_navigation.dart
│   │       ├── custom_button.dart
│   │       ├── custom_calender.dart
│   │       ├── custom_card.dart
│   │       ├── custom_date_picker.dart
│   │       ├── custom_delegate.dart
│   │       ├── custom_divider.dart
│   │       ├── custom_drawer.dart
│   │       ├── custom_drop_down_item.dart
│   │       ├── custom_gradient_text.dart
│   │       ├── custom_icon_label.dart
│   │       ├── custom_icon_label_group.dart
│   │       ├── custom_image.dart
│   │       ├── custom_loader.dart
│   │       ├── custom_search_input.dart
│   │       ├── custom_slider_button.dart
│   │       ├── custom_snackbar.dart
│   │       ├── custom_text_field.dart
│   │       ├── custom_title.dart
│   │       ├── digital_payment_dialog.dart
│   │       ├── image_dialog.dart
│   │       ├── no_data_screen.dart
│   │       ├── open_map.dart
│   │       ├── outelineborder.dart
│   │       ├── paginated_list_view.dart
│   │       ├── payment_item_info.dart
│   │       ├── responsive_layout.dart
│   │       ├── segmented_button.dart
│   │       └── type_button_widget.dart
│   ├── generated/
│   │   └── assets.dart
│   ├── helper/
│   │   ├── date_converter_helper.dart
│   │   ├── display_helper.dart
│   │   ├── email_checker_helper.dart
│   │   ├── image_loader_helper.dart
│   │   ├── image_size_checker_helper.dart
│   │   ├── localization_helper.dart
│   │   ├── map_locales.dart
│   │   ├── native_splash.dart
│   │   ├── notification_helper.dart
│   │   ├── price_converter_helper.dart
│   │   ├── responsive_helper.dart
│   │   └── toaster_helper.dart
│   ├── theme/
│   │   ├── mobile/
│   │   │   ├── app_color.dart
│   │   │   ├── app_dark_theme.dart
│   │   │   └── app_light_theme.dart
│   │   ├── pc_style_font_assets/
│   │   ├── phone_style_font_assets/
│   │   │   ├── gradientdark.dart
│   │   │   └── gradientlight.dart
│   │   ├── website/
│   │   │   ├── website_dark_theme.dart
│   │   │   ├── website_gradientdark.dart
│   │   │   ├── website_gradientlight.dart
│   │   │   └── website_light_theme.dart
│   │   └── mobile_assets_manager.dart
│   ├── util/
│   │   ├── idb_shim/
│   │   │   ├── base/
│   │   │   │   ├── create_table_from_entry.dart
│   │   │   │   └── initializetion_db.dart
│   │   │   ├── operations/
│   │   │   │   ├── cache_op.dart
│   │   │   │   ├── data_status.dart
│   │   │   │   ├── word_delete.dart
│   │   │   │   ├── word_insert.dart
│   │   │   │   ├── word_query.dart
│   │   │   │   └── word_update.dart
│   │   │   └── table_model/
│   │   │       ├── cache_model.dart
│   │   │       └── dictionary_entry.dart
│   │   ├── sqlite/
│   │   │   └── sqlitedb.dart
│   │   ├── web_tool/
│   │   │   ├── web_tools.dart
│   │   │   ├── web_tools_non_web.dart
│   │   │   ├── web_tools_web.dart
│   │   │   └── webabs.dart
│   │   ├── word_parse/
│   │   │   ├── bw_parsetool.dart
│   │   │   ├── bwpaser.1.0.12.js
│   │   │   ├── html_generator.dart
│   │   │   └── word_parser.dart
│   │   ├── bw_parsetool.dart
│   │   ├── bwpaser.1.0.12.js
│   │   ├── date_tools.dart
│   │   ├── dimensions.dart
│   │   ├── get_platform.dart
│   │   ├── gradientStyle.dart
│   │   ├── js_example.dart
│   │   ├── reflect_tool.dart
│   │   ├── route_manager.dart
│   │   ├── storage_util.dart
│   │   └── styles.dart
│   └── main.dart
├── public/
│   ├── acui/
│   │   ├── scripts/
│   │   │   └── script.js
│   │   ├── styles/
│   │   │   └── styles.css
│   │   └── 14 .html files
│   ├── 5 .jpg files
│   ├── 16 .png files
│   ├── login_index.html
│   └── 11 .webp files
├── scripts/
│   ├── build_scripts/
│   │   ├── pybuildscripts/
│   │   │   ├── gvar/
│   │   │   │   └── gvar.py
│   │   │   ├── installer_py_package/
│   │   │   │   ├── install_pypackages.ps1
│   │   │   │   ├── packag_test.py
│   │   │   │   └── python_packages.json
│   │   │   ├── provider/
│   │   │   │   └── build_provider.py
│   │   │   ├── pybppkg/
│   │   │   │   ├── backup_icon_android.py
│   │   │   │   ├── bp_fileops.py
│   │   │   │   ├── check_android_dir.py
│   │   │   │   ├── pubspec_replace.py
│   │   │   │   ├── replace_android_id.py
│   │   │   │   ├── replace_macos_xcschemes.py
│   │   │   │   ├── replace_res_android.py
│   │   │   │   └── replace_up_android.py
│   │   │   ├── tools/
│   │   │   │   ├── bp_icons.py
│   │   │   │   ├── create_app_name.py
│   │   │   │   ├── file_tool.py
│   │   │   │   ├── find_app_name.py
│   │   │   │   ├── find_gradle_file_id.py
│   │   │   │   ├── find_macos_xcschemes.py
│   │   │   │   ├── find_res_by_build_dir.py
│   │   │   │   ├── ignore_res_image.py
│   │   │   │   ├── images_tool.py
│   │   │   │   ├── parse_pubspec.py
│   │   │   │   ├── ppath_tool.py
│   │   │   │   ├── pyprint.py
│   │   │   │   └── str_tool.py
│   │   │   └── main.py
│   │   ├── BCommon.ps1
│   │   ├── BGVar.ps1
│   │   ├── build_app.ps1
│   │   ├── build_release.ps1
│   │   └── prebuild_app.ps1
│   ├── dev/
│   │   ├── startDebugByPhone.ps1
│   │   ├── startDebugByPhoneEn.ps1
│   │   ├── startDebugByPhoneZh.ps1
│   │   ├── startDevByWin.ps1
│   │   ├── startDevByWinEn.ps1
│   │   └── startDevByWinZh.ps1
│   └── img_resolve/
│       ├── create_assets.py
│       ├── icon_cutprocess.py
│       ├── print_res_tree.py
│       ├── process_launch_image.py
│       └── remove_self_res.py
├── test/
│   └── widget_test.dart
├── CHANGELOG.md
├── README.md
├── generate_tree.py
├── lib_structure.md
├── pubspec.lock
├── realPhoneDebug.bat
├── unixStart.sh
├── winStart.bat
├── 5 .yaml files
├── update-aichat.zip
├── update-y.zip
└── update1-top.zip
```

---
*Generated by Directory Tree Generator*