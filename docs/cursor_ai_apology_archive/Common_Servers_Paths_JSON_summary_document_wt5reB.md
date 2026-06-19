# Common/Servers/Paths JSON config - summary document [wt5reB]

to use HuTiGong `<content>` ( Han common, servers, win32, linux JSON config ) JianMing summary . 

## structure 
DingCeng to Xiang : common, servers, win32, linux. common: intranetIPAddress, localStaticHttpsApiUrl, localStaticHttpApiUrl. servers: SINGAPORE_SERVER_IP, SINGAPORE_API_DOMAIN. win32/linux: NCORE_DIR, DEV_LANG_DIR, APP_INSTALL_DIR, PROJECT_DIR, BASE_DATA_DIR, COMPILE_DIR, WIS_PROGRAMING_DIR, path_mapping_rules. 

## key points 
- **common**: within Wang IP ( such as 192.168.100.5) , this JingTai API (HTTPS :905, HTTP :805, static.local.12gm.com) . 
- **servers**: XinJiaPoFuWuQi IP and API Yu (api.si.12gm.com) . 
- **win32**: Windows XiaGuDingPanFuLuJing ( Han &lt;USERNAME&gt; NCORE_DIR) ; path_mapping_rules Han base_dir, compile_dir, project_dir ( such as D:\\programing\\core_node) . 
- **linux**: BuFenZhi for "auto_detected"; path_mapping_rules Han development_env/production_env, base_dir_priority (WSL /mnt/d, NTFS, /www) , compile_dir_dev/prod, project_dir_dev/prod. 

## purpose 
for KuaPingTai (Windows/Linux) TiGongGongGong API JiZhi , FuWuQi Zhi and directory / LuJingYingSheGuiZe , GongGouJian or Yun line when config use . 
