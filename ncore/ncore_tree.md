# Directory Tree: ncore

**Path:** `D:\programing\core_node\ncore`

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
├── pytools/
│   ├── pyfoundations/
│   │   ├── __init__.py
│   │   ├── color_print.py
│   │   └── encyclopedia.py
│   ├── pygvar/
│   │   ├── __init__.py
│   │   └── global_var_manager.py
│   ├── pyutils/
│   │   ├── common/
│   │   │   ├── __init__.py
│   │   │   └── window_finder.py
│   │   ├── examples/
│   │   │   ├── dataset_generator_example.py
│   │   │   └── ocr_example.py
│   │   ├── app_launcher.py
│   │   ├── click_handler.py
│   │   ├── dataset_generator.py
│   │   ├── hotkey_listener.py
│   │   ├── image_annotator.py
│   │   ├── image_comparator.py
│   │   ├── image_crop.py
│   │   ├── image_matcher.py
│   │   ├── integrated_window_analyzer.py
│   │   ├── ocr_cnocr_engine.py
│   │   ├── paddle_ocr.py
│   │   ├── png_matcher.py
│   │   ├── process_manager.py
│   │   ├── tray_clicker.py
│   │   ├── ui_analyzer.py
│   │   ├── ultralytics_trainer.py
│   │   ├── window_activator.py
│   │   ├── window_analyzer.py
│   │   ├── window_ops.py
│   │   └── window_screenshot.py
│   ├── __init__.py
│   └── __main__.py
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
│   ├── oldspider/
│   │   ├── climber/
│   │   │   ├── javascript/
│   │   │   │   └── modus/
│   │   │   │       ├── content.js
│   │   │   │       └── handle.js
│   │   │   ├── modus/
│   │   │   │   ├── content.api.md
│   │   │   │   ├── content.js
│   │   │   │   ├── download.js
│   │   │   │   ├── handle.js
│   │   │   │   ├── page.js
│   │   │   │   ├── screen.js
│   │   │   │   ├── special.js
│   │   │   │   └── spicial.txt
│   │   │   └── driver.js
│   │   ├── config/
│   │   │   ├── libs/
│   │   │   │   └── ensureAndFinderChrome.js
│   │   │   ├── chrome_version.js
│   │   │   └── option.js
│   │   ├── library/
│   │   │   ├── chrome_ver/
│   │   │   │   └── chrome_version.md
│   │   │   ├── libs/
│   │   │   │   ├── mime.js
│   │   │   │   ├── selenium_down.js
│   │   │   │   └── stealth.min.js
│   │   │   └── driverStore.js
│   │   ├── node_provider/
│   │   │   ├── base/
│   │   │   │   ├── base.js
│   │   │   │   └── log.js
│   │   │   ├── electron/
│   │   │   │   ├── cmenu.js
│   │   │   │   ├── ctrl.js
│   │   │   │   ├── elec.js
│   │   │   │   ├── tray.js
│   │   │   │   └── view.js
│   │   │   ├── front/
│   │   │   │   ├── electronIpc.js
│   │   │   │   ├── socket.js
│   │   │   │   └── socketReact.js
│   │   │   ├── globalvar/
│   │   │   │   ├── env.js
│   │   │   │   └── gdir.js
│   │   │   ├── library/
│   │   │   │   ├── linux/
│   │   │   │   │   ├── 7z2301-linux-x64/
│   │   │   │   │   │   └── MANUAL/
│   │   │   │   │   │       ├── cmdline/
│   │   │   │   │   │       │   ├── commands/
│   │   │   │   │   │       │   │   ├── add.htm
│   │   │   │   │   │       │   │   ├── bench.htm
│   │   │   │   │   │       │   │   ├── delete.htm
│   │   │   │   │   │       │   │   ├── extract.htm
│   │   │   │   │   │       │   │   ├── extract_full.htm
│   │   │   │   │   │       │   │   ├── hash.htm
│   │   │   │   │   │       │   │   ├── index.htm
│   │   │   │   │   │       │   │   ├── list.htm
│   │   │   │   │   │       │   │   ├── rename.htm
│   │   │   │   │   │       │   │   ├── style.css
│   │   │   │   │   │       │   │   ├── test.htm
│   │   │   │   │   │       │   │   └── update.htm
│   │   │   │   │   │       │   ├── switches/
│   │   │   │   │   │       │   │   ├── ar_exclude.htm
│   │   │   │   │   │       │   │   ├── ar_include.htm
│   │   │   │   │   │       │   │   ├── ar_no.htm
│   │   │   │   │   │       │   │   ├── bb.htm
│   │   │   │   │   │       │   │   ├── bs.htm
│   │   │   │   │   │       │   │   ├── charset.htm
│   │   │   │   │   │       │   │   ├── email.htm
│   │   │   │   │   │       │   │   ├── exclude.htm
│   │   │   │   │   │       │   │   ├── include.htm
│   │   │   │   │   │       │   │   ├── index.htm
│   │   │   │   │   │       │   │   ├── large_pages.htm
│   │   │   │   │   │       │   │   ├── list_tech.htm
│   │   │   │   │   │       │   │   ├── method.htm
│   │   │   │   │   │       │   │   ├── output_dir.htm
│   │   │   │   │   │       │   │   ├── overwrite.htm
│   │   │   │   │   │       │   │   ├── password.htm
│   │   │   │   │   │       │   │   ├── recurse.htm
│   │   │   │   │   │       │   │   ├── sa.htm
│   │   │   │   │   │       │   │   ├── scc.htm
│   │   │   │   │   │       │   │   ├── scrc.htm
│   │   │   │   │   │       │   │   ├── sdel.htm
│   │   │   │   │   │       │   │   ├── sfx.htm
│   │   │   │   │   │       │   │   ├── shared.htm
│   │   │   │   │   │       │   │   ├── sni.htm
│   │   │   │   │   │       │   │   ├── sns.htm
│   │   │   │   │   │       │   │   ├── spf.htm
│   │   │   │   │   │       │   │   ├── spm.htm
│   │   │   │   │   │       │   │   ├── ssc.htm
│   │   │   │   │   │       │   │   ├── stdin.htm
│   │   │   │   │   │       │   │   ├── stdout.htm
│   │   │   │   │   │       │   │   ├── stl.htm
│   │   │   │   │   │       │   │   ├── stop_switch.htm
│   │   │   │   │   │       │   │   ├── stx.htm
│   │   │   │   │   │       │   │   ├── style.css
│   │   │   │   │   │       │   │   ├── type.htm
│   │   │   │   │   │       │   │   ├── update.htm
│   │   │   │   │   │       │   │   ├── volume.htm
│   │   │   │   │   │       │   │   ├── working_dir.htm
│   │   │   │   │   │       │   │   └── yes.htm
│   │   │   │   │   │       │   ├── exit_codes.htm
│   │   │   │   │   │       │   ├── index.htm
│   │   │   │   │   │       │   ├── style.css
│   │   │   │   │   │       │   └── syntax.htm
│   │   │   │   │   │       ├── general/
│   │   │   │   │   │       │   ├── 7z.htm
│   │   │   │   │   │       │   ├── faq.htm
│   │   │   │   │   │       │   ├── formats.htm
│   │   │   │   │   │       │   ├── index.htm
│   │   │   │   │   │       │   ├── license.htm
│   │   │   │   │   │       │   ├── performance.htm
│   │   │   │   │   │       │   ├── register.htm
│   │   │   │   │   │       │   ├── style.css
│   │   │   │   │   │       │   └── thanks.htm
│   │   │   │   │   │       ├── start.htm
│   │   │   │   │   │       └── style.css
│   │   │   │   │   ├── 7zz
│   │   │   │   │   ├── 7zzs
│   │   │   │   │   ├── History.txt
│   │   │   │   │   └── readme.txt
│   │   │   │   └── win32/
│   │   │   │       ├── Far/
│   │   │   │       │   ├── 7-ZipEng.hlf
│   │   │   │       │   ├── 7-ZipEng.lng
│   │   │   │       │   ├── 7-ZipRus.hlf
│   │   │   │       │   ├── 7-ZipRus.lng
│   │   │   │       │   ├── 7zToFar.ini
│   │   │   │       │   ├── far7z.reg
│   │   │   │       │   └── far7z.txt
│   │   │   │       ├── gsudo.portable/
│   │   │   │       │   ├── Invoke-ElevatedCommand.ps1
│   │   │   │       │   ├── Invoke-gsudo.ps1
│   │   │   │       │   ├── gsudo
│   │   │   │       │   ├── gsudoModule.psd1
│   │   │   │       │   └── gsudoModule.psm1
│   │   │   │       ├── history.txt
│   │   │   │       ├── readme.txt
│   │   │   │       └── set_env.bat
│   │   │   ├── model/
│   │   │   │   └── encyclopedia.js
│   │   │   ├── practical/
│   │   │   │   ├── encyclopedia.js
│   │   │   │   ├── http.js
│   │   │   │   ├── pm2.js
│   │   │   │   ├── queue-example.js
│   │   │   │   ├── schedule
│   │   │   │   ├── schedule.js
│   │   │   │   ├── serve.js
│   │   │   │   ├── shoticon.js
│   │   │   │   ├── softinstall.js
│   │   │   │   ├── src.js
│   │   │   │   ├── sysinfo.js
│   │   │   │   ├── win.js
│   │   │   │   ├── winget.js
│   │   │   │   └── zip.js
│   │   │   ├── request_callback/
│   │   │   │   ├── api-example.js
│   │   │   │   ├── rawdata.js
│   │   │   │   └── vue_request.js
│   │   │   ├── util/
│   │   │   │   ├── arr.js
│   │   │   │   ├── autostart.js
│   │   │   │   ├── conf.js
│   │   │   │   ├── env.js
│   │   │   │   ├── file.js
│   │   │   │   ├── fpath.js
│   │   │   │   ├── htmlparse.js
│   │   │   │   ├── htmlparseApi.md
│   │   │   │   ├── httptool.js
│   │   │   │   ├── json.js
│   │   │   │   ├── log.js
│   │   │   │   ├── math.js
│   │   │   │   ├── platform.js
│   │   │   │   ├── plattool.js
│   │   │   │   ├── porttool.js
│   │   │   │   ├── strtool.js
│   │   │   │   ├── sysarg.js
│   │   │   │   ├── tamplate.js
│   │   │   │   ├── tool.js
│   │   │   │   ├── urltool.js
│   │   │   │   ├── watchf.js
│   │   │   │   └── zip.js
│   │   │   ├── web_js/
│   │   │   │   └── http/
│   │   │   │       └── apiClient.js
│   │   │   ├── .gitignore
│   │   │   ├── contrl.js
│   │   │   ├── electron.js
│   │   │   ├── gitauto.py
│   │   │   ├── gitput.bat
│   │   │   ├── gitput.sh
│   │   │   ├── globalvars.js
│   │   │   ├── practicals.js
│   │   │   ├── practicals_prune.js
│   │   │   ├── readme.md
│   │   │   ├── utils.js
│   │   │   └── utils_prune.js
│   │   ├── node_spider/
│   │   │   ├── library/
│   │   │   │   ├── chrome_ver/
│   │   │   │   │   └── chrome_version.md
│   │   │   │   └── libs/
│   │   │   │       ├── mime.js
│   │   │   │       ├── selenium_down.js
│   │   │   │       └── stealth.min.js
│   │   │   └── main/
│   │   │       └── main.js
│   │   ├── tool/
│   │   │   ├── .env
│   │   │   ├── autostart.js
│   │   │   ├── classUtils.js
│   │   │   ├── env.js
│   │   │   ├── htmlparse.js
│   │   │   ├── htmlparseApi.md
│   │   │   ├── watchf.js
│   │   │   └── zip.js
│   │   └── main.js
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
│   ├── puppeteer-browser/
│   │   ├── core/
│   │   │   ├── config.js
│   │   │   ├── instance.js
│   │   │   ├── main.js
│   │   │   └── pool.js
│   │   ├── libs/
│   │   │   ├── mime.js
│   │   │   └── stealth.min.js
│   │   ├── puppeteer-api/
│   │   │   ├── api.js
│   │   │   ├── download.js
│   │   │   ├── interaction.js
│   │   │   ├── navigation.js
│   │   │   ├── screenshot.js
│   │   │   └── script.js
│   │   ├── utils/
│   │   │   ├── chrome-finder.js
│   │   │   └── chrome-version.js
│   │   ├── DEVELOPMENT_ANALYSIS.md
│   │   ├── README.md
│   │   └── index.js
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
│   ├── queue-example.js
│   ├── schedule.js
│   ├── serve.js
│   ├── shoticon.js
│   ├── softinstall.js
│   ├── urltool.js
│   └── watchf.js
└── db.js
```

---
*Generated by Directory Tree Generator*