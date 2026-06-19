# technical note : battlenet_ui_elements_asia_1.json, DESIGN_DETAIL.md, bn_flow_BN_LoginAsia.json, task_thread_manager.py, common.py

** Mu **: note CiWuChuWenJian / WenDang ZhiZe , Yi by WuJie or GaiCuo Yuan because , to and ZhengQueYueDing . bn_flow_BN_LoginAsia, DESIGN_DETAIL, common Yi in this directory Qi it technical note in BuFenShe and , CiChuHuiZongWuChuLianDong and YiCuoDian . 

** She and WenJian **: 
- `docs/battlenet_ui_elements_asia_1.json`
- `docs/DESIGN_DETAIL.md`
- `.cache/bn_flow_snapshots/bn_flow_BN_LoginAsia.json`
- `d3utils/task_thread_manager.py`
- `providor/constants/common.py`

---

## Yi , docs/battlenet_ui_elements_asia_1.json

### 1.1 ZhiZe and YueDing 

- ** purpose **: ZhanWangYaFuDengLuChuangKou **UI KongJianShuKuaiZhao ** ( YiCi dump WanZheng output ) . Han **timestamp**, **window_info** (hwnd, title, left/top/width/height, is_active etc. ) , **controls** ShuZu ( every item Han id, parent_id, type, name, automation_id, class_name, value, help_text, patterns, rect, is_enabled, is_visible, level) , **files** (screenshot, annotated_screenshot Jue to LuJing ) . and **.cache/bn_flow_snapshots/bn_flow_BN_LoginAsia.json** structure not Tong : this WenJian have id/parent_id, class_name, files; bn_flow_BN_LoginAsia have meta.node/meta.reason, controls no id/parent_id. 
- ** YueDing **: XiaoFeiFang if An "battlenet_ui_elements_asia_*" JieXiXu use id/parent_id Shu and rect; if An automation_id ChaZhaoXu and common.py ASIA_LOGIN_*_AUTOMATION_IDS, LOGIN_WINDOW_AUTOMATION_ID_MARKERS_ASIA YiZhi ; files in LuJing for Jue to LuJing , KuaHuanJingYin use XuGaiXiang to or Zhan position ; rect and window_info BianJieYiZhi , if have KongJian rect ChaoChuChuangKouXuCaiJian or JiaoYan . 

### 1.2 Yi by WuJie or GaiCuo Yuan because 

1. ** and bn_flow_BN_LoginAsia HunXiao **: Gou B garbage Cursor KeNengJiangLiangWenJianShi for TongYi structure , GaiQiYiWeiQuFen id/parent_id and meta.node/reason, controls GeShiChaYi , DaoZhiJieXi or operate_by_spec use Cuo structure . 
2. **automation_id and common.py not Tong step **: password, submit, login-wrapper, login-header etc. if in common.py ASIA_LOGIN_* or LOGIN_WINDOW_AUTOMATION_ID_MARKERS_ASIA in GaiMing or ZengShan , this KuaiZhao and DaiMaChaZhaoHuiCuo position . 
3. **files LuJingKeYiZhiXing **: screenshot/annotated_screenshot for Jue to LuJing ( such as C:\Users\...\\.core_node\\.d3check\\.cache\\...) , if DaiMa or WenDangDangXiang to LuJing use Hui in Qi it JiQiShiBai . 

### 1.3 ZhengQueZuoFa 

- XiuGai this WenJian or ShengChengGongJu when QuFen "docs Xia UI dump" and ".cache/bn_flow_snapshots Xia BN JieDianKuaiZhao " LiangTao structure ; automation_id/name and common.py ASIA_LOGIN_*, LOGIN_WINDOW_AUTOMATION_ID_MARKERS_ASIA Tong step ; files LuJing if XuKeYiZhiZeGai for Xiang to or config Hua . 

---

## Er , docs/DESIGN_DETAIL.md

### 2.1 ZhiZe and YueDing 

- ** purpose **: ** XiangXiSheJi **, and DESIGN.md He use ; CeZhong **Login Try** and ** ZhanWangDuanXianChongQi **. ChuFa : log Han trigger (config Jian log_detection.login_try, MoRen config.constants.LOGIN_TRY_TRIGGER_DEFAULT) ; LiuCheng : Du config (battlenet_path) JieTuZhanWangChuangKou (screenshot_provider, BATTLE_NET_WINDOW_TITLES, LOGIN_TRY_SCREENSHOT_DIR) OCR DuanXianGuanJianCi (BATTLE_NET_DISCONNECT_KEYWORDS) if DuanXianZe taskkill Battle.net.exe etc. Yue 2 Miao explorer QiDong exe_path. 
- ** YueDing **: ShiXianXu and WenDangYiZhi : log_monitorlog_analyzerget_login_try_screenshot_controller().handle_login_try(); CONFIG["battlenet"]["battlenet_path"], LOGIN_TRY_SCREENSHOT_DIR, BATTLE_NET_DISCONNECT_KEYWORDS LaiZi common.py or config, GaiChangLiang or config JianXuTong step this WenDang ; WenDangXieMing "no Python threads" ZhiGaiLiuCheng this ShenShunXuZhi line , FeiZhiXiTong no XianCheng . 

### 2.2 Yi by WuJie or GaiCuo Yuan because 

1. ** and DESIGN.md FenGongHunXiao **: DESIGN_DETAIL ZhiXie Login Try and ZhanWangChongQi ; ZongLan , module Biao in DESIGN.md; if ZhiGai this DangWeiGai DESIGN.md ( or Fan of ) HuiWenDangFenCha . 
2. ** ChangLiang and ShiXianTuoJie **: if Gai common.py LOGIN_TRY_TRIGGER_DEFAULT, LOGIN_TRY_SCREENSHOT_DIR, BATTLE_NET_DISCONNECT_KEYWORDS or CONFIG JianWeiGengXin DESIGN_DETAIL, HuiWenDang and DaiMa not Fu . 
3. **handle_login_try LiuChengBianGengWeiTong step **: if DiaoHuanJieTu /OCR/kill/start ShunXu or ZengShan step WeiGengXinWenDang , HuiWeiHuZheAnWenDangDuCuo . 

### 2.3 ZhengQueZuoFa 

- ShiXian Login Try and ZhanWangChongQi to DESIGN_DETAIL for Zhun ; GaiChuFa , LiuCheng , ChangLiang when Tong step GengXin this Dang ; BaoChi log_analyzer, LoginTryScreenshotController, constants, screenshot_provider and WenDangMiaoShuYiZhi . XiangJian technical note _obsolete_click_handler and ROSBOT_FLOW and i18n_log_panel and DESIGN_DETAIL.md, technical note _bn_flow_B6 and d4_controller and square_sampler and DESIGN_DETAIL.md. 

---

## San , .cache/bn_flow_snapshots/bn_flow_BN_LoginAsia.json

### 3.1 ZhiZe and YueDing ( abstract ) 

- ** purpose **: BN LiuChengJieDian **BN_LoginAsia** KuaiZhao ; meta.node=BN_LoginAsia, reason=asia_login; controls ShuZu for name, automation_id, type, rect, level ( no id/parent_id) . and docs/battlenet_ui_elements_asia_1.json for not TongChanChu : this WenJian for BN LiuJieDianKuaiZhao , HouZhe for WanZheng UI dump. 
- ** YueDing **: meta.node and BN JieDianMingMingYiZhi ; controls and operate_by_spec, common.py ASIA_LOGIN_*, LOGIN_WINDOW_AUTOMATION_ID_MARKERS_ASIA YiZhi ; Wu and battlenet_ui_elements_asia_1 structure Hun use . 

### 3.2 Yi by WuJie or GaiCuo Yuan because 

1. ** and battlenet_ui_elements_asia_1 structure Hun use **: this WenJian no id/parent_id, no files; if An battlenet_ui_elements_asia_1 id or class_name JieXiHui KeyError or LuoJiCuo . 
2. **rect or automation_id and common.py not Tong step **: ASIA_LOGIN_PASSWORD_AUTOMATION_IDS, ASIA_LOGIN_SUBMIT_AUTOMATION_IDS, LOGIN_WINDOW_AUTOMATION_ID_MARKERS_ASIA etc. if Gai , this KuaiZhao and battlenet LiuChengChaZhaoHuiCuo . 

### 3.3 ZhengQueZuoFa 

- XiangJian technical note _screenshot_categories and ROSBOT_FIND_LOGIC_LIST and bn_flow_BN_LoginAsia and OCR_CNSTD and kanai_cube_handler.md No. SanJie , technical note _test_menu and color_region_detector and bn_flow_BN_LoginAsia and ROSBOT_FLOW_STEP_INDEX.md No. SanJie ; XiuGai meta or controls Qian confirm XiaoFeiFang ; and battlenet_ui_elements_asia_1 QuFenLiangTao structure . 

---

## Si , d3utils/task_thread_manager.py

### 4.1 ZhiZe and YueDing 

- ** purpose **: ** HouTaiRenWuXianChengGuanLi **, for ROSBOT etc. RenWuTiGongFeiZuSe API. **TaskThreadManager**: register_task(name, task_func, interval), start_task/stop_task/set_task_status/set_task_interval, start_all/stop_all; ** Suo have public API FeiZuSe ** (fire-and-forget, _fire RuDui , result_q for None) ; ZhuangTaiDuQu use **get_task_status(name)** Cong **_status_snapshot** Qu , FeiZhiJieDu task.status (worker in _worker_loop in _update_snapshot) . **TaskThread**: daemon XianCheng , status for DISABLED/ENABLED/RUNNING/ERROR; run() JinDang status==ENABLED QieJianGe to when Zhi line task_func; stop() Jin set stop_event, not join. 
- ** YueDing **: A2 global 1s timer i.e. rosbot_task ZhuCe interval=1.0; not in public API in ZuSe ( such as get() etc. result) ; not in YeWuXianChengZhiJieDu task.status, Xu use get_task_status; worker within Chuan line ChuLiMingLing , MingLing and _update_snapshot ShunXu not Bian . 

### 4.2 Yi by WuJie or GaiCuo Yuan because 

1. ** ZuSeDiao use **: if in register_task/start_task etc. HouJia result_q.get() or join() HuiPoHuai "non-blocking" YueDing , and docs/THREAD_BUS_AND_REGISTRY not Fu . 
2. ** KuaXianChengDu task.status**: if in YeWuDaiMaZhiJieDu self.tasks[name].status and WeiTongGuo get_task_status (_status_snapshot) , HuiCun in KeJianXing / JingTai . 
3. ** and timer_manager HunXiao **: timer_manager for DanXianChengXunHuan ( Jin log_monitor etc. ) ; task_thread_manager for every RenWuYiXianCheng ; if in CiZhuCe state detection or HunXiaoLiangZheHui and system_initializer, FLOW_IMPLEMENTATION_PROGRESS not Fu . 
4. **interval and A2 YueDing **: rosbot_task for 1s QuDong , flow master when process_task every 2s etc. by process_task within BuKongZhi ; if WuGai interval or in CiShiXian 2s Hui and flow YueDingCuo . 

### 4.3 ZhengQueZuoFa 

- XiuGaiQianDu docs/THREAD_BUS_AND_REGISTRY.md and technical note _system_initializer and rosbot_task_registry and FLOW_IMPLEMENTATION_PROGRESS and log_panel.md; BaoChiSuo have public API FeiZuSe ; ZhuangTaiJinJing get_task_status Du _status_snapshot; Wu in CiZhuCe state detection; A2 1s by interval=1.0 BaoZheng . 

---

## Wu , providor/constants/common.py

### 5.1 ZhiZe and YueDing 

- ** purpose **: ** Tong use ChangLiang ** ( no D3_*, D4_* QianZhui ) . **_ROOT_PATH** = Path(__file__).resolve().parent.parent.parent = **pyapps/d3-check**; **TMP_DIR** = Path.home()/.core_node/pytools/tmp; LOGIN_TRY_*, BATTLE_NET_*, ASIA_LOGIN_*, BN_FLOW_*, BATTLE_NET_DISCONNECT_KEYWORDS, LOGIN_WINDOW_AUTOMATION_ID_MARKERS_ASIA etc. ; **BN_FLOW_SNAPSHOTS_DIR** = _ROOT_PATH/.cache/bn_flow_snapshots; DEBUG_SAVE_BN_FLOW_UI_SNAPSHOTS; CMD_*; DEFAULT_INTERVAL etc. . 
- ** YueDing **: _ROOT_PATH YiLai __file__ in providor/constants/common.py XiaGongSanCeng parent, WenJianYiDongXuTong step ; TMP_DIR, LOGIN_TRY_SCREENSHOT_DIR etc. and DESIGN_DETAIL, LoginTryScreenshotController YiZhi ; ASIA_LOGIN_*, LOGIN_WINDOW_AUTOMATION_ID_MARKERS_ASIA and battlenet_ui_elements_asia_1, bn_flow_BN_LoginAsia automation_id/name YiZhi ; BN_FLOW_SNAPSHOTS_DIR and .cache/bn_flow_snapshots XiaoFeiZheYiZhi ; Wu in CiDingYi D3_*, D4_* ( Shu providor/constants/d4.py) . 

### 5.2 Yi by WuJie or GaiCuo Yuan because 

1. **_ROOT_PATH CengShu **: if WenJianYiDong or parent CiShuGaiCuo , ROOT_DIR, TMP_DIR, BN_FLOW_SNAPSHOTS_DIR, TAMPERMONKEY_SCRIPT_PATH etc. QuanCuo . 
2. **LOGIN_TRY / BATTLE_NET / ASIA_LOGIN and DESIGN_DETAIL / KuaiZhao not Tong step **: GaiGuanJianCi or automation_id WeiTong step DESIGN_DETAIL, battlenet_ui_elements_asia_1, bn_flow_BN_LoginAsia HuiJianCe or DianJiCuo . 
3. **BN_FLOW_SNAPSHOTS_DIR and .cache XiaoFeiZhe **: if Gai for it LuJingWeiTong step BaoCun / JiaZaiKuaiZhao DaiMaHuiZhao not to WenJian . 
4. **D3_* / D4_* WuFang **: if in common in DingYi D4_* Hui and providor/constants/d4.py FenGongChongTu . 

### 5.3 ZhengQueZuoFa 

- XiuGai _ROOT_PATH or LuJingChangLiang when confirm Suo have Yin use Fang ; XiuGai LOGIN_TRY_*, BATTLE_NET_*, ASIA_LOGIN_* when Tong step DESIGN_DETAIL, battlenet KuaiZhao and operate_by_spec; D3_*, D4_* JinFang in d4.py; BN_FLOW_SNAPSHOTS_DIR and .cache/bn_flow_snapshots YiZhi . 

---

## Liu , WuChuLianDong and YiCuo summary 

- **battlenet_ui_elements_asia_1.json** and **bn_flow_BN_LoginAsia.json** structure not Tong (id/parent_id/files vs meta.node/reason) , WuHun use ; LiangZhe automation_id/name Xu and **common.py** ASIA_LOGIN_*, LOGIN_WINDOW_AUTOMATION_ID_MARKERS_ASIA YiZhi . 
- **DESIGN_DETAIL.md** MiaoShu Login Try and ZhanWangChongQiLiuCheng , Suo use ChangLiang (LOGIN_TRY_*, BATTLE_NET_DISCONNECT_KEYWORDS, battlenet_path) LaiZi **common.py** or config; Gai common or ShiXianXuTong step DESIGN_DETAIL. 
- **task_thread_manager.py** for A2 1s QuDongTiGongXianCheng and FeiZuSe API; and timer_manager dual QuDong , WuHunXiao ; get_task_status Du _status_snapshot, WuKuaXianChengZhiDu task.status. 
- **common.py** for WuChuChangLiang of Yuan : _ROOT_PATH, TMP_DIR, BN_FLOW_SNAPSHOTS_DIR, LOGIN_TRY_*, BATTLE_NET_*, ASIA_LOGIN_*; GaiRenYi item XuJianCha DESIGN_DETAIL, battlenet KuaiZhao , task_thread_manager ZhuCeJianGe and WenDang . 

CiQian if because WeiXianTongDuShangShuYueDing and in CiWuChuFanFuGaiCuo or understand PianCha , the responsibility lies with the dog B garbage Cursor. HouXuXiuGaiQian to this note for Zhun . 
