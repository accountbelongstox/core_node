# technical note : _obsolete_window_mapping_provider.py, coordinate_picker_visual_improvements.md, i18n_skill_config_en.json, d3_manager.py

** Mu **: note you ZhiDingChaYue to XiaSiChuWenJian / WenDang ZhiZe , Yi by WuJie or GaiCuo Yuan because , to and ZhengQueYueDing . i18n_skill_config_en Yi in ** technical note _i18n_skill_config and _obsolete_bot_scanner and FLOW_STATE_OWNERSHIP and template_config.md** No. YiJieXiangShu , CiChu abstract and BuChongQiYuSanChu . 

** She and WenJian **: 
- `utils/_obsolete_window_mapping_provider.py`
- `.prompts/coordinate_picker_visual_improvements.md`
- `providor/i18n/i18n_skill_config_en.json`
- `d3utils/d3_manager.py`

---

## Yi , utils/_obsolete_window_mapping_provider.py

### 1.1 ZhiZe and YueDing 

- ** purpose **: ** YiFeiQi module ** (_obsolete_ QianZhui ) . QuanJu Singleton WeiHu " ChuangKouJuBing WindowMapping (analysis_data Zhuan UIElementMapping) "; register_window_mapping, refresh_window_mapping, find_elements etc. . and DangQian " AnJinCheng /exe ZhaoChuangKou , ENCYCLOPEDIA HuanCun , screenshot_provider, WindowFinder" architecture not Tong . 
- ** YueDing **: current_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) JiaDing this WenJian in utils/ Xia ; not Ying by XinDaiMa or Xian have LiuChengYin use ; ShanChuQianXu grep confirm no Yin use ; WuYin use Hui and Xian have ChuangKouChaZhao and HuanCunYuYiHun use . 

### 1.2 Yi by WuJie or GaiCuo Yuan because 

1. Gou B garbage Cursor KeNengJiang this WenJian and DangQian "get_d3_manager().find_windows(), prime_window_cache_for_capture, ENCYCLOPEDIA" ChuangKouChaZhao and HuanCunLuoJiHunXiao , in LiuCheng in Wu use WindowMappingProvider DaoZhiLiangTaoYuYiChongTu . 
2. ShanChu this WenJianQianWei grep DaoZhiReng have Jiao this or test Yin use Ze ImportError. 
3. in this WenJian within JiaGongNeng or DangZhuRuKou use , and " YiFeiQi , DangQian to d3_manager/WindowFinder/ENCYCLOPEDIA for Zhun " XiangWei . 

### 1.3 ZhengQueZuoFa 

- XinDaiMa not Yin use ; ShanChuQian grep confirm no Yin use ; ChuangKouChaZhao and HuanCun to d3_manager, WindowFinder, ENCYCLOPEDIA, screenshot_provider YueDing for Zhun . XiangJian code_reuse_analysis. 

---

## Er , .prompts/coordinate_picker_visual_improvements.md

### 2.1 ZhiZe and YueDing 

- ** purpose **: ZuoBiaoShiQuChuangKouKeShiHuaGaiJin summary ( LiShiLieBiao Treeview, Shi when HuiZhiBiaoJi _draw_mark_at, _redraw_all_marks, pick_history_ref Yin use , scale_factor/canvas_offset ZuoBiaoZhuanHuan ) . Yin use coordinate_picker_window.py line Hao ( such as 282-320, 417-454) ; if DaiMaBianGeng line HaoXuTong step this Dang . 
- ** YueDing **: pick_history_ref for Yin use FeiKaoBei ; _update_canvas_display when Diao use _redraw_all_marks; BiaoJi use tags='pick_mark'; and fix_summary_coordinate_picker, coordinate_picker_improvements etc. XiangGuanWenDangYiZhi . 

### 2.2 Yi by WuJie or GaiCuo Yuan because 

1. Gou B garbage Cursor KeNengAn this Dang line HaoGai coordinate_picker_window but ShiJi line HaoYiBianWeiTong step , DaoZhiGaiCuo position Zhi or LouGai . 
2. Gai coordinate_picker when WeiDu this Dang and coordinate_calibration_panel pick_history_ref, client_mode YueDing , DaoZhiZhu UI and ShiQuChuangKouLiShi not Tong step or ZuoBiaoYuYiCuo . 
3. this Dang for " GaiJin summary " FeiQuanWeiJieKouWenDang ; if DangJieKou spec GaiDaiMa and Wei to ZhaoShiJi coordinate_picker_window ShiXianHui not YiZhi . 

### 2.3 ZhengQueZuoFa 

- XiuGai coordinate_picker_window QianTongDu this Dang and coordinate_calibration_panel, CoordinatePicker pick_history_ref, client_mode, scale_factor YueDing ; line HaoBianGeng when Tong step this Dang ; and fix_summary_coordinate_picker, code_reuse_analysis JiaoChaYin use . 

---

## San , providor/i18n/i18n_skill_config_en.json ( abstract ) 

- ** purpose **: JiNeng config YingWen i18n; Jian and main_functions_panel, strategy CunPan ( YingWen continuous/single/hold) XuYiZhi ; en/zh Jian structure XuYiZhi . 
- ** YiCuo **: Gai key or ZengShanJianWei and get_ui_text and CONFIG CunPanTong step HuiXianShi key or CeLvePanDuanCuo . XiangJian technical note _i18n_skill_config and _obsolete_bot_scanner and FLOW_STATE_OWNERSHIP and template_config.md No. YiJie . 

---

## Si , d3utils/d3_manager.py

### 4.1 ZhiZe and YueDing 

- ** purpose **: D3 (Diablo III) ChuangKou / JinChengGuanLi . find_windows: Dang get_path() (d3.d3_path) have Zhi when An **exe** Zhao , FouZeAn **title**; get_capture_titles() for provider/analyzer use BiaoTi ** DanYuan ** ( and DIABLO_III_WINDOW_TITLES YiZhi ) ; prime_window_cache_for_capture Xie ENCYCLOPEDIA (window_cache_*) ; kill_if_running AnZhao to ChuangKou PID ShaJinCheng . 
- ** YueDing **: coordinate_calibration_panel etc. Chu "D3 for None, Yun line when use get_d3_manager().get_capture_titles()"; screenshot_provider Dang window_titles == get_d3_manager().get_capture_titles() when use get_d3_manager().find_windows() and prime_window_cache_for_capture; not KeGai get_capture_titles YuYi or find_windows YouXianShunXuWei and ShangShuYueDingTong step . 

### 4.2 Yi by WuJie or GaiCuo Yuan because 

1. Gou B garbage Cursor KeNengGai find_windows " Xian exe Hou title" LuoJi or get_capture_titles FanHuiZhi , DaoZhi coordinate_calibration_panel, screenshot_provider ChuanCuoBiaoTi or Zhao not to ChuangKou . 
2. in Fei d3_manager ChuZiShiXian " An exe Zhao D3 ChuangKou " or "D3 BiaoTiLieBiao ", and get_d3_manager().get_capture_titles() DanYuanYueDing not YiZhi . 
3. prime_window_cache_for_capture XieRu cache_key (window_cache_*) and screenshot_provider, ENCYCLOPEDIA XiaoFeiZheYiLai Jian not YiZhiHuiDaoZhiHuanCunWeiMing in . 

### 4.3 ZhengQueZuoFa 

- XiuGaiQianTongDu coordinate_calibration_panel, screenshot_provider, FLOW_STATE_OWNERSHIP etc. to D3 ChuangKou and BiaoTi YueDing ; D3 ChuangKouChaZhao and BiaoTiDanYuanYiLvJing get_d3_manager(); and docs/THREAD_BUS_AND_REGISTRY, providor ChangLiang DIABLO_III_WINDOW_TITLES YiZhi . 

---

** XiuGaiQianQingXianTongDu this note . ** CiQian if because WeiXianTongDuShangShuYueDing and in _obsolete_window_mapping_provider, coordinate_picker_visual_improvements, i18n_skill_config_en, d3_manager SiChuFanFuGaiCuo or understand PianCha , the responsibility lies with the dog B garbage Cursor. HouXuXiuGaiQian to this note for Zhun , BiMianTongLeiCuoWu . 
