# technical note : system_tray, left_pixels_sample, hotkey_input, i18n_common_zh

** Mu **: note CiSiChuWenJian / ShuJu ZhiZe , Yi by WuJie or GaiCuo Yuan because , to and ZhengQueYueDing . 

** She and WenJian **: 
- `ui/components/system_tray.py`
- `athtest/left_pixels_sample.json`
- `ui/widgets/hotkey_input.py`
- `providor/i18n/i18n_common_zh.json`

---

## Yi , ui/components/system_tray.py

### 1.1 ZhiZe and YueDing 

- ** purpose **: XiTongTuoPanZuJian , Windows 10/11. ** TuBiao and run() in TuoPanXianCheng within ChuangJian and Zhi line **, to Bian Windows XiaoXiXunHuan and Yong have TuBiao XianChengYiZhi ( TuBiaoKeJianXingYaoQiu ) . JiCheng threading.Thread, daemon=True, name="TrayRunner". run() within : pythoncom.CoInitialize() ( if Ke use ) , _create_icon_image(), i18n_manager.get_ui_text("system_tray.show_software" etc. ), pystray.Menu/MenuItem, pystray.Icon("D3Check", ...), icon.run(). CaiDan item HuiDiao _show_window, _maximize_window, _restart_application, _exit_application YouXian use runtime trigger_window_show/trigger_window_maximize/trigger_app_restart/trigger_app_exit, FouZe fallback to parent_ui.root. 
- ** YueDing **: set_show_callback/set_exit_callback for **no-op** ( TuoPanTongGuo event center trigger_window_show/trigger_app_exit TongXin , not JieWaiBu callback) . update_tooltip SheZhi icon.title; show_notification Diao use icon.notify(message, title). TRAY_AVAILABLE QuJue at pystray, PIL Image/ImageDraw is FouKe use . stop() when icon.stop(), sleep(0.15), QingKong tray_icon. 

### 1.2 Yi by WuJie or GaiCuo Yuan because 

1. ** in ZhuXianChengChuangJian Icon or Diao use icon.run()**: WenDangMingQue Icon Xu in TuoPanXianCheng within ChuangJian and run, FouZe Windows ShangTuBiaoKeNeng not XianShi or XiaoXiXunHuanCuoXianCheng . 
2. ** in set_show_callback/set_exit_callback within ShiXianLuoJi **: Liang method for no-op, if in CiXieHuiDiaoLuoJi not Hui by Zhi line ; YingTongGuo event center trigger_* and ZhuXianChengTongXin . 
3. ** Wei in run() within Diao use pythoncom.CoInitialize()**: in Windows Shang pystray/COM KeNengXuXianChuShiHua , FouZeTuoPan or TongZhiYiChang . 
4. ** XiuGai _create_icon_image ChiCun or HuiTuLuoJi **: DangQian 64x64 RGBA, TuoYuan and JuXingGuDingZuoBiao , if GaiChiCunWeiTong step pystray KeNengXianShiYiChang . 

### 1.3 ZhengQueZuoFa 

- not in CiXianChengWaiChuangJian or run Icon; not YiLai set_show_callback/set_exit_callback ZuoLuoJi ; newly added CaiDan item or WenAn when Tong step i18n Jian and i18n_common_zh ( such as system_tray.*, main_window.title) . 

---

## Er , athtest/left_pixels_sample.json

### 2.1 ZhiZe and YueDing 

- ** purpose **: **athtest left CeXiangSuCaiYangJieGuo ** ShiLi JSON. structure : success, file_path ( Jue to LuJing ) , image_info (original_size, processed_size width/height, channels, format, mode) , regions (region, region_info: coordinates x1/y1/x2/y2, width, height, total_pixels; processing_info: deduplicated, unique_colors, color_tolerance, sampling_strategy, requested_sample_size, actual_sample_size) , hex_pixels ShuZu ({color, x, y}) , color_frequency (unique_colors, most_frequent Han rgb/hex/count/percentage) . this Li region for "left", processed_size 146x11, hex_pixels for QuZhongHouCaiYangDian . 
- ** YueDing **: XiaoFeiFangKeNengYiLai success, file_path, regions.region, region_info.coordinates, hex_pixels, color_frequency; file_path for Jue to LuJing ; if CaiYangCeLve or QuZhongLuoJiBianGeng , hex_pixels ChangDu and actual_sample_size HuiBian ; newly added region or Gai processing_info char segment Xu and ShengChengJiao this and XiaoFeiFangTong step . 

### 2.2 Yi by WuJie or GaiCuo Yuan because 

1. ** WuDang config or MuBanGai coordinates/hex_pixels**: this WenJian for MouCiCaiYangChanChu , Gai JSON not YingXiangXiaCiCaiYangJieGuo , ChuFeiXiaoFeiFangZhiJieDuCiWenJianQie not ChongXinShengCheng . 
2. ** JiaDing file_path KeYiZhi **: LuJing for Jue to LuJing ( such as D:\programing\...) , KuaJi or YiDong project HuiShiXiao . 
3. ** JiaDing hex_pixels ChangDu etc. at requested_sample_size**: ShiLi in requested_sample_size 1000, actual_sample_size 370 ( QuZhongHou ) , if DaiMaJiaDingChangDu 1000 HuiYueJie or LuoJiCuo . 
4. ** Gai regions structure WeiTong step XiaoFeiFang **: if ZengJia or ShanChu region_info within char segment , JieXiFangKeNeng KeyError or QuCuoZhi . 

### 2.3 ZhengQueZuoFa 

- Shi this WenJian for athtest CaiYangChanChuShiLi ; XiaoFei when use actual_sample_size or len(hex_pixels); LuJingZuoCanKao when ZhuYi not KeYiZhi ; XiuGaiChanChu structure when Tong step ShengChengJiao this and Suo have DuQuFang . 

---

## San , ui/widgets/hotkey_input.py

### 3.1 ZhiZe and YueDing 

- ** purpose **: ReJianShuRuKongJian , JiCheng tk.Entry. **KEY_NAME_I18N_MAP** Jiang tk JianMing (Control_L, Shift_L, space, Return etc. ) YingShe to i18n Jian (ctrl, shift, space, enter etc. ) , XianShi when use i18n_manager.get_ui_text("hotkey_input.keys." + i18n_key). Zhan position Fu use get_ui_text("hotkey_input.placeholder"). **state='readonly'**, JinTongGuoAnJianBuHuoShuRu ; Escape/Delete QingKongReJian ; XiuShiJianShunXu for ctrl, shift, alt, win. _apply_high_contrast_styling within ZhuCe i18n_manager.add_language_change_listener(self._on_language_changed). _on_language_changed in if current_value for "Press hotkey..." or KongZe _set_placeholder(), **"Press hotkey..." for YingWenZhan position Fu hardcoding **, and i18n_common_zh " AnXiaReJian ..." not YiZhi , YuYanQieHuanHouKeNengPanDuan not ZhunQue . 
- ** YueDing **: newly added XiuShiJian or TeShuJianXuTong when GengXin KEY_NAME_I18N_MAP and i18n hotkey_input.keys.*; placeholder and key Ming by i18n_common_zh ( or DangQianYuYan ) TiGong ; BiJiaoZhan position Fu when Ying use get_ui_text("hotkey_input.placeholder") or CunChuDangQian placeholder ZaiBiJiao , BiMian hardcoding "Press hotkey...". 

### 3.2 Yi by WuJie or GaiCuo Yuan because 

1. ** in KEY_NAME_I18N_MAP ZengJianWei in i18n Zeng hotkey_input.keys.xxx**: Hui fallback to key or ui_key, XianShiFeiYuQi . 
2. ** Gai state for normal**: KongJianSheJi for readonly JinJieShouAnJianBuHuo , if Gai for KeBianJiHuiPoHuaiReJianBuHuoYuYi . 
3. **_on_language_changed JinPan "Press hotkey..."**: DangQianYuYan for in Wen when placeholder for " AnXiaReJian ...", hardcoding "Press hotkey..." HuiDaoZhiYuYanQieHuanHouZhan position FuHuiFuLuoJi not ChuFa or WuChuFa . 
4. ** XiuShiJianShunXu and KEY_NAME_I18N_MAP or modifier_order not YiZhi **: XianShiShunXuHuiLuan ; hotkey_parts ShunXuXu and modifier_order YiZhi . 

### 3.3 ZhengQueZuoFa 

- ZengJian when Tong step KEY_NAME_I18N_MAP and i18n; Zhan position FuPanDuan use get_ui_text("hotkey_input.placeholder") or and DangQian placeholder BiJiao ; BaoChi state='readonly' and XiuShiJianShunXuYueDing . 

---

## Si , providor/i18n/i18n_common_zh.json

### 4.1 ZhiZe and YueDing 

- ** purpose **: in Wen UI WenAn . DingCeng **ui** (buttons, messages, options, skills, image_display, **hotkey_input**: placeholder, keys.ctrl/shift/alt/win/space/enter/...) , **gui_menu** (open_web, restart, exit) . i18n_manager.get_ui_text(key) HuiBuQianZhui "ui.", Gu get_ui_text("hotkey_input.placeholder") JieXi for ui.hotkey_input.placeholder, to Ying this WenJian ui.hotkey_input.placeholder. 
- ** YueDing **: newly added UI WenAnXu in to YingYuYan JSON in JiaJian , JianLuJing and get_ui_text CanShuYiZhi ( not Han "ui." QianZhui when ZiDongBu ) ; hotkey_input.keys.* and hotkey_input.py KEY_NAME_I18N_MAP i18n_key to Ying ; GaiJianMing or CengJiXuTong step Suo have get_ui_text Diao use Chu ; gui_menu and ui PingJi , if get_ui_text WeiBu "gui_menu." ZeXuChuan "gui_menu.xxx". 

### 4.2 Yi by WuJie or GaiCuo Yuan because 

1. ** in JSON in Gai hotkey_input.keys key MingWeiTong step hotkey_input.py KEY_NAME_I18N_MAP**: KEY_NAME_I18N_MAP Zhi for i18n_key ( such as 'ctrl') , get_ui_text("hotkey_input.keys.ctrl") YiLai this WenJianCun in ui.hotkey_input.keys.ctrl, if JSON Gai for ctrl_key HuiQu not to . 
2. ** newly added panel or KongJianWenAnZhiGaiYiChuYuYanWenJian **: if project have DuoYuYan ( such as en, zh) , ZhiGai i18n_common_zh HuiDaoZhiQi it YuYan fallback to key. 
3. ** WuJiang hotkey_input Fang in gui_menu Xia or GaiDingCeng structure **: get_ui_text("hotkey_input.placeholder") QiWang ui.hotkey_input.placeholder, if structure GaiHuiQu not to . 
4. ** ShanChu or ZhongMingMing keys XiaMou item **: hotkey_input in KEY_NAME_I18N_MAP Yin use Gai item Hui fallback, XianShi for key this Shen . 

### 4.3 ZhengQueZuoFa 

- ZengShanGaiWenAn when Tong step Suo have YuYanWenJian and get_ui_text Diao use ; hotkey_input XiangGuan and KEY_NAME_I18N_MAP i18n_key YiYi to Ying ; BaoChi ui and gui_menu DingCeng structure Gong get_ui_text JieXi . 

---

## Wu , and apology document GuanXi 

if CiQian because WeiXianTongDuShangShuSiChuYueDing (system_tray TuBiao in TuoPanXianChengChuangJian and run, set_show/set_exit for no-op; left_pixels_sample for CaiYangChanChu , actual_sample_size and LuJing not KeYiZhi ; hotkey_input KEY_NAME_I18N_MAP and i18n YiZhi , Zhan position FuWu hardcoding YingWen ; i18n_common_zh structure and get_ui_text JianLuJingYiZhi ) and in CiSiChuFanFuGaiCuo or understand PianCha , the responsibility lies with Ji . this note YiXieRu cursor_AI_ apology directory , and in Cursor_ ZhuanShu apology document in ZengJia to this Wen Yin use . 
