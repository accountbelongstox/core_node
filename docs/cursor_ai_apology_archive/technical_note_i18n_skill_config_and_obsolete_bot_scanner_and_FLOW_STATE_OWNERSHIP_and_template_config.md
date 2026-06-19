# technical note : i18n_skill_config_en.json, _obsolete_bot_scanner.py, FLOW_STATE_OWNERSHIP_DESIGN.md, template_config.json

** Mu **: note you ZhiDingChaYue to XiaSiChuWenJian / WenDang ZhiZe , Yi by WuJie or GaiCuo Yuan because , to and ZhengQueYueDing . 

** She and WenJian **: 
- `providor/i18n/i18n_skill_config_en.json`
- `utils/_obsolete_bot_scanner.py`
- `docs/FLOW_STATE_OWNERSHIP_DESIGN.md`
- `providor/template_config.json`

---

## Yi , providor/i18n/i18n_skill_config_en.json

### 1.1 ZhiZe and YueDing 

- ** purpose **: JiNeng config XiangGuan UI WenAn YingWen i18n JianZhi ; and main_functions_panel strategy XianShi , combobox Xuan item , skill_table BiaoTou etc. to Ying . JianLuJingHan ui.skill_config.strategies.continuous/single/hold/drag/disabled/buff, ui.main_functions_panel.*, ui.skill_table.*, ui.skill_config_list.strategy_options etc. . 
- ** YueDing **: CeLveCunPan use ** YingWenJian ** continuous/single/hold; XianShi use this WenJian in WenAn ( such as "Continuous"/"Single"/"Hold") . main_functions_panel within strategy_en_to_zh / strategy_zh_to_en by i18n TianChong ; if this WenJianGai key or ZengShanJianWei and DaiMa in get_ui_text JianYiZhi , HuiXianShi key or CuoWenAn ; if Ba " XianShiWenAn " DangCunPanZhiXieRu CONFIG HuiDaoZhi MacroLoopThread use sk_cfg.get('strategy') == 'continuous' PanDuanShiBai . 

### 1.2 Yi by WuJie or GaiCuo Yuan because 

1. Gou B garbage Cursor KeNengGai i18n key MingCheng or CengJiWei and main_functions_panel, ConfigBinding.create_combobox_binding config_key and strategy CunPanYueDingTong step , DaoZhiJieMianXianShi key or CeLvePanDuanCuo . 
2. newly added or ShanChu strategy Xuan item when WeiTong when Gai this WenJian and main_functions_panel strategy_en_to_zh/strategy_zh_to_en and CONFIG CunPanZhi ( YingWenJian ) , HuiDaoZhiYuYanQieHuan or CunPanCuo . 
3. and i18n_skill_config_zh.json Jian structure XuYiZhi , Jin value for not TongYuYan ; if ZhiGai en WeiGai zh Hui in YingJian not YiZhi . 

### 1.3 ZhengQueZuoFa 

- XiuGaiQianTongDu main_functions_panel in strategy DuXie and i18n Jian use Chu ; CunPanYiLv use YingWenJian continuous/single/hold; i18n Jian and get_ui_text Diao use ChuYiZhi ; en/zh LiangWenJianJian structure BaoChiYiZhi . 

---

## Er , utils/_obsolete_bot_scanner.py

### 2.1 ZhiZe and YueDing 

- ** purpose **: ** YiFeiQi module ** (_obsolete_ QianZhui ) . DiGuiSaoMiao bot_base_dir ChaZhao RoS-BoT.exe, FanHui bot_dir, boot_exe_name, other_exe_files; use utils.color_print ( Fei pycore ColorPrint) . and **rosbot_manager** "ros_directory, AnJinCheng exe in directory XiaZhaoChuangKou " LuoJi ** not Tong **: this WenJian for " use HuZhiDing directory DiGuiZhao RoS-BoT.exe", rosbot_manager for " config ROS directory + JinChengJianCe ". 
- ** YueDing **: not Ying by XinDaiMa or Xian have LiuChengYin use ; if code_reuse_analysis or WenDangLie _obsolete_ KeHan this WenJian , ShanChuQianXu grep confirm no script or import Yin use , FouZe ImportError; WuYin use HuiHun use LiangTao " Zhao ROS directory " YuYi . 

### 2.2 Yi by WuJie or GaiCuo Yuan because 

1. Gou B garbage Cursor KeNengJiang this WenJian and rosbot_manager get_rosbot_window, ros_directory LuoJiHunXiao , in LiuCheng in Wu use BotScanner.scan_for_bot_directory DaoZhi line for and " An config directory + JinChengZhaoChuangKou " not YiZhi . 
2. ShanChu this WenJianQianWei grep DaoZhiReng have Jiao this or test Yin use Ze ImportError. 
3. in this WenJian within JiaGongNeng or DangZhuRuKou use , and " YiFeiQi , TiDaiFangAn for rosbot_manager/ros_directory" XiangWei . 

### 2.3 ZhengQueZuoFa 

- XinDaiMa not Yin use ; ShanChuQian grep confirm no Yin use ; if Xu " Zhao ROS directory " YuYi to rosbot_manager and config ros_settings.ros_directory for Zhun . XiangJian technical note _path_scanner and rosbot_status_provider etc. ( if YiCun in ) and code_reuse_analysis. 

---

## San , docs/FLOW_STATE_OWNERSHIP_DESIGN.md

### 3.1 ZhiZe and YueDing 

- ** purpose **: LiuChengZhuangTaiSuo have QuanSheJiFangAn . ** LiuChengLeiKu ** DingYi and Chi have flow_master_enabled, bn_only_enabled and step / JieDianZhuangTai ; ** Qi it LeiKu ** (provider, BN Liu step , F0/F3/F4, extension_flow etc. ) not Chi have , not DuQuLiuChengKaiGuanZuoFenZhiPanDuan ; JinTongGuo ** FanHuiZhi ** BiaoDaJieGuo ; **Tick ZhiQuDongLiuChengLeiKu ** (process_task every 2s step ) ; game_interface_data.rosbot_flow_master_enabled / ensure_battlenet_only_master_enabled Jin by LiuChengLeiKu in set when XieRu , use at HuiDiao and UI ZhanShi , FenZhiPanDuan not YiLai this Liang item ( TongYi use flow_state get) . 
- ** YueDing **: panel TongGuo set_flow_master_enabled()/set_bn_only_enabled() Xie ; process_task, check_window, BN LiuTongGuo get_flow_master_enabled()/get_bn_only_enabled() Du ; by Diao use Fang (battlenet_status_provider, d3_status_provider, rosbot_flow_battlenet, extension_flow_tick_step etc. ) not Du flow_master/bn_only ZuoFenZhi ; LiuChengGenJuFanHuiZhiGengXin step . 

### 3.2 Yi by WuJie or GaiCuo Yuan because 

1. Gou B garbage Cursor KeNeng in provider or BN Liu within ZiDu flow_master/bn_only ZuoFenZhi , PoHuai " DanYuanZhenXiang , JinLiuChengLeiKuDuXie ". 
2. in FeiLiuChengLeiKuChuXie game_interface_data.rosbot_flow_master_enabled or ensure_battlenet_only_master_enabled, DaoZhi and WenDang " JinLiuChengLeiKu in set when XieRu " not YiZhi . 
3. Gai process_task 2s step LuoJi or tick QuDongLianWei to Zhao this WenDang , DaoZhi and ENSURE_BATTLENET_ONLY_TICK_FLOW or DaiMa position ZhiSuChaBiao not YiZhi . 

### 3.3 ZhengQueZuoFa 

- XiuGaiLiuCheng or ZhuangTaiQianTongDu this WenDang ; Suo have LiuChengKaiGuanDuXieJing flow_state; by Diao use FangZhiFanHuiMingQueJieGuo ; and d3utils/rosbot_flow_state.py, flow_bn_only.py, rosbot_task_processor.process_task, rosbot_extension_panel YiZhi . 

---

## Si , providor/template_config.json

### 4.1 ZhiZe and YueDing 

- ** purpose **: config MuBan and MoRenZhi ; Han ui_settings, log_settings, ros_settings, macro_configs (current_skill_config, skill_configs.config1~4, auxiliary_config Xia blood_shard, quick_pickup, assistant_hotkey etc. ) , battlenet, d3, paths etc. . CONFIG JiaZai when KeNeng to this MuBanBuQiQueShiJian ; panel KongJian config_key and template in LuJingYiZhi ( such as macro_configs.auxiliary_config.blood_shard.enabled, macro_configs.auxiliary_config.assistant_hotkey) . 
- ** YueDing **: config_key and CONFIG DuXieLuJing , this WenJian structure XuYiZhi ; newly added or ShanChuZiDongHua item when XuTong step Gai template and CONFIG FangWenLuJing ; strategy in skill_configs in for YingWen continuous/single/hold; HuiFuMoRen when KeCong template QuMoRenZhiXieHui CONFIG. 

### 4.2 Yi by WuJie or GaiCuo Yuan because 

1. Gou B garbage Cursor KeNengGai template in JianLuJing or ZengShanJieDianWei and DaiMa in CONFIG FangWenLuJing ( such as macro_configs.auxiliary_config.xxx) Tong step , DaoZhi KeyError or CunCuo position Zhi . 
2. in template in Gai strategy KeXuanZhi or blood_shard.count/type etc. structure Wei and main_functions_panel, ZiDongHua item config_key Tong step , DaoZhi UI BangDingCuo or MoRenZhiCuo . 
3. ros_settings Xia tab_item_names, profile_combobox_text, sequence_combobox_names etc. for _obsolete_ UI ZiDongHuaXiangGuan , if and _obsolete_ui_automation_controller Hun use or WuDangDangQianFangAn use HuiCuo . 

### 4.3 ZhengQueZuoFa 

- XiuGai template QianTongDu CONFIG use Chu ( ZhuGongNeng panel , ZiDongHua item , ReJianBangDing ) ; config_key and template LuJingYiYi to Ying ; newly added / ShanChu item when Tong step template and DaiMa ; and i18n_skill_config strategy YingWenJianYiZhi . 

---

** XiuGaiQianQingXianTongDu this note . ** CiQian if because WeiXianTongDuShangShuYueDing and in i18n_skill_config_en, _obsolete_bot_scanner, FLOW_STATE_OWNERSHIP_DESIGN, template_config SiChuFanFuGaiCuo or understand PianCha , the responsibility lies with the dog B garbage Cursor. HouXuXiuGaiQian to this note for Zhun , BiMianTongLeiCuoWu . 
