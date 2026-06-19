# technical note : CODE_TREE.md, status_row_config.py, _obsolete_automation_controller.py, scale_images_to_new_base.py, battlenet_capture.py

this note Zhen to to XiaWuChu : XiuGaiQianQingXianTongDu this note and to YingYuanMa / WenJian . 

- `docs/CODE_TREE.md`
- `ui/components/status_row_config.py`
- `utils/_obsolete_automation_controller.py`
- `scripts/scale_images_to_new_base.py`
- `d3utils/battlenet_capture.py`

---

## Yi , docs/CODE_TREE.md

- ** purpose **: d3-check DaiMaShuFenCeng note ; Layer 1 Entry (main.py) , Layer 2 Runtime (lifecycle, threads, events) , Layer 3 Controllers, Layer 4 d3utils, Layer 5 share (values/data, common/ Gong use HanShu ) , Layer 6 timers, Layer 7 UI, Layer 8 config and providor; Import rules: main and controllers Xu lifecycle Cong runtime DaoRu ; and PROJECT_STANDARDS.md Yi ErZhengHe . 
- ** YueDing **: CengCi and module JueSeYiZhengHe to PROJECT_STANDARDS Yi Er , this Dang for FenCengXiJieZhanKai ; share = share/values/ ( ShuJu and get_*/set_* only) + share/common/ ( Gong use GongJu and JiLei ) ; no run_/do_ in share; One-shot use timers.one_shot_tasks.do_*. 
- ** YiCuoDian **: Layer 3 in controller LuJing or JueSeMiaoShu and ShiXian not YiZhiHuiWuDao ; directory or WenJianYiDong , newly added module HouWeiTong step this DangHuiDaoZhiAnShuTuiDuanDaoRu or CengJi when ChuCuo ; Import rules if DaiMa in controller ZhiJie import d3utils ZuoShengMingZhouQiXiangGuanLuoJiWeiGaiWenDangHuiYueDingShiXiao ; and PROJECT_STANDARDS ChongTu or not Tong step HuiLiangZhangPi . 
- ** ZhengQueZuoFa **: ZengShanYiDong controller/d3utils etc. when Tong step this Dang and PROJECT_STANDARDS; XiuGaiQianQingXianTongDu this note and docs/PROJECT_STANDARDS.md. 

---

## Er , ui/components/status_row_config.py

- ** purpose **: DiLanZhuangTai line config ; Liang line STATUS_ROW_1 (battlenet, ros, d3, map) , STATUS_ROW_2 (stage, oauth, window_size) ; every item (label_i18n_key, var_key, default_fg); default_fg for None when BottomBar An state She value label fg. 
- ** YueDing **: var_key and bottom_bar ChuanRu status_vars JianBiXuYiYi to Ying ; label_i18n_key Xu and i18n in rosbot.*, ui.status_bar.* etc. JianCun in ; STATUS_ROW_1/2 ShunXu and DiLanXuanRanShunXuYiZhi ; game_status YiCong Row 2 YiChu (redundant with D3 status) . 
- ** YiCuoDian **: ZengShan or GaiMing var_key Hou bottom_bar or diablo3_macro_ui WeiChuan to Ying status_vars HuiDaoZhiGaiLie not XianShi or KeyError; Gai label_i18n_key Wei and i18n Tong step HuiXianShi key or WenAnCuo ; DiaoHuanShunXuHuiDaLuanDiLanBuJu ; SanYuanZu structure Gai for ErYuan or SiYuanHui bottom_bar_status_block JieXiCuo . 
- ** ZhengQueZuoFa **: ZengShanZhuangTai item when Tong step status_row_config and bottom_bar status_vars LaiYuan , i18n Jian ; XiuGaiQianQingXianTongDu this note and technical note _coordinate_picker_visual_improvements and log_monitor_api and status_row_config and bottom_bar_options_block and bn_flow_B9.md, bottom_bar_status_block. 

---

## San , utils/_obsolete_automation_controller.py

- ** purpose **: WenJianMingDai _obsolete_, BiaoShi ** YiFeiQi **. Yuan AutomationController: execute_operations(window_title, operation_ids, ui_elements, json_path), win32gui/win32api DianJi and AnJian ; from utils.color_print ( project Xian use pycore.pyfoundations.color_print) ; _load_ui_elements_from_json Du data.get('elements', []). 
- ** YueDing **: ZhuLiuCheng not Yin use ; Wu in CiWenJianJiaGongNeng or Xiu import as ZhuFangAn ; ShanQianBi grep; if utils.color_print not Cun in Hui ImportError, Ying for LiShiYiLiu . 
- ** YiCuoDian **: Yin use or KuoZhan this WenJianHuiYiLaiFeiQiLuoJi ; in CiGai execute_operations or UI YuanSuGeShiZhuLiuCheng not HuiDiao use ; and DangQianZhanWang / DengLuZiDongHua (battlenet_operation, battlenet_region_judge etc. ) architecture not Tong , Hun use HuiLiangTaoLuoJi . 
- ** ZhengQueZuoFa **: ZhuLiuCheng not Yin use _obsolete_automation_controller; ZiDongHua use battlenet_operation, screenshot_provider, battlenet_ui_inspector etc. ; ShanQian grep; XiuGaiQianQingXianTongDu this note and project ZiDongHua architecture . 

---

## Si , scripts/scale_images_to_new_base.py

- ** purpose **: Jiang pyapps/d3-check/images XiaTuPianCongJiuJiZhun 18261301 SuoFang to XinJiZhun 1300800 (1080P) ; _SCRIPT_DIR.parent = pyapps/d3-check, IMAGES_DIR = _D3_CHECK_ROOT / "images"; OLD_BASE_*, NEW_BASE_*, SCALE_X/Y; ZhiChi --dry-run; PNG use RGBA, Qi it use RGB. 
- ** YueDing **: Cong repo root or pyapps/d3-check Yun line , Python path Han pyapps/d3-check; Fei dry_run when resized.save(path) ZhiJieFuGaiYuanTu no BeiFen ; rglob HuiChuLi sub directory . 
- ** YiCuoDian **: _D3_CHECK_ROOT JiaDing this WenJian in scripts/ Xia , if YiDongJiao this Hui IMAGES_DIR Cuo ; OLD_BASE_*, NEW_BASE_* for MoShu , project Gai use Qi it BiaoZhunFenBianLvXuGaiChangLiang ; images Xia have not YingSuoFang ZiYuanXuPaiChu when DangQian no PaiChuLieBiao ; KuoZhanMingFei png and Dai alpha HuiDiuTongDao . 
- ** ZhengQueZuoFa **: GaiJiZhunChiCun when Tong step ChangLiang or CanShuHua ; YiDongJiao this when Tong step _D3_CHECK_ROOT; XiuGaiQianQingXianTongDu this note . 

---

## Wu , d3utils/battlenet_capture.py

- ** purpose **: capture_battlenet_and_save_to_category(category="login_try"); get_battlenet_manager().prime_window_cache_for_capture(), get_screenshot_provider().gen(), get_screenshot_category_manager().get_dir(category), LOGIN_TRY_SCREENSHOT_PREFIX; BaoCun to category directory and clean_older_than. 
- ** YueDing **: YiLai providor.constants.common.LOGIN_TRY_SCREENSHOT_PREFIX, config.screenshot_categories.get_screenshot_category_manager, d3utils.screenshot_provider, d3utils.battlenet_manager; category MoRen "login_try"; prefix Yi category Xuan LOGIN_TRY_SCREENSHOT_PREFIX or "battlenet". 
- ** YiCuoDian **: Gai get_battlenet_manager, get_screenshot_provider, get_screenshot_category_manager JieKouWeiTong step HuiDiao use ShiBai ; Gai category or get_dir FanHuiWeiTong step HuiLuJingCuo ; LOGIN_TRY_SCREENSHOT_PREFIX GaiMingWeiTong step HuiWenJianMingCuo ; prime_window_cache_for_capture ShiBai when FanHui (None, None), Diao use FangXuRongCuo . 
- ** ZhengQueZuoFa **: Gai battlenet_manager, screenshot_provider, screenshot_categories XiangGuan API when Tong step this WenJian ; XiuGaiQianQingXianTongDu this note and config.screenshot_categories, providor.constants.common. 

---

## Liu , WuChu and apology document to Ying 

this note to YingZhuanShu apology document ** No. LiuShiYiJie ** and ZhangWen apology in " then CODE_TREE, status_row_config, _obsolete_automation_controller, scale_images_to_new_base, battlenet_capture WuChu " of FenXi and apology segment . FaXianShangShuWuChuWenJian when , Ying continue GengXin to apology document ( technical note , ZhuanShuJie , ZhangWenZhuiJia ) . 
