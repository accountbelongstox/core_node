# technical note : ROSBOT_WINDOW_FIND, _obsolete_window_analyzer, game_assistant_controller

** Mu **: note CiSanChuWenJian ZhiZe , Yi by WuJie or GaiCuo Yuan because , to and ZhengQueYueDing . ** XiuGaiQianQingXianTongDu this note . **

** She and WenJian **: 
- `docs/ROSBOT_WINDOW_FIND.md`
- `utils/_obsolete_window_analyzer.py`
- `controller/game_assistant_controller.py`

---

## Yi , docs/ROSBOT_WINDOW_FIND.md

### 1.1 ZhiZe and YueDing 

- ** purpose **: ROSBOT ChuangKouChaZhaoLuoJi QuanWei note . HeXin for ** JinAnJinChengZhao **: MeiJu exe LuJing in "ROS directory " Xia Suo have JinCheng , to every PID QuZhuChuangKou (find_window_by_pid) ; YouXianFanHui have FeiKong title ChuangKou . ** not AnGuDingBiaoTi ** (RoS-BoT/ROSBOT) ChaZhao , because QiDongHouShiJi UI ChuangKouWangWangShu at Tong directory other exe, BiaoTi and exe Ming all KeNengBianHua . ShiXian position Zhi : `d3utils/rosbot_manager.py` `get_rosbot_window()`, `_pids_with_exe_under_ros_dir()`, `find_window_by_pid(pid)`; Diao use RuKou `d3utils/rosbot_ui_automation.py` `run_after_rosbot_start()` within LunXun get_rosbot_window. 
- ** config ros_directory**: LaiYuan `CONFIG["ros_settings"]["ros_directory"]`, Ke for ** directory ** or ** Zhu exe LuJing **. `_ros_dir_norm_for_pid` use at PID PiPei : if config is exe LuJingZe `os.path.dirname(_ros_directory)`, FouZe for config directory . `get_ros_directory()`, `find_rosbot_exe()`, `start()`, `is_running()`, `kill_if_running()` JunYiLaiCi . BiaoTi unique LaiYuan is `win32gui.GetWindowText(hwnd)`, and exe Ming , ChuangKouLeiMing no Guan . 
- ** and Yuan _obsolete_ to Zhao **: ZhaoChuang etc. Jia at Yuan wait_for_new_other_exe find_window_by_pid; DangQian ROSBOTManager QiDong use **Popen** ( and Yuan _obsolete_rosbot_manager YiZhi ) , ZhanWang use **explorer** ( and _obsolete_process_manager YiZhi ) . etc. ZhuJieMian : Zhao to ChuangKouHou SERVER_WAIT 10s, ZaiLunXunZhuDangAn Tab; Zhi line uiautomation Qian ** ZaiCiDiao use get_rosbot_window()** QuDangQian hwnd, BiMianJuBingShiXiao . 

### 1.2 YiCuoDian 

- if An " GuDingBiaoTi " ChaZhao ROSBOT ChuangKouHuiZhao not to ( WenDangMingQue not AnBiaoTi ) ; Gai ros_directory YuYi or _ros_dir_norm_for_pid Wei and is_running/kill_if_running/get_rosbot_window YiZhiHui PID JiHeCuo ; Gai run_after_rosbot_start wait_sec or etc. ZhuJieMianLuoJiWei and WenDangTong step HuiChao when or Lou etc. ; Shan or Gai " ZaiCiDiao use get_rosbot_window()" HuiZhang when Jian etc. DaiHouJuBingShiXiao . 

### 1.3 ZhengQueZuoFa 

- XiuGai ROSBOT ChuangKouChaZhao , rosbot_manager, run_after_rosbot_start QianBiDu this WenDang ; Fan " Zhao ROSBOT ChuangKou " TongYi use get_rosbot_manager().get_rosbot_window(), not AnBiaoTiMeiJu ; Gai ros_settings.ros_directory or _ros_dir_norm_for_pid when and get_ros_directory, _pids_with_exe_under_ros_dir to Zhao ; and _obsolete_rosbot_manager ChaYi ( such as etc. Chuang 60s vs DangQian wait_sec) in WenDang in YiXieMing , GaiShiXianXuTong step WenDang . 

---

## Er , utils/_obsolete_window_analyzer.py

### 2.1 ZhiZe and YueDing 

- ** purpose **: ** YiFeiQi **. WindowAnalyzer use `get_window_by_titles(window_titles)` ** AnBiaoTi ** MeiJuChuangKou (win32gui.EnumWindows, to every hwnd if `title in window_title` ZeFanHui ) , and ROSBOT_WINDOW_FIND " JinAnJinChengZhao , not AnGuDingBiaoTi "** WanQuanXiangFan **. use DEBUG_DIR (providor_second) , utils.color_print; current_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) i.e. project Gen (utils parent) . TiGong get_window_info, enumerate_controls_ui_automation, enumerate_child_windows_legacy, take_screenshot, draw_element_numbers, analyze_window etc. , use at LiShiTiaoShi / FenXi , FeiDangQian ROSBOT ZhaoChuangLiuCheng . 
- ** YueDing **: not Yin use , not KuoZhan ; ShanQianBi grep QuanCang confirm no import or Yin use ; if Wu use this LeiZhao ROSBOT ChuangKouHui and rosbot_manager.get_rosbot_window() and ROSBOT_WINDOW_FIND YueDingChongTu ( AnBiaoTiZhao not to other exe ChuangKou ) . 

### 2.2 YiCuoDian 

- WuYin use or in XinLuoJi in Diao use WindowAnalyzer.get_window_by_titles Zuo ROSBOT ZhaoChuangHuiWeiFan " JinAnJinChengZhao "; ShanWenJianWei grep HuiDaoZhi ImportError; Jiang this WenJian and rosbot_manager or ROSBOT_WINDOW_FIND Hun for YiTanHuiGaiCuoShiXian or WenDang . 

### 2.3 ZhengQueZuoFa 

- Fan ROSBOT ZhaoChuangTongYi use rosbot_manager.get_rosbot_window() and docs/ROSBOT_WINDOW_FIND.md YueDing ; not Yin use _obsolete_window_analyzer; ShanQian grep _obsolete_window_analyzer, WindowAnalyzer. 

---

## San , controller/game_assistant_controller.py

### 3.1 ZhiZe and YueDing 

- ** purpose **: YouXi assistant GongNengKongZhiQi ( KaNaiMoHe / blacksmith etc. ) . current_dir = os.path.dirname(os.path.abspath(__file__)) (controller/) , project_root = os.path.dirname(current_dir) ( project Gen ) . YiLai : can_start_assistant, set_assistant_running, should_stop_assistant, reset_assistant_state (providor_index) ; D3InterfaceManager, get_d3_scaled_template_matcher, get_game_interface_data; Xian **collect_ui_info(force_new_capture=True)**, ZaiQu shared_data.game_window_image Zuo **_detect_interface_from_full_window** ( QuanChuangKouPiPei , Qie match center Xu in **left 30%**) : bag_opened_indicator blacksmith, kanai_cube_left_panel_indicator kanai_cube; Zai **collect_bag_info_from_current_shared** ( not ErCiJieTu ) ; RanHouGenJu interface_type Diao get_kanai_cube_handler().handle_upgrade_operation() or get_blacksmith_handler() handle_auto_salvage_by_slots / handle_salvage_operation. LEFT_REGION_RATIO=0.3, TEMPLATE_BAG_OPENED, TEMPLATE_KANAI_LEFT for MuBanMing and left QuPanDing . 
- ** YueDing **: XuZunShou technical note _slot_line_scan and interface_manager in "** Xian collect_ui Zai collect_bag**""Optimized and Anchor not KeHun use "; assistant ZhuangTai by providor_index can_start_assistant/set_assistant_running/should_stop_assistant/reset_assistant_state KongZhi ; auto_salvage QuZi CONFIG["macro_configs"]["auxiliary_config"]["auto_salvage"] (enabled, keep) ; ReJianChuFaHouYiCiJieTu , QuanChuangKouPiPei , in Xin on the left 30% CaiRenDingJieMianLeiXing . 

### 3.2 YiCuoDian 

- Xian collect_bag Zai collect_ui or Hun use Optimized/Anchor HuiWeiFan interface_manager YueDing ; Gai LEFT_REGION_RATIO or TEMPLATE_* Wei and get_d3_scaled_template_matcher, MuBan config Tong step HuiPiPeiCuo ; Gai assistant ZhuangTaiWeiTongGuo providor_index Si HanShuHui and ReJian / panel ZhuangTai not Tong step ; Gai game_window_image XieRu when Ji or LaiYuanWei and collect_ui_info, get_game_interface_data to ZhaoHui _detect_interface_from_full_window Na to Kong or JiuTu . 

### 3.3 ZhengQueZuoFa 

- XiuGaiQianTongDu technical note _slot_line_scan and interface_manager and this technical note ; BaoChi " Xian collect_ui_info Zai collect_bag_info_from_current_shared"; assistant ZhuangTaiJinJing providor_index can_start_assistant/set_assistant_running/should_stop_assistant/reset_assistant_state; GaiMuBanMing or left QuBiLi and d3_scaled_template_matcher, MuBan config YiZhi . 

---

## Si , SanChuJiaoChaZhuYi 

- **ROSBOT_WINDOW_FIND** and rosbot_manager, run_after_rosbot_start, _obsolete_rosbot_manager to Zhao ; **_obsolete_window_analyzer** and ROSBOT ZhaoChuang no Guan , AnBiaoTiZhaoChuangYiFeiQi , WuYin use ; **game_assistant_controller** and interface_manager, providor_index, template config , LEFT_REGION_RATIO YiZhi . XiuGaiQianQingXianTongDu this note and SanChuWenJian and to YingXiaoFeiZhe . 
