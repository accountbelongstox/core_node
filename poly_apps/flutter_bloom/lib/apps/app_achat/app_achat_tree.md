# Directory Tree: app_achat

**Path:** `D:\programing\core_node\poly_apps\flutter_bloom\lib\apps\app_achat`

```
app_achat/
├── config_app_achat/
│   ├── api_config_achat.dart
│   ├── app_config.dart
│   ├── constants.dart
│   ├── prefs_app_achat.dart
│   ├── provider_app_achat.dart
│   └── storage_app_achat.dart
├── controller_app_achat/
│   ├── auth_controller_app_achat.dart
│   ├── proxy_settings_controller.dart
│   ├── settings_controller_app_achat.dart
│   └── settings_controller_persistent.dart
├── features_app_achat/
│   ├── add_contacts/
│   │   ├── controllers/
│   │   │   └── add_contacts_controller.dart
│   │   ├── models/
│   │   │   └── contact_option_model.dart
│   │   ├── views/
│   │   │   └── add_contacts_screen.dart
│   │   └── widgets/
│   │       └── contact_option_item.dart
│   ├── app_lock/
│   │   ├── controllers/
│   │   │   └── app_lock_controller.dart
│   │   ├── views/
│   │   │   └── app_lock_screen.dart
│   │   └── widgets/
│   │       └── app_lock_settings_list.dart
│   ├── chat_details/
│   │   ├── controllers/
│   │   │   └── chat_details_controller.dart
│   │   ├── domain/
│   │   │   ├── model/
│   │   │   │   └── chat_message_model.dart
│   │   │   └── service/
│   │   │       └── chat_details_service.dart
│   │   ├── views/
│   │   │   └── chat_details_screen.dart
│   │   └── widgets/
│   │       ├── chat_details_app_bar.dart
│   │       └── chat_details_widgets.dart
│   ├── chat_home/
│   │   ├── controllers/
│   │   │   └── chat_controller_app_achat.dart
│   │   └── views/
│   │       └── chat_home_screen.dart
│   ├── chat_list/
│   │   ├── controllers/
│   │   │   └── chat_list_controller.dart
│   │   ├── domain/
│   │   │   ├── model/
│   │   │   │   └── chat_list_model.dart
│   │   │   └── service/
│   │   │       └── chat_list_service.dart
│   │   ├── views/
│   │   │   └── chat_list_screen.dart
│   │   └── widgets/
│   │       ├── chat_list_appbar.dart
│   │       ├── chat_list_item.dart
│   │       └── chat_search_bar.dart
│   ├── common_widgets/
│   │   └── bottom_navigation/
│   │       ├── achat_bottom_navigation.dart
│   │       └── common_bottom_navigation.dart
│   ├── contacts/
│   │   ├── controllers/
│   │   │   └── contacts_controller.dart
│   │   ├── models/
│   │   │   └── contact_model.dart
│   │   └── views/
│   │       └── contacts_screen.dart
│   ├── create_group/
│   │   ├── controllers/
│   │   │   └── create_group_controller.dart
│   │   ├── domain/
│   │   │   ├── model/
│   │   │   │   └── contact_model.dart
│   │   │   └── service/
│   │   │       └── contact_service.dart
│   │   ├── models/
│   │   │   └── contact_model.dart
│   │   └── views/
│   │       └── create_group_screen.dart
│   ├── discover/
│   │   ├── controllers/
│   │   │   └── discover_controller.dart
│   │   ├── views/
│   │   │   └── discover_screen.dart
│   │   └── widgets/
│   │       ├── discover_app_bar.dart
│   │       ├── discover_item_card.dart
│   │       └── discover_section_header.dart
│   ├── group_chat/
│   │   ├── domain/
│   │   │   ├── model/
│   │   │   │   └── chat_message_model.dart
│   │   │   └── service/
│   │   │       └── chat_service.dart
│   │   ├── views/
│   │   │   └── group_chat_screen.dart
│   │   └── widgets/
│   │       ├── chat_input_bar.dart
│   │       ├── chat_message_list.dart
│   │       └── group_chat_appbar.dart
│   ├── home/
│   │   └── views/
│   │       └── home_screen.dart
│   ├── language_settings/
│   │   └── views/
│   │       └── language_settings_screen.dart
│   ├── new_chat/
│   │   ├── controllers/
│   │   │   └── new_chat_controller.dart
│   │   ├── models/
│   │   │   └── new_chat_contact_model.dart
│   │   └── views/
│   │       └── new_chat_screen.dart
│   ├── notification_setting/
│   │   ├── controllers/
│   │   │   └── notification_setting_controller.dart
│   │   ├── domain/
│   │   │   ├── model/
│   │   │   │   └── notification_setting_model.dart
│   │   │   └── service/
│   │   │       └── notification_setting_service.dart
│   │   ├── views/
│   │   │   └── notification_setting_screen.dart
│   │   └── widgets/
│   │       ├── notification_setting_card.dart
│   │       └── notification_setting_list.dart
│   ├── privacy_security/
│   │   ├── domain/
│   │   │   ├── model/
│   │   │   │   └── privacy_security_model.dart
│   │   │   └── service/
│   │   │       └── privacy_security_service.dart
│   │   ├── views/
│   │   │   └── privacy_security_screen.dart
│   │   └── widgets/
│   │       └── privacy_security_list.dart
│   ├── profile/
│   │   ├── domain/
│   │   │   ├── model/
│   │   │   │   └── profile_model.dart
│   │   │   └── service/
│   │   │       └── profile_service.dart
│   │   ├── views/
│   │   │   └── profile_screen.dart
│   │   └── widgets/
│   │       ├── profile_header.dart
│   │       └── profile_menu.dart
│   ├── proxy_settings/
│   │   ├── views/
│   │   │   └── proxy_settings_screen.dart
│   │   └── widgets/
│   │       └── proxy_setting_card.dart
│   ├── qr_profile/
│   │   ├── controllers/
│   │   │   └── qr_profile_controller.dart
│   │   ├── models/
│   │   │   └── qr_profile_model.dart
│   │   └── views/
│   │       └── qr_profile_screen.dart
│   └── test_backend/
│       └── test_backend_page.dart
├── localization_app_achat/
│   ├── en_app_achat.dart
│   ├── localization_keys_app_achat.dart
│   └── zh_app_achat.dart
├── model_app_achat/
│   ├── chat_item_model.dart
│   └── user_model.dart
├── models/
│   ├── chat_models.dart
│   ├── message_models.dart
│   └── user_models.dart
├── models_app_achat/
│   ├── discover_item_model.dart
│   └── user_model_app_achat.dart
├── network/
│   ├── achat_api_client.dart
│   └── achat_websocket_client.dart
├── repositories_app_achat/
│   └── achat_repository.dart
├── resources_app_achat/
│   ├── assets_icons_app_achat.dart
│   └── assets_images_app_achat.dart
├── router_app_achat/
│   └── router_app_achat.dart
├── services_app_achat/
│   └── achat_service.dart
├── settings_app_achat/
│   └── settings_app_achat.dart
├── storage/
│   └── achat_storage_manager.dart
├── utils_app_achat/
│   ├── app_utils.dart
│   └── test_data_generator.dart
├── build_config.ini
└── main_app_achat.dart
```

---
*Generated by Directory Tree Generator*