# technical note : battlenet_ui_inspector.py, asia_credentials.py, _obsolete_game_state_manager.py, i18n_auxiliary_panel_en.json

this note Zhen to to XiaSiChu : XiuGaiQianQingXianTongDu this note and to YingYuanMa / WenJian . 

- `d3utils/battlenet_ui_inspector.py`
- `share/asia_credentials.py`
- `utils/_obsolete_game_state_manager.py`
- `providor/i18n/i18n_auxiliary_panel_en.json`

---

## Yi , d3utils/battlenet_ui_inspector.py

- ** purpose **: ZhanWang UI KongJianFenLei , QuFen " ZhuChuangKouBiaoTiLanGuanBiAnNiu " and " XuanFuDanChuangGuanBiAnNiu "; Gong try_close_popup etc. use . is_main_window_close_button(automation_id) for True when not DianJi ( HuiGuanDiaoZheng KeHuDuan ) ; is_popup_close_button_by_automation_id, is_popup_close_button_by_name use at ShiBieDanChuangGuanBi ; filter_popup_close_controls CongKongJianLieBiaoShaiChuJinDanChuangGuanBiAnNiu ( PaiChuZhuChuangKouGuanBi ) . 
- ** YueDing **: YiLai providor.constants.common BATTLE_NET_POPUP_CLOSE_AUTOMATION_IDS, BATTLE_NET_POPUP_CLOSE_NAME_KEYWORDS, BATTLE_NET_MAIN_WINDOW_FRAME_AUTOMATION_ID_SUBSTRINGS. ZhuChuangKouGuanBiPanDing : aid XuTong when Han MAIN_WINDOW_FRAME in Mou item QieHan "winCloseButton"; DanChuangGuanBiXianAn automation_id PiPei , ZaiAn name (Close/ GuanBi ) PiPei , QiePaiChuZhuChuangKouGuanBi . 
- ** YiCuoDian **: if common in ChangLiangJinHanFuJi container not Han winCloseButton, Ze is_main_window_close_button KeNengYongYuan not ChengLi , try_close_popup KeNengWuDianZhuChuangKouGuanBi ; filter_popup_close_controls in aid for Kong when is_main_window_close_button(aid) for False, KeNengBaZhuChuangKouGuanBiAnNiuDangDanChuangJiaRu ; Gai common ChangLiangWeiTong step this WenJianHuiLuoJiCuo ; ZhanWang UI GaiBan automation_id BianHuaXuTong step ChangLiang . 
- ** ZhengQueZuoFa **: Gai common in BATTLE_NET_* ChangLiang when Tong step this WenJian ; ZhuChuangKouGuanBiPanDing and ZhanWangShiJi automation_id ShuYiZhi ; BianJieQingKuang ( Kong aid, Kong name) MingQueYueDing ; XiuGaiQianQingXianTongDu this note and providor/constants/common.py. 

---

## Er , share/asia_credentials.py

- ** purpose **: ZhanWangYaFu / GuoFuZhangHaoMiMa ; An region (REGION_ASIA/REGION_CN) DuXie config ; MiMaJiaMiCunChu , JieMiDuQu (pycore.pyutils.security) ; CONFIG Jian battlenet_asia_credentials, battlenet_cn_credentials; DanChuang _show_credentials_dialog (region XiaLa , ZhangHao , MiMa , OK/Cancel) ; schedule_battlenet_credentials_dialog in ZhuXianChengDiaoDuDanChuang ; _asia_credentials_dialog_pending for True when tick etc. YingTiaoGuoZhi to DanChuangGuanBi . 
- ** YueDing **: get_credentials(region) FanHui (email, password) or None; save_credentials(region, email, password) JiaMi password HouXieRu config ; get_app_root() Qu Tk Gen , root.after(0, ...) in ZhuXianChengXianShiDanChuang ; REGION_LABELS for ((" YaFu ", REGION_ASIA), (" GuoFu ", REGION_CN)); BN flow XuYaoZhangHao when Diao use schedule_asia_credentials_dialog or schedule_battlenet_credentials_dialog(default_region). 
- ** YiCuoDian **: Gai CONFIG JianMingWei and get_config_value_safe, set_config_value_safe and template_config MoRen structure Tong step HuiDu not to or XieCuo ; Gai region MeiJu or REGION_LABELS Wei and DanChuangXiaLa and _config_key_for_region Tong step HuiJianCuo ; in FeiZhuXianChengZhiJieDiao use _show_credentials_dialog Hui Tk Cuo ; is_asia_credentials_dialog_pending Wei in DanChuangDaKai / GuanBi when ZhengQueSheHuiDaoZhi tick not TiaoGuo ; decrypt ShiBai when get_credentials FanHui None, DanChuangHuiZaiTiShiShuRu . 
- ** ZhengQueZuoFa **: Gai config Jian or region when Tong step asia_credentials, template_config, BN flow in perform_asia_email_step/perform_asia_password_step Diao use Fang ; JinTongGuo schedule_* in ZhuXianChengXianShiDanChuang ; XiuGaiQianQingXianTongDu this note and providor.providor_index get/set_config_value_safe. 

---

## San , utils/_obsolete_game_state_manager.py

- ** purpose **: WenJianMingDai _obsolete_, BiaoShi ** YiFeiQi **. Yuan for Diablo III and RoS-BoT TongYiZhuangTaiGuanLi : GameStateManager, ProcessState, check_diablo_status, check_rosbot_status, should_start_diablo, should_start_rosbot, get_system_status. YiLai CONFIG (monitoring, ros_settings) , GameProcessDetector, **utils.rosbot_manager.RoSBotManager**. 
- ** YueDing **: utils Xia no rosbot_manager.py ( Jin have _obsolete_rosbot_manager) , import RoSBotManager Hui ImportError or for FeiQiLian . ZhuLiuChengZhuangTai and QiDongJueCe by **rosbot_status_provider**, **flow (process_task, flow_state) **, **d3utils/rosbot_manager** FuZe , not by CiWenJianJueDing . not in ZhuLiuCheng or panel in Diao use GameStateManager as ZhuangTai or QiDongYiJu . 
- ** YiCuoDian **: DangZuoZhuLiuChengZhuangTai or QiDongJueCeRuKouHuiRaoGuo flow and rosbot_status_provider; in CiWenJian within newly added method or Xiu CONFIG QiWangZhuChengXuShengXiaoZeZhuLiuCheng not HuiDiao use ; and rosbot_status_provider HunXiao ( DangQian ROSBOT ZhuangTai by refresh_rosbot_status Xie game_interface_data) ; ShanWenJianQianWei grep HuiDaoZhiCanLiuYin use ImportError. 
- ** ZhengQueZuoFa **: ZhuLiuCheng not Yin use _obsolete_game_state_manager; ROSBOT ZhuangTai use rosbot_status_provider + game_interface_data; QiDongJueCe use flow_state and process_task; ShanQianBi grep; XiuGaiQianQingXianTongDu this note and technical note _bn_flow_B5 and obsolete_game_state and rosbot_status_provider and ctl_func and d4_controller.md. 

---

## Si , providor/i18n/i18n_auxiliary_panel_en.json

- ** purpose **: FuZhuGongNeng panel YingWenWenAn ; structure ui.auxiliary_functions.*, ui.auxiliary_panel.*, ui.bag_offset.*; and i18n_auxiliary_panel_zh.json Cheng to ; DaiMa use get_ui_text("ui.auxiliary_panel.xxx") etc. . 
- ** YueDing **: Jian and zh and DaiMa in get_ui_text LuJingYiZhi ; newly added or ZhongMingMing key Xu en and zh Tong step , FouZeYingWenJieMianHuiXianShi key or KongBai ; ShuYu (Kanai, Blood Shard, Forgotten Soul etc. ) and ChanPin and D3 use YuYiZhi . 
- ** YiCuoDian **: in zh in newly added or ZhongMingMingJian and en WeiTong step HuiYingWenXianShi key; structure ui.auxiliary_functions and ui.auxiliary_panel LiangCengXu and zh and get_ui_text ChaZhaoLuJingYiZhi ; CeLve / Xuan item Zhi if use in WenZhanShi and within Bu use YingWen key Xu and main_functions_panel, ConfigBinding YingSheYiZhi . 
- ** ZhengQueZuoFa **: ZengShan key when en and zh Tong step ; JianLuJing and get_ui_text("ui.auxiliary_panel.xxx") YiZhi ; XiuGaiQianQingXianTongDu this note and technical note _debug_window_offset and extension_flow_tick_step and i18n_auxiliary_panel_en.md. 

---

## Wu , SiChu and apology document to Ying 

this note to YingZhuanShu apology document ** No. WuShiJiuJie ** and ZhangWen apology in " then battlenet_ui_inspector, asia_credentials, _obsolete_game_state_manager, i18n_auxiliary_panel_en SiChu " of FenXi and apology segment . FaXianShangShuSiChuWenJian when , Ying continue GengXin to apology document ( technical note , ZhuanShuJie , ZhangWenZhuiJia ) . 
