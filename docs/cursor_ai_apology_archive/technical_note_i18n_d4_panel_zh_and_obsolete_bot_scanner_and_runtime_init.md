# technical note : i18n_d4_panel_zh.json, _obsolete_bot_scanner.py, runtime/__init__.py

** Mu **: note you ZhiDingChaYue to XiaSanChuWenJian ZhiZe , Yi by WuJie or GaiCuo Yuan because , to and ZhengQueYueDing . 

** She and WenJian **: 
- `providor/i18n/i18n_d4_panel_zh.json`
- `utils/_obsolete_bot_scanner.py`
- `runtime/__init__.py`

---

## Yi , providor/i18n/i18n_d4_panel_zh.json

### 1.1 ZhiZe and YueDing 

- ** purpose **: D4 panel in WenWenAn . structure : **ui.d4_panel** (title, sub_tabs.exp_farming, exp_farming.*, debug_window.*, game_status.* etc. ) ; GenXiaLing have **team_health** (local_map, non_local_map, same_map, group1, group2, member, members, total, detection_summary, hp_offset, screen_position etc. ) . DaiMaTongGuo i18n_manager/get_ui_text An key DuQu ( such as "ui.d4_panel.title", "ui.d4_panel.exp_farming.start_button") ; if i18n JiaZaiFangShi for AnWenJianHe and MingMingKongJian , Xu confirm team_health key QianZhui and DaiMaYiZhi . 
- ** YueDing **: key and DaiMa in get_ui_text char FuChuanYiZhi ; and i18n_d4_panel_en.json key structure to Qi ; not SuiYiGai key Ming or CengJiDaoZhiDaiMaQu not to or QuCuo . XiangJian this directory ** technical note _coordinate_picker_improvements and _obsolete_window_activator and ROSBOT_FLOW Liang item Xian and i18n_d4_panel_zh.md** No. SiJie . 

### 1.2 Yi by WuJie or GaiCuo Yuan because 

1. **key and DaiMa not YiZhi **: DaiMaXie get_ui_text("ui.d4_panel.game_status.xxx") and JSON ShaoYiCeng or PinXieCuoWu , HuiXianShi key or QueYi . 
2. ** in YingWen key not Tong step **: i18n_d4_panel_en and zh key JiHe or CengJi not Tong when , QieHuanYuYan when Que item or fallback CuoWu . 
3. **team_health position Zhi **: team_health and ui and Lie at Gen ; if i18n_manager YueDingSuo have UI WenAn in "ui." Xia , Ze team_health KeNengXuQianRu ui.team_health or DanDuMingMingKongJian , FouZeDaiMaCeKeNeng use "ui.team_health.xxx" Qu not to . 
4. ** QianTao and LeiXing **: JSON in Zhi for char FuChuan ; if WuXie for ShuZu or to XiangQieDaiMaAn char FuChuan use , HuiBaoCuo or XianShiYiChang . 

### 1.3 ZhengQueZuoFa 

- ZengShanGai key when Tong step DaiMa in get_ui_text and i18n_d4_panel_en; confirm i18n_manager to MingMingKongJian and WenJianHe and GuiZeHou , ZaiJueDing team_health is FouFang in ui Xia ; BaoChiZhi for char FuChuanLeiXing . 

---

## Er , utils/_obsolete_bot_scanner.py

### 2.1 ZhiZe and YueDing 

- ** purpose **: this WenJian to **\_obsolete\_** QianZhuiBiaoMing for ** YiFeiQi ** Bot SaoMiaoQi . DiGuiSaoMiao bot_base_dir Zhao RoS-BoT.exe, AnXiuGai when JianXuanZuiXin directory , TuiDuan boot QiDong use exe (_find_other_exe_files, _determine_boot_exe_name) ; and DangQian **rosbot_manager** "ros_directory, AnJinCheng exe in directory XiaZhaoChuangKou " LuoJi ** not Tong **. ZhuLiuChengYing use rosbot_manager and ros_settings.ros_directory, not YingYin use BotScanner. 
- ** YueDing **: ShanChuQianBiXu grep confirm no import or Jiao this Yin use ; not in Xian have LiuCheng in Hun use BotScanner and rosbot_manager LiangTao " Zhao ROS directory " YuYi . XiangJian this directory ** technical note _i18n_skill_config and _obsolete_bot_scanner and FLOW_STATE_OWNERSHIP and template_config.md** No. ErJie . 

### 2.2 Yi by WuJie or GaiCuo Yuan because 

1. ** and rosbot_manager HunXiao **: BotScanner.scan_for_bot_directory FanHui bot_dir, boot_exe_name, other_exe_files; rosbot_manager use ros_directory, get_rosbot_window etc. , FanHuiZhi and YuYiJun not Tong , Hun use HuiDaoZhi line for and config not YiZhi . 
2. ** ShanChuWei grep**: if Wei confirm no Yin use i.e. ShanChu , HuiDaoZhi ImportError. 
3. **boot exe TuiDuanQiFaShi **: _determine_boot_exe_name in Duo exe when AnGuDingGuanJianCi (rbassist, bot, assist, helper) PiPei , WeiPiPeiZeQu other_exe_files[0], in Duo exe directory XiaKeNengXuanCuo . 
4. **bot_base_dir WeiJiaoYan for directory **: Jin exists(), Wei is_dir(), if ChuanRuWenJianLuJingZe os.walk not BaoCuo but not HuiBianLi , FanHui "No RoS-BoT.exe found" YiWuDao . 
5. ** YiLai utils.color_print**: and project pycore ColorPrint KeNengFeiTongYi module ; this WenJian for FeiQiGuWeiGai , but if Wu in XinDaiMa in Yin use BotScanner HuiLianDaiYin use utils.color_print. 

### 2.3 ZhengQueZuoFa 

- not in CiWenJianZengJiaGongNeng ; She and " Zhao ROS directory " when to rosbot_manager and ros_settings.ros_directory for Zhun ; ShanChuQian grep confirm no Yin use ; if Xu in WenDang in Lie _obsolete_ XuZhuMingShanChuQianXu grep and and rosbot_manager YuYi not Tong . 

---

## San , runtime/__init__.py

### 3.1 ZhiZe and YueDing 

- ** purpose **: ** DanYiMenMian **, Gong main, controller, ui etc. XiaoFeiZheTongYiCong runtime HuoQu : XiTongChuShiHua get_system_initializer; GuanJi execute_shutdown, is_shutdown_requested, request_shutdown, request_restart, is_restart_requested; ShiJian in Xin register_main_thread_handlers, register_extension_handlers, trigger_*; RenWuXianCheng get_task_manager, TaskStatus; XianChengZhuCe get_thread_registry. ShiXianFenBu in d3utils (event_center, shutdown_manager, system_initializer, task_thread_manager) and runtime (thread_registry) , XiangJian docs/CODE_TREE.md. 
- ** YueDing **: ** DaoRuShunXuBiXu ** Xian `from runtime.thread_registry import get_thread_registry`, Zai import d3utils.system_initializer etc. , because for system_initializer Hui import runtime, if runtime ShangWeiTiGong get_thread_registry HuiXunHuanYiLai or AttributeError. **register_shutdown_provider** in module JiaZai when Jiang is_shutdown_requested, request_shutdown, request_restart ZhuRu event_center, Shi exit/restart HuiDiao use shutdown_manager, BiMian event_center ZhiJie import shutdown_manager. **__all__** and XiaoFeiZheYueDingYiZhi , ZengShanDaoChuXuTong step Suo have Cong runtime QuMing Diao use Fang . 

### 3.2 Yi by WuJie or GaiCuo Yuan because 

1. ** GaiDong import ShunXu **: if Xian import d3utils.system_initializer Zai import runtime.thread_registry, Hui because system_initializer within Bu import runtime when runtime WeiWanCheng thread_registry JiaZai and DaoZhi get_thread_registry WeiDingYi or XunHuan import. 
2. ** GaiDong __all__ WeiTong step XiaoFeiZhe **: main, controller, ui etc. if from runtime import xxx, ShanDiao __all__ in xxx HuiDaoZhi ImportError; newly added DaoChu if Wei in WenDang or CODE_TREE in note , Yi by Wu use . 
3. ** in runtime/__init__.py in ZhiJieXieYeWuLuoJi or Zai import Qi it HuiFanYin runtime module **: KeNengYinRuXunHuanYiLai . 
4. ** LouXie or CuoXie register_shutdown_provider**: event_center exit/restart HuiDiaoYiLaiCiZhuRu , if WeiDiao use or CanShuShunXuCuo , GuanJi / ChongQi line for YiChang . 
5. ** Jiang d3utils event_center, shutdown_manager etc. ShiXianXiJieBaoLu for Cong runtime ZhiJie import TuiJianFangShi **: XiaoFeiZheYingZhiCong runtime MenMianQu , not Ying from d3utils.event_center import ..., FouZePoHuai " DanMenMian " YueDingQie and CODE_TREE not Fu . 

### 3.3 ZhengQueZuoFa 

- XiuGai runtime/__init__.py QianXianDu this WenJianTouBuZhuShi (Import thread_registry first...) ; WuTiaoZhengQianLiang line and d3utils import ShunXu ; ZengShan __all__ when grep Suo have from runtime import use Fa and Tong step ; Wu in CiWenJianTianJiaYeWuLuoJi or HuiFanYin runtime import; register_shutdown_provider Diao use and CanShuBaoChi and shutdown_manager is_shutdown_requested, request_shutdown, request_restart YiZhi . 

---

## Si , and apology document GuanXi 

if CiQian because WeiXianTongDuShangShuSanChuYueDing (i18n_d4_panel_zh key/team_health, _obsolete_bot_scanner and rosbot_manager QuFen , runtime MenMian and import ShunXu and __all__) and in CiSanChuFanFuGaiCuo or understand PianCha , KeShi for WeiXianTongDuYueDingSuoZhi . this note YiXieRu cursor_AI_ apology directory , and in Cursor_ ZhuanShu apology document .md No. LiuShiErJie in Yin use . 
