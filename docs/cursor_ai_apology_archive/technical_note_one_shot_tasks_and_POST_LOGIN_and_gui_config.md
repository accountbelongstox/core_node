# technical note : one_shot_tasks, POST_LOGIN_BATTLENET_CONTROLS, gui_config

** Mu **: note this SanChuDaiMa / WenDang ZhiZe , Yi by WuJie or GaiCuo Yuan because , to and ZhengQueYueDing . 

** She and WenJian **: 
- `timers/one_shot_tasks.py`
- `docs/POST_LOGIN_BATTLENET_CONTROLS.md`
- `config/gui_config.json`

---

## Yi , timers/one_shot_tasks.py

### 1.1 ZhiZe and YueDing 

- ** Yun line FangShi **: Suo have HanShuTongGuo `timer_manager.submit_one_shot()` in ** Ding when QiXianCheng ** in Zhi line , not XinJianXianCheng ; Zhang when JianZuSeHuiZhanManGaiXianCheng . 
- **UI HuiDiao **: XuGengXin UI when use `panel.container.after(0, lambda: ...)` Hui to ZhuXianCheng ; HuiDiaoQian if panel Yi destroy or generation YiGuoQi , HuiDaoZhiHuiDiao to no XiaoKongJian or ShanPing . 
- ** ZhuYaoRuKou **: 
- `do_path_scan(panel, include_rosbot)`: LuJingSaoMiao , JieGuoTongGuo `panel._apply_scan_results(bn, ros, d3)` HuiZhuXianCheng . 
- `do_login_check(panel, login_check_fn, generation)`: DengLuJianCha , JieGuoTongGuo `panel._on_login_check_done(result, err, generation=gen)` HuiZhuXianCheng ; generation use at HuLveGuoQiHuiDiao . 
- `do_start_d3()`: Diao `ensure_battlenet_started_and_login_check()`, no UI HuiDiao , within BuKeNengZhang when JianZuSe . 
- `do_ensure_d3_running_from_battlenet_no_rosbot()`: Diao `ensure_d3_running_from_battlenet_no_rosbot()`, no UI HuiDiao . 
- `do_battlenet_only_check(panel)`: Diao `ensure_battlenet_only()`, JieGuoTongGuo `panel._on_battlenet_only_done(r, e)` HuiZhuXianCheng . 
- `do_window_monitor_initial_check()`: Diao `run_full_status_refresh()` + `window_monitor.notify_window_callbacks(d3_info)`, Dai 3 Miao debounce. 
- `do_rosbot_update(panel)`: E block E1E6 (kill, sleep, config, start, E5a wait, E6) , WanChengHou `_rosbot_update_done` ShuaXinZhuangTai and `panel._update_control_button`. 
- `do_rosbot_debug(panel)`, `do_battlenet_ui_analyze(panel)` etc. : YiLai `panel.container.after(0, ...)` and debounce/busy module JiBianLiang . 
- **Debounce / and Fa **: `_last_rosdebug_f7_at`, `_rosdebug_running_busy`, `_WINDOW_MONITOR_INITIAL_LAST_RUN` for module JiBianLiang ; DuoXianChengXiaFeiYuan sub , if in HuiDiao or Qi it XianCheng in GaiXieKeNengJingTai . 

### 1.2 Yi by WuJie or GaiCuo Yuan because 

1. ** in one_shot LiZhiJieCaoZuo UI**: in Ding when QiXianCheng in Chu `panel.container.after(0, ...)` Wai not YingZhiJieGai Tk KongJian ; if ZhiJieGaiHuiDaoZhiKuaXianChengFangWen Tk, BengKui or WeiDingYi line for . 
2. ** HuLve generation or panel have XiaoXing **: `do_login_check` generation use at FangZhi stale HuiDiao ; if ShanChu or WeiChuanRu , KeNengBaJieGuoYing use to YiQieHuan JieMian . HuiDiaoQianWeiJianCha `panel.container.winfo_exists()` or generation HuiShanPing or BaoCuo . 
3. ** Zhang when Jian ensure_* in one_shot in Zhi line **: `do_start_d3`, `do_ensure_d3_running_from_battlenet_no_rosbot` Diao use ensure_* within HanDaLiang time.sleep and LunXun ; in submit_one_shot TongYiXianChengZhi line HuiZuSeGaiXianChengZhi to WanCheng , Qi it one_shot RenWu by TuiChi . if WuJiang ensure ChaiChengDuo segment one_shot QieYiLaiShunXu , RongYiLuanXu or ChongFuZhi line . 
4. ** XiuGai E block ShunXu or TiaoGuo step **: `do_rosbot_update` YanGeAn E1E2E3E4E5E5aE6; if for " YouHua " TiaoGuo E2 sleep or DiaoHuan E3/E4, Hui and ROSBOT_FLOW_MERMAID E block not YiZhi or DaoZhiQiDong not WenDing . 
5. **Debounce / busy WeiBaoHu **: if DuoChuTong when ChuFa do_rosbot_debug or do_window_monitor_initial_check, module Ji debounce and busy KeNeng by and FaXie ; Ying use threading.Lock or DanXianChengYueDing , FouZeYiChongFuFa F7 or ChongFuShuaXin . 
6. **Battle.net UI DaoChuLuJing and docs WenDang **: `do_battlenet_ui_analyze` Xie docs for `battlenet_ui_elements[_asia|_cn]_N.json`; if docs CeWenDang ( such as POST_LOGIN_BATTLENET_CONTROLS.md) Yin use JSON Ming or LuJing and DaiMa not YiZhi , HuiWuDaoHouXuShiXian . 

### 1.3 ZhengQueZuoFa 

- Suo have UI GengXinYiLvTongGuo `panel.container.after(0, ...)`, QieHuiDiao within JianCha panel have XiaoXing and generation ( if Shi use ) . 
- Zhang when Jian ensure if BiXuBaoLiu in one_shot in , Xu in WenDang in ZhuMing " HuiZuSeDing when QiXianCheng "; or KaoLvDanDuXianCheng / DuiLie , BiMian and Qi it one_shot Zheng use . 
- E block ShunXu and ROSBOT_FLOW_MERMAID YiZhi , not ShanZiTiaoGuo or DiaoHuan . 
- to debounce, busy etc. module JiZhuangTai , if Cun in DuoXianChengDiao use KeNeng , JiaSuo or MingQue " DanXianChengDiao use " YueDing and WenDangHua . 

---

## Er , docs/POST_LOGIN_BATTLENET_CONTROLS.md

### 2.1 ZhiZe and YueDing 

- ** ShuJuLaiYuan **: DaoChuZi Battle.net UI Automation, FuZhi to `docs/ DengLuHou ZhanWangYuanSu .json` ( or Tong directory Xia battlenet_ui_elements_*.json) . 
- ** WenDang within Rong **: LieChuDangQian use KongJian (automation_id, name/type) , LuoJi ( such as Playing Now, is_enabled) , to and DaiShiXian item ( XieYiGouXuan , DengLuAnNiu , is Fou in DengLuYe etc. ) . 
- ** and DaiMa to Ying **: BattlenetOperation or ZhanWangXiangGuanDianJi / PanDuanLuoJiYing use and this WenDangYiZhi automation_id, name char FuChuan ; if JSON DaoChu or UI Ban this BianHua , XuTong step GengXin this WenDang and DaiMa . 

### 2.2 Yi by WuJie or GaiCuo Yuan because 

1. ** DaiMa and WenDang not YiZhi **: if DaiMa in hardcode `play-btn-main`, `game-nav-btn-D3CN` etc. , and WenDang or JSON YiGai for Qi it id/name, or Fan of ZhiGai WenDangWeiGaiDaiMa , HuiDaoZhi " WenDangShuo A, DaiMa use B", ZhanWangCaoZuoShiBai or DianCuoKongJian . 
2. ** Ba " DaiShiXian " DangYiShiXian **: WenDang in "To implement" LieChu agreement, login screen, already logged in etc. if ShangWei in DaiMa in ShiXian , not Ying in LuoJiLiJiaSheYiCun in ; FouZeHuiLouPan or WuPanDengLuZhuangTai . 
3. ** HuLveQuYu / YuYan **: POST_LOGIN WenDangWeiQuFen asia/cn when , if DaiMaAn asia automation_id hardcode , in cn KeHuDuanKeNeng to not Shang ; one_shot_tasks in `_battlenet_docs_basename_with_region()` YiAn region QuFen JSON WenJianMing , WenDang if Yin use JuTi JSON Xu and region to Ying . 
4. **JSON LuJing and WenDangMiaoShu not Fu **: WenDangXie " FuZhi to docs/ DengLuHou ZhanWangYuanSu .json", and one_shot_tasks ShiJiXie docs for `battlenet_ui_elements_*.json`; if HouXuShiXianCong " DengLuHou ZhanWangYuanSu " Du config , XuTongYiLuJing or note LiangZheGuanXi . 

### 2.3 ZhengQueZuoFa 

- XiuGaiZhanWang UI XiangGuan automation_id, name, LuoJi when , Tong when GengXin this WenDang and DaiMa ; newly added KongJian or LuoJi when in WenDang in BuChong and BiaoZhu is FouYiShiXian . 
- Cong JSON DuKongJianLieBiao when , use and one_shot_tasks DaoChuYiZhi LuJing / MingMing ( or WenDang in MingQue " ShuJuLaiYuan " and " DaiMaDuQuLuJing " to YingGuanXi ) . 
- QuYu / YuYanXiangGuanChaYi in WenDang in ZhuMing , DaiMa in An region FenZhi when and WenDangYiZhi . 

---

## San , config/gui_config.json

### 3.1 ZhiZe and YueDing 

- ** purpose **: GUI and QiDongFangShi config ; DangQian structure BaoHan `gui` (enabled, type, web_frontend, http_bridge, system_tray) , `legacy_ui` (enabled, type) . 
- ** DuQuFang **: ZhuChengXu or QiDongLuoJiTongGuoGaiWenJianJueDing is FouQi web QianDuan , http_bridge, XiTongTuoPan , is FouQi legacy tkinter UI; JianLuJing such as `gui.enabled`, `gui.web_frontend.port`, `gui.http_bridge.port`, `legacy_ui.enabled` etc. . 
- ** YueDing **: JSON JianMing and CengJi if by ZhongMingMing or YiDong , Suo have DuQuGai config DaiMaBiXuTong step XiuGai , FouZeQiDongShiBai or line for YiChang . 

### 3.2 Yi by WuJie or GaiCuo Yuan because 

1. ** ZhiGai JSON not GaiDaiMa **: if Jiang `gui.web_frontend` Gai for `web_ui` or Ba `port` Ti to DingCeng , and DaiMaRengDu `gui.web_frontend.port`, HuiDu not to or Du to CuoWuLeiXing . 
2. ** ZhiGaiDaiMa not Gai JSON**: if DaiMaGai for Du `gui.legacy_ui.enabled` and JSON Reng for `legacy_ui.enabled`, HuiDaoZhi config not ShengXiao or KeyError. 
3. ** LeiXing not YiZhi **: JSON in `enabled` for true/false, if DaiMa use char FuChuan `"true"` or 0/1 PanDuan , KeNengWuPan ; YingTongYi for bool or MingQueZhuanHuanGuiZe . 
4. ** newly added JianWeiWenDangHua **: if in JSON in newly added Jian ( such as `gui.web_frontend.host`) , Wei in WenDang or MoRenZhi in note , Qi it HuanJingWeiPeiGaiJian when KeNengYiLaiShiXian " QueSheng line for ", RongYi not YiZhi . 

### 3.3 ZhengQueZuoFa 

- XiuGai config JianMing or CengJi when , QuanJuSouSuoDuQu gui_config DaiMa and Yi and XiuGai ; BiYao when TiGongQianYi note or MoRenZhi . 
- config item LeiXing (bool, int, string) and DaiMa use ChuYiZhi ; newly added Jian in WenDang or ZhuShi in note purpose and MoRenZhi . 

---

## Si , and apology document GuanXi 

if CiQian because ShangShuRenYiDian ( such as one_shot in ZhiJieGai UI, HuLve generation, E block ShunXu by Gai , POST_LOGIN WenDang and DaiMa not YiZhi , gui_config JianMing and DaiMa not Tong step ) DaoZhiFanFuGaiCuo or understand PianCha , KeShi for ShiXian and YueDing not YiZhiSuoZhi . this note YiXieRu `cursor_AI_ apology directory `, and in `Cursor_ ZhuanShu apology document .md` in ZengJia to this Wen Yin use , Bian at HouXuXiuGaiQianXianChaCiChuYueDing . 
