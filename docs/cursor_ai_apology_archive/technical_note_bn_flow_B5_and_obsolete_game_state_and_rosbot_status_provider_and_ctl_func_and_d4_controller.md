# technical note : bn_flow_B5.json, _obsolete_game_state_manager, rosbot_status_provider, ctl_func/__init__, d4_controller

** Mu **: note this WuChuWenJian / DaiMa ZhiZe , Yi by WuJie or GaiCuo Yuan because , to and ZhengQueYueDing . 

** She and WenJian **: 
- `.cache/bn_flow_snapshots/bn_flow_B5.json`
- `utils/_obsolete_game_state_manager.py`
- `d3utils/rosbot_status_provider.py`
- `controller/ctl_func/__init__.py`
- `controller/d4_controller.py`

---

## Yi , .cache/bn_flow_snapshots/bn_flow_B5.json

### 1.1 ZhiZe and YueDing 

- ** purpose **: BN LiuCheng **B5** JieDianYun line when KuaiZhao (UI Automation KongJianShu ) . by `save_ui_elements_snapshot` etc. XieRu , `meta.node`="B5", `meta.reason`="B5_exit"; `controls` for ZhanWangChuangKou in GaiJieDian when KongJianLieBiao (name, automation_id, type, rect etc. ) . use at TiaoShi , 1:1 to Zhao and DengLu / ZhuJieMianPanDuanCanKao . HuanCunLuJing by `providor.constants.common.BN_FLOW_SNAPSHOTS_DIR` JueDing (.cache/bn_flow_snapshots) . 
- ** YueDing **: structure and B4/B6/B7/B9/B13 etc. JieDianKuaiZhaoYiZhi ; XiaYou (battlenet_region_judge, is_on_login_screen, poll LuoJi ) if DuQuKuaiZhao , Xu and meta/controls structure YueDingYiZhi ; .cache for Yun line when ChanWu , Ke by QingLi , not Ying hardcode for unique ShuJuYuan . 

### 1.2 Yi by WuJie or GaiCuo Yuan because 

1. ** hardcode LuJing or JieDianMing **: if DaiMa hardcode `bn_flow_B5.json` or .cache Jue to LuJing , HuanJieDian or QingLiHuanCunHouDu not to ; Ying use BN_FLOW_SNAPSHOTS_DIR and JieDianMingPinJie . 
2. **meta/controls structure and PanDuanLuoJi not YiZhi **: if battlenet_region_judge or B block LuoJiQiWang automation_id/name/rect and B5 KuaiZhaoShiJi structure not Tong , HuiDaoZhi B5 ChuKouPanDuan or HouXuFenZhiCuoWu . 
3. ** Ba .cache DangQuanWeiTiJiao or KuaJiYiLai **: .cache for this Yun line when ChanWu , if in WenDang or Jiao this in JiaDingQiYiDingCun in QieWei in BieJiShengCheng , HuiBaoCuo ; KuaiZhaoJinZuoCanKao and TiaoShi use . 
4. **B5 and Qi it JieDianKuaiZhaoHun use **: GeJieDian reason/controls to Ying not Tong UI ZhuangTai ; if use B5 KuaiZhaoZuo B7 or B9 PanDuan , HuiWuPan . 

### 1.3 ZhengQueZuoFa 

- KuaiZhaoLuJingCong BN_FLOW_SNAPSHOTS_DIR and JieDianMingShengCheng ; DuQuKuaiZhao DaiMa and battlenet_operation, battlenet_region_judge YueDing controls structure YiZhi ; not Ba .cache Dang unique QuanWei ; B5 Jin use at B5 JieDianXiangGuanLuoJi . 

---

## Er , utils/_obsolete_game_state_manager.py

### 2.1 ZhiZe and YueDing 

- ** purpose **: WenJianMingDai **\_obsolete_**, BiaoShi ** YiFeiQi **. Yuan for "Diablo III and RoS-BoT TongYiZhuangTaiGuanLi ": GameStateManager, ProcessState, check_diablo_status, check_rosbot_status, check_other_exe_status, should_start_diablo, should_start_rosbot, get_system_status. YiLai CONFIG (monitoring, ros_settings) , GameProcessDetector, **utils.rosbot_manager.RoSBotManager**. 
- ** ZhuYi **: utils directory XiaJin have `_obsolete_rosbot_manager.py`, no `rosbot_manager.py`; DangQianZhuLiuCheng use **d3utils.rosbot_manager**. if Wei in utils XiaTiGong rosbot_manager ZhuanFa or BieMing , CongCiWenJian import RoSBotManager Hui **ImportError**. ZhuLiuCheng ZhuangTai and " is FouQiDong ROSBOT" by **rosbot_status_provider**, **flow (process_task, flow_state) **, **d3utils/rosbot_manager** FuZe , not by CiWenJianJueDing . 

### 2.2 Yi by WuJie or GaiCuo Yuan because 

1. ** DangZuoZhuLiuChengZhuangTai or QiDongJueCeRuKou **: if in panel or Ding when Qi in Diao use GameStateManager.update_all_status(), should_start_rosbot() etc. as " is FouQiDong ROSBOT" or " YouXiZhuangTai " YiJu , HuiRaoGuo flow and rosbot_status_provider, and FLOW_STATE_OWNERSHIP_DESIGN not Fu . 
2. ** YiLai utils.rosbot_manager**: Gai import in no utils/rosbot_manager when HuiShiBai ; i.e. BianCun in , also Ying is obsolete Lian , not Ying as ZhuLiuChengYiLai . 
3. ** in obsolete in JiaGongNeng **: in CiWenJian within newly added method or Gai CONFIG Jian , QiWangZhuChengXuShengXiao , ZhuLiuCheng not HuiDiao use , HuiDaoZhi no XiaoXiuGai or LiangTaoLuoJi . 
4. ** and rosbot_status_provider HunXiao **: DangQian ROSBOT ZhuangTaiShuaXin and ZhanShi by rosbot_status_provider.refresh_rosbot_status() Xie game_interface_data; is FouQiDong / by ShuiQiDong by process_task and flow_state JueDing ; Wu use GameStateManager TiDai . 

### 2.3 ZhengQueZuoFa 

- ZhuLiuCheng not Yin use _obsolete_game_state_manager; ROSBOT ZhuangTai use rosbot_status_provider + game_interface_data; QiDongJueCe use flow_state and process_task; not in this WenJianZengJiaGongNeng or XiuFu import as ZhuLiuChengFangAn . 

---

## San , d3utils/rosbot_status_provider.py

### 3.1 ZhiZe and YueDing 

- ** purpose **: ROSBOT ** KuoZhanZhuangTai ** JianCe and game_interface_data GengXin . JinTiGong refresh_rosbot_status(), get_current_rosbot_window(); ** Suo have ChaZhaoTongGuo same-dir exe flow** ( Jian docs/ROSBOT_LOOKUP_FLOW.md) , i.e. get_rosbot_manager().get_rosbot_detection(), get_rosbot_window(), get_running_rosbot_processes(). ZhuangTaiQuZhi : **not_found | running | paused** (running = have JinCheng no ChuangKou , paused = have ChuangKou ) . not Du flow_master_enabled/bn_only ( conform to FLOW_STATE_OWNERSHIP_DESIGN) . 
- ** XieRu **: game_interface_data rosbot_extended_status, rosbot_window_found, rosbot_found_exe_name, rosbot_found_window_title; by set_rosbot_extended_status, set_rosbot_found_display XieRu . 

### 3.2 Yi by WuJie or GaiCuo Yuan because 

1. ** in provider within DuLiuChengKaiGuanZuoFenZhi **: if in refresh_rosbot_status within GenJu flow_master_enabled or bn_only_enabled JueDing " is FouZhi line " or " Xie not TongZhuangTai ", WeiFan " Qi it LeiKu no ZhuangTaiKaiGuan "; provider ZhiFuZeJianCe and Xie game_interface_data, is FouDiao use by process_task JueDing . 
2. ** Diao use ShunXu or Diao use FangCuoWu **: Ying by process_task/flow in REFRESH_NOTIFY Jie segment Diao use refresh_rosbot_status; if by window_monitor ZhiJieDiao use Qie and process_task not Tong step , KeNengChongFu or JingTai . 
3. **get_rosbot_detection() QiYueBianGeng **: if rosbot_manager.get_rosbot_detection() FanHui key (status, window_info) or YuYiBianGeng , WeiTong step this module HuiXieCuo char segment or Qu not to window_info. 
4. ** and rosbot_operation HunXiao **: rosbot_operation FuZe " JiHuoChuangKou , run_after_rosbot_start, resume_rosbot"; rosbot_status_provider ZhiFuZe " JianCeZhuangTai and Xie game_interface_data"; Wu in status_provider within ZuoJiHuo or DianJi . 

### 3.3 ZhengQueZuoFa 

- Jin by process_task ( or YueDingRuKou ) in REFRESH_NOTIFY Jie segment Diao use refresh_rosbot_status; not in this module within Du flow_state; and rosbot_manager get_rosbot_detection/get_rosbot_window QiYueYiZhi ; ZhuangTaiJin not_found/running/paused, and ROSBOT_LOOKUP_FLOW YiZhi . 

---

## Si , controller/ctl_func/__init__.py

### 4.1 ZhiZe and YueDing 

- ** purpose **: Controller sub Bao **ctl_func** Bao note . WenDangMingQue : ** ZhiJieCong sub module import, not ZuoErCiFengZhuang ** (no secondary encapsulation) . ShiLi : `from controller.ctl_func.blacksmith_handler import get_blacksmith_handler, BlacksmithHandler`, `from controller.ctl_func.kanai_cube_handler import get_kanai_cube_handler, KanaiCubeHandler`. 
- ** YueDing **: not in __init__.py in Zuo `from .blacksmith_handler import ...` Zai re-export; not in CiJuHeDuo handler get_* or LeiMing ; newly added handler when in to Ying sub module ShiXian , Diao use FangZhiJieCong sub module import. 

### 4.2 Yi by WuJie or GaiCuo Yuan because 

1. ** in __init__ in ZuoJuHeDaoChu **: if in __init__.py Xie `from .blacksmith_handler import get_blacksmith_handler` and `__all__ = ['get_blacksmith_handler', ...]`, and "no secondary encapsulation" not Fu ; WenDangYaoQiuZhiJie from sub module . 
2. ** newly added handler ZhiJia in __init__ WeiJian sub module **: if Zhi in this WenJianJiaYi line import and sub module not Cun in , HuiBaoCuo ; YingXianJian sub module Zai in Diao use FangZhiJie from sub module . 
3. ** and controller.d4func HunXiao **: ctl_func for D3 XiangGuan ( blacksmith , KaNai etc. ) ; d4func for D4 (exp_farming, screenshot_handler etc. ) ; Wu in ctl_func/__init__ in DaoChu d4func or Fan of . 

### 4.3 ZhengQueZuoFa 

- __init__.py BaoChiJinBao note and import ShiLi , not re-export; Diao use FangShiZhong `from controller.ctl_func.xxx_handler import get_xxx_handler, XxxHandler`; newly added handler when XinJian sub module and in Diao use ChuZhiJie import sub module . 

---

## Wu , controller/d4_controller.py

### 5.1 ZhiZe and YueDing 

- ** purpose **: D4 ZhuKongZhiQi . ** by D4ExtensionThread An D4_TICK_INTERVAL QuDong **, not by timer_manager Tong use Ding when QiQuDong . process() for unique ZhuRuKou : Dang **exp_farming_running** when Zhi line start_exp_farming_process(d4_data) + update_ui_status + check_state_changes + _update_debug_window_if_open; Dang **debug_window_open** when Zhi line JieTu + collect region_detector.detect_regions_from_shared_data map_switch_detector map_name_recognizer _update_debug_window_if_open; FouZe return. get_interceptor() FanHui "is_exp_farming_running or debug_window_open" WeiCi , GongWaiBuPanDuan is FouZhi line process. 
- ** YiLai **: get_d4_interface_data(), ExpFarmingManager, get_ui_status_updater(), get_event_manager(); D4_SCREENSHOT_DIR, D4_ANNOTATED_DIR; exp_farming_running, debug_window_open, detected_regions etc. LaiZi d4_data. 

### 5.2 Yi by WuJie or GaiCuo Yuan because 

1. ** by CuoWuFangQuDong process()**: if by timer_manager or Qi it 1s/10s Ding when QiZhiJieDiao d4_controller.process(), and " Jin D4ExtensionThread QuDong " not Fu ; D4 LuoJiYingZhi in D4ExtensionThread tick in Diao use process(). 
2. ** DiaoHuan process() within ShunXu **: BiXuXianJieTu and collect region_detection map_switch + map_name_recognizer; if Xian map_switch Zai detect_regions, detected_regions Wei then XuHuiShiBai . 
3. **detected_regions structure JiaSheCuoWu **: _update_debug_window_if_open YiLai d4_data.detected_regions Han 'region_images'; if d4_small_map_detector or Qi it module ** ZhengTiFuGai ** detected_regions for Jin location_type/is_in_town, HuiDiuDiao region_images DaoZhi debug ChuangKou no Tu or BaoCuo ; XuBaoZhengJianCeLian in He and XieRu and FeiZhengTiFuGai . 
4. **exp_farming_running XieRu **: start_exp_farming/stop_exp_farming ZhiJieXie d4_data.exp_farming_running; if by BieChuXie or DuCuoLaiYuan , ZhuangTaiHuiLuan . 
5. ** and D4ExtensionThread item Jian not YiZhi **: D4ExtensionThread Jin in is_exp_farming_running or debug_window_open when Diao process(); if interceptor or XianCheng within item Jian and d4_controller not YiZhi , HuiDuoDiao or ShaoDiao . 

### 5.3 ZhengQueZuoFa 

- Jin by D4ExtensionThread in D4_TICK_INTERVAL Qie (exp_farming or debug_window_open) when Diao use process(); not DiaoHuan process() within JieTu region_detection map_switch map_name ShunXu ; BaoZheng detected_regions GengXin for He and and FeiZhengTiFuGai ( Jian d4_small_map_detector technical note ) ; exp_farming ZhuangTaiJinTongGuo d4_data and start/stop_exp_farming DuXie ; and d4_extension_thread, exp_farming technical note YiZhi . 

---

## Liu , and apology document GuanXi 

if CiQian because ShangShuRenYiDian ( such as B5 KuaiZhaoLuJing or structure Hun use , Wu use _obsolete_game_state_manager ZuoZhuangTai or QiDongJueCe , in rosbot_status_provider within DuLiuChengKaiGuan or Diao use FangCuoWu , in ctl_func/__init__ ZuoJuHeDaoChu , d4_controller by CuoWuFangQuDong or process ShunXu or detected_regions FuGaiWenTi ) DaoZhiFanFuGaiCuo or understand PianCha , KeShi for WeiXianTongDuYueDingSuoZhi . this note YiXieRu cursor_AI_ apology directory , and in Cursor_ ZhuanShu apology document .md in ZengJia to this Wen Yin use . 
