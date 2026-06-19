# technical note : _obsolete_click_handler, ROSBOT_FLOW, i18n_main_window_en, log_panel, DESIGN_DETAIL

** Mu **: note this WuChuDaiMa / WenDang ZhiZe , Yi by WuJie or GaiCuo Yuan because , to and ZhengQueYueDing . 

** She and WenJian **: 
- `utils/_obsolete_click_handler.py`
- `docs/ROSBOT_FLOW.md`
- `providor/i18n/i18n_main_window_en.json`
- `ui/panels/log_panel.py`
- `docs/DESIGN_DETAIL.md`

---

## Yi , utils/_obsolete_click_handler.py

### 1.1 ZhiZe and YueDing 

- ** purpose **: WenJianMingDai `_obsolete_`, BiaoShi ** YiFeiQi **. TiGongZhanWangXiangGuanDianJiNengLi : TuoPanTuBiaoChaZhao and DianJi , TongGuoChuangKouXiaoXi /PostMessage/PyAutoGUI/ ZhiDing +PyAutoGUI/UI Automation DianJiYuanSu , ChaZhao and DianJi D3 AnNiu and Play AnNiu , MeiJu UI Automation KongJian . YiLai `providor.providor_second` CONFIG, DEBUG_DIR, PLAY_BUTTON_AUTO_ID, PLAY_BUTTON_MAIN_AUTO_ID, PLAY_BUTTON_AUTOMATION_IDS. 
- ** and ZhuLiuChengGuanXi **: DangQianZhanWang " MeiJuKongJian , DianJi D3 tab/Play, GuoFu / YaFuDengLu " by `d3utils.battlenet_operation` and `d3utils.battlenet_asia_ops` FuZe , TongGuo BattlenetRegionJudge ZuoZhuangTaiPanDuan . this WenJian ** WeiJieRuZhuLiuCheng **, JinZuoYiLiuCanKao . 

### 1.2 Yi by WuJie or GaiCuo Yuan because 

1. ** DangXian line module use **: if in CiWenJian within newly added or XiuGai " ZhanWangDianJi / DengLu " LuoJi and QiWangZhuLiuChengShengXiao , Hui no Xiao -- ZhuLiuCheng not Diao use CiChu . 
2. ** and battlenet_operation ChongFu **: if in obsolete LiGai automation_id, Play AnNiuLieBiao etc. , and app_constants and BattlenetOperation not YiZhi , HuiDaoZhiWenDang and ShiXianLiangTaoLuoJi . 
3. **CONFIG and providor_second**: CiChuDu CONFIG and providor_index config worker if and Cun , XuBiMian dual Xie ; QieZhuLiuChengYiTongYi use battlenet_manager + battlenet_operation, CiChu CONFIG purpose for LiShi . 
4. ** ZuoBiao and rect**: click_element_by_window_message / by_post_message use " Xiang to ChuangKou client ZuoBiao "; MAKELONG(x,y) for lparam, if ChuanRuPingMuZuoBiaoHuiDianCuo . element_info.rect LaiZi UI Automation BoundingRectangle, Xu confirm is KeHuQuHai is PingMuZuoBiaoZaiHuanSuan . 

### 1.3 ZhengQueZuoFa 

- ZhanWangXiangGuanDianJi and DengLuLuoJiZhiGai `battlenet_operation.py`, `battlenet_asia_ops.py` and app_constants; not in Ci obsolete WenJianShangZuoGongNengZengQiang . 
- if JinCanKao this WenJianShiXian ( such as PostMessage DianJi ) , ChaoLuoJi to Xin module and JieRuZhuLiuCheng , and FeiZhiJieFu use this WenJianRuKou . 

---

## Er , docs/ROSBOT_FLOW.md

### 2.1 ZhiZe and YueDing 

- ** purpose **: ROSBOT QiDongLiuCheng ** SheJiWenDang **, ZhiMiaoShu " ZuoShenMe , in ShenMe item JianXiaZouNa item FenZhi ", ** not ZhiDing ** JuTiDaiMa , module Ming , LeiKu . ShiXian by CangKu within Ji have module and spec Zi line to Jie . 
- ** GuanJianYueDing **: 
- QuanJuDing when Qi **1 Miao ** YiTiao ; this LiuChengTongGuo **% FangShi ** ShiXian **2 Miao ** Yi tick ( every 2 1 Miao tick CaiQuDongYiCi ) . 
- ZongZhuangTaiGuanBi TiaoGuoSuo have FenZhi ; ZongZhuangTai enable AnDangQianFenZhiQuDong ; JieDianFen for **wait** ( this tick TiaoGuo ) and ** have DaoXiang ** ( Zhi line and QieHuan ) . 
- **D3 KaiShiJieMian **: to D3 ChuangKouJieTu , use **scale match** PiPei **d3_start_game_button.png**, PiPei to i.e. Shi for " KaiShiYouXi " JieMian . 
- ** An M JianQianTi **: ** JinDangYiChuXian d3_game_tool when CaiAn M Jian **; WeiChuXianZeBiaoJi wait, this tick TiaoGuo . 
- **D3 is Fou in Xian **: JinDangYiChuXian d3_game_tool when Zhi line Wu step : XianJieTu ( Tu A) An M ZaiJieTu ( Tu B) to BiXiangSiDu ( GaoDuXiangSi DiaoXian ) ZaiAn M HuiFu . 
- DiaoXianXiangGuanMuBanMingMing : **d3_disconnected.png**. 
- ZhanWangJieMianShiBie : ** not to ZhanWangZuo OCR JieTu **, use **Windows Analyzer / UI ZiDongHua ** ShiBieZhanWangChuangKou and KongJian . 
- QiDongShunXu : ZhanWangQiDong and DengLu AnHei 3 QiDong ROSBOT QiDong , ShunXu not KeLuan . 

### 2.2 Yi by WuJie or GaiCuo Yuan because 

1. ** Ding when Qi and tick**: if ShiXianCheng 1 MiaoYi LiuCheng tick or not use % ShiXian 2 Miao , and WenDang "2 MiaoYi tick" not Fu , HuiDaoZhiJieZouCuo . 
2. ** WeiChuXian d3_game_tool then An M**: if in WeiChuXian d3_game_tool when Fa M Jian , WenDangMingQueJinZhi , HuiDaoZhiWuPan or UI CuoLuan . 
3. **D3 in XianJianCeShunXu **: if DiaoHuan or ShengLve " JieTu M JieTu XiangSiDu ZaiAn M" RenYi step , and WenDangYueDing not Fu . 
4. ** ZhanWang use OCR**: if to ZhanWangChuangKouZuoJieTu OCR PanDingDengLu / ZhuJieMian , and WenDang " use UI ZiDongHua , not OCR" MaoDun . 
5. ** JieDian wait vs have DaoXiang **: if BaYing for wait JieDianZuoCheng have DaoXiang or FanGuoLai , LiuChengHuiDuoZou / ShaoZou or KaSi . 
6. **d3_disconnected MingMing **: if use Qi it WenJianMing or ChangLiangMing , and WenDangYueDing not YiZhi , not Li at WeiHu . 

### 2.3 ZhengQueZuoFa 

- ShiXian when YanGeAn " ZhuangTaiGuanLi and QuanJuDing when Qi ""D3 JieMianPanDing and in XianJianCe " LiangJie YueDing ; tick use % ShiXian 2 Miao ; M Jian and in XianJianCeJin in have d3_game_tool when Zhi line ; ZhanWang use UI ZiDongHua ; LiuChengJieDianQuFen for wait/ have DaoXiang and in DaiMa in TiXian . 
- XiuGaiLiuChengLuoJi when Xian to YiXia ROSBOT_FLOW.md, BiMian and WenDangChongTu . 

---

## San , providor/i18n/i18n_main_window_en.json

### 3.1 ZhiZe and YueDing 

- ** purpose **: ZhuChuangKouYingWenJieMianWenAn , Gong i18n_manager An key QuWen this . structure for QianTao JSON: `ui.main_window.*`, `button_area.*`, `tabs.*`, `macro_controls.*`, `bottom_bar.*`, `status_bar.*`, `main_functions_panel.*`, `system_tray.*` etc. . 
- ** use FangShi **: DaiMaCeTongGuo `i18n_manager.get_ui_text("xxx.yyy.zzz")` etc. and JSON within LuJingYiZhi key HuoQuWenAn ; key and JSON CengJi , MingMingBiXuYiZhi . 

### 3.2 Yi by WuJie or GaiCuo Yuan because 

1. ** Gai key WeiTong step **: in JSON in GaiMing or YiDongJieDianHou , Wei in DaiMa in Ba get_ui_text key YiQiGai , HuiDaoZhiQu not to or QuCuo . 
2. ** newly added key WeiJiaWenAn **: newly added GongNeng when Zhi in DaiMaLi get_ui_text("new_key"), Wei in JSON in Bu new_key, HuiXianShi key or Kong . 
3. ** DuoYuYan not YiZhi **: if Cun in i18n_main_window_zh.json etc. , ZhiGaiYingWenWeiGai in Wen , or structure not YiZhi , HuiDaoZhiMouYuYanQue key. 
4. ** LuJingXieCuo **: such as Ba tabs.main_functions XieCheng main_functions_panel.xxx or tabs.main, and JSON structure not Fu . 

### 3.3 ZhengQueZuoFa 

- ZengShanGaiWenAn when , JSON and Suo have Diao use get_ui_text DaiMaYiQiGai ; BaoChiGeYuYan JSON structure YiZhi ; key and WenDang or ZhuShi in " WenAn key Biao " YiZhi . 

---

## Si , ui/panels/log_panel.py

### 4.1 ZhiZe and YueDing 

- ** purpose **: ZhuRiZhi panel (TABLE4) , TiGongRiZhiZhanShi , QingKong , BaoCun , GuoLv ( JiBie , is FouXianShi DEBUG) , ZiDongGunDong , right JianFuZhi etc. . TongGuo **ColorPrint.register_callback(self.add_log_message)** JieShouRiZhi ; **add_log_message in Diao use FangXianChengZhi line **, JinZuoRuDui and **container.after(0, _append)**, ZhenShiZhuiJia and GuoLv in ZhuXianCheng _append within Zhi line . 
- ** GuanJianYueDing **: 
- ** not Ke in add_log_message within Du CONFIG**: add_log_message by ColorPrint HuiDiao , KeNeng in ** RenYiXianCheng ** ( BaoKuo config worker) Diao use . if in CiChuDiao use ConfigBinding.get_config_value, and config worker Zheng in Xie config and etc. Dai CONFIG_QUEUE, Hui ** SiSuo **. GuoLv (show_debug_logs, log_level) BiXu in ** ZhuXianCheng ** _should_display_message LiDu config . 
- ColorPrint HuiDiaoCanShu : ShiJiChuanRu for (message, color_type, log_level), log_panel Jiang No. Er CanShuDang level, No. San Dang color use ; color_type for red/green/yellow/blue/gray/cyan/white, log_level for DEBUG/INFO/WARNING/ERROR/SUCCESS. 
- ZhanShiQian use _strip_ui_log_prefix QuDiao [ROSBOT], [ROSBOT~*s], [LogAnalyzer] QianZhui . 
- log_settings: show_debug_logs, auto_scroll, log_level Cun at ConfigBinding, and control panel checkbox/combobox BangDing . 

### 4.2 Yi by WuJie or GaiCuo Yuan because 

1. ** in add_log_message LiDu config **: in HuiDiaoLiDiao use get_config_value("log_settings.show_debug_logs") etc. , if Diao use LaiZi config worker, YiSiSuo . 
2. ** XiuGaiHuiDiaoQianMing **: ColorPrint GuDingChuan (message, color_type, log_level), if log_panel JiaSheCanShuShunXu or HanYi not Tong , HuiCuo use level/color. 
3. ** GuoLvLuoJi position Zhi **: if in after(0) of WaiGenJu config GuoLv and JueDing is Fou append, RengKeNeng in FeiZhuXianChengDu config , Cun in JingTai or SiSuo . 
4. **i18n key**: AnNiu , BiaoQian use log_panel.xxx ( such as log_panel.clear_logs, log_panel.show_debug_logs) , if JSON in no to Ying key or key GaiMingWeiTong step , HuiXianShi key or CuoWenAn . 

### 4.3 ZhengQueZuoFa 

- Suo have " is FouXianShi "" AnJiBieGuoLv " config DuQuFang in _should_display_message ( ZhuXianCheng ) within ; add_log_message ZhiZu log_entry and after(0, _append). 
- BaoChi ColorPrint HuiDiao (message, color_type, log_level) and log_panel JieXiFangShiYiZhi ; newly added log XiangGuan config when use log_settings.* and Jin in ZhuXianChengDu . 

---

## Wu , docs/DESIGN_DETAIL.md

### 5.1 ZhiZe and YueDing 

- ** purpose **: and DESIGN.md PeiTao ** XiangXiSheJi **, CeZhong **Login Try** and **Battle.net DuanXianJianCe and ChongQi **. MiaoShuChuFa item Jian , LiuCheng step , She and module and ChangLiang . 
- ** GuanJianYueDing **: 
- ChuFa : RiZhi in ChuXian config trigger ( MoRen `config.constants.LOGIN_TRY_TRIGGER_DEFAULT`, such as "Login try") . 
- LiuCheng : Du config ( ZhanWangLuJing ) JieZhanWangChuangKou (screenshot_provider, BATTLE_NET_WINDOW_TITLES) OCR JianCeDuanXian (CnOCREngine, BATTLE_NET_DISCONNECT_KEYWORDS) if DuanXianZe taskkill Battle.net etc. DaiYue 2 Miao explorer QiDong Battle.net. 
- JieTu directory and QianZhui : LOGIN_TRY_SCREENSHOT_DIR, LOGIN_TRY_SCREENSHOT_PREFIX. 
- module : log_monitor LunXunRiZhi , log_analyzer JieXi line and Diao use LoginTryScreenshotController.handle_login_try(). 

### 5.2 Yi by WuJie or GaiCuo Yuan because 

1. ** ChuFa char FuChuan not YiZhi **: if DaiMaLi use not TongChangLiang or config key, and WenDang log_detection.login_try, LOGIN_TRY_TRIGGER_DEFAULT not YiZhi , HuiChuFa not to or WuChuFa . 
2. ** LiuChengShunXu or QueShi **: if XianQiDongZai kill, or Wei etc. Dai , or use Cuo exe/cwd, and WenDang "kill etc. 2 Miao explorer QiDong " not Fu . 
3. **OCR and GuanJianCi **: if DuanXianGuanJianCi or OCR YinQing and WenDang not YiZhi , HuiWuPan / LouPan . 
4. ** ChuangKouBiaoTi and JieTu **: if BATTLE_NET_WINDOW_TITLES and WenDang or DuoYuYan not YiZhi , Jie not to ZhengQueChuangKou . 

### 5.3 ZhengQueZuoFa 

- ShiXian Login Try and ZhanWangChongQi when to DESIGN_DETAIL.md for Zhun ; GaiChuFa , LiuCheng , ChangLiang when Tong step GengXinWenDang ; BaoChi log_analyzer, LoginTryScreenshotController, constants, screenshot_provider and WenDangMiaoShuYiZhi . 

---

## Liu , and apology document GuanXi 

if CiQian because ShangShuRenYiDian ( such as Wu use _obsolete_click_handler, WeiFan ROSBOT_FLOW tick/M Jian / ZhanWang UI FangShi , i18n key not Tong step , log_panel in HuiDiao in Du config DaoZhiSiSuo , DESIGN_DETAIL and ShiXian not YiZhi ) DaoZhiFanFuGaiCuo or understand PianCha , KeShi for WeiXianTongDuYueDingSuoZhi . this note YiXieRu cursor_AI_ apology directory , and in Cursor_ ZhuanShu apology document .md in ZengJia to this Wen Yin use . 
