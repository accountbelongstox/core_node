# technical note : template_config.json, reorganize_training_data, _obsolete_window_ops

** Mu **: note this SanChuDaiMa / config ZhiZe , Yi by WuJie or GaiCuo Yuan because , to and ZhengQueYueDing . 

** She and WenJian **: 
- `providor/template_config.json`
- `scripts/reorganize_training_data.py`
- `utils/_obsolete_window_ops.py`

---

## Yi , providor/template_config.json

### 1.1 ZhiZe and YueDing 

- ** purpose **: D3Check ** MoRen / MuBan config **, DingYiWanZheng config Shu structure and MoRenZhi . DingCengJianBaoKuo : general, ui_settings, log_settings, global_timeout, hotkey, anti_stuck, map_status, battlenet_asia_credentials, ros_settings, server_settings, daily_schedule, battlenet, d3, monitoring, system_settings, ui_analysis, performance, error_handling, paths, filenames, process_names, log_detection, rosbot, macro_configs ( Han skill_configs, auxiliary_config) etc. . use Hu config ( such as CONFIG_USER_PATH) JiaZaiHouTongChang and Ci structure YiZhi or for Qi sub Ji ; providor Ce config worker and get_config_value_safe etc. An ** JianLuJing ** FangWen ( such as `log_settings.log_level`, `battlenet.battlenet_path`) . 
- ** and DaiMa to Ying **: Suo have Du config DaiMaBiXu use and JSON YiZhi JianLuJing and CengJi ; newly added config item when Xu in MuBan in JiaMoRenZhi and in DuChu use XiangTongLuJing ; ShanChu or ZhongMingMingJianHuiPoHuaiYiLaiGaiJian DaiMa . 

### 1.2 Yi by WuJie or GaiCuo Yuan because 

1. ** ZhiGai JSON not GaiDaiMa **: in template_config.json in newly added or GaiMingJian , but Wei in providor_index or Ge module get_config_value Chu use XiangTongLuJing , HuiDaoZhiDu not to or Qu to None/ MoRen . 
2. ** ZhiGaiDaiMa not Gai JSON**: DaiMa in DuXinJian ( such as `get_config_value("xxx.yyy")`) , but MuBan in no xxx.yyy, use HuChuCiJiaZai or He and MoRen when KeNengQueJian , DaoZhi KeyError or line for YiChang . 
3. ** LeiXing not YiZhi **: MuBanLiMouJian for ShuZu or to Xiang , DaiMaAn char FuChuan or Shu char use , HuiLeiXingCuoWu ; or MuBan for char FuChuan and DaiMaQiWangBuEr / Shu char . 
4. ** Duo config YuanChongTu **: if Cun in template_config.json, use Hu config, HuanJingFuGai etc. DuoYuan , He and ShunXu and FuGaiGuiZeXu and WenDangYiZhi ; reckless edit MuBanJianMingHuiDaoZhi use Hu config no FaZhengQueHe and . 
5. **log_detection, log_settings etc. **: log_detection.login_try, log_settings.log_level, log_settings.show_debug_logs etc. and DESIGN_DETAIL, log_panel, log_analyzer YueDingYiZhi ; if in MuBan in GaiMingWeiTong step DaiMa , HuiDuanXianJianCe or RiZhiGuoLvShiXiao . 
6. **macro_configs.skill_configs / auxiliary_config**: and main_functions_panel, ConfigBinding, controller.get_skill_config etc. YiZhi ; JianLuJing or strategy Zhi ( YingWen key) and JSON XuYiZhi . 

### 1.3 ZhengQueZuoFa 

- ZengShanGai config item when , Tong when Gai template_config.json and Suo have DuQuGaiJian DaiMa , BaoChiJianLuJing and LeiXingYiZhi ; DuoYuYan or WenDang in if LieJu config item , Yi and GengXin . 
- and providor_index CONFIG JiaZai , get_config_value_safe/set_config_value_safe YueDingYiZhi , BiMianZhiJieGai CONFIG char Dian structure DaoZhi worker or KuoZhanDuCuo . 

---

## Er , scripts/reorganize_training_data.py

### 2.1 ZhiZe and YueDing 

- ** purpose **: YiCiXingJiao this , JiangXunLianShuJuCong `source/` QianYi to `processed/` MingMingKongJian . LuJingJi at Jiao this position Zhi : `d3_check_dir = Path(__file__).parent.parent`, i.e. pyapps/d3-check; `cache_dir = d3_check_dir / ".cache"`; `training_data_dir = cache_dir / "training_data"`. GuDingCaoZuo : Cong `source_dir = training_data_dir / "source" / "progress_bar"` Ba `yes`, `no` Liang directory YiDong to `processed_classification_dir = training_data_dir / "processed" / "classification" / "progress_bar"`; Ba `cache_dir / "d4_exp_farming_20251016_031749_166.png"` FuZhi to source_dir; if Cun in `source_dir / "metadata.json"` ZeGengXinQi `source_image` for `"d4_exp_farming_20251016_031749_166.png"`. 
- ** hardcoding **: sub directory Ming `progress_bar`, WenJianMing `d4_exp_farming_20251016_031749_166.png` hardcode ; if project Gen or .cache position Zhi not Tong ( such as Cong core_node GenYun line Ze parent.parent KeNeng not d3-check) , or no have GaiTuPian , Jiao this HuiBaoCuo or ZhiBuFenZhi line . 

### 2.2 Yi by WuJie or GaiCuo Yuan because 

1. ** LuJingJiaShe **: Jiao this JiaDing `__file__` in `pyapps/d3-check/scripts/` Xia , Gu `parent.parent` for d3-check Gen ; if CongBieChuYun line or BaJiao this Nuo to Qi it directory , cache_dir HuiCuo . 
2. ** hardcoding WenJianMing and MingMingKongJian **: ZhiChuLi `progress_bar` and YiZhangGuDing PNG; if YaoZuoQi it LeiBie ( such as other_class) or Qi it TuPian , XuGaiJiao this or FuZhiYiFenGaiCanShu ; ZhiJieGaiJiao this QueWeiGaiShiJi directory / WenJianHuiShiBai . 
3. ** MuBiaoYiCun in HuiShan **: if `processed_classification_dir/yes` or `no` YiCun in , Jiao this Hui `shutil.rmtree` Zai move; if WuBa processed Dang source Yun line , HuiQingKongYiChuLiShuJu . 
4. **metadata.json structure **: Jiao this ZhiXie `metadata['source_image']`, if Qi it DaiMaYiLai metadata GengDuo char segment , ZhiYun line this Jiao this KeNeng not WanZheng ; if metadata not Cun in Ze not HuiChuangJian . 
5. ** YiCiXing and KeChongFu **: SheJi for YiCiXingChongZu ; ChongFuYun line Hui because source YiYiZou and yes/no Zhao not to , JinDaYin WARNING. 

### 2.3 ZhengQueZuoFa 

- Jin as LiShi / YiCiXingQianYiJiao this use ; if XuZhiChiDuoMingMingKongJian or DuoTu , YingGai for CanShuHua ( MingLing line or config WenJian ) and Fei hardcoding . 
- Yun line Qian confirm `d3_check_dir`, `.cache/training_data/source/progress_bar` and YuanTuPianCun in ; not Yao to Yi is MuBiao structure directory WuYun line . 

---

## San , utils/_obsolete_window_ops.py

### 3.1 ZhiZe and YueDing 

- ** purpose **: WenJianMingDai **\_obsolete_**, BiaoShi ** YiFeiQi **. TiGong Windows ChuangKouXiangGuanCaoZuo : FindWindow, GetWindowText, ShowWindow, SetForegroundWindow, PostMessage FaJian , close/minimize/maximize/restore/hide, GetWindowRect/GetWindowClientRect, EnumWindows, GetWindowThreadProcessId, find_windows_by_title, activate_and_send_key, focus_and_send_key. YiLai `utils.color_print` ( Fei pycore) . **find_windows_by_title**: if PiPei to Duo ChuangKou , ** ZhiBaoLiuZuiHouYi , QiYuTongGuo taskkill ShaJinCheng **; ZhuLiuCheng in Zhao D3/ ZhanWangChuangKouTongChang use d3_manager, battlenet_manager, not YiLaiCi module . 
- ** and ZhuLiuChengGuanXi **: DangQian D3 ChuangKouChaZhao and AnJian by d3_manager, key_send etc. FuZe ; ZhanWang by battlenet_manager; this WenJianWeiJieRuZhuLiuCheng , JinZuoYiLiuCanKao . 

### 3.2 Yi by WuJie or GaiCuo Yuan because 

1. ** DangXian line module use **: if in ZhuLiuCheng in CongCiWenJianDaoRu find_windows_by_title or activate_and_send_key and QiWang and d3_manager/battlenet_manager YiZhi , HuiCuoWu -- QieDuoChuang when Ci module HuiSha " DuoYu " JinCheng , KeNeng and SheJi not Fu . 
2. ** DuoChuangShaJinCheng **: find_windows_by_title " BaoLiuZuiHouYi and ShaQiYu " line for Ju have PoHuaiXing ; if MouChuWu use CiHanShuZhaoZhanWang /D3, KeNengWuGuanQi it ShiLi . 
3. **ColorPrint LaiYuan **: CiChu use `utils.color_print`, and project Qi it Chu use `pycore.pyfoundations.color_print` not YiZhi ; if TongYiQianYi to pycore when LouGaiCiWenJian , or FanGuoLai in CiGai and YingXiangQi it utils, HuiHun use LiangTao . 
4. **send_key ZuoBiao **: PostMessage FaJian use key_code, no ZuoBiao ; get_window_rect FanHuiPingMuZuoBiao , get_window_client_rect FanHuiKeHuQuZhuanPingMuZuoBiao ; if Diao use FangHunXiaoKeHuQu and PingMuZuoBiao use at DianJi , HuiDianCuo . 
5. ** and key_send, d3_manager FenGong **: ZhuLiuChengFaJian , GuanChuangYingZou key_send, d3_manager, rosbot_manager etc. ; in CiWenJianGai line for not HuiYingXiangZhuLiuCheng . 

### 3.3 ZhengQueZuoFa 

- ChuangKouChaZhao and FaJianLuoJiZhiGai d3_manager, battlenet_manager, key_send etc. ZhuLiuCheng module ; not in Ci _obsolete_ WenJianShangZuoGongNengZengQiang or CongZhuLiuChengDiao use . 
- if JinCanKaoShiXian ( such as PostMessage FaJian ) , KeChaoLuoJi to Xin module and JieRuZhuLiuCheng , and FeiZhiJieFu use this WenJianRuKou . 

---

## Si , and apology document GuanXi 

if CiQian because ShangShuRenYiDian ( such as Gai template_config WeiTong step DaiMa or LeiXing , WuGai reorganize_training_data LuJing or ChongFuYun line DaoZhiShuJuDiuShi , Wu use _obsolete_window_ops or GaiQiDuoChuangShaJinChengLuoJi ) DaoZhiFanFuGaiCuo or understand PianCha , KeShi for WeiXianTongDuYueDingSuoZhi . this note YiXieRu cursor_AI_ apology directory , and in Cursor_ ZhuanShu apology document .md in ZengJia to this Wen Yin use . 
