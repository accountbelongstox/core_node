# Directory Tree: lib

**Path:** `D:\programing\core_node\poly_apps\flutter_bloom\lib`

```
lib/
├── apps/
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
│   │   │   └── bank_public_api_service.dart
│   │   ├── settings_app_bank/
│   │   │   └── settings_app_bank.dart
│   │   ├── widgets_app_bank/
│   │   │   ├── bank_app_bar.dart
│   │   │   ├── bank_custom_button.dart
│   │   │   └── bank_custom_card.dart
│   │   ├── app_bank_tree.md
│   │   ├── build_config.ini
│   │   └── main_app_bank.dart
├── common/
│   ├── app/
│   │   └── main_common.dart
│   ├── assets/
│   │   ├── common_assets_icons.dart
│   │   ├── common_assets_images.dart
│   │   └── common_assets_launch.dart
│   ├── auth/
│   ├── cache_manager/
│   │   └── cache_manager.dart
│   ├── constants/
│   │   └── app_constants.dart
│   ├── controller/
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
│   │   ├── controller/
│   │   │   └── auth_controller.dart
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
│   │   │   ├── PHASE4_AUTH_AND_FINAL_CLEANUP.md
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
│   │   │   └── api_response.dart
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
│   │   ├── websocket/
│   │   │   ├── WEBSOCKET_USAGE.dart
│   │   │   ├── websocket_client.dart
│   │   │   ├── websocket_config.dart
│   │   │   ├── websocket_interceptor.dart
│   │   │   └── websocket_types.dart
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
│   ├── widgets/
│   │   ├── custom_swipable_button/
│   │   │   ├── swipeable_button_view.dart
│   │   │   └── swipeable_widget.dart
│   │   ├── action_bar.dart
│   │   ├── animated_custom_dialog.dart
│   │   ├── back_app_bar.dart
│   │   ├── bank_bottom_navigation.dart
│   │   ├── bank_scaffold.dart
│   │   ├── config.dart
│   │   ├── confirmation_dialog.dart
│   │   ├── country_picker.dart
│   │   ├── custom_app_bar.dart
│   │   ├── custom_bottom_navigation.dart
│   │   ├── custom_button.dart
│   │   ├── custom_calender.dart
│   │   ├── custom_card.dart
│   │   ├── custom_date_picker.dart
│   │   ├── custom_delegate.dart
│   │   ├── custom_divider.dart
│   │   ├── custom_drawer.dart
│   │   ├── custom_drop_down_item.dart
│   │   ├── custom_gradient_text.dart
│   │   ├── custom_icon_label.dart
│   │   ├── custom_icon_label_group.dart
│   │   ├── custom_image.dart
│   │   ├── custom_image_icon_label.dart
│   │   ├── custom_image_icon_label_group.dart
│   │   ├── custom_loader.dart
│   │   ├── custom_search_input.dart
│   │   ├── custom_slider_button.dart
│   │   ├── custom_snackbar.dart
│   │   ├── custom_text_field.dart
│   │   ├── custom_title.dart
│   │   ├── digital_payment_dialog.dart
│   │   ├── enhanced_bottom_navigation.dart
│   │   ├── enhanced_top_menu.dart
│   │   ├── image_dialog.dart
│   │   ├── navigation_widgets.dart
│   │   ├── network_connection_dialog.dart
│   │   ├── no_data_screen.dart
│   │   ├── open_map.dart
│   │   ├── outelineborder.dart
│   │   ├── paginated_list_view.dart
│   │   ├── payment_item_info.dart
│   │   ├── responsive_layout.dart
│   │   ├── segmented_button.dart
│   │   ├── settings_page_example.dart
│   │   └── type_button_widget.dart
│   └── common_tree.md
├── lib_tree.md
└── main.dart
```

---
*Generated by Directory Tree Generator*