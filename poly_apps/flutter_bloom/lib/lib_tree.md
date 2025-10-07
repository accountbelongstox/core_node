# Directory Tree: lib

**Path:** `D:\programing\core_node\poly_apps\flutter_bloom\lib`

```
lib/
├── apps/
│   ├── app_achat/
│   │   ├── config_app_achat/
│   │   │   ├── api_config_achat.dart
│   │   │   ├── app_config.dart
│   │   │   ├── constants.dart
│   │   │   ├── prefs_app_achat.dart
│   │   │   ├── provider_app_achat.dart
│   │   │   └── storage_app_achat.dart
│   │   ├── controller_app_achat/
│   │   │   ├── auth_controller_app_achat.dart
│   │   │   ├── proxy_settings_controller.dart
│   │   │   ├── settings_controller_app_achat.dart
│   │   │   └── settings_controller_persistent.dart
│   │   ├── features_app_achat/
│   │   │   ├── add_contacts/
│   │   │   │   ├── controllers/
│   │   │   │   │   └── add_contacts_controller.dart
│   │   │   │   ├── models/
│   │   │   │   │   └── contact_option_model.dart
│   │   │   │   ├── views/
│   │   │   │   │   └── add_contacts_screen.dart
│   │   │   │   └── widgets/
│   │   │   │       └── contact_option_item.dart
│   │   │   ├── app_lock/
│   │   │   │   ├── controllers/
│   │   │   │   │   └── app_lock_controller.dart
│   │   │   │   ├── views/
│   │   │   │   │   └── app_lock_screen.dart
│   │   │   │   └── widgets/
│   │   │   │       └── app_lock_settings_list.dart
│   │   │   ├── chat_details/
│   │   │   │   ├── controllers/
│   │   │   │   │   └── chat_details_controller.dart
│   │   │   │   ├── domain/
│   │   │   │   │   ├── model/
│   │   │   │   │   │   └── chat_message_model.dart
│   │   │   │   │   └── service/
│   │   │   │   │       └── chat_details_service.dart
│   │   │   │   ├── views/
│   │   │   │   │   └── chat_details_screen.dart
│   │   │   │   └── widgets/
│   │   │   │       ├── chat_details_app_bar.dart
│   │   │   │       └── chat_details_widgets.dart
│   │   │   ├── chat_home/
│   │   │   │   ├── controllers/
│   │   │   │   │   └── chat_controller_app_achat.dart
│   │   │   │   └── views/
│   │   │   │       └── chat_home_screen.dart
│   │   │   ├── chat_list/
│   │   │   │   ├── controllers/
│   │   │   │   │   └── chat_list_controller.dart
│   │   │   │   ├── domain/
│   │   │   │   │   ├── model/
│   │   │   │   │   │   └── chat_list_model.dart
│   │   │   │   │   └── service/
│   │   │   │   │       └── chat_list_service.dart
│   │   │   │   ├── views/
│   │   │   │   │   └── chat_list_screen.dart
│   │   │   │   └── widgets/
│   │   │   │       ├── chat_list_appbar.dart
│   │   │   │       ├── chat_list_item.dart
│   │   │   │       └── chat_search_bar.dart
│   │   │   ├── common_widgets/
│   │   │   │   └── bottom_navigation/
│   │   │   │       ├── achat_bottom_navigation.dart
│   │   │   │       └── common_bottom_navigation.dart
│   │   │   ├── contacts/
│   │   │   │   ├── controllers/
│   │   │   │   │   └── contacts_controller.dart
│   │   │   │   ├── models/
│   │   │   │   │   └── contact_model.dart
│   │   │   │   └── views/
│   │   │   │       └── contacts_screen.dart
│   │   │   ├── create_group/
│   │   │   │   ├── controllers/
│   │   │   │   │   └── create_group_controller.dart
│   │   │   │   ├── domain/
│   │   │   │   │   ├── model/
│   │   │   │   │   │   └── contact_model.dart
│   │   │   │   │   └── service/
│   │   │   │   │       └── contact_service.dart
│   │   │   │   ├── models/
│   │   │   │   │   └── contact_model.dart
│   │   │   │   └── views/
│   │   │   │       └── create_group_screen.dart
│   │   │   ├── discover/
│   │   │   │   ├── controllers/
│   │   │   │   │   └── discover_controller.dart
│   │   │   │   ├── views/
│   │   │   │   │   └── discover_screen.dart
│   │   │   │   └── widgets/
│   │   │   │       ├── discover_app_bar.dart
│   │   │   │       ├── discover_item_card.dart
│   │   │   │       └── discover_section_header.dart
│   │   │   ├── group_chat/
│   │   │   │   ├── domain/
│   │   │   │   │   ├── model/
│   │   │   │   │   │   └── chat_message_model.dart
│   │   │   │   │   └── service/
│   │   │   │   │       └── chat_service.dart
│   │   │   │   ├── views/
│   │   │   │   │   └── group_chat_screen.dart
│   │   │   │   └── widgets/
│   │   │   │       ├── chat_input_bar.dart
│   │   │   │       ├── chat_message_list.dart
│   │   │   │       └── group_chat_appbar.dart
│   │   │   ├── home/
│   │   │   │   └── views/
│   │   │   │       └── home_screen.dart
│   │   │   ├── language_settings/
│   │   │   │   └── views/
│   │   │   │       └── language_settings_screen.dart
│   │   │   ├── new_chat/
│   │   │   │   ├── controllers/
│   │   │   │   │   └── new_chat_controller.dart
│   │   │   │   ├── models/
│   │   │   │   │   └── new_chat_contact_model.dart
│   │   │   │   └── views/
│   │   │   │       └── new_chat_screen.dart
│   │   │   ├── notification_setting/
│   │   │   │   ├── controllers/
│   │   │   │   │   └── notification_setting_controller.dart
│   │   │   │   ├── domain/
│   │   │   │   │   ├── model/
│   │   │   │   │   │   └── notification_setting_model.dart
│   │   │   │   │   └── service/
│   │   │   │   │       └── notification_setting_service.dart
│   │   │   │   ├── views/
│   │   │   │   │   └── notification_setting_screen.dart
│   │   │   │   └── widgets/
│   │   │   │       ├── notification_setting_card.dart
│   │   │   │       └── notification_setting_list.dart
│   │   │   ├── privacy_security/
│   │   │   │   ├── domain/
│   │   │   │   │   ├── model/
│   │   │   │   │   │   └── privacy_security_model.dart
│   │   │   │   │   └── service/
│   │   │   │   │       └── privacy_security_service.dart
│   │   │   │   ├── views/
│   │   │   │   │   └── privacy_security_screen.dart
│   │   │   │   └── widgets/
│   │   │   │       └── privacy_security_list.dart
│   │   │   ├── profile/
│   │   │   │   ├── domain/
│   │   │   │   │   ├── model/
│   │   │   │   │   │   └── profile_model.dart
│   │   │   │   │   └── service/
│   │   │   │   │       └── profile_service.dart
│   │   │   │   ├── views/
│   │   │   │   │   └── profile_screen.dart
│   │   │   │   └── widgets/
│   │   │   │       ├── profile_header.dart
│   │   │   │       └── profile_menu.dart
│   │   │   ├── proxy_settings/
│   │   │   │   ├── views/
│   │   │   │   │   └── proxy_settings_screen.dart
│   │   │   │   └── widgets/
│   │   │   │       └── proxy_setting_card.dart
│   │   │   ├── qr_profile/
│   │   │   │   ├── controllers/
│   │   │   │   │   └── qr_profile_controller.dart
│   │   │   │   ├── models/
│   │   │   │   │   └── qr_profile_model.dart
│   │   │   │   └── views/
│   │   │   │       └── qr_profile_screen.dart
│   │   │   └── test_backend/
│   │   │       └── test_backend_page.dart
│   │   ├── localization_app_achat/
│   │   │   ├── en_app_achat.dart
│   │   │   ├── localization_keys_app_achat.dart
│   │   │   └── zh_app_achat.dart
│   │   ├── model_app_achat/
│   │   │   ├── chat_item_model.dart
│   │   │   └── user_model.dart
│   │   ├── models/
│   │   │   ├── chat_models.dart
│   │   │   ├── message_models.dart
│   │   │   └── user_models.dart
│   │   ├── models_app_achat/
│   │   │   ├── discover_item_model.dart
│   │   │   └── user_model_app_achat.dart
│   │   ├── network/
│   │   │   ├── achat_api_client.dart
│   │   │   └── achat_websocket_client.dart
│   │   ├── repositories_app_achat/
│   │   │   └── achat_repository.dart
│   │   ├── resources_app_achat/
│   │   │   ├── assets_icons_app_achat.dart
│   │   │   └── assets_images_app_achat.dart
│   │   ├── router_app_achat/
│   │   │   └── router_app_achat.dart
│   │   ├── services_app_achat/
│   │   │   └── achat_service.dart
│   │   ├── settings_app_achat/
│   │   │   └── settings_app_achat.dart
│   │   ├── storage/
│   │   │   └── achat_storage_manager.dart
│   │   ├── utils_app_achat/
│   │   │   ├── app_utils.dart
│   │   │   └── test_data_generator.dart
│   │   ├── build_config.ini
│   │   └── main_app_achat.dart
│   ├── app_bank/
│   │   ├── config_app_bank/
│   │   │   ├── api_config_app_bank.dart
│   │   │   ├── app_config_app_bank.dart
│   │   │   ├── bank_endpoint_config.dart
│   │   │   ├── bank_text_styles.dart
│   │   │   ├── constants.dart
│   │   │   ├── prefs_app_bank.dart
│   │   │   ├── provider_app_bank.dart
│   │   │   └── theme_config_app_bank.dart
│   │   ├── docs/
│   │   │   ├── homepage_image_requirements.txt
│   │   │   └── wealth_page_image_requirements.txt
│   │   ├── features_app_bank/
│   │   │   ├── account_overview/
│   │   │   │   └── views/
│   │   │   │       ├── account_detail_screen.dart
│   │   │   │       └── account_overview_screen.dart
│   │   │   ├── authentication/
│   │   │   │   └── views/
│   │   │   │       └── authentication_screen.dart
│   │   │   ├── card_management/
│   │   │   │   └── views/
│   │   │   │       ├── card_management_screen.dart
│   │   │   │       └── card_management_screen_enhanced.dart
│   │   │   ├── dashboard/
│   │   │   │   └── views/
│   │   │   │       └── dashboard_screen.dart
│   │   │   ├── debug/
│   │   │   │   └── views/
│   │   │   │       ├── debug_settings_screen.dart
│   │   │   │       ├── developer_feedback_screen.dart
│   │   │   │       ├── developer_tools_screen.dart
│   │   │   │       └── exclusive_customer_screen.dart
│   │   │   ├── help/
│   │   │   │   └── views/
│   │   │   │       └── help_screen.dart
│   │   │   ├── investment/
│   │   │   │   └── views/
│   │   │   │       ├── investment_screen.dart
│   │   │   │       └── investment_screen_enhanced.dart
│   │   │   ├── life/
│   │   │   │   └── views/
│   │   │   │       └── life_screen.dart
│   │   │   ├── loan/
│   │   │   │   └── views/
│   │   │   │       └── loan_screen.dart
│   │   │   ├── onboarding/
│   │   │   │   └── views/
│   │   │   │       └── onboarding_screen.dart
│   │   │   ├── payment/
│   │   │   │   └── views/
│   │   │   │       └── payment_screen.dart
│   │   │   ├── profile/
│   │   │   │   └── views/
│   │   │   │       └── profile_screen.dart
│   │   │   ├── security/
│   │   │   │   └── views/
│   │   │   │       └── security_screen.dart
│   │   │   ├── settings/
│   │   │   │   └── views/
│   │   │   │       └── settings_screen.dart
│   │   │   ├── splash/
│   │   │   │   └── views/
│   │   │   │       └── splash_screen.dart
│   │   │   ├── transaction_history/
│   │   │   │   └── views/
│   │   │   │       └── transaction_history_screen.dart
│   │   │   └── transfer/
│   │   │       └── views/
│   │   │           └── transfer_screen.dart
│   │   ├── helpers/
│   │   │   └── bank_app_initializer.dart
│   │   ├── localization_app_bank/
│   │   │   ├── en_app_bank.dart
│   │   │   ├── localization_keys_app_bank.dart
│   │   │   └── zh_app_bank.dart
│   │   ├── managers_app_bank/
│   │   │   ├── app_lifecycle_manager.dart
│   │   │   └── user_manager.dart
│   │   ├── models_app_bank/
│   │   │   ├── bank_global_data.dart
│   │   │   ├── bank_user_model.dart
│   │   │   └── user_model_app_bank.dart
│   │   ├── providers_app_bank/
│   │   │   └── bank_user_provider.dart
│   │   ├── resources_app_bank/
│   │   │   ├── assets_images_app_bank.dart
│   │   │   └── gradients_app_bank.dart
│   │   ├── router_app_bank/
│   │   │   └── router_app_bank.dart
│   │   ├── services_app_bank/
│   │   │   ├── bank_auth_api_service.dart
│   │   │   ├── bank_network_service.dart
│   │   │   ├── bank_network_v3_service.dart
│   │   │   └── bank_public_api_service.dart
│   │   ├── settings_app_bank/
│   │   │   └── settings_app_bank.dart
│   │   ├── widgets_app_bank/
│   │   │   ├── bank_app_bar.dart
│   │   │   ├── bank_custom_button.dart
│   │   │   └── bank_custom_card.dart
│   │   ├── build_config.ini
│   │   └── main_app_bank.dart
│   ├── app_example/
│   │   ├── config_app_example/
│   │   │   ├── api_config_app_example.dart
│   │   │   ├── api_data_models_app_example.dart
│   │   │   ├── api_endpoints_app_example.dart
│   │   │   ├── app_config_app_example.dart
│   │   │   ├── constants_app_example.dart
│   │   │   ├── prefs_app_example.dart
│   │   │   ├── provider_app_example.dart
│   │   │   ├── storage_app_example.dart
│   │   │   └── storage_initialization_example.dart
│   │   ├── controller_app_example/
│   │   │   ├── auth_controller_app_example.dart
│   │   │   ├── profile_controller_app_example.dart
│   │   │   ├── settings_controller_app_example.dart
│   │   │   └── splash_controller_app_example.dart
│   │   ├── features_app_example/
│   │   │   ├── about/
│   │   │   │   ├── actions/
│   │   │   │   └── about_screen.dart
│   │   │   ├── authentication/
│   │   │   │   ├── actions/
│   │   │   │   │   └── auth_actions.dart
│   │   │   │   └── views/
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
│   │   │   │   │   └── home_bar.dart
│   │   │   │   ├── home_widget/
│   │   │   │   │   ├── tab_widget.dart
│   │   │   │   │   └── top_section.dart
│   │   │   │   ├── settings_item/
│   │   │   │   │   ├── settings_arrow_item.dart
│   │   │   │   │   ├── settings_badge_item.dart
│   │   │   │   │   ├── settings_dropdown_item.dart
│   │   │   │   │   ├── settings_group.dart
│   │   │   │   │   └── settings_switch_item.dart
│   │   │   │   └── route_navigation_example.dart
│   │   │   ├── dashboard/
│   │   │   │   ├── actions/
│   │   │   │   ├── models/
│   │   │   │   │   └── navigation_model.dart
│   │   │   │   ├── views/
│   │   │   │   │   ├── dashboard_screen.dart
│   │   │   │   │   └── inbox_screen.dart
│   │   │   │   └── widgets/
│   │   │   │       └── appbar.dart
│   │   │   ├── donation/
│   │   │   │   ├── actions/
│   │   │   │   ├── domain/
│   │   │   │   │   └── model/
│   │   │   │   │       └── doantion_model.dart
│   │   │   │   └── views/
│   │   │   │       ├── donation_all_screen.dart
│   │   │   │       └── donation_screen.dart
│   │   │   ├── fundraising/
│   │   │   │   ├── actions/
│   │   │   │   ├── domain/
│   │   │   │   │   └── model/
│   │   │   │   │       ├── activity_model.dart
│   │   │   │   │       ├── fundraising_model.dart
│   │   │   │   │       └── my_fundraising_model.dart
│   │   │   │   ├── views/
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
│   │   │   │   ├── views/
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
│   │   │   │   ├── views/
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
│   │   │   │   ├── views/
│   │   │   │   │   └── home_login_view.dart
│   │   │   │   └── widget/
│   │   │   │       └── home_login_widget.dart
│   │   │   ├── inbox/
│   │   │   │   ├── actions/
│   │   │   │   ├── domain/
│   │   │   │   │   └── model/
│   │   │   │   │       └── inbox_model.dart
│   │   │   │   └── views/
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
│   │   │   │   └── views/
│   │   │   │       └── onbording_screen.dart
│   │   │   ├── prayer/
│   │   │   │   ├── actions/
│   │   │   │   └── prayer_screen.dart
│   │   │   ├── profile/
│   │   │   │   ├── actions/
│   │   │   │   ├── controllers/
│   │   │   │   │   └── profile_controller_app_example.dart
│   │   │   │   ├── domain/
│   │   │   │   │   └── model/
│   │   │   │   │       ├── about_model.dart
│   │   │   │   │       └── select_insterest_model.dart
│   │   │   │   ├── models/
│   │   │   │   │   └── profile_model_app_example.dart
│   │   │   │   └── views/
│   │   │   │       ├── edit_profile.dart
│   │   │   │       ├── profile_screen.dart
│   │   │   │       └── profile_view_screen.dart
│   │   │   ├── profile_two/
│   │   │   │   ├── actions/
│   │   │   │   ├── views/
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
│   │   │   │   ├── views/
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
│   │   │   │   ├── views/
│   │   │   │   │   └── social_feed_screen.dart
│   │   │   │   └── widget/
│   │   │   │       ├── feed_header.dart
│   │   │   │       └── post_card.dart
│   │   │   ├── splash/
│   │   │   │   ├── actions/
│   │   │   │   ├── views/
│   │   │   │   │   └── splash_screen.dart
│   │   │   │   └── widgets/
│   │   │   │       └── slide_to_start_button.dart
│   │   │   ├── tab/
│   │   │   │   ├── actions/
│   │   │   │   └── views/
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
│   │   │   │   └── views/
│   │   │   │       ├── word_card_screen.dart
│   │   │   │       └── word_card_style_test.dart
│   │   │   └── word_cards/
│   │   │       ├── actions/
│   │   │       ├── types/
│   │   │       │   └── words_types.dart
│   │   │       └── views/
│   │   │           └── word_cards_screen.dart
│   │   ├── localization_app_example/
│   │   │   ├── en_app_example.dart
│   │   │   ├── localization_keys_app_example.dart
│   │   │   └── zh_app_example.dart
│   │   ├── model_app_example/
│   │   │   └── user_model.dart
│   │   ├── resources_app_example/
│   │   │   ├── assets_icons_app_example.dart
│   │   │   ├── assets_images_app_example.dart
│   │   │   ├── assets_launch_app_example.dart
│   │   │   ├── test_file.dart
│   │   │   ├── text_styles_app_example.dart
│   │   │   └── theme_extensions_app_example.dart
│   │   ├── router_app_example/
│   │   │   ├── route_test_helper.dart
│   │   │   ├── router_app_example.dart
│   │   │   ├── router_legacy_qy.dart
│   │   │   └── routes_provider_app_example.dart
│   │   ├── services_app_example/
│   │   │   ├── app_example_service_manager.dart
│   │   │   ├── auth_api_app_example_service.dart
│   │   │   ├── product_api_app_example_service.dart
│   │   │   ├── service_app_example.dart
│   │   │   ├── services_app_example.dart
│   │   │   └── user_api_app_example_service.dart
│   │   ├── settings_app_example/
│   │   │   └── settings_app_example.dart
│   │   ├── utils_app_example/
│   │   │   └── utils_app_example.dart
│   │   ├── build_config.ini
│   │   └── main_app_example.dart
│   ├── app_main/
│   │   ├── config_app_main/
│   │   │   ├── app_config_app_main.dart
│   │   │   ├── prefs_app_main.dart
│   │   │   └── storage_app_main.dart
│   │   ├── features_app_main/
│   │   │   ├── all_apps_showcase/
│   │   │   │   ├── controllers/
│   │   │   │   │   └── all_apps_showcase_controller.dart
│   │   │   │   ├── models/
│   │   │   │   │   └── all_apps_showcase_model.dart
│   │   │   │   └── views/
│   │   │   │       └── all_apps_showcase_screen.dart
│   │   │   ├── main_about/
│   │   │   │   └── views/
│   │   │   │       └── main_about_screen.dart
│   │   │   ├── main_home/
│   │   │   │   └── views/
│   │   │   │       └── main_home_screen.dart
│   │   │   └── main_settings/
│   │   │       └── views/
│   │   │           └── main_settings_screen.dart
│   │   ├── localization_app_main/
│   │   │   ├── en_app_main.dart
│   │   │   ├── localization_keys_app_main.dart
│   │   │   └── zh_app_main.dart
│   │   ├── resources_app_main/
│   │   │   ├── assets_fonts_app_main.dart
│   │   │   ├── assets_icons_app_main.dart
│   │   │   ├── assets_images_app_main.dart
│   │   │   ├── assets_launch_app_main.dart
│   │   │   └── assets_manager_app_main.dart
│   │   ├── router_app_main/
│   │   │   └── routes_provider_app_main.dart
│   │   ├── apps_bootstrap_main.dart
│   │   ├── build_config.ini
│   │   ├── main_app_main.dart
│   │   └── provider_app_main.dart
│   └── app_wuy/
│       ├── config_app_wuy/
│       │   ├── api_config_app_wuy.dart
│       │   ├── api_data_models_app_wuy.dart
│       │   ├── api_endpoints_app_wuy.dart
│       │   ├── app_config_app_wuy.dart
│       │   ├── constants_app_wuy.dart
│       │   └── storage_app_wuy.dart
│       ├── controller_app_wuy/
│       │   └── settings_controller_app_wuy.dart
│       ├── doc/
│       │   ├── awuy.pdf
│       │   └── awuy.png
│       ├── features_app_wuy/
│       │   ├── authentication/
│       │   │   └── views/
│       │   │       └── login_screen.dart
│       │   ├── dashboard/
│       │   │   └── views/
│       │   │       └── dashboard_screen.dart
│       │   ├── home/
│       │   │   └── views/
│       │   │       └── home_screen.dart
│       │   ├── profile/
│       │   │   └── views/
│       │   │       └── profile_screen.dart
│       │   ├── settings/
│       │   │   └── views/
│       │   │       └── settings_screen.dart
│       │   └── splash/
│       │       └── views/
│       │           └── splash_screen.dart
│       ├── localization_app_wuy/
│       │   ├── en_app_wuy.dart
│       │   ├── locales_provider_app_wuy.dart
│       │   ├── localization_keys_app_wuy.dart
│       │   └── zh_app_wuy.dart
│       ├── models_app_wuy/
│       │   └── user_model_app_wuy.dart
│       ├── providers_app_wuy/
│       │   └── wu_user_provider.dart
│       ├── resources_app_wuy/
│       │   ├── assets_icons_app_wuy.dart
│       │   ├── assets_images_app_wuy.dart
│       │   └── assets_launch_app_wuy.dart
│       ├── router_app_wuy/
│       │   ├── router_app_wuy.dart
│       │   └── routes_provider_app_wuy.dart
│       ├── services_app_wuy/
│       │   └── wuy_service.dart
│       ├── settings_app_wuy/
│       │   └── settings_app_wuy.dart
│       ├── theme_app_wuy/
│       │   └── theme_config_app_wuy.dart
│       ├── utils_app_wuy/
│       │   └── app_info_app_wuy.dart
│       ├── build_config.ini
│       └── main_app_wuy.dart
├── common/
│   ├── app/
│   │   └── main_common.dart
│   ├── assets/
│   │   ├── common_assets_icons.dart
│   │   ├── common_assets_images.dart
│   │   └── common_assets_launch.dart
│   ├── auth/
│   │   └── auth_controller.dart
│   ├── cache_manager/
│   │   └── cache_manager.dart
│   ├── constants/
│   │   └── app_constants.dart
│   ├── controller/
│   │   ├── auth_controller.dart
│   │   └── settings_controller.dart
│   ├── database/
│   │   ├── idb/
│   │   │   └── idb_service.dart
│   │   ├── interfaces/
│   │   │   └── database_interface.dart
│   │   ├── models/
│   │   │   └── base_model.dart
│   │   ├── sqlite/
│   │   │   └── sqlite_service.dart
│   │   └── database_manager.dart
│   ├── iframe/
│   │   └── iframe_listner.dart
│   ├── localization/
│   │   ├── common_en.dart
│   │   ├── common_zh.dart
│   │   ├── localization_keys.dart
│   │   ├── localization_manager.dart
│   │   └── map_locales.dart
│   ├── map/
│   │   ├── location_service.dart
│   │   ├── map_service.dart
│   │   └── map_utils.dart
│   ├── media/
│   │   ├── audio/
│   │   │   ├── audio_player.dart
│   │   │   └── audio_recorder.dart
│   │   ├── video/
│   │   │   ├── video_player.dart
│   │   │   └── video_recorder.dart
│   │   └── media_utils.dart
│   ├── model/
│   │   ├── bank_user_model.dart
│   │   ├── messages.dart
│   │   └── word_list_types.dart
│   ├── network/
│   │   ├── auth/
│   │   │   └── unified_auth_manager.dart
│   │   ├── core/
│   │   │   ├── endpoint_network_models.dart
│   │   │   ├── network_config.dart
│   │   │   ├── network_queue_and_offline.dart
│   │   │   ├── network_retry_manager.dart
│   │   │   ├── network_service_locator.dart
│   │   │   ├── network_types.dart
│   │   │   └── unified_network_client.dart
│   │   ├── doc/
│   │   │   ├── ARCHITECTURE_ANALYSIS.md
│   │   │   ├── AUTH_INTERCEPTOR_INTEGRATION.md
│   │   │   ├── FINAL_STATUS_REPORT.md
│   │   │   ├── INDEX.md
│   │   │   ├── PHASE2_REFACTORING.md
│   │   │   ├── PHASE3_AGGRESSIVE_CLEANUP.md
│   │   │   ├── PHASE3_COMPLETION.md
│   │   │   ├── REFACTORING_LOG.md
│   │   │   └── REFACTORING_SUMMARY.md
│   │   ├── endpoints/
│   │   │   ├── endpoint_config.dart
│   │   │   └── laravel_endpoints.dart
│   │   ├── integration/
│   │   │   └── network_user_integration.dart
│   │   ├── interceptors/
│   │   │   ├── auth_interceptor.dart
│   │   │   ├── error_interceptor.dart
│   │   │   ├── logging_interceptor.dart
│   │   │   └── network_interceptors.dart
│   │   ├── models/
│   │   │   ├── api_config.dart
│   │   │   ├── api_response.dart
│   │   │   └── enhanced_api_response.dart
│   │   ├── parsers/
│   │   │   └── adaptive_data_parser.dart
│   │   ├── security/
│   │   │   └── device_security_manager.dart
│   │   ├── services/
│   │   │   └── advanced_network_service.dart
│   │   ├── storage/
│   │   │   └── secure_storage.dart
│   │   ├── ui/
│   │   │   └── global_loading_system.dart
│   │   ├── utils/
│   │   │   └── network_utils.dart
│   │   ├── widgets/
│   │   │   └── adaptive_loading_widgets.dart
│   │   ├── NETWORKREADME.md
│   │   └── network_framework.dart
│   ├── network_v2/
│   │   ├── auth/
│   │   │   ├── auth_coordinator.dart
│   │   │   ├── auth_registry.dart
│   │   │   ├── auth_strategy.dart
│   │   │   ├── composite_auth_strategy.dart
│   │   │   ├── header_key_auth_strategy.dart
│   │   │   ├── jwt_auth_strategy.dart
│   │   │   ├── login_manager.dart
│   │   │   ├── session_auth_strategy.dart
│   │   │   └── user_provider_auth_coordinator.dart
│   │   ├── cache/
│   │   │   ├── cache_entry.dart
│   │   │   ├── cache_store.dart
│   │   │   └── memory_cache_store.dart
│   │   ├── core/
│   │   │   ├── http_client.dart
│   │   │   └── network_manager.dart
│   │   ├── endpoints/
│   │   │   ├── endpoint_catalog.dart
│   │   │   └── endpoint_presets.dart
│   │   ├── loading/
│   │   │   ├── loading_controller.dart
│   │   │   └── loading_state.dart
│   │   ├── models/
│   │   │   ├── auth_context.dart
│   │   │   ├── auth_payload.dart
│   │   │   ├── auth_requirement.dart
│   │   │   ├── cache_policy.dart
│   │   │   ├── endpoint_descriptor.dart
│   │   │   ├── endpoint_group.dart
│   │   │   ├── http_method.dart
│   │   │   ├── network_environment.dart
│   │   │   ├── network_error.dart
│   │   │   ├── network_request.dart
│   │   │   ├── network_response.dart
│   │   │   ├── network_session_state.dart
│   │   │   ├── request_options.dart
│   │   │   └── retry_policy.dart
│   │   ├── parsing/
│   │   │   ├── response_parser.dart
│   │   │   └── schema_registry.dart
│   │   ├── queue/
│   │   │   ├── queued_request.dart
│   │   │   └── request_queue.dart
│   │   ├── utils/
│   │   │   └── id_generator.dart
│   │   ├── README.md
│   │   ├── example_usage.dart
│   │   └── network_v2.dart
│   ├── provider_status/
│   │   ├── bank_user_provider.dart
│   │   ├── base_provider.dart
│   │   ├── screen_size_provider.dart
│   │   └── user_provider.dart
│   ├── repo/
│   │   └── splash_repo.dart
│   ├── settings/
│   │   ├── configs/
│   │   │   └── base_settings.dart
│   │   ├── models/
│   │   │   └── setting_item.dart
│   │   └── storage/
│   │       └── settings_storage_manager.dart
│   ├── storage/
│   │   ├── implementations/
│   │   │   └── hive_storage.dart
│   │   ├── interfaces/
│   │   │   └── storage_interface.dart
│   │   ├── models/
│   │   │   └── storage_models.dart
│   │   ├── app_prefs_base.dart
│   │   ├── app_storage.dart
│   │   ├── app_storage_base.dart
│   │   ├── storage_manager.dart
│   │   ├── storage_migration_tool.dart
│   │   ├── storage_provider.dart
│   │   ├── storage_usage_examples.dart
│   │   └── unified_storage.dart
│   ├── theme/
│   │   ├── base/
│   │   │   ├── theme_colors.dart
│   │   │   ├── theme_constants.dart
│   │   │   ├── theme_dimensions.dart
│   │   │   ├── theme_shadow.dart
│   │   │   └── theme_text_styles.dart
│   │   ├── compatibility/
│   │   │   ├── gradient_compatibility.dart
│   │   │   └── theme_compatibility.dart
│   │   ├── extensions/
│   │   │   └── gradient_extensions.dart
│   │   ├── platforms/
│   │   │   ├── desktop/
│   │   │   │   ├── desktop_dark_theme.dart
│   │   │   │   └── desktop_light_theme.dart
│   │   │   ├── mobile/
│   │   │   │   ├── mobile_dark_theme.dart
│   │   │   │   └── mobile_light_theme.dart
│   │   │   └── web/
│   │   │       ├── web_dark_theme.dart
│   │   │       └── web_light_theme.dart
│   │   └── theme_manager.dart
│   ├── utils/
│   │   ├── common/
│   │   │   ├── price_converter.dart
│   │   │   └── toaster_helper.dart
│   │   ├── compatibility/
│   │   │   └── legacy_imports.dart
│   │   ├── database/
│   │   │   └── cache_operations.dart
│   │   ├── date/
│   │   │   └── date_converter.dart
│   │   ├── display/
│   │   │   ├── display_helper.dart
│   │   │   └── responsive_helper.dart
│   │   ├── image/
│   │   │   ├── image_loader.dart
│   │   │   └── image_size_checker.dart
│   │   ├── mobile/
│   │   │   ├── native_splash.dart
│   │   │   └── notification_helper.dart
│   │   ├── platform/
│   │   │   └── get_platform.dart
│   │   ├── text/
│   │   │   └── text_utils.dart
│   │   ├── validation/
│   │   │   └── email_checker.dart
│   │   ├── web/
│   │   │   ├── web_tools.dart
│   │   │   ├── web_tools_non_web.dart
│   │   │   ├── web_tools_web.dart
│   │   │   └── webabs.dart
│   │   ├── device_utils.dart
│   │   └── utils.dart
│   └── widgets/
│       ├── custom_swipable_button/
│       │   ├── swipeable_button_view.dart
│       │   └── swipeable_widget.dart
│       ├── action_bar.dart
│       ├── animated_custom_dialog.dart
│       ├── back_app_bar.dart
│       ├── bank_bottom_navigation.dart
│       ├── bank_scaffold.dart
│       ├── config.dart
│       ├── confirmation_dialog.dart
│       ├── country_picker.dart
│       ├── custom_app_bar.dart
│       ├── custom_bottom_navigation.dart
│       ├── custom_button.dart
│       ├── custom_calender.dart
│       ├── custom_card.dart
│       ├── custom_date_picker.dart
│       ├── custom_delegate.dart
│       ├── custom_divider.dart
│       ├── custom_drawer.dart
│       ├── custom_drop_down_item.dart
│       ├── custom_gradient_text.dart
│       ├── custom_icon_label.dart
│       ├── custom_icon_label_group.dart
│       ├── custom_image.dart
│       ├── custom_image_icon_label.dart
│       ├── custom_image_icon_label_group.dart
│       ├── custom_loader.dart
│       ├── custom_search_input.dart
│       ├── custom_slider_button.dart
│       ├── custom_snackbar.dart
│       ├── custom_text_field.dart
│       ├── custom_title.dart
│       ├── digital_payment_dialog.dart
│       ├── enhanced_bottom_navigation.dart
│       ├── enhanced_top_menu.dart
│       ├── image_dialog.dart
│       ├── navigation_widgets.dart
│       ├── network_connection_dialog.dart
│       ├── no_data_screen.dart
│       ├── open_map.dart
│       ├── outelineborder.dart
│       ├── paginated_list_view.dart
│       ├── payment_item_info.dart
│       ├── responsive_layout.dart
│       ├── segmented_button.dart
│       ├── settings_page_example.dart
│       └── type_button_widget.dart
├── lib_tree.md
└── main.dart
```

---
*Generated by Directory Tree Generator*