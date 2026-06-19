# technical note : screenshot_categories, ROSBOT_FIND_LOGIC_LIST, bn_flow_BN_LoginAsia, OCR_CNSTD_MODEL_INSTALL, kanai_cube_handler

** Mu **: note CiWuChuWenJian / WenDang / HuanCun ZhiZe , Yi by WuJie or GaiCuo Yuan because , to and ZhengQueYueDing . 

** She and WenJian **: 
- `config/screenshot_categories.py`
- `docs/ROSBOT_FIND_LOGIC_LIST.md`
- `.cache/bn_flow_snapshots/bn_flow_BN_LoginAsia.json`
- `docs/OCR_CNSTD_MODEL_INSTALL.md`
- `controller/ctl_func/kanai_cube_handler.py`

---

## Yi , config/screenshot_categories.py

### 1.1 ZhiZe and YueDing 

- ** purpose **: JieTuFenLeiChangLiang and QingLi . **SCREENSHOT_CATEGORIES** char Dian key for LeiBieMing (login_try, d4_screenshots, d4_annotated, match_debug, pathfinding, debug_capture, ui_annotated, validation, scaled_templates) , value for **providor.constants** and **providor.constants.d4** in Path ChangLiang (LOGIN_TRY_SCREENSHOT_DIR, D4_SCREENSHOT_DIR etc. ) . **ScreenshotCategoryManager** TiGong get_dir(category), register_category, clean_older_than(category, max_age_seconds), clean_all(); **get_screenshot_category_manager()** FanHuiDanLi . QingLiJinZhen to directory within WenJian , not DiGui sub directory ; ShanChuShiBai when ColorPrint.yellow DaRiZhi . 
- ** YueDing **: Diao use FangChuan category BiXu and SCREENSHOT_CATEGORIES key YiZhi , FouZe get_dir FanHui None; if in providor.constants in ZengShan or GaiMingChangLiang , XuTong step this WenJian SCREENSHOT_CATEGORIES; DEFAULT_CLEANUP_MAX_AGE_SECONDS LaiZi constants, Wu in this WenJianGaiMoRenZhi . 

### 1.2 Yi by WuJie or GaiCuo Yuan because 

1. **category PinXie or key not YiZhi **: if Diao use clean_older_than("login_try_screenshot") and key for "login_try", get_dir FanHui None, clean FanHui 0 Qie no BaoCuo , YiWu to for YiQingLi . 
2. ** ChangLiangLaiYuanBianGeng **: if LOGIN_TRY_SCREENSHOT_DIR etc. QianYi to BieChu or GaiMing , this WenJianWeiTong step Hui ImportError or ZhiXiangCuoWu directory . 
3. **register_category and MoRen categories**: if Qi it module register_category ZhuCeXinLeiBie , Xu use XiangTong name Diao use get_dir/clean_older_than, FouZeRengQu not to . 
4. **clean not DiGui **: sub directory within WenJian not Hui by ShanChu , if Wu to for " AnLeiBieQingLi " HuiQing sub directory , HuiLouShan or XuLingXieLuoJi . 

### 1.3 ZhengQueZuoFa 

- Diao use clean_older_than/get_dir when use SCREENSHOT_CATEGORIES in Yi have key or Yi register_category name; XiuGai constants in LuJingChangLiang when Tong step this WenJian ; XuQingLi sub directory when in Diao use Fang or this module KuoZhanLuoJi and WenDangHua . 

---

## Er , docs/ROSBOT_FIND_LOGIC_LIST.md

### 2.1 ZhiZe and YueDing 

- ** purpose **: **ROSBOT ChaZhaoLuoJiQingDan **, GuiDing unique LiuCheng to ROSBOT_LOOKUP_FLOW.md for Zhun ; ** unique LuoJiRuKou ** for get_rosbot_window, get_rosbot_detection, refresh_rosbot_status, get_running_rosbot_processes ( JunLaiZi rosbot_manager / rosbot_status_provider) ; XuYao "ROSBOT ChuangKou " when ZhiYunXu use to ShangJieKou , ** not Zi line AnBiaoTi or PID QuChuangKou **. WenDangLieChuDangQianDiao use Fang (rosbot_status_provider, rosbot_operation, rosbot_ui_automation, share/threads, window_monitor_timer, bottom_bar, scan_rosbot_running, test_rosbot_window_ui etc. ) and ** YiFeiQi ** (_obsolete_rosbot_manager, _obsolete_game_process_detector, _obsolete_game_state_manager) , MingQue to ShangFeiQiJun not Can and DangQianChaZhao . 
- ** YueDing **: newly added or XiuGai ROSBOT ChuangKou / JinChengChaZhaoLuoJi when XuZouShangShuRuKou , not in YeWuDaiMa in AnChuangKouBiaoTi or PID ZiShiXian ; FeiQi module not by Yin use ; Diao use FangLieBiao and ROSBOT_LOOKUP_FLOW, ROSBOT_WINDOW_AND_STATUS YiZhi . 

### 2.2 Yi by WuJie or GaiCuo Yuan because 

1. ** ZiShiXianAnBiaoTiChaZhao **: if in RenYi module Xie " AnBiaoTiZhao ROSBOT ChuangKou " or "enum ChuangKouPiPeiBiaoTi ", i.e. WeiFan " ZhiYunXu use get_rosbot_window etc. " YueDing , and ROSBOT_LOOKUP_FLOW not YiZhi . 
2. ** Wu use FeiQi module **: if import _obsolete_rosbot_manager or _obsolete_game_process_detector check_process_running_by_title, detect_rosbot_process etc. , Hui and DangQian "exe unique , no BiaoTiGuoLv " SheJiChongTu . 
3. ** WenDang and DaiMa not Tong step **: if rosbot_manager newly added JieKou or Diao use FangZengJian , this QingDanWeiGengXinHuiDaoZhiWenDang and ShiXianLiangZhangPi , HouXuWeiHuZheAnWenDangXieHuiLou use or Cuo use . 
4. **login_try_screenshot_controller etc. **: WenDangMingQueQiJin use kill_if_running/start, not QuChuangKou ; if in CiLei module in ZengJia " Qu ROSBOT ChuangKou " LuoJi , XuTongGuo get_rosbot_window etc. RuKou , QieXu in this QingDanDiao use Fang in BuChong . 

### 2.3 ZhengQueZuoFa 

- FanXu ROSBOT ChuangKou or ZhuangTai when JinDiao use get_rosbot_window, get_rosbot_detection, refresh_rosbot_status, get_running_rosbot_processes; not Yin use _obsolete_* in ChaZhaoLuoJi ; QingDan and ROSBOT_LOOKUP_FLOW and DaiMaTong step GengXin . 

---

## San , .cache/bn_flow_snapshots/bn_flow_BN_LoginAsia.json

### 3.1 ZhiZe and YueDing 

- ** purpose **: BN LiuChengJieDian **BN_LoginAsia** KuaiZhaoHuanCun , structure Tong bn_flow_B4 etc. : **meta** (node, reason, CiChu node for "BN_LoginAsia", reason for "asia_login") , **controls** ShuZu , every item Han name, automation_id, type, rect (left/top/right/bottom/width/height) , level. use at TiaoShi or HuiFangYaZhouDengLuJieMianKongJianShu . 
- ** YueDing **: XiaoFeiFangKeNengYiLai meta.node, meta.reason or controls name/automation_id/type/rect; WenJianMing and meta.node to Ying (BN_LoginAsia) ; if ShengChengLuoJi or battlenet KuaiZhaoLiuChengBianGeng , meta.reason or controls structure KeNengBianHua , XiaoFeiFangXuJianRong or Tong step GengXin . 

### 3.2 Yi by WuJie or GaiCuo Yuan because 

1. ** WuShan meta or Gai node/reason**: if Jiao this or RenGongGai meta DaoZhi node and WenJianMing not YiZhi , An " WenJianMing i.e. JieDian " ChaZhaoHuiCuo ; reason by XiaoFeiFang use at QuFenJinRuYuan because when , Gai reason HuiYingXiangLuoJi . 
2. **controls structure BianGeng **: if battlenet KuaiZhaoChanChuFangGai char segment Ming or CengJi ( such as rect Gai for bounds) , YiLai this structure JieXiHuiBaoCuo or QuCuo . 
3. **.cache QingLi **: if QingLi .cache or bn_flow_snapshots when Wei confirm is Fou have LuoJiYiLaiGai directory , KeNengPoHuaiTiaoShi or HuiFang . 
4. ** and BN JieDianMeiJuYiZhi **: meta.node Xu and flow_bn_only_state/BNNode or rosbot_flow_battlenet in YaZhouDengLuXiangGuanJieDianMingYiZhi , FouZeLiuChengTu or DaiMa to ZhaoHuiCuo position . 

### 3.3 ZhengQueZuoFa 

- XiuGaiKuaiZhao structure or meta when Xian confirm XiaoFeiFang ( Jiao this , TiaoShiGongJu ) ; QingLi .cache Qian confirm bn_flow_snapshots is Fou by YiLai ; meta.node and project within BN JieDianMingMingBaoChiYiZhi . 

---

## Si , docs/OCR_CNSTD_MODEL_INSTALL.md

### 4.1 ZhiZe and YueDing 

- ** purpose **: CnSTD/CnOCR ** JianCeMoXing ** AnZhuang note . DangChuXian ch_PP-OCRv5_det Zhao not to or Det model init failed when , OCR HuiHuiTui to naive_det ( no KuangJinWen char ) ; YaoHuo ** position Zhi / Kuang ** ( such as CN DengLuDianJi ) XuAnWenDangAnZhuangJianCeMoXing . WenDang note : TuiJianXian use **db_shufflenet_v2_small** (CnSTD YuanSheng , TongChangZiDongXiaZai ) ; if ShiBaiZeAnZhuang cnstd[ort-cpu] or [ort-gpu]; if ZiDongXiaZaiShiBaiKeShouDongCong Hugging Face or BaiDuWangPanXiaZai and Fang to cnstd 1.2 directory ; ** this app YinQingHuiTuiShunXu ** for db_shufflenet_v2_small ch_PP-OCRv5_det naive_det. 
- ** YueDing **: DaiMa in if JiaDing " YiDing have JianCeMoXing " or " YiDing have boxes", in naive_det HuiTui when KeNeng no Kuang , CN DengLu etc. LuoJiXuJianRong " JinWen char no Kuang " when BiLiDianJi etc. JiangJi ; cnstd 1.2 directory LuJing because PingTai and Yi (Windows/Linux/Mac) , WenDangYiXieMing , Jiao this or config Wu hardcode LuJing . 

### 4.2 Yi by WuJie or GaiCuo Yuan because 

1. ** JiaDingJianCeMoXingYiDingCun in **: if DaiMa in OCR ChuShiHuaHouZhiJieQu boxes and WeiPanDuan is Fou naive_det, in WeiAnZhuangMoXingHuanJingXiaHui AttributeError or Qu to Kong . 
2. ** LuJing hardcode **: if AnZhuangJiao this or WenDang in Ba cnstd 1.2 LuJing hardcode for MouYiPingTai , Qi it PingTai use HuAnWenDangCaoZuoHuiFangCuo directory . 
3. ** HuiTuiShunXu and WenDang not YiZhi **: if DaiMa in YinQingXuanZeShunXuGai for Xian ch_PP-OCRv5_det Zai db_shufflenet_v2_small, and WenDang not YiZhiHuiDaoZhi " AnWenDangZhuang RengBaoCuo " or " WenDangShuo use A ShiJi use B". 
4. **onnxruntime and cnstd[ort-*] ChongTu **: WenDangYaoQiu if Yi have onnxruntime Xian uninstall ZaiZhuang cnstd extra, if WeiAnCiCaoZuoKeNengRengShiBai , WenDangWeiQiangDiao when Yi by HuLve . 

### 4.3 ZhengQueZuoFa 

- use OCR JieGuo when PanDuan is Fou have boxes/ position Zhi , no ZeZouBiLi or Wen char PiPei etc. JiangJi ; AnZhuang note and DaiMa in MoXingHuiTuiShunXuYiZhi ; LuJingAnWenDangAnPingTaiQuFen ; QiangDiao onnxruntime and cnstd AnZhuangShunXu . 

---

## Wu , controller/ctl_func/kanai_cube_handler.py

### 5.1 ZhiZe and YueDing 

- ** purpose **: KaNaiMoFangCaoZuoChuLi ( ShengJi , ZhongZhu , HuangZhuangChuLi ) . YiLai **get_game_interface_data()**: interface_type Xu for "kanai_cube", Xu have bag_layout, **window_offset**, **kanai_right_page_opened**; ZuoBiaoTongGuo **get_scaled_kanai_put_material_button, get_scaled_kanai_right_panel_toggle, get_scaled_conversion_button, get_scaled_kanai_next_page_button** and window_offset HuanSuanPingMuZuoBiao ; **get_state_aware_click_handler()** Zhi line DianJi ; **should_stop_assistant()** in FanYe etc. XunHuan in JianCha in Duan . LiuCheng : JiaoYanJieMian and BeiBao _reset_panel_to_first_page ( YiLai kanai_right_page_opened) _navigate_to_page(page_clicks) _process_yellow_items. LuJing project_root for ctl_func ShangJi ShangJi ( i.e. controller) . 
- ** YueDing **: Diao use QianXuBaoZheng game_interface_data YiGengXin (interface_type=kanai_cube, bag_layout, window_offset, kanai_right_page_opened YiShe ) ; get_scaled_* and game_interface_data in BiaoZhunZuoBiao and SuoFangYueDingYiZhi ; not Ying in WeiJiaoYan interface_type and bag_layout when Zhi line CaoZuo ; LuJing and sys.path.insert YiLai controller directory structure , CongBieChuYun line or YiDongWenJianHui import ShiBai . 

### 5.2 Yi by WuJie or GaiCuo Yuan because 

1. ** WeiJiaoYan interface_type or bag_layout**: if ZhiJieDiao use handle_upgrade_operation and DangQianJieMian not KaNai or BeiBaoWeiCaiJi , Hui False or WuDian ; if in Diao use FangWeiXianShuaXin game_interface_data then Diao handler, Yi use JiuShuJu . 
2. **window_offset for Kong **: if WeiZuoChuangKouCaiJi or game_interface_data.window_offset WeiShe , Suo have get_scaled_* + offset PingMuZuoBiaoCuo , DianJiCuo position . 
3. **kanai_right_page_opened WeiWeiHu **: _reset_panel_to_first_page YiLaiGaiZhuangTai , if ShangYouCongWeiXieRu or XieRuCuoWu , ZhongZhiLuoJiHuiWuPanKai / Guan , DaoZhiDuoDianJi or ShaoDianJi toggle. 
4. **get_scaled_* and ChangLiang / SuoFang not YiZhi **: if providor or game_interface_data in KaNaiAnNiuBiaoZhunZuoBiao or SuoFangBiLiBianGeng , this handler WeiTong step HuiDianCuo position Zhi . 
5. **project_root and import**: current_dir for ctl_func, project_root for controller; if WenJianYi to it Chu or Cong repo GenYun line , sys.path.insert(0, project_root) KeNengRengZhiXiangCuoWu , DaoZhi import share/d3utils etc. ShiBai . 

### 5.3 ZhengQueZuoFa 

- Diao use handler QianQueBaoYiDaKaiKaNaiJieMian and ShuaXin game_interface_data (interface_type, bag_layout, window_offset, kanai_right_page_opened) ; XiuGaiKaNaiXiangGuanZuoBiao or SuoFang when Tong step this handler Suo use get_scaled_* LaiYuan ; Cong controller or YueDingRuKouYun line , BiMianLuJingCuo ; XunHuan in BaoChi should_stop_assistant() JianCha . 

---

## Liu , and apology document GuanXi 

if CiQian because WeiXianTongDuShangShuWuChuYueDing ( such as screenshot_categories key and constants, ROSBOT_FIND_LOGIC_LIST unique RuKou and FeiQiWu use , bn_flow_BN_LoginAsia meta/controls and XiaoFeiFang , OCR_CNSTD HuiTuiShunXu and LuJing , kanai_cube_handler interface_type/window_offset/kanai_right_page_opened) and in CiWuChuFanFuGaiCuo or understand PianCha , the responsibility lies with Ji . this note YiXieRu cursor_AI_ apology directory , and in Cursor_ ZhuanShu apology document in ZengJia to this Wen Yin use . 
