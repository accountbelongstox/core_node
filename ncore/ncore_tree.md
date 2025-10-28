# Directory Tree: ncore

**Path:** `/mnt/dev_sdb3/programing/core_node/ncore`

```
ncore/
├── foundation/
│   ├── common/
│   │   ├── commander.js
│   │   ├── downloader.js
│   │   ├── encoding.js
│   │   └── logger.js
│   ├── db_utils/
│   │   ├── libs/
│   │   │   ├── mysql.js
│   │   │   ├── postgree.js
│   │   │   ├── redis.js
│   │   │   └── sqlite.js
│   │   ├── sequelize-libs/
│   │   │   ├── cache_coordinator.js
│   │   │   ├── sequelize_generate_model.js
│   │   │   ├── sequelize_pring.js
│   │   │   ├── sequelize_sync.js
│   │   │   ├── sequelize_tool.js
│   │   │   └── where_builder.js
│   │   ├── sequelize-oporate/
│   │   │   ├── sequelize_delete.js
│   │   │   ├── sequelize_has.js
│   │   │   ├── sequelize_insert.js
│   │   │   ├── sequelize_query.js
│   │   │   ├── sequelize_table.js
│   │   │   └── sequelize_update.js
│   │   ├── tools/
│   │   │   ├── migrate.js
│   │   │   ├── mysql_tool.js
│   │   │   ├── pg_tool.js
│   │   │   ├── sqlite_tool.js
│   │   │   └── sqlite_where_builder.js
│   │   ├── types/
│   │   │   ├── mysql_types.json
│   │   │   ├── sqlite_types.js
│   │   │   └── types_map.js
│   │   ├── main.js
│   │   └── sequelize_db.js
│   ├── express_utils/
│   │   ├── config/
│   │   │   ├── ConfigHelper.js
│   │   │   └── index.js
│   │   ├── libs/
│   │   │   ├── ExpressManager.js
│   │   │   ├── MiddlewareUtil.js
│   │   │   ├── RouterFinal.js
│   │   │   ├── RouterManager.js
│   │   │   ├── StaticServer.js
│   │   │   ├── UploadTools.js
│   │   │   ├── WsManager.js
│   │   │   ├── file_query.js
│   │   │   ├── res_helper.js
│   │   │   └── router_usage_example.js
│   │   ├── provider/
│   │   │   └── expressProvider.js
│   │   ├── template/
│   │   │   ├── static/
│   │   │   │   ├── scripts/
│   │   │   │   │   ├── 3.7.1.jquery.min.js
│   │   │   │   │   ├── interact.min.js
│   │   │   │   │   ├── log-console.js
│   │   │   │   │   ├── system_monitor.js
│   │   │   │   │   └── websocket-client.js
│   │   │   │   └── styles/
│   │   │   │       ├── index.css
│   │   │   │       ├── log-container.css
│   │   │   │       └── system_monitor_panel.css
│   │   │   ├── 403.html
│   │   │   ├── 404.html
│   │   │   └── index.html
│   │   ├── tool/
│   │   │   ├── reader.js
│   │   │   └── response.js
│   │   └── index.js
│   └── utilities/
│       ├── filetoollibs/
│       │   ├── dcopy.js
│       │   ├── fcopy.js
│       │   ├── fdir.js
│       │   ├── file.js
│       │   ├── flink.js
│       │   ├── fmonitor.js
│       │   ├── fnet.js
│       │   ├── fpath.js
│       │   ├── freader.js
│       │   ├── fstatus.js
│       │   ├── ftype.js
│       │   ├── fwriter.js
│       │   ├── index.js
│       │   ├── link.js
│       │   ├── movedir.js
│       │   └── pfile.js
│       ├── thread/
│       │   └── timer_worker.js
│       ├── zip-tool/
│       │   ├── best_compressor.js
│       │   ├── best_decompressor.js
│       │   ├── compressor_util.js
│       │   ├── task_constants.js
│       │   ├── task_executor.js
│       │   ├── task_index.js
│       │   ├── task_manager.js
│       │   └── task_zutils.js
│       ├── arrtool.js
│       ├── datetool.js
│       ├── filetool.js
│       ├── httptool.js
│       ├── index.js
│       ├── inspect.js
│       ├── jsontool.js
│       ├── mathtool.js
│       ├── parameter_tool.js
│       ├── platformtool.js
│       ├── plattool.js
│       ├── porttool.js
│       ├── process_on.js
│       ├── strtool.js
│       ├── sysargtool.js
│       └── urltool.js
├── global_vars/
│   ├── gcommon/
│   │   └── encyclopedia.js
│   ├── global_dir/
│   │   ├── binary_dir.js
│   │   └── globaldir.js
│   ├── libs/
│   │   ├── bdir-libs/
│   │   │   └── ensure_7zip.js
│   │   ├── app_config.js
│   │   ├── app_parameter.js
│   │   ├── config_tool.js
│   │   ├── env.js
│   │   ├── system_info.js
│   │   └── user_settings.js
│   ├── platform-constant/
│   │   ├── driver-provider.js
│   │   ├── driver.js
│   │   ├── index.js
│   │   └── package_map.js
│   ├── tool/
│   │   ├── common/
│   │   │   ├── cache_manager.js
│   │   │   ├── cmder.js
│   │   │   └── ffinder.js
│   │   ├── soft-install/
│   │   │   ├── linux-apt/
│   │   │   │   ├── apt_utils.js
│   │   │   │   ├── package_finder.js
│   │   │   │   ├── package_manager.js
│   │   │   │   ├── plist_map.js
│   │   │   │   └── pmanager_map.js
│   │   │   ├── win-soft/
│   │   │   │   └── software_finder.js
│   │   │   ├── winget/
│   │   │   │   ├── parse/
│   │   │   │   │   ├── winget_parse_list.js
│   │   │   │   │   ├── winget_parse_search.js
│   │   │   │   │   └── winget_parse_utils.js
│   │   │   │   └── winget.js
│   │   │   ├── executable_finder.js
│   │   │   └── index.js
│   │   └── gconfig.js
│   └── index.js
├── mcp_server/
│   ├── auto-context7-mcp/
│   │   ├── README.md
│   │   ├── auto_fix_context7.ps1
│   │   └── auto_fix_context7.sh
│   ├── codebase-scanner/
│   │   ├── tmp_sessions/
│   │   ├── constants.py
│   │   ├── main.py
│   │   ├── start_server.bat
│   │   └── start_server.py
│   ├── file_processor/
│   │   ├── cnocr_engine.py
│   │   ├── constants.py
│   │   ├── image_processor.py
│   │   ├── main.py
│   │   ├── ocr_config.py
│   │   ├── ocr_engines.py
│   │   ├── ocr_queue_system.py
│   │   ├── paddle_ocr_engine.py
│   │   └── pdf_processor.py
│   ├── mcp-alchemy/
│   │   ├── mcp_alchemy/
│   │   │   ├── __init__.py
│   │   │   └── server.py
│   │   ├── .gitignore
│   │   ├── ARCHITECTURE_REFACTORING_COMPLETE.md
│   │   ├── LICENSE
│   │   ├── Makefile
│   │   ├── README.md
│   │   ├── config.json
│   │   ├── constants.py
│   │   ├── main.py
│   │   ├── pyproject.toml
│   │   ├── requirements.txt
│   │   └── requirements_core.txt
│   ├── placeholder_image_generator/
│   │   ├── constants.py
│   │   └── main.py
│   └── wait_please/
│       ├── icons/
│       │   ├── icon-128.png
│       │   ├── icon-256.png
│       │   ├── icon-32.png
│       │   ├── icon-512.png
│       │   ├── icon.icns
│       │   ├── icon.ico
│       │   └── icon.png
│       ├── screenshots/
│       │   ├── popup.png
│       │   └── settings.png
│       ├── scripts/
│       │   └── dev.ps1
│       ├── src/
│       │   ├── frontend/
│       │   │   ├── assets/
│       │   │   │   └── styles/
│       │   │   │       └── style.css
│       │   │   ├── components/
│       │   │   │   ├── common/
│       │   │   │   │   ├── FeatureCard.vue
│       │   │   │   │   ├── ProjectInfoCard.vue
│       │   │   │   │   ├── SkeletonLoader.vue
│       │   │   │   │   ├── ThemeIcon.vue
│       │   │   │   │   └── UpdateModal.vue
│       │   │   │   ├── layout/
│       │   │   │   │   ├── LayoutWrapper.vue
│       │   │   │   │   └── MainLayout.vue
│       │   │   │   ├── popup/
│       │   │   │   │   ├── McpPopup.vue
│       │   │   │   │   ├── PopupActions.vue
│       │   │   │   │   ├── PopupContent.vue
│       │   │   │   │   ├── PopupHeader.vue
│       │   │   │   │   ├── PopupInput.vue
│       │   │   │   │   └── index.ts
│       │   │   │   ├── settings/
│       │   │   │   │   ├── AudioSettings.vue
│       │   │   │   │   ├── CustomPromptSettings.vue
│       │   │   │   │   ├── FontSettings.vue
│       │   │   │   │   ├── ReplySettings.vue
│       │   │   │   │   ├── ShortcutSettings.vue
│       │   │   │   │   ├── TelegramSettings.vue
│       │   │   │   │   ├── ThemeSettings.vue
│       │   │   │   │   ├── VersionChecker.vue
│       │   │   │   │   └── WindowSettings.vue
│       │   │   │   ├── tabs/
│       │   │   │   │   ├── IntroTab.vue
│       │   │   │   │   ├── McpToolsTab.vue
│       │   │   │   │   ├── PromptsTab.vue
│       │   │   │   │   └── SettingsTab.vue
│       │   │   │   └── AppContent.vue
│       │   │   ├── composables/
│       │   │   │   ├── useAppInitialization.ts
│       │   │   │   ├── useAppManager.ts
│       │   │   │   ├── useAudioManager.ts
│       │   │   │   ├── useEventHandlers.ts
│       │   │   │   ├── useExitWarning.ts
│       │   │   │   ├── useFontManager.ts
│       │   │   │   ├── useKeyboard.ts
│       │   │   │   ├── useMcpHandler.ts
│       │   │   │   ├── useMcpTools.ts
│       │   │   │   ├── useSettings.ts
│       │   │   │   ├── useShortcuts.ts
│       │   │   │   ├── useTheme.ts
│       │   │   │   └── useVersionCheck.ts
│       │   │   ├── constants/
│       │   │   │   ├── prompts.ts
│       │   │   │   ├── telegram.ts
│       │   │   │   └── ui.ts
│       │   │   ├── public/
│       │   │   │   └── icons/
│       │   │   │       └── icon-128.png
│       │   │   ├── test/
│       │   │   │   ├── components/
│       │   │   │   │   ├── ComponentsTest.vue
│       │   │   │   │   ├── MainLayoutTest.vue
│       │   │   │   │   ├── McpPopupTest.vue
│       │   │   │   │   └── ThemesTest.vue
│       │   │   │   ├── README.md
│       │   │   │   ├── TestApp.vue
│       │   │   │   ├── index.html
│       │   │   │   ├── main.ts
│       │   │   │   └── vite.config.ts
│       │   │   ├── theme/
│       │   │   │   ├── colors.ts
│       │   │   │   └── index.ts
│       │   │   ├── types/
│       │   │   │   ├── popup.d.ts
│       │   │   │   └── tauri.d.ts
│       │   │   ├── App.vue
│       │   │   └── main.ts
│       │   └── rust/
│       │       ├── app/
│       │       │   ├── builder.rs
│       │       │   ├── cli.rs
│       │       │   ├── commands.rs
│       │       │   ├── mod.rs
│       │       │   └── setup.rs
│       │       ├── assets/
│       │       │   └── resources/
│       │       │       ├── 100w[100万].mp3
│       │       │       ├── deng[噔].mp3
│       │       │       ├── dengyixia[等一下].mp3
│       │       │       ├── elegant[销魂].mp3
│       │       │       ├── ganma[iKun].mp3
│       │       │       ├── gaowan[睾丸了].mp3
│       │       │       └── ji[鸡].mp3
│       │       ├── bin/
│       │       │   └── mcp_server.rs
│       │       ├── config/
│       │       │   ├── mod.rs
│       │       │   ├── settings.rs
│       │       │   └── storage.rs
│       │       ├── constants/
│       │       │   ├── app.rs
│       │       │   ├── audio.rs
│       │       │   ├── font.rs
│       │       │   ├── mcp.rs
│       │       │   ├── mod.rs
│       │       │   ├── network.rs
│       │       │   ├── telegram.rs
│       │       │   ├── theme.rs
│       │       │   ├── ui.rs
│       │       │   ├── validation.rs
│       │       │   └── window.rs
│       │       ├── mcp/
│       │       │   ├── handlers/
│       │       │   │   ├── mod.rs
│       │       │   │   ├── popup.rs
│       │       │   │   └── response.rs
│       │       │   ├── tools/
│       │       │   │   ├── interaction/
│       │       │   │   │   ├── mcp.rs
│       │       │   │   │   └── mod.rs
│       │       │   │   ├── memory/
│       │       │   │   │   ├── manager.rs
│       │       │   │   │   ├── mcp.rs
│       │       │   │   │   ├── mod.rs
│       │       │   │   │   └── types.rs
│       │       │   │   └── mod.rs
│       │       │   ├── utils/
│       │       │   │   ├── common.rs
│       │       │   │   ├── errors.rs
│       │       │   │   └── mod.rs
│       │       │   ├── commands.rs
│       │       │   ├── mod.rs
│       │       │   ├── server.rs
│       │       │   └── types.rs
│       │       ├── telegram/
│       │       │   ├── commands.rs
│       │       │   ├── core.rs
│       │       │   ├── integration.rs
│       │       │   ├── markdown.rs
│       │       │   ├── mcp_handler.rs
│       │       │   └── mod.rs
│       │       ├── ui/
│       │       │   ├── audio.rs
│       │       │   ├── audio_assets.rs
│       │       │   ├── commands.rs
│       │       │   ├── exit.rs
│       │       │   ├── exit_handler.rs
│       │       │   ├── font_commands.rs
│       │       │   ├── mod.rs
│       │       │   ├── updater.rs
│       │       │   ├── window.rs
│       │       │   └── window_events.rs
│       │       ├── utils/
│       │       │   ├── logger.rs
│       │       │   └── mod.rs
│       │       ├── lib.rs
│       │       └── main.rs
│       ├── .gitignore
│       ├── API_REFERENCE.md
│       ├── COMPLETE_API_SPECIFICATION.md
│       ├── Cargo.toml
│       ├── DEPLOYMENT_GUIDE.md
│       ├── DEVELOPMENT_GUIDE.md
│       ├── FLUTTER_IMPLEMENTATION.md
│       ├── IMPLEMENTATION_GUIDE.md
│       ├── INSTALL.md
│       ├── LARAVEL_IMPLEMENTATION.md
│       ├── MONITORING_AND_HEALTH_CHECK.md
│       ├── README.md
│       ├── RUST_INTEGRATION.md
│       ├── SYSTEM_SERVICES_CONFIG.md
│       ├── VUE_FRONTEND_MIGRATION.md
│       ├── build.rs
│       ├── cliff.toml
│       ├── dev.bat
│       ├── eslint.config.mjs
│       ├── index.html
│       ├── install-universal.sh
│       ├── install-windows.ps1
│       ├── install.sh
│       ├── package.json
│       ├── pnpm-workspace.yaml
│       ├── tauri.conf.json
│       ├── uno.config.ts
│       ├── version.json
│       └── vite.config.js
├── utils/
│   ├── ai_translator/
│   │   ├── config/
│   │   │   └── index.js
│   │   ├── libs/
│   │   │   ├── ai_translator.js
│   │   │   ├── cache_manager.js
│   │   │   ├── file_watcher.js
│   │   │   ├── openrouter_api.js
│   │   │   ├── paragraph_splitter.js
│   │   │   ├── prompt_templates.js
│   │   │   └── translation_manager.js
│   │   ├── web/
│   │   │   ├── controller/
│   │   │   │   └── translation_controller.js
│   │   │   ├── routes/
│   │   │   │   ├── api.js
│   │   │   │   └── web.js
│   │   │   ├── templates/
│   │   │   │   ├── dashboard.html
│   │   │   │   └── status.html
│   │   │   ├── index.js
│   │   │   └── web_server.js
│   │   ├── example_openrouter.py
│   │   ├── example_usage.js
│   │   ├── index.js
│   │   └── main.js
│   ├── caddy/
│   │   ├── libs/
│   │   │   ├── CaddyManager.js
│   │   │   ├── certificate.js
│   │   │   ├── config.js
│   │   │   ├── service.js
│   │   │   └── status.js
│   │   └── provider/
│   │       └── constants.js
│   ├── cmd_select/
│   │   ├── libs/
│   │   │   ├── select.js
│   │   │   └── select.py
│   │   └── tools/
│   │       ├── strtool.js
│   │       ├── strtool.py
│   │       └── strtool_v2.js
│   ├── db_tool/
│   │   ├── main.js
│   │   └── sequelize_db.js
│   ├── dev_tool/
│   │   ├── lang_deploy/
│   │   │   ├── config/
│   │   │   │   └── index.js
│   │   │   ├── libs/
│   │   │   │   ├── base_utils.js
│   │   │   │   └── commander.js
│   │   │   ├── php_libs/
│   │   │   │   └── get_releases.js
│   │   │   ├── getandroidstudio_linux.js
│   │   │   ├── getandroidstudio_win.js
│   │   │   ├── getcmder_win.js
│   │   │   ├── getenvironments_win.js
│   │   │   ├── getflutter_win.js
│   │   │   ├── getgolang_win.js
│   │   │   ├── getjava_win.js
│   │   │   ├── getnode_win.js
│   │   │   ├── getphp_win.js
│   │   │   ├── getpython_win.js
│   │   │   ├── getruby_win.js
│   │   │   ├── getrust_win.js
│   │   │   ├── pythonSetup.js
│   │   │   └── pythonVenv.js
│   │   ├── libs/
│   │   │   └── visualstudio_activator.js
│   │   ├── provider/
│   │   │   ├── Python311/
│   │   │   └── Python39/
│   │   ├── utils/
│   │   │   └── turn_feature.js
│   │   ├── win-libs/
│   │   │   └── winget.js
│   │   ├── wsl-uitls/
│   │   │   ├── libs/
│   │   │   │   └── wsl_activator.js
│   │   │   ├── tool/
│   │   │   │   ├── wsl_config_tool.js
│   │   │   │   ├── wsl_ubuntu_config.js
│   │   │   │   └── wsl_ubuntu_control.js
│   │   │   └── index.js
│   │   └── index.js
│   ├── docker_liunx_tool/
│   │   ├── libs/
│   │   │   ├── compose_control.js
│   │   │   └── docker_control.js
│   │   ├── providor/
│   │   │   ├── docker_info.js
│   │   │   ├── docker_info.py
│   │   │   └── mirrors.js
│   │   ├── utils/
│   │   │   ├── docker_tools.js
│   │   │   ├── file_tool.js
│   │   │   └── yaml_tool.js
│   │   ├── projectES6NativeDirectoryPrinting.js
│   │   ├── project_dir_tree.txt
│   │   └── project_file_tree.txt
│   ├── flutter_icon_tool/
│   │   ├── libs/
│   │   │   ├── directory_scanner.js
│   │   │   ├── flutter_icon_manager.js
│   │   │   ├── image_analyzer.js
│   │   │   └── image_processor.js
│   │   └── index.js
│   ├── htmltool/
│   │   └── libs/
│   │       ├── htmlparse.js
│   │       └── httptool.js
│   ├── image/
│   │   └── libs/
│   │       ├── icon.js
│   │       └── imgtool.js
│   ├── linux/
│   │   ├── libs/
│   │   │   ├── envlink.js
│   │   │   ├── installer.js
│   │   │   ├── service.js
│   │   │   └── shorcut.js
│   │   └── index.js
│   ├── mail/
│   │   ├── index.js
│   │   └── mail.js
│   ├── net/
│   │   ├── front/
│   │   │   ├── socket.js
│   │   │   └── socketReact.js
│   │   ├── libs/
│   │   │   ├── axios_tool.js
│   │   │   ├── iptool.js
│   │   │   ├── nettest.js
│   │   │   ├── portool.js
│   │   │   ├── requests.js
│   │   │   ├── requests_tools.js
│   │   │   ├── strapi_v4_net.js
│   │   │   └── strapi_v4_net_fetch.js
│   │   └── unit/
│   │       └── header.js
│   ├── openai/
│   │   ├── config/
│   │   │   ├── index.js
│   │   │   └── open_config.js
│   │   ├── prompts/
│   │   │   ├── codeConversion.js
│   │   │   ├── index.js
│   │   │   └── moduleSplit.js
│   │   ├── utils/
│   │   │   ├── codeAnalyzer.js
│   │   │   ├── codeExtractor.js
│   │   │   ├── fileHandler.js
│   │   │   ├── moduleExtractor.js
│   │   │   ├── promptWrapper.js
│   │   │   └── xmlParser.js
│   │   ├── chat.js
│   │   ├── example.js
│   │   └── example_to_es6.js
│   ├── puppeteer_spider/
│   │   ├── library/
│   │   │   ├── browsers/
│   │   │   │   ├── chrome/
│   │   │   │   │   ├── finder/
│   │   │   │   │   │   └── index.js
│   │   │   │   │   └── installer/
│   │   │   │   │       └── index.js
│   │   │   │   └── edge/
│   │   │   │       ├── finder/
│   │   │   │       │   └── index.js
│   │   │   │       └── installer/
│   │   │   │           └── index.js
│   │   │   ├── chrome_ver/
│   │   │   ├── config/
│   │   │   │   ├── chrome_config.js
│   │   │   │   ├── chrome_version.js
│   │   │   │   ├── config_manager.js
│   │   │   │   └── edge_config.js
│   │   │   ├── core/
│   │   │   │   ├── fetcher.js
│   │   │   │   ├── spider_core.js
│   │   │   │   ├── spider_factory.js
│   │   │   │   ├── spider_plugin_manager.js
│   │   │   │   ├── spider_registry.js
│   │   │   │   └── web_spider.js
│   │   │   ├── drivers/
│   │   │   │   └── driver_downloader.js
│   │   │   ├── plugins/
│   │   │   │   └── download_plugin.js
│   │   │   ├── utils/
│   │   │   │   └── ai_rules.js
│   │   │   ├── version_mappers/
│   │   │   │   ├── chrome.js
│   │   │   │   └── edge.js
│   │   │   ├── wrappers/
│   │   │   │   ├── climber/
│   │   │   │   │   ├── modus/
│   │   │   │   │   │   ├── bot.js
│   │   │   │   │   │   ├── content.js
│   │   │   │   │   │   ├── content_wrapper.js
│   │   │   │   │   │   ├── download.js
│   │   │   │   │   │   ├── file_monitor.js
│   │   │   │   │   │   ├── handle.js
│   │   │   │   │   │   ├── iframe.js
│   │   │   │   │   │   ├── page.js
│   │   │   │   │   │   ├── page_wrapper.js
│   │   │   │   │   │   ├── position.js
│   │   │   │   │   │   ├── screen.js
│   │   │   │   │   │   ├── special.js
│   │   │   │   │   │   └── wait.js
│   │   │   │   │   └── driver.js
│   │   │   │   ├── node_provider/
│   │   │   │   │   └── utils.js
│   │   │   │   └── utils/
│   │   │   │       └── classUtils.js
│   │   │   ├── browser_detector.js
│   │   │   ├── browser_installer_manager.js
│   │   │   ├── global_instance_manager.js
│   │   │   ├── global_wrappers.js
│   │   │   ├── instance_manager.js
│   │   │   ├── mime.js
│   │   │   └── puppeteer_spider.js
│   │   ├── COMPREHENSIVE_FRAMEWORK_ANALYSIS.md
│   │   ├── FRAMEWORK_ANALYSIS_REPORT.md
│   │   ├── README.md
│   │   ├── main.js
│   │   └── puppeteer_spider_tree.md
│   ├── puppeteer_spider_v2/
│   │   ├── config/
│   │   ├── docs/
│   │   │   ├── api/
│   │   │   ├── examples/
│   │   │   └── guides/
│   │   ├── src/
│   │   │   ├── compat/
│   │   │   │   └── LegacyAdapter.js
│   │   │   ├── config/
│   │   │   │   ├── presets/
│   │   │   │   │   ├── desktop.json
│   │   │   │   │   ├── headless.json
│   │   │   │   │   └── mobile.json
│   │   │   │   ├── ConfigManager.js
│   │   │   │   ├── development.json
│   │   │   │   └── production.json
│   │   │   ├── core/
│   │   │   │   ├── EventBus.js
│   │   │   │   ├── PluginManager.js
│   │   │   │   ├── ResourcePool.js
│   │   │   │   ├── SessionManager.js
│   │   │   │   └── SpiderEngine.js
│   │   │   ├── factories/
│   │   │   │   └── BrowserFactory.js
│   │   │   ├── implementations/
│   │   │   │   ├── browsers/
│   │   │   │   │   ├── ChromeFinder.js
│   │   │   │   │   ├── ChromeInstaller.js
│   │   │   │   │   ├── EdgeFinder.js
│   │   │   │   │   └── EdgeInstaller.js
│   │   │   │   ├── downloaders/
│   │   │   │   └── pages/
│   │   │   │       └── StandardPage.js
│   │   │   ├── interfaces/
│   │   │   │   ├── IBrowser.js
│   │   │   │   ├── IDownloader.js
│   │   │   │   ├── IPage.js
│   │   │   │   └── IPlugin.js
│   │   │   ├── plugins/
│   │   │   │   ├── core/
│   │   │   │   │   ├── AutomationPlugin.js
│   │   │   │   │   ├── ContentPlugin.js
│   │   │   │   │   └── DownloadPlugin.js
│   │   │   │   └── extensions/
│   │   │   │       ├── FormPlugin.js
│   │   │   │       └── ScreenshotPlugin.js
│   │   │   └── utils/
│   │   │       ├── base/
│   │   │       │   └── BaseUtils.js
│   │   │       ├── operations/
│   │   │       │   └── PageOperationUtils.js
│   │   │       ├── BrowserUtils.js
│   │   │       ├── CacheManager.js
│   │   │       ├── Logger.js
│   │   │       └── PageUtils.js
│   │   ├── tests/
│   │   │   ├── e2e/
│   │   │   ├── integration/
│   │   │   └── unit/
│   │   ├── COMPLETE_REFACTORING_PLAN.md
│   │   ├── IMPLEMENTATION_COMPARISON.md
│   │   ├── README.md
│   │   ├── REFACTORING_SUMMARY.md
│   │   ├── example.js
│   │   ├── main.js
│   │   └── test.js
│   ├── shortcuttool/
│   │   └── index.js
│   ├── smart_compression/
│   │   ├── libs/
│   │   │   ├── compression_queue.js
│   │   │   ├── compression_scheduler.js
│   │   │   ├── smart_compression_manager.js
│   │   │   └── system_monitor.js
│   │   ├── README.md
│   │   ├── config.js
│   │   ├── example.js
│   │   └── index.js
│   ├── strapi_tool/
│   │   └── libs/
│   │       ├── handle.js
│   │       └── server.js
│   ├── system/
│   │   └── fix_symlink_loops.js
│   ├── systool/
│   │   ├── libs/
│   │   │   ├── check.js
│   │   │   ├── explorer.js
│   │   │   ├── platform.js
│   │   │   ├── plattool.js
│   │   │   ├── sysarg.js
│   │   │   └── tool.js
│   │   └── index.js
│   ├── video/
│   │   ├── libs/
│   │   │   ├── compress-index.js
│   │   │   ├── ffmpegSetupBywin.js
│   │   │   ├── video-file-operations.js
│   │   │   └── videoCompressor.js
│   │   └── index.js
│   ├── web_offline/
│   │   ├── css_processor.js
│   │   ├── domain_context.js
│   │   ├── file_mapper.js
│   │   ├── index.js
│   │   ├── resource_downloader.js
│   │   ├── resource_extractor.js
│   │   ├── unified_resource_processor.js
│   │   └── url_rewriter.js
│   ├── win_tool/
│   │   ├── base_utils/
│   │   │   └── base.js
│   │   ├── libs/
│   │   │   ├── registry.js
│   │   │   ├── run.js
│   │   │   ├── sysinfo.js
│   │   │   ├── win.js
│   │   │   ├── winget.js
│   │   │   ├── winpath.js
│   │   │   └── winstatus.js
│   │   ├── utils/
│   │   │   ├── download_manager.js
│   │   │   └── requests_tools.js
│   │   └── index.js
│   ├── conf.js
│   ├── encodingtool.js
│   ├── http.js
│   ├── porttool.js
│   ├── schedule.js
│   ├── serve.js
│   ├── shoticon.js
│   ├── softinstall.js
│   ├── urltool.js
│   └── watchf.js
├── db.js
├── ncore_tree.md
└── prompt.txt
```

---
*Generated by Directory Tree Generator*