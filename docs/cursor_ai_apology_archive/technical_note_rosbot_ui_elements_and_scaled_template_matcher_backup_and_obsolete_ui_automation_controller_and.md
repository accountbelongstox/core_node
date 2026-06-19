# technical note : rosbot_ui_elements.json, scaled_template_matcher_backup, _obsolete_ui_automation_controller, ROSBOT_UPDATE_FLOW

** Mu **: note CiSiChuWenJian / BeiFen / WenDang ZhiZe , Yi by WuJie or GaiCuo Yuan because , to and ZhengQueYueDing . 

** She and WenJian **: 
- `docs/rosbot_ui_elements.json`
- `docs/backup/scaled_template_matcher_backup_20260201.py`
- `utils/_obsolete_ui_automation_controller.py`
- `docs/ROSBOT_UPDATE_FLOW.md`

---

## Yi , docs/rosbot_ui_elements.json

### 1.1 ZhiZe and YueDing 

- ** purpose **: **ROSBOT ChuangKou UI FenXiChanChu ** JSON ShiLi or KuaiZhao . structure : **timestamp**, **program_name** ( such as "rosbot") , **window_info** (hwnd, title, left/top/width/height, is_active etc. ) , **controls** ShuZu (id, parent_id, type, name, automation_id, class_name, rect, level etc. ) , **files** (screenshot, annotated_screenshot Jue to LuJing ) . ShiLi in title for "The Vault", controls Han ButtonControl (OK) , ImageControl, TextControl, TitleBarControl etc. , for MouCiFenXi when KuaiZhao . 
- ** YueDing **: XiaoFeiFangKeNengYiLai timestamp, window_info, controls id/parent_id/type/name/automation_id/rect; files in LuJing for Jue to LuJing , KeNengHan use HuMing or .core_node/.d3check etc. , KuaJi or not TongHuanJingHui not Tong ; if FenXiGongJuChanChuGeShiBianGeng ( such as ZengShan char segment , Gai controls structure ) , XiaoFeiJiao this XuTong step ; this WenJian for docs XiaShiLi or LiShiKuaiZhao , FeiYun line when unique ShuJuYuan . 

### 1.2 Yi by WuJie or GaiCuo Yuan because 

1. ** WuDang config or MuBan **: if Jiang this WenJianDang "ROSBOT KongJian config " Gai name/automation_id QiWangYingXiangYun line LuoJi , ShiJi for FenXiJieGuoKuaiZhao , Yun line LuoJi not DuCiWenJianChuFeiMingQueYueDing . 
2. **files LuJing for Jue to LuJing **: screenshot, annotated_screenshot Han C:\Users\... or .core_node\.d3check\..., if Jiao this JiaDingLuJingKeYiZhiHuiKuaJiShiBai . 
3. **controls structure and FenXiGongJuBan this **: if UI FenXiGongJuShengJiGai controls item structure ( such as rect Gai for bounds) , XiaoFeiFangWeiTong step Hui KeyError or JieXiCuo . 
4. **window_info and DangQianChuangKou **: KuaiZhao for Mou when KeMouChuangKou , hwnd/title/rect HuiBian , if DaiMaJiaDing and DangQian ROSBOT ChuangKouYiZhiHuiWu use . 

### 1.3 ZhengQueZuoFa 

- MingQue this WenJian for FenXiChanChuShiLi or KuaiZhao ; XiaoFei when if YiLai structure Xian confirm ChanChuFang and Ban this ; LuJingZuoCanKao when ZhuYiJue to LuJing not KeYiZhi ; XiuGai JSON structure when Tong step Suo have DuQuFang . 

---

## Er , docs/backup/scaled_template_matcher_backup_20260201.py

### 2.1 ZhiZe and YueDing 

- ** purpose **: ** BeiFenWenJian ** (backup directory , WenJianMingHanRiQi 20260201) , for ScaledTemplateMatcher MouYiLiShiBan this . YiLai : current_dir = __file__ Suo in directory ( i.e. **docs/backup**) , project_root = dirname(current_dir) = **docs**, sys.path.insert(0, project_root); providor_index (D3_TEMPLATE_CONFIGS, get_template_path, get_global_scale etc. ) , share.game_interface_data.get_global_scale, pycore ImageMatcher. ** if ZhiJieYun line or Cong this WenJianFuZhiDaiMa **, project_root for docs and Fei pyapps/d3-check, HuiDaoZhi import ShiBai or DaoRuCuoWu module . 
- ** YueDing **: BeiFenJinZuoLiShiCanKao , not Can and ZhuLiuCheng ; if CongCiWenJianHuiFu or to BiLuoJi , XuJiang project_root Gai for project Gen ( such as pyapps/d3-check) or CongZhengQueRuKouYun line ; ZhuShiXian to d3utils or DangQian scaled_template_matcher Suo in module for Zhun . 

### 2.2 Yi by WuJie or GaiCuo Yuan because 

1. ** WuDangZhuShiXian use **: if Cong backup FuZhiLei or method to ZhuDaiMa and WeiXiuZheng project_root or import LuJing , HuiCong docs Zhao module DaoZhi ImportError. 
2. **project_root = docs**: __file__ in docs/backup Xia , dirname LiangCiHou for docs, and Zhu project Gen pyapps/d3-check not YiZhi , RenHeYiLai project_root LuJing or import HuiCuo . 
3. ** and DangQian ScaledTemplateMatcher ChaYi **: BeiFen for MouRiKuaiZhao , DangQian d3utils or providor in ShiXianKeNengYiGaiJieKou or YiLai , ZhiJieFu use BeiFenLuoJiKeNengQueShaoXinCanShu or and Xin API not JianRong . 
4. ** BeiFen directory QingLi **: if ShanChu docs/backup or this WenJian , JinShiQuGaiRiBeiFen , not YingXiangYun line ; but if have RenWuBa this WenJianDang unique ShiXianYin use HuiDuanLian . 

### 2.3 ZhengQueZuoFa 

- Shi this WenJian for ZhiDuBeiFen ; HuiFu or to Bi when to Zhu project Gen for JiZhunXiuZhengLuJing ; not CongCiWenJianZhiJieYun line or as ZhuRuKou ; ZhuLuoJi to DangQianDaiMaKu in ScaledTemplateMatcher for Zhun . 

---

## San , utils/_obsolete_ui_automation_controller.py

### 3.1 ZhiZe and YueDing 

- ** purpose **: ** YiFeiQi module ** (_obsolete_ QianZhui ) . UIAutomationController use **uiautomation**, **win32gui/win32con**, **providor.providor_second.CONFIG/load_config** Zuo RoS-BoT other exe UI ZiDongHua (tab_item_names, profile_combobox_text, sequence_combobox_names etc. ) . current_dir = utils Fu directory ( project Gen ) , sys.path.insert(0, current_dir). _safe_get_control_info etc. use Luo except TunYiChang . ** not Ying by XinDaiMa or Xian have LiuChengYin use **; DangQian ROSBOT/ ZhanWang UI CaoZuoYing to share, d3utils or LiuChengCengYueDing for Zhun . 
- ** YueDing **: not in CiWenJianKuoZhan ; not Jiang this module as UI ZiDongHua TuiJianShiXian ; if Xu RoS-BoT config or UI CaoZuo , Ying use project within DangQianYueDingFangAn ; ShanChuQian confirm no Yin use . 

### 3.2 Yi by WuJie or GaiCuo Yuan because 

1. ** WuDangKe use GongJu **: WeiZhuYi _obsolete_ QianZhui and in Ci module ShangKaiFa or import, HuiYinRu providor_second, uiautomation, CONFIG Jian (ros_settings.tab_item_names etc. ) and DangQianSheJiKeNeng not YiZhi . 
2. **providor_second YiLai **: if CONFIG or load_config QianYi to providor_index or BieChu , this WenJianHui ImportError; and PROJECT_STANDARDS etc. spec KeNengChongTu . 
3. ** Luo except**: _safe_get_control_info within DuoChu except: pass, ShuXingHuoQuShiBaiJingMoTianMoRenZhi , YiYanGai UI BianHua or TiaoShiKunNan . 
4. ** and ROSBOT_UPDATE_FLOW, E block no Guan **: this WenJian for Jiu UI ZiDongHuaKongZhiQi , and ROSBOT GengXinLiuCheng (zip, JieYa , CONFIG.ros_directory) no ZhiJieShiXianGuanXi , WuYin use HuiHun use FeiQiLuoJi . 

### 3.3 ZhengQueZuoFa 

- Shi this WenJian for ZhiDuLiShiCanKao ; not newly added YiLai , not in XinDaiMa in import; UI ZiDongHuaXuQiu to project Xian have YueDing for Zhun ; ShanChuQianQuanJuSouSuo and confirm no Yin use . 

---

## Si , docs/ROSBOT_UPDATE_FLOW.md

### 4.1 ZhiZe and YueDing 

- ** purpose **: **ROSBOT GengXinLiuCheng note **. QianZhi item Jian : ZhanWangQuFuYiTanCe for ** YaFu ** or ** GuoFu **, FouZeTiaoGuo ( not Cha zip, not DanChuang ) . LiuCheng : JianCha game_interface_data.get_battlenet_region() Fei asia/cn ZeTiaoGuo ; in ** XiaZai directory ** Zhao zip (>20M, WenJianMingPiPeiQuFu ) ; ** is FouGengXin ** XuDanChuang " is FouGengXin ROSBOT? " ( ChuFeiGouXuanZiDong use ZuiXin ROS) ; ChuangJian directory (GameTools Xia YingWenQuFu _ Ban this Hao such as Asia_36.0129) , JieYa , DiGuiZhao RoS-BoT.exe, Jiang exe Suo in directory ZhongMingMing and YiDong to GameTools\{ QuFu }_ Ban this Hao \RosBot\; FuZhi RoS-BoT.ini, GengXin CONFIG.ros_settings.ros_directory. and E block GuanXi : DianJi " QiDong ROSBOT" Hou , do_login_check within Zhi line ; E3a~E3f Jian ROSBOT_FLOW_MERMAID E sub Tu . 
- ** YueDing **: ShiXianGengXinLuoJi DaiMaXu and this WenDangYiZhi ( QuFuJianCha , zip item Jian , DanChuang , directory MingMing ROSBOT_FINAL_DIR_NAME, CONFIG Jian ) ; ChangLiang ROSBOT_GAMETOOLS_BASE etc. and WenDangLuJingYiZhi ; E block LiuChengTu and this WenDangMiaoShuTong step ; if WenDang and DaiMa not YiZhiXuTong step QiYi . 

### 4.2 Yi by WuJie or GaiCuo Yuan because 

1. ** WeiJianChaQuFu i.e. Cha zip**: if DaiMa in WeiTanCe to asia/cn when RengCha zip or DanChuang , WeiFan " WeiTanCe to QuFuZeTiaoGuo ". 
2. ** not DanChuangZhiJieGengXin **: if WeiGouXuan " ZiDong use ZuiXin ROS" QueZhiJieGengXin , WeiFan " BiXuDanChu to HuaKuang "; if ShiXianLouDanChuangHuiWuGengXin . 
3. ** directory MingMing or LuJingCuo **: if ChuangJian directory not use " YingWenQuFu _ Ban this Hao " or ZuiZhong exe LuJing not ...\RosBot\RoS-BoT.exe, and WenDang not FuHuiDaoZhi CONFIG or QiDongLuJingCuo . 
4. **CONFIG JianMing **: ros_settings.ros_directory XuZhiXiangXin directory ( such as ...\Asia_36.0129\RosBot) , if JianMing or CengJiCuoHuiXieCuo config . 
5. ** and E block Tu not Tong step **: if E3a~E3f ShiXianShunXu or item Jian and ROSBOT_FLOW_MERMAID or this WenDang not YiZhi , HuiLiuChengDuanLian or ChongFu . 

### 4.3 ZhengQueZuoFa 

- ShiXian ROSBOT GengXinQianXianDu this WenDang ; QuFuFei asia/cn ZeTiaoGuo ; DanChuang and ZiDong use ZuiXin ROS config YiZhi ; directory MingMing and LuJing and WenDangYiZhi ; CONFIG Jian and WenDangYiZhi ; E block DaiMa and LiuChengTuTong step GengXin . 

---

## Wu , and apology document GuanXi 

if CiQian because WeiXianTongDuShangShuSiChuYueDing ( such as rosbot_ui_elements for FenXiKuaiZhaoFei config , backup project_root for docs, _obsolete_ui_automation_controller Wu use , ROSBOT_UPDATE_FLOW QuFu / DanChuang / directory /CONFIG) and in CiSiChuFanFuGaiCuo or understand PianCha , the responsibility lies with Ji . this note YiXieRu cursor_AI_ apology directory , and in Cursor_ ZhuanShu apology document in ZengJia to this Wen Yin use . 
