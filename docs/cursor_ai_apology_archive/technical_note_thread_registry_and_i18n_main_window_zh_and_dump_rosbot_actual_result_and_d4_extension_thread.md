# technical note : thread_registry, i18n_main_window_zh, dump_rosbot_actual_result, d4_extension_thread

** Mu **: note CiSiChuWenJian / DaiMa ZhiZe , Yi by WuJie or GaiCuo Yuan because , to and ZhengQueYueDing . 

** She and WenJian **: 
- `runtime/thread_registry.py`
- `providor/i18n/i18n_main_window_zh.json`
- `scripts/dump_rosbot_actual_result.py`
- `d3utils/d4_extension_thread.py`

---

## Yi , runtime/thread_registry.py

### 1.1 ZhiZe and YueDing 

- ** purpose **: ** XianChengJi in Suo have Zhe ** (THREAD BUS ShengMingZhouQiCe ) ; position at runtime, and share ( JinGongXiangShuJu ) FenLi . YueDing : ** Suo have XianChengShiLiJin in CiChuangJian and Chi have , no DongTaiChuangJian **; YiCiXingRenWuTongGuo timer_manager.submit_one_shot (timers.one_shot_tasks) TiJiao ; ZhangZhuXianCheng (extension, macro fallback, tray, game_interface_macro) in QiDong when in CiChuangJian . **create_extension_threads(schedule, panel, current_skill_config)**: ChuangJian and QiDong MainFunctionThread, AuxiliaryFunctionThread, D3ExtensionThread, D4ExtensionThread; **panel.set_d3_extension_thread(_d3_extension_thread)**; Diao use set_*_thread() XieRuQuanJu ; **start_timer_loop_after_ui_ready()**: reapply_sigint_sigbreak_ignore_for_gui, timer_manager.start(), submit_one_shot(do_window_monitor_initial_check). start_macro_fallback(controller), stop_macro_fallback; start_tray(tray); start_game_interface_macro / stop_game_interface_macro. **get_thread_registry()** DanLi , JinZhuXianChengYingDiao use . 
- ** YueDing **: JinZhuXianCheng (controller/ ChuShiHuaFang ) Diao use ThreadRegistry; create_extension_threads in UI then XuHouDiao use YiCi ; ShunXu for XianChuangJianZai set_* Zai start_timer_loop; not in Qi it module ZhiJie new KuoZhanXianCheng . 

### 1.2 Yi by WuJie or GaiCuo Yuan because 

1. ** DiaoHuan create_extension_threads within ShunXu **: if Xian start() Zai set_d3_extension_thread(panel), panel KeNengShangWeiChi have d3_extension_thread, HouXu panel CeLuoJiQu not to XianCheng ; if Xian set_*_thread Zai start, and DangQianShiXianYiZhi , but if LouDiao panel.set_d3_extension_thread, D3 KuoZhan panel no FaKongZhi D3 XianCheng . 
2. ** in BieChuChuangJianKuoZhanXianCheng **: if in controller or UI in ZhiJie D4ExtensionThread() and start(), and " Jin ThreadRegistry ChuangJian and Chi have " not Fu ; get_d4_extension_thread() Reng for None, register_extension_handlers etc. Na not to D4 XianCheng . 
3. **start_timer_loop_after_ui_ready Diao use when Ji **: if in UI Wei then Xu or create_extension_threads of QianDiao use , do_window_monitor_initial_check KeNengZao at ZhuangTai / panel then Xu ; Ying in run() in create_extension_threads of HouDiao use . 
4. **macro fallback and main_thread**: start_macro_fallback by controller in no main_thread when Diao use ; if main_thread Cun in but RengDiao start_macro_fallback, HuiDuoChuYi macro XianCheng ; LuoJiShangYing by controller GenJu get_main_function_thread() is Fou for KongJueDing . 
5. ** DanLi and Diao use Fang **: JinZhuXianChengYingDiao use get_thread_registry(); if in sub XianCheng in Diao use or DuoCi create_extension_threads, HuiChongFuChuangJianXianCheng or ZhuangTaiHunLuan . 

### 1.3 ZhengQueZuoFa 

- Suo have KuoZhanXianChengJinTongGuo get_thread_registry().create_extension_threads() ChuangJian ; in d3_macro_controller.run() in UI then XuHouDiao use YiCi ; SuiHou start_timer_loop_after_ui_ready(); not in Qi it module ChuangJian D3/D4/Main/Auxiliary XianCheng ; panel.set_d3_extension_thread BiXu in create_extension_threads within Diao use . 

---

## Er , providor/i18n/i18n_main_window_zh.json

### 2.1 ZhiZe and YueDing 

- ** purpose **: ** ZhuChuangKou ** XiangGuan ** in Wen ** WenAn , Gong i18n_manager AnYuYanJiaZai ( WenJianMing i18n_main_window_{language}.json) . structure : **ui.main_window** (title, back_button, language, menu.*) , **button_area**, **tabs**, **macro_controls**, **bottom_bar**, **status_bar**, **main_functions_panel**, **system_tray** etc. . DaiMa in TongGuo get_ui_text("main_window.title"), get_ui_text("main_window.menu.language") etc. QuWen ; i18n_manager JiaZai when TongChangAn ui MingMingKongJianHe and , key for main_window.title or ui.main_window.title ShiShiXian and Ding . 
- ** YueDing **: key LuJing and DaiMa in get_ui_text Diao use YiZhi ; and i18n_main_window_en.json structure YiZhi ; newly added / ShanChu / GaiMing key XuTong step DaiMa and YingWenDang . 

### 2.2 Yi by WuJie or GaiCuo Yuan because 

1. **key LuJing and DaiMa not YiZhi **: if DaiMa use get_ui_text("main_window.title") and JSON for ui.window.title or main_window.window_title, HuiQu not to , XianShi key or HuiTuiMoRen . 
2. **JSON structure and i18n_manager YueDing not Fu **: if i18n_manager QiWang MingMingKongJian or WenJianMing (i18n_main_window_zh.json) or DingCengJian (ui) BianHua , JiaZaiHuiCuo or Qu not to main_window Xia within Rong . 
3. ** in YingWen key not Tong step **: if i18n_main_window_zh.json newly added key but en WeiJia , or en GaiMing zh WeiGai , YuYanQieHuanHouQueYi or XianShi key. 
4. ** and Qi it i18n WenJianHunXiao **: ZhuChuangKouWenAn in Ci ; tabs/rosbot etc. KeNengBuFen in i18n_tabs_*, i18n_rosbot_panel_*; if Ba main_window key Xie to tabs WenJian or Fan of , HuiQuCuo . 

### 2.3 ZhengQueZuoFa 

- ZhuChuangKou , CaiDan , ZhuangTaiLan , XiTongTuoPan etc. WenAn key and diablo3_macro_ui, title_bar, menu_bar, system_tray etc. Diao use YiZhi ; XiuGai key when Tong step Suo have get_ui_text Diao use and i18n_main_window_en.json; BaoChi and i18n_manager JiaZaiLuoJi ( MingMingKongJian , WenJianMing ) YiZhi . 

---

## San , scripts/dump_rosbot_actual_result.py

### 3.1 ZhiZe and YueDing 

- ** purpose **: ** TiaoShiJiao this **, JiangDangQian ROSBOT ChaZhaoJieGuoWanZheng dump to WenJian ( Han title etc. ) . ** Cong pyapps/d3-check Yun line **. use d3utils.rosbot_manager: get_ros_directory(), find_other_exe_files(), find_rosbot_exe(), get_rosbot_window(), get_rosbot_detection(), get_running_rosbot_processes(), is_running(); output XieRu **scripts/test_rosbot_actual_result.txt**. LuJing : project_root = dirname(dirname(abspath(__file__))), repo_root ZaiShangYiJi ; if ros_directory Wei config HuiChangShi initialize_config(). 
- ** YueDing **: and scan_rosbot_running LeiSi , Yun line directory and CONFIG YingXiangJieGuo ; output LuJing for project_root/scripts/test_rosbot_actual_result.txt, i.e. d3-check Xia scripts directory . 

### 3.2 Yi by WuJie or GaiCuo Yuan because 

1. ** Yun line directory CuoWu **: if Cong repo Gen or Qi it directory Yun line , sys.path or project_root Cuo , import ShiBai or output Xie to CuoWu position Zhi . 
2. **CONFIG WeiJiaZai **: if ros_directory for KongQie initialize_config ShiBai , dump ros_directory for Kong , find_other_exe_files etc. for Kong , YiWuPan for " no ROSBOT". 
3. ** output LuJing hardcode **: output GuDing for scripts/test_rosbot_actual_result.txt; if Jiao this by Nuo to Qi it Bao or Xu output to BieChu , XuGai for CanShu or config . 
4. ** and scan_rosbot_running FenGong **: this Jiao this for WanZheng dump ( HanSuo have title, detection, processes) ; scan_rosbot_running for KongZhiTaiJianYao output ; WuHunXiaoLiangZhe purpose or output GeShi . 

### 3.3 ZhengQueZuoFa 

- Cong pyapps/d3-check Yun line ; QueBao CONFIG YiJiaZai ; output LuJing if XuKeBianKeGai for CanShu ; and rosbot_manager QiYueYiZhi (get_rosbot_detection status/window_info etc. ) . 

---

## Si , d3utils/d4_extension_thread.py

### 4.1 ZhiZe and YueDing 

- ** purpose **: **D4 Zhuan use XianCheng **, TiDai timer_manager to d4_controller ZhuCe . every **D4_TICK_INTERVAL** (3s) Dang **d4_data.is_exp_farming_running() or d4_data.debug_window_open** when Diao use **get_d4_controller().process()**. **request_shutdown()** SheZhi _shutdown Event, run() in sleep Fen **0.1s Xiao step ** to Bian and when XiangYingTuiChu . ShiLi by **ThreadRegistry.create_extension_threads** ChuangJian and TongGuo **set_d4_extension_thread** XieRuQuanJu ; **get_d4_extension_thread()** GongWaiBuHuoQu . 
- ** YueDing **: JinCiXianChengQuDong d4_controller.process(); TuiChu when BiXu request_shutdown() ( such as execute_shutdown or app TuiChuLiuCheng ) ; process() within not YingZhang when JianZuSe , FouZe 3s JianGeHuiLaChang ; item Jian and d4_controller.get_interceptor() YiZhi (exp_farming or debug_window_open) . 

### 4.2 Yi by WuJie or GaiCuo Yuan because 

1. ** item Jian and d4_controller not YiZhi **: if CiChu use Qi it item Jian ( such as Jin exp_farming) and d4_controller or interceptor KaoLv debug_window_open, HuiShaoDiao process() or debug ChuangKouMoShiXia not ShuaXin . 
2. ** Wei request_shutdown**: if app TuiChu when Wei to D4ExtensionThread Diao use request_shutdown(), XianChengHuiYiZhi sleep not TuiChu ; execute_shutdown or TongYiTuiChuLiuChengYingTongZhiSuo have KuoZhanXianCheng . 
3. **process() ZuSe **: if process() within Mou step ZuSe ( such as Zhang when Jian IO or DanChuang ) , this XianChengHuiKaZhu , 3s JianGeShiXiao ; YingBaoZheng process() for Duan when Zhi line . 
4. ** in BieChuChuangJian D4ExtensionThread**: if in ThreadRegistry Wai new D4ExtensionThread and start(), set_d4_extension_thread WeiDiao use , get_d4_extension_thread() Reng for None, register_extension_handlers etc. Na not to D4 XianCheng . 
5. **sleep step Zhang **: DangQian 0.1s step , Gong D4_TICK_INTERVAL*10 Ci ; if Gai for DanCiZhang sleep, shutdown XiangYingHuiBianMan . 

### 4.3 ZhengQueZuoFa 

- JinTongGuo ThreadRegistry.create_extension_threads ChuangJian and start; TuiChu when TongYi request_shutdown(); item Jian and d4_controller YiZhi ; process() BaoChiDuan when ; sleep BaoChiXiao step to XiangYing shutdown. 

---

## Wu , and apology document GuanXi 

if CiQian because ShangShuRenYiDian ( such as thread_registry ChuangJianShunXu or panel.set_d3_extension_thread LouDiao , i18n_main_window_zh key and DaiMa or en not Tong step , dump_rosbot_actual_result Yun line directory or output LuJing , d4_extension_thread item Jian or Wei request_shutdown or BieChuChuangJian ) DaoZhiFanFuGaiCuo or understand PianCha , KeShi for WeiXianTongDuYueDingSuoZhi . this note YiXieRu cursor_AI_ apology directory , and in Cursor_ ZhuanShu apology document .md in ZengJia to this Wen Yin use . 
