# technical note : SheJiWenDang , BATTLENET_REGION_DESIGN_REVIEW, battlenet_button_detector, flow_f1c_f1d

** Mu **: note CiSiChuWenJian / WenDang ZhiZe , Yi by WuJie or GaiCuo Yuan because , to and ZhengQueYueDing . 

** She and WenJian **: 
- `docs/ SheJiWenDang .md`
- `docs/BATTLENET_REGION_DESIGN_REVIEW.md`
- `d3utils/battlenet_button_detector.py`
- `d3utils/rosbot_flow/flow_f1c_f1d.py`

---

## Yi , docs/ SheJiWenDang .md

### 1.1 ZhiZe and YueDing 

- ** purpose **: D3-Check SheJiWenDangXiangXiBan , and DESIGN.md He and use ; this WenDangCeZhong **Login Try and Battle.net DiaoXianChongQi ** WanZhengSheJi . LiuCheng : RiZhiChuXianChuFaChuan (log_detection.login_try, MoRen "Login try") log_analyzer Diao LoginTryScreenshotController.handle_login_try() Du config battlenet_path Jie Battle.net ChuangKou (screenshot_provider.gen, BATTLE_NET_WINDOW_TITLES) OCR (CnOCREngine, BATTLE_NET_DISCONNECT_KEYWORDS) if DiaoXianZe taskkill Battle.net.exe + etc. DaiYue 2 Miao + explorer QiDong . ** no Python XianCheng **; Wei config or WeiJie to ChuangKou when TuiHua for QuanPingJieTu . 
- ** YueDing **: ChangLiang in config.constants (LOGIN_TRY_*, BATTLE_NET_DISCONNECT_KEYWORDS, BATTLE_NET_EXE_NAME) ; CONFIG["battlenet"]["battlenet_path"], providor_index.BATTLE_NET_WINDOW_TITLES; RiZhiLuJing by get_dynamic_paths(), paths.rosbot_logs_relative/logs_file_relative. and DESIGN.md for ZongLan and SuoYin , this WenDang for XiangXiSheJi , XiuGai Login Try or DiaoXianChongQiLuoJiXu and this WenDangYiZhi . 

### 1.2 Yi by WuJie or GaiCuo Yuan because 

1. ** in handle_login_try within use Python XianChengZuo taskkill or QiDong **: WenDangMingQue " no Python XianCheng ", Jin subprocess.run taskkill and explorer; if Gai use threading or asyncio HuiWeiFanSheJi . 
2. ** Gai BATTLE_NET_DISCONNECT_KEYWORDS or LOGIN_TRY_TRIGGER_DEFAULT WeiTong step config.constants and WenDang **: WenDangLieChuChangLiangDingYi position Zhi , if ZhiGaiYiChuHui not YiZhi . 
3. **OCR DiaoXianPanDuanLuoJi and WenDang not Fu **: WenDang for " ShiBieWen this BaoHanRenYi BATTLE_NET_DISCONNECT_KEYWORDS i.e. DiaoXian "; if Gai for QuanBuPiPei or ZengJiaQi it item JianHui and 2.2 not Fu . 
4. **Battle.net LuJing or ChuangKouBiaoTiLaiYuanCuo **: battlenet_path LaiZi CONFIG["battlenet"]["battlenet_path"]; ChuangKouBiaoTiLaiZi providor_index.BATTLE_NET_WINDOW_TITLES; if CongBieChuDuHuiLuJing or JieChuangCuo . 

### 1.3 ZhengQueZuoFa 

- XiuGai Login Try or DiaoXianChongQiQianXianDu this WenDang 24; BaoChi no Python XianCheng , taskkill + explorer; ChangLiang and config.constants and WenDangYiZhi ; and DESIGN.md He and understand . 

---

## Er , docs/BATTLENET_REGION_DESIGN_REVIEW.md

### 2.1 ZhiZe and YueDing 

- ** purpose **: ** ZhanWangGuoFu / YaFuCaoZuoLei and JianCeKuSheJiHeLiXingShenCha **. BattlenetOperation ( TongYiRuKou ) , BattlenetAsiaOps ( YaFuYouXiang / MiMa step ) , BattlenetRegionJudge (** DanYiZhenXiangYuan **: YaFu / GuoFu / DengLu / ZhuJieMian / DiaoXian / LianJie in /detected_region) , BattleNetManager ( JinCheng and ChuangKou ) , rosbot_flow_battlenet ( LiuChengBianPai ) . Judge KongJianLieBiao by Operation._enumerate_controls() Shi when MeiJu ; preferred_region LaiZi ros_settings.battlenet_region_cache; YaFu / GuoFuPanDingYi LOGIN_WINDOW_AUTOMATION_ID_MARKERS_ASIA and MARKERS ( Han ntes for GuoFu ) , step is_asia_email_step/is_asia_password_step. B4/B13/BN_LoginAsia and Judge, Operation/AsiaOps XianJie . 
- ** YueDing **: Suo have " DangQian is ShenMe " PanDuanJunJing BattlenetRegionJudge; Operation ZhiFuZeMeiJu , DianJi , GuoFuLiuCheng ; YaFuDongZuoWeiTuo BattlenetAsiaOps; detected_region and get_dynamic_state_result region_detected TongYuan . if in LiuCheng or BieChuZhiJiePan " YaFu / GuoFu " and not Jing Judge HuiPoHuaiDanYiZhenXiangYuan . YaFu D3/Play KeLaiZi docs JSON or app_constants *_ASIA; GuoFu for ChangLiang . 

### 2.2 Yi by WuJie or GaiCuo Yuan because 

1. ** in rosbot_flow_battlenet or BieChuZhiJieGenJuKongJianPanYaFu / GuoFu **: WenDangMingQue Judge for DanYiZhenXiangYuan ; if in flow within ZiShiXianPanDingHui and Judge ChongFu or not YiZhi . 
2. ** Gai LOGIN_WINDOW_AUTOMATION_ID_MARKERS and ASIA ChongDie **: GuoFuHan ntes, YaFu not Han ; if YaFuBan this also ChuXian legalAcceptance KeNengPianGuoFu , but YaFuHaiYiLai is_asia_email_step/is_asia_password_step, Gai markers WeiTong step step HuiWuPan . 
3. **_load_asia_features_from_docs_json and GuoFuChangLiang not to Cheng **: YaFuKeCong docs JSON JiaZai , GuoFu hardcode constants; if GuoFu also GaiCong JSON XuTong step WenDang and JiaZaiLuoJi . 
4. **B4/B13/BN_LoginAsia Diao use Judge or Operation ShunXu and WenDang not Fu **: B4 Xian login_failed, browser_wait, Zai is_on_login_screen/is_on_asia_login_screen; B13 use get_dynamic_state(preferred_region); if DianDao or LouPanHuiLiuChengCuo . 

### 2.3 ZhengQueZuoFa 

- XiuGaiZhanWangPanDing or CaoZuoQianXianDu this WenDang and Ge module ZhiZeBiao ; ZhuangTai and " DangQian is ShenMe " ZhiJing BattlenetRegionJudge; LiuChengZhiZuoBianPai , no repetition ShiXianPanDing ; ChangLiang and JSON GengXinXuTong step app_constants or docs. 

---

## San , d3utils/battlenet_button_detector.py

### 3.1 ZhiZe and YueDing 

- ** purpose **: **Battle.net LanSeAnNiuJianCe ** ( YanSe #0074E0) . to RenYiGaiSeXiangSu for left ShangJiaoChangShiGouJian button_wbutton_h Kuang ( MoRen 20020) , ** JinJiaoYan left , Shang , right SanBian ** ( not JiaoYanDiBian ) ; No. Yi ChengGongGouJian i.e. FanHui bbox, center, width, height. ChangLiangLaiZi **providor.constants.common**: BATTLE_NET_BUTTON_HEX, BATTLE_NET_BUTTON_RGB, DEFAULT_BRIGHTNESS_TOL, DEFAULT_BUTTON_W, DEFAULT_BUTTON_H. 
- ** YueDing **: find_battlenet_blue_button(image, color_hex, brightness_tol, button_w, button_h, log_prefix) FanHui Optional[Dict]; image Ke for path, PIL Image, ndarray; _check_left_top_right not JianChaDiBian ; if GaiJiaoYanLuoJi for SiBian or GaiMoRenChiCunXu and Diao use Fang and constants YiZhi . and BattlenetOperation/Judge KongJianDianJi for not TongLuJing ( this module for XiangSuSe block JianCe ) . 

### 3.2 Yi by WuJie or GaiCuo Yuan because 

1. ** in _check_left_top_right within ZengJiaDiBianJiaoYan **: WenDang and ZhuShiMingQue "validate left, top, right edges only (not bottom)"; if JiaDiBianKeNeng because CaiJian or ZheDangDaoZhiJian not to . 
2. ** Gai BATTLE_NET_BUTTON_HEX or DEFAULT_BUTTON_W/H WeiTong step providor.constants.common**: ChangLiangCong common DaoRu , if in detector within hardcode or Gai common WeiTong step Diao use FangHuiChiCun or YanSeCuo . 
3. **brightness_tol MoRen and _rgb_bounds LuoJi **: 0 TongDao use [0, ceil(255*tol)]; Fei 0 use value*(1tol); if Gai tolerance or bounds HuiWuPiPei or LouPiPei . 
4. ** and BattlenetRegionJudge or Operation D3/Play DianJiHunXiao **: Judge/Operation use automation_id/name and KongJianShu ; this module use XiangSuSe block ; if in LiuCheng in Hun use LiangTaoLuoJiXuMingQueChangJing . 

### 3.3 ZhengQueZuoFa 

- BaoChi left / Shang / right SanBianJiaoYan ; ChangLiang to providor.constants.common for Zhun ; GaiChiCun or YanSeXuTong step common and Diao use Fang ; and KongJianDianJiLuJingQuFenQingChu . 

---

## Si , d3utils/rosbot_flow/flow_f1c_f1d.py

### 4.1 ZhiZe and YueDing 

- ** purpose **: **F1c / F1d** (ROSBOT_FLOW_MERMAID F block ) . **F1d**: JianCe to DiaoXian set d3_disconnected (get_game_interface_data().set_d3_dynamic_status(..., disconnected=True)) , reset_bn_block_state(False), **caller SuiHouDiao run_f1c_end_d3**. **F1c**: kill D3 (get_d3_manager().kill_if_running()) , XiaYi tick Jin F_Entry. F1d not in Ci within Diao F1c, by caller ShunXuDiao use . 
- ** YueDing **: run_f1d_on_disconnect() and run_f1c_end_d3() Diao use ShunXu for ** Xian F1d Zai F1c**; F1c not in Ci within Diao use F_Entry, by XiaYi tick JinRu . if in run_f1d within ZhiJieDiao run_f1c HuiOuHeDan tick within WanChengLiang segment ; DangQianSheJi for caller Diao F1d Zai F1c. reset_bn_block_state(False) for ZhongZhi BN block ZhuangTai ( and FLOW_ARCHITECTURE_DIRECTORY YiZhi ) . 

### 4.2 Yi by WuJie or GaiCuo Yuan because 

1. ** in run_f1d_on_disconnect within ZhiJieDiao use run_f1c_end_d3**: WenDang and ZhuShiXie "Caller then calls run_f1c_end_d3"; if in Ci within DiaoHuiGaiBian caller Diao use YueDing and Dan tick YuYi . 
2. ** DianDaoDiao use ShunXu ( Xian F1c Zai F1d) **: YingXian set ZhuangTai and reset BN Zai kill D3; if Xian kill Zai set ZhuangTaiHuiZhuangTai and LiuCheng not YiZhi . 
3. **set_d3_dynamic_status CanShu and WenDang not Fu **: WenDang for on_login_screen=False, disconnected=True, in_game=False; if GaiCanShuHui game_interface_data ZhuangTaiCuo . 
4. **reset_bn_block_state(False) and reset_bn_block_state(True) HunXiao **: False for Flow-master BN block ZhongZhi ; if Chuan True or ShengLveKeNengYuYi not Tong ( Jian flow_bn_block_state) . 

### 4.3 ZhengQueZuoFa 

- BaoChi F1d Jin set ZhuangTai and reset BN, not in Ci within Diao F1c; caller Xian F1d Zai F1c; and ROSBOT_FLOW_MERMAID, FLOW_ARCHITECTURE_DIRECTORY YiZhi . 

---

## Wu , and apology document GuanXi 

if CiQian because WeiXianTongDuShangShuSiChuYueDing ( SheJiWenDang Login Try no XianCheng and ChangLiang , BATTLENET_REGION_DESIGN_REVIEW Judge DanYiZhenXiangYuan and LiuChengXianJie , battlenet_button_detector SanBianJiaoYan and constants, flow_f1c_f1d caller Diao F1d Zai F1c) and in CiSiChuFanFuGaiCuo or understand PianCha , the responsibility lies with Ji . this note YiXieRu cursor_AI_ apology directory , and in Cursor_ ZhuanShu apology document in ZengJia to this Wen Yin use . 
