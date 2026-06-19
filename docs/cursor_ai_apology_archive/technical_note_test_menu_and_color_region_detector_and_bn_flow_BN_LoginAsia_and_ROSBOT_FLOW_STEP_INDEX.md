# technical note : test_menu.py, color_region_detector.py, bn_flow_BN_LoginAsia.json, ROSBOT_FLOW_STEP_INDEX.md

** Mu **: note CiSiChuWenJian / WenDang ZhiZe , Yi by WuJie or GaiCuo Yuan because , to and ZhengQueYueDing . bn_flow_BN_LoginAsia Yi in ** technical note _screenshot_categories and ROSBOT_FIND_LOGIC_LIST and bn_flow_BN_LoginAsia and OCR_CNSTD and kanai_cube_handler.md** No. SanJieXiangShu , CiChuJin abstract and BuChong and test_menu, color_region_detector, ROSBOT_FLOW_STEP_INDEX LianDong . 

** She and WenJian **: 
- `scripts/test_menu.py`
- `scripts/color_region_detector.py`
- `.cache/bn_flow_snapshots/bn_flow_BN_LoginAsia.json`
- `docs/ROSBOT_FLOW_STEP_INDEX.md`

---

## Yi , scripts/test_menu.py

### 1.1 ZhiZe and YueDing 

- ** purpose **: ** JiaoHuShiCaiDanGongNeng test Jiao this **, use at YanZheng interactive_menu DanXuan / DuoXuan and HuanCunChiJiuHua . YiLai `from interactive_menu import InteractiveMenu`; HuanCunLuJing for `Path.home() / ".core_node" / ".scripts" / "menu_test_cache.json"`, i.e. use HuZhu directory Xia .core_node/.scripts, ** Fei ** project within LuJing . 
- ** YueDing **: Yun line when YingNengCongDangQianHuanJingJieXi `interactive_menu` ( TongChang **cwd for pyapps/d3-check** or PYTHONPATH Han pyapps/d3-check, Qie interactive_menu position at scripts/ or BaoGen ) ; cache_key and test in "test_game_type", "test_templates" YiZhi ; WuBa cache Gai to project .cache or scripts Xia , FouZe and " KuaYun line ChiJiuHua to use Hu directory " SheJi not Fu . 

### 1.2 Yi by WuJie or GaiCuo Yuan because 

1. **import and Yun line directory **: Gou B garbage Cursor KeNengWu to for test_menu in scripts/ Xia i.e. Ying to `from scripts.interactive_menu` or Xiang to LuJingDaoRu , or Gai sys.path for `parent.parent` ( ZhiXiang core_node) DaoZhi in pyapps/d3-check XiaYun line Fan and Zhao not to interactive_menu. 
2. **cache LuJing **: if Jiang cache_file Gai for `Path(__file__).parent / "menu_test_cache.json"` or project .cache, HuiPoHuai " every CiYun line Jiao this in not TongGongZuo directory XiaRengGongXiangTongYi use HuJiHuanCun " YueDing , test no FaYanZhengKuaYun line ChiJiuHua . 
3. ** and interactive_menu QiYue **: technical note _interactive_menu and combobox and code_reuse_analysis YiXieMing interactive_menu for ** Jiao this Ji CLI**, no tk; if in test_menu in YinRu tk or providor Zuo " CaiDan test " Hui and interactive_menu Ding position ChongTu . 

### 1.3 ZhengQueZuoFa 

- XiuGai test_menu QianXianDu ** technical note _interactive_menu and combobox and code_reuse_analysis.md**; not Gai cache_file for use HuZhu directory .core_node/.scripts; not Gai import for Bao within Xiang to DaoRu , ChuFeiTong when WenDangHuaYun line FangShi ( such as `python -m scripts.test_menu` Qie scripts for Bao ) ; Yun line FangShi to " in pyapps/d3-check XiaZhi line or PYTHONPATH HanGai directory " for Zhun . 

---

## Er , scripts/color_region_detector.py

### 2.1 ZhiZe and YueDing 

- ** purpose **: ** YanSeQuYuJianCeJiao this **, use HuaDongChuangKouFa in TuXiang in JianCeMuBiaoSe block . `current_dir = Path(__file__).resolve().parent.parent` i.e. **pyapps/d3-check**, `sys.path.insert(0, str(current_dir))` HouDaoRu `from pycore.pyfoundations.color_print import ColorPrint`, GuYaoQiu pycore position at pyapps/d3-check Xia or GaiLuJing in PYTHONPATH in . 
- ** SuanFaYueDing **: TARGET_COLORS for BGR YuanZuLieBiao (OpenCV BGR) ; COLOR_TOLERANCE=0.05 (5%) ; MIN_REGION_AREA=10; SaoMiaoBianJie left_margin=150, right_margin=328, bottom_margin=200; JianCeQuYuZuiDa 310600; QuYuYuanZu for **(x, y, width, height, area, color_stats, is_candidate)** Gong 7 item , is_candidate for color use Lv <30%; TongLeiXingQuYu not KeChongDie , not TongLeiXing (candidate vs normal) KeChongDie ; Zhao to color use Lv 50% ZhengChangQuYuHouTiQianTingZhiJianCe . 
- ** YueDing **: draw_regions, process_image etc. HuiAn 7 YuanZu or 6 YuanZu ( JianRong no is_candidate) JieBao ; Gai left/right/bottom BianJie or 310/600 Wei and SuanFa note or Diao use FangTong step HuiLouJian or WuJian ; Gai BGR SeBiao or tolerance Wei and use GaiJiao this LiuChengTong step HuiShiBieCuo . 

### 2.2 Yi by WuJie or GaiCuo Yuan because 

1. ** project Gen and pycore**: Gou B garbage Cursor KeNengBa `parent.parent` Gai for `parent.parent.parent` to " ZhiXiang core_node", DaoZhi in pyapps/d3-check XiaYun line Jiao this when pycore not in path in and ImportError; or Wu to for pycore in workspace Gen and Fei pyapps/d3-check Xia . 
2. ** SaoMiaoBianJie and SuanFa **: left_margin/right_margin/bottom_margin and WenDangZhuShi "Skip edges: left 150px, right 328px, bottom 200px" YiZhi ; if for " YouHua " SuiYiGaiXiao or GaiDaSaoMiaoQuHuiLouDiao have XiaoQuYu or SaoJin no GuanBianYuan . 
3. ** QuYuYuanZu structure **: FanHuiZhi and draw_regions, REGION DETAILS DaYinChuJunYiLai 7 YuanZu ( Han is_candidate) ; if Gai for 6 YuanZuQieWei in draw_regions in TongYiAn 6 YuanZu and JiSuan is_candidate HuiJieBaoCuo or XianShiCuo . 
4. **BGR and RGB**: ZhuShiYiXieMing OpenCV use BGR; if An RGB ShunXuGai TARGET_COLORS HuiYanSeWanQuanCuo . 

### 2.3 ZhengQueZuoFa 

- XiuGaiQian confirm Yun line ShangXiaWen : Jiao this to pyapps/d3-check for project Gen , parent.parent i.e. Gai directory ; Gai margin or max_width/max_height when and SuanFa note and RenHeYiLai " JianCeQuYu " Diao use FangTong step ; BaoChiQuYu 7 YuanZu or Quan project TongYi 6 YuanZu and JianRong ; BGR SeBiao and tolerance and ShangYouYueDingYiZhi . 

---

## San , .cache/bn_flow_snapshots/bn_flow_BN_LoginAsia.json

### 3.1 ZhiZe and YueDing ( abstract ) 

- ** purpose **: BN LiuChengJieDian **BN_LoginAsia** ( YaZhouDengLuChuangKou ) KuaiZhaoHuanCun . structure : **meta** (node="BN_LoginAsia", reason="asia_login") , **controls** ShuZu , every item Han name, automation_id, type, rect (left/top/right/bottom/width/height) , level. WenJianMing and meta.node to Ying . 
- ** YueDing **: meta.node and BN JieDianMingMing ( such as flow_battlenet, BNNode) YiZhi ; reason Ke by XiaoFeiFang use at QuFenJinRuYuan because ; controls structure ( Han rect, automation_id) and operate_by_spec, docs/rosbot_ui_structure etc. YiZhi ; WuShan meta or Gai node/reason DaoZhi and WenJianMing or LiuChengTuJieDianCuo position . 

### 3.2 Yi by WuJie or GaiCuo Yuan because 

1. ** and B8 etc. KuaiZhaoHunXiao **: bn_flow_B8.json meta.reason for "B8_to_B9" etc. step JianYuan because ; BN_LoginAsia reason for "asia_login" BiaoShiYaZhouDengLuJieMian . if Gou B garbage Cursor TongYiGaiChengShu char or step DaiHaoHuiPoHuaiXiaoFeiFang to reason YuYiYiLai . 
2. **controls structure **: if Gai rect for bounds or Gai automation_id MingMingWei and rosbot_ui_structure, operate_by_spec Tong step HuiJieXiCuo or DianJiCuo . 
3. **.cache QingLi **: QingLi .cache or bn_flow_snapshots when Wei confirm is Fou have LuoJiYiLaiGai directory HuiPoHuaiTiaoShi or HuiFang . 

### 3.3 ZhengQueZuoFa 

- XiangJian ** technical note _screenshot_categories and ROSBOT_FIND_LOGIC_LIST and bn_flow_BN_LoginAsia and OCR_CNSTD and kanai_cube_handler.md** No. SanJie ; XiuGai meta or controls Qian confirm XiaoFeiFang ; meta.node and project within BN JieDianMingMingYiZhi . 

---

## Si , docs/ROSBOT_FLOW_STEP_INDEX.md

### 4.1 ZhiZe and YueDing 

- ** purpose **: **ROSBOT LiuChengTu step and DaiMa module SuoYin **. every LiuChengTu step (A1A9, B1B16, F0F4, C1C12, D1D14, E1E6, TM) YingShe to ShiXian module and ZhuangTai (Done/TODO) . **Source of truth** for `docs/ROSBOT_FLOW_MERMAID.md`. 
- ** YueDing **: DaiMa or MERMAID BianGeng when XuTong step this SuoYin ; WenMo "Code vs diagram (current behaviour)" MiaoShuDangQian line for ( such as F0 ZhiPao F1, A8F2, C4 disconnectD1) ; if Gai flow_master_driver, rosbot_flow_*.py, rosbot_flow_battlenet etc. WeiTong step this WenDangHuiDaoZhiSuoYin and ShiXian not Fu , HouXuWeiHuZheAnSuoYinDuHuiCuo . 

### 4.2 Yi by WuJie or GaiCuo Yuan because 

1. **F0 ZhiPao F1**: WenDangMingQue F0 ZhiYun line F1, FanHui b1B2 or c1C1; F2/F3/F4 not in F0 within Zhi line . if Gou B garbage Cursor in F0 or run_f0_prejudge_entry within JiaRu F2/F3 Diao use HuiPoHuai "F0 JinYuPan , F2 in A8 Hou by extension XianChengPao " SheJi . 
2. **A8F2**: Tu in C8 ChengGongHou to A8, ZaiJinRu F2 (is ROSBOT online?) . DaiMaCe C8 ChengGong in extension XianCheng within FanHuiHouGaiXianChengHuiPao run_f2_rosbot_online(); in tick Ce C8 ChengGong when trigger_extension_rosbot_started(True), E block Yi in C_C7b within PaoGuo , F2 not in tick in ZaiPao . if Wu in tick in ZaiPao F2 HuiChongFu or ZhuangTaiLuan . 
3. ** SuoYin and ShiXianTuoJie **: if Gai rosbot_flow_f3_log_timeout, run_f4_close_d3_send_f7, enter_battlenet_at_b2 etc. HanShuMing or Diao use GuanXiWeiGengXin this SuoYin Module Lie , HuiWuDaoHouXuYueDu . 
4. **Code vs diagram Jie **: GaiJieMiaoShuDangQian line for and TuChaYi ; if DaiMaGai line for ( such as C4 disconnect HouZou D1) WeiGengXinGaiJieHuiWenDang and ShiXian not YiZhi . 

### 4.3 ZhengQueZuoFa 

- XiuGai flow XiangGuanDaiMa or ROSBOT_FLOW_MERMAID.md when DangCiGengXin ROSBOT_FLOW_STEP_INDEX.md Step/Module/Status and "Code vs diagram"; Du this WenDang when to "Source of truth for MERMAID" for Zhun , SuoYin for SuCha ; Wu in WeiDu this SuoYin and MERMAID QingKuangXiaGai F0/F2/F3/F4 Diao use GuanXi . 

---

## Wu , SiChuLianDong and YiCuo summary 

- **test_menu** YiLai **interactive_menu** ( Jiao this Ji CLI) , Yun line Gen for pyapps/d3-check, cache in use HuZhu directory ; Gai test_menu import or cache Xu and interactive_menu technical note YiZhi . 
- **color_region_detector** project Gen for parent.parent=pyapps/d3-check, pycore in CiLuJingXia ; SuanFaChangShu and 7 YuanZuQuYu structure WuDanDuGai and not Tong step . 
- **bn_flow_BN_LoginAsia.json** and bn_flow_B8 etc. TongShu bn_flow_snapshots, meta.node/reason and BN JieDianMingMing and XiaoFeiFangYueDingYiZhi ; structure BianGengXuTong step technical note _screenshot_categories... and operate_by_spec. 
- **ROSBOT_FLOW_STEP_INDEX.md** and ROSBOT_FLOW_MERMAID, flow_master_driver, rosbot_flow_*.py Xu dual XiangTong step ; F0/F1, A8F2, C4D1 etc. line for MiaoShu not Ke and DaiMa not YiZhi . 

CiQian if because WeiXianTongDuShangShuYueDing and in CiSiChuFanFuGaiCuo or understand PianCha , the responsibility lies with the dog B garbage Cursor. HouXuXiuGaiQian to this note for Zhun . 
