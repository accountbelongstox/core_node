# technical note : debug_window_offset, extension_flow_tick_step, i18n_auxiliary_panel_en

** Mu **: note CiSanChuJiao this / module / WenAn ZhiZe , Yi by WuJie or GaiCuo Yuan because , to and ZhengQueYueDing . 

** She and WenJian **: 
- `scripts/debug/debug_window_offset.py`
- `d3utils/rosbot_flow/extension_flow_tick_step.py`
- `providor/i18n/i18n_auxiliary_panel_en.json`

---

## Yi , scripts/debug/debug_window_offset.py

### 1.1 ZhiZe and YueDing 

- ** purpose **: ** TiaoShiJiao this **, ZhenDuan 70px ChuangKouPianYiWenTi ; DuQu **get_d4_interface_data()** fullscreen_size, game_window_size, window_offset, is_windowed_mode(), JiSuanKuanGaoCha and TuiSuanBianKuang / BiaoTiLan ( left right GeBan , BiaoTiLan = GaoDuCha - CeBianKuan ) ; DaYinDangQianChangLiang TITLE_BAR_HEIGHT=31, WINDOW_BORDER_WIDTH=8 and " if 70px PianYiCun in " when JianYiZhi . LuJing : _project_root = __file__ parent.parent ( i.e. scripts/debug scripts d3-check) . 
- ** YueDing **: Yun line QianXuXian have D4 JieTu / CaiJi , FouZe d4_data no size ShuJuHuiTiShi "No size data available"; Jiao this within 31/8 for DaYin use CanKaoZhi , ShiJiChangLiangKeNeng in providor.constants or D4 XiangGuan module ; Cong scripts/debug/ or d3-check GenYun line and BaoZheng sys.path Han d3-check. 

### 1.2 Yi by WuJie or GaiCuo Yuan because 

1. ** WeiXianCaiJi i.e. Yun line **: d4_data LaiZi get_d4_interface_data(), if Cong not executed Guo D4 JieTu or capture_and_collect_info, fullscreen_size/game_window_size for Kong , Jiao this ZhiNengTiShi no ShuJu ; Yi by WuRen for Jiao this bug. 
2. ** LuJing and Yun line directory **: _project_root for __file__.parent.parent (scripts FuJi = d3-check) ; if Jiao this Nuo to BieChu or Cong repo GenYun line , parent.parent KeNeng not d3-check, import share.game_interface_data etc. HuiShiBai . 
3. ** ChangLiang and ShiJiShiXian not YiZhi **: Jiao this DaYin 31/8 Jin for note use ; if D4 or screenshot_provider in ShiJi use TITLE_BAR_HEIGHT/WINDOW_BORDER_WIDTH QuZhiYiGai , Jiao this output HuiWuDao ; XiuGaiChangLiang when YingTong step Jiao this within note or CongChangLiang module DuQu . 
4. ** JinZhenDuan not XieHui **: Jiao this ZhiDu d4_data and DaYin , not XieHui CONFIG or d4_data; if QiWang " GenJuZhenDuanZiDongGaiChangLiang " XuLingShiXian . 

### 1.3 ZhengQueZuoFa 

- Yun line QianXianZhi line D4 JieTu / CaiJiShi d4_data have ChiCun ; Cong d3-check Gen or BaoZheng project_root ZhengQue when Yun line ; Jiang 31/8 Shi for and ChangLiang module YiZhi CanKao or Gai for CongChangLiang module DuQuHouDaYin ; JinZuoZhenDuan when not in Jiao this within XieHui config . 

---

## Er , d3utils/rosbot_flow/extension_flow_tick_step.py

### 2.1 ZhiZe and YueDing 

- ** purpose **: **Extension LiuChengZhuangTaiJi **, every 2s tick Zhi line Yi step ( no XianCheng , no time.sleep) ; by **rosbot_task + flow_master** QuDong , **flow_master_driver** in EXTENSION_TICK Jie segment Diao use . **extension_flow_tick_step(current_tick, start_rosbot_task_fn)** FanHui **"idle" | "running" | "success" | "fallthrough"**; process_task GenJuFanHuiZhiJueDing is Fou trigger_extension_rosbot_started, is Fou this Pai continue . Jie segment : ExtensionPhase (C_ENTRY C2 C_C3_LOOP C_C3_WAIT/DISCONFIRM C_C4_BRANCH C_C10_* C_C7a_* C_C7b_* reset_state + "success"/"fallthrough") . **start_extension_flow_c_branch()** in F0 to Chu c1 Qie has_d3 Qie bn_confirmed when by flow_master_driver Diao use , Jiang phase She for C_ENTRY. 
- ** YueDing **: this module ** not Du ** flow_master_enabled/bn_only ( conform to FLOW_STATE_OWNERSHIP_DESIGN) ; Jin " Zhi line Yi step and FanHuiJieGuo "; LiuChengFenZhi and Jie segment ShunXu by extension_flow_state and this WenDingYi , Diao use Fang (process_task) GenJuFanHuiZhiTuiJin ; not in Ci within GenJu flow_state Zuo " is FouZhi line " FenZhi . 

### 2.2 Yi by WuJie or GaiCuo Yuan because 

1. ** in Ci module within DuLiuChengKaiGuan **: if in extension_flow_tick_step within Du get_flow_master_enabled() JueDing is FouZhi line or FanHui , WeiFan " Qi it LeiKu no ZhuangTaiKaiGuan "; is FouDiao use this HanShu by process_task in EXTENSION_TICK QianYiJueDing . 
2. ** Jie segment ShunXu or FanHuiZhiBianGengWeiTong step **: if ZengShan ExtensionPhase or XiuGaiMou phase XiaYiJie segment , or Jiang "success" Gai for "ok" etc. , flow_master_driver in GenJu step_result PanDuanHuiCuo ; trigger_extension_rosbot_started etc. YiLai "success"/"fallthrough" YuYi . 
3. ** and extension_flow_state not Tong step **: phase, wait_ticks, deadline_tick, payload by extension_flow_state Chi have ; if this Wen and extension_flow_state phase MeiJu or MoRenZhi not YiZhi , HuiCuoXiang . 
4. **start_rosbot_task_fn Diao use when Ji **: Jin in C_C7b_TELEPORT ChengGongQie auto_start_rosbot when Diao use ; if TiQian or YanHouDiao use , or LouDiao , ROSBOT QiDong and LiuChengWenDang not Fu . 
5. **run_c12_end_d3 / reset_state**: DuoChuFenZhi in ShiBai or fallthrough when run_c12_end_d3() + reset_state() + return "fallthrough"; if LouDiao reset_state HuiDaoZhiXiaYiPai phase Reng for JiuZhi . 

### 2.3 ZhengQueZuoFa 

- not in Ci module Du flow_master/bn_only; Jie segment and FanHuiZhi and flow_master_driver, extension_flow_state, ROSBOT_FLOW WenDangYiZhi ; XiuGai phase or FanHuiZhi when Tong step process_task and WenDang ; start_rosbot_task_fn Jin in C_C7b_TELEPORT ChengGongQie config YunXu when Diao use ; Suo have fallthrough LuJingJun reset_state. 

---

## San , providor/i18n/i18n_auxiliary_panel_en.json

### 3.1 ZhiZe and YueDing 

- ** purpose **: ** FuZhuGongNeng panel ** XiangGuan ** YingWen ** WenAn . structure : **ui.auxiliary_functions.***, **ui.auxiliary_panel.*** ( Han combat_macro, assistant, blood_shard, quick_pickup, blacksmith, kanai_*, bag_offset, open_bag_adjust, debug_*, update_bag_offset_failed etc. ) , **ui.bag_offset.***. DaiMa in TongGuo get_ui_text("ui.auxiliary_panel.xxx") or "auxiliary_panel.xxx" ( Shi i18n_manager MingMingKongJianHe and FangShi ) QuWen ; auxiliary_functions_panel etc. use ui.auxiliary_panel.*. 
- ** YueDing **: key and DaiMa in get_ui_text Diao use YiZhi ; and i18n_auxiliary_panel_zh.json structure YiZhi ; newly added / ShanChu / GaiMing key XuTong step DaiMa and in WenDang . 

### 3.2 Yi by WuJie or GaiCuo Yuan because 

1. **key LuJing and DaiMa not YiZhi **: if DaiMa use ui.auxiliary_panel.bag_offset_title and JSON for ui.auxiliary_panel.bag_offset or bag_offset.title, HuiQu not to , XianShi key or HuiTuiMoRen . 
2. ** in YingWen key not Tong step **: if YingWenZeng key in WenWeiJia , or in WenGaiMingYingWenWeiGai , YuYanQieHuanHouQueYi or XianShi key. 
3. ** and auxiliary_functions_panel Yin use not YiZhi **: panel within DaLiang get_ui_text("ui.auxiliary_panel.xxx"); if JSON JiangBuFen key Fang in auxiliary_functions Xia and WeiTongYi , HuiBuFenQueYi . 
4. ** QianTao and BianPing **: JSON for QianTao (auxiliary_panel.blood_shard_enabled etc. ) ; if i18n_manager QiWangBianPing key ( such as ui.auxiliary_panel.blood_shard_enabled) , Xu and JiaZaiLuoJiYiZhi . 

### 3.3 ZhengQueZuoFa 

- FuZhu panel XiangGuanWenAn key and auxiliary_functions_panel and Suo have Yin use get_ui_text ChuYiZhi ; XiuGai key when Tong step DaiMa and i18n_auxiliary_panel_zh.json; BaoChi and i18n_manager MingMingKongJianYueDingYiZhi . 

---

## Si , and apology document GuanXi 

if CiQian because ShangShuRenYiDian ( such as debug_window_offset WeiXianCaiJi or LuJing / ChangLiang note and ShiJi not Fu , extension_flow_tick_step within DuLiuChengKaiGuan or Jie segment / FanHuiZhi and flow_master_driver not Tong step , i18n_auxiliary_panel_en key and DaiMa or zh not Tong step ) DaoZhiFanFuGaiCuo or understand PianCha , KeShi for WeiXianTongDuYueDingSuoZhi . this note YiXieRu cursor_AI_ apology directory , and in Cursor_ ZhuanShu apology document .md in ZengJia to this Wen Yin use . 
