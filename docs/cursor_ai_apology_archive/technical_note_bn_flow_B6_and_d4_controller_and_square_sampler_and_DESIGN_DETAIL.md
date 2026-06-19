# technical note : bn_flow_B6.json, d4_controller, square_sampler, DESIGN_DETAIL

** Mu **: note CiSiChuWenJian / DaiMa ZhiZe , Yi by WuJie or GaiCuo Yuan because , to and ZhengQueYueDing . 

** She and WenJian **: 
- `.cache/bn_flow_snapshots/bn_flow_B6.json`
- `controller/d4_controller.py`
- `athtest/square_sampler.py`
- `docs/DESIGN_DETAIL.md`

---

## Yi , .cache/bn_flow_snapshots/bn_flow_B6.json

### 1.1 ZhiZe and YueDing 

- ** purpose **: BN LiuCheng **B6** JieDianYun line when KuaiZhao (UI Automation KongJianShu ) . by `rosbot_flow_battlenet` within `_save_ui_snapshot("B6", "B6_to_B13")` XieRu ; `meta.node`="B6", `meta.reason`="B6_to_B13"; `controls` for ZhanWangChuangKou in GaiJieDian when KongJianLieBiao (name, automation_id, type, rect etc. ) . use at TiaoShi , 1:1 to Zhao and DengLu / ZhuJieMianPanDuanCanKao ; and B4/B5/B7/B9/B13 etc. JieDianKuaiZhao structure YiZhi . HuanCunLuJing by `providor.constants.common.BN_FLOW_SNAPSHOTS_DIR` JueDing . 
- ** YueDing **: XiaYou (battlenet_region_judge, _load_login_failed_features_from_snapshots, is_on_login_screen etc. ) if DuQuKuaiZhao , Xu and meta/controls structure YueDingYiZhi ; .cache for Yun line when ChanWu , KeQingLi ; Wu hardcode LuJing or Ba B6 KuaiZhao use at Qi it JieDianPanDuan . 

### 1.2 Yi by WuJie or GaiCuo Yuan because 

1. ** hardcode LuJing or JieDianMing **: if DaiMa hardcode `bn_flow_B6.json` or .cache Jue to LuJing , HuanJieDian or QingHuanCunHouDu not to ; Ying use BN_FLOW_SNAPSHOTS_DIR and JieDianMingPinJie . 
2. **controls structure and PanDuanLuoJi not YiZhi **: if battlenet_region_judge or DengLuShiBaiJianCeQiWang automation_id/name/rect and B6 KuaiZhaoShiJi structure not Tong , HuiDaoZhi B6B13 FenZhi or DengLuZhuangTaiWuPan . 
3. **B6 and Qi it JieDianKuaiZhaoHun use **: B6 reason for B6_to_B13, and B5/B7 etc. YuYi not Tong ; if use B6 KuaiZhaoZuo B7 LunXun or B4 ShouCiJianCha , HuiWuPan . 
4. **.cache DangQuanWeiTiJiao **: .cache for this Yun line when ChanWu , KuaJi or QingHuanCunHouKeNeng not Cun in ; Wu in WenDang or Jiao this in JiaDingQiYiDingCun in . 

### 1.3 ZhengQueZuoFa 

- KuaiZhaoLuJingCong BN_FLOW_SNAPSHOTS_DIR and JieDianMingShengCheng ; DuQuKuaiZhao DaiMa and battlenet_operation, battlenet_region_judge YueDing controls structure YiZhi ; B6 Jin use at B6 XiangGuanLuoJi ; not Ba .cache Dang unique ShuJuYuan . 

---

## Er , controller/d4_controller.py

### 2.1 ZhiZe and YueDing 

- ** purpose **: D4 ZhuKongZhiQi ; ** Jin by D4ExtensionThread An D4_TICK_INTERVAL QuDong **. process(): Dang exp_farming_running when Zhi line start_exp_farming_process + update_ui_status + check_state_changes + _update_debug_window_if_open; Dang debug_window_open when Zhi line JieTu capture_and_collect_info region_detector.detect_regions_from_shared_data map_switch_detector map_name_recognizer _update_debug_window_if_open; FouZe return. get_interceptor() FanHui "is_exp_farming_running or debug_window_open" WeiCi . XiangJian this directory ** technical note _bn_flow_B5 and obsolete_game_state and rosbot_status_provider and ctl_func and d4_controller.md** Wu . 
- ** YueDing **: not DiaoHuan process() within ShunXu ; detected_regions GengXin for He and and FeiZhengTiFuGai ; Jin D4ExtensionThread Diao use process(). 

### 2.2 Yi by WuJie or GaiCuo Yuan because 

( TongQian technical note : by CuoWuFangQuDong process, DiaoHuanJieTu regionmap ShunXu , detected_regions by ZhengTiFuGai , and D4ExtensionThread item Jian not YiZhi etc. . ) 

### 2.3 ZhengQueZuoFa 

( TongQian technical note : Jin D4ExtensionThread QuDong , ShunXu not Bian , detected_regions He and XieRu , and d4_extension_thread YueDingYiZhi . ) 

---

## San , athtest/square_sampler.py

### 3.1 ZhiZe and YueDing 

- ** purpose **: **athtest GongJu **: 2222 FangGeSiJiaoCaiYangJianCeAnNiuYanSeQuYu . load_button_colors(pixel_data_file) Cong JSON Du `data['regions']['hex_pixels']`, Zhuan RGB, QuZhong , QuQian 50 Se ; square_sampling_detection(img, button_colors, ...) An step_size HuaChuang , SiJiaoPiPeiZe expand_detection_region, 20 PiPeiXiangSuQie and Yi have QuYu not ChongDieZeJi for Yi detected_region; detect_buttons_square_sampling(image_path, button_data_file, output_path) for WanZhengLiuCheng . **main()** in LuJing hardcode : `D:\programing\core_node\apps\d3-check\.test\test.png`, `.cache\file_processor\button_pixels_sample.json`, `apps\d3-check\.test\square_sampling_result.png` ( ZhuYi for **apps** and Fei **pyapps**) . 
- ** YueDing **: and ZhuLiuCheng D3/D4 JianCeFenLi ; ShuRu JSON XuHan regions.hex_pixels; LuJingYingCanShuHua or Ji at project Gen , FouZe in pyapps or it JiYun line Hui FileNotFoundError. 

### 3.2 Yi by WuJie or GaiCuo Yuan because 

1. ** LuJing hardcode apps and pyapps not Fu **: project ShiJi for pyapps/d3-check; main() Xie apps\d3-check HuiZhao not to WenJian ; .cache LuJing also KeNeng because HuanJing not Tong and Bian . 
2. **JSON structure YiLai **: if CaiYang output or button_pixels_sample Gai for Qi it Jian ( such as data.pixels and Fei regions.hex_pixels) , Hui KeyError; and file_processor or Qi it CaiYangJiao this ChanChuGeShiXuYiZhi . 
3. ** and ZhuLiuChengHun use **: if D3/D4 JieMianJianCeWuYin use this module QieWeiBaoZhengShuRuGeShi and LuJingYiZhi , Hui line for YiChang ; YingMingQue " Jin athtest or ShouGongPaoJiao this use ". 
4. ** MoShu **: square_size=22, step_size=20, tolerance=0.05, 20 PiPeiXiangSu , max_expansion=100 etc. ; XiuGaiWeiTong step WenDang or Diao use FangHuiJieGuo not YiZhi . 

### 3.3 ZhengQueZuoFa 

- main() LuJingGai for CanShu or Ji at __file__ TuiDao project Gen (pyapps/d3-check) ; JSON and CaiYangChanChuYueDingYiZhi ; not in ZhuLiuCheng in ZhiJieYiLai this Jiao this WeiWenDangHua JieKou ; YuZhi and step ZhangBianGeng when Tong step note . 

---

## Si , docs/DESIGN_DETAIL.md

### 4.1 ZhiZe and YueDing 

- ** purpose **: D3-Check ** XiangXiSheJi **, and DESIGN.md ** He use **: DESIGN.md for ZongLan and SuoYin , this DangCeZhong **Login Try and Battle.net DiaoXianChongQi **. 2: ChuFa for RiZhi in ChuXian config ChuFaChuan (log_detection.login_try, MoRen "Login try") ; LiuCheng no Python XianCheng : log_analyzer.analyze_log_line(line) if HanChuFaZe LoginTryScreenshotController.handle_login_try() Du CONFIG battlenet_path JieZhanWangChuangKou (get_screenshot_provider().gen, BATTLE_NET_WINDOW_TITLES) OCR JianCeDiaoXianGuanJianCi (BATTLE_NET_DISCONNECT_KEYWORDS) if DiaoXianZe taskkill Battle.net.exe etc. Yue 2 Miao explorer QiDong Battle.net. 2.3: log_monitor Ding when DuRiZhiDiao log_analyzer.analyze_log_line; log_analyzer Diao get_login_try_screenshot_controller().handle_login_try(). 
- ** YueDing **: ShiXianXu and WenDangYiZhi : CONFIG Jian , ChangLiang (LOGIN_TRY_TRIGGER_DEFAULT, BATTLE_NET_DISCONNECT_KEYWORDS, LOGIN_TRY_SCREENSHOT_DIR etc. ) , Diao use Lian log_monitor log_analyzer handle_login_try, ChongQi use taskkill + explorer. 

### 4.2 Yi by WuJie or GaiCuo Yuan because 

1. ** and DESIGN.md FenGongHunXiao **: DESIGN_DETAIL ZhiXie Login Try and ZhanWangChongQi ; ZongLan , module Biao , QiDongShunXu etc. in DESIGN.md; if ZhiGai this DangWeiGai DESIGN.md ( or Fan of ) , WenDang not YiZhi . 
2. **CONFIG/ ChangLiang and DaiMa not Fu **: if DaiMa use battlenet.exe_path and WenDangXie battlenet_path, or GuanJianCiChangLiangGaiMingWeiTong step WenDang , Hui config DuCuo or JianCe not to DiaoXian . 
3. ** Diao use LianDuanDiao **: if log_monitor not Diao log_analyzer, or log_analyzer not Diao handle_login_try, or handle_login_try within ShunXu and WenDang not YiZhi ( such as XianQiDongZai kill) , line for and SheJi not Fu . 
4. ** ChongQiFangShi **: WenDangMingQue taskkill + explorer; if Gai use Qi it FangShi ( such as subprocess.Popen ZhiJieQi Battle.net.exe) Xu in WenDang in note , FouZe and SheJi not YiZhi . 

### 4.3 ZhengQueZuoFa 

- XiuGai Login Try or ZhanWangChongQiLuoJi when Tong step GengXin this Dang and DESIGN.md; CONFIG Jian and ChangLiang and DaiMaYiZhi ; BaoZheng log_monitor log_analyzer handle_login_try Diao use Lian and WenDang 2 YiZhi ; ChongQiFangShi and 2.2 YiZhi or in this Dang in ZhuMingBianGeng . 

---

## Wu , and apology document GuanXi 

if CiQian because ShangShuRenYiDian ( such as B6 KuaiZhaoLuJing or structure Hun use , d4_controller QuDongFang or process ShunXu , square_sampler LuJing or JSON or ZhuLiuChengHun use , DESIGN_DETAIL and ShiXian or DESIGN.md not Tong step ) DaoZhiFanFuGaiCuo or understand PianCha , KeShi for WeiXianTongDuYueDingSuoZhi . this note YiXieRu cursor_AI_ apology directory , and in Cursor_ ZhuanShu apology document .md in ZengJia to this Wen Yin use . 
