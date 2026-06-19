# technical note : coordinate_picker_improvements, _obsolete_window_activator, ROSBOT_FLOW_ Liang item Xian _ ShiZhongKeNeng , i18n_d4_panel_zh

** Mu **: note CiSiChuWenDang / DaiMa / WenAn ZhiZe , Yi by WuJie or GaiCuo Yuan because , to and ZhengQueYueDing . 

** She and WenJian **: 
- `.prompts/coordinate_picker_improvements.md`
- `utils/_obsolete_window_activator.py`
- `docs/ROSBOT_FLOW_ Liang item Xian _ ShiZhongKeNeng .md`
- `providor/i18n/i18n_d4_panel_zh.json`

---

## Yi , .prompts/coordinate_picker_improvements.md

### 1.1 ZhiZe and YueDing 

- ** purpose **: ** XuQiu / GaiJin note WenDang **, JiLuZuoBiaoShiQuChuangKou YiShiXianGaiJin (2025-10-22) : ChuangKouBiaoTiDaiJieTuChiCun , YiChu " KaiShiShiQu / TingZhiShiQu / CheXiao " SanAnNiu , ChuangKouMoRenShiZhongChu at ShiQuMoShi , ShiQuJiShu and Zhu UI LiShiJiLuTong step ( TongGuo **pick_history_ref** Yin use ) . to YingShiXianWenJian : **ui/components/coordinate_picker_window.py**, **ui/panels/coordinate_calibration_panel.py**. Zhu UI ChuangJianDanChuang when XuChuan `pick_history_ref=self.pick_history`; CoordinatePicker `_update_count()` YouXian use `pick_history_ref` ChangDu , no ZeHuiTui this `len(self.picks)`. 
- ** YueDing **: XiuGai coordinate_picker XiangGuanLuoJiQianYingXianKan this WenDang and ShangShuLiangChuDaiMa , BiMianBaYiYiChu AnNiu or ShiQuMoShiKaiGuanChongXinJiaHui , or GaiDiao pick_history_ref ChuanCan and _update_count LuoJi . 

### 1.2 Yi by WuJie or GaiCuo Yuan because 

1. ** Wu to for RengXu " KaiShi / TingZhi / CheXiao "**: WenDangYiMingQueSanAnNiuYiYiChu , ChuangKouShiZhongShiQuMoShi ; if AnJiuLuoJiJiaHuiAnNiu or pick_mode KaiGuan , and DangQianSheJiChongTu . 
2. ** HuLve pick_history_ref**: Zhu UI WeiChuan pick_history_ref when , ShiQuChuangKouZhiXianShi this picks Shu , and " LiShiZongShu " SheJi not Fu ; or XiuGai coordinate_picker_window when ShanChu / GaiMing pick_history_ref DaoZhiZhu UI ChuanCanBaoCuo or JiShu not Tong step . 
3. ** ChuangKouBiaoTiGeShi **: BiaoTi for `{i18n title} - {width}x{height}`; if Gai for ZhiXianShi i18n or GaiGeShiWeiTong step WenDang , use HuKan not to ChiCunXinXi . 
4. ** WenDang and DaiMa not Tong step **: GaiJinWenDangZhiXiangJuTi line Hao ( such as 4649, 216220) ; if coordinate_picker_window or coordinate_calibration_panel ZhongGouHou line HaoBianHua , WenDangWeiGengXinHuiDaoZhiAnWenDangDing position Cuo position Zhi . 

### 1.3 ZhengQueZuoFa 

- Gai coordinate_picker QianXianDu this WenDang and coordinate_picker_window, coordinate_calibration_panel; BaoChi " no SanAnNiu , ShiZhongShiQu , pick_history_ref Yin use , BiaoTiDaiChiCun " YueDing ; line HaoBianGeng when GengXinWenDang in Yin use . 

---

## Er , utils/_obsolete_window_activator.py

### 2.1 ZhiZe and YueDing 

- ** purpose **: ** YiFeiQi module ** ( WenJianMingQianZhui _obsolete_) . WindowActivator LeiTiGongAnBiaoTi / BuFenBiaoTi /hwnd JiHuoChuangKou , HuoQuDangQianHuoDongChuangKouXinXi , MeiJuKeJianChuangKou , YiLai win32gui/win32con, ColorPrint. BaoLiuJinGongLiShiCanKao , ** not Ying by XinDaiMa or Xian have LiuChengYin use **. 
- ** YueDing **: not in CiWenJian within ZengJiaXinGongNeng ; not Jiang this module as " ChuangKouJiHuo " TuiJianShiXian ; if XuChuangKouJiHuoLuoJi , Ying use project within DangQianYueDingFangAn ( such as d3utils or ui CengYi have ShiXian ) , WuCong this WenJianFuZhi or import. 

### 2.2 Yi by WuJie or GaiCuo Yuan because 

1. ** WuDangZuoKe use GongJu **: WeiZhuYi _obsolete_ QianZhui and in Ci module Shang continue KaiFa or in XinLiuCheng in import, HuiYinRuYiQi use YiLai and line for , and project DangQianSheJiTuoJie . 
2. ** ShanChu or ZhongMingMingWeiTongZhi **: if project JueDingCheDiYiChuFeiQiDaiMa , Ying confirm no Yin use HouZaiShan ; if JinZhongMingMingWenJianWeiTong step WenDang / apology directory , HouXuKeNengWu to for Hai have "WindowActivator" Ke use . 
3. ** and Xian have ChuangKouLuoJiHunXiao **: project KeNengYi have Qi it ChuangKouJiHuo / QianZhiLuoJi ( such as ZhanWang , D3/D4 ChuangKou ) ; Ba this WenJianLuoJi and that XieHun for YiTanHuiDaoZhiChongFuShiXian or line for ChongTu . 

### 2.3 ZhengQueZuoFa 

- Shi this WenJian for ZhiDuCanKao , not newly added YiLai , not in XinDaiMa in import; ChuangKouJiHuoXuQiu to project Xian have YueDingShiXian for Zhun ; ShanChuQian confirm no Yin use and GengXinXiangGuan note . 

---

## San , docs/ROSBOT_FLOW_ Liang item Xian _ ShiZhongKeNeng .md

### 3.1 ZhiZe and YueDing 

- ** purpose **: ** LiuChengQiYi note WenDang **, Zhen to " Liang item Xian " ShiZhongKeNengHanYiZuoMeiJu , BiMianGaiLiuChengTu when understand Cuo . She and C4 ShiTuWeiPiPei / YouXiDiaoXian F1d ShiBie to DiaoXian F1c JieShu D3 etc. ; ShiZhongBaoKuo : F1c Liang item RuBian , C/F Liang subgraph within GeYi item , Liang and LieDiaoXianJieDian , C4 Liang item LuJing , Tong to JieDianLiang item Bian , Liang step ( PanDing + Zhi line ) , ShiJueLiang segment , LiangZhongXianXing , LiangLaiYuanJinHuiZongJieDian , TuLiLiang item note . WenDangYaoQiu " you Shuo is NaYiZhong ( or NaJiZhong ) , I An that GaiTu ". 
- ** YueDing **: XiuGai ROSBOT LiuChengXiangGuanTu or WenDang when , if She and " Liang item Xian "" DiaoXian JieShu D3" etc. BiaoShu , YingXian to Zhao this WenDangQueDingSuoZhi is ShiZhong in NaYiZhong , ZaiGaiTu / DaiMa , BiMianAnCuoWu understand Gai Mermaid or LiuChengDaiMa . 

### 3.2 Yi by WuJie or GaiCuo Yuan because 

1. ** ZiXuanYiZhongWei and XuQiuFang confirm **: WenDangMingQueYao " you ZhiRen is NaYiZhong "; if Zi line JiaDing for MouYiZhong ( such as JinDangLiang item RuBian ) and GaiTu , KeNeng and use HuSuoZhi not YiZhi , DaoZhiFanFuXiuGai . 
2. ** LiuChengDaiMa and Tu not YiZhi **: if ZhiGaiWenDang / TuWeiGai tick or BNNode/Extension etc. DaiMa ( or Fan of ) , HuiChuXian " Tu is Yi item Xian , DaiMa is Liang item LuoJi " or XiangFan , ZaoCheng 1:1 He to HunLuan . 
3. ** JieDian / BianMingMing and WenDang not Fu **: such as F1d, F1c, C4, C10 etc. JieDianMing and rosbot_flow DaiMa or Qi it LiuChengWenDang not YiZhi when , this WenDang " No. Yi item Xian / No. Er item Xian " MiaoShuHui to YingCuo . 
4. ** ShiZhong understand Hun use **: BaDuoZhongJieShiHun in YiQiGai ( such as JiGaiXianXingYouGaiJieDian ) , Wei in WenDang or TuLi in GuDing " Liang item Xian " unique DingYi , HouXuWeiHuNan to YiZhi . 

### 3.3 ZhengQueZuoFa 

- She and " Liang item Xian " or DiaoXian JieShu D3 GaiDong when , XianMingQue to YingShiZhong in NaYiZhong ( or ZuHe ) , ZaiGaiTu and DaiMa and BaoChi 1:1; TuLi or note in XieMing " Liang item Xian " Cai use HanYi ; JieDian / BianMingMing and rosbot_flow etc. DaiMaYiZhi . 

---

## Si , providor/i18n/i18n_d4_panel_zh.json

### 4.1 ZhiZe and YueDing 

- ** purpose **: D4 panel in WenWenAn . structure : **ui.d4_panel** (title, sub_tabs.exp_farming, exp_farming.*, debug_window.*, game_status.* etc. ) ; GenXiaLing have **team_health** (local_map, non_local_map, same_map etc. ) . DaiMaTongGuo i18n_manager/get_ui_text An key DuQu ( such as "ui.d4_panel.title", "ui.d4_panel.exp_farming.start_button") ; if i18n JiaZaiFangShi for AnWenJianHe and MingMingKongJian , Xu confirm team_health key QianZhui ( such as "team_health.local_map" or "ui.team_health.*") and DaiMaYiZhi . 
- ** YueDing **: key and DaiMa in get_ui_text char FuChuanYiZhi ; and i18n_d4_panel_en.json key structure to Qi to Bian to Zhao ; not SuiYiGai key Ming or CengJiDaoZhiDaiMaQu not to or QuCuo . 

### 4.2 Yi by WuJie or GaiCuo Yuan because 

1. **key and DaiMa not YiZhi **: DaiMaXie get_ui_text("ui.d4_panel.game_status.xxx") and JSON XieCheng game_status.xxx ShaoYiCeng , or PinXieCuoWu , HuiXianShi key or QueYi . 
2. ** in YingWen key not Tong step **: if i18n_d4_panel_en and zh key JiHe or CengJi not Tong , QieHuanYuYan when Que item or fallback to CuoWu key. 
3. **team_health position Zhi **: DangQian team_health and ui and Lie at Gen ; if i18n_manager YueDingSuo have UI WenAn in "ui." Xia , Ze team_health KeNengXuQianRu ui.team_health or DanDuMingMingKongJian , FouZeDaiMaCeKeNeng use "ui.team_health.xxx" Qu not to . 
4. ** QianTao and LeiXing **: JSON in Zhi for char FuChuan ; if WuXie for ShuZu or to XiangQieDaiMaAn char FuChuan use , HuiBaoCuo or XianShiYiChang . 

### 4.3 ZhengQueZuoFa 

- ZengShanGai key when Tong step DaiMa in get_ui_text and YingWen zh/en WenJian ; confirm i18n_manager to MingMingKongJian and WenJianHe and GuiZeHou , ZaiJueDing team_health is FouFang in ui Xia ; BaoChiZhi for char FuChuanLeiXing . 

---

## Wu , and apology document GuanXi 

if CiQian because ShangShuRenYiDian ( such as WeiDu coordinate_picker_improvements then GaiShiQuLuoJi , Wu use _obsolete_window_activator, WeiAn " Liang item Xian " ShiZhongHanYi confirm then GaiLiuChengTu , i18n_d4_panel_zh key or team_health structure and DaiMa not YiZhi ) DaoZhiFanFuGaiCuo or understand PianCha , KeShi for WeiXianTongDuYueDingSuoZhi . this note YiXieRu cursor_AI_ apology directory , and in Cursor_ ZhuanShu apology document .md in ZengJia to this Wen Yin use . 
