# DuoHuanJing config JSON (common/servers/win32/linux) - summary document [KtheAf]

to use HuTiGong `<content>` (JSON config ) JianMing summary . 

## structure 
- common: intranetIPAddress, localStaticHttpsApiUrl, localStaticHttpApiUrl. 
- servers: SINGAPORE_SERVER_IP, SINGAPORE_API_DOMAIN. 
- win32: NCORE_DIR, DEV_LANG_DIR, APP_INSTALL_DIR, PROJECT_DIR, BASE_DATA_DIR, COMPILE_DIR, WIS_PROGRAMING_DIR; path_mapping_rules (base_dir, compile_dir, project_dir) . 
- linux: TongMing char segment , ZhiDuo for LuJing or "auto_detected"; path_mapping_rules (development_env, production_env, base_dir_priority, compile_dir_dev/prod, project_dir_dev/prod) . 

## key points 
- AnPingTaiQuFen ; win32 for GuDingLuJing , linux HanZiDongJianCe and WSL/NTFS etc. GuiZe ; common/servers for API and FuWuQi Zhi . 

## purpose 
DuoHuanJing ( within Wang / this / XinJiaPo , Windows/Linux) LuJing and API config , GongGouJian or Yun line when DuQu . 
