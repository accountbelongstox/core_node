# config JSON (common/servers/win32/linux) - summary document 

to use HuTiGong `<content>` ( HuanJing and LuJing config JSON) JianMing summary . 

## structure 
- Gen to XiangHanSi block : common, servers, win32, linux. 
- common: within Wang and this JingTai API URL (HTTP/HTTPS) . 
- servers: XinJiaPoFuWuQi IP and API YuMing . 
- win32: Windows Xia NCORE_DIR, DEV_LANG_DIR, APP_INSTALL_DIR, PROJECT_DIR, BASE_DATA_DIR, COMPILE_DIR, WIS_PROGRAMING_DIR and path_mapping_rules (base_dir, compile_dir, project_dir) . 
- linux: TongShangJianMing , BuFenZhi for auto_detected; path_mapping_rules Han development_env, production_env, base_dir_priority, compile_dir_dev/prod, project_dir_dev/prod. 

## key points 
- **common**: intranetIPAddress (192.168.100.5) , localStaticHttpsApiUrl (905) , localStaticHttpApiUrl (805) . 
- **servers**: SINGAPORE_SERVER_IP, SINGAPORE_API_DOMAIN (api.si.12gm.com) . 
- **win32**: LuJing to D:\ or C:\Users\<USERNAME>\.ncore for Zhu ; project_dir ZhiXiang programing\core_node. 
- **linux**: NCORE_DIR etc. for /usr/.core_node or auto_detected; GuiZeQuFen WSL/NTFS/ ZhuoMian and ShengChanHuanJing , base_dir YouXianJi for WSL /mnt/d NTFS ShuJuPan /www, project_dir KaiFa for base_dir/programing/core_node, ShengChan for base_dir/wwwroot/core_node. 

## purpose 
for DuoHuanJing ( within Wang , this JingTai , XinJiaPoFuWuQi ) and DuoPingTai (Windows/Linux) TiGongTongYi API JiZhi and LuJing config , GongYun line when JieXi NCORE, project , BianYi , ShuJu etc. directory . 
