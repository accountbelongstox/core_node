# technical note : DengLuHou ZhanWangYuanSu - KongJian note , _obsolete_rosbot_manager, _obsolete_tray_clicker, FLOW_STATE_OWNERSHIP_DESIGN, run_line_detect_on_image

** Mu **: note this WuChuWenDang / DaiMa ZhiZe , Yi by WuJie or GaiCuo Yuan because , to and ZhengQueYueDing . 

** She and WenJian **: 
- `docs/ DengLuHou ZhanWangYuanSu - KongJian note .md`
- `utils/_obsolete_rosbot_manager.py`
- `utils/_obsolete_tray_clicker.py`
- `docs/FLOW_STATE_OWNERSHIP_DESIGN.md`
- `scripts/run_line_detect_on_image.py`

---

## Yi , docs/ DengLuHou ZhanWangYuanSu - KongJian note .md

### 1.1 ZhiZe and YueDing 

- ** purpose **: ZhanWang ** DengLuHou ** ZhuJieMianKongJian note WenDang . ShuJuLaiYuan for " TiaoShi ( ZhanWang UI JSON)" AnNiuDaoChu JSON, FuZhi to `docs/ DengLuHou ZhanWangYuanSu .json` (UI Automation, Chromium ZhanWang ) . and `docs/ DengLuHou ZhanWangYuanSu .json`, `providor/constants/d3.py` D3_TAB_AUTOMATION_IDS, START_GAME_AUTOMATION_IDS and `d3utils/battlenet_operation.py` BattlenetOperation YiZhi . 
- ** Yi use KongJian **: D3 YouXi Tab XiaoAnNiu `game-nav-btn-D3CN` (TabItemControl "Diablo III") ; KaiShiYouXiAnNiuQuYu `play-btn-main` / `play-btn` (GroupControl) ; PanDuan " YouXi is FouZheng in KaiShi ": name Han "Playing Now" / "Play" / " KaiShiYouXi " Qie `is_enabled` for False or name Han "Playing Now" ZeShi for YouXi in . 
- ** DaiShiXian **: TongYiDengLu , DianJi confirm DengLu , is FouChu in DengLuJieMian , is FouYiJingDengLu ( WenDang in Lie for DaiShiXian , ShiXian when Ying and BattlenetOperation and JSON structure Tong step ) . 

### 1.2 Yi by WuJie or GaiCuo Yuan because 

1. ** WenDang and DaiMa automation_id/name not YiZhi **: if DaiMa in Gai use Qi it id ( such as `play-btn` and `play-btn-main` ShunXuFan ) , or WenDangGengXin for Qi it key and BattlenetOperation/constants WeiTong step , ZhanWangDianJiHuiShiBai or DianCuoKongJian . 
2. ** Ba " DaiShiXian " DangYiShiXian **: TongYiDengLu , confirm DengLu , DengLuJieMianPanDuan etc. in WenDang in for " DaiShiXian "; if in LiuCheng in JiaDing this XieJieKouYiCun in or FanHuiZhiYiWenDing , HuiBaoCuo or line for WeiDingYi . 
3. **JSON LuJing and WenDang not Fu **: WenDangXie " FuZhi to docs/ DengLuHou ZhanWangYuanSu .json"; if ShiXianCongQi it LuJing or battlenet_ui_elements_*.json Du , Xu in WenDang or DaiMa in TongYi note , FouZeTiaoShiDaoChu and DaiMaDuQu not TongYiWenJian . 
4. ** PanDuanLuoJi and BattlenetOperation not YiZhi **: such as " YouXi in " PanDuan (is_enabled=false / "Playing Now") if in BattlenetOperation.is_game_starting() or get_dynamic_state in LuoJi not Tong , HuiDaoZhiZhuangTaiZhanShi and WenDang note not YiZhi . 

### 1.3 ZhengQueZuoFa 

- XiuGaiZhanWangKongJian id/name when Tong step GengXin this WenDang , `docs/ DengLuHou ZhanWangYuanSu .json` DaoChu note , to and `BattlenetOperation`/`providor/constants/d3.py`; ShiXian " DaiShiXian " item when in WenDang in Gai for Yi use and ZhuMingJieKou position Zhi ; PanDuanLuoJi and BattlenetOperation BaoChiYiZhi . 

---

## Er , utils/_obsolete_rosbot_manager.py

### 2.1 ZhiZe and YueDing 

- ** purpose **: WenJianMingDai **\_obsolete_**, BiaoShi ** YiFeiQi **. Yuan for RoS-BoT JinChengGuanLi (RoS-BoT.exe and directory XiaQi it exe QiDong , QingLi , etc. DaiXin exe, FaSong F7, ChuangKouJiHuo and UI FenXi ) . DangQianZhuLiuCheng ROSBOT QiDong and GuanLiYing use **d3utils/rosbot_manager.py** and **flow (flow_master_driver, rosbot_task_processor) **, not to CiWenJian for RuKou . 
- ** YiLai **: CONFIG ros_settings, ColorPrint, WindowActivator, WindowAnalyzer, IntegratedAutomationController; LuoJi for validate_ros_directory find_rosbot_exe KeXuan cleanup_old_other_exe_processes start_executable(RoS-BoT.exe) wait_for_process wait_for_new_other_exe activate_and_analyze_window. 

### 2.2 Yi by WuJie or GaiCuo Yuan because 

1. ** DangZuoZhuRuKou use **: if in panel or RenWuXianCheng in CongCiWenJianDaoRu RoSBotManager and Diao use start_rosbot_sequence() as " QiDong ROSBOT" ShiXian , HuiRaoGuo flow_master and rosbot_task_processor, and FLOW_STATE_OWNERSHIP_DESIGN, DESIGN.md QiDongShunXu and ZhuangTaiSuo have Quan not YiZhi . 
2. ** in obsolete WenJian in JiaGongNeng **: if in CiWenJian within newly added method or Gai CONFIG Jian , QiWangZhuChengXuShengXiao , HuiDaoZhiWeiHuLiangTaoLuoJi (d3utils/rosbot_manager and obsolete) , QieZhuLiuCheng not Hui use to XinLuoJi . 
3. ** and d3utils/rosbot_manager HunXiao **: d3utils/rosbot_manager.py for DangQian use ShiXian ; if Yin use or FuZhiLuoJi when GaoHunLiang WenJian , HuiGaiCuo Fang . 
4. **_obsolete_game_state_manager Yin use **: if _obsolete_game_state_manager Reng import RoSBotManager from utils.rosbot_manager, and utils XiaJin have _obsolete_rosbot_manager, ZeKeNeng for LiShiCuoWu or YiYiChu utils/rosbot_manager; not Ying to obsolete Lian as ZhuLiuChengYiJu . 

### 2.3 ZhengQueZuoFa 

- ZhuLiuCheng not Yin use _obsolete_rosbot_manager; ROSBOT QiDong , QingLi , ZhuangTai by d3utils/rosbot_manager and flow (process_task, tick_flow_master) FuZe ; if XuGai ROSBOT line for , Gai d3utils/rosbot_manager and flow XiangGuanDaiMa , not in CiWenJianZengJiaGongNeng . 

---

## San , utils/_obsolete_tray_clicker.py

### 3.1 ZhiZe and YueDing 

- ** purpose **: WenJianMingDai **\_obsolete_**, BiaoShi ** YiFeiQi **. Yuan for XiTongTuoPanTuBiao dual JiGongJu (pywinauto Desktop + win32api) , TongGuoGuanJian char ChaZhaoTuoPanTuBiao and dual Ji ( such as Battle.net) . DangQianZhanWangXiangGuanCaoZuo ( HanTuoPan / ChuangKouJiHuo ) Ying use **battlenet_operation, BattleNetManager, flow** etc. YueDingRuKou , not to CiWenJian for ShengChanLuoJi . 
- ** line for **: click_tray_icon(keyword), print_tray_info; YiLai pywinauto, win32api, win32con; BianLi class_name Han tray/notify/shell ChuangKou and Qi sub KongJian , PiPei title/class_name Han keyword TuBiao and dual Ji in Xin . 

### 3.2 Yi by WuJie or GaiCuo Yuan because 

1. ** DangZuoZhuLiuChengZhanWang / TuoPanRuKou **: if in " QueBaoZhanWang "" ChongXinDengLu " etc. LiuCheng in Diao use CiWenJian click_tray_icon QiWangHuanQiZhanWang , Hui and battlenet_operation, flow_bn_only, rosbot_flow_battlenet YueDing not YiZhi , Qie obsolete KeNengWei and DangQianChuangKouChaZhaoLuoJiTong step . 
2. ** in obsolete in Gai keyword or DianJiLuoJi **: if in CiXiuGai Battle.net GuanJian char or dual JiZuoBiaoJiSuan and QiWangZhuLiuChengShengXiao , ZhuLiuCheng not HuiDiao use CiChu , HuiDaoZhi no XiaoXiuGai . 
3. ** and _obsolete_click_handler etc. ChongFu **: ZhanWangDianJi ( TuoPan , ChuangKou , PyAutoGUI, UIA) in apology document and technical note in YiMingQueZhuLiuCheng use battlenet_operation / battlenet_asia_ops; in _obsolete_tray_clicker within Gai and in _obsolete_click_handler within GaiYiYang , all not HuiYingXiangZhuLiuCheng . 
4. ** HuanJingYiLai **: pywinauto Desktop(backend="uia") and XiTongTuoPanShiXianXiangGuan , not TongHuanJingKeNengMeiJu not to or ZuoBiao not Zhun ; ZhuLiuCheng not YiLaiCiLeiShiXian . 

### 3.3 ZhengQueZuoFa 

- ZhuLiuCheng not Yin use _obsolete_tray_clicker; ZhanWangChuangKouJiHuo , TuoPanXiangGuan line for to BattleNetManager, battlenet_operation, flow WenDang for Zhun ; not in CiWenJianZengJia or XiuGaiShengChanLuoJi . 

---

## Si , docs/FLOW_STATE_OWNERSHIP_DESIGN.md

### 4.1 ZhiZe and YueDing 

- ** purpose **: ** LiuChengZhuangTaiSuo have Quan ** SheJiFangAn . HeXinYuanZe : ** LiuChengLeiKuDingYi and Chi have ZhuangTai ** (flow_master_enabled, bn_only_enabled, step / JieDian ) ; ** Qi it LeiKu no ZhuangTaiKaiGuan ** ( not Du flow_master/bn_only ZuoFenZhi ) ; **Tick ZhiQuDongLiuChengLeiKu ** ( Jin process_task by RenWuXianChengDiao use ) ; ** LiuChengGenJuFanHuiZhiGengXinZhuangTai ** ( by Diao use FangFanHui True/False or MingQueLeiXing , not TongGuoQuanJuZhuangTaiBiaoDaJieGuo ) . 
- ** ZhuangTaiGuiShu **: flow_master_enabled, bn_only_enabled, step / JieDian by rosbot_flow_state and process_task WeiHu ; panel TongGuo set_flow_master_enabled/set_bn_only_enabled Xie , process_task, check_window, BN LiuTongGuo get_* Du ; battlenet_status_provider, d3_status_provider, rosbot_flow_battlenet, run_f0_prejudge_entry, extension_flow_tick_step, run_f3_log_timeout etc. ** not Du ** flow_master/bn_only ZuoFenZhi ( LiWai : BN Liu within no_activate XiaKeDu get_bn_only_enabled() Jin use at TiQian abort) . 
- **Tick QuDongLian **: TaskThreadManager(1s) rosbot_task ENABLED when process_rosbot_task() process_task(); window_monitor(10s) Xian is_flow_active() Zai refresh/notify. ** unique QuDongLiuChengZhi line RuKou ** for process_task(). 

### 4.2 Yi by WuJie or GaiCuo Yuan because 

1. ** in provider or BN Liu within DuLiuChengKaiGuanZuoFenZhi **: if in battlenet_status_provider, rosbot_flow_battlenet, run_f0_prejudge_entry etc. within BuGenJu flow_master_enabled or bn_only_enabled JueDing " is FouZhi line "" ZouNa item FenZhi ", WeiFan " Qi it LeiKu no ZhuangTaiKaiGuan "; FenZhiYing by process_task GenJu flow_state JueDingHouDiao use Shui . 
2. ** use game_interface_data LiuChengKaiGuanZuoFenZhi **: if DaiMa use game_interface_data.rosbot_flow_master_enabled / ensure_battlenet_only_master_enabled Zuo if PanDuan , and WenDang not Fu -- this Liang item Jin use at UI ZhanShiJingXiang , FenZhiPanDuanYingTongYi use flow_state get_flow_master_enabled() / get_bn_only_enabled(). 
3. ** by window_monitor or Qi it Ding when QiZhiJieQuDong BN Liu /extension**: if in check_window or 10s Ding when Qi within ZhiJieDiao use tick_battlenet_ready_flow, extension_flow_tick_step etc. , WeiFan "Tick ZhiQuDong process_task"; YingJin by process_task within BuAnZhuangTaiDiao use this XieJieKou . 
4. ** by Diao use FangTongGuoXieLiuChengZhuangTaiBiaoDaJieGuo **: if battlenet_flow, run_f3 etc. within BuZhiJie set step or flow_master_enabled, WeiFan " JinTongGuoFanHuiZhi "; LiuChengLeiKu is unique GenJuFanHuiZhiGengXinZhuangTai and step YiFang . 
5. ** RenWuKaiGuan rosbot_task by LiuCheng within BuXieRu **: WenDangMingQue " RenWuKaiGuan rosbot_task by panel GenJu flow_state is_flow_active() PaiSheng ", not by LiuCheng within BuXieRu ; if in process_task or flow within Xie ENABLED/DISABLED, HuiPoHuaiSheJi . 

### 4.3 ZhengQueZuoFa 

- FenZhi and is FouZhi line by process_task Du flow_state HouJueDing ; by Diao use FangZhiFanHuiMingQueJieGuo ( such as (done, result), "b1"/"b2"/"c1", "f4") ; not in provider, BN Liu , F0/F3/F4 within Du flow_master/bn_only ZuoFenZhi ; check_window JinDu is_flow_active() JueDing is Fou refresh/notify, not ZhiJieDiao tick_battlenet_ready_flow etc. ; DaiMa position Zhi to WenDang 6 SuChaBiao for Zhun (rosbot_flow_state, flow_bn_only, rosbot_task_processor, rosbot_extension_panel, window_monitor_timer) . 

---

## Wu , scripts/run_line_detect_on_image.py

### 5.1 ZhiZe and YueDing 

- ** purpose **: ** TiaoShiJiao this **, to DanZhang "debug_bag_line QuYu " TuXiangZuoTaiGu / YuanGuXianJianCe , Tong directory output DaiLv / BaiDian Tu . use Fa : `python run_line_detect_on_image.py <path_to_slot_image.png>`. LuJingJi at __file__ (_script_dir, _d3_check_root, _core_node_root) , YiLai `d3utils.debug_bag_hover` _find_line_in_crop, _draw_dots_on_matched, _pixel_matches_any_ref, LINE_PRIMAL_ANCIENT_RGBS, LINE_PRIMAL_ANCIENT_TOLERANCE, LINE_ANCIENT_RGBS. 
- ** output **: Tong directory Xia `{src.stem}_line_{line_label}{suffix}`, line_label for primal_{height}, ancient_{height}, full_scan, normal, unknown etc. . 

### 5.2 Yi by WuJie or GaiCuo Yuan because 

1. ** Jiao this YiDong or LuJingPoHuai **: if Jiao this Yi to Qi it Bao or directory , _d3_check_root/_core_node_root JiSuanCuoWu , sys.path.insert KeNengZhao not to d3_check or pycore, DaoZhi import ShiBai . 
2. ** WeiChuanCan or WenJian not Cun in **: if ZhiJieYun line no argv or ChuanRuFeiWenJianLuJing , Jiao this exit(1); Diao use FangXuBaoZhengChuanRu have Xiao slot TuXiangLuJing . 
3. **debug_bag_hover JieKouBianGeng **: if _find_line_in_crop QianMing or FanHuiZhi , or LINE_* ChangLiang in debug_bag_hover in GaiMing / ShanChu , CiJiao this HuiBaoCuo or JieGuoCuo ; XiuGai debug_bag_hover when XuJianRongCiJiao this or Tong step GaiJiao this . 
4. **PIL/ndarray YueDing **: Jiao this JiangTuXiangZhuan for RGB Zai np.array; _find_line_in_crop etc. JiaDing crop for RGB ShuZu ; if ChuanRu RGBA or BGR Wei in Jiao this within TongYiZhuanHuan , YanSePiPeiKeNengCuo . 
5. ** and slot_line_scan_columns etc. Jiao this FenGong **: this Jiao this for DanTuJianCe ; slot_line_scan_columns for batch Liang / LieSaoMiao ; ErZheGong use debug_bag_hover XianJianCeLuoJi , but ShuRu / output not Tong , WuHun use MingLing line or output LuJingYueDing . 

### 5.3 ZhengQueZuoFa 

- BaoChiJiao this in scripts/ Xia , LuJingJi at __file__; Diao use when ChuanRu have Xiao slot TuXiangLuJing ; XiuGai debug_bag_hover when BaoLiu _find_line_in_crop, _draw_dots_on_matched and LINE_* ChangLiangJianRongXing , or Tong step GaiCiJiao this ; DanTuTiaoShi use this Jiao this , batch Liang / LieSaoMiao use slot_line_scan_columns. 

---

## Liu , and apology document GuanXi 

if CiQian because ShangShuRenYiDian ( such as ZhanWangKongJian note and BattlenetOperation/JSON not YiZhi , Wu use _obsolete_rosbot_manager or _obsolete_tray_clicker as ZhuRuKou , WeiFan FLOW_STATE_OWNERSHIP in provider within DuLiuChengKaiGuan or by Fei process_task QuDongLiuCheng , run_line_detect LuJing or debug_bag_hover JieKouBianGengWeiTong step ) DaoZhiFanFuGaiCuo or understand PianCha , KeShi for WeiXianTongDuYueDingSuoZhi . this note YiXieRu cursor_AI_ apology directory , and in Cursor_ ZhuanShu apology document .md in ZengJia to this Wen Yin use . 
