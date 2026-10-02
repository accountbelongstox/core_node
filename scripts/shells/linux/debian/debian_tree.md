# Directory Tree: debian

**Path:** `/www/programing/core_node/scripts/shells/linux/debian`

```
debian/
├── callbacks/
│   ├── post_domain_setup_diagnostics.sh
│   └── setup_codex_config.sh
├── debian_com/
│   ├── 175_laravel_main_service_frankenphp.sh
│   ├── 175_laravel_main_service_nginx.sh
│   ├── 175_laravel_main_start_frankenphp.sh
│   ├── 175_laravel_main_start_nginx.sh
│   ├── 175_laravel_main_start_npx_fallback.sh
│   ├── 175_laravel_main_start_php_serve.sh
│   ├── desktop_application_entry.sh
│   ├── desktop_entry_manager.sh
│   ├── example_script_with_metadata.sh
│   ├── hosts_manager.sh
│   ├── laravel_runtime_frankenphp.sh
│   ├── laravel_runtime_nginx.sh
│   ├── laravel_start_service.sh
│   ├── laravel_upgrade_13.sh
│   ├── natgateway_monitor.sh
│   ├── npm_cleanup_helper.sh
│   ├── npm_permission_fixer.sh
│   ├── npm_pre_install_checker.sh
│   ├── package_conflict_resolver.sh
│   ├── php_common_functions.sh
│   ├── php_common_vars.sh
│   ├── shared_python_setup.sh
│   ├── simple_download_manager.sh
│   ├── super_launch_helper.sh
│   └── vscode_cursor_config.sh
├── install_shells/
│   ├── 1_stop_cloud_monitors.sh
│   ├── 3_setting_base.sh
│   ├── 5_system_maintenance.sh
│   ├── 7_project_validator.sh
│   ├── 9_fix_dns.sh
│   ├── 10_install_chinese_wubi.sh
│   ├── 11_cuda_nvidia_prereq.sh
│   ├── 13_install_default_python.sh
│   ├── 14_install_python310.sh
│   ├── 15_install_default_python_prereq_packages.sh
│   ├── 17_install_node_toolchain_26.sh
│   ├── 19_install_default_pipx.sh
│   ├── 21_install_default_poetry.sh
│   ├── 23_setup_ssh_remote.sh
│   ├── 25_install_uv.sh
│   ├── 27_install_git_ssh.sh
│   ├── 29_install_edge_tts.sh
│   ├── 31_install_tts_offline.sh
│   ├── 33_install_nginx.sh
│   ├── 35_install_certbot.sh
│   ├── 37_ensure_pnpm_packages.sh
│   ├── 39_ensure_npmrc.sh
│   ├── 41_install_browsers.sh
│   ├── 55_install_puppeteer_plugins.sh
│   ├── 57_install_dotnet.sh
│   ├── 59_install_flutter.sh
│   ├── 61_install_android_studio.sh
│   ├── 63_install_ittools_binaries.sh
│   ├── 65_install_ruby.sh
│   ├── 67_install_rust.sh
│   ├── 69_install_p7zip.sh
│   ├── 71_ensure_dragonfly_intelligent.sh
│   ├── 73_install_redis.sh
│   ├── 75_install_postgresql.sh
│   ├── 79_install_docker.sh
│   ├── 83_docker-compose-finish.sh
│   ├── 85_install_mysql.sh
│   ├── 87_install_shama.sh
│   ├── 91_install_golang.sh
│   ├── 92_install_java.sh
│   ├── 93_install_php.sh
│   ├── 97_install_tailscale.sh
│   ├── 98_install_headscale_server.sh
│   ├── 99_install_ai_tools.sh
│   ├── 101_core_node_finish.sh
│   ├── 103_install_code_server.sh
│   ├── 105_install_deepseek.sh
│   ├── 107_install_deepseek_ocr.sh
│   ├── 109_install_qwen25.sh
│   ├── 111_install_nllb200.sh
│   ├── 113_natgateway.sh
│   ├── 115_install_ffmpeg.sh
│   ├── 119_install_launcher.sh
│   ├── 121_install_document_parsing.sh
│   ├── 123_install_dictionaries.sh
│   ├── 125_install_ocr.sh
│   ├── 127_install_whisper.sh
│   ├── 129_install_vosk.sh
│   ├── 131_install_chattts.sh
│   ├── 133_install_cosyvoice.sh
│   ├── 135_install_f5tts.sh
│   ├── 137_install_gptsovits.sh
│   ├── 139_install_melotts.sh
│   ├── 141_install_bark.sh
│   ├── 143_install_fishspeech.sh
│   ├── 145_install_kokoro.sh
│   ├── 147_install_voxcpm2.sh
│   ├── 149_install_device_tools.sh
│   ├── 151_install_faster_whisper.sh
│   ├── 153_install_desktop_applications.sh
│   ├── 154_repair_desktop_icons.sh
│   ├── 155_install_ides.sh
│   ├── 159_install_gitea.sh
│   ├── 161_install_rustdesk_client_1.4.4.sh
│   ├── 163_setup_gnome_rdp.sh
│   ├── 167_install_wechat.sh
│   ├── 169_install_rustdesk_server_1.1.14.sh
│   ├── 175_laravel_main_start.sh
│   ├── 176_laravel_ui_service.sh
│   ├── 181_install_parler.sh
│   ├── 183_install_qwen3tts.sh
│   ├── 187_install_android_sdk.sh
│   ├── 189_install_pycore_http_service.sh
│   ├── 191_install_octane_watcher_daemon.sh
│   ├── 193_install_window_launcher_shortcut.sh
│   ├── 195_install_remmina.sh
│   ├── 197_install_frontend_packages.sh
│   ├── 999_check_circular_symlinks.sh
│   ├── apply_tts_docker_for_engine.sh
│   ├── docker_model_runner.sh
│   ├── ensure_docker_for_tts.sh
│   └── upgrade_os_to_latest.sh
├── run_apps/
│   ├── install_app_to_service.sh
│   ├── run_app.sh
│   └── run_app_runtimes.sh
├── server_manager/
│   ├── docker_manager.sh
│   ├── laravel_octane_manager.sh
│   ├── mysql_manager.sh
│   ├── postgresql_manager.sh
│   ├── pycore_manager.sh
│   ├── redis_manager.sh
│   ├── rustdesk_install_info.sh
│   ├── rustdesk_list_clients.sh
│   ├── ssh_manager.sh
│   ├── ufw_ssh_blacklist.sh
│   ├── xrdp_monitor.sh
│   └── xrdp_monitor_view.sh
└── install.sh
```

---
