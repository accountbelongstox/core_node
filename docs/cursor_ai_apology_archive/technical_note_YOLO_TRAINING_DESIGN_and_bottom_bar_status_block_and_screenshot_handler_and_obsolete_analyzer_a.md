# technical note : YOLO_TRAINING_DATA_COLLECTION_DESIGN, bottom_bar_status_block, screenshot_handler, _obsolete_analyzer_log, d3_macro_controller

** Mu **: note this WuChuWenDang / DaiMa ZhiZe , Yi by WuJie or GaiCuo Yuan because , to and ZhengQueYueDing . 

** She and WenJian **: 
- `docs/YOLO_TRAINING_DATA_COLLECTION_DESIGN.md`
- `ui/components/bottom_bar_status_block.py`
- `controller/d4func/screenshot_handler.py`
- `utils/_obsolete_analyzer_log.py`
- `controller/d3_macro_controller.py`

---

## Yi , docs/YOLO_TRAINING_DATA_COLLECTION_DESIGN.md

### 1.1 ZhiZe and YueDing 

- ** purpose **: YOLO XunLianShuJuCaiJi ** WanZhengSheJiFangAn **. RuKou : ZuoBiaoXiaoZhun panel "YOLO XunLianShuJuCaiJi " AnNiu (coordinate_calibration_panel) ; AnDangQianKeHuDuanJieTuHouDaKai **YOLO BiaoZhuChuangKou ** (YoloAnnotationWindow / YoloCollectorWindow) ; ShuJuMoXing : class_names, screenshot_history ( every item image + annotations) , current_index; BiaoZhuLeiXing rect/circle/polygon/freehand, DaoChuZhuan bbox; ShengChengShuJuJi to **YOLO_DATASET_BASE_DIR / yolo_dataset_YYYYMMDD_HHMMSS** ( or HuiHua directory session_dir) ; data.yaml, train/val HuaFen , Jin to have MuBiao TuXie .txt; i18n ui.coord_calibration.yolo_collect_button; **8 KaiFaXiJie ( YiShiXian ) **: Lin when directory , yolo_collect_config.json, current_subdataset.json, ShiBieLeiXingLieBiao and get_yolo_collect_class_color(index), BiaoZhuLieBiao " Tu " LieDieJia , ShuaXinJieTu not QingKong and ZhuiJia , generate_dataset_from_screenshot_history(..., output_dir=session_dir). 
- ** YueDing **: ShiXianXu and WenDangYiZhi : output LuJing , data.yaml Jian (path/train/val/nc/names) , BiaoQianGeShi , no MuBiao not Xie .txt; LeiBieYanSe by app_constants.get_yolo_collect_class_color(index); CONFIG Jian yolo_collect.session_dir, yolo_collect.classes. 

### 1.2 Yi by WuJie or GaiCuo Yuan because 

1. ** output directory and WenDang not Fu **: if ShiXianXie to Qi it LuJing or not use YOLO_DATASET_BASE_DIR/yolo_dataset_*, or " ShengChengShuJuJi " when XinJian when JianChuo directory and FeiDangQian session_dir, and 8.1/8.6 not Fu . 
2. **data.yaml or BiaoQianGeShi and Ultralytics not YiZhi **: if path use FanXieGang , or names Fei char Dian {0: name0, ...}, or BiaoQianWeiGuiYiHua 0~1 Liu position XiaoShu , or no MuBiaoTu also Xie .txt, XunLianHuiBaoCuo or GuanFangGongJu not Ren . 
3. ** ShuJuMoXing and WenDang not YiZhi **: if screenshot_history item Que image/annotations, or annotations Que class_id/type/rect etc. , or class_names and class_id not to Ying , ShengChengShuJuJi or HuaBuHuiCuo . 
4. ** ShuaXinJieTu line for **: WenDang 8.4 MingQue " not QingKong , not FuGai ", XinJieTu **append** to history; if ShiXianChengQingKong or FuGaiDangQian item , and SheJi not Fu . 
5. **i18n or ChangLiangWeiTong step **: if yolo_collect_button Wei in i18n_tabs_zh/en ui.coord_calibration Xia , or YOLO_COLLECT_HUE_* / get_yolo_collect_class_color Wei in app_constants in ShiXian , UI or YanSeHuiCuo . 

### 1.3 ZhengQueZuoFa 

- ShiXianQianTongDuQuanWenYouQi 4 ( ShuJuJiShengCheng ) , 8 ( YiShiXianXiJie ) ; output directory , data.yaml, BiaoQianGeShi , screenshot_history and session_dir line for and WenDangYiZhi ; LeiBieYanSe and CONFIG Jian and WenDangYiZhi . 

---

## Er , ui/components/bottom_bar_status_block.py

### 2.1 ZhiZe and YueDing 

- ** purpose **: DiBuLan ** ZhuangTai block **: Liang line , no BiaoTi , every line by **STATUS_ROW_1** / **STATUS_ROW_2** (status_row_config) config ; (label_i18n_key, var_key, default_fg); use status_vars[var_key] BangDing StringVar, make_status_item ShengCheng Label; **register_callback(value_labels)** Ba var_key -> value_Label dict HuiChuan to Diao use Fang , GongHouXuAnZhuangTaiGengXin value Label fg. Diao use Fang for bottom_bar.py: ChuanRu status_vars ( Han battlenet, ros, d3, map, stage, oauth, window_size etc. ) , _register_status_labels Cun for _value_labels, _update_ui_from_state when BianLi _value_labels She fg. 
- ** YueDing **: status_vars key BiXu and STATUS_ROW_1/STATUS_ROW_2 var_key YiZhi ; register_callback BiXu by Diao use QieChuanRu value_labels key and var_key YiZhi ; label_key for i18n key ( such as rosbot.battlenet_status) , Xu in i18n in Cun in . 

### 2.2 Yi by WuJie or GaiCuo Yuan because 

1. **status_vars Que key**: if STATUS_ROW_1/2 have ("rosbot.xxx", "oauth", None) and status_vars no "oauth", _build_row Hui skip Gai item, value_labels no oauth, DiBuLanGaiLie not XianShi or no FaGengXin . 
2. ** newly added / ShanChu line WeiTong step **: if in status_row_config ZengJia or ShanChuYi item , Wei in bottom_bar status_vars or _update_ui_from_state in Tong step , HuiDuoChuKongLie or ShaoLie or fg GengXinCuo key. 
3. **register_callback WeiZhengQueBaoCun **: if Diao use FangWeiBa value_labels CunXiaLai ( such as bottom_bar _value_labels) , HouXu _update_ui_from_state no FaGengXin value Label fg, ZhuangTaiLan not SuiZhuangTaiBianSe . 
4. **i18n key CuoWu **: if label_key in i18n in not Cun in or LuJingCuo , get_ui_text FanHui key or MoRen , XianShiYiChang . 

### 2.3 ZhengQueZuoFa 

- status_vars BaoHanSuo have STATUS_ROW_1/2 var_key; XiuGai status_row_config when Tong step XiuGai status_vars GouJian and _update_ui_from_state in BianLi key; BaoZheng register_callback ChuanRu value_labels by BaoCun and use at fg GengXin ; i18n key and i18n_tabs/rosbot etc. YiZhi . 

---

## San , controller/d4func/screenshot_handler.py

### 3.1 ZhiZe and YueDing 

- ** purpose **: D4 KongZhiQi use ** JieTu and XinXiCaiJi **. capture_and_collect_info(d4_data): Diao use get_screenshot_provider().gen(use_optimized_capture=True, window_titles=DIABLO_IV_WINDOW_TITLES); ChengGong when Xie **self.d4_data** (screenshot_data, game_window_size, fullscreen_size, window_offset, timestamp) and She d4_data.window_detected etc. ; ShiBai when Xie ** CanShu d4_data** window_detected=False etc. . save_screenshot_to_disk(screenshot_data, screenshot_dir) Jiang game_window_image Cun for d4_exp_farming_*.png. 
- ** YueDing **: Diao use FangChuanRu d4_data and get_d4_interface_data() Ying for TongYiShiLi ; ChengGongFenZhiXie is self.d4_data, if Diao use FangChuanRu is LingYiYin use , Ze " ChengGong " when Diao use FangNa to d4_data WeiGengXin , Jin self.d4_data GengXin , HuiDaoZhiShuJu not YiZhi . 

### 3.2 Yi by WuJie or GaiCuo Yuan because 

1. **d4_data Yin use not YiZhi **: capture_and_collect_info ChengGong when ZhiXie self.d4_data, CanShu d4_data WeiXie ; if Diao use FangChuan is get_d4_interface_data() TongYiShiLi , Ze self.d4_data i.e. GaiShiLi , YiZhi ; if Diao use FangChuan is Bie to Xiang , ChengGong when Diao use FangCe d4_data no XinJieTu , HouXu region_detector etc. Du is JiuShuJu . 
2. ** ShiBaiFenZhiZhiXieCanShu d4_data**: ShiBai when Xie is CanShu d4_data window_detected etc. , not Xie self.d4_data; if TongChangDiao use all Chuan get_d4_interface_data(), LiangChuYingTongYin use , no WenTi ; if Hun use , ShiBai when self.d4_data Reng for JiuZhi . 
3. ** Diao use ShunXu **: D4 LiuChengBiXuXian capture_and_collect_info Zai region_detection/map_switch etc. ; if XianDiao region_detector ZaiJieTu , screenshot_data for Kong , JianCeShiBai . 
4. **save_screenshot_to_disk DuLi **: XuChuanRuYi have screenshot_data; if in capture ShiBaiHouDiao use save, screenshot_data KeNeng for None or JiuTu . 

### 3.3 ZhengQueZuoFa 

- Diao use capture_and_collect_info when ShiZhongChuanRu get_d4_interface_data() FanHuiZhi , BaoZheng and handler within self.d4_data TongYiYin use ; or TongYiGai for ZhiXieCanShu d4_data and in ChengGong when also XieCanShu ; XianJieTuZaiZhi line region_detection etc. ; save_screenshot_to_disk Jin in Yi have have Xiao screenshot_data when Diao use . 

---

## Si , utils/_obsolete_analyzer_log.py

### 4.1 ZhiZe and YueDing 

- ** purpose **: WenJianMingDai **\_obsolete_**, BiaoShi ** YiFeiQi **. Yuan for GenJuRiZhi line GengXin TuZhuangTai : check_map_status(line), analyze_log_line(log_line); Cong CONFIG Du map_status (rift_start_triggers, rift_end_triggers, start_picking_items etc. ) , log_detection (start_loop, login_try) ; GengXin **GAME_STATE** (providor.providor_second) : mapstatus, pause, activate_loop_state, deactivate_loop_state etc. . 
- ** YueDing **: ZhuLiuCheng in Tu / RiZhiZhuangTai not YingYiLaiCi module ; if DangQianShiXian have ZhuanMen log monitor or map state TiGongFang , Ying use that TaoLuoJi , not in CiWenJianGai or CongCiWenJian import. 

### 4.2 Yi by WuJie or GaiCuo Yuan because 

1. ** DangZuoZhuLiuChengRiZhiJieXiRuKou **: if in log monitor or D3 KuoZhan in Diao use analyze_log_line QiWangGengXinQuanJu GAME_STATE, Hui and Xian have ZhuangTaiTiGongFang or flow not YiZhi ; Qie GAME_STATE and FLOW_STATE_OWNERSHIP in " ZhuangTai by LiuChengLeiKuChi have " KeNengChongTu . 
2. **CONFIG JianYiLai **: if ZhuLiuChengYi not use map_status/log_detection this XieJian , in CiGai CONFIG not HuiYingXiangZhuLiuCheng ; if ZhuLiuCheng use not TongJian , LiangTaoLuoJiHuiFenCha . 
3. ** in obsolete in JiaLuoJi **: in Ci newly added trigger or ZhuangTaiHuiXingChengSiDaiMa or and ZhuLiuChengChongFu . 

### 4.3 ZhengQueZuoFa 

- ZhuLiuCheng not Yin use _obsolete_analyzer_log; Tu / RiZhiZhuangTai to DangQianSheJiWenDang and ZhuangTaiTiGongFang for Zhun ; not in CiWenJianZengJiaGongNeng or XiuFu as ZhuFangAn . 

---

## Wu , controller/d3_macro_controller.py

### 5.1 ZhiZe and YueDing 

- ** purpose **: D3 HongYing use ** ZhuKongZhiQi **. ChuShiHua GameInterfaceController, Diablo3MacroUI; macro QiTing : start_macro/stop_macro trigger_extension_main_start_macro/stop_macro, get_thread_registry().start_macro_fallback/stop_macro_fallback; JiNeng config current_skill_config (config1~config4) , CONFIG.macro_configs.skill_configs, auxiliary_config; run(): ChuShiHua game_interface ChuangJian UI SheZhi macro/config HuiDiao ZhuCeYuYanJianTing window_monitor ZhuCe UI ZhuangTaiHuiDiao , panel.get_status_ui_callback(), refresh_window_status_if_inactive get_thread_registry().create_extension_threads register_extension_handlers start_timer_loop_after_ui_ready TuoPan ui.run() ( ZuSe ) execute_shutdown(). GuanJiYouXian ui._unified_exit(), FouZe fallback Ting macro, shutdown_game_interface, TuoPan stop, os._exit. 
- ** YueDing **: XianCheng and Ding when Qi by runtime.get_thread_registry(), register_extension_handlers, window_monitor TongYiZhuCe ; JiNeng config MingJin config1~config4; CONFIG Jian macro_configs.skill_configs, macro_configs.auxiliary_config; TuiChuYingZou _unified_exit to BaoZhengDing when Qi and XianChengZhengQueShouWei . 

### 5.2 Yi by WuJie or GaiCuo Yuan because 

1. ** ZhuCeShunXu or YiLaiCuoWu **: if create_extension_threads in register_extension_handlers of Qian , or window_monitor HuiDiaoWei in UI then XuQianZhuCe , HuiDaoZhiZhuangTai not ShuaXin or KuoZhanXianChengWeiNa to panel. 
2. **CONFIG JianCuoWu **: if DaiMa use macro_config.skill_config etc. DanShu or Qi it JianMing , and CONFIG structure not Fu , Qu not to config . 
3. **shutdown not Jing _unified_exit**: if ZhiJie os._exit and not Xian stop macro, shutdown game_interface, TingZhiTuoPan and Ding when Qi , KeNengLiuXiaHouTaiXianCheng or ZiYuanWeiShiFang . 
4. **MacroLoopThread and MainFunctionThread**: have main_thread when by main_thread Zhi line macro; no when by fallback MacroLoopThread; if LiangChuLuoJi not YiZhi or fallback WeiZhengQue stop, macro HuiTing not XiaLai or ChongFuZhi line . 
5. ** YuYanQieHuan **: _on_language_changed Dai 500ms debounce, and ZhuanFa to ui._on_language_changed; if UI WeiShiXianGai method or listener WeiZhuCe , YuYanQieHuan not ShengXiao . 

### 5.3 ZhengQueZuoFa 

- BaoChi run() within ZhuCe and QiDongShunXu and Xian have SheJiYiZhi ; CONFIG Jian and save_config ChuYiZhi ; GuanJiYiLvYouXian _unified_exit; JiNeng config Jin use config1~config4; main_thread and fallback QiTing and thread_registry YiZhi . 

---

## Liu , and apology document GuanXi 

if CiQian because ShangShuRenYiDian ( such as YOLO SheJiWenDang and ShiXianLuJing / ShuJuMoXing / ShuaXin line for not YiZhi , bottom_bar_status_block status_vars or register_callback WeiTong step , screenshot_handler d4_data Yin use Hun use , Wu use _obsolete_analyzer_log, d3_macro_controller ZhuCeShunXu or shutdown WeiZou _unified_exit) DaoZhiFanFuGaiCuo or understand PianCha , KeShi for WeiXianTongDuYueDingSuoZhi . this note YiXieRu cursor_AI_ apology directory , and in Cursor_ ZhuanShu apology document .md in ZengJia to this Wen Yin use . 
