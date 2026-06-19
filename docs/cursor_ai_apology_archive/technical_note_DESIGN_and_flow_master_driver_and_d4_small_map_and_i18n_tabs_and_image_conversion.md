# technical note : DESIGN.md, flow_master_driver, d4_small_map_detector, i18n_tabs_en, image_conversion

** Mu **: note this WuChuDaiMa / WenDang ZhiZe , Yi by WuJie or GaiCuo Yuan because , to and ZhengQueYueDing . 

** She and WenJian **: 
- `docs/DESIGN.md`
- `d3utils/rosbot_flow/flow_master_driver.py`
- `d4utils/d4_small_map_detector.py`
- `providor/i18n/i18n_tabs_en.json`
- `d3utils/d3u_common/image_conversion.py`

---

## Yi , docs/DESIGN.md

### 1.1 ZhiZe and YueDing 

- ** purpose **: d3-check ** ZongLan and SuoYin ** SheJiWenDang , and " SheJiWenDang .md"** He and use **; SheJiWenDang .md for Login Try / Battle.net DiaoXianChongQi XiangXiSheJi . DESIGN.md HanGai : LuJing config and YiJianSaoMiao , ColorPrint and UI RiZhiHuiDiao , ZhanWangChongXinDengLuLiangZhongChuFaFangShi , QiDongShunXu (1 ZhanWang 2D33ROSBOT) , ZhuangTaiTiGongZhe , LiuCheng , XianCheng and ShiJian , XiangGuanWenJianSuoYin etc. . WenDang in module LuJing , ChangLiangMing , JieKouMing for ** QuanWeiCanKao **, ShiXianXu and of YiZhi . 
- ** GuanJianYueDing **: QiDongShunXu not KeLuan ; check_window for TongYiDing when / AnNiuRuKou ; CONFIG, BATTLE_NET_WINDOW_TITLES, status provider etc. JianWenDangBiao ; PILBGR WenDangXie for `d3utils.d3u_common.image_utils`, ShiJiShiXian for **image_conversion.py** ( JianXia ) . 

### 1.2 Yi by WuJie or GaiCuo Yuan because 

1. ** WenDang and ShiXianLuJing not YiZhi **: if WenDangXie `image_utils.convert_pil_to_bgr` and DaiMa for `image_conversion.convert_pil_to_bgr`, AnWenDangZhaoHuiZhao not to ; Xu to ShiJiBaoMing for Zhun or GengZhengWenDang . 
2. ** QiDongShunXuWeiFan **: if DaiMaXianQi ROSBOT ZaiQiZhanWang or D3, and 4 ShunXuMaoDun . 
3. **check_window and refresh Hun use **: Ding when Qi and " ShuaXinZhuangTai " AnNiuYingTongYiDiao use check_window(); if in BieChuDanDuXieYiTao refresh LuoJi not JingGuo check_window, Hui and 3.12 SheJi not YiZhi . 
4. ** ChangLiang or module BiaoGuo when **: if newly added / ShanChu module or ChangLiangWeiGengXin DESIGN.md Biao , HouXuDuZheAnWenDangZhaoHuiCuo . 
5. ** LiangDangFenGong not Qing **: XiangXiLiuCheng / ChangLiangYing to SheJiWenDang .md, DESIGN_DETAIL, ROSBOT_FLOW etc. for Zhun ; DESIGN.md for SuoYin and ZongLan , XiJieYin use it Dang . 

### 1.3 ZhengQueZuoFa 

- ShiXian when to DESIGN.md for SuoYin , XiJie to SheJiWenDang .md, DESIGN_DETAIL, INITIAL_STATE_DETECTION etc. for Zhun ; XiuGai module / ChangLiang when Tong step GengXin DESIGN.md in Biao and LuJing ; PILBGR ShiJi use `d3utils.d3u_common.image_conversion.convert_pil_to_bgr`. 

---

## Er , d3utils/rosbot_flow/flow_master_driver.py

### 2.1 ZhiZe and YueDing 

- ** purpose **: Flow-master LiuChengKu (ROSBOT flow master, flow_master_enabled) . YueDing (FLOW_ARCHITECTURE_DIRECTORY 5) : this module DingYi FlowMasterStep, F0Action, ExtensionStepResult, ShangCi F0/extension/F3 ZhuangTai and **tick_flow_master()**; ** Jin rosbot_task_processor Diao use tick_flow_master()**; this module within Diao use refresh/notify and No. SanFangKu , no repetition extension phase MeiJu ( use extension_flow_state.is_idle) . Zhi line ShunXu : REFRESH_NOTIFY (refresh_battlenet if bn_ever_confirmed Ze refresh_d3, refresh_rosbot notify_state_sync) RE_READ_ABORT ( if Wei flow_master_enabled Ze return) EXTENSION_TICK ( if extension Fei idle Ze extension_flow_tick_step) F0_PREJUDGE B1/B2/C1 FenZhi if rosbot_extended_status for running/paused Ze F3_F4 (run_f3_log_timeout, if "f4" Ze run_f4_close_d3_send_f7 + enter_battlenet_at_b2) . 
- **_FM_BN**: Flow-master use for_bn_only=False, and BN-only LuJingQuFen . 

### 2.2 Yi by WuJie or GaiCuo Yuan because 

1. ** DiaoHuan step ShunXu **: if Xian F0_PREJUDGE Zai REFRESH_NOTIFY, ZhuangTaiWeiShuaXin i.e. ZuoYuPan , HuiCuo ; if F3_F4 in Xian enter_battlenet_at_b2 Zai run_f4_close_d3_send_f7, and Mermaid WenDang not Fu . 
2. ** LouDiao enter_battlenet_at_b2**: F4 HouBiXu enter_battlenet_at_b2(_FM_BN), FouZe not HuiHui to B2_HasWin; if Gai for return or continue and not Diao use enter_battlenet_at_b2, LiuChengDuan . 
3. ** in tick WaiDiao use refresh**: YueDing for " this module Diao use refresh"; if in tick_flow_master WaiLingQiXianCheng or Ding when QiDanDu refresh Qie and task_processor tick not Tong step , KeNengChongFu or JingTai . 
4. ** XiuGai F0Action or FenZhiYuYi **: if B1/B2/C1 FanHuiZhi or HanYi and run_f0_prejudge_entry, ROSBOBOT_FLOW WenDang not YiZhi , FenZhiHuiZouCuo . 
5. **ExtensionStepResult and extension_flow_tick_step**: SUCCESS/FALLTHROUGH and extension module YueDingYiZhi ; if GaiFanHuiZhiWeiTong step , trigger_extension_rosbot_started HuiWuPan . 

### 2.3 ZhengQueZuoFa 

- Jin by rosbot_task_processor Diao use tick_flow_master(); not DiaoHuan REFRESH_NOTIFY RE_READ_ABORT EXTENSION_TICK F0 F3_F4 ShunXu ; F4 HouBiDing enter_battlenet_at_b2; and FLOW_ARCHITECTURE_DIRECTORY, ROSBOT_FLOW_MERMAID YiZhi . 

---

## San , d4utils/d4_small_map_detector.py

### 3.1 ZhiZe and YueDing 

- ** purpose **: D4 Xiao TuJianCe , PanDuan is Fou in ChengZhen (Town) or XiaCheng (Dungeon) . YiLai D4_TEMPLATE_CONFIGS["d4_small_map"], D4_STANDARD_COORDS.minimap_region_start/end, calculate_unified_scaled_coordinate, get_d4_interface_data().screenshot_data.game_window_image; Diao use template_matcher.match_template_in_region("d4_small_map", "minimap", use_shared_region=True). JieGuoXieHui d4_data.small_map_detection, small_map_detection_timestamp. 
- **_update_shared_data**: DangQianShiXianHui ** FuGai ** `d4_data.detected_regions` for JinHan `location_type`, `is_in_town` char Dian ; if Qi it LuoJi ( such as map_name_recognizer) YiLai detected_regions in region_images, Map Name etc. , Hui by QingDiaoDaoZhiYiChang . 

### 3.2 Yi by WuJie or GaiCuo Yuan because 

1. ** FuGai detected_regions**: _update_shared_data in `self.d4_data.detected_regions = {"location_type": ..., "is_in_town": ...}` HuiDiuDiaoYuan have region_images etc. ; if and region_detector, map_name_recognizer Gong use detected_regions, Ying ** He and ** XieRu and FeiZhengTiTiHuan . 
2. **screenshot_data Wei then Xu **: detect_small_map YiLai screenshot_data.game_window_image; if Diao use FangWeiXianZhi line JieTu and collect, screenshot_data for Kong , ZhiJieFanHuiShiBai . 
3. **minimap QuYu and D4_STANDARD_COORDS**: if D4 BiaoZhunZuoBiao or minimap_region DingYiBianGengWeiTong step , CaiJianQuYuCuo position . 
4. **template_config QueShi **: if D4_TEMPLATE_CONFIGS no "d4_small_map", __init__ in template_config for None, HouXu use HuiYiChang ; DangQian __init__ in return HouWeiZuZhiHouXuDiao use , KeNengReng have ShuXingFangWen . 
5. **match_template_in_region YueDing **: region_name="minimap", use_shared_region=True and D4ScaledTemplateMatcher region DingYiYiZhi ; if matcher Ce region Ming or GongXiangShuJu structure BianHua , CiChuXuTong step . 

### 3.3 ZhengQueZuoFa 

- GengXin shared data when not YaoZhengTiFuGai detected_regions, YingZhiGengXin small_map XiangGuan char segment or and detected_regions He and ( such as detected_regions["location_type"] = ...) ; Diao use QianQueBao screenshot_data Yi by ShangYouTianChong ; D4_TEMPLATE_CONFIGS, minimap region and matcher YueDingYiZhi . 

---

## Si , providor/i18n/i18n_tabs_en.json

### 4.1 ZhiZe and YueDing 

- ** purpose **: Tab/ JiaoZhun / ZuoBiaoShiQuXiangGuanYingWenWenAn , structure for **ui.coord_calibration.***, **ui.yolo_collect.***, **ui.coord_picker.***. Gong i18n_manager An key QuWen this ; DaiMaXu use and JSON YiZhi key LuJing . 
- ** and coordinate_picker_window**: coordinate_picker_window use ui.coord_picker.* (window_title, menu_title, pick_type_point, history_col_id etc. ) ; if JSON in key GaiMing or QueShi , HuiXianShi key or CuoWenAn . 

### 4.2 Yi by WuJie or GaiCuo Yuan because 

1. **key LuJing not YiZhi **: if DaiMa use ui.coord_picker.window_title and JSON for ui.coordinate_picker.title, HuiQu not to . 
2. ** newly added / ShanChu key WeiTong step **: in UI in newly added WenAn but Wei in i18n_tabs_en.json in Bu key, or ShanChu key WeiGaiDaiMa . 
3. ** DuoYuYan not Tong step **: if Cun in i18n_tabs_zh.json, ZhiGaiYingWenWeiGai in Wen , or structure not YiZhi . 
4. **coord_calibration vs coord_picker**: Liang MingMingKongJian , JiaoZhun panel use coord_calibration, ShiQuChuangKou use coord_picker; WuHun use . 

### 4.3 ZhengQueZuoFa 

- ZengShanGai Tab/ JiaoZhun / ZuoBiaoShiQuXiangGuanWenAn when , JSON and Suo have get_ui_text Diao use Tong step ; key and ui.coord_calibration.*, ui.coord_picker.*, ui.yolo_collect.* YiZhi ; DuoYuYan JSON structure YiZhi . 

---

## Wu , d3utils/d3u_common/image_conversion.py

### 5.1 ZhiZe and YueDing 

- ** purpose **: TongYiTuXiangGeShiZhuanHuan : **normalize_image_to_bgr** ( LuJing /PIL/ndarray BGR) , **normalize_image_to_rgb_pil** ( RGB PIL) , **ensure_rgb_mode**, **convert_pil_to_bgr** (PILBGR, ZhiChi RGB/RGBA, QuQian 3 TongDao ) , **convert_bgr_to_pil**. battlenet_template_matcher, d3_start_game_and_teleport_waiter, d4_team_health_detector etc. use this module . DESIGN.md in Xie for image_utils, ShiJiWenJianMing for **image_conversion**. 
- ** YueDing **: PIL Shi for RGB or RGBA (convert_pil_to_bgr use :3 TongDaoZai cvtColor RGB2BGR) ; **normalize_image_to_bgr** to ndarray ** not ** ZuoYanSeKongJianZhuanHuan , ZhiJieFanHui , if ChuanRu Yi is RGB HuiDang BGR use DaoZhiSePian . 

### 5.2 Yi by WuJie or GaiCuo Yuan because 

1. ** WenDangLuJingCuoWu **: DESIGN.md Xie `d3utils.d3u_common.image_utils.convert_pil_to_bgr`, ShiJi for **image_conversion**; if AnWenDang import image_utils Hui ImportError. 
2. **PIL Fei RGB/RGBA**: if PIL for L or Qi it mode, convert_pil_to_bgr :3 or cvtColor KeNengCuo ; Diao use FangYingBaoZhengChuanRu RGB/RGBA or Xian convert. 
3. **normalize_image_to_bgr to ndarray**: DangQian to np.ndarray ZhiJie return, not PanDuan is BGR Hai is RGB; if ShangYouChuanRu RGB ShuZuHuiDang BGR use , XuDiao use FangBaoZhengChuanRu BGR or Gai use convert LuoJi . 
4. ** and image_annotator_helper FenGong **: this module ZhiZuoGeShiZhuanHuan ; TiaoShiTuBaoCun etc. in image_annotator_helper; Wu in image_conversion LiJiaBaoCunLuoJi . 

### 5.3 ZhengQueZuoFa 

- TongYiCong **d3utils.d3u_common.image_conversion** DaoRu convert_pil_to_bgr, normalize_image_to_bgr etc. ; DESIGN.md in LuJingGai for image_conversion; ChuanRu PIL when BaoZheng RGB/RGBA; ChuanRu ndarray when MingQueYueDing for BGR or in this module within AnYueDingZhuanHuan . 

---

## Liu , and apology document GuanXi 

if CiQian because ShangShuRenYiDian ( such as DESIGN.md and ShiXianLuJing not YiZhi , flow_master step ShunXu or F4 HouLou enter_battlenet_at_b2, d4_small_map FuGai detected_regions, i18n_tabs key and DaiMa not YiZhi , image_conversion and DESIGN in image_utils Hun use ) DaoZhiFanFuGaiCuo or understand PianCha , KeShi for WeiXianTongDuYueDingSuoZhi . this note YiXieRu cursor_AI_ apology directory , and in Cursor_ ZhuanShu apology document .md in ZengJia to this Wen Yin use . 
