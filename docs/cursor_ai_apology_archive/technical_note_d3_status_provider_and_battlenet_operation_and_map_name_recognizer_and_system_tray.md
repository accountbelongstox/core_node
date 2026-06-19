# technical note : d3_status_provider, battlenet_operation, map_name_recognizer, system_tray

** Mu **: note you ZhiDingChaYue to XiaSiChuWenJian ZhiZe , Yi by WuJie or GaiCuo Yuan because , to and ZhengQueYueDing . 

** She and WenJian **: 
- `d3utils/d3_status_provider.py`
- `d3utils/battlenet_operation.py`
- `controller/d4func/map_name_recognizer.py`
- `ui/components/system_tray.py`

---

## Yi , d3utils/d3_status_provider.py

### 1.1 ZhiZe and YueDing 

- ** purpose **: D3 ChuangKouJianCe and DongTaiZhuangTai (on_login_screen, disconnected, in_game) . Fu use status_provider_common.refresh_window_state; ZiShenTiGong _find_d3_windows, _detect_d3_dynamic, _apply_d3_geometry. **disconnected** by capture_and_detect_all_d3_states YiCiJieTu , use D3_DISCONNECTED_TEMPLATE_NAME (SIFT) PanDing ; DangQian _detect_d3_dynamic JinFanHui (False, disconnected, False), on_login_screen and in_game Wei in CiShiXian . 
- ** YueDing **: refresh_d3_status(skip_dynamic=True) JinZhaoChuangKou and JiHe , not JieTu /SIFT, use at QiDong or ShouDongShuaXin ; flow use skip_dynamic=False. JinDang window_info Cun in QieWei skip_dynamic when Cai prime_window_cache_for_capture. ShuJuXieRu game_interface_data (set_d3_status, set_d3_dynamic_status, fullscreen_size, window_offset, _window_hwnd/_window_title) . 

### 1.2 Yi by WuJie or GaiCuo Yuan because 

1. JiaDing on_login_screen or in_game by this module FanHui True, DangQianShiXianHeng for False, HuiWuDaoDiao use Fang . 
2. XiuGai refresh_window_state set_running_fn/set_dynamic_fn/apply_geometry_fn QianMingWei and status_provider_common YiZhiHuiBaoCuo . 
3. in skip_dynamic for True when Diao use prime_window_cache_for_capture HuiDuoYu or and ZhuShi " Jin in have ChuangKouQieWei skip_dynamic when " MaoDun . 
4. get_d3_manager().get_capture_titles() and find_windows YueDingYiZhi , Gai d3_manager WeiTong step HuiChuanCuo titles. 

### 1.3 ZhengQueZuoFa 

- XiuGai D3 ZhuangTaiLiuChengQianTongDu status_provider_common; disconnected LuoJiYiLai capture_and_detect_all_d3_states and D3_DISCONNECTED_TEMPLATE_NAME; and flow to skip_dynamic use YiZhi . 

---

## Er , d3utils/battlenet_operation.py

### 2.1 ZhiZe and YueDing 

- ** purpose **: ZhanWangCaoZuoTongYiRuKou : QiTing , JiHuoChuangKou , MeiJuKongJian , Dian D3 BiaoQian / KaiShiYouXi , GuoFuDengLuLiuCheng , ZhuangTaiPanDuan . Fu use BattleNetManager ( JinCheng / ChuangKou ) , UI Automation ( KongJianMeiJu and DianJi ) . ** QuYu **: region for asia/cn when Jin use GaiQu ; for None when by _resolve_battlenet_region() Cong game_interface_data.get_battlenet_region() or config ros_settings.battlenet_region_cache JieXi . ** ZhuangTaiPanDuan **: YiLvJing build_judge_from_controls(controls), Wu in Operation within ZiShiXian " is FouDengLu / is FouZhuJieMian " etc. (BATTLENET_REGION_DESIGN_REVIEW DanYiZhenXiangYuan ) . D3 BiaoQian use **exact_match=True** BiMian game-nav-btn-D34 (D4) by game-nav-btn-D3 PiPei . login-failed TeZhengCong BN_FLOW_SNAPSHOTS_DIR Xia bn_flow_*.json JiaZai ; ChangLiangLaiZi providor.constants.common and providor.constants.d3. _enumerate_controls_light Dai module Ji TTL HuanCun (BN_CONTROLS_LIGHT_CACHE_TTL_SEC=2.0) , Tong tick within BN flow Fu use YiCiMeiJu . 

### 2.2 Yi by WuJie or GaiCuo Yuan because 

1. in BattlenetOperation within ZiShiXian " is Fou in DengLu / is FouZhuJieMian " HuiPoHuai BattlenetRegionJudge DanYiZhenXiangYuan . 
2. Gai D3_TAB_AUTOMATION_IDS, START_GAME_*, LOGIN_* etc. ChangLiangWeiTong step providor.constants HuiZhaoCuoKongJian . 
3. find_control_by_automation_id use substring when HuiBa D4 PiPeiCheng D3, Gu click_d3_tab etc. BiXu exact_match=True. 
4. _load_login_failed_features_from_snapshots YiLai bn_flow_*.json controls and BATTLE_NET_LOGIN_FAILED_KEYWORDS; Gai JSON structure or GuanJianCiWeiTong step HuiLouPan . 
5. _get_dynamic_state_one_walk and build_judge_from_controls LiangLuJing (region YiZhi vs WeiZhi ) ; GaiQiYiWeiGaiLingYiHuiZhuangTai not YiZhi . 
6. perform_cn_login_flow, perform_asia_* WeiTuo BattlenetAsiaOps; Wu in Operation within ChongFuShiXianYaFuYouXiang / MiMa step . 

### 2.3 ZhengQueZuoFa 

- Suo have " DangQian is ShenMe " Jing build_judge_from_controls; DianJi D3 BiaoQian /Play use exact_match BiMian D4; ChangLiang and providor.constants YiZhi ; YaFuLuoJiJinTongGuo _asia_ops; XiuGaiQianTongDu BATTLENET_REGION_DESIGN_REVIEW, DengLuHou ZhanWangYuanSu - KongJian note , POST_LOGIN_BATTLENET_CONTROLS. 

---

## San , controller/d4func/map_name_recognizer.py

### 3.1 ZhiZe and YueDing 

- ** purpose **: D4 TuMingShiBie . Jin in **is_post_switch_idle** for True when ChangShiShiBie ; Cong get_d4_interface_data().detected_regions['region_images']['Map Name'] QuTu ; CnOCR ShiBieHouJing set_current_map_name XieHuiGongXiangShuJu ; ShiBieChengGong or Da max_recognition_attempts HouZhongZhi is_post_switch_idle. OCR config LaiZi get_ocr_config_for_task('map_name'); CnOCREngine Cong pyutils.ocr_cnocr_engine DaoRu (current_dir ShangSu and sys.path ChaRu pycore) . DanLi get_map_name_recognizer(). 

### 3.2 Yi by WuJie or GaiCuo Yuan because 

1. in is_post_switch_idle for False when Diao use recognize_map_name HuiZhiJie return False, if Diao use FangJiaDing " every CiDiao use all HuiShiBie " HuiWuPan . 
2. detected_regions or region_images or 'Map Name' JianQueShi / GengMingWeiTong step Hui AttributeError or KeyError. 
3. XiuGai ocr_config task Ming ('map_name') WeiTong step get_ocr_config_for_task HuiQu not to config . 
4. current_dir = Path(__file__).parent.parent.parent for d4func FuJi (controller) ; if project structure Bian , ShaoYiCeng parent HuiDaoRuShiBai . 
5. _recognize_with_cnocr use Lin when WenJianChuan CnOCR; if CnOCREngine Gai for ZhiChi within CunJieKouWeiTong step this ChuHuiDuoYuXiePan . 

### 3.3 ZhengQueZuoFa 

- Jin in is_post_switch_idle for True when YiLaiShiBieJieGuo ; detected_regions structure by region_detector etc. XieRu , WuDanFangMianGaiJianMing ; ocr_config task and get_ocr_config_for_task YiZhi ; LuJing and pycore DaoRu and project structure YiZhi . 

---

## Si , ui/components/system_tray.py

### 4.1 ZhiZe and YueDing 

- ** purpose **: XiTongTuoPan (Windows 10/11) . **Icon and run() in TuoPanXianCheng within ChuangJian and Zhi line **, to ManZu " Yong have TuBiao XianChengYun line XiaoXiXunHuan " Windows YaoQiu . CaiDan item TongGuo **runtime** trigger_window_show, trigger_window_maximize, trigger_app_restart, trigger_app_exit and ZhuXianChengTongXin ; no trigger when fallback to parent_ui.root ( Xu in ZhuXianChengDiao use or TongGuoShiJianPaiFa ) . set_show_callback/set_exit_callback for **no-op**, ShiJi use event center. i18n Jian : system_tray.show_software, maximize, restart, exit; main_window.title. TRAY_AVAILABLE YiLai pystray, PIL. run() within pythoncom.CoInitialize(). ** not in TuoPanXianCheng within ZhiJieCaoZuo Tk or ZhuChuangKou **, XuTongGuo trigger_* or after HuiZhuXianCheng . 

### 4.2 Yi by WuJie or GaiCuo Yuan because 

1. in CaiDanHuiDiao _show_window, _maximize_window etc. within ZhiJieCaoZuo parent_ui.root QieGaiHuiDiao in TuoPanXianChengZhi line , HuiKuaXianChengFangWen Tk, BengKui or WeiDingYi line for ; Xu use trigger_* or ZhuXianCheng after. 
2. ShiXian set_show_callback/set_exit_callback Hui and DangQian " use event center" SheJiChongTu , if WaiBuJiaDingHuiDiao by Diao use HuiShiXiao . 
3. XiuGai runtime trigger_* Ming or QianMingWeiTong step this module HuiDuanLian . 
4. i18n Jian system_tray.* and main_window.title Xu and i18n WenJianYiZhi . 
5. icon.run() ZuSeTuoPanXianCheng ; in run() within ZuoZhongHuoHuiKaZhuTuoPan , YingJinQingLiangLuoJi or PaiFa to ZhuXianCheng . 

### 4.3 ZhengQueZuoFa 

- TuoPanXianCheng within JinChuangJian icon, run XiaoXiXunHuan and Diao use trigger_*; ZhuChuangKouCaoZuoYiLvJing runtime or ZhuXianCheng after; Wu in set_show_callback/set_exit_callback within ShiXianLuoJi ; and THREAD_BUS_AND_REGISTRY, runtime ShiJian in XinYueDingYiZhi . 

---

## Wu , and apology document GuanXi 

CiQian if because WeiXianTongDuShangShuSiChuYueDing and in CiSiChuFanFuGaiCuo or understand PianCha , the responsibility lies with Cursor. this note YiXieRu cursor_AI_ apology directory , and in Cursor_ ZhuanShu apology document .md No. SiShiSanJie in Yin use , XiuGaiQianQingXianTongDu this note . 
