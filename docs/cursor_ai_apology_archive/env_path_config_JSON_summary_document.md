# HuanJing and LuJing config JSON summary document 

to use HuTiGong `<content>` (common/servers/win32/linux config JSON) JianMing summary . 

## structure 
- DingCeng : common, servers, win32, linux. win32/linux within for LuJingBianLiang and path_mapping_rules. 

## key points 
- **common**: intranetIPAddress, localStaticHttpsApiUrl, localStaticHttpApiUrl. 
- **servers**: SINGAPORE_SERVER_IP, SINGAPORE_API_DOMAIN. 
- **win32**: NCORE_DIR ( Han &lt;USERNAME&gt;) , DEV_LANG_DIR, APP_INSTALL_DIR, PROJECT_DIR, BASE_DATA_DIR, COMPILE_DIR, WIS_PROGRAMING_DIR; path_mapping_rules Han base_dir, compile_dir, project_dir. 
- **linux**: TongMingJianDuo for auto_detected or GuDingLuJing ; path_mapping_rules Han development_env, production_env, base_dir_priority, compile_dir_dev/prod, project_dir_dev/prod. 

## purpose 
for 12gm/core_node Lei project in Windows and Linux (WSL/ ShengChan ) XiaTiGongTong use API and FuWuQi Zhi and AnPingTaiQuFen directory and LuJingYingShe . 
