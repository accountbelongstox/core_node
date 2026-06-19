# technical note : d4_red_portal_detector, progress_analyzer, BATTLENET_REGION_DESIGN_REVIEW, battlenet_button_detector, flow_bn_only

** Mu **: note this WuChuDaiMa / WenDang ZhiZe , Yi by WuJie or GaiCuo Yuan because , to and ZhengQueYueDing . 

** She and WenJian **: 
- `d4utils/d4_red_portal_detector.py`
- `athtest/progress_analyzer.py`
- `docs/BATTLENET_REGION_DESIGN_REVIEW.md`
- `d3utils/battlenet_button_detector.py`
- `d3utils/rosbot_flow/flow_bn_only.py`

---

## Yi , d4utils/d4_red_portal_detector.py

### 1.1 ZhiZe and YueDing 

- ** purpose **: D4 HongMenJianCe , Ji at BGR YanSeYanMa + HuaDongChuangKou ; ShuRuKe for LuJing , PIL Image, numpy BGR; FanHui `(x, y, width, height)` or None. 
- ** ZuoBiao and SuoFang **: SaoMiaoQuYu , ChuangKouDaXiao by `D4StandardCoordinates` and `calculate_unified_scaled_coordinate` JueDing ; `is_windowed_mode()` Cong `get_d4_interface_data()` DuQu , use at SuoFangJiSuan . if D4 FenBianLv or ChuangKouMoShi and YueDing not Fu , SaoMiaoQuHuiCuo position . 
- **TARGET_COLORS**: BGR LieBiao , Hong / ChengMenSe ; COLOR_TOLERANCE Yue 5%. if YouXi UI GaiBan or SePian , XuGengXin TARGET_COLORS or RongCha . 

### 1.2 Yi by WuJie or GaiCuo Yuan because 

1. **D4StandardCoordinates char segment **: red_portal_scan_left_margin, red_portal_scan_right_margin, red_portal_scan_bottom_margin, red_portal_max_width, red_portal_max_height, red_portal_min_area etc. if in D4StandardCoordinates in GaiMing or Gai structure , _find_portal_region HuiBaoCuo or SaoCuoQuYu . 
2. **is_windowed_mode and SuoFang **: SuoFangYiLai current_width/current_height and is_windowed_mode; if d4_data WeiZhengQueSheZhiChuangKouMoShi or ChiCun , calculate_unified_scaled_coordinate HuiSuanCuoBianJu . 
3. ** ShuRuGeShi **: PIL Zhuan BGR when use RGBBGR; if Diao use FangChuanRuYi is BGR numpy QueDang RGB ChuLiHuiSePian ; WenDangYiXieMing "numpy array (BGR)". 
4. ** DuoMen **: DangQianShiXianFanHui No. Yi ManZu min_area QuYu ; if XuDuoMen or YouXianJi , XuGaiLuoJi and WenDangHua . 

### 1.3 ZhengQueZuoFa 

- XiuGai D4 BiaoZhunFenBianLv or ZuoBiaoDingYi when Tong step Gai D4StandardCoordinates and this module Yin use ; BaoZheng get_d4_interface_data() ChuangKouChiCun and is_windowed_mode and ZhenShiYun line YiZhi . 
- YouXiGengXinDaoZhiHongMenSeBian when , GengXin TARGET_COLORS or COLOR_TOLERANCE, and in ZhuShi in ZhuMingYiJu ( JieTu / Ban this ) . 

---

## Er , athtest/progress_analyzer.py

### 2.1 ZhiZe and YueDing 

- ** purpose **: JinDu item FenXi -- Cong JSON JiaZaiQianJing / BeiJingSe (regions.hex_pixels) , QuTuXiang in JianYi line , AnQianJingSeZhaoLianXuXiangSu , JinDu = ZuiHouLianXuQianJing position Zhi / KuanDu . 
- **JSON structure **: and load_color_groups YueDingYiZhi : No. Yi line Qian cols-2 for QianJingXiangGuan , ZuiHou 2 for BeiJing ; cols = ceil(sqrt(num_colors)). if JSON GeShi or line LieYuYiBianHua , XuTong step XiuGai . 
- **main() LuJing **: hardcode apps\d3-check, .cache\file_processor; if project for pyapps/d3-check or HuanCunLuJing not TongHui FileNotFoundError. 

### 2.2 Yi by WuJie or GaiCuo Yuan because 

1. **getbbox() Wu use **: `width, height = img.getbbox()[2], img.getbbox()[3]` Qu is bbox right and bottom; JinDang left=0, top=0 when right=width, bottom=height. if TuXiangJingGuoCaiJian or bbox FeiCong (0,0) KaiShi , Ying use width = bbox[2]-bbox[0], height = bbox[3]-bbox[1], FouZeJinDuBaiFenBi and SaoMiaoFanWeiHuiCuo . 
2. ** LuJing hardcode **: and square_sampler, button_detector XiangTong , main() in apps, .cache LuJingXuGai for CanShu or project GenTuiDao , FouZe it Ji or sub project Yun line ShiBai . 
3. ** in Jian line JiaShe **: JinDu item JiaDing in middle_y = height//2; if UI BuJuBianHuaJinDu item not in in Jian line , XuGai for Ke config line or QuYu . 
4. **athtest and ZhuLiuCheng **: this Jiao this Shu athtest GongJu , ZhuLiuCheng D3/D4 if have JinDuJianCeYing use ZhengShi module , WuZhiJieYiLai this Jiao this JSON or SuanFaYueDingWeiWenDangHua then Fu use . 

### 2.3 ZhengQueZuoFa 

- use getbbox() when width = bbox[2]-bbox[0], height = bbox[3]-bbox[1]; or ZhiJie use img.size. 
- main() LuJingGai for MingLing line CanShu or Ji at project Gen ; JSON structure in module Tou or README in note , and ZhuLiuChengJinDuJianCe if have Fu use ZeYueDingYiZhi . 

---

## San , docs/BATTLENET_REGION_DESIGN_REVIEW.md

### 3.1 ZhiZe and YueDing 

- ** purpose **: ZhanWangGuoFu / YaFuCaoZuo and JianCe ** SheJiShenCha **--BattlenetOperation, BattlenetAsiaOps, BattlenetRegionJudge, BattleNetManager, rosbot_flow_battlenet ZhiZe and XianJie ; JieLun for " ZhiZeHuaFenQingXi , KeBaoChiXian have structure ". 
- ** and DaiMaYiZhi **: WenDang in module LuJing , Judge PanDingYiJu (LOGIN_WINDOW_*, asia email/password step) , LiuChengJieDian (B4, B13, BN_LoginAsia) Xu and DangQianShiXianYiZhi ; if DaiMaZhongGou or ChangLiangQianYi ( such as Asia Cong JSON JiaZai ) WeiTong step GengXinWenDang , HuiWuDaoHouXuXiuGai . 

### 3.2 Yi by WuJie or GaiCuo Yuan because 

1. ** WenDang and ShiXianTuoJie **: if BattlenetRegionJudge ZengJiaXinPanDing or BattlenetAsiaOps ZengJiaXin step Wei in this WenGengXin , DuZheHui to for RengAnWenDang line for ShiXian , GaiCuo or LouGai . 
2. **" HeLi " JieLun JiaShe **: WenDangJi at " YaFu no ntes"" GuoFu have legalAcceptance+ntes" etc. ; if ZhanWangKeHuDuanGaiBanDaoZhi markers ChongDie or newly added , XuChongXinPingGu and GengXin " Qian in WenTi and JianYi ". 
3. **JSON and constants**: WenDangTi to YaFu D3/Play KeLaiZi docs JSON, GuoFu for ChangLiang ; if ShiJiGai for GuoFu also Cong JSON JiaZai or LuJingBianGeng , WenDang in " GuoFu for ChangLiang " XuGengZheng . 
4. ** LiuChengJieDianYin use **: B4, B13, BN_LoginAsia etc. if in rosbot_flow_battlenet in GaiMing or FenZhiTiaoZheng , WenDang in LiuChengMiaoShuXuTong step , FouZe and ROSBOT_FLOW_MERMAID or CHECKLIST not YiZhi . 

### 3.3 ZhengQueZuoFa 

- XiuGai Judge, AsiaOps, Operation, flow_battlenet PanDingLuoJi or LiuCheng when , Tong step GengXin this ShenChaWenDang BiaoGe and JieLun ; ChangLiang /JSON LaiYuanBianGeng when GengXin 2, 4. 
- ZhanWangDaBan this or QuFu UI BianHua when , ChongXinGuoYiBian 2.2, 3 PanDing and JianYi , BiYao when GengXin " Qian in WenTi ". 

---

## Si , d3utils/battlenet_button_detector.py

### 4.1 ZhiZe and YueDing 

- ** purpose **: AnZhanWangLanSeAnNiuSe #0074E0 (BATTLE_NET_BUTTON_HEX/RGB) in TuXiang in ZhaoAnNiu ; to RenYiPiPeiXiangSu for left ShangJiaoChangShiGouJian button_wbutton_h Kuang , JinJiaoYan left , Shang , right San item Bian ( not JiaoYanDiBian ) , No. Yi ChengGong i.e. FanHui bbox/center. 
- ** ChangLiang **: LaiZi providor.constants.common (BATTLE_NET_BUTTON_HEX, BATTLE_NET_BUTTON_RGB, DEFAULT_BRIGHTNESS_TOL, DEFAULT_BUTTON_W, DEFAULT_BUTTON_H) . if ZhanWangZhuTi or AnNiuChiCunBianHua , XuGengXinChangLiang or Diao use FangChuanCan . 

### 4.2 Yi by WuJie or GaiCuo Yuan because 

1. ** not JiaoYanDiBian **: SheJiShangGuYi not JiaoYanDiBian to JianShaoWuPan ; if UI ShangFeiAnNiuQuYu also have TongSeQieGaoDu button_h, KeNengWuJian ; if XuGengYanKeGai for SiBianJiaoYan and WenDangHua . 
2. **button_w/button_h and ZhenShi not YiZhi **: DEFAULT_BUTTON_W/H if and DangQianZhanWangKeHuDuanAnNiuShiJiChiCun not Fu , HuiZhao not to or KuangCuo ; not TongFenBianLvXiaKeNengXuSuoFang , DangQianJieKouWeiZuoSuoFang , Diao use FangXuChuanRuYiShiPeiChiCun or this module Cong resolution TuiDao . 
3. **RGB and BGR**: this module use RGB (_image_to_rgb) ; if Diao use FangChuanRu BGR WeiZhuan RGB HuiSePian , Diao use YueDingXuXieMingShuRuGeShi . 
4. ** and BattlenetOperation GuanXi **: DianJiZhanWangAnNiuTongChangZou UIA/ KongJian ; this module for TuXiangJianCeBei use . if in LiuCheng in Hun use " Xian UIA Zai fallback this JianCe " XuYueDingShunXu , BiMianChongFu or ChongTu . 

### 4.3 ZhengQueZuoFa 

- ZhanWangZhuTi or FenBianLvBianGeng when He to BATTLE_NET_BUTTON_* and DEFAULT_BUTTON_W/H; BiYao when AnFenBianLv or scale ChuanCan . 
- ShuRuTuXiangGeShi (RGB/BGR) in HanShuZhuShi or Diao use ChuMingQue ; and Operation DianJiCeLve in LiuChengWenDang in QuFen "UIA YouXian / TuXiang fallback". 

---

## Wu , d3utils/rosbot_flow/flow_bn_only.py

### 5.1 ZhiZe and YueDing 

- ** purpose **: BN-only LiuCheng Yi tick Zhi line (Ensure Battle.net only, bn_only_enabled for True when ) ; ** not BaoHan ** D3 or flow_master LuoJi . step ShunXu : REFRESH_NOTIFY (refresh_battlenet_status + notify_state_sync) RE_READ_ABORT ( if bn_only GuanBiZe return) RUN_BN_TICK (tick_battlenet_ready_flow(no_activate=True)) HANDLE_BN_RESULT (set_last_bn_result, confirmed when reset_confirmed_to_poll(for_bn_only=True)) . 
- **no_activate**: tick_battlenet_ready_flow(no_activate=True) BiaoShi BN-only not JiHuoChuangKou ( not QiangJiaoDian ) ; and flow_master Xia B block KeNengJiHuo YuYiQuFen . 
- ** ZhuangTai **: step and ZhuangTaiDingYi in flow_bn_only_state; this module ZhiFuZe " Zhi line tick + Diao No. SanFang + GengXinZhuangTai ". 

### 5.2 Yi by WuJie or GaiCuo Yuan because 

1. ** in Ci module Jia D3 or flow_master step **: if Wu in tick_bn_only_flow within Diao use refresh_d3_status, tick_flow_master or extension_flow_tick_step, HuiPoHuai " JinQueBaoZhanWang " YuYi , and INITIAL_STATE_DETECTION and one_shot "BN-only ZhiShua BN" MaoDun . 
2. ** QuDiao REFRESH_NOTIFY or GaiShunXu **: Xian refresh Zai run_bn_tick is YueDing ; if XianPao BN tick Zai refresh HuiJi at JiuZhuangTaiZuoJueCe . 
3. **no_activate Gai for False**: BN-only ChangJingTongChang not XiWangQiangJiaoDian ; if Gai for False and " JinQueBaoZhanWang " YuQi line for KeNeng not Fu . 
4. **set_last_bn_result / reset_confirmed_to_poll**: if HANDLE_BN_RESULT LuoJi by Shan or Gai ( such as confirmed when not Diao use reset_confirmed_to_poll) , XiaYou or B block KeNengWuPan " Yi confirm " ZhuangTai , DaoZhiChongFu confirm or Lou confirm . 

### 5.3 ZhengQueZuoFa 

- tick_bn_only_flow within ** Jin ** Zhi line WenDang in Si step ; not YinRu D3, ROSBOT, flow_master, extension tick. 
- XiuGai flow_bn_only_state step MeiJu or rosbot_flow_battlenet no_activate YuYi when , Tong step GengXin this module ZhuShi and ROSBOT_FLOW XiangGuanWenDang . 

---

## Liu , and apology document GuanXi 

if CiQian because ShangShuRenYiDian ( such as d4 HongMenZuoBiao / SuoFang or TARGET_COLORS GaiCuo , progress_analyzer getbbox or LuJing , BATTLENET_REGION WenDangWei and ShiXianTong step , battlenet_button ChiCun or ShuRuGeShiCuoWu , flow_bn_only HunRu D3/flow_master) DaoZhiFanFuGaiCuo or understand PianCha , KeShi for ShiXian and YueDing not YiZhiSuoZhi . this note YiXieRu `cursor_AI_ apology directory `, and in `Cursor_ ZhuanShu apology document .md` in ZengJia to this Wen Yin use , Bian at HouXuXiuGaiQianXianChaCiChuYueDing . 
