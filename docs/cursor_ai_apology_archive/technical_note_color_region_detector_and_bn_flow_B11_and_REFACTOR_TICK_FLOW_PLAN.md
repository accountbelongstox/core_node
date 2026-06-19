# technical note : color_region_detector, bn_flow_B11.json, REFACTOR_TICK_FLOW_PLAN

** Mu **: note CiSanChuJiao this / HuanCun / WenDang ZhiZe , Yi by WuJie or GaiCuo Yuan because , to and ZhengQueYueDing . 

** She and WenJian **: 
- `scripts/color_region_detector.py`
- `.cache/bn_flow_snapshots/bn_flow_B11.json`
- `docs/REFACTOR_TICK_FLOW_PLAN.md`

---

## Yi , scripts/color_region_detector.py

### 1.1 ZhiZe and YueDing 

- ** purpose **: ** Jiao this / GongJu **, use HuaDongChuangKouZuoYanSeQuYuJianCe . ShuRuTuXiang BGR (cv2.imread) ; **TARGET_COLORS** for BGR YuanZuLieBiao (12 Se ) ; **COLOR_TOLERANCE** 5%; **MIN_REGION_AREA** 10 XiangSu ; HuaDongChuangKouZuiDa 310600; SaoMiaoBianJie left_margin=150, right_margin=328, bottom_margin=200; HouXuanQu for YanSeZhongLeiZhanBi <30%, ZhengChangQu 30%; Zhao to YanSeZhanBi 50% QuYuHou ** TiQianTingZhi ** JianCe . use Fa : `python color_region_detector.py <image_path>`; output MoRen **scripts/output/** Xia `{stem}_detected.png`, `{stem}_mask.png`. **show_color_palette.py** Cong this Jiao this import TARGET_COLORS, COLOR_TOLERANCE, calculate_color_range; **game_interface_data** ZhuShi in Ti and red portal JianCeQuYuJi at this Jiao this scan boundaries. 
- ** YueDing **: TuXiangBiXu BGR; QuYuYuanZu for 7 Yuan (x, y, width, height, area, color_stats, is_candidate) or JianRong 6 Yuan ; TARGET_COLORS BianGengXu and show_color_palette and RenHeYin use FangYiZhi . 

### 1.2 Yi by WuJie or GaiCuo Yuan because 

1. **BGR and RGB Hun use **: if ChuanRu RGB Tu or TARGET_COLORS WuXie for RGB, cv2.inRange and Se block XianShiHuiCuo ; show_color_palette JiaDing BGR, and YuanYiZhi . 
2. ** SaoMiaoBianJie and FenBianLv **: left/right/bottom margin Zhen to TeDingFenBianLv or UI BuJu ; if TuXiangChiCun or BuJuBianHuaWeiDiao margin, HuiLouJian or WuJian ; game_interface_data in red portal QuYu if Ji at this Jiao this BianJie , Gai margin XuTong step . 
3. ** MoShu **: 310, 600, 150, 328, 200, 30%, 50% etc. ; if GaiYuZhi or ChuangKouWeiWenDangHua , line for BianHuaNan to ZhuiSu . 
4. ** as Ku use when YuanZuZhangDu **: draw_regions and DaYinLuoJiJianRong 6 Yuan and 7 Yuan ; if Diao use FangJiaDingJin 6 YuanHuiLou is_candidate; newly added char segment when XuBaoChiXiangHouJianRong or Tong step Suo have JieBaoChu . 
5. ** LuJing **: current_dir = Path(__file__).resolve().parent.parent ( i.e. d3-check Gen ) ; output MoRen parent/scripts/output; if Jiao this YiDong , output Xiang to LuJingHuiBian . 

### 1.3 ZhengQueZuoFa 

- ShuRuTuXiangTongYi BGR; XiuGai TARGET_COLORS, margin, YuZhi when Tong step show_color_palette and game_interface_data etc. Yin use ; as Ku use when MingQueQuYuYuanZu for 7 Yuan and WenDangHua ; MoShuKeTi for Jiao this DingChangLiang and ZhuShi purpose . 

---

## Er , .cache/bn_flow_snapshots/bn_flow_B11.json

### 2.1 ZhiZe and YueDing 

- ** purpose **: BN LiuCheng **B11** JieDianYun line when KuaiZhao (UI Automation KongJianShu ) . by **rosbot_flow_battlenet** within `_save_ui_snapshot("B11", "B11_wait_oauth")` XieRu ; **meta.node**="B11", **meta.reason**="B11_wait_oauth" (OAuth etc. DaiTai ) . and B4/B5/B6/B7/B9/B13 etc. structure YiZhi ; use at TiaoShi , 1:1 to Zhao and DengLu /OAuth XiangGuanPanDuanCanKao . HuanCunLuJing by BN_FLOW_SNAPSHOTS_DIR JueDing ; .cache for Yun line when ChanWu . 
- ** YueDing **: XiaYou if DuQu B11 KuaiZhao ( such as DengLuShiBai /OAuth Chao when JianCe ) , Xu and meta/controls structure YueDingYiZhi ; WenJianMingGuDing for bn_flow_B11.json ( step Ming ) , reason in meta in ; Wu hardcode LuJing or Ba B11 KuaiZhao use at Qi it JieDian . 

### 2.2 Yi by WuJie or GaiCuo Yuan because 

1. ** hardcode LuJing or JieDianMing **: if DaiMa hardcode .cache or bn_flow_B11.json Jue to LuJing , QingHuanCun or HuanHuanJingHouDu not to ; YingCong BN_FLOW_SNAPSHOTS_DIR and JieDianMingShengChengLuJing . 
2. **controls structure and JianCeLuoJi not YiZhi **: if DengLuShiBai /OAuth JianCeQiWang automation_id/name and B11 KuaiZhaoShiJi structure not Tong , HuiWuPan ; B11 for " etc. Dai OAuth FanHui " Tai , and B5/B7 etc. YuYi not Tong , WuHun use . 
3. **reason and WenJianMing **: WenDang and apology directory in QiangDiao " step MingGuDing for bn_flow_B11.json, reason in meta"; if MouLuJingXieChu bn_flow_B11_wait_oauth.json etc. Dai reason WenJianMing , and YueDing not Fu . 
4. **.cache DangQuanWei **: .cache KeQingLi , KuaJiKeNeng not Cun in ; Wu in WenDang or Jiao this in JiaDingQiYiDingCun in . 

### 2.3 ZhengQueZuoFa 

- KuaiZhaoLuJingCong BN_FLOW_SNAPSHOTS_DIR and "B11" ShengCheng ; DuQuKuaiZhao DaiMa and battlenet_region_judge etc. YueDing controls structure YiZhi ; B11 Jin use at B11/OAuth XiangGuanLuoJi ; WenJianMingGuDing step Ming , reason Jin in meta and RiZhi in . 

---

## San , docs/REFACTOR_TICK_FLOW_PLAN.md

### 3.1 ZhiZe and YueDing 

- ** purpose **: **Ensure Battle.net Only / Tick QuDongLiuChengZhongGouFangAn **, YiJu ENSURE_BATTLENET_ONLY_TICK_FLOW.md. JieLun : ** Jin 1 ChuBiXuGai **--`rosbot_task_processor.py` Yue 188 line , F3/F4 item JianCong `flow_master` Gai for **flow_master2** ( ErCiDuZhuangTaiHou Zhi ) , Shi F3/F4 and " ZaiDuHouFenZhi " YiZhi ; ** not ChuangJian ** DuLi tick QuDongLiuChengLeiKu ; not Gai game_interface_data, window_monitor_timer, rosbot_extension_panel; KeXuan in process_task ErCiDuChuJiaZhuShi " ErCiDu of HouSuo have FenZhiJin use flow_master2/bn_only2". 
- ** YueDing **: ShiXianXuAn this FangAnZuoShangShu 1 line XiuGai ; not in Wei and WenDangYiZhi QingKuangXia newly added tick LiuChengLeiKu or GaiQi it WenJian . 

### 3.2 Yi by WuJie or GaiCuo Yuan because 

1. ** WeiGai F3/F4 item Jian **: if Reng use flow_master and not use flow_master2, use Hu in this tick within GuanBi flow_master HouRenWuXianChengRengHui use JiuZhiZhi line F3/F4, WeiFan ENSURE WenDang 5.3" DangQianZhuangTai " YuYi . 
2. ** WuJian tick LiuChengLeiKu **: WenDangMingQue " not ChuangJian " DuLiLeiKu ; if ChouChengXin module or XinLei "tick flow driver", and FangAn not Fu . 
3. ** GaiDongFanWeiKuoDa **: FangAnJin 1 line + KeXuanZhuShi ; if ShunDaiGai game_interface_data, window_monitor, panel XieRu or check_window LuoJi , KeNengYinRu not BiYao risk ; ChuFeiLing have SheJi , YingZhiZuoFangAnSuoLieXiuGai . 
4. ** and ENSURE_BATTLENET_ONLY_TICK_FLOW TuoJie **: this FangAn is QiShiShiQingDan ; if ENSURE WenDangHouXuXiuDing ( such as newly added " ZaiDu " step ) , this FangAnYingTong step GengXin . 

### 3.3 ZhengQueZuoFa 

- in rosbot_task_processor in Ba F3/F4 FenZhi item JianGai for flow_master2; not newly added tick LiuChengLei ; KeXuanZhuShiGuHua " ErCiDuHouZhi use flow_master2/bn_only2"; Qi it WenJianAnFangAn " not GaiDong " Zhi line ; and ENSURE_BATTLENET_ONLY_TICK_FLOW BaoChiYiZhi . 

---

## Si , and apology document GuanXi 

if CiQian because ShangShuRenYiDian ( such as color_region_detector BGR/margin/ YuanZuZhangDu and Yin use Fang not YiZhi , B11 KuaiZhaoLuJing or structure or WenJianMingYueDingHun use , REFACTOR_TICK_FLOW_PLAN WeiGai flow_master2 or WuJianLeiKu ) DaoZhiFanFuGaiCuo or understand PianCha , KeShi for WeiXianTongDuYueDingSuoZhi . this note YiXieRu cursor_AI_ apology directory , and in Cursor_ ZhuanShu apology document .md in ZengJia to this Wen Yin use . 
