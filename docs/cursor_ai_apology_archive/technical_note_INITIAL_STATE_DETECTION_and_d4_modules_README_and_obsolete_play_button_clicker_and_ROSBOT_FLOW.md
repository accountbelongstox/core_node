# technical note : INITIAL_STATE_DETECTION, d4_modules/README, _obsolete_play_button_clicker, ROSBOT_FLOW_C_BLOCK_DOC_VS_CODE, bn_flow_B9

** Mu **: note CiWuChuWenDang / directory / DaiMa / HuanCun ZhiZe , Yi by WuJie or GaiCuo Yuan because , to and ZhengQueYueDing . 

** She and WenJian **: 
- `docs/INITIAL_STATE_DETECTION.md`
- `d4_modules/README.md`
- `utils/_obsolete_play_button_clicker.py`
- `docs/ROSBOT_FLOW_C_BLOCK_DOC_VS_CODE.md`
- `.cache/bn_flow_snapshots/bn_flow_B9.json`

---

## Yi , docs/INITIAL_STATE_DETECTION.md

### 1.1 ZhiZe and YueDing 

- ** purpose **: GuiDing ** Ying use QiDong when ** ** ChuShiZhuangTaiJianCe **: JinZuoJianCe , ** not QuDongLiuCheng ** ( not Diao tick_bn_only_flow, tick_flow_master) . KeFu use RuKou for **run_full_status_refresh()** (d3utils/rosbot_task_processor.py) , Zhi line Battle.net ( HanYaFu / GuoFu ) + D3 + ROSBOT JianCe and notify_state_sync, ** not Zuo flow JianCha **. LiuCheng : UI ready Controller Diao get_thread_registry().start_timer_loop_after_ui_ready() ( in ui.run() Qian ) **start_timer_loop_after_ui_ready() Xian in ZhuXianChengTong step Zhi line do_window_monitor_initial_check()** ZaiQiDong timer and submit_one_shot(do_window_monitor_initial_check); do_window_monitor_initial_check (timers/one_shot_tasks.py) ** ZhiDiao run_full_status_refresh()** ( Cong not Diao check_window()) , Gu not Shou is_flow_active() YingXiang ; notify_state_sync TuiSong game_interface_data to HuiDiao , DiLanTongGuo window_monitor.register_status_ui ZhuCeGuShou to ZhuangTai and GengXinZhanWang /ROS/D3/ Tu / Jie segment / ChuangKouChiCun etc. . 
- ** YueDing **: ChuShiJianCe and 2s tick LiuChengQuDongFenLi ; process_task() Jin in flow JiHuo when Diao tick_*, not use at CiCiChuShiJianCe ; GaiChuShiJianCeLuoJiXuBaoChi " ZhuXianChengXianPaoYiCi do_window_monitor_initial_check, ZaiQiDong timer" ShunXu , FouZeShouZhenKeNeng no ZhuangTai . 

### 1.2 Yi by WuJie or GaiCuo Yuan because 

1. ** Wu in ChuShiJianCe in Diao tick**: if in do_window_monitor_initial_check or run_full_status_refresh within Diao tick_bn_only_flow/tick_flow_master, HuiWeiFan " JianCeJin , not QuDongLiuCheng " YueDing . 
2. ** Wu use check_window()**: WenDangMingQue do_window_monitor_initial_check ZhiDiao run_full_status_refresh(), Cong not check_window(); if GaiCheng check_window() HuiShou is_flow_active() YingXiang , QiDong when flow WeiKaiZeKeNeng not Zhi line . 
3. ** ZhuXianChengShunXu **: if XianQiDong timer ZaiPao do_window_monitor_initial_check, ShouZhenKeNengShangWeiShou to notify_state_sync, DiLanHuiDuanZan no ShuJu . 
4. ** WenDang and DaiMa not Tong step **: if rosbot_task_processor, one_shot_tasks, thread_registry, window_monitor_timer FuHao or Diao use LianBianGeng , WenDang in Code locations BiaoWeiGengXinHuiDaoZhi to ZhaoCuo . 

### 1.3 ZhengQueZuoFa 

- ChuShiJianCeJin use run_full_status_refresh(), not Diao tick; do_window_monitor_initial_check ZhiDiao run_full_status_refresh + window callbacks; BaoChi start_timer_loop_after_ui_ready within " XianZhuXianCheng do_window_monitor_initial_check, Zai timer + one_shot"; WenDangBiao and DaiMaTong step GengXin . 

---

## Er , d4_modules/README.md

### 2.1 ZhiZe and YueDing 

- ** purpose **: **D4 XunLianMoXing directory ** note . structure : model_registry.json, <model_name>_detector.pt, <model_name>_detector.json; model_registry.json Han registry_version, models ShuZu (model_name, model_file, category, type, classes, img_size, samples, training_info, trained_at) . XunLianLiuCheng : ShuJuFang in .cache/training_data/source/<project>/yes|no; train_all.py or train_progressbar.py XunLian ; MoXingCun d4_modules/; YanZheng use validate_models.py --image; YanZheng output to .core_node/pytools/tmp/model_validation/. MoXing for ErFenLei (no/yes) , YOLOv8 FenLei , 80/20 HuaFen . 
- ** YueDing **: DaiMaJiaZaiMoXing when Cong d4_modules/model_registry.json Du models, use model_file LuJingJiaZai ; XunLianShuJuLuJing and README YiZhi ; if model_registry structure or key BianGeng , XiaoFeiDaiMaXuTong step ; validate_models --stride, --confidence, --output etc. and WenDangYiZhi . 

### 2.2 Yi by WuJie or GaiCuo Yuan because 

1. **model_registry structure BianGeng **: if ZengJia or ShanChu registry DingCeng key or models item structure , WeiTong step README or JiaZaiDaiMaHui KeyError or JieXiCuo . 
2. ** LuJingJiaShe **: README in YanZheng output LuJing for C:\Users\<username>\.core_node\pytools\tmp\model_validation\, if project or HuanJing not TongHuiXieCuo directory . 
3. ** XunLianShuJuLuJing **: if .cache/training_data/source/ or yes/no sub directory YueDingBianGeng , train_all SaoMiaoHuiLou or Cuo . 
4. ** ErFenLei and classes**: DaiMa if JiaDing classes for ["no","yes"] Qie class_id 1 for yes, and README YiZhi ; if README or XunLianJiao this Gai classes ShunXuWeiTong step reasoning DaiMaHuiFan . 

### 2.3 ZhengQueZuoFa 

- XiuGai model_registry structure or models item when Tong step README and JiaZaiFang ; XunLian and YanZhengLuJing to README for Zhun or config Hua ; classes and class_id YueDing and XunLianJiao this , reasoning DaiMaYiZhi . 

---

## San , utils/_obsolete_play_button_clicker.py

### 3.1 ZhiZe and YueDing 

- ** purpose **: ** YiFeiQi ** (_obsolete_ QianZhui ) . PlayButtonClicker use **uiautomation**, **providor.providor_second.PLAY_BUTTON_AUTOMATION_IDS** in ZhanWangJieMianZhao Play AnNiu and DianJi ; YiLai **utils.color_print** ( project spec Duo for pycore ColorPrint) ; current_dir for utils Fu directory ( i.e. project Gen ) ; DiGuiShenDu 10, win32api SetCursorPos and play_button.Click(). ** not Ying by XinDaiMa or Xian have LiuChengYin use **; ZhanWang Play DianJiYing by DangQianYueDingShiXian ( such as share/battlenet or d3utils within TongYiRuKou ) . 
- ** YueDing **: not in CiWenJianKuoZhan ; not Jiang this module as " Dian Play AnNiu " TuiJianShiXian ; if Xu Play DianJiLuoJi , Ying use project within DangQianYueDingFangAn ; ShanChuQian confirm no Yin use . 

### 3.2 Yi by WuJie or GaiCuo Yuan because 

1. ** WuDangKe use GongJu **: WeiZhuYi _obsolete_ QianZhui and in Ci module ShangKaiFa or in XinLiuCheng in import, HuiYinRu uiautomation, providor_second, utils.color_print etc. YiQi use or and spec not Fu YiLai . 
2. **utils.color_print**: project DuoCong pycore use ColorPrint, if utils Xia no color_print or YiGai for _obsolete_color_print, Hui ImportError. 
3. **PLAY_BUTTON_AUTOMATION_IDS**: if providor_second YiChu or ChangLiangQianYi , this WenJianHuiBaoCuo ; and DangQianZhanWangKongJianYueDingKeNeng not YiZhi . 
4. ** and INITIAL_STATE / flow no Guan **: ChuShiJianCe and LiuChengQuDongJun not YiLai this WenJian ; WuYin use Hui and ROSBOT_FLOW, ZhanWangLiuChengSheJiTuoJie . 

### 3.3 ZhengQueZuoFa 

- Shi this WenJian for ZhiDuLiShiCanKao , not newly added YiLai , not in XinDaiMa in import; Play DianJiXuQiu to project Xian have ZhanWang / LiuChengRuKou for Zhun ; ShanChuQianQuanJuSouSuo and confirm no Yin use . 

---

## Si , docs/ROSBOT_FLOW_C_BLOCK_DOC_VS_CODE.md

### 4.1 ZhiZe and YueDing 

- ** purpose **: **ROSBOT_FLOW_MERMAID in C block ** (C D3 YiYun line ZhiLian ) ** WenDang and DaiMa 1:1 to Zhao **. YuanZe : Jin to WenDang char Mian for Zhun . within Rong : C1 RuKou , C2 SuoFang , C3 JiePingShiTu and C3_Result GeChuBian , C3w, C5 DianJiKaiShiYouXi , C5w etc. to game_tool or Chao when , C12 JieShu D3 Jin D; Chao when YueDing (C3/C3w 1 minutes , CongJinRu C3 XunHuanQi , JianCe to start ZeDianJi and ZhongZhi 1 minutes ; C5w Chao when WenDangWeiXieJuTi when Zhang , DaiMa for 52 Miao ) ; ** WenDangMingQue "d3_connecting/d3_connecting_alt continue wait" JinChuXian in C3, not Shi use at C5w**; every JieDian to Ying unique DaiMa position Zhi (C1=run_c1_entry, C2=run_c2_resize, C12=run_c12_end_d3 etc. ) . 
- ** YueDing **: Gai C block LuoJiXuXian to Zhao this WenDang and flow_c_d3_direct, d3_start_game_and_teleport_waiter etc. ShiXian , BaoChi 1:1; if Yao in C5w within to connecting ZuoYanChang etc. Dai , Xu ** Xian in WenDang in BuChong C5w item Kuan ** ZaiGaiDaiMa ; C10 JinPanDiaoXian (M QianHouJieTu to Bi ) , C7 for ChuanSongQianQueBao TuDaKai , LiangTaoLuoJiFenLi , not KeHunXiao . 

### 4.2 Yi by WuJie or GaiCuo Yuan because 

1. ** in C5w within Jia connecting YanChang **: WenDangWeiXie C5w within connecting continue wait, if ZhiJieGaiDaiMaJiaLuoJiHui and WenDang not YiZhi ; YingXianGaiWenDangZaiGaiDaiMa . 
2. ** Chao when QiDian or ZhongZhiLuoJiCuo **: C3 Chao when 1 minutes CongJinRu C3 XunHuanQiZhiSheYiCi deadline, ChuXian start when DianJi and ZhongZhi ; if in C3w every Lun all ZhongZhi or CongCuoWu when KeJi when HuiWeiFanWenDang . 
3. ** JieDian and DaiMaCuo position **: if WuBa C7a/C7w/C7b or C10 ShiXianHuan position Zhi , Hui and " Yi JieDianYi LuoJi " Biao not Fu . 
4. **C3_Result ChuBian and branch_result**: disconnect/start/game_tool/other and run_c4_branch_result FanHuiZhi and controller FenZhiXuYiYi to Ying , GaiFanHuiZhi or FenZhiWeiTong step WenDangHui 1:1 PoHuai . 

### 4.3 ZhengQueZuoFa 

- Gai C block QianXianDu this WenDang and to YingDaiMa ; Chao when and ZhongZhiYanGeAnWenDangBiaoShiXian ; newly added line for ( such as C5w within connecting) XianBuWenDangZaiShiXian ; JieDian DaiMaBiao and flow_c_d3_direct, controller Diao use LianTong step GengXin . 

---

## Wu , .cache/bn_flow_snapshots/bn_flow_B9.json

### 5.1 ZhiZe and YueDing 

- ** purpose **: BN LiuChengJieDian **B9** KuaiZhaoHuanCun ; **meta** (node="B9", reason="B9_first_screen") , **controls** ShuZu (name, automation_id, type, rect, level) , and bn_flow_B4, bn_flow_BN_LoginAsia structure YiZhi . use at TiaoShi or HuiFang B9 ShouPingKongJianShu . 
- ** YueDing **: XiaoFeiFangKeNengYiLai meta.node, meta.reason or controls; WenJianMing and meta.node to Ying ; B9 in flow in YuYi ( such as " ShouPing ") and reason, LiuChengWenDangYiZhi ; if ShengChengLuoJiBianGeng , meta or controls Xu and XiaoFeiFangJianRong . 

### 5.2 Yi by WuJie or GaiCuo Yuan because 

1. ** WuShan meta or Gai node/reason**: if reason by XiaoFeiFang use at QuFen B9 ChangJing ( such as first_screen) , Gai reason HuiYingXiangLuoJi ; node and WenJianMing not YiZhiHuiDaoZhiAnWenJianMingChaJieDianCuo . 
2. **controls structure or automation_id**: if battlenet KuaiZhaoChanChuFangGai structure or ZhanWangKeHuDuanShengJiDaoZhi automation_id BianHua , YiLai this WenJian JieXiHuiCuo . 
3. **.cache QingLi **: if QingLi .cache or bn_flow_snapshots Wei confirm B9 etc. KuaiZhao is Fou by YiLai , HuiPoHuaiTiaoShi or HuiFang . 
4. ** and B9 JieDianYuYi **: flow_bn_only_state/BNNode in B9 YuYi ( such as no ZhanWangChuangKou when Hui B2 etc. ) and this WenDang no Guan , but meta.node Xu and JieDianMingYiZhi , FouZeLiuChengTu and KuaiZhao to ZhaoCuo position . 

### 5.3 ZhengQueZuoFa 

- XiuGaiKuaiZhao structure or meta when confirm XiaoFeiFang ; QingLi .cache Qian confirm bn_flow_snapshots YiLai ; meta.node and project BN JieDianMingMingYiZhi ; reason and LiuChengWenDang or ZhuShiYiZhi . 

---

## Liu , and apology document GuanXi 

if CiQian because WeiXianTongDuShangShuWuChuYueDing ( such as INITIAL_STATE_DETECTION run_full_status_refresh and ZhuXianChengShunXu , d4_modules README registry and LuJing , _obsolete_play_button_clicker Wu use , ROSBOT_FLOW_C_BLOCK C block 1:1 and C5w WenDangXianGai , bn_flow_B9 meta/controls) and in CiWuChuFanFuGaiCuo or understand PianCha , the responsibility lies with Ji . this note YiXieRu cursor_AI_ apology directory , and in Cursor_ ZhuanShu apology document in ZengJia to this Wen Yin use . 
