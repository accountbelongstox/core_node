# technical note : slot_line_scan_columns, interface_manager, coordinate_picker_window, d4_extension_thread, exp_farming

** Mu **: note this WuChuDaiMa ZhiZe , Yi by WuJie or GaiCuo Yuan because , to and ZhengQueYueDing . 

** She and WenJian **: 
- `scripts/slot_line_scan_columns.py`
- `d3utils/interface_manager.py`
- `ui/components/coordinate_picker_window.py`
- `d3utils/d4_extension_thread.py`
- `controller/d4func/exp_farming.py`

---

## Yi , scripts/slot_line_scan_columns.py

### 1.1 ZhiZe and YueDing 

- ** purpose **: TiaoShiJiao this , use GuDingTaiGuXianSe (DEFAULT_PRIMAL_BGRS) to MuBiaoTuZhuLieSaoMiao , every LieZhaoLianXuPiPei segment ; if ChangDu >= MIN_LINE_HEIGHT_PX Shi for " Yi item Xian ", FouZeJiGaiLieZuiZhang segment for fallback. output to target_dir/slot_line_scan/*_scan.png ( Lv = Xian , Cheng = ZuiZhang segment ) . LuJing : _script_dir = Path(__file__).resolve().parent, _d3_check_root = _script_dir.parent, _core_node_root = _d3_check_root.parent.parent; TARGET_DIR, TARGET_NAME for MoRen hardcoding , also KeTongGuo argv ChuanWenJian or directory . 
- ** YanSe **: Jin use this WenJian DEFAULT_PRIMAL_BGRS (BGR YuanZuLieBiao ) , not CongCanKaoTuTiQu ; COLOR_TOLERANCE_RATIO = 0.10. 

### 1.2 Yi by WuJie or GaiCuo Yuan because 

1. ** LuJingJiaShe **: Jiao this JiaDing __file__ in pyapps/d3-check/scripts/, Gu _d3_check_root for d3-check, _core_node_root for core_node ShangLiangJi ; if Jiao this YiDong or CongBieChuYun line , sys.path ChaRuKeNengCuo , DaoZhi pycore etc. DaoRuShiBai . 
2. ** hardcoding TARGET_DIR/TARGET_NAME**: MoRenZhiXiang use Hu directory Xia .core_node/pytools/tmp/...; if WeiChuanCanQieGaiLuJing not Cun in or no GaiWenJian , main ZhiJie exit(1/2). 
3. ** YanSe and MIN_LINE_HEIGHT_PX**: if XiuGai DEFAULT_PRIMAL_BGRS or MIN_LINE_HEIGHT_PX Wei and Diao use Fang / WenDangYiZhi , SaoMiaoJieGuoHuiBian ; build_mask_relative use inRange every TongDao ratio, and game_interface_data in Qi it YanSeLuoJiKeNeng not YiZhi . 
4. ** output directory **: GuDing for target_dir / "slot_line_scan", if MuBiaoWenJianXiTongZhiDu or no QuanXianHuiXieShiBai . 

### 1.3 ZhengQueZuoFa 

- Cong d3-check Gen or scripts directory Yun line , or TongGuo argv ChuanRuZhengQueMuBiaoLuJing ; XiuGaiMoRen TARGET_DIR/TARGET_NAME or YanSeChangLiang when confirm and use ChangJingYiZhi ; output directory XuKeXie . 

---

## Er , d3utils/interface_manager.py

### 2.1 ZhiZe and YueDing 

- ** purpose **: D3 JieMianXinXiCaiJiXieTiao ; TongYiRuKou for collect_ui_info (Optimized) / collect_ui_info_anchor (Anchor) , collect_bag_info_quik (Optimized) / collect_bag_info_anchor (Anchor) . ** YueDing **: BiXuXian collect_ui_info ( or collect_ui_info_anchor) , Zai collect_bag; LiangTaoLuJing (Optimized and Anchor) not KeHun use ( i.e. not NengXian collect_ui_info Zai collect_bag_info_anchor) . no BeiBao when Song I JianZaiShiYiCi (window_send_key(hwnd, VK_I)) , RanHouChongXin collect_ui_info and bag collect. 
- **collect_bag_info_quik / collect_bag_info_anchor**: within Bu ** ShiZhong ** XianDiao collect_ui_info ( or collect_ui_info_anchor) Qie force_new_capture=True, Zai BagInfoCollector.collect; BagInfoCollector Cong shared data Qu game_window_image, not DanDuChuanTu . 

### 2.2 Yi by WuJie or GaiCuo Yuan because 

1. ** Xian collect_bag Zai collect_ui**: if Diao use FangXianDiao collect_bag_* and WeiXian collect_ui_*, shared data no ZuiXin game_window_image/ui_region, bag JianCeHuiShiBai or use JiuTu . 
2. **Optimized and Anchor Hun use **: if YiCiLiuCheng in collect_ui_info (Optimized) HouDiao collect_bag_info_anchor, or FanGuoLai , ShuJuYuan not YiZhi ( ChuangKouHuanCun vs QuanPingMaoDian ) , HuiCuo . 
3. ** ShengLve " no BeiBaoSong I ZaiShi "**: if QuDiao " no bag when send I + sleep + Zai collect_ui + Zai collect bag" LuoJi , BeiBaoWeiDaKai when YongYuanCai not to bag. 
4. **collect_bag_info_from_current_shared**: QianTi is YiDiaoGuo collect_ui_info, shared in Yi have game_window_image; if WeiXian collect_ui_info then Diao , HuiZhiJie return None. 
5. **window_send_key**: LaiZi pycore.pyutils.window_ops, not utils._obsolete_window_ops; VK_I LaiZi providor.constants.common. 

### 2.3 ZhengQueZuoFa 

- Diao use ShunXu : Xian collect_ui_info or collect_ui_info_anchor, Zai collect_bag_info_quik or collect_bag_info_anchor ( TongTaoLuJing ) ; no bag when BaoLiuSong I ZaiShiYiCi ; not in this CengHun use Optimized/Anchor. 

---

## San , ui/components/coordinate_picker_window.py

### 3.1 ZhiZe and YueDing 

- ** purpose **: ZuoBiaoShiQuChuangKou , DaTuZhanShi + Dian / JuXing / YuanShiQu ; KeXuanMuBanPiPei (TemplateMatcherHelper) ; client_mode for CLIENT_TYPE_BATTLENET / CLIENT_TYPE_D3_GAME / CLIENT_TYPE_D4_GAME, use at MuBanLieBiao and PiPei . ** Shi when Tong step **: every CiTianJia pick i.e. Diao on_picks_updated([pick]); LiShiXianShi use pick_history_ref ( Zhu UI LieBiao ) if TiGong , FouZe use self.picks. i18n key: ui.coord_picker.* (window_title, menu_title, pick_type_point etc. ) . 
- ** YiLai **: UnifiedStyles, ui.utils (var_str/var_int/var_bool) , get_app_root, TemplateMatcherHelper, providor_index CLIENT_TYPE_*. 

### 3.2 Yi by WuJie or GaiCuo Yuan because 

1. **client_mode and MuBan **: get_available_templates(self.client_mode), match_templates(self.client_mode) YiLai client_mode; if ChuangJian when WeiChuan or ChuanCuo , MuBanLieBiao and PiPeiHuiCuo ( ZhanWang /D3/D4 MuBan not Tong ) . 
2. **on_picks_updated and pick_history_ref**: if Zhu UI WeiChuanRu on_picks_updated or pick_history_ref, ZeShiQu not HuiHuiChuanZhuJieMian , or LiShiShuXianShi is this self.picks and FeiZhu UI TongYiLiShi . 
3. ** ZuoBiaoXi **: pick Cun is ** YuanTuZuoBiao **; HuaBu use scale_factor, canvas_offset_x/y HuanSuan ; if WaiBuBa pick DangHuaBuZuoBiao use HuiCuo . 
4. **i18n key**: ui.coord_picker.* Xu and i18n JSON YiZhi ; if JSON Que key or GaiMingWeiTong step , HuiXianShi key or CuoWenAn . 
5. **"Apply & Match"/"Reset Image"**: to HuaKuang within AnNiuWenAnDangQian for YingWen hardcoding ; if Xu i18n XuJia key and TongYi . 

### 3.3 ZhengQueZuoFa 

- ChuangJian CoordinatePicker when ChuanRuZhengQue client_mode and on_picks_updated, pick_history_ref ( if Zhu UI have TongYiLiShi ) ; pick x/y/width/height/radius YiLvShi for YuanTuZuoBiao ; newly added / XiuGai ui.coord_picker.* when Tong step i18n WenJian . 

---

## Si , d3utils/d4_extension_thread.py

### 4.1 ZhiZe and YueDing 

- ** purpose **: D4 Zhuan use XianCheng , TiDai timer ZhuCe ; every D4_TICK_INTERVAL ( such as 3 Miao ) in **is_exp_farming_running() or debug_window_open** for True when Diao use d4_controller.process(). use time.sleep(0.1) Fen step sleep to Bian request_shutdown and when TuiChu . DanLiTongGuo get_d4_extension_thread/set_d4_extension_thread GuanLi . 
- ** and WenDang **: Jian Cursor_ ZhuanShu apology document No. ShiErJie : D4_TICK_INTERVAL and item Jian not KeGaiCuo ; process not YiZuSeGuoChang ; TuiChu when Xu request_shutdown. 

### 4.2 Yi by WuJie or GaiCuo Yuan because 

1. ** item JianXieCuo **: if Gai for Jin exp_farming or Jin debug_window, and SheJi " LiangZheRenYi i.e. tick" not Fu ; if LouXieQiYi , LingYiChangJingXia D4 not Pao . 
2. ** WeiDiao use request_shutdown**: Ying use TuiChu when if Wei to _instance Diao request_shutdown, XianChengHuiYiZhi sleep to JinChengJieShu , KeNengYingXiangTuiChu or ZiYuanShiFang . 
3. **process() ZuSe **: if d4_controller.process() within Zhang when JianZuSe , this XianChengHuiKaZhu , tick JianGeBianZhang ; YingBaoZheng process JinKuaiFanHui . 
4. **D4_TICK_INTERVAL**: LaiZi providor.constants.d4; if ChangLiangGai for 0 or JiDa , HuiDaoZhi not sleep or JiHu not tick. 

### 4.3 ZhengQueZuoFa 

- BaoChi "is_exp_farming_running() or debug_window_open" item Jian ; Ying use TuiChu when Diao use request_shutdown; process within BiMianZhangZuSe ; D4_TICK_INTERVAL and ChangLiangDingYiYiZhi . 

---

## Wu , controller/d4func/exp_farming.py

### 5.1 ZhiZe and YueDing 

- ** purpose **: D4 JingYan farming LiuChengBianPai . start_exp_farming_process(d4_data): **step1** screenshot_and_collect_info (ScreenshotHandler.capture_and_collect_info) , **step2** region_detection (RegionDetector.detect_regions_from_shared_data) , **step3** map_switch_detector.detect_map_switch + map_name_recognizer.recognize_map_name, **step4** _save_screenshot_and_annotate. YiLai get_d4_interface_data(), D4_SCREENSHOT_DIR, D4_ANNOTATED_DIR; step3 within DongTai import get_map_switch_detector, get_map_name_recognizer. 
- ** LuJing **: current_dir = Path(__file__).parent.parent.parent (d4func -> controller -> pyapps/d3-check) , use at sys.path. 

### 5.2 Yi by WuJie or GaiCuo Yuan because 

1. ** step ShunXu **: BiXu step1 -> step2 -> step3 -> save; if Xian step2 Zai step1, shared data no JieTu and collect info, region_detector no ShuRu ; if Xian step3 Zai step2, detected_regions KeNengWei then Xu , map_name_recognizer Qu not to Map Name QuYu . 
2. **d4_data and shared data**: step1 XieRu d4_data/screenshot_data etc. ; step2 Cong shared data Du and Xie detected_regions; step3 Du detected_regions and is_post_switch_idle. if step1/step2 WeiZhengQueXieRu , step3 or save HuiShiBai or WuPan . 
3. **is_windowed_mode**: _save_screenshot_and_annotate LiDiao d4_data.is_windowed_mode(); D4InterfaceData JiCheng InterfaceDataBase, XuBaoZheng fullscreen_size/game_window_size Yi set, FouZe is_windowed_mode KeNengCuo . 
4. **last_annotated_screenshot_path**: item JianXie for " if no have last_annotated_screenshot_path CaiBiaoZhu and BaoCun "; if LuoJiFan HuiChongFuXie or Cong not Xie . 
5. ** LuJing **: current_dir JiaDing __file__ in controller/d4func/; if WenJianYiDong , sys.path KeNengCuo . 

### 5.3 ZhengQueZuoFa 

- YanGeBaoChi step1 -> step2 -> step3 -> save ShunXu ; QueBao ScreenshotHandler, RegionDetector AnYueDingXieRu d4_data and shared data; step3 and map_name_recognizer YueDingYiZhi (detected_regions['region_images']['Map Name'], is_post_switch_idle) ; LuJing and project structure YiZhi . 

---

## Liu , and apology document GuanXi 

if CiQian because ShangShuRenYiDian ( such as slot_line_scan LuJing / YanSe , interface_manager ShunXu or Optimized/Anchor Hun use , coordinate_picker client_mode/ HuiDiao , d4_extension_thread item Jian or shutdown, exp_farming step ShunXu or d4_data YiLai ) DaoZhiFanFuGaiCuo or understand PianCha , KeShi for WeiXianTongDuYueDingSuoZhi . this note YiXieRu cursor_AI_ apology directory , and in Cursor_ ZhuanShu apology document .md in ZengJia to this Wen Yin use . interface_manager, d4_extension_thread Yi in XianQianZhangJieTi and , this Jie and to Ying technical note TongYi for Zhun . 
