# technical note : gui_config.json, game_interface_data.py, ROSBOT_WINDOW_AND_STATUS.md, _obsolete_daily_schedule.py

** Mu **: note CiSiChuWenJian / WenDang ZhiZe , Yi by WuJie or GaiCuo Yuan because , to and ZhengQueYueDing . 

** She and WenJian **: 
- `config/gui_config.json`
- `share/game_interface_data.py`
- `docs/ROSBOT_WINDOW_AND_STATUS.md`
- `utils/_obsolete_daily_schedule.py`

---

## Yi , config/gui_config.json

### 1.1 ZhiZe and YueDing 

- ** purpose **: GUI Yun line MoShi config . **gui.enabled**, **gui.type** ("web") ; **web_frontend** (enabled, auto_start, nuxt_app_dir, app_namespace, host, port, mode, auto_open_browser, startup_delay) ; **http_bridge** (enabled, host, port, auto_register_handlers) ; **system_tray** (enabled, icon_text, menu_items ShuZu , every item key/enabled) ; **legacy_ui** (enabled, type: "tkinter") . JiaZaiFangTongChangJing CONFIG or load_config DuQu , JianLuJingXu and DaiMaYiZhi . 
- ** YueDing **: nuxt_app_dir for Xiang to LuJing ( such as "../../poly_apps/nuxt_main") when Xiang to at project Gen or Yun line directory ; Gai key Ming ( such as web_frontend.port, system_tray.menu_items[].key) Xu and QiDong web, system_tray DaiMaTong step ; menu_items key (open_web, restart_frontend, restart, exit) and TuoPanCaiDanLuoJi to Ying , ZengShan or GaiMingXuTong step . 

### 1.2 Yi by WuJie or GaiCuo Yuan because 

1. ** JianLuJing and DaiMa not YiZhi **: if in JSON in GaiMing or NuoCeng ( such as gui.web DaiTi gui.type) WeiTong step CONFIG DuQuChuHui KeyError or Qu to MoRenZhi . 
2. **nuxt_app_dir Xiang to LuJing **: if Gai for Jue to LuJing or Xiang to LuJingJiZhunCuoHui web QianDuanQiDongShiBai . 
3. **menu_items and TuoPan line for **: if ZengShan key or Gai enabled Wei and system_tray CaiDanGouJianLuoJiTong step HuiCaiDanCuo or item not XianShi . 

### 1.3 ZhengQueZuoFa 

- XiuGai gui_config.json Qian confirm Suo have DuQu CONFIG["gui"], CONFIG["legacy_ui"], web_frontend, http_bridge, system_tray DaiMa ; GaiJianLuJing or menu_items structure when Tong step Diao use Fang ; nuxt_app_dir BaoChi and project structure YiZhi . 

---

## Er , share/game_interface_data.py

### 2.1 ZhiZe and YueDing 

- ** purpose **: **D3/D4 YouXiJieMianGongXiangShuJuDanYuan **. **project_root** = dirname(dirname(current_dir)) i.e. **pyapps/d3-check** (share FuJiZaiFuJi ) . **get_game_interface_data()** FanHui **D3InterfaceData** DanLi ; **rosbot_flow_master_enabled**, **ensure_battlenet_only_master_enabled** ** Jin by d3utils.rosbot_flow_state set_rosbot_flow_master_enabled / set_ensure_battlenet_only_master_enabled XieRu **, Jian FLOW_STATE_OWNERSHIP_DESIGN; Qi it ZhuangTai by screenshot_provider, ui_region_collector, bag_info_collector, d3_status_provider, battlenet_status_provider, rosbot_status_provider etc. XieRu . ZuoBiao spec : subtract border scale add border back (COORDINATE_SCALE_SPEC) ; WINDOW_BORDER_LEFT/RIGHT/BOTTOM, TITLE_BAR_HEIGHT, D3_STANDARD_OUTER_*. 
- ** YueDing **: RenHe module not in Fei rosbot_flow_state ChuXie rosbot_flow_master_enabled or ensure_battlenet_only_master_enabled; Gai D3InterfaceData char segment or set_* method XuTong step Suo have XiaoFeiZhe ; Gai project_root or path XuBaoZheng share Xia import Reng have Xiao ; Gai calculate_unified_scaled_coordinate or BianKuangChangLiangXu and COORDINATE_SCALE_SPEC, STANDARD_COORDS, D4_STANDARD_COORDS YiZhi . 

### 2.2 Yi by WuJie or GaiCuo Yuan because 

1. ** LiuChengZhuangTaiXieQuanXian **: Gou B garbage Cursor KeNeng in provider or UI in ZhiJieXie rosbot_flow_master_enabled / ensure_battlenet_only_master_enabled, PoHuai " Jin rosbot_flow_state KeXie " DanYuanYueDing . 
2. **project_root and DaoRu **: if Gai current_dir JiSuan or project_root CengShuHui sys.path Cuo or providor/constants etc. DaoRuShiBai . 
3. ** ZuoBiao and BianKuang **: if Gai WINDOW_BORDER_* or scale GongShiWei and COORDINATE_SCALE_SPEC, d3_scale_single_coord, get_scaled_* Tong step HuiDianJi or QuYuCuo . 
4. **callback and ZhuXianCheng **: register_callback, _drain_and_notify, start_main_thread_poll YueDingHuiDiaoJin in ZhuXianChengZhi line ; if in HouTaiXianChengDiao use after or ZhiJieDiao callback HuiWeiFanYueDing . 

### 2.3 ZhengQueZuoFa 

- XiuGaiQianDu FLOW_STATE_OWNERSHIP_DESIGN; JinTongGuo rosbot_flow_state set_* Xie flow_master/bn_only; GaiZuoBiao or BianKuang when Tong step COORDINATE_SCALE_SPEC and Suo have get_scaled_*, calculate_unified_scaled_coordinate XiaoFeiZhe ; not Gai project_root CengShuChuFeiTong step Suo have share XiaYiLai . 

---

## San , docs/ROSBOT_WINDOW_AND_STATUS.md

### 3.1 ZhiZe and YueDing 

- ** purpose **: **ROSBOT ChuangKou and KuoZhanZhuangTai ** note ; ** QuanWeiLiuCheng ** for ROSBOT_LOOKUP_FLOW.md. YueDing : Tong directory exe JinAnJinChengZhao (other exe Xian , Zai main exe) ; ** no BiaoTiGuoLv **; KuoZhanZhuangTai not_found / running / paused; ** unique RuKou ** get_rosbot_window(), get_rosbot_detection(), refresh_rosbot_status(), get_running_rosbot_processes(); ShiXian position at rosbot_manager, rosbot_status_provider; ros_directory LaiZi CONFIG["ros_settings"]["ros_directory"]; refresh_rosbot_status Xie game_interface_data. 
- ** YueDing **: FanXu ROSBOT ChuangKou or ZhuangTaiXuJingShangShuRuKou ; not AnBiaoTiMeiJu or ZiShiXianAnBiaoTiZhaoChuang ; Gai ros_directory or ChaZhaoShunXuXuTong step this WenDang and ROSBOT_WINDOW_FIND, ROSBOT_LOOKUP_FLOW; WenDang and ShiXianXuYiZhi . 

### 3.2 Yi by WuJie or GaiCuo Yuan because 

1. ** AnBiaoTiChaZhao **: if in RenYiChuAnChuangKouBiaoTiZhao ROSBOT i.e. WeiFan "no title filtering" and ROSBOT_LOOKUP_FLOW. 
2. ** DuoRuKouXie game_interface_data**: if in Fei refresh_rosbot_status or FeiYueDingLuJingXie ROSBOT XiangGuanZhuangTaiHui and "single entry points" not Fu . 
3. ** WenDang and ShiXianTuoJie **: if rosbot_manager Gai find_other_exe_files ShunXu or find_window_by_pid YuYiWeiGengXin this WenDangHuiWuDaoHouXuWeiHu . 

### 3.3 ZhengQueZuoFa 

- to ROSBOT_LOOKUP_FLOW for QuanWei ; Jin use get_rosbot_window, get_rosbot_detection, refresh_rosbot_status, get_running_rosbot_processes; GaiShiXian when Tong step ROSBOT_WINDOW_AND_STATUS, ROSBOT_WINDOW_FIND. XiangJian technical note _ROSBOT_WINDOW_FIND and _obsolete_window_analyzer and game_assistant_controller.md. 

---

## Si , utils/_obsolete_daily_schedule.py

### 4.1 ZhiZe and YueDing 

- ** purpose **: **_obsolete_** QianZhui = ** YiFeiQi **. DailyScheduleGenerator Ji at server_region, rest_time ShengCheng every RiXiuXi when segment ; YiLai CONFIG server_settings.server_region, daily_schedule.rest_time_range, daily_schedule.debug; CURRENT_USER_DATA_PATH, schedule_file in use HuShuJu directory Xia . not Can and DangQianZhuLiuCheng , WuYin use , WuKuoZhan . 
- ** YueDing **: ** Wu in XinDaiMa in import or Diao use **; ShanChuQianXu **grep confirm no Yin use **, FouZe ImportError; if WuDang " DangQianRiChengLuoJi " use Hui and Xian have LiuChengTuoJie . 

### 4.2 Yi by WuJie or GaiCuo Yuan because 

1. ** Wu use FeiQi module **: Gou B garbage Cursor KeNeng in XinGongNeng in Yin use DailyScheduleGenerator or CONFIG['daily_schedule'], DaoZhiYiLaiFeiQiLuoJi . 
2. ** ShanQianWei grep**: if JianYiShanChu or ZhiJieShan and Wei grep HuiPoHuaiRengYin use GaiWenJian Jiao this or test . 
3. ** and config JianHunXiao **: daily_schedule, server_settings if in BieChuReng by Du , Gai CONFIG structure when WuGai this WenJianYiLai JianHui this WenJian line for Cuo ( but this WenJianYiFeiQi , Ying to YiChuYin use for Xian ) . 

### 4.3 ZhengQueZuoFa 

- not Yin use _obsolete_daily_schedule; ShanChuQian grep Quan project ; if XuRiChengGongNengYing in Fei _obsolete module ShiXian and and CONFIG YueDingYiZhi . 

---

## Wu , SiChuLianDong and YiCuo summary 

- **gui_config.json** by CONFIG JiaZai , JianLuJing and web/system_tray QiDongDaiMaYiZhi ; and **game_interface_data** no ZhiJieOuHe , but if GUI MoShiYingXiangShuiXie game_interface_data XuZunShou FLOW_STATE_OWNERSHIP. 
- **game_interface_data.py** for D3 ZhuangTai and ZuoBiaoDanYuan ; rosbot ZhuangTaiXieRu by **ROSBOT_WINDOW_AND_STATUS** and rosbot_status_provider, refresh_rosbot_status YueDing ; rosbot_flow_master_enabled / ensure_battlenet_only_master_enabled Jin rosbot_flow_state Xie . 
- **ROSBOT_WINDOW_AND_STATUS.md** and ROSBOT_LOOKUP_FLOW, ROSBOT_WINDOW_FIND, rosbot_manager ShiXianXuTong step ; not KeAnBiaoTiZhaoChuang . 
- **_obsolete_daily_schedule.py** YiFeiQi , WuYin use , ShanQianBi grep. 

CiQian if because WeiXianTongDuShangShuYueDing and in CiSiChuFanFuGaiCuo or understand PianCha , the responsibility lies with the dog B garbage Cursor. HouXuXiuGaiQian to this note for Zhun . 
