# technical note : blacksmith_handler.py, _obsolete_dependency_checker.py, hotkey_registry.py, auxiliary_function_thread.py, _obsolete_daily_schedule.py

this note Zhen to to XiaWuChuWenJian : XiuGaiQianQingXianTongDu this note and to YingYuanMa . 

- `controller/ctl_func/blacksmith_handler.py`
- `utils/_obsolete_dependency_checker.py`
- `d3utils/d3u_common/hotkey_registry.py`
- `d3utils/auxiliary_function_thread.py`
- `utils/_obsolete_daily_schedule.py`

---

## Yi , controller/ctl_func/blacksmith_handler.py

- ** purpose **: blacksmith XiangGuanCaoZuo ( CeLanQie salvage Ye , DianFenJieAnNiu , AnGeZiDongFenJie ) . DanLi `get_blacksmith_handler()`. 
- ** LuJingYueDing **: `current_dir = os.path.dirname(os.path.abspath(__file__))` ( i.e. ctl_func) , `project_root = os.path.dirname(os.path.dirname(current_dir))` ( i.e. pyapps/d3-check) . GaiCengShuHuiDaoZhi sys.path or import Cuo . 
- ** YiLai **: `share.game_interface_data` `get_game_interface_data`, `get_scaled_blacksmith_salvage_button`, `get_scaled_blacksmith_tab_salvage_materials`, `get_scaled_blacksmith_salvage_dialog_salvage_button`, `get_scaled_blacksmith_salvage_dialog_confirm`; `shared_data` Shang `window_offset`, `game_window_size`, `game_window_image`, `bag_coordinates`, `bag_layout` ( Han `layout.items`) ; `providor.constants.common` `TMP_DIR`, `SCALED_TEMPLATES_CACHE_DIR`; `providor.providor_index` `CONFIG`. 
- ** YiCuoDian **: Gai `get_scaled_blacksmith_*` or game_interface_data Jian / structure WeiTong step HuiDianJiCuo ; `handle_salvage_operation()` no Can , `handle_auto_salvage_by_slots(keep)` Xu `keep` ( such as keep_ancient_plus/keep_primal) , Diao use Fang ( such as game_assistant_controller) Xu and CONFIG macro_configs.auxiliary_config.auto_salvage YiZhi ; CeLan use MuBan blacksmith_sidebar_tab_1/2, FenJieAnNiu use SuoFangZuoBiao ; temp JieTuXie `SCALED_TEMPLATES_CACHE_DIR` use HouShanChu . 
- ** ZhengQueZuoFa **: Gai CONFIG or handler JieKou when Tong step game_assistant_controller _handle_blacksmith_upgrade and auto_salvage FenZhi ; Gai share/game_interface_data or get_scaled_blacksmith_* when Xian grep this WenJian and game_assistant_controller; XiuGaiQianQingXianTongDu this note . 

---

## Er , utils/_obsolete_dependency_checker.py

- ** purpose **: JianCha and AnZhuangZhiDing Python Bao (psutil, pywin32, Pillow, pywinauto, uiautomation etc. ) . Lei `DependencyChecker`, RuKou `main()`. 
- ** YueDing **: WenJianDai `_obsolete_` QianZhui , BiaoShiYiFeiQi ; JinChaYue , not Yin use , ShanQianBi grep. Fei _obsolete DaiMa not import this module . 
- ** YiCuoDian **: if in BieChuYin use this WenJianHuiYiLaiFeiQiLuoJi ; ShanQianWei grep KeNengDaoZhiJiao this or AnZhuangLiuChengDuanLian ; Gai required_packages Jian or pip GuiGeWei and use Fang ( if have ) Tong step HuiLouZhuang or Ban this Cuo . 
- ** ZhengQueZuoFa **: not Yin use _obsolete_dependency_checker; ShanChuQian grep Quan project ; if XuYiLaiJianChaYing in Fei _obsolete module ShiXian ; XiuGaiQianQingXianTongDu this note . 

---

## San , d3utils/d3u_common/hotkey_registry.py

- ** purpose **: TongYiReJianZhuCe , Cong config DuQu and ZhuCe assistant ReJian etc. . DanLi `get_hotkey_registry()`, `initialize_hotkeys()` ZhuCeXiTongReJian . 
- ** architecture YueShu **: `_assistant_callback` by controller CengTongGuo `set_assistant_callback(cb)` ZhuRu ; d3utils not import controller, FouZeXunHuanYiLai . 
- **CONFIG**: ReJianQuZi `CONFIG.get('macro_configs', {}).get('auxiliary_config', {}).get('assistant_hotkey')`. Gai config structure WeiTong step CiChuHuiDu not to or ZhuCeShiBai . 
- ** YiCuoDian **: in d3utils within import controller HuiXunHuanYiLai ; WeiDiao use set_assistant_callback ZeReJianAnXia when callback for None ( YuQiXianXiangZhi to controller then Xu ) ; `_registered_hotkeys` key 'assistant' and ZiDingYiReJian name not ChongTu ; register_assistant_hotkey FanHui bool, False when Diao use FangYingChuLi ; unregister_hotkey JinShan this GenZong , if global_hotkey_manager have unregister XuTong step Diao use ; priority=50, source="hotkey_registry" and global_hotkey_manager YueDingYiZhi . 
- ** ZhengQueZuoFa **: Jin by controller in QiDongLiuCheng in set_assistant_callback; Gai CONFIG JianLuJing or global_hotkey_manager JieKou when Tong step this WenJian ; XiuGaiQianQingXianTongDu this note . 

---

## Si , d3utils/auxiliary_function_thread.py

- ** purpose **: FuZhuGongNengZhuan use XianCheng , MingLingDuiLieJinChuLi CMD_SHUTDOWN, Shou to i.e. TuiChu . DanLiTongGuo `get_auxiliary_function_thread()` / `set_auxiliary_function_thread(thread)` CunQu . 
- ** YiLai **: `providor.constants.common` `CMD_SHUTDOWN`. 
- ** YiCuoDian **: ShuiChuangJian , ShuiDiao use `put_command`/`request_shutdown` Xu and thread_registry or QiDongLiuChengYiZhi ; DanLi by WaiBu set, if Wei set Ze get for None; Gai CMD_SHUTDOWN ZhiXu and put_command FangYiZhi ; this XianCheng for daemon=True, ZhuJinChengTuiChu when not HuiZuSe . 
- ** ZhengQueZuoFa **: ShengMingZhouQi and thread_registry in " FuZhuXianCheng " YiZhi ; Gai CMD_SHUTDOWN or ChuangJian / XiaoHui when Ji when grep Diao use Fang ; XiuGaiQianQingXianTongDu this note . 

---

## Wu , utils/_obsolete_daily_schedule.py

- ** purpose **: AnFuWuQi when Qu and XiuXi when JianShengCheng every RiRiCheng (DailyScheduleGenerator) , DuXie daily_schedule.json ( LuJing for CURRENT_USER_DATA_PATH/daily_schedule.json) . YiLai CONFIG daily_schedule, server_settings.server_region; LaiZi providor_second CONFIG, CURRENT_USER_DATA_PATH. 
- ** YueDing **: WenJianDai `_obsolete_` QianZhui ; JinChaYue , not Yin use , ShanQianBi grep. 
- ** YiCuoDian **: Yin use or KuoZhan this WenJianHui continue YiLaiFeiQiLuoJi ; ShanQianWei grep HuiPoHuaiRengDiao use this WenJian Jiao this ; Gai CONFIG['daily_schedule'], CONFIG['server_settings']['server_region'] or CURRENT_USER_DATA_PATH WeiKaoLv this WenJianHui KeyError or LuJingCuo ; schedule WenJianGeShi and is_schedule_valid, load/save YiZhi , ShanWenJianQianXu confirm no it ChuDuTongLuJing . 
- ** ZhengQueZuoFa **: not Yin use _obsolete_daily_schedule; ShanChuQian grep Quan project ; if XuRiChengGongNeng in Fei _obsolete module ShiXian and and CONFIG YueDingYiZhi ; XiuGaiQianQingXianTongDu this note . 

---

## Liu , WuChu and apology document to Ying 

this note to YingZhuanShu apology document ** No. WuShiWuJie ** and ZhangWen apology in " then blacksmith_handler, _obsolete_dependency_checker, hotkey_registry, auxiliary_function_thread, _obsolete_daily_schedule WuChu " of FenXi and apology segment . FaXianShangShuWuChuWenJian when , Ying continue GengXin to apology document ( technical note , ZhuanShuJie , ZhangWenZhuiJia ) . 
