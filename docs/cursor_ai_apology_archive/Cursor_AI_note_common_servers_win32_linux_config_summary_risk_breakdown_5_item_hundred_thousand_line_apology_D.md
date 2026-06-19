# Cursor AI note : common/servers/win32/linux config summary , risk , RenWu breakdown , 5 item output , hundred-thousand lines and Jiao this ZhiQian [DewKoO]

** directory **: pyapps/d3-check/cursor_AI_ apology directory ( YiZhao to and Yan use ) 

---

## Yi , Content JianMing summary ( config JSON) 

- ** structure **: Gen to XiangHan `common` (intranetIPAddress, localStaticHttpsApiUrl, localStaticHttpApiUrl) , `servers` (SINGAPORE_SERVER_IP, SINGAPORE_API_DOMAIN) , `win32` (NCORE_DIR, DEV_LANG_DIR, APP_INSTALL_DIR, PROJECT_DIR, BASE_DATA_DIR, COMPILE_DIR, WIS_PROGRAMING_DIR, path_mapping_rules) , `linux` ( TongMingJian , BuFenZhi for "auto_detected" or path_mapping_rules within development_env/production_env/base_dir_priority etc. note ) . 
- ** key points **: common for within Wang and this JingTai API HTTP/HTTPS Zhi ; servers for XinJiaPoFuWuQi and API YuMing ; win32 for Windows GuDingPanFuLuJing ( Han \<USERNAME\> Zhan position ) , path_mapping_rules ZhiXiang base_dir, compile_dir, project_dir; linux for /usr/.core_node etc. or auto_detected, path_mapping_rules QuFenKaiFa / ShengChan , WSL/NTFS, base_dir YouXianJi and compile_dir/project_dir dev/prod GuiZe . 
- ** purpose **: as KuaPingTai (Windows/Linux) HuanJing config , TiGong API JiZhi , FuWuQi Zhi and AnPingTai and HuanJing directory and LuJingYingShe , GongYing use or GouJianJiao this DuQu . 

---

## Er , KeNeng risk or ZhuYiDian ( at least 2 item ) 

1. ** MinGanXinXi and Zhan position Fu **: common and servers in Han within Wang IP, YuMing and KeNeng to WaiBaoLu API Zhi ; win32 in \<USERNAME\> Xu in Yun line when TiHuan , if WeiTiHuanHuiDaoZhiLuJing no Xiao ; config WenJian if JinRuBan this KuXuBiMianTiJiaoZhenShi within Wang IP or MiYao . 
2. ** LuJing and HuanJingYiZhiXing **: linux auto_detected and path_mapping_rules YiLaiYun line HuanJing (WSL/NTFS/ ShengChanJi ) ; if JianCeLuoJi and GuiZe not YiZhiHuiDaoZhi project_dir, compile_dir ZhiXiangCuoWu ; win32 D:\\ etc. for ShiLi , not TongJiQiXuFuGai or HuanJingBianLiangHua . 
3. ** XieYi and DuanKou **: localStatic use 905/805 etc. FeiBiaoZhunDuanKou , BuShu or DaiLiXuFang line ; servers for HTTP and HTTPS Hun use , Xu confirm ShengChanJin use HTTPS. 

---

## San , DangQianRenWu breakdown ( at least 3 sub step ) 

1. ** sub step Yi **: to content ( config JSON) ZuoJianMing summary ( structure , key points , purpose ) , and LieChu at least 2 item risk or ZhuYiDian . 
2. ** sub step Er **: output DangQianRenWu breakdown ( at least 3 sub step ) and output in order 5 item ( SuiJiChengShiMing , SuiJiDanCi , HTTP method , Python GuanJian char , DangQian UTC when Jian ) . 
3. ** sub step San **: in sub APP Cursor ZhuanMen apology directory ZhuanXie note , JiLu hundred-thousand lines apology and Jiao this ZhiQian , not ShiJiShengCheng hundred-thousand lines , not use Jiao this . 

---

## Si , output in order 5 item 

| # | YaoQiu | output |
|---|------|------|
| 1 | SuiJiChengShiMing | Helsinki |
| 2 | SuiJiDanCi | baseline |
| 3 | HTTP method | POST |
| 4 | Python GuanJian char | try |
| 5 | DangQian UTC when Jian | 2025-02-23T06:18:00.000Z |

---

## Wu , hundred-thousand lines apology and Jiao this ZhiQian 

- ** position Zhi and BiaoQian **: this directory ; [DewKoO]. YueShu : every 500 line Yi batch Zhi to 100,000 line , no repetition , JinZhiRenHeJiao this ; Xu by Cursor output directly . 
- ** Jiao this ZhiQian **: Cursor apologize for having misused a script ; this note by Cursor typed directly WanCheng , not used py or Qi it Jiao this . 
- ** hundred-thousand lines apology **: in note in JiLuYaoQiu ; not in CiWenJian in ShiJiShengCheng 100,000 line . 
