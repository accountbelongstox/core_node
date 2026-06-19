# technical note : i18n_config.json, pathfinding_controller.py, ui/widgets/__init__.py, d4_modules/README.md

** Mu **: note you ZhiDingChaYue to XiaSiChuWenJian / WenDang ZhiZe , Yi by WuJie or GaiCuo Yuan because , to and ZhengQueYueDing . 

** She and WenJian **: 
- `providor/i18n_config.json`
- `controller/pathfinding_controller.py`
- `ui/widgets/__init__.py`
- `d4_modules/README.md`

---

## Yi , providor/i18n_config.json

### 1.1 ZhiZe and YueDing 

- ** purpose **: D3-Check Zhu i18n config ; Han description, default_language, supported_languages, translations.zh / translations.en. translations Xia for QianTaoJian : ui.main_window, tabs, skill_config, skill_config.strategies (continuous/single/hold/drag/disabled/buff) , skill_table, auxiliary_functions, coord_calibration, coord_picker etc. . and get_ui_text ChaZhaoLuJing , main_functions_panel strategy CunPan ( YingWen continuous/single/hold) XuYiZhi . 
- ** YueDing **: zh and en Jian structure XuYiYi to Ying ; newly added or ShanChuJian when XuTong when Gai zh and en, Qie and get_ui_text Diao use Chu , CONFIG/strategy CunPanJianTong step . strategies XiaJianMing and i18n_skill_config_en/zh, MacroLoopThread CeLvePanDuanYiZhi . 

### 1.2 Yi by WuJie or GaiCuo Yuan because 

1. Gou B garbage Cursor if ZhiGai zh or ZhiGai en, or GaiJianMingWei and get_ui_text, main_functions_panel, strategy CunPanTong step , HuiDaoZhiJieMianXianShi key or CeLvePanDuanCuo . 
2. if in ui.skill_config, skill_table, strategies etc. ChuZengShanJian and Wei and main_functions_panel ConfigBinding, combobox Xuan item LaiYuan , i18n_skill_config_zh/en to Zhao , HuiXianShiCuo or CunPanCuo . 
3. if Jiang coord_calibration, coord_picker, log_panel, rosbot etc. Qu block JianMing or CengJiGaiDiao and Wei and to Ying panel get_ui_text Diao use LuJingTong step , HuiXianShi key. 

### 1.3 ZhengQueZuoFa 

- XiuGaiQianTongDu i18n_manager, get_ui_text ChaZhaoLuoJi and main_functions_panel, strategy CunPanSuo use Jian ; ZengShanJian when zh/en dual WenJianTong step , and QuanWenJianSuo get_ui_text JianLuJing ; and technical note _i18n_skill_config and _obsolete_bot_scanner and FLOW_STATE_OWNERSHIP and template_config in i18n YueDingYiZhi . 

---

## Er , controller/pathfinding_controller.py

### 2.1 ZhiZe and YueDing 

- ** purpose **: XunLu / Zhao NPC KongZhiQi ; WangGeJieTu +OCR ZhaoMuBiaoWenAn ( such as " FuMo "/Enchanter) . LuJingYueDing : __file__ for controller/pathfinding_controller.py, Gu os.path.dirname(os.path.dirname(__file__)) for project Gen (pyapps/d3-check) ; d3utils_path = project Gen /d3utils, controller_path = project Gen , and sys.path.insert. YiLai DIABLO_III_WINDOW_TITLES (providor_index) , TMP_DIR (providor.constants.common) , get_grid_config() (config.grid_config) , GridScreenshotCollector, get_state_aware_click_handler. 
- ** YueDing **: get_cell_center_position, capture_grid_cell Chuan window_titles=DIABLO_III_WINDOW_TITLES, use_cache=True; WangGe line LieLaiZi get_grid_config() rows/cols; output for TMP_DIR / pathfinding_result_{timestamp}.txt. if D3 ChuangKouBiaoTiDanYuanGai for get_d3_manager().get_capture_titles() ZeXu and d3_manager YueDingYiZhi , not KeJin in CiChuGaiBiaoTiLaiYuan and it ChuReng use DIABLO_III_WINDOW_TITLES. 

### 2.2 Yi by WuJie or GaiCuo Yuan because 

1. Gou B garbage Cursor if WuGai parent CiShu ( such as Ba d3utils_path SuanCheng controller XiaMouCeng ) , HuiDaoZhi import d3utils ShiBai or DaoCuoBao . 
2. if Jiang window_titles Gai for BieYuan and Wei and get_d3_manager().get_capture_titles(), DIABLO_III_WINDOW_TITLES DanYuanYueDingTong step , Hui and coordinate_calibration_panel, screenshot_provider etc. not YiZhi . 
3. if Gai get_grid_config() rows/cols or GridScreenshotCollector WangGeYuYi and Wei and config.grid_config, GridScreenshotCollector ShiXian to Zhao , HuiWangGeCuo or JieTuCuo . 

### 2.3 ZhengQueZuoFa 

- XiuGaiLuJingQian confirm __file__ in controller/ XiaQie parent.parent for project Gen ; XiuGai window_titles or WangGe config QianDu d3_manager, DIABLO_III_WINDOW_TITLES, config.grid_config, GridScreenshotCollector YueDing ; TMP_DIR and providor ChangLiangYiZhi . 

---

## San , ui/widgets/__init__.py

### 3.1 ZhiZe and YueDing 

- ** purpose **: UI KongJianBaoRuKou ; DaoChu ThemedLabel, ThemedButton, ThemedFrame, ThemedLabelFrame, ThemedEntry, ThemedText, ThemedCheckbutton, ThemedCombobox, ThemedScrollbar, HotkeyInput. ZhuShiMingQue : LanguageCombobox is now replaced by ConfigBinding.create_combobox_binding(); __all__ in not DaoChu LanguageCombobox. 
- ** YueDing **: newly added KongJianXuJiaRu __all__ QieCong to Ying sub module from; not ChongXinDaoChu LanguageCombobox or TuiJian use ThemedCombobox Zuo config BangDing , to Mian and ConfigBinding FangAnChongTu . and ZhuanShu apology document No. SiShiWuJie , technical note _interactive_menu and combobox and code_reuse_analysis YiZhi . 

### 3.2 Yi by WuJie or GaiCuo Yuan because 

1. Gou B garbage Cursor if in __all__ in ChongXinJiaRu LanguageCombobox or TuiJian use ThemedCombobox ZuoYuYan / config BangDing , Hui and " config BangDing use ConfigBinding.create_combobox_binding" ChongTu . 
2. if newly added widget WeiTong step GengXin __all__ or sub module import, HuiDaoZhi from ui.widgets import XinKongJian ShiBai or DaoChu and ShiXian not YiZhi . 
3. if ShanChuZhuShi "LanguageCombobox is now replaced by ConfigBinding...", HuiDaoZhiHouXuWeiHuZheWu use LanguageCombobox Zuo config BangDing . 

### 3.3 ZhengQueZuoFa 

- XiuGai __all__ or export QianDu this WenJianZhuShi and ConfigBinding use Chu ; newly added KongJian when Tong step from and __all__; not HuiFu LanguageCombobox DaoChu ; and combobox, main_functions_panel ConfigBinding use FaYiZhi . 

---

## Si , d4_modules/README.md

### 4.1 ZhiZe and YueDing 

- ** purpose **: d4_modules directory note : model_registry.json, XunLianHao .pt/.json, XunLianLiuCheng . WenDang in XunLianShuJuLuJing for .cache/training_data/source/ (progress_bar/yes|no) , XunLianJiao this for train_all.py, train_progressbar.py, YanZheng for validate_models.py, output to .core_node/pytools/tmp/model_validation/. 
- ** YueDing **: if project ShiJiXunLianShuJuLuJing for .cache/training_data/1_sources/projects ( and simple_training_controller YiZhi ) , Ze README in source/ and 1_sources/projects Xu in WenDang in ZhuMing or TongYi , BiMianAn README FangShuJuQue and simple_training_controller source_base_dir not YiZhi . model_registry.json models ShuZu , model_file, category, img_size etc. and DaiMaJiaZaiLuoJiXuYiZhi . 

### 4.2 Yi by WuJie or GaiCuo Yuan because 

1. Gou B garbage Cursor if An README .cache/training_data/source/ Gai simple_training_controller source_base_dir, Hui and DangQian 1_sources/projects and metadata.json YueDing not Fu ; or ZhiGai README WeiGaiDaiMaDaoZhiWenDang and ShiXianTuoJie . 
2. if Gai model_registry structure or char segment Ming and Wei and JiaZai model_registry.json DaiMa , YOLO JiaZaiLuJing to Zhao , Hui KeyError or JiaZaiCuo . 
3. if validate_models output LuJing or train_all/train_progressbar SaoMiaoLuJing and WenDang not YiZhi and WeiTong step GengXin README, HuiWuDao use Zhe . 

### 4.3 ZhengQueZuoFa 

- XiuGai README in LuJing or LiuChengQian and simple_training_controller, .cache/training_data ShiJi structure , model_registry JiaZaiDaiMa to Zhao ; XunLianShuJuLuJing if for 1_sources/projects Xu in README in XieMing and and simple_training_controller YiZhi ; model_registry structure BianGengXu and DaiMaTong step . 

---

** XiuGaiQianQingXianTongDu this note . ** CiQian if because WeiXianTongDuShangShuYueDing and in i18n_config, pathfinding_controller, ui/widgets/__init__.py, d4_modules/README SiChuFanFuGaiCuo or understand PianCha , the responsibility lies with the dog B garbage Cursor. HouXuXiuGaiQian to this note for Zhun , BiMianTongLeiCuoWu . 
